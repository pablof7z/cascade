//! Database persistence for Cascade markets.
//!
//! Uses SQLite via sqlx for local state storage.

use chrono::{DateTime, Utc};
use sqlx::{Pool, Row, Sqlite, SqlitePool, sqlite::SqliteRow};

use crate::error::{CascadeError, MarketStatus};
use crate::lmsr::Outcome;
use crate::market::{Market, Trade};

/// Database wrapper for Cascade markets.
#[derive(Clone)]
pub struct Database {
    pool: Pool<Sqlite>,
}

impl Database {
    /// Create a new database connection pool.
    pub async fn new(database_url: &str) -> Result<Self, CascadeError> {
        let pool = SqlitePool::connect(database_url).await?;
        Ok(Self { pool })
    }

    /// Create tables if they don't exist.
    pub async fn init(&self) -> Result<(), CascadeError> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS markets (
                slug TEXT PRIMARY KEY,
                event_id TEXT NOT NULL DEFAULT '',
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                mint TEXT NOT NULL,
                image TEXT,
                creator_pubkey TEXT NOT NULL,
                created_at TEXT NOT NULL,
                b REAL NOT NULL,
                q_long REAL NOT NULL DEFAULT 0,
                q_short REAL NOT NULL DEFAULT 0,
                reserve_sats INTEGER NOT NULL DEFAULT 10000,
                status TEXT NOT NULL DEFAULT 'open',
                outcome INTEGER,
                resolved_at TEXT,
                end_date TEXT
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS trades (
                id TEXT PRIMARY KEY,
                market_slug TEXT NOT NULL,
                side TEXT NOT NULL,
                amount REAL NOT NULL,
                price REAL NOT NULL,
                cost_sats INTEGER NOT NULL,
                fee_sats INTEGER NOT NULL,
                total_sats INTEGER NOT NULL,
                trader_pubkey TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (market_slug) REFERENCES markets(slug)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS positions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                market_slug TEXT NOT NULL,
                side TEXT NOT NULL,
                amount REAL NOT NULL,
                cost_basis INTEGER NOT NULL,
                holder_pubkey TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (market_slug) REFERENCES markets(slug)
            )
            "#,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get a pool reference for external use.
    pub fn pool(&self) -> &Pool<Sqlite> {
        &self.pool
    }

    // ==================== MARKET OPERATIONS ====================

    /// Save a market to the database.
    pub async fn save_market(&self, market: &Market) -> Result<(), CascadeError> {
        sqlx::query(
            r#"
            INSERT OR REPLACE INTO markets (
                slug, event_id, title, description, mint, image, creator_pubkey,
                created_at, b, q_long, q_short, reserve_sats, status, outcome,
                resolved_at, end_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&market.slug)
        .bind(&market.event_id)
        .bind(&market.title)
        .bind(&market.description)
        .bind(&market.mint)
        .bind(&market.image)
        .bind(&market.creator_pubkey)
        .bind(market.created_at.to_rfc3339())
        .bind(market.b)
        .bind(market.q_long)
        .bind(market.q_short)
        .bind(market.reserve_sats as i64)
        .bind(market.status.to_string())
        .bind(market.outcome.map(|v| if v { 1 } else { 0 }))
        .bind(market.resolved_at.map(|dt| dt.to_rfc3339()))
        .bind(market.end_date.map(|dt| dt.to_rfc3339()))
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get a market by slug.
    pub async fn get_market(&self, slug: &str) -> Result<Option<Market>, CascadeError> {
        let row = sqlx::query("SELECT * FROM markets WHERE slug = ?")
            .bind(slug)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_market(&row)?)),
            None => Ok(None),
        }
    }

