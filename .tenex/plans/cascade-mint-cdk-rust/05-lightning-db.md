# Section 5: Lightning Integration & Database Schema

## Overview

This section covers the LND Lightning integration (for depositing sats into the mint and withdrawing sats out) and the complete database schema (both CDK-managed tables and Cascade-specific tables).

## Lightning Integration (LND)

### How It Works

CDK's `cdk-lnd` crate provides `LndMintPayment` which implements the `MintPayment` trait. This handles:
- **NUT-04 (Mint)**: Generate Lightning invoice → user pays → mint issues sat tokens
- **NUT-05 (Melt)**: User submits sat tokens + Lightning invoice → mint pays invoice → tokens destroyed

The mint operator runs an LND node (testnet initially). The mint binary connects to LND via gRPC.

### LND Setup (prerequisite, not built by us)

The operator must have a running LND node. For testnet:

```bash
# LND must be running with REST/gRPC enabled
# Typical config in ~/.lnd/lnd.conf:
[Bitcoin]
bitcoin.active=1
bitcoin.testnet=1
bitcoin.node=bitcoind

[protocol]
protocol.wumbo-channels=false
```

Required files from LND:
- `tls.cert` — TLS certificate for gRPC connection
- `admin.macaroon` — Authentication macaroon (use `invoice.macaroon` + `router.macaroon` for least-privilege in production)

### CDK LND Integration Code

This requires minimal custom code — CDK handles it:

```rust
// In main.rs initialization:

use cdk_lnd::LndMintPayment;

let lnd = LndMintPayment::new(
    format!("{}:{}", config.lnd.host, config.lnd.port),
    config.lnd.cert_path.clone(),
    config.lnd.macaroon_path.clone(),
).await?;

// Verify LND connection
tracing::info!("Connected to LND: checking balance...");
// LND connection errors surface here — fail fast with clear message
```

The `lnd` instance is passed to `MintBuilder::add_payment_processor()` as shown in Section 2.

### Lightning Flow: Depositing Sats

1. Frontend calls `wallet.deposit(amount, mintUrl)` (via NDKCashuWallet)
2. Under the hood, `@cashu/cashu-ts` calls:
   - `POST /v1/mint/quote/bolt11` with `{amount: 1000, unit: "sat"}`
   - Mint creates LND invoice via `lnd.create_invoice(amount)`
   - Returns `{quote: "quote_id", request: "lnbc1000n...", state: "UNPAID"}`
3. Frontend shows invoice to user (or auto-pays from another wallet)
4. User pays Lightning invoice
5. CDK polls LND for payment (or uses invoice subscription)
6. Frontend calls `POST /v1/mint/bolt11` with `{quote: "quote_id", outputs: [blinded_messages]}`
7. Mint verifies invoice is paid, blind-signs the outputs, returns signatures
8. Frontend unblinds to get sat tokens

### Lightning Flow: Withdrawing Sats

1. User wants to withdraw sats from mint
2. Frontend calls `POST /v1/melt/quote/bolt11` with `{request: "lnbc...", unit: "sat"}`
3. Mint checks the Lightning invoice amount
4. Returns `{quote: "quote_id", amount: 1000, fee_reserve: 10, state: "UNPAID"}`
5. Frontend calls `POST /v1/melt/bolt11` with `{quote: "quote_id", inputs: [proofs]}`
6. Mint verifies proofs, pays Lightning invoice via LND
7. Returns `{state: "PAID", paid: true}`

### LND Configuration File

In the `crates/cascade-mint/src/config.rs` (from Section 2):

```rust
pub struct LndSettings {
    pub host: String,           // "127.0.0.1"
    pub port: u16,              // 10009
    pub cert_path: String,      // "/home/user/.lnd/tls.cert"
    pub macaroon_path: String,  // "/home/user/.lnd/data/chain/bitcoin/testnet/admin.macaroon"
}
```

### LND Health Check

Add a startup health check to verify LND connectivity:

```rust
/// Verify LND is reachable and on the expected network
async fn verify_lnd_connection(lnd: &LndMintPayment, expected_network: &str) -> anyhow::Result<()> {
    // 1. Call GetInfo to verify connection
    // 2. Check network matches expected (testnet/mainnet)
    // 3. Check synced_to_chain == true
    // 4. Log LND version and alias
    //
    // If any check fails, return error with clear remediation steps
}
```

---

## Database Schema

### CDK-Managed Tables (do NOT create manually)

`cdk-sqlite`'s `MintSqliteDatabase::new()` automatically creates and migrates these tables:

