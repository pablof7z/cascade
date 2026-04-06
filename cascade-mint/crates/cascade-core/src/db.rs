//! Database persistence layer using SQLite

use crate::error::Result;
use crate::market::Market;
use crate::trade::{Trade, Payout};
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions};
use std::str::FromStr;

/// Database connection pool
pub struct CascadeDatabase {
    pool: SqlitePool,
}

impl CascadeDatabase {
    /// Create a new database connection
    pub async fn connect(database_url: &str) -> Result<Self> {
        // Parse connection options
        let connect_options = SqliteConnectOptions::from_str(database_url)
            .map_err(|e| crate::error::CascadeError::database(format!("Invalid URL: {}", e)))?;

        let pool = SqlitePool::connect_with(connect_options)
            .await
            .map_err(|e| crate::error::CascadeError::database(format!("Connection failed: {}", e)))?;

        Ok(Self { pool })
    }

    /// Run migrations
    pub async fn run_migrations(&self) -> Result<()> {
        sqlx::query(include_str!("../../migrations/001_cascade_tables.sql"))
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::MigrationError(e.to_string()))?;

        Ok(())
    }

    /// Insert a market
    pub async fn insert_market(&self, market: &Market) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO markets (event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, resolution_outcome, creator_pubkey, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&market.event_id)
        .bind(&market.slug)
        .bind(&market.title)
        .bind(&market.description)
        .bind(market.b)
        .bind(market.q_long)
        .bind(market.q_short)
        .bind(market.reserve_sats as i64)
        .bind(format!("{:?}", market.status))
        .bind(market.resolution_outcome.map(|s| format!("{:?}", s)))
        .bind(&market.creator_pubkey)
        .bind(market.created_at)
        .bind(market.resolved_at)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Get a market by event ID
    pub async fn get_market(&self, event_id: &str) -> Result<Option<Market>> {
        let row = sqlx::query_as::<_, (String, String, String, String, f64, f64, f64, i64, String, Option<String>, String, String, Option<String>)>(
            "SELECT event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, resolution_outcome, creator_pubkey, created_at, resolved_at FROM markets WHERE event_id = ?"
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(|_| Market::new(
            event_id.to_string(),
            "".to_string(),
            "".to_string(),
            "".to_string(),
            0.0,
            "".to_string(),
        )))
    }

    /// List all markets
    pub async fn list_markets(&self) -> Result<Vec<Market>> {
        let rows = sqlx::query_as::<_, (String, String, String, String, f64)>(
            "SELECT event_id, slug, title, description, b FROM markets ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows.into_iter().map(|(event_id, slug, title, description, b)| {
            Market::new(event_id, slug, title, description, b, "".to_string())
        }).collect())
    }

    /// Update market LMSR state
    pub async fn update_market_lmsr(&self, event_id: &str, q_long: f64, q_short: f64, reserve_sats: u64) -> Result<()> {
        sqlx::query(
            "UPDATE markets SET q_long = ?, q_short = ?, reserve_sats = ? WHERE event_id = ?"
        )
        .bind(q_long)
        .bind(q_short)
        .bind(reserve_sats as i64)
        .bind(event_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Insert a trade record
    pub async fn insert_trade(&self, trade: &Trade) -> Result<()> {
        sqlx::query(
            "INSERT INTO trades (id, market_id, buyer_pubkey, side, quantity, cost_sats, fee_sats, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&trade.id)
        .bind(&trade.market_id)
        .bind(&trade.buyer_pubkey)
        .bind(format!("{:?}", trade.side))
        .bind(trade.quantity)
        .bind(trade.cost_sats as i64)
        .bind(trade.fee_sats as i64)
        .bind(trade.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Get trades for a market
    pub async fn get_trades(&self, market_id: &str) -> Result<Vec<Trade>> {
        // This is a stub — full implementation would reconstruct Trade structs from rows
        let _rows = sqlx::query(
            "SELECT id, market_id, buyer_pubkey, side, quantity, cost_sats, fee_sats, created_at FROM trades WHERE market_id = ? ORDER BY created_at DESC"
        )
        .bind(market_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(Vec::new()) // TODO: Reconstruct Trade structs
    }

    /// Insert LMSR price snapshot
    pub async fn insert_lmsr_snapshot(&self, market_id: &str, q_long: f64, q_short: f64, price_long: f64, price_short: f64) -> Result<()> {
        sqlx::query(
            "INSERT INTO lmsr_snapshots (market_id, q_long, q_short, price_long, price_short, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
        )
        .bind(market_id)
        .bind(q_long)
        .bind(q_short)
        .bind(price_long)
        .bind(price_short)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Get price history for a market
    pub async fn get_price_history(&self, market_id: &str, limit: i64) -> Result<Vec<(f64, f64, String)>> {
        let rows = sqlx::query_as::<_, (f64, f64, String)>(
            "SELECT price_long, price_short, created_at FROM lmsr_snapshots WHERE market_id = ? ORDER BY created_at DESC LIMIT ?"
        )
        .bind(market_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows)
    }

    /// Insert a payout record
    pub async fn insert_payout(&self, payout: &Payout) -> Result<()> {
        sqlx::query(
            "INSERT INTO payouts (id, market_id, recipient_pubkey, winning_side, winning_tokens, payout_sats, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&payout.id)
        .bind(&payout.market_id)
        .bind(&payout.recipient_pubkey)
        .bind(format!("{:?}", payout.winning_side))
        .bind(payout.winning_tokens)
        .bind(payout.payout_sats as i64)
        .bind(payout.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }
}
