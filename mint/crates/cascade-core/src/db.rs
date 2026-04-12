//! Database persistence layer using SQLite

use crate::error::Result;
use crate::market::{Market, MarketStatus, Side, Trade, TradeDirection};
use crate::product::{
    FxQuoteObservation, FxQuoteSnapshot, MarketLaunchState, MarketPosition, MarketTradeRecord,
    MarketVisibility, TradeExecutionRequest, TradeExecutionRequestStatus, TradeQuoteSnapshot,
    TradeSettlementInsert, TradeSettlementRecord, TradeSettlementStatus, WalletBalanceRecord,
    WalletFundingEvent, WalletTopupQuote, WalletTopupRequest, WalletTopupRequestStatus,
    WalletTopupStatus,
};
use crate::trade::Payout;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use sqlx::Row;
use std::str::FromStr;

/// Database connection pool
pub struct CascadeDatabase {
    pool: SqlitePool,
}

fn serialize_fx_observations(observations: &[FxQuoteObservation]) -> Result<String> {
    serde_json::to_string(observations)
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
}

fn deserialize_fx_observations(observations_json: &str) -> Vec<FxQuoteObservation> {
    serde_json::from_str::<Vec<FxQuoteObservation>>(observations_json).unwrap_or_default()
}

impl CascadeDatabase {
    /// Create a new database connection
    pub async fn connect(database_url: &str) -> Result<Self> {
        // Parse connection options
        let connect_options = SqliteConnectOptions::from_str(database_url)
            .map_err(|e| crate::error::CascadeError::database(format!("Invalid URL: {}", e)))?
            .pragma("foreign_keys", "true"); // Enable foreign key constraints

        let pool = SqlitePool::connect_with(connect_options)
            .await
            .map_err(|e| {
                crate::error::CascadeError::database(format!("Connection failed: {}", e))
            })?;

        Ok(Self { pool })
    }

    /// Run migrations
    pub async fn run_migrations(&self) -> Result<()> {
        // Run migration 001: Cascade core tables
        sqlx::query(include_str!("../../../migrations/001_cascade_tables.sql"))
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        // Run migration 002: Lightning escrow tables
        sqlx::query(include_str!("../../../migrations/002_lightning_escrow.sql"))
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/003_product_wallet_and_visibility.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/004_wallet_topup_quotes.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!("../../../migrations/005_trade_requests.sql"))
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/006_wallet_topup_requests.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/007_trade_quote_snapshots.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.ensure_fx_quote_observations_column().await?;
        self.ensure_wallet_topup_quote_metadata_column().await?;
        self.ensure_trade_quote_settlement_columns().await?;

        sqlx::query(include_str!(
            "../../../migrations/009_trade_settlements.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    async fn column_exists(&self, table: &str, column: &str) -> Result<bool> {
        let pragma = format!("PRAGMA table_info({table})");
        let rows = sqlx::query(&pragma)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .any(|row| row.get::<String, _>("name").eq_ignore_ascii_case(column)))
    }

    async fn ensure_fx_quote_observations_column(&self) -> Result<()> {
        if !self
            .column_exists("fx_quote_snapshots", "observations_json")
            .await?
        {
            sqlx::query(
                "ALTER TABLE fx_quote_snapshots ADD COLUMN observations_json TEXT NOT NULL DEFAULT '[]'",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        Ok(())
    }

    async fn ensure_wallet_topup_quote_metadata_column(&self) -> Result<()> {
        if !self
            .column_exists("wallet_topup_quotes", "metadata_json")
            .await?
        {
            sqlx::query(include_str!(
                "../../../migrations/011_wallet_topup_quote_metadata.sql"
            ))
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        Ok(())
    }

    async fn ensure_trade_quote_settlement_columns(&self) -> Result<()> {
        let upgrades = [
            (
                "fx_quote_id",
                "ALTER TABLE trade_quote_snapshots ADD COLUMN fx_quote_id TEXT NOT NULL DEFAULT ''",
            ),
            (
                "settlement_minor",
                "ALTER TABLE trade_quote_snapshots ADD COLUMN settlement_minor INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "settlement_msat",
                "ALTER TABLE trade_quote_snapshots ADD COLUMN settlement_msat INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "settlement_fee_msat",
                "ALTER TABLE trade_quote_snapshots ADD COLUMN settlement_fee_msat INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "marginal_price_before_ppm",
                "ALTER TABLE trade_quote_snapshots ADD COLUMN marginal_price_before_ppm INTEGER NOT NULL DEFAULT 0",
            ),
            (
                "marginal_price_after_ppm",
                "ALTER TABLE trade_quote_snapshots ADD COLUMN marginal_price_after_ppm INTEGER NOT NULL DEFAULT 0",
            ),
        ];

        for (column, sql) in upgrades {
            if !self.column_exists("trade_quote_snapshots", column).await? {
                sqlx::query(sql)
                    .execute(&self.pool)
                    .await
                    .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
            }
        }

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_trade_quote_snapshots_fx_quote_id ON trade_quote_snapshots(fx_quote_id)",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Insert a market
    pub async fn insert_market(&self, market: &Market) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO markets (event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, resolution_outcome, creator_pubkey, created_at, resolved_at, long_keyset_id, short_keyset_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        .bind(&market.long_keyset_id)
        .bind(&market.short_keyset_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Get a market by event ID
    pub async fn get_market(&self, event_id: &str) -> Result<Option<Market>> {
        let row = sqlx::query_as::<_, (String, String, String, String, f64, f64, f64, i64, String, Option<String>, String, i64, Option<i64>, String, String)>(
            "SELECT event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, resolution_outcome, creator_pubkey, created_at, resolved_at, long_keyset_id, short_keyset_id FROM markets WHERE event_id = ?"
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                event_id,
                slug,
                title,
                description,
                b,
                q_long,
                q_short,
                reserve_sats,
                status,
                resolution_outcome,
                creator_pubkey,
                created_at,
                resolved_at,
                long_keyset_id,
                short_keyset_id,
            )| {
                Market {
                    event_id,
                    slug,
                    title,
                    description,
                    b,
                    q_long,
                    q_short,
                    reserve_sats: reserve_sats as u64,
                    status: status.parse().unwrap_or(MarketStatus::Active),
                    resolution_outcome: resolution_outcome.and_then(|s| s.parse().ok()),
                    creator_pubkey,
                    created_at,
                    long_keyset_id,
                    short_keyset_id,
                    resolved_at,
                }
            },
        ))
    }

    /// List all markets
    pub async fn list_markets(&self) -> Result<Vec<Market>> {
        let rows = sqlx::query_as::<_, (String, String, String, String, f64, f64, f64, i64, String, Option<String>, String, i64, Option<i64>, String, String)>(
            "SELECT event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, resolution_outcome, creator_pubkey, created_at, resolved_at, long_keyset_id, short_keyset_id FROM markets ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    event_id,
                    slug,
                    title,
                    description,
                    b,
                    q_long,
                    q_short,
                    reserve_sats,
                    status,
                    resolution_outcome,
                    creator_pubkey,
                    created_at,
                    resolved_at,
                    long_keyset_id,
                    short_keyset_id,
                )| {
                    Market {
                        event_id,
                        slug,
                        title,
                        description,
                        b,
                        q_long,
                        q_short,
                        reserve_sats: reserve_sats as u64,
                        status: status.parse().unwrap_or(MarketStatus::Active),
                        resolution_outcome: resolution_outcome.and_then(|s| s.parse().ok()),
                        creator_pubkey,
                        created_at,
                        long_keyset_id,
                        short_keyset_id,
                        resolved_at,
                    }
                },
            )
            .collect())
    }

    /// Update market LMSR state
    pub async fn update_market_lmsr(
        &self,
        event_id: &str,
        q_long: f64,
        q_short: f64,
        reserve_sats: u64,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE markets SET q_long = ?, q_short = ?, reserve_sats = ? WHERE event_id = ?",
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
            "INSERT INTO trades (id, market_slug, side, direction, quantity, cost_sats, fee_sats, buyer_pubkey, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&trade.id)
        .bind(&trade.market_slug)
        .bind(trade.side.to_string())
        .bind(trade.direction.to_string())
        .bind(trade.amount)
        .bind(trade.cost_sats)
        .bind(trade.fee_sats)
        .bind("") // buyer_pubkey placeholder — not tracked in market::Trade
        .bind(trade.created_at)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    /// Get trades for a market
    pub async fn get_trades(&self, market_slug: &str) -> Result<Vec<Trade>> {
        let rows = sqlx::query_as::<_, (String, String, String, String, f64, i64, i64, i64)>(
            "SELECT id, market_slug, side, direction, quantity, cost_sats, fee_sats, created_at FROM trades WHERE market_slug = ? ORDER BY created_at DESC"
        )
        .bind(market_slug)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    market_slug,
                    side_str,
                    direction_str,
                    amount,
                    cost_sats,
                    fee_sats,
                    created_at,
                )| {
                    let side = side_str.parse().unwrap_or(Side::Long);
                    let direction = direction_str.parse().unwrap_or(TradeDirection::Buy);
                    Trade {
                        id,
                        market_slug,
                        side,
                        direction,
                        amount,
                        cost_sats,
                        fee_sats,
                        total_sats: cost_sats + fee_sats,
                        q_long_before: 0.0,
                        q_short_before: 0.0,
                        q_long_after: 0.0,
                        q_short_after: 0.0,
                        created_at,
                    }
                },
            )
            .collect())
    }