    /// Get a market by event ID.
    pub async fn get_market_by_event_id(&self, event_id: &str) -> Result<Option<Market>, CascadeError> {
        let row = sqlx::query("SELECT * FROM markets WHERE event_id = ?")
            .bind(event_id)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_market(&row)?)),
            None => Ok(None),
        }
    }

    /// Get all markets.
    pub async fn get_all_markets(&self) -> Result<Vec<Market>, CascadeError> {
        let rows = sqlx::query("SELECT * FROM markets ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let mut markets = Vec::new();
        for row in rows {
            markets.push(self.row_to_market(&row)?);
        }
        Ok(markets)
    }

    /// Get all open markets.
    pub async fn get_open_markets(&self) -> Result<Vec<Market>, CascadeError> {
        let rows = sqlx::query("SELECT * FROM markets WHERE status = 'open' ORDER BY created_at DESC")
            .fetch_all(&self.pool)
            .await?;

        let mut markets = Vec::new();
        for row in rows {
            markets.push(self.row_to_market(&row)?);
        }
        Ok(markets)
    }

    /// Delete a market by slug.
    pub async fn delete_market(&self, slug: &str) -> Result<(), CascadeError> {
        sqlx::query("DELETE FROM trades WHERE market_slug = ?")
            .bind(slug)
            .execute(&self.pool)
            .await?;

        sqlx::query("DELETE FROM positions WHERE market_slug = ?")
            .bind(slug)
            .execute(&self.pool)
            .await?;

        sqlx::query("DELETE FROM markets WHERE slug = ?")
            .bind(slug)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    /// Update only the LMSR state fields (q_long, q_short, reserve_sats).
    pub async fn update_lmsr_state(
        &self,
        slug: &str,
        q_long: f64,
        q_short: f64,
        reserve_sats: u64,
    ) -> Result<(), CascadeError> {
        sqlx::query(
            r#"
            UPDATE markets
            SET q_long = ?, q_short = ?, reserve_sats = ?
            WHERE slug = ?
            "#,
        )
        .bind(q_long)
        .bind(q_short)
        .bind(reserve_sats as i64)
        .bind(slug)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Update market status and outcome.
    pub async fn update_market_status(
        &self,
        slug: &str,
        status: MarketStatus,
        outcome: Option<bool>,
    ) -> Result<(), CascadeError> {
        sqlx::query(
            r#"
            UPDATE markets
            SET status = ?, outcome = ?, resolved_at = ?
            WHERE slug = ?
            "#,
        )
        .bind(status.to_string())
        .bind(outcome.map(|v| if v { 1 } else { 0 }))
        .bind(Utc::now().to_rfc3339())
        .bind(slug)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    // ==================== TRADE OPERATIONS ====================

    /// Save a trade to the database.
    pub async fn save_trade(&self, trade: &Trade) -> Result<(), CascadeError> {
        sqlx::query(
            r#"
            INSERT INTO trades (
                id, market_slug, side, amount, price, cost_sats, fee_sats,
                total_sats, trader_pubkey, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&trade.id)
        .bind(&trade.market_slug)
        .bind(side_to_string(&trade.side))
        .bind(trade.amount)
        .bind(trade.price)
        .bind(trade.cost_sats as i64)
        .bind(trade.fee_sats as i64)
        .bind(trade.total_sats as i64)
        .bind(&trade.trader_pubkey)
        .bind(trade.created_at.to_rfc3339())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    /// Get all trades for a market.
    pub async fn get_trades(&self, market_slug: &str) -> Result<Vec<Trade>, CascadeError> {
        let rows = sqlx::query("SELECT * FROM trades WHERE market_slug = ? ORDER BY created_at ASC")
            .bind(market_slug)
            .fetch_all(&self.pool)
            .await?;

        let mut trades = Vec::new();
        for row in rows {
            trades.push(self.row_to_trade(&row)?);
        }
        Ok(trades)
    }

    /// Get trades for a specific trader.
    pub async fn get_trader_trades(&self, trader_pubkey: &str) -> Result<Vec<Trade>, CascadeError> {
        let rows = sqlx::query("SELECT * FROM trades WHERE trader_pubkey = ? ORDER BY created_at DESC")
            .bind(trader_pubkey)
            .fetch_all(&self.pool)
            .await?;

        let mut trades = Vec::new();
        for row in rows {
            trades.push(self.row_to_trade(&row)?);
        }
        Ok(trades)
    }

    // ==================== HELPER METHODS ====================

    /// Convert a database row to a Market.
    fn row_to_market(&self, row: &SqliteRow) -> Result<Market, CascadeError> {
        let status_str: String = row.get("status");
        // FIX: Properly parse status from string to MarketStatus enum
        // Previously this would always default to "Active" (Open) which loses resolution state
        let status: MarketStatus = status_str.parse().unwrap_or(MarketStatus::Open);

        let outcome_int: Option<i64> = row.get("outcome");
        let outcome = outcome_int.map(|v| v == 1);

        let created_at_str: String = row.get("created_at");
        let created_at: DateTime<Utc> = created_at_str.parse().map_err(|e| {
            CascadeError::DatabaseError(format!("Invalid created_at: {}", e))
        })?;

        // Parse resolved_at if present
        let resolved_at: Option<DateTime<Utc>> = {
            let dt_str: Option<String> = row.get("resolved_at");
            dt_str.and_then(|s: String| s.parse().ok())
        };

        // Parse end_date if present
        let end_date: Option<DateTime<Utc>> = {
            let dt_str: Option<String> = row.get("end_date");
            dt_str.and_then(|s: String| s.parse().ok())
        };

        Ok(Market {
            event_id: row.get("event_id"),
            slug: row.get("slug"),
            title: row.get("title"),
            description: row.get("description"),
            mint: row.get("mint"),
            image: row.get("image"),
            creator_pubkey: row.get("creator_pubkey"),
            created_at,
            b: row.get("b"),
            q_long: row.get("q_long"),
            q_short: row.get("q_short"),
            reserve_sats: row.get::<i64, _>("reserve_sats") as u64,
            status,
            outcome,
            resolved_at,
            end_date,
        })
    }

    /// Convert a database row to a Trade.
    fn row_to_trade(&self, row: &SqliteRow) -> Result<Trade, CascadeError> {
        let side_str: String = row.get("side");
        let side = string_to_side(&side_str)?;

        let created_at_str: String = row.get("created_at");
        let created_at: DateTime<Utc> = created_at_str.parse().map_err(|e| {
            CascadeError::DatabaseError(format!("Invalid created_at: {}", e))
        })?;

        Ok(Trade {
            id: row.get("id"),
            market_slug: row.get("market_slug"),
            side,
            amount: row.get("amount"),
            price: row.get("price"),
            cost_sats: row.get::<i64, _>("cost_sats") as u64,
            fee_sats: row.get::<i64, _>("fee_sats") as u64,
            total_sats: row.get::<i64, _>("total_sats") as u64,
            trader_pubkey: row.get("trader_pubkey"),
            created_at,
        })
    }
}

/// Convert Outcome to string for database storage.
fn side_to_string(side: &Outcome) -> &'static str {
    match side {
        Outcome::Long => "long",
        Outcome::Short => "short",
    }
}

/// Convert string to Outcome.
fn string_to_side(s: &str) -> Result<Outcome, CascadeError> {
    match s.to_lowercase().as_str() {
        "long" => Ok(Outcome::Long),
        "short" => Ok(Outcome::Short),
        _ => Err(CascadeError::DatabaseError(format!("Invalid side: {}", s))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_side_conversion() {
        assert_eq!(side_to_string(&Outcome::Long), "long");
        assert_eq!(side_to_string(&Outcome::Short), "short");

        assert_eq!(string_to_side("long").unwrap(), Outcome::Long);
        assert_eq!(string_to_side("short").unwrap(), Outcome::Short);
        assert_eq!(string_to_side("LONG").unwrap(), Outcome::Long);
    }

    #[test]
    fn test_status_conversion() {
        let open: MarketStatus = "open".parse().unwrap();
        assert_eq!(open, MarketStatus::Open);

        let resolved: MarketStatus = "resolved".parse().unwrap();
        assert_eq!(resolved, MarketStatus::Resolved);

        let cancelled: MarketStatus = "cancelled".parse().unwrap();
        assert_eq!(cancelled, MarketStatus::Cancelled);

        let archived: MarketStatus = "archived".parse().unwrap();
        assert_eq!(archived, MarketStatus::Archived);
    }
}
