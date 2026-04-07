//! Database persistence layer using SQLite

use crate::error::Result;
use crate::market::{Market, MarketStatus};
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
            .map_err(|e| crate::error::CascadeError::database(format!("Invalid URL: {}", e)))?
            .pragma("foreign_keys", "true"); // Enable foreign key constraints

        let pool = SqlitePool::connect_with(connect_options)
            .await
            .map_err(|e| crate::error::CascadeError::database(format!("Connection failed: {}", e)))?;

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

        Ok(row.map(|(event_id, slug, title, description, b, q_long, q_short, reserve_sats, _status, resolution_outcome, creator_pubkey, created_at, resolved_at, long_keyset_id, short_keyset_id)| {
            Market {
                event_id,
                slug,
                title,
                description,
                b,
                q_long,
                q_short,
                reserve_sats: reserve_sats as u64,
                status: MarketStatus::Active, // TODO: parse from string
                resolution_outcome: resolution_outcome.and_then(|s| s.parse().ok()),
                creator_pubkey,
                created_at,
                long_keyset_id,
                short_keyset_id,
                resolved_at,
            }
        }))
    }

    /// List all markets
    pub async fn list_markets(&self) -> Result<Vec<Market>> {
        let rows = sqlx::query_as::<_, (String, String, String, String, f64, f64, f64, i64, String, Option<String>, String, i64, Option<i64>, String, String)>(
            "SELECT event_id, slug, title, description, b, q_long, q_short, reserve_sats, status, resolution_outcome, creator_pubkey, created_at, resolved_at, long_keyset_id, short_keyset_id FROM markets ORDER BY created_at DESC"
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()))?;

        Ok(rows.into_iter().map(|(event_id, slug, title, description, b, q_long, q_short, reserve_sats, _status, resolution_outcome, creator_pubkey, created_at, resolved_at, long_keyset_id, short_keyset_id)| {
            Market {
                event_id,
                slug,
                title,
                description,
                b,
                q_long,
                q_short,
                reserve_sats: reserve_sats as u64,
                status: MarketStatus::Active, // TODO: parse from string
                resolution_outcome: resolution_outcome.and_then(|s| s.parse().ok()),
                creator_pubkey,
                created_at,
                long_keyset_id,
                short_keyset_id,
                resolved_at,
            }
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
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM markets"
        )
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lightning_escrow_table_exists() {
        let db = create_test_db().await;
        
        // Verify escrow_accounts table exists and can be queried
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM escrow_accounts"
        )
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lightning_orders_table_exists() {
        let db = create_test_db().await;
        
        // Verify lightning_orders table exists
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM lightning_orders"
        )
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_htlcs_table_exists() {
        let db = create_test_db().await;
        
        // Verify htlcs table exists
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM htlcs"
        )
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_lnd_configs_table_exists() {
        let db = create_test_db().await;
        
        // Verify lnd_configs table exists
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM lnd_configs"
        )
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_payment_history_table_exists() {
        let db = create_test_db().await;
        
        // Verify payment_history table exists
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM payment_history"
        )
        .fetch_one(&db.pool)
        .await
        .map_err(|e| crate::error::CascadeError::database(e.to_string()));
        
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_nip47_requests_table_exists() {
        let db = create_test_db().await;
        
        // Verify nip47_requests table exists
        let result: Result<(i64,)> = sqlx::query_as(
            "SELECT COUNT(*) FROM nip47_requests"
        )
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
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='escrow_accounts'"
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
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='lightning_orders'"
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
            "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='htlcs'"
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
            "SELECT id, market_slug, side, amount_sats, state FROM lightning_orders WHERE id = ?"
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
            "#
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
        let result: Result<(String, i64, String)> = sqlx::query_as(
            "SELECT id, amount_msat, status FROM htlcs WHERE id = ?"
        )
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
            "#
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
        let result: Result<(String, String, String, i32)> = sqlx::query_as(
            "SELECT id, name, host, port FROM lnd_configs WHERE id = ?"
        )
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