| Table | Purpose |
|-------|---------|
| `keyset` | Keyset metadata (id, unit, active, derivation_path_index) |
| `mint_quote` | NUT-04 mint quotes (Lightning invoices for deposits) |
| `melt_quote` | NUT-05 melt quotes (Lightning payments for withdrawals) |
| `proof` | All proofs (blinded/unblinded) with state (unspent/spent/pending) |
| `blind_signature` | Signed blinded messages |
| `config` | Mint configuration key-value store |

CDK handles all CRUD operations on these tables. **Do not modify or query them directly** — use CDK's Rust API.

### Cascade-Specific Tables

These are **additional** tables in the **same SQLite database file** for Cascade business logic. Managed via `sqlx` migrations.

### `migrations/001_cascade_tables.sql`
- **Action**: create
- **What**: SQL migration creating all Cascade-specific tables
- **Why**: Per-market LMSR state, trade history, and resolution data need persistence

```sql
-- Prediction markets
CREATE TABLE IF NOT EXISTS markets (
    slug            TEXT PRIMARY KEY,           -- d-tag from kind 982 event
    event_id        TEXT NOT NULL UNIQUE,       -- Nostr event ID (hex)
    title           TEXT NOT NULL,
    description     TEXT NOT NULL DEFAULT '',
    b               REAL NOT NULL DEFAULT 0.0001,  -- LMSR sensitivity
    q_long          REAL NOT NULL DEFAULT 0.0,     -- Outstanding LONG quantity
    q_short         REAL NOT NULL DEFAULT 0.0,     -- Outstanding SHORT quantity
    reserve_sats    INTEGER NOT NULL DEFAULT 0,    -- Total sats backing market
    status          TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'resolved', 'archived')),
    resolution_outcome TEXT CHECK(resolution_outcome IN ('LONG', 'SHORT', NULL)),
    creator_pubkey  TEXT NOT NULL,              -- hex pubkey of market creator
    long_keyset_id  TEXT NOT NULL,              -- CDK keyset ID for LONG unit
    short_keyset_id TEXT NOT NULL,              -- CDK keyset ID for SHORT unit
    created_at      INTEGER NOT NULL,           -- Unix timestamp
    resolved_at     INTEGER,                    -- Unix timestamp (NULL if not resolved)
    updated_at      INTEGER NOT NULL            -- Unix timestamp
);

CREATE INDEX idx_markets_status ON markets(status);
CREATE INDEX idx_markets_event_id ON markets(event_id);
CREATE INDEX idx_markets_creator ON markets(creator_pubkey);

-- Trade history (for analytics and audit trail)
CREATE TABLE IF NOT EXISTS trades (
    id              TEXT PRIMARY KEY,           -- UUID
    market_slug     TEXT NOT NULL REFERENCES markets(slug),
    side            TEXT NOT NULL CHECK(side IN ('LONG', 'SHORT')),
    direction       TEXT NOT NULL CHECK(direction IN ('buy', 'sell', 'payout')),
    amount          REAL NOT NULL,             -- Token amount
    cost_sats       INTEGER NOT NULL,          -- Sat cost/refund before fee
    fee_sats        INTEGER NOT NULL,          -- Fee charged
    total_sats      INTEGER NOT NULL,          -- Total sats moved
    q_long_before   REAL NOT NULL,             -- LMSR state before trade
    q_short_before  REAL NOT NULL,
    q_long_after    REAL NOT NULL,             -- LMSR state after trade
    q_short_after   REAL NOT NULL,
    created_at      INTEGER NOT NULL           -- Unix timestamp
);

CREATE INDEX idx_trades_market ON trades(market_slug);
CREATE INDEX idx_trades_created ON trades(created_at);

-- LMSR state snapshots (for time-series price history)
CREATE TABLE IF NOT EXISTS lmsr_snapshots (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    market_slug     TEXT NOT NULL REFERENCES markets(slug),
    q_long          REAL NOT NULL,
    q_short         REAL NOT NULL,
    price_long      REAL NOT NULL,
    price_short     REAL NOT NULL,
    reserve_sats    INTEGER NOT NULL,
    snapshot_at     INTEGER NOT NULL           -- Unix timestamp
);

CREATE INDEX idx_snapshots_market ON lmsr_snapshots(market_slug);
CREATE INDEX idx_snapshots_time ON lmsr_snapshots(snapshot_at);
```