    /// Insert LMSR price snapshot
    pub async fn insert_lmsr_snapshot(
        &self,
        market_slug: &str,
        q_long: f64,
        q_short: f64,
        price_long: f64,
        price_short: f64,
    ) -> Result<()> {
        sqlx::query(
            "INSERT INTO lmsr_snapshots (market_slug, q_long, q_short, price_long, price_short, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
        )
        .bind(market_slug)
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
    pub async fn get_price_history(
        &self,
        market_slug: &str,
        limit: i64,
    ) -> Result<Vec<(f64, f64, String)>> {
        let rows = sqlx::query_as::<_, (f64, f64, String)>(
            "SELECT price_long, price_short, created_at FROM lmsr_snapshots WHERE market_slug = ? ORDER BY created_at DESC LIMIT ?"
        )
        .bind(market_slug)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows)
    }

    /// Insert a payout record
    pub async fn insert_payout(&self, payout: &Payout) -> Result<()> {
        sqlx::query(
            "INSERT INTO payouts (id, market_slug, recipient_pubkey, winning_side, winning_tokens, payout_sats, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
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

    /// Persist product launch state for a market.
    pub async fn insert_market_launch_state(
        &self,
        event_id: &str,
        raw_event_json: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO market_launch_state (
                event_id,
                raw_event_json,
                visibility,
                last_price_yes_ppm,
                last_price_no_ppm,
                updated_at
            )
            VALUES (?, ?, 'pending', 500000, 500000, strftime('%s', 'now'))
            "#,
        )
        .bind(event_id)
        .bind(raw_event_json)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    pub async fn get_market_launch_state(
        &self,
        event_id: &str,
    ) -> Result<Option<MarketLaunchState>> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                Option<i64>,
                Option<i64>,
                i64,
                i64,
                i64,
                i64,
                i64,
            ),
        >(
            r#"
            SELECT
                event_id,
                raw_event_json,
                visibility,
                first_trade_at,
                public_visible_at,
                volume_minor,
                trade_count,
                last_price_yes_ppm,
                last_price_no_ppm,
                updated_at
            FROM market_launch_state
            WHERE event_id = ?
            "#,
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                event_id,
                raw_event_json,
                visibility,
                first_trade_at,
                public_visible_at,
                volume_minor,
                trade_count,
                last_price_yes_ppm,
                last_price_no_ppm,
                updated_at,
            )| MarketLaunchState {
                event_id,
                raw_event_json,
                visibility: visibility.parse().unwrap_or(MarketVisibility::Pending),
                first_trade_at,
                public_visible_at,
                volume_minor: volume_minor.max(0) as u64,
                trade_count: trade_count.max(0) as u64,
                last_price_yes_ppm: last_price_yes_ppm.max(0) as u64,
                last_price_no_ppm: last_price_no_ppm.max(0) as u64,
                updated_at,
            },
        ))
    }

    pub async fn list_public_markets(&self) -> Result<Vec<(Market, MarketLaunchState)>> {
        let rows = sqlx::query(
            r#"
            SELECT
                m.event_id,
                m.slug,
                m.title,
                m.description,
                m.b,
                m.q_long,
                m.q_short,
                m.reserve_sats,
                m.status,
                m.resolution_outcome,
                m.creator_pubkey,
                m.created_at,
                m.resolved_at,
                m.long_keyset_id,
                m.short_keyset_id,
                s.raw_event_json,
                s.visibility,
                s.first_trade_at,
                s.public_visible_at,
                s.volume_minor,
                s.trade_count,
                s.last_price_yes_ppm,
                s.last_price_no_ppm,
                s.updated_at
            FROM markets m
            INNER JOIN market_launch_state s ON s.event_id = m.event_id
            WHERE s.visibility = 'public'
            ORDER BY COALESCE(s.public_visible_at, m.created_at) DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|row| map_market_and_launch_state_row(&row))
            .collect())
    }

    pub async fn list_creator_markets(
        &self,
        pubkey: &str,
    ) -> Result<Vec<(Market, MarketLaunchState)>> {
        let rows = sqlx::query(
            r#"
            SELECT
                m.event_id,
                m.slug,
                m.title,
                m.description,
                m.b,
                m.q_long,
                m.q_short,
                m.reserve_sats,
                m.status,
                m.resolution_outcome,
                m.creator_pubkey,
                m.created_at,
                m.resolved_at,
                m.long_keyset_id,
                m.short_keyset_id,
                s.raw_event_json,
                s.visibility,
                s.first_trade_at,
                s.public_visible_at,
                s.volume_minor,
                s.trade_count,
                s.last_price_yes_ppm,
                s.last_price_no_ppm,
                s.updated_at
            FROM markets m
            INNER JOIN market_launch_state s ON s.event_id = m.event_id
            WHERE m.creator_pubkey = ?
            ORDER BY m.created_at DESC
            "#,
        )
        .bind(pubkey)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(|row| map_market_and_launch_state_row(&row))
            .collect())
    }

    pub async fn get_public_market_by_slug(
        &self,
        slug: &str,
    ) -> Result<Option<(Market, MarketLaunchState)>> {
        let row = sqlx::query(
            r#"
            SELECT
                m.event_id,
                m.slug,
                m.title,
                m.description,
                m.b,
                m.q_long,
                m.q_short,
                m.reserve_sats,
                m.status,
                m.resolution_outcome,
                m.creator_pubkey,
                m.created_at,
                m.resolved_at,
                m.long_keyset_id,
                m.short_keyset_id,
                s.raw_event_json,
                s.visibility,
                s.first_trade_at,
                s.public_visible_at,
                s.volume_minor,
                s.trade_count,
                s.last_price_yes_ppm,
                s.last_price_no_ppm,
                s.updated_at
            FROM markets m
            INNER JOIN market_launch_state s ON s.event_id = m.event_id
            WHERE m.slug = ? AND s.visibility = 'public'
            LIMIT 1
            "#,
        )
        .bind(slug)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(|row| map_market_and_launch_state_row(&row)))
    }

    pub async fn ensure_wallet(&self, pubkey: &str) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO wallet_balances (pubkey)
            VALUES (?)
            ON CONFLICT(pubkey) DO NOTHING
            "#,
        )
        .bind(pubkey)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    pub async fn get_wallet_balance(&self, pubkey: &str) -> Result<Option<WalletBalanceRecord>> {
        let row = sqlx::query_as::<_, (String, i64, i64, i64, i64)>(
            r#"
            SELECT pubkey, available_minor, pending_minor, total_deposited_minor, updated_at
            FROM wallet_balances
            WHERE pubkey = ?
            "#,
        )
        .bind(pubkey)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(pubkey, available_minor, pending_minor, total_deposited_minor, updated_at)| {
                WalletBalanceRecord {
                    pubkey,
                    available_minor: available_minor.max(0) as u64,
                    pending_minor: pending_minor.max(0) as u64,
                    total_deposited_minor: total_deposited_minor.max(0) as u64,
                    updated_at,
                }
            },
        ))
    }

    pub async fn list_wallet_funding_events(
        &self,
        pubkey: &str,
        limit: i64,
    ) -> Result<Vec<WalletFundingEvent>> {
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                String,
                Option<String>,
                Option<String>,
                i64,
            ),
        >(
            r#"
            SELECT id, pubkey, rail, amount_minor, status, risk_level, metadata_json, created_at
            FROM wallet_funding_events
            WHERE pubkey = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(pubkey)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    pubkey,
                    rail,
                    amount_minor,
                    status,
                    risk_level,
                    metadata_json,
                    created_at,
                )| {
                    WalletFundingEvent {
                        id,
                        pubkey,
                        rail,
                        amount_minor: amount_minor.max(0) as u64,
                        status,
                        risk_level,
                        metadata_json,
                        created_at,
                    }
                },
            )
            .collect())
    }

    pub async fn sum_wallet_funding_amount_since(
        &self,
        pubkey: &str,
        rail: &str,
        since: i64,
    ) -> Result<u64> {
        let amount_minor = sqlx::query_scalar::<_, Option<i64>>(
            r#"
            SELECT SUM(amount_minor)
            FROM wallet_funding_events
            WHERE pubkey = ?
              AND rail = ?
              AND status = 'complete'
              AND created_at >= ?
            "#,
        )
        .bind(pubkey)
        .bind(rail)
        .bind(since)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?
        .unwrap_or(0);

        Ok(amount_minor.max(0) as u64)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_wallet_topup_quote(
        &self,
        pubkey: &str,
        rail: &str,
        amount_minor: u64,
        amount_msat: u64,
        invoice: Option<&str>,
        payment_hash: Option<&str>,
        request_id: Option<&str>,
        fx_quote: &FxQuoteSnapshot,
    ) -> Result<WalletTopupQuote> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().timestamp();
        let observations_json = serialize_fx_observations(&fx_quote.observations)?;
        let quote = WalletTopupQuote {
            id: uuid::Uuid::new_v4().to_string(),
            pubkey: pubkey.to_string(),
            rail: rail.to_string(),
            amount_minor,
            amount_msat,
            status: WalletTopupStatus::InvoicePending,
            invoice: invoice.map(str::to_string),
            payment_hash: payment_hash.map(str::to_string),
            fx_quote_id: fx_quote.id.clone(),
            funding_event_id: None,
            metadata_json: None,
            created_at: now,
            expires_at: fx_quote.expires_at,
            settled_at: None,
            completed_at: None,
        };

        sqlx::query(
            r#"
            INSERT INTO fx_quote_snapshots (
                id,
                amount_minor,
                amount_msat,
                btc_usd_price,
                source,
                spread_bps,
                observations_json,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&fx_quote.id)
        .bind(fx_quote.amount_minor as i64)
        .bind(fx_quote.amount_msat as i64)
        .bind(fx_quote.btc_usd_price)
        .bind(&fx_quote.source)
        .bind(fx_quote.spread_bps as i64)
        .bind(&observations_json)
        .bind(fx_quote.created_at)
        .bind(fx_quote.expires_at)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO wallet_topup_quotes (
                id,
                pubkey,
                rail,
                amount_minor,
                amount_msat,
                status,
                invoice,
                payment_hash,
                fx_quote_id,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&quote.id)
        .bind(&quote.pubkey)
        .bind(&quote.rail)
        .bind(quote.amount_minor as i64)
        .bind(quote.amount_msat as i64)
        .bind(quote.status.to_string())
        .bind(quote.invoice.as_deref())
        .bind(quote.payment_hash.as_deref())
        .bind(&quote.fx_quote_id)
        .bind(quote.created_at)
        .bind(quote.expires_at)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO wallet_balances (pubkey, pending_minor, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(pubkey) DO UPDATE SET
                pending_minor = pending_minor + excluded.pending_minor,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(pubkey)
        .bind(amount_minor as i64)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        if let Some(request_id) = request_id.filter(|value| !value.trim().is_empty()) {
            let result = sqlx::query(
                r#"
                UPDATE wallet_topup_requests
                SET status = 'complete',
                    topup_quote_id = ?,
                    error_message = NULL,
                    updated_at = ?,
                    completed_at = ?
                WHERE request_id = ?
                "#,
            )
            .bind(&quote.id)
            .bind(now)
            .bind(now)
            .bind(request_id)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() != 1 {
                return Err(crate::error::CascadeError::database(
                    "wallet topup request missing during completion".to_string(),
                ));
            }
        }

        tx.commit().await?;

        Ok(quote)
    }

    pub async fn get_wallet_topup_quote(&self, quote_id: &str) -> Result<Option<WalletTopupQuote>> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                i64,
                String,
                Option<String>,
                Option<String>,
                String,
                Option<String>,
                Option<String>,
                i64,
                i64,
                Option<i64>,
                Option<i64>,
            ),
        >(
            r#"
            SELECT
                id,
                pubkey,
                rail,
                amount_minor,
                amount_msat,
                status,
                invoice,
                payment_hash,
                fx_quote_id,
                funding_event_id,
                metadata_json,
                created_at,
                expires_at,
                settled_at,
                completed_at
            FROM wallet_topup_quotes
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(quote_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                id,
                pubkey,
                rail,
                amount_minor,
                amount_msat,
                status,
                invoice,
                payment_hash,
                fx_quote_id,
                funding_event_id,
                metadata_json,
                created_at,
                expires_at,
                settled_at,
                completed_at,
            )| WalletTopupQuote {
                id,
                pubkey,
                rail,
                amount_minor: amount_minor.max(0) as u64,
                amount_msat: amount_msat.max(0) as u64,
                status: status.parse().unwrap_or(WalletTopupStatus::InvoicePending),
                invoice,
                payment_hash,
                fx_quote_id,
                funding_event_id,
                metadata_json,
                created_at,
                expires_at,
                settled_at,
                completed_at,
            },
        ))
    }

    pub async fn get_fx_quote_snapshot(&self, quote_id: &str) -> Result<Option<FxQuoteSnapshot>> {
        let row = sqlx::query_as::<_, (String, i64, i64, f64, String, i64, String, i64, i64)>(
            r#"
            SELECT
                id,
                amount_minor,
                amount_msat,
                btc_usd_price,
                source,
                spread_bps,
                observations_json,
                created_at,
                expires_at
            FROM fx_quote_snapshots
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(quote_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                id,
                amount_minor,
                amount_msat,
                btc_usd_price,
                source,
                spread_bps,
                observations_json,
                created_at,
                expires_at,
            )| FxQuoteSnapshot {
                id,
                amount_minor: amount_minor.max(0) as u64,
                amount_msat: amount_msat.max(0) as u64,
                btc_usd_price,
                source,
                spread_bps: spread_bps.max(0) as u64,
                observations: deserialize_fx_observations(&observations_json),
                created_at,
                expires_at,
            },
        ))
    }

    pub async fn list_pending_wallet_topup_quotes(
        &self,
        pubkey: &str,
        limit: i64,
    ) -> Result<Vec<WalletTopupQuote>> {
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                i64,
                String,
                Option<String>,
                Option<String>,
                String,
                Option<String>,
                Option<String>,
                i64,
                i64,
                Option<i64>,
                Option<i64>,
            ),
        >(
            r#"
            SELECT
                id,
                pubkey,
                rail,
                amount_minor,
                amount_msat,
                status,
                invoice,
                payment_hash,
                fx_quote_id,
                funding_event_id,
                metadata_json,
                created_at,
                expires_at,
                settled_at,
                completed_at
            FROM wallet_topup_quotes
            WHERE pubkey = ? AND status = 'invoice_pending'
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(pubkey)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    pubkey,
                    rail,
                    amount_minor,
                    amount_msat,
                    status,
                    invoice,
                    payment_hash,
                    fx_quote_id,
                    funding_event_id,
                    metadata_json,
                    created_at,
                    expires_at,
                    settled_at,
                    completed_at,
                )| WalletTopupQuote {
                    id,
                    pubkey,
                    rail,
                    amount_minor: amount_minor.max(0) as u64,
                    amount_msat: amount_msat.max(0) as u64,
                    status: status.parse().unwrap_or(WalletTopupStatus::InvoicePending),
                    invoice,
                    payment_hash,
                    fx_quote_id,
                    funding_event_id,
                    metadata_json,
                    created_at,
                    expires_at,
                    settled_at,
                    completed_at,
                },
            )
            .collect())
    }

    pub async fn expire_wallet_topups_for_pubkey(&self, pubkey: &str, now: i64) -> Result<u64> {
        let mut tx = self.pool.begin().await?;
        let expired_rows = sqlx::query_as::<_, (String, i64)>(
            r#"
            SELECT id, amount_minor
            FROM wallet_topup_quotes
            WHERE pubkey = ? AND status = 'invoice_pending' AND expires_at <= ?
            "#,
        )
        .bind(pubkey)
        .bind(now)
        .fetch_all(&mut *tx)
        .await?;

        if expired_rows.is_empty() {
            tx.commit().await?;
            return Ok(0);
        }

        let mut expired_total_minor = 0_i64;
        for (quote_id, amount_minor) in &expired_rows {
            expired_total_minor += *amount_minor;
            sqlx::query(
                r#"
                UPDATE wallet_topup_quotes
                SET status = 'expired'
                WHERE id = ? AND status = 'invoice_pending'
                "#,
            )
            .bind(quote_id)
            .execute(&mut *tx)
            .await?;
        }

        if expired_total_minor > 0 {
            sqlx::query(
                r#"
                UPDATE wallet_balances
                SET pending_minor = CASE
                    WHEN pending_minor >= ? THEN pending_minor - ?
                    ELSE 0
                END,
                    updated_at = ?
                WHERE pubkey = ?
                "#,
            )
            .bind(expired_total_minor)
            .bind(expired_total_minor)
            .bind(now)
            .bind(pubkey)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(expired_rows.len() as u64)
    }

    pub async fn expire_wallet_topup_quote(
        &self,
        quote_id: &str,
    ) -> Result<Option<WalletTopupQuote>> {
        let mut tx = self.pool.begin().await?;
        let Some(existing) = self.get_wallet_topup_quote(quote_id).await? else {
            tx.commit().await?;
            return Ok(None);
        };

        if existing.status != WalletTopupStatus::InvoicePending {
            tx.commit().await?;
            return Ok(Some(existing));
        }

        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE wallet_topup_quotes
            SET status = 'expired'
            WHERE id = ? AND status = 'invoice_pending'
            "#,
        )
        .bind(quote_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE wallet_balances
            SET pending_minor = CASE
                WHEN pending_minor >= ? THEN pending_minor - ?
                ELSE 0
            END,
                updated_at = ?
            WHERE pubkey = ?
            "#,
        )
        .bind(existing.amount_minor as i64)
        .bind(existing.amount_minor as i64)
        .bind(now)
        .bind(&existing.pubkey)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        self.get_wallet_topup_quote(quote_id).await
    }

    pub async fn complete_wallet_topup_quote(
        &self,
        quote_id: &str,
        risk_level: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<WalletTopupQuote> {
        let mut tx = self.pool.begin().await?;
        let Some(existing) = self.get_wallet_topup_quote(quote_id).await? else {
            return Err(crate::error::CascadeError::invalid_input(
                "topup quote not found".to_string(),
            ));
        };

        match existing.status {
            WalletTopupStatus::Complete => {
                tx.commit().await?;
                return Ok(existing);
            }
            WalletTopupStatus::Expired | WalletTopupStatus::Cancelled => {
                return Err(crate::error::CascadeError::invalid_input(format!(
                    "cannot complete topup in status {}",
                    existing.status
                )));
            }
            WalletTopupStatus::InvoicePending => {}
        }

        let now = chrono::Utc::now().timestamp();
        if existing.expires_at <= now {
            sqlx::query(
                r#"
                UPDATE wallet_topup_quotes
                SET status = 'expired'
                WHERE id = ? AND status = 'invoice_pending'
                "#,
            )
            .bind(quote_id)
            .execute(&mut *tx)
            .await?;
            sqlx::query(
                r#"
                UPDATE wallet_balances
                SET pending_minor = CASE
                    WHEN pending_minor >= ? THEN pending_minor - ?
                    ELSE 0
                END,
                    updated_at = ?
                WHERE pubkey = ?
                "#,
            )
            .bind(existing.amount_minor as i64)
            .bind(existing.amount_minor as i64)
            .bind(now)
            .bind(&existing.pubkey)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            return Err(crate::error::CascadeError::invalid_input(
                "topup quote has expired".to_string(),
            ));
        }

        let funding_event_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO wallet_funding_events (
                id,
                pubkey,
                rail,
                amount_minor,
                status,
                risk_level,
                metadata_json,
                created_at
            )
            VALUES (?, ?, ?, ?, 'complete', ?, ?, ?)
            "#,
        )
        .bind(&funding_event_id)
        .bind(&existing.pubkey)
        .bind(&existing.rail)
        .bind(existing.amount_minor as i64)
        .bind(risk_level)
        .bind(metadata_json)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE wallet_topup_quotes
            SET status = 'complete',
                funding_event_id = ?,
                metadata_json = ?,
                settled_at = ?,
                completed_at = ?
            WHERE id = ? AND status = 'invoice_pending'
            "#,
        )
        .bind(&funding_event_id)
        .bind(metadata_json)
        .bind(now)
        .bind(now)
        .bind(quote_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            UPDATE wallet_balances
            SET available_minor = available_minor + ?,
                pending_minor = CASE
                    WHEN pending_minor >= ? THEN pending_minor - ?
                    ELSE 0
                END,
                total_deposited_minor = total_deposited_minor + ?,
                updated_at = ?
            WHERE pubkey = ?
            "#,
        )
        .bind(existing.amount_minor as i64)
        .bind(existing.amount_minor as i64)
        .bind(existing.amount_minor as i64)
        .bind(existing.amount_minor as i64)
        .bind(now)
        .bind(&existing.pubkey)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.get_wallet_topup_quote(quote_id)
            .await?
            .ok_or_else(|| crate::error::CascadeError::invalid_input("topup quote not found"))
    }

    pub async fn create_wallet_topup_request(
        &self,
        request_id: &str,
        pubkey: &str,
        rail: &str,
        amount_minor: u64,
    ) -> Result<WalletTopupRequest> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            INSERT INTO wallet_topup_requests (
                request_id,
                pubkey,
                rail,
                amount_minor,
                status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
            "#,
        )
        .bind(request_id)
        .bind(pubkey)
        .bind(rail)
        .bind(amount_minor as i64)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_wallet_topup_request(request_id)
            .await?
            .ok_or_else(|| {
                crate::error::CascadeError::database(
                    "wallet topup request missing after insert".to_string(),
                )
            })
    }

    pub async fn get_wallet_topup_request(
        &self,
        request_id: &str,
    ) -> Result<Option<WalletTopupRequest>> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                String,
                Option<String>,
                Option<String>,
                i64,
                i64,
                Option<i64>,
            ),
        >(
            r#"
            SELECT
                request_id,
                pubkey,
                rail,
                amount_minor,
                status,
                error_message,
                topup_quote_id,
                created_at,
                updated_at,
                completed_at
            FROM wallet_topup_requests
            WHERE request_id = ?
            LIMIT 1
            "#,
        )
        .bind(request_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                request_id,
                pubkey,
                rail,
                amount_minor,
                status,
                error_message,
                topup_quote_id,
                created_at,
                updated_at,
                completed_at,
            )| WalletTopupRequest {
                request_id,
                pubkey,
                rail,
                amount_minor: amount_minor.max(0) as u64,
                status: status.parse().unwrap_or(WalletTopupRequestStatus::Pending),
                error_message,
                topup_quote_id,
                created_at,
                updated_at,
                completed_at,
            },
        ))
    }

    pub async fn fail_wallet_topup_request(
        &self,
        request_id: &str,
        error_message: &str,
    ) -> Result<Option<WalletTopupRequest>> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE wallet_topup_requests
            SET status = 'failed',
                error_message = ?,
                updated_at = ?
            WHERE request_id = ?
            "#,
        )
        .bind(error_message)
        .bind(now)
        .bind(request_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_wallet_topup_request(request_id).await
    }

    pub async fn get_wallet_funding_event(
        &self,
        event_id: &str,
    ) -> Result<Option<WalletFundingEvent>> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                i64,
                String,
                Option<String>,
                Option<String>,
                i64,
            ),
        >(
            r#"
            SELECT
                id,
                pubkey,
                rail,
                amount_minor,
                status,
                risk_level,
                metadata_json,
                created_at
            FROM wallet_funding_events
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(event_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(id, pubkey, rail, amount_minor, status, risk_level, metadata_json, created_at)| {
                WalletFundingEvent {
                    id,
                    pubkey,
                    rail,
                    amount_minor: amount_minor.max(0) as u64,
                    status,
                    risk_level,
                    metadata_json,
                    created_at,
                }
            },
        ))
    }

    pub async fn credit_wallet(
        &self,
        pubkey: &str,
        amount_minor: u64,
        rail: &str,
        risk_level: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<WalletFundingEvent> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().timestamp();
        let event = WalletFundingEvent {
            id: uuid::Uuid::new_v4().to_string(),
            pubkey: pubkey.to_string(),
            rail: rail.to_string(),
            amount_minor,
            status: "complete".to_string(),
            risk_level: risk_level.map(str::to_string),
            metadata_json: metadata_json.map(str::to_string),
            created_at: now,
        };

        sqlx::query(
            r#"
            INSERT INTO wallet_balances (pubkey, available_minor, total_deposited_minor, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(pubkey) DO UPDATE SET
                available_minor = available_minor + excluded.available_minor,
                total_deposited_minor = total_deposited_minor + excluded.total_deposited_minor,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(pubkey)
        .bind(amount_minor as i64)
        .bind(amount_minor as i64)
        .bind(now)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO wallet_funding_events (
                id,
                pubkey,
                rail,
                amount_minor,
                status,
                risk_level,
                metadata_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&event.id)
        .bind(&event.pubkey)
        .bind(&event.rail)
        .bind(event.amount_minor as i64)
        .bind(&event.status)
        .bind(event.risk_level.as_deref())
        .bind(event.metadata_json.as_deref())
        .bind(event.created_at)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(event)
    }

    pub async fn create_trade_execution_request(
        &self,
        request_id: &str,
        pubkey: &str,
        market_event_id: &str,
        trade_type: &str,
        side: &str,
        spend_minor: Option<u64>,
        quantity: Option<f64>,
    ) -> Result<TradeExecutionRequest> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            INSERT INTO trade_execution_requests (
                request_id,
                pubkey,
                market_event_id,
                trade_type,
                side,
                spend_minor,
                quantity,
                status,
                created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            "#,
        )
        .bind(request_id)
        .bind(pubkey)
        .bind(market_event_id)
        .bind(trade_type)
        .bind(side)
        .bind(spend_minor.map(|value| value as i64))
        .bind(quantity)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_trade_execution_request(request_id)
            .await?
            .ok_or_else(|| {
                crate::error::CascadeError::database(
                    "trade execution request missing after insert".to_string(),
                )
            })
    }

    pub async fn get_trade_execution_request(
        &self,
        request_id: &str,
    ) -> Result<Option<TradeExecutionRequest>> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                String,
                Option<i64>,
                Option<f64>,
                String,
                Option<String>,
                Option<String>,
                i64,
                i64,
                Option<i64>,
            ),
        >(
            r#"
            SELECT
                request_id,
                pubkey,
                market_event_id,
                trade_type,
                side,
                spend_minor,
                quantity,
                status,
                error_message,
                trade_id,
                created_at,
                updated_at,
                completed_at
            FROM trade_execution_requests
            WHERE request_id = ?
            LIMIT 1
            "#,
        )
        .bind(request_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                request_id,
                pubkey,
                market_event_id,
                trade_type,
                side,
                spend_minor,
                quantity,
                status,
                error_message,
                trade_id,
                created_at,
                updated_at,
                completed_at,
            )| TradeExecutionRequest {
                request_id,
                pubkey,
                market_event_id,
                trade_type,
                side,
                spend_minor: spend_minor.map(|value| value.max(0) as u64),
                quantity,
                status: status
                    .parse()
                    .unwrap_or(TradeExecutionRequestStatus::Pending),
                error_message,
                trade_id,
                created_at,
                updated_at,
                completed_at,
            },
        ))
    }

    pub async fn complete_trade_execution_request(
        &self,
        request_id: &str,
        trade_id: &str,
    ) -> Result<Option<TradeExecutionRequest>> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE trade_execution_requests
            SET status = 'complete',
                trade_id = ?,
                error_message = NULL,
                updated_at = ?,
                completed_at = ?
            WHERE request_id = ?
            "#,
        )
        .bind(trade_id)
        .bind(now)
        .bind(now)
        .bind(request_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_trade_execution_request(request_id).await
    }

    pub async fn fail_trade_execution_request(
        &self,
        request_id: &str,
        error_message: &str,
    ) -> Result<Option<TradeExecutionRequest>> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE trade_execution_requests
            SET status = 'failed',
                error_message = ?,
                updated_at = ?
            WHERE request_id = ?
            "#,
        )
        .bind(error_message)
        .bind(now)
        .bind(request_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_trade_execution_request(request_id).await
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_trade_quote_snapshot(
        &self,
        market_event_id: &str,
        trade_type: &str,
        side: &str,
        fx_quote: &FxQuoteSnapshot,
        spend_minor: u64,
        fee_minor: u64,
        net_minor: u64,
        settlement_minor: u64,
        settlement_msat: u64,
        settlement_fee_msat: u64,
        quantity: f64,
        average_price_ppm: u64,
        marginal_price_before_ppm: u64,
        marginal_price_after_ppm: u64,
        current_price_yes_ppm: u64,
        current_price_no_ppm: u64,
        snapshot_q_long: f64,
        snapshot_q_short: f64,
        snapshot_reserve_minor: u64,
        expires_at: i64,
    ) -> Result<TradeQuoteSnapshot> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().timestamp();
        let observations_json = serialize_fx_observations(&fx_quote.observations)?;
        let quote = TradeQuoteSnapshot {
            id: uuid::Uuid::new_v4().to_string(),
            market_event_id: market_event_id.to_string(),
            trade_type: trade_type.to_string(),
            side: side.to_string(),
            fx_quote_id: fx_quote.id.clone(),
            spend_minor,
            fee_minor,
            net_minor,
            settlement_minor,
            settlement_msat,
            settlement_fee_msat,
            quantity,
            average_price_ppm,
            marginal_price_before_ppm,
            marginal_price_after_ppm,
            current_price_yes_ppm,
            current_price_no_ppm,
            snapshot_q_long,
            snapshot_q_short,
            snapshot_reserve_minor,
            created_at: now,
            expires_at,
            executed_trade_id: None,
            executed_at: None,
        };

        sqlx::query(
            r#"
            INSERT INTO fx_quote_snapshots (
                id,
                amount_minor,
                amount_msat,
                btc_usd_price,
                source,
                spread_bps,
                observations_json,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&fx_quote.id)
        .bind(fx_quote.amount_minor as i64)
        .bind(fx_quote.amount_msat as i64)
        .bind(fx_quote.btc_usd_price)
        .bind(&fx_quote.source)
        .bind(fx_quote.spread_bps as i64)
        .bind(&observations_json)
        .bind(fx_quote.created_at)
        .bind(fx_quote.expires_at)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO trade_quote_snapshots (
                id,
                market_event_id,
                trade_type,
                side,
                fx_quote_id,
                spend_minor,
                fee_minor,
                net_minor,
                settlement_minor,
                settlement_msat,
                settlement_fee_msat,
                quantity,
                average_price_ppm,
                marginal_price_before_ppm,
                marginal_price_after_ppm,
                current_price_yes_ppm,
                current_price_no_ppm,
                snapshot_q_long,
                snapshot_q_short,
                snapshot_reserve_minor,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&quote.id)
        .bind(&quote.market_event_id)
        .bind(&quote.trade_type)
        .bind(&quote.side)
        .bind(&quote.fx_quote_id)
        .bind(quote.spend_minor as i64)
        .bind(quote.fee_minor as i64)
        .bind(quote.net_minor as i64)
        .bind(quote.settlement_minor as i64)
        .bind(quote.settlement_msat as i64)
        .bind(quote.settlement_fee_msat as i64)
        .bind(quote.quantity)
        .bind(quote.average_price_ppm as i64)
        .bind(quote.marginal_price_before_ppm as i64)
        .bind(quote.marginal_price_after_ppm as i64)
        .bind(quote.current_price_yes_ppm as i64)
        .bind(quote.current_price_no_ppm as i64)
        .bind(quote.snapshot_q_long)
        .bind(quote.snapshot_q_short)
        .bind(quote.snapshot_reserve_minor as i64)
        .bind(quote.created_at)
        .bind(quote.expires_at)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        Ok(quote)
    }

    pub async fn get_trade_quote_snapshot(
        &self,
        quote_id: &str,
    ) -> Result<Option<TradeQuoteSnapshot>> {
        let row = sqlx::query(
            r#"
            SELECT
                id,
                market_event_id,
                trade_type,
                side,
                fx_quote_id,
                spend_minor,
                fee_minor,
                net_minor,
                settlement_minor,
                settlement_msat,
                settlement_fee_msat,
                quantity,
                average_price_ppm,
                marginal_price_before_ppm,
                marginal_price_after_ppm,
                current_price_yes_ppm,
                current_price_no_ppm,
                snapshot_q_long,
                snapshot_q_short,
                snapshot_reserve_minor,
                created_at,
                expires_at,
                executed_trade_id,
                executed_at
            FROM trade_quote_snapshots
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(quote_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(|row| TradeQuoteSnapshot {
            id: row.get::<String, _>("id"),
            market_event_id: row.get::<String, _>("market_event_id"),
            trade_type: row.get::<String, _>("trade_type"),
            side: row.get::<String, _>("side"),
            fx_quote_id: row.get::<String, _>("fx_quote_id"),
            spend_minor: row.get::<i64, _>("spend_minor").max(0) as u64,
            fee_minor: row.get::<i64, _>("fee_minor").max(0) as u64,
            net_minor: row.get::<i64, _>("net_minor").max(0) as u64,
            settlement_minor: row.get::<i64, _>("settlement_minor").max(0) as u64,
            settlement_msat: row.get::<i64, _>("settlement_msat").max(0) as u64,
            settlement_fee_msat: row.get::<i64, _>("settlement_fee_msat").max(0) as u64,
            quantity: row.get::<f64, _>("quantity"),
            average_price_ppm: row.get::<i64, _>("average_price_ppm").max(0) as u64,
            marginal_price_before_ppm: row.get::<i64, _>("marginal_price_before_ppm").max(0) as u64,
            marginal_price_after_ppm: row.get::<i64, _>("marginal_price_after_ppm").max(0) as u64,
            current_price_yes_ppm: row.get::<i64, _>("current_price_yes_ppm").max(0) as u64,
            current_price_no_ppm: row.get::<i64, _>("current_price_no_ppm").max(0) as u64,
            snapshot_q_long: row.get::<f64, _>("snapshot_q_long"),
            snapshot_q_short: row.get::<f64, _>("snapshot_q_short"),
            snapshot_reserve_minor: row.get::<i64, _>("snapshot_reserve_minor").max(0) as u64,
            created_at: row.get::<i64, _>("created_at"),
            expires_at: row.get::<i64, _>("expires_at"),
            executed_trade_id: row.get::<Option<String>, _>("executed_trade_id"),
            executed_at: row.get::<Option<i64>, _>("executed_at"),
        }))
    }

    pub async fn get_trade_settlement_by_trade_id(
        &self,
        trade_id: &str,
    ) -> Result<Option<TradeSettlementRecord>> {
        let row = sqlx::query(
            r#"
            SELECT
                id,
                trade_id,
                quote_id,
                pubkey,
                market_event_id,
                trade_type,
                side,
                rail,
                mode,
                settlement_minor,
                settlement_msat,
                settlement_fee_msat,
                fx_quote_id,
                invoice,
                payment_hash,
                status,
                metadata_json,
                created_at,
                settled_at,
                completed_at
            FROM trade_settlements
            WHERE trade_id = ?
            LIMIT 1
            "#,
        )
        .bind(trade_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(|row| TradeSettlementRecord {
            id: row.get::<String, _>("id"),
            trade_id: row.get::<String, _>("trade_id"),
            quote_id: row.get::<Option<String>, _>("quote_id"),
            pubkey: row.get::<String, _>("pubkey"),
            market_event_id: row.get::<String, _>("market_event_id"),
            trade_type: row.get::<String, _>("trade_type"),
            side: row.get::<String, _>("side"),
            rail: row.get::<String, _>("rail"),
            mode: row.get::<String, _>("mode"),
            settlement_minor: row.get::<i64, _>("settlement_minor").max(0) as u64,
            settlement_msat: row.get::<i64, _>("settlement_msat").max(0) as u64,
            settlement_fee_msat: row.get::<i64, _>("settlement_fee_msat").max(0) as u64,
            fx_quote_id: row.get::<Option<String>, _>("fx_quote_id"),
            invoice: row.get::<Option<String>, _>("invoice"),
            payment_hash: row.get::<Option<String>, _>("payment_hash"),
            status: row
                .get::<String, _>("status")
                .parse()
                .unwrap_or(TradeSettlementStatus::Complete),
            metadata_json: row.get::<Option<String>, _>("metadata_json"),
            created_at: row.get::<i64, _>("created_at"),
            settled_at: row.get::<Option<i64>, _>("settled_at"),
            completed_at: row.get::<Option<i64>, _>("completed_at"),
        }))
    }

    pub async fn list_positions(&self, pubkey: &str) -> Result<Vec<MarketPosition>> {
        let rows = sqlx::query_as::<_, (String, String, String, String, f64, i64, i64)>(
            r#"
            SELECT pubkey, market_event_id, market_slug, direction, quantity, cost_basis_minor, updated_at
            FROM market_positions
            WHERE pubkey = ? AND quantity > 0
            ORDER BY updated_at DESC
            "#,
        )
        .bind(pubkey)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    pubkey,
                    market_event_id,
                    market_slug,
                    direction,
                    quantity,
                    cost_basis_minor,
                    updated_at,
                )| {
                    MarketPosition {
                        pubkey,
                        market_event_id,
                        market_slug,
                        direction,
                        quantity,
                        cost_basis_minor: cost_basis_minor.max(0) as u64,
                        updated_at,
                    }
                },
            )
            .collect())
    }

    pub async fn list_recent_public_trade_events(
        &self,
        limit: i64,
    ) -> Result<Vec<MarketTradeRecord>> {
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                String,
                String,
                i64,
                i64,
                f64,
                i64,
                i64,
                String,
            ),
        >(
            r#"
            SELECT
                t.id,
                t.market_event_id,
                t.market_slug,
                t.pubkey,
                t.direction,
                t.trade_type,
                t.amount_minor,
                t.fee_minor,
                t.quantity,
                t.price_ppm,
                t.created_at,
                t.raw_event_json
            FROM market_trade_events t
            INNER JOIN market_launch_state s ON s.event_id = t.market_event_id
            WHERE s.visibility = 'public'
            ORDER BY t.created_at DESC
            LIMIT ?
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    market_event_id,
                    market_slug,
                    pubkey,
                    direction,
                    trade_type,
                    amount_minor,
                    fee_minor,
                    quantity,
                    price_ppm,
                    created_at,
                    raw_event_json,
                )| MarketTradeRecord {
                    id,
                    market_event_id,
                    market_slug,
                    pubkey,
                    direction,
                    trade_type,
                    amount_minor: amount_minor.max(0) as u64,
                    fee_minor: fee_minor.max(0) as u64,
                    quantity,
                    price_ppm: price_ppm.max(0) as u64,
                    created_at,
                    raw_event_json,
                },
            )
            .collect())
    }

    pub async fn list_market_trade_events(
        &self,
        event_id: &str,
        limit: i64,
    ) -> Result<Vec<MarketTradeRecord>> {
        let rows = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                String,
                String,
                i64,
                i64,
                f64,
                i64,
                i64,
                String,
            ),
        >(
            r#"
            SELECT
                id,
                market_event_id,
                market_slug,
                pubkey,
                direction,
                trade_type,
                amount_minor,
                fee_minor,
                quantity,
                price_ppm,
                created_at,
                raw_event_json
            FROM market_trade_events
            WHERE market_event_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            "#,
        )
        .bind(event_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows
            .into_iter()
            .map(
                |(
                    id,
                    market_event_id,
                    market_slug,
                    pubkey,
                    direction,
                    trade_type,
                    amount_minor,
                    fee_minor,
                    quantity,
                    price_ppm,
                    created_at,
                    raw_event_json,
                )| MarketTradeRecord {
                    id,
                    market_event_id,
                    market_slug,
                    pubkey,
                    direction,
                    trade_type,
                    amount_minor: amount_minor.max(0) as u64,
                    fee_minor: fee_minor.max(0) as u64,
                    quantity,
                    price_ppm: price_ppm.max(0) as u64,
                    created_at,
                    raw_event_json,
                },
            )
            .collect())
    }

    pub async fn get_market_trade_event(
        &self,
        trade_id: &str,
    ) -> Result<Option<MarketTradeRecord>> {
        let row = sqlx::query_as::<
            _,
            (
                String,
                String,
                String,
                String,
                String,
                String,
                i64,
                i64,
                f64,
                i64,
                i64,
                String,
            ),
        >(
            r#"
            SELECT
                id,
                market_event_id,
                market_slug,
                pubkey,
                direction,
                trade_type,
                amount_minor,
                fee_minor,
                quantity,
                price_ppm,
                created_at,
                raw_event_json
            FROM market_trade_events
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(trade_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(
            |(
                id,
                market_event_id,
                market_slug,
                pubkey,
                direction,
                trade_type,
                amount_minor,
                fee_minor,
                quantity,
                price_ppm,
                created_at,
                raw_event_json,
            )| MarketTradeRecord {
                id,
                market_event_id,
                market_slug,
                pubkey,
                direction,
                trade_type,
                amount_minor: amount_minor.max(0) as u64,
                fee_minor: fee_minor.max(0) as u64,
                quantity,
                price_ppm: price_ppm.max(0) as u64,
                created_at,
                raw_event_json,
            },
        ))
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn apply_trade_execution(
        &self,
        trade_id: &str,
        created_at: i64,
        quote_id: Option<&str>,
        wallet_pubkey: &str,
        market: &Market,
        direction: &str,
        trade_type: &str,
        amount_minor: u64,
        fee_minor: u64,
        quantity_delta: f64,
        cost_basis_delta_minor: i64,
        wallet_delta_minor: i64,
        price_ppm: u64,
        raw_event_json: &str,
        next_q_long: f64,
        next_q_short: f64,
        next_reserve_minor: u64,
        settlement: Option<&TradeSettlementInsert>,
    ) -> Result<MarketTradeRecord> {
        let mut tx = self.pool.begin().await?;
        let now = created_at;

        if let Some(quote_id) = quote_id.filter(|value| !value.trim().is_empty()) {
            let quote_row = sqlx::query_as::<_, (Option<String>, i64)>(
                r#"
                SELECT executed_trade_id, expires_at
                FROM trade_quote_snapshots
                WHERE id = ?
                LIMIT 1
                "#,
            )
            .bind(quote_id)
            .fetch_optional(&mut *tx)
            .await?;

            let Some((executed_trade_id, expires_at)) = quote_row else {
                return Err(crate::error::CascadeError::invalid_input(
                    "trade quote not found".to_string(),
                ));
            };

            if executed_trade_id.is_some() {
                return Err(crate::error::CascadeError::invalid_input(
                    "trade quote already executed".to_string(),
                ));
            }

            if expires_at <= now {
                return Err(crate::error::CascadeError::invalid_input(
                    "trade quote has expired".to_string(),
                ));
            }
        }

        let wallet_row = sqlx::query_as::<_, (i64,)>(
            "SELECT available_minor FROM wallet_balances WHERE pubkey = ?",
        )
        .bind(wallet_pubkey)
        .fetch_optional(&mut *tx)
        .await?;
        let current_wallet = wallet_row.map(|(value,)| value).unwrap_or(0);
        let next_wallet = current_wallet + wallet_delta_minor;
        if next_wallet < 0 {
            return Err(crate::error::CascadeError::InsufficientFunds {
                need: wallet_delta_minor.unsigned_abs(),
                have: current_wallet.max(0) as u64,
            });
        }

        sqlx::query(
            r#"
            INSERT INTO wallet_balances (pubkey, available_minor, total_deposited_minor, updated_at)
            VALUES (?, ?, 0, ?)
            ON CONFLICT(pubkey) DO UPDATE SET
                available_minor = ?,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(wallet_pubkey)
        .bind(next_wallet)
        .bind(now)
        .bind(next_wallet)
        .execute(&mut *tx)
        .await?;

        let existing_position = sqlx::query_as::<_, (f64, i64)>(
            r#"
            SELECT quantity, cost_basis_minor
            FROM market_positions
            WHERE pubkey = ? AND market_event_id = ? AND direction = ?
            "#,
        )
        .bind(wallet_pubkey)
        .bind(&market.event_id)
        .bind(direction)
        .fetch_optional(&mut *tx)
        .await?;

        let (current_qty, current_cost_basis) = existing_position.unwrap_or((0.0, 0));
        let next_qty = current_qty + quantity_delta;
        if next_qty < -f64::EPSILON {
            return Err(crate::error::CascadeError::invalid_input(
                "Position quantity cannot go negative",
            ));
        }
        let next_cost_basis = (current_cost_basis + cost_basis_delta_minor).max(0);

        if next_qty <= f64::EPSILON {
            sqlx::query(
                r#"
                DELETE FROM market_positions
                WHERE pubkey = ? AND market_event_id = ? AND direction = ?
                "#,
            )
            .bind(wallet_pubkey)
            .bind(&market.event_id)
            .bind(direction)
            .execute(&mut *tx)
            .await?;
        } else {
            sqlx::query(
                r#"
                INSERT INTO market_positions (
                    pubkey,
                    market_event_id,
                    market_slug,
                    direction,
                    quantity,
                    cost_basis_minor,
                    updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(pubkey, market_event_id, direction) DO UPDATE SET
                    market_slug = excluded.market_slug,
                    quantity = excluded.quantity,
                    cost_basis_minor = excluded.cost_basis_minor,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(wallet_pubkey)
            .bind(&market.event_id)
            .bind(&market.slug)
            .bind(direction)
            .bind(next_qty)
            .bind(next_cost_basis)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        sqlx::query(
            r#"
            UPDATE markets
            SET q_long = ?, q_short = ?, reserve_sats = ?
            WHERE event_id = ?
            "#,
        )
        .bind(next_q_long)
        .bind(next_q_short)
        .bind(next_reserve_minor as i64)
        .bind(&market.event_id)
        .execute(&mut *tx)
        .await?;

        let existing_state = sqlx::query_as::<_, (i64, i64, Option<i64>)>(
            r#"
            SELECT volume_minor, trade_count, first_trade_at
            FROM market_launch_state
            WHERE event_id = ?
            "#,
        )
        .bind(&market.event_id)
        .fetch_one(&mut *tx)
        .await?;

        let next_volume_minor = existing_state.0 + amount_minor as i64;
        let next_trade_count = existing_state.1 + 1;
        let first_trade_at = existing_state.2.unwrap_or(now);
        let visibility = if next_trade_count > 0 {
            "public"
        } else {
            "pending"
        };

        sqlx::query(
            r#"
            UPDATE market_launch_state
            SET
                visibility = ?,
                first_trade_at = ?,
                public_visible_at = COALESCE(public_visible_at, ?),
                volume_minor = ?,
                trade_count = ?,
                last_price_yes_ppm = ?,
                last_price_no_ppm = ?,
                updated_at = ?
            WHERE event_id = ?
            "#,
        )
        .bind(visibility)
        .bind(first_trade_at)
        .bind(now)
        .bind(next_volume_minor)
        .bind(next_trade_count)
        .bind(if direction == "yes" {
            price_ppm as i64
        } else {
            (1_000_000_u64.saturating_sub(price_ppm)) as i64
        })
        .bind(if direction == "yes" {
            (1_000_000_u64.saturating_sub(price_ppm)) as i64
        } else {
            price_ppm as i64
        })
        .bind(now)
        .bind(&market.event_id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO market_trade_events (
                id,
                market_event_id,
                market_slug,
                pubkey,
                direction,
                trade_type,
                amount_minor,
                fee_minor,
                quantity,
                price_ppm,
                created_at,
                raw_event_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(trade_id)
        .bind(&market.event_id)
        .bind(&market.slug)
        .bind(wallet_pubkey)
        .bind(direction)
        .bind(trade_type)
        .bind(amount_minor as i64)
        .bind(fee_minor as i64)
        .bind(quantity_delta.abs())
        .bind(price_ppm as i64)
        .bind(now)
        .bind(raw_event_json)
        .execute(&mut *tx)
        .await?;

        if let Some(settlement) = settlement {
            sqlx::query(
                r#"
                INSERT INTO trade_settlements (
                    id,
                    trade_id,
                    quote_id,
                    pubkey,
                    market_event_id,
                    trade_type,
                    side,
                    rail,
                    mode,
                    settlement_minor,
                    settlement_msat,
                    settlement_fee_msat,
                    fx_quote_id,
                    invoice,
                    payment_hash,
                    status,
                    metadata_json,
                    created_at,
                    settled_at,
                    completed_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'complete', ?, ?, ?, ?)
                "#,
            )
            .bind(uuid::Uuid::new_v4().to_string())
            .bind(trade_id)
            .bind(settlement.quote_id.as_deref())
            .bind(&settlement.pubkey)
            .bind(&settlement.market_event_id)
            .bind(&settlement.trade_type)
            .bind(&settlement.side)
            .bind(&settlement.rail)
            .bind(&settlement.mode)
            .bind(settlement.settlement_minor as i64)
            .bind(settlement.settlement_msat as i64)
            .bind(settlement.settlement_fee_msat as i64)
            .bind(settlement.fx_quote_id.as_deref())
            .bind(settlement.invoice.as_deref())
            .bind(settlement.payment_hash.as_deref())
            .bind(settlement.metadata_json.as_deref())
            .bind(now)
            .bind(now)
            .bind(now)
            .execute(&mut *tx)
            .await?;
        }

        if let Some(quote_id) = quote_id.filter(|value| !value.trim().is_empty()) {
            let result = sqlx::query(
                r#"
                UPDATE trade_quote_snapshots
                SET executed_trade_id = ?, executed_at = ?
                WHERE id = ? AND executed_trade_id IS NULL AND expires_at > ?
                "#,
            )
            .bind(trade_id)
            .bind(now)
            .bind(quote_id)
            .bind(now)
            .execute(&mut *tx)
            .await?;

            if result.rows_affected() != 1 {
                return Err(crate::error::CascadeError::invalid_input(
                    "trade quote is no longer executable".to_string(),
                ));
            }
        }

        tx.commit().await?;

        Ok(MarketTradeRecord {
            id: trade_id.to_string(),
            market_event_id: market.event_id.clone(),
            market_slug: market.slug.clone(),
            pubkey: wallet_pubkey.to_string(),
            direction: direction.to_string(),
            trade_type: trade_type.to_string(),
            amount_minor,
            fee_minor,
            quantity: quantity_delta.abs(),
            price_ppm,
            created_at: now,
            raw_event_json: raw_event_json.to_string(),
        })
    }
}

fn map_market_and_launch_state_row(row: &sqlx::sqlite::SqliteRow) -> (Market, MarketLaunchState) {
    let event_id: String = row.get("event_id");
    let raw_event_json: String = row.get("raw_event_json");
    let visibility: String = row.get("visibility");

    let market = Market {
        event_id: event_id.clone(),
        slug: row.get("slug"),
        title: row.get("title"),
        description: row.get("description"),
        b: row.get("b"),
        q_long: row.get("q_long"),
        q_short: row.get("q_short"),
        reserve_sats: row.get::<i64, _>("reserve_sats").max(0) as u64,
        status: row
            .get::<String, _>("status")
            .parse()
            .unwrap_or(MarketStatus::Active),
        resolution_outcome: row
            .get::<Option<String>, _>("resolution_outcome")
            .and_then(|value| value.parse().ok()),
        creator_pubkey: row.get("creator_pubkey"),
        created_at: row.get("created_at"),
        long_keyset_id: row.get("long_keyset_id"),
        short_keyset_id: row.get("short_keyset_id"),
        resolved_at: row.get("resolved_at"),
    };

    let state = MarketLaunchState {
        event_id,
        raw_event_json,
        visibility: visibility.parse().unwrap_or(MarketVisibility::Pending),
        first_trade_at: row.get("first_trade_at"),
        public_visible_at: row.get("public_visible_at"),
        volume_minor: row.get::<i64, _>("volume_minor").max(0) as u64,
        trade_count: row.get::<i64, _>("trade_count").max(0) as u64,
        last_price_yes_ppm: row.get::<i64, _>("last_price_yes_ppm").max(0) as u64,
        last_price_no_ppm: row.get::<i64, _>("last_price_no_ppm").max(0) as u64,
        updated_at: row.get("updated_at"),
    };

    (market, state)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Helper to create an in-memory database for testing
    async fn create_test_db() -> CascadeDatabase {
        let db = CascadeDatabase::connect("sqlite::memory:").await.unwrap();
        db.run_migrations().await.unwrap();
        db
    }

    #[tokio::test]
    async fn test_migration_runs_successfully() {
        // Test that migrations run without error
        let db = create_test_db().await;

        // Verify the markets table exists
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM markets")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lightning_escrow_table_exists() {
        let db = create_test_db().await;

        // Verify escrow_accounts table exists and can be queried
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM escrow_accounts")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lightning_orders_table_exists() {
        let db = create_test_db().await;

        // Verify lightning_orders table exists
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM lightning_orders")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_htlcs_table_exists() {
        let db = create_test_db().await;

        // Verify htlcs table exists
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM htlcs")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lnd_configs_table_exists() {
        let db = create_test_db().await;

        // Verify lnd_configs table exists
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM lnd_configs")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_payment_history_table_exists() {
        let db = create_test_db().await;

        // Verify payment_history table exists
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM payment_history")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_nip47_requests_table_exists() {
        let db = create_test_db().await;

        // Verify nip47_requests table exists
        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM nip47_requests")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_trade_settlements_table_exists() {
        let db = create_test_db().await;

        let result: Result<(i64,)> = sqlx::query_as("SELECT COUNT(*) FROM trade_settlements")
            .fetch_one(&db.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_escrow_accounts_indexes_exist() {
        let db = create_test_db().await;

        // Verify indexes exist for escrow_accounts
        let indexes: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='escrow_accounts'",
        )
        .fetch_all(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        let index_names: Vec<&str> = indexes.iter().map(|(n,)| n.as_str()).collect();

        assert!(index_names.contains(&"idx_escrow_payment_hash"));
        assert!(index_names.contains(&"idx_escrow_state"));
        assert!(index_names.contains(&"idx_escrow_expires"));
        assert!(index_names.contains(&"idx_escrow_market"));
    }

    #[tokio::test]
    async fn test_lightning_orders_indexes_exist() {
        let db = create_test_db().await;

        // Verify indexes exist for lightning_orders
        let indexes: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='lightning_orders'",
        )
        .fetch_all(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        let index_names: Vec<&str> = indexes.iter().map(|(n,)| n.as_str()).collect();

        assert!(index_names.contains(&"idx_orders_payment_hash"));
        assert!(index_names.contains(&"idx_orders_state"));
        assert!(index_names.contains(&"idx_orders_pubkey"));
    }

    #[tokio::test]
    async fn test_htlcs_indexes_exist() {
        let db = create_test_db().await;

        // Verify indexes exist for htlcs
        let indexes: Vec<(String,)> = sqlx::query_as(
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='htlcs'",
        )
        .fetch_all(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        let index_names: Vec<&str> = indexes.iter().map(|(n,)| n.as_str()).collect();

        assert!(index_names.contains(&"idx_htlcs_payment_hash"));
        assert!(index_names.contains(&"idx_htlcs_status"));
    }

    #[tokio::test]
    async fn test_escrow_account_insert_and_query() {
        let db = create_test_db().await;

        // First create a market (needed for foreign key)
        let now = chrono::Utc::now().timestamp();

        sqlx::query(
            r#"
            INSERT INTO markets (event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, creator_pubkey, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind("event-test-escrow")
        .bind("test-market-escrow")
        .bind("Test Market")
        .bind("A test market")
        .bind(1000.0)
        .bind(10.0)
        .bind(10.0)
        .bind(1000i64)
        .bind("Active")
        .bind("pubkey123")
        .bind(now)
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Insert a test escrow account
        let expires = now + 3600;

        sqlx::query(
            r#"
            INSERT INTO escrow_accounts (id, order_id, market_slug, side, amount_sats, payment_hash, invoice, state, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind("escrow-1")
        .bind("order-1")
        .bind("test-market-escrow")
        .bind("LONG")
        .bind(1000i64)
        .bind("abc123")
        .bind("lnbc100...")
        .bind("Pending")
        .bind(expires)
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Query it back
        let result: Result<(String, String, String, i64, String)> = sqlx::query_as(
            "SELECT id, order_id, market_slug, amount_sats, state FROM escrow_accounts WHERE id = ?"
        )
        .bind("escrow-1")
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
        let (id, order_id, market, amount, state) = result.unwrap();
        assert_eq!(id, "escrow-1");
        assert_eq!(order_id, "order-1");
        assert_eq!(market, "test-market-escrow");
        assert_eq!(amount, 1000);
        assert_eq!(state, "Pending");
    }

    #[tokio::test]
    async fn test_lightning_order_insert_and_query() {
        let db = create_test_db().await;

        // First create a market (needed for foreign key)
        let now = chrono::Utc::now().timestamp();

        sqlx::query(
            r#"
            INSERT INTO markets (event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, creator_pubkey, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind("event-1")
        .bind("test-market-escrow")
        .bind("Test Market")
        .bind("A test market")
        .bind(1000.0)
        .bind(10.0)
        .bind(10.0)
        .bind(1000i64)
        .bind("Active")
        .bind("pubkey123")
        .bind(now)
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Insert escrow first
        let expires = now + 3600;
        sqlx::query(
            r#"
            INSERT INTO escrow_accounts (id, order_id, market_slug, side, amount_sats, payment_hash, invoice, state, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind("escrow-1")
        .bind("order-1")
        .bind("test-market-escrow")
        .bind("LONG")
        .bind(1000i64)
        .bind("abc123")
        .bind("lnbc100...")
        .bind("Pending")
        .bind(expires)
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Insert lightning order
        sqlx::query(
            r#"
            INSERT INTO lightning_orders (id, market_slug, side, amount_sats, fee_sats, total_sats, escrow_id, invoice, payment_hash, state, expires_at, user_pubkey)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind("order-1")
        .bind("test-market-escrow")
        .bind("LONG")
        .bind(1000i64)
        .bind(10i64)
        .bind(1010i64)
        .bind("escrow-1")
        .bind("lnbc100...")
        .bind("abc123")
        .bind("InvoicePending")
        .bind(expires)
        .bind("user123")
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Query it back
        let result: Result<(String, String, String, i64, String)> = sqlx::query_as(
            "SELECT id, market_slug, side, amount_sats, state FROM lightning_orders WHERE id = ?",
        )
        .bind("order-1")
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
        let (id, market, side, amount, state) = result.unwrap();
        assert_eq!(id, "order-1");
        assert_eq!(market, "test-market-escrow");
        assert_eq!(side, "LONG");
        assert_eq!(amount, 1000);
        assert_eq!(state, "InvoicePending");
    }

    #[tokio::test]
    async fn test_htlc_insert_and_query() {
        let db = create_test_db().await;

        // Insert a test HTLC
        sqlx::query(
            r#"
            INSERT INTO htlcs (id, payment_hash, amount_msat, cltv_expiry, status)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind("htlc-1")
        .bind("hash123")
        .bind(100000i64)
        .bind(144i64)
        .bind("Pending")
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Query it back
        let result: Result<(String, i64, String)> =
            sqlx::query_as("SELECT id, amount_msat, status FROM htlcs WHERE id = ?")
                .bind("htlc-1")
                .fetch_one(&db.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
        let (id, amount, status) = result.unwrap();
        assert_eq!(id, "htlc-1");
        assert_eq!(amount, 100000);
        assert_eq!(status, "Pending");
    }

    #[tokio::test]
    async fn test_lnd_config_insert_and_query() {
        let db = create_test_db().await;

        // Insert a test LND config
        sqlx::query(
            r#"
            INSERT INTO lnd_configs (id, name, host, port, tls_cert_path, macaroon_path, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind("lnd-1")
        .bind("Main LND")
        .bind("localhost")
        .bind(10009i32)
        .bind("/path/to/cert")
        .bind("/path/to/macaroon")
        .bind(1i32)
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();

        // Query it back
        let result: Result<(String, String, String, i32)> =
            sqlx::query_as("SELECT id, name, host, port FROM lnd_configs WHERE id = ?")
                .bind("lnd-1")
                .fetch_one(&db.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()));

        assert!(result.is_ok());
        let (id, name, host, port) = result.unwrap();
        assert_eq!(id, "lnd-1");
        assert_eq!(name, "Main LND");
        assert_eq!(host, "localhost");
        assert_eq!(port, 10009);
    }
}
