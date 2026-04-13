//! Database persistence layer using SQLite

use crate::error::Result;
use crate::market::{Market, MarketStatus, Side, Trade, TradeDirection};
use crate::product::{
    FxQuoteObservation, FxQuoteSnapshot, FxQuoteSourceMetadata, MarketLaunchState,
    MarketTradeRecord, MarketVisibility, TradeExecutionRequest, TradeExecutionRequestStatus,
    TradeQuoteSnapshot, TradeSettlementInsert, TradeSettlementRecord, TradeSettlementStatus,
    UsdcDepositIntent, UsdcDepositIntentStatus, UsdcWithdrawal, UsdcWithdrawalStatus,
    WalletFundingEvent, WalletFundingQuote, WalletFundingRequest, WalletFundingRequestStatus,
    WalletFundingStatus,
};
use crate::trade::Payout;
use sqlx::sqlite::{SqliteConnectOptions, SqlitePool};
use sqlx::{Row, Sqlite};
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

fn serialize_fx_source_metadata(metadata: &FxQuoteSourceMetadata) -> Result<String> {
    serde_json::to_string(metadata).map_err(|e| crate::error::CascadeError::database(e.to_string()))
}

fn deserialize_fx_source_metadata(metadata_json: &str) -> FxQuoteSourceMetadata {
    serde_json::from_str::<FxQuoteSourceMetadata>(metadata_json).unwrap_or_default()
}