### `crates/cascade-core/src/db.rs` (new file, add to cascade-core)
- **Action**: create (add to `lib.rs` module list)
- **What**: Cascade database layer — CRUD operations for markets, trades, snapshots
- **Why**: Clean abstraction over sqlx queries, used by MarketManager and TradeExecutor

```rust
pub struct CascadeDatabase {
    pool: SqlitePool,
}

impl CascadeDatabase {
    /// Connect to SQLite database (same file as CDK's database)
    pub async fn new(db_path: &str) -> Result<Self, sqlx::Error> {
        let pool = SqlitePool::connect(&format!("sqlite:{}?mode=rwc", db_path)).await?;
        Ok(Self { pool })
    }

    /// Run Cascade-specific migrations
    pub async fn run_migrations(&self) -> Result<(), sqlx::Error> {
        sqlx::migrate!("../../migrations")
            .run(&self.pool)
            .await?;
        Ok(())
    }

    // --- Market CRUD ---

    pub async fn insert_market(&self, market: &Market) -> Result<(), sqlx::Error> { ... }

    pub async fn get_market(&self, slug: &str) -> Result<Option<Market>, sqlx::Error> { ... }

    pub async fn get_market_by_event_id(&self, event_id: &str) -> Result<Option<Market>, sqlx::Error> { ... }

    pub async fn list_markets(&self, status: Option<MarketStatus>) -> Result<Vec<Market>, sqlx::Error> { ... }

    pub async fn update_market_lmsr(
        &self,
        slug: &str,
        q_long: f64,
        q_short: f64,
        reserve_sats: u64,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "UPDATE markets SET q_long = ?, q_short = ?, reserve_sats = ?, updated_at = ? WHERE slug = ?"
        )
        .bind(q_long)
        .bind(q_short)
        .bind(reserve_sats as i64)
        .bind(chrono::Utc::now().timestamp())
        .bind(slug)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn resolve_market(
        &self,
        slug: &str,
        outcome: Side,
    ) -> Result<(), sqlx::Error> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query(
            "UPDATE markets SET status = 'resolved', resolution_outcome = ?, resolved_at = ?, updated_at = ? WHERE slug = ?"
        )
        .bind(outcome.as_str())
        .bind(now)
        .bind(now)
        .bind(slug)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    // --- Trade History ---

    pub async fn insert_trade(&self, trade: &TradeRecord) -> Result<(), sqlx::Error> { ... }

    pub async fn list_trades(&self, market_slug: &str) -> Result<Vec<TradeRecord>, sqlx::Error> { ... }

    // --- LMSR Snapshots ---

    pub async fn insert_snapshot(&self, snapshot: &LmsrSnapshot) -> Result<(), sqlx::Error> { ... }

    pub async fn get_price_history(
        &self,
        market_slug: &str,
        since: i64,
    ) -> Result<Vec<LmsrSnapshot>, sqlx::Error> { ... }
}
```

### Database Sharing Strategy

CDK's `MintSqliteDatabase` and Cascade's `CascadeDatabase` both point to the **same SQLite file** (`cascade_mint.db`). This is safe because:
1. CDK uses its own table names (keyset, proof, etc.) — no naming conflicts
2. SQLite handles concurrent read/write from the same process via WAL mode
3. Cascade migrations check `IF NOT EXISTS` to be idempotent

Enable WAL mode for better concurrent performance:

```sql
-- Run on database initialization
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA foreign_keys=ON;
```

## File Changes Summary

| File | Action | Purpose |
|------|--------|---------|
| `crates/cascade-core/src/db.rs` | create | Database CRUD layer |
| `crates/cascade-core/src/lib.rs` | modify | Add `pub mod db;` |
| `migrations/001_cascade_tables.sql` | create | Cascade table definitions |
| `crates/cascade-mint/src/main.rs` | modify | Add LND connection verification |

## Execution Steps

1. **Create migration file** — `migrations/001_cascade_tables.sql` with all table definitions
   - Verify: `sqlite3 :memory: < migrations/001_cascade_tables.sql` succeeds

2. **Implement `db.rs`** — CascadeDatabase with all CRUD operations
   - Verify: Unit tests with in-memory SQLite — insert/get/update/list markets

3. **Implement LND health check** — Startup verification of LND connectivity
   - Verify: Clear error message when LND is not running

4. **Wire database initialization in `main.rs`** — Both CDK and Cascade databases
   - Verify: Binary starts, creates `cascade_mint.db` with all tables (CDK + Cascade)

5. **Test concurrent database access** — Verify CDK operations and Cascade operations don't deadlock
   - Verify: Concurrent mint quote + market creation succeeds