fn usdc_withdrawal_from_row(row: sqlx::sqlite::SqliteRow) -> UsdcWithdrawal {
    UsdcWithdrawal {
        id: row.get::<String, _>("id"),
        request_id: row.get::<Option<String>, _>("request_id"),
        pubkey: row.get::<String, _>("pubkey"),
        provider: row.get::<Option<String>, _>("provider"),
        provider_payout_id: row.get::<Option<String>, _>("provider_payout_id"),
        network: row.get::<String, _>("network"),
        asset: row.get::<String, _>("asset"),
        destination_address: row.get::<String, _>("destination_address"),
        wallet_amount_minor: row.get::<i64, _>("wallet_amount_minor").max(0) as u64,
        asset_units: row.get::<i64, _>("asset_units").max(0) as u64,
        onchain_tx_id: row.get::<Option<String>, _>("onchain_tx_id"),
        status: row
            .get::<String, _>("status")
            .parse()
            .unwrap_or(UsdcWithdrawalStatus::Pending),
        error_message: row.get::<Option<String>, _>("error_message"),
        change_signatures_json: row.get::<Option<String>, _>("change_signatures_json"),
        metadata_json: row.get::<Option<String>, _>("metadata_json"),
        created_at: row.get::<i64, _>("created_at"),
        submitted_at: row.get::<Option<i64>, _>("submitted_at"),
        completed_at: row.get::<Option<i64>, _>("completed_at"),
        failed_at: row.get::<Option<i64>, _>("failed_at"),
    }
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

        self.rename_wallet_funding_tables_if_needed().await?;
        sqlx::query(include_str!(
            "../../../migrations/007_trade_quote_snapshots.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.ensure_fx_quote_observations_column().await?;
        self.ensure_wallet_funding_quote_metadata_column().await?;
        self.ensure_trade_quote_settlement_columns().await?;
        self.ensure_fx_quote_source_metadata_columns().await?;
        self.ensure_trade_execution_request_response_column()
            .await?;

        sqlx::query(include_str!(
            "../../../migrations/009_trade_settlements.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/013_drop_portfolio_proofs.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/014_drop_portfolio_ledgers.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!(
            "../../../migrations/015_usdc_deposit_intents.sql"
        ))
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        sqlx::query(include_str!("../../../migrations/016_usdc_withdrawals.sql"))
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

    async fn table_exists(&self, table: &str) -> Result<bool> {
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(1) FROM sqlite_master WHERE type = 'table' AND name = ?",
        )
        .bind(table)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(exists > 0)
    }

    async fn rename_wallet_funding_tables_if_needed(&self) -> Result<()> {
        if self.table_exists("wallet_topup_quotes").await?
            && !self.table_exists("wallet_funding_quotes").await?
        {
            sqlx::query("ALTER TABLE wallet_topup_quotes RENAME TO wallet_funding_quotes")
                .execute(&self.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

            sqlx::query("DROP INDEX IF EXISTS idx_wallet_topup_quotes_pubkey")
                .execute(&self.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
            sqlx::query("DROP INDEX IF EXISTS idx_wallet_topup_quotes_status")
                .execute(&self.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
            sqlx::query("DROP INDEX IF EXISTS idx_wallet_topup_quotes_payment_hash")
                .execute(&self.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_wallet_funding_quotes_pubkey ON wallet_funding_quotes(pubkey, created_at DESC)",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_wallet_funding_quotes_status ON wallet_funding_quotes(status, expires_at ASC)",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_wallet_funding_quotes_payment_hash ON wallet_funding_quotes(payment_hash)",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        if self.table_exists("wallet_topup_requests").await?
            && !self.table_exists("wallet_funding_requests").await?
        {
            sqlx::query("ALTER TABLE wallet_topup_requests RENAME TO wallet_funding_requests")
                .execute(&self.pool)
                .await
                .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        if self.table_exists("wallet_funding_requests").await?
            && self
                .column_exists("wallet_funding_requests", "topup_quote_id")
                .await?
            && !self
                .column_exists("wallet_funding_requests", "funding_quote_id")
                .await?
        {
            sqlx::query(
                "ALTER TABLE wallet_funding_requests RENAME COLUMN topup_quote_id TO funding_quote_id",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        sqlx::query("DROP INDEX IF EXISTS idx_wallet_topup_requests_pubkey")
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        sqlx::query("DROP INDEX IF EXISTS idx_wallet_topup_requests_rail")
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        if self.table_exists("wallet_funding_requests").await? {
            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_pubkey ON wallet_funding_requests(pubkey, created_at DESC)",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
            sqlx::query(
                "CREATE INDEX IF NOT EXISTS idx_wallet_funding_requests_rail ON wallet_funding_requests(rail, created_at DESC)",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        Ok(())
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

    async fn ensure_wallet_funding_quote_metadata_column(&self) -> Result<()> {
        if !self
            .column_exists("wallet_funding_quotes", "metadata_json")
            .await?
        {
            sqlx::query("ALTER TABLE wallet_funding_quotes ADD COLUMN metadata_json TEXT")
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

    async fn ensure_fx_quote_source_metadata_columns(&self) -> Result<()> {
        if !self
            .column_exists("fx_quote_snapshots", "reference_btc_usd_price")
            .await?
        {
            sqlx::query(
                "ALTER TABLE fx_quote_snapshots ADD COLUMN reference_btc_usd_price REAL NOT NULL DEFAULT 0",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        if !self
            .column_exists("fx_quote_snapshots", "metadata_json")
            .await?
        {
            sqlx::query(
                "ALTER TABLE fx_quote_snapshots ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}'",
            )
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        sqlx::query(
            "UPDATE fx_quote_snapshots SET reference_btc_usd_price = btc_usd_price WHERE reference_btc_usd_price <= 0",
        )
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(())
    }

    async fn ensure_trade_execution_request_response_column(&self) -> Result<()> {
        if self.table_exists("trade_execution_requests").await?
            && !self
                .column_exists("trade_execution_requests", "response_json")
                .await?
        {
            sqlx::query(include_str!(
                "../../../migrations/018_trade_request_response_json.sql"
            ))
            .execute(&self.pool)
            .await
            .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;
        }

        Ok(())
    }

    async fn store_fx_quote_snapshot_tx(
        tx: &mut sqlx::Transaction<'_, Sqlite>,
        fx_quote: &FxQuoteSnapshot,
    ) -> Result<()> {
        let observations_json = serialize_fx_observations(&fx_quote.observations)?;
        let source_metadata_json = serialize_fx_source_metadata(&fx_quote.source_metadata)?;

        sqlx::query(
            r#"
            INSERT INTO fx_quote_snapshots (
                id,
                amount_minor,
                amount_msat,
                btc_usd_price,
                reference_btc_usd_price,
                source,
                spread_bps,
                observations_json,
                metadata_json,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                amount_minor = excluded.amount_minor,
                amount_msat = excluded.amount_msat,
                btc_usd_price = excluded.btc_usd_price,
                reference_btc_usd_price = excluded.reference_btc_usd_price,
                source = excluded.source,
                spread_bps = excluded.spread_bps,
                observations_json = excluded.observations_json,
                metadata_json = excluded.metadata_json,
                created_at = excluded.created_at,
                expires_at = excluded.expires_at
            "#,
        )
        .bind(&fx_quote.id)
        .bind(fx_quote.amount_minor as i64)
        .bind(fx_quote.amount_msat as i64)
        .bind(fx_quote.btc_usd_price)
        .bind(fx_quote.reference_btc_usd_price)
        .bind(&fx_quote.source)
        .bind(fx_quote.spread_bps as i64)
        .bind(&observations_json)
        .bind(&source_metadata_json)
        .bind(fx_quote.created_at)
        .bind(fx_quote.expires_at)
        .execute(&mut **tx)
        .await?;

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

    pub async fn sum_wallet_funding_quote_amount_since(
        &self,
        pubkey: &str,
        rail: &str,
        since: i64,
    ) -> Result<u64> {
        let amount_minor = sqlx::query_scalar::<_, Option<i64>>(
            r#"
            SELECT SUM(amount_minor)
            FROM wallet_funding_quotes
            WHERE pubkey = ?
              AND rail = ?
              AND status IN ('invoice_pending', 'complete', 'review_required')
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

    pub async fn sum_wallet_funding_quote_amount_since_all_rails(
        &self,
        pubkey: &str,
        since: i64,
    ) -> Result<u64> {
        let amount_minor = sqlx::query_scalar::<_, Option<i64>>(
            r#"
            SELECT SUM(amount_minor)
            FROM wallet_funding_quotes
            WHERE pubkey = ?
              AND status IN ('invoice_pending', 'complete', 'review_required')
              AND created_at >= ?
            "#,
        )
        .bind(pubkey)
        .bind(since)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?
        .unwrap_or(0);

        Ok(amount_minor.max(0) as u64)
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn create_wallet_funding_quote(
        &self,
        quote_id: Option<&str>,
        pubkey: &str,
        rail: &str,
        amount_minor: u64,
        amount_msat: u64,
        invoice: Option<&str>,
        payment_hash: Option<&str>,
        metadata_json: Option<&str>,
        request_id: Option<&str>,
        fx_quote: &FxQuoteSnapshot,
    ) -> Result<WalletFundingQuote> {
        let mut tx = self.pool.begin().await?;
        let now = chrono::Utc::now().timestamp();
        let quote_id = quote_id
            .map(str::to_string)
            .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        let quote = WalletFundingQuote {
            id: quote_id,
            pubkey: pubkey.to_string(),
            rail: rail.to_string(),
            amount_minor,
            amount_msat,
            status: WalletFundingStatus::InvoicePending,
            invoice: invoice.map(str::to_string),
            payment_hash: payment_hash.map(str::to_string),
            fx_quote_id: fx_quote.id.clone(),
            funding_event_id: None,
            metadata_json: metadata_json.map(str::to_string),
            created_at: now,
            expires_at: fx_quote.expires_at,
            settled_at: None,
            completed_at: None,
        };

        Self::store_fx_quote_snapshot_tx(&mut tx, fx_quote).await?;

        sqlx::query(
            r#"
            INSERT INTO wallet_funding_quotes (
                id,
                pubkey,
                rail,
                amount_minor,
                amount_msat,
                status,
                invoice,
                payment_hash,
                fx_quote_id,
                metadata_json,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        .bind(quote.metadata_json.as_deref())
        .bind(quote.created_at)
        .bind(quote.expires_at)
        .execute(&mut *tx)
        .await?;

        if let Some(request_id) = request_id.filter(|value| !value.trim().is_empty()) {
            let result = sqlx::query(
                r#"
                UPDATE wallet_funding_requests
                SET status = 'complete',
                    funding_quote_id = ?,
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
                    "wallet funding request missing during completion".to_string(),
                ));
            }
        }

        tx.commit().await?;

        Ok(quote)
    }

    pub async fn get_wallet_funding_quote(
        &self,
        quote_id: &str,
    ) -> Result<Option<WalletFundingQuote>> {
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
            FROM wallet_funding_quotes
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
            )| WalletFundingQuote {
                id,
                pubkey,
                rail,
                amount_minor: amount_minor.max(0) as u64,
                amount_msat: amount_msat.max(0) as u64,
                status: status
                    .parse()
                    .unwrap_or(WalletFundingStatus::InvoicePending),
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
        let row = sqlx::query_as::<
            _,
            (
                String,
                i64,
                i64,
                f64,
                f64,
                String,
                i64,
                String,
                String,
                i64,
                i64,
            ),
        >(
            r#"
            SELECT
                id,
                amount_minor,
                amount_msat,
                btc_usd_price,
                reference_btc_usd_price,
                source,
                spread_bps,
                observations_json,
                metadata_json,
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
                reference_btc_usd_price,
                source,
                spread_bps,
                observations_json,
                metadata_json,
                created_at,
                expires_at,
            )| FxQuoteSnapshot {
                id,
                amount_minor: amount_minor.max(0) as u64,
                amount_msat: amount_msat.max(0) as u64,
                btc_usd_price,
                reference_btc_usd_price: if reference_btc_usd_price > 0.0 {
                    reference_btc_usd_price
                } else {
                    btc_usd_price
                },
                source,
                spread_bps: spread_bps.max(0) as u64,
                observations: deserialize_fx_observations(&observations_json),
                source_metadata: deserialize_fx_source_metadata(&metadata_json),
                created_at,
                expires_at,
            },
        ))
    }

    pub async fn list_pending_wallet_funding_quotes(
        &self,
        pubkey: &str,
        limit: i64,
    ) -> Result<Vec<WalletFundingQuote>> {
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
            FROM wallet_funding_quotes
            WHERE pubkey = ? AND status IN ('invoice_pending', 'paid')
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
                )| WalletFundingQuote {
                    id,
                    pubkey,
                    rail,
                    amount_minor: amount_minor.max(0) as u64,
                    amount_msat: amount_msat.max(0) as u64,
                    status: status
                        .parse()
                        .unwrap_or(WalletFundingStatus::InvoicePending),
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

    pub async fn expire_wallet_fundings_for_pubkey(&self, pubkey: &str, now: i64) -> Result<u64> {
        let mut tx = self.pool.begin().await?;
        let expired_rows = sqlx::query_as::<_, (String, i64)>(
            r#"
            SELECT id, amount_minor
            FROM wallet_funding_quotes
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

        for (quote_id, _amount_minor) in &expired_rows {
            sqlx::query(
                r#"
                UPDATE wallet_funding_quotes
                SET status = 'expired'
                WHERE id = ? AND status = 'invoice_pending'
                "#,
            )
            .bind(quote_id)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;
        Ok(expired_rows.len() as u64)
    }

    pub async fn expire_wallet_funding_quote(
        &self,
        quote_id: &str,
    ) -> Result<Option<WalletFundingQuote>> {
        let mut tx = self.pool.begin().await?;
        let Some(existing) = self.get_wallet_funding_quote(quote_id).await? else {
            tx.commit().await?;
            return Ok(None);
        };

        if existing.status != WalletFundingStatus::InvoicePending {
            tx.commit().await?;
            return Ok(Some(existing));
        }

        sqlx::query(
            r#"
            UPDATE wallet_funding_quotes
            SET status = 'expired'
            WHERE id = ? AND status = 'invoice_pending'
            "#,
        )
        .bind(quote_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        self.get_wallet_funding_quote(quote_id).await
    }

    pub async fn complete_wallet_funding_quote(
        &self,
        quote_id: &str,
        risk_level: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<WalletFundingQuote> {
        let mut tx = self.pool.begin().await?;
        let Some(existing) = self.get_wallet_funding_quote(quote_id).await? else {
            return Err(crate::error::CascadeError::invalid_input(
                "funding quote not found".to_string(),
            ));
        };

        match existing.status {
            WalletFundingStatus::Complete => {
                tx.commit().await?;
                return Ok(existing);
            }
            WalletFundingStatus::Paid | WalletFundingStatus::InvoicePending => {}
            WalletFundingStatus::Expired
            | WalletFundingStatus::Cancelled
            | WalletFundingStatus::ReviewRequired => {
                return Err(crate::error::CascadeError::invalid_input(format!(
                    "cannot complete funding in status {}",
                    existing.status
                )));
            }
        }

        let now = chrono::Utc::now().timestamp();
        if existing.expires_at <= now {
            sqlx::query(
                r#"
                UPDATE wallet_funding_quotes
                SET status = 'expired'
                WHERE id = ? AND status IN ('invoice_pending', 'paid')
                "#,
            )
            .bind(quote_id)
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            return Err(crate::error::CascadeError::invalid_input(
                "funding quote has expired".to_string(),
            ));
        }

        let funding_event_id = if existing.pubkey.trim().is_empty() {
            None
        } else {
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
            Some(funding_event_id)
        };

        sqlx::query(
            r#"
            UPDATE wallet_funding_quotes
            SET status = 'complete',
                funding_event_id = ?,
                metadata_json = ?,
                settled_at = ?,
                completed_at = ?
            WHERE id = ? AND status IN ('invoice_pending', 'paid')
            "#,
        )
        .bind(funding_event_id.as_deref())
        .bind(metadata_json)
        .bind(now)
        .bind(now)
        .bind(quote_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.get_wallet_funding_quote(quote_id)
            .await?
            .ok_or_else(|| crate::error::CascadeError::invalid_input("funding quote not found"))
    }

    pub async fn mark_wallet_funding_quote_review_required(
        &self,
        quote_id: &str,
        risk_level: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<WalletFundingQuote> {
        let mut tx = self.pool.begin().await?;
        let Some(existing) = self.get_wallet_funding_quote(quote_id).await? else {
            return Err(crate::error::CascadeError::invalid_input(
                "funding quote not found".to_string(),
            ));
        };

        match existing.status {
            WalletFundingStatus::ReviewRequired => {
                tx.commit().await?;
                return Ok(existing);
            }
            WalletFundingStatus::Paid | WalletFundingStatus::InvoicePending => {}
            WalletFundingStatus::Complete
            | WalletFundingStatus::Expired
            | WalletFundingStatus::Cancelled => {
                return Err(crate::error::CascadeError::invalid_input(format!(
                    "cannot review funding in status {}",
                    existing.status
                )));
            }
        }

        let now = chrono::Utc::now().timestamp();
        let metadata_json = metadata_json.map(str::to_string).or(existing.metadata_json);
        let funding_event_id = if existing.pubkey.trim().is_empty() {
            None
        } else {
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
                VALUES (?, ?, ?, ?, 'review_required', ?, ?, ?)
                "#,
            )
            .bind(&funding_event_id)
            .bind(&existing.pubkey)
            .bind(&existing.rail)
            .bind(existing.amount_minor as i64)
            .bind(risk_level)
            .bind(metadata_json.as_deref())
            .bind(now)
            .execute(&mut *tx)
            .await?;
            Some(funding_event_id)
        };

        sqlx::query(
            r#"
            UPDATE wallet_funding_quotes
            SET status = 'review_required',
                funding_event_id = ?,
                metadata_json = ?,
                settled_at = ?,
                completed_at = ?
            WHERE id = ? AND status = 'invoice_pending'
            "#,
        )
        .bind(funding_event_id.as_deref())
        .bind(metadata_json)
        .bind(now)
        .bind(now)
        .bind(quote_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.get_wallet_funding_quote(quote_id)
            .await?
            .ok_or_else(|| crate::error::CascadeError::invalid_input("funding quote not found"))
    }

    pub async fn mark_wallet_funding_quote_paid(
        &self,
        quote_id: &str,
        metadata_json: Option<&str>,
    ) -> Result<WalletFundingQuote> {
        let mut tx = self.pool.begin().await?;
        let Some(existing) = self.get_wallet_funding_quote(quote_id).await? else {
            return Err(crate::error::CascadeError::invalid_input(
                "funding quote not found".to_string(),
            ));
        };

        match existing.status {
            WalletFundingStatus::Paid | WalletFundingStatus::Complete => {
                tx.commit().await?;
                return Ok(existing);
            }
            WalletFundingStatus::ReviewRequired
            | WalletFundingStatus::Expired
            | WalletFundingStatus::Cancelled => {
                return Err(crate::error::CascadeError::invalid_input(format!(
                    "cannot mark funding paid in status {}",
                    existing.status
                )));
            }
            WalletFundingStatus::InvoicePending => {}
        }

        let now = chrono::Utc::now().timestamp();
        if existing.expires_at <= now {
            sqlx::query(
                r#"
                UPDATE wallet_funding_quotes
                SET status = 'expired'
                WHERE id = ? AND status = 'invoice_pending'
                "#,
            )
            .bind(quote_id)
            .execute(&mut *tx)
            .await?;

            tx.commit().await?;
            return Err(crate::error::CascadeError::invalid_input(
                "funding quote has expired".to_string(),
            ));
        }

        let metadata_json = metadata_json.map(str::to_string).or(existing.metadata_json);
        sqlx::query(
            r#"
            UPDATE wallet_funding_quotes
            SET status = 'paid',
                metadata_json = ?,
                settled_at = ?
            WHERE id = ? AND status = 'invoice_pending'
            "#,
        )
        .bind(metadata_json)
        .bind(now)
        .bind(quote_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;

        self.get_wallet_funding_quote(quote_id)
            .await?
            .ok_or_else(|| crate::error::CascadeError::invalid_input("funding quote not found"))
    }

    pub async fn create_wallet_funding_request(
        &self,
        request_id: &str,
        pubkey: &str,
        rail: &str,
        amount_minor: u64,
    ) -> Result<WalletFundingRequest> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            INSERT INTO wallet_funding_requests (
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

        self.get_wallet_funding_request(request_id)
            .await?
            .ok_or_else(|| {
                crate::error::CascadeError::database(
                    "wallet funding request missing after insert".to_string(),
                )
            })
    }

    pub async fn get_wallet_funding_request(
        &self,
        request_id: &str,
    ) -> Result<Option<WalletFundingRequest>> {
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
                funding_quote_id,
                created_at,
                updated_at,
                completed_at
            FROM wallet_funding_requests
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
                funding_quote_id,
                created_at,
                updated_at,
                completed_at,
            )| WalletFundingRequest {
                request_id,
                pubkey,
                rail,
                amount_minor: amount_minor.max(0) as u64,
                status: status
                    .parse()
                    .unwrap_or(WalletFundingRequestStatus::Pending),
                error_message,
                funding_quote_id,
                created_at,
                updated_at,
                completed_at,
            },
        ))
    }

    pub async fn fail_wallet_funding_request(
        &self,
        request_id: &str,
        error_message: &str,
    ) -> Result<Option<WalletFundingRequest>> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE wallet_funding_requests
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

        self.get_wallet_funding_request(request_id).await
    }

    pub async fn create_usdc_deposit_intent(
        &self,
        pubkey: &str,
        provider: Option<&str>,
        network: &str,
        asset: &str,
        destination_address: &str,
        requested_wallet_amount_minor: Option<u64>,
        expires_at: Option<i64>,
        metadata_json: Option<&str>,
    ) -> Result<UsdcDepositIntent> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        sqlx::query(
            r#"
            INSERT INTO usdc_deposit_intents (
                id,
                pubkey,
                provider,
                network,
                asset,
                destination_address,
                requested_wallet_amount_minor,
                status,
                metadata_json,
                created_at,
                expires_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
            "#,
        )
        .bind(&id)
        .bind(pubkey)
        .bind(provider)
        .bind(network)
        .bind(asset)
        .bind(destination_address)
        .bind(requested_wallet_amount_minor.map(|value| value as i64))
        .bind(metadata_json)
        .bind(now)
        .bind(expires_at)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_deposit_intent(&id).await?.ok_or_else(|| {
            crate::error::CascadeError::database(
                "USDC deposit intent missing after insert".to_string(),
            )
        })
    }

    pub async fn get_usdc_deposit_intent(
        &self,
        intent_id: &str,
    ) -> Result<Option<UsdcDepositIntent>> {
        let row = sqlx::query(
            r#"
            SELECT
                id,
                pubkey,
                provider,
                provider_session_id,
                provider_redirect_url,
                network,
                asset,
                destination_address,
                requested_wallet_amount_minor,
                received_asset_units,
                onchain_tx_id,
                status,
                metadata_json,
                created_at,
                expires_at,
                confirmed_at,
                credited_at
            FROM usdc_deposit_intents
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(intent_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(|row| UsdcDepositIntent {
            id: row.get::<String, _>("id"),
            pubkey: row.get::<String, _>("pubkey"),
            provider: row.get::<Option<String>, _>("provider"),
            provider_session_id: row.get::<Option<String>, _>("provider_session_id"),
            provider_redirect_url: row.get::<Option<String>, _>("provider_redirect_url"),
            network: row.get::<String, _>("network"),
            asset: row.get::<String, _>("asset"),
            destination_address: row.get::<String, _>("destination_address"),
            requested_wallet_amount_minor: row
                .get::<Option<i64>, _>("requested_wallet_amount_minor")
                .map(|value| value.max(0) as u64),
            received_asset_units: row
                .get::<Option<i64>, _>("received_asset_units")
                .map(|value| value.max(0) as u64),
            onchain_tx_id: row.get::<Option<String>, _>("onchain_tx_id"),
            status: row
                .get::<String, _>("status")
                .parse()
                .unwrap_or(UsdcDepositIntentStatus::Pending),
            metadata_json: row.get::<Option<String>, _>("metadata_json"),
            created_at: row.get::<i64, _>("created_at"),
            expires_at: row.get::<Option<i64>, _>("expires_at"),
            confirmed_at: row.get::<Option<i64>, _>("confirmed_at"),
            credited_at: row.get::<Option<i64>, _>("credited_at"),
        }))
    }

    pub async fn set_usdc_deposit_intent_provider_session(
        &self,
        intent_id: &str,
        provider: Option<&str>,
        provider_session_id: Option<&str>,
        provider_redirect_url: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcDepositIntent>> {
        let Some(existing) = self.get_usdc_deposit_intent(intent_id).await? else {
            return Ok(None);
        };
        if existing.status != UsdcDepositIntentStatus::Pending {
            return Ok(Some(existing));
        }

        sqlx::query(
            r#"
            UPDATE usdc_deposit_intents
            SET provider = COALESCE(?, provider),
                provider_session_id = COALESCE(?, provider_session_id),
                provider_redirect_url = COALESCE(?, provider_redirect_url),
                metadata_json = COALESCE(?, metadata_json)
            WHERE id = ? AND status = 'pending'
            "#,
        )
        .bind(provider)
        .bind(provider_session_id)
        .bind(provider_redirect_url)
        .bind(metadata_json)
        .bind(intent_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_deposit_intent(intent_id).await
    }

    pub async fn confirm_usdc_deposit_intent(
        &self,
        intent_id: &str,
        onchain_tx_id: &str,
        received_asset_units: u64,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcDepositIntent>> {
        let Some(existing) = self.get_usdc_deposit_intent(intent_id).await? else {
            return Ok(None);
        };
        if matches!(
            existing.status,
            UsdcDepositIntentStatus::Confirmed | UsdcDepositIntentStatus::Credited
        ) {
            return Ok(Some(existing));
        }
        if existing.status != UsdcDepositIntentStatus::Pending {
            return Ok(Some(existing));
        }

        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE usdc_deposit_intents
            SET onchain_tx_id = ?,
                received_asset_units = ?,
                status = 'confirmed',
                metadata_json = COALESCE(?, metadata_json),
                confirmed_at = ?
            WHERE id = ? AND status = 'pending'
            "#,
        )
        .bind(onchain_tx_id)
        .bind(received_asset_units as i64)
        .bind(metadata_json)
        .bind(now)
        .bind(intent_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_deposit_intent(intent_id).await
    }

    pub async fn credit_usdc_deposit_intent(
        &self,
        intent_id: &str,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcDepositIntent>> {
        let Some(existing) = self.get_usdc_deposit_intent(intent_id).await? else {
            return Ok(None);
        };
        if existing.status == UsdcDepositIntentStatus::Credited {
            return Ok(Some(existing));
        }
        if existing.status != UsdcDepositIntentStatus::Confirmed {
            return Ok(Some(existing));
        }

        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE usdc_deposit_intents
            SET status = 'credited',
                metadata_json = COALESCE(?, metadata_json),
                credited_at = ?
            WHERE id = ? AND status = 'confirmed'
            "#,
        )
        .bind(metadata_json)
        .bind(now)
        .bind(intent_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_deposit_intent(intent_id).await
    }

    pub async fn expire_usdc_deposit_intent(
        &self,
        intent_id: &str,
    ) -> Result<Option<UsdcDepositIntent>> {
        let Some(existing) = self.get_usdc_deposit_intent(intent_id).await? else {
            return Ok(None);
        };
        if existing.status != UsdcDepositIntentStatus::Pending {
            return Ok(Some(existing));
        }

        sqlx::query(
            r#"
            UPDATE usdc_deposit_intents
            SET status = 'expired'
            WHERE id = ? AND status = 'pending'
            "#,
        )
        .bind(intent_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_deposit_intent(intent_id).await
    }

    pub async fn create_usdc_withdrawal(
        &self,
        request_id: Option<&str>,
        pubkey: &str,
        provider: Option<&str>,
        network: &str,
        asset: &str,
        destination_address: &str,
        wallet_amount_minor: u64,
        asset_units: u64,
        metadata_json: Option<&str>,
    ) -> Result<UsdcWithdrawal> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().timestamp();

        sqlx::query(
            r#"
            INSERT INTO usdc_withdrawals (
                id,
                request_id,
                pubkey,
                provider,
                network,
                asset,
                destination_address,
                wallet_amount_minor,
                asset_units,
                status,
                metadata_json,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
            "#,
        )
        .bind(&id)
        .bind(request_id)
        .bind(pubkey)
        .bind(provider)
        .bind(network)
        .bind(asset)
        .bind(destination_address)
        .bind(wallet_amount_minor as i64)
        .bind(asset_units as i64)
        .bind(metadata_json)
        .bind(now)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_withdrawal(&id).await?.ok_or_else(|| {
            crate::error::CascadeError::database("USDC withdrawal missing after insert".to_string())
        })
    }

    pub async fn get_usdc_withdrawal(&self, withdrawal_id: &str) -> Result<Option<UsdcWithdrawal>> {
        let row = sqlx::query(
            r#"
            SELECT
                id,
                request_id,
                pubkey,
                provider,
                provider_payout_id,
                network,
                asset,
                destination_address,
                wallet_amount_minor,
                asset_units,
                onchain_tx_id,
                status,
                error_message,
                change_signatures_json,
                metadata_json,
                created_at,
                submitted_at,
                completed_at,
                failed_at
            FROM usdc_withdrawals
            WHERE id = ?
            LIMIT 1
            "#,
        )
        .bind(withdrawal_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(usdc_withdrawal_from_row))
    }

    pub async fn get_usdc_withdrawal_by_request_id(
        &self,
        request_id: &str,
    ) -> Result<Option<UsdcWithdrawal>> {
        let row = sqlx::query(
            r#"
            SELECT
                id,
                request_id,
                pubkey,
                provider,
                provider_payout_id,
                network,
                asset,
                destination_address,
                wallet_amount_minor,
                asset_units,
                onchain_tx_id,
                status,
                error_message,
                change_signatures_json,
                metadata_json,
                created_at,
                submitted_at,
                completed_at,
                failed_at
            FROM usdc_withdrawals
            WHERE request_id = ?
            LIMIT 1
            "#,
        )
        .bind(request_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(row.map(usdc_withdrawal_from_row))
    }

    pub async fn set_usdc_withdrawal_change_signatures(
        &self,
        withdrawal_id: &str,
        change_signatures_json: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcWithdrawal>> {
        let Some(existing) = self.get_usdc_withdrawal(withdrawal_id).await? else {
            return Ok(None);
        };

        if matches!(
            existing.status,
            UsdcWithdrawalStatus::Completed | UsdcWithdrawalStatus::Cancelled
        ) {
            return Ok(Some(existing));
        }

        sqlx::query(
            r#"
            UPDATE usdc_withdrawals
            SET change_signatures_json = COALESCE(?, change_signatures_json),
                metadata_json = COALESCE(?, metadata_json)
            WHERE id = ?
            "#,
        )
        .bind(change_signatures_json)
        .bind(metadata_json)
        .bind(withdrawal_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_withdrawal(withdrawal_id).await
    }

    pub async fn submit_usdc_withdrawal(
        &self,
        withdrawal_id: &str,
        provider: Option<&str>,
        provider_payout_id: Option<&str>,
        onchain_tx_id: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcWithdrawal>> {
        let Some(existing) = self.get_usdc_withdrawal(withdrawal_id).await? else {
            return Ok(None);
        };
        if matches!(
            existing.status,
            UsdcWithdrawalStatus::Submitted | UsdcWithdrawalStatus::Completed
        ) {
            return Ok(Some(existing));
        }
        if existing.status != UsdcWithdrawalStatus::Pending {
            return Ok(Some(existing));
        }

        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE usdc_withdrawals
            SET provider = COALESCE(?, provider),
                provider_payout_id = COALESCE(?, provider_payout_id),
                onchain_tx_id = COALESCE(?, onchain_tx_id),
                status = 'submitted',
                metadata_json = COALESCE(?, metadata_json),
                submitted_at = ?
            WHERE id = ? AND status = 'pending'
            "#,
        )
        .bind(provider)
        .bind(provider_payout_id)
        .bind(onchain_tx_id)
        .bind(metadata_json)
        .bind(now)
        .bind(withdrawal_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_withdrawal(withdrawal_id).await
    }

    pub async fn complete_usdc_withdrawal(
        &self,
        withdrawal_id: &str,
        onchain_tx_id: Option<&str>,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcWithdrawal>> {
        let Some(existing) = self.get_usdc_withdrawal(withdrawal_id).await? else {
            return Ok(None);
        };
        if existing.status == UsdcWithdrawalStatus::Completed {
            return Ok(Some(existing));
        }
        if !matches!(
            existing.status,
            UsdcWithdrawalStatus::Pending | UsdcWithdrawalStatus::Submitted
        ) {
            return Ok(Some(existing));
        }

        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE usdc_withdrawals
            SET onchain_tx_id = COALESCE(?, onchain_tx_id),
                status = 'completed',
                metadata_json = COALESCE(?, metadata_json),
                completed_at = ?
            WHERE id = ? AND status IN ('pending', 'submitted')
            "#,
        )
        .bind(onchain_tx_id)
        .bind(metadata_json)
        .bind(now)
        .bind(withdrawal_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_withdrawal(withdrawal_id).await
    }

    pub async fn fail_usdc_withdrawal(
        &self,
        withdrawal_id: &str,
        error_message: &str,
        metadata_json: Option<&str>,
    ) -> Result<Option<UsdcWithdrawal>> {
        let Some(existing) = self.get_usdc_withdrawal(withdrawal_id).await? else {
            return Ok(None);
        };
        if matches!(
            existing.status,
            UsdcWithdrawalStatus::Completed | UsdcWithdrawalStatus::Cancelled
        ) {
            return Ok(Some(existing));
        }
        if existing.status == UsdcWithdrawalStatus::Failed {
            return Ok(Some(existing));
        }

        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE usdc_withdrawals
            SET status = 'failed',
                error_message = ?,
                metadata_json = COALESCE(?, metadata_json),
                failed_at = ?
            WHERE id = ? AND status IN ('pending', 'submitted')
            "#,
        )
        .bind(error_message)
        .bind(metadata_json)
        .bind(now)
        .bind(withdrawal_id)
        .execute(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        self.get_usdc_withdrawal(withdrawal_id).await
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
                response_json,
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
                response_json,
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
                response_json,
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
        response_json: Option<&str>,
    ) -> Result<Option<TradeExecutionRequest>> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            UPDATE trade_execution_requests
            SET status = 'complete',
                trade_id = ?,
                response_json = ?,
                error_message = NULL,
                updated_at = ?,
                completed_at = ?
            WHERE request_id = ?
            "#,
        )
        .bind(trade_id)
        .bind(response_json)
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

        Self::store_fx_quote_snapshot_tx(&mut tx, fx_quote).await?;

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
    pub async fn apply_trade_execution_snapshots(
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

    fn test_fx_quote_snapshot(id: &str) -> FxQuoteSnapshot {
        let now = chrono::Utc::now().timestamp();
        FxQuoteSnapshot {
            id: id.to_string(),
            amount_minor: 2_500,
            amount_msat: 50_505_051,
            btc_usd_price: 49_500.0,
            reference_btc_usd_price: 50_000.0,
            source: "coinbase,kraken,bitstamp".to_string(),
            spread_bps: 400,
            observations: vec![
                FxQuoteObservation {
                    source: "coinbase".to_string(),
                    btc_usd_price: 49_900.0,
                    observed_at: now,
                },
                FxQuoteObservation {
                    source: "kraken".to_string(),
                    btc_usd_price: 50_000.0,
                    observed_at: now,
                },
                FxQuoteObservation {
                    source: "bitstamp".to_string(),
                    btc_usd_price: 50_100.0,
                    observed_at: now,
                },
            ],
            source_metadata: FxQuoteSourceMetadata {
                combination_policy: "median_non_stale_major_providers_v1".to_string(),
                quote_direction: crate::product::FxQuoteDirection::UsdToMsat,
                provider_count: 3,
                minimum_provider_count: 2,
                execution_spread_bps: 100,
                max_observation_age_seconds: 60,
                fallback_used: false,
            },
            created_at: now,
            expires_at: now + 30,
        }
    }

    async fn insert_test_market_row(db: &CascadeDatabase, event_id: &str) {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            r#"
            INSERT INTO markets (
                event_id,
                slug,
                title,
                description,
                b,
                q_long,
                q_short,
                reserve_sats,
                status,
                creator_pubkey,
                created_at,
                long_keyset_id,
                short_keyset_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(event_id)
        .bind(format!("market-{event_id}"))
        .bind("Test Market")
        .bind("A test market")
        .bind(10.0)
        .bind(100.0)
        .bind(100.0)
        .bind(10_000_i64)
        .bind("Active")
        .bind("creator-pubkey")
        .bind(now)
        .bind("long-keyset")
        .bind("short-keyset")
        .execute(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))
        .unwrap();
    }

    #[tokio::test]
    async fn test_wallet_funding_quote_persists_fx_source_metadata() {
        let db = create_test_db().await;
        let fx_quote = test_fx_quote_snapshot("fx-wallet-1");

        let funding_quote = db
            .create_wallet_funding_quote(
                Some("funding-1"),
                "pubkey-1",
                "lightning",
                fx_quote.amount_minor,
                fx_quote.amount_msat,
                Some("lnbc1walletfunding"),
                Some("payment-hash-1"),
                None,
                None,
                &fx_quote,
            )
            .await
            .unwrap();

        assert_eq!(funding_quote.fx_quote_id, fx_quote.id);

        let stored = db
            .get_fx_quote_snapshot(&funding_quote.fx_quote_id)
            .await
            .unwrap()
            .unwrap();

        assert_eq!(stored.btc_usd_price, fx_quote.btc_usd_price);
        assert_eq!(
            stored.reference_btc_usd_price,
            fx_quote.reference_btc_usd_price
        );
        assert_eq!(
            stored.source_metadata.combination_policy,
            fx_quote.source_metadata.combination_policy
        );
        assert_eq!(
            stored.source_metadata.execution_spread_bps,
            fx_quote.source_metadata.execution_spread_bps
        );
        assert_eq!(stored.observations.len(), fx_quote.observations.len());
    }

    #[tokio::test]
    async fn test_trade_quote_snapshot_reuses_existing_fx_snapshot_id() {
        let db = create_test_db().await;
        let fx_quote = test_fx_quote_snapshot("fx-shared-1");

        db.create_wallet_funding_quote(
            Some("funding-shared-1"),
            "pubkey-1",
            "lightning",
            fx_quote.amount_minor,
            fx_quote.amount_msat,
            Some("lnbc1sharedfunding"),
            Some("payment-hash-shared-1"),
            None,
            None,
            &fx_quote,
        )
        .await
        .unwrap();

        insert_test_market_row(&db, "event-fx-shared-1").await;

        let trade_quote = db
            .create_trade_quote_snapshot(
                "event-fx-shared-1",
                "buy",
                "yes",
                &fx_quote,
                2_500,
                25,
                2_475,
                2_500,
                50_505_051,
                505,
                2.5,
                990_000,
                500_000,
                501_000,
                500_000,
                500_000,
                100.0,
                100.0,
                10_000,
                chrono::Utc::now().timestamp() + 30,
            )
            .await
            .unwrap();

        assert_eq!(trade_quote.fx_quote_id, fx_quote.id);

        let stored = db
            .get_fx_quote_snapshot(&fx_quote.id)
            .await
            .unwrap()
            .unwrap();
        assert_eq!(
            stored.reference_btc_usd_price,
            fx_quote.reference_btc_usd_price
        );
        assert_eq!(
            stored.source_metadata.execution_spread_bps,
            fx_quote.source_metadata.execution_spread_bps
        );
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
