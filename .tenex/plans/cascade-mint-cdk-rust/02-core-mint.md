# Section 2: Core Mint — CDK Integration, Signatory, and Per-Market Keysets

## Overview

This section covers the heart of the mint: initializing CDK's `Mint` struct with SQLite persistence, configuring `DbSignatory` for BIP-32 key derivation, and implementing the per-market keyset generation system using CDK's custom currency units.

## File Changes

### `crates/cascade-mint/src/config.rs`
- **Action**: create
- **What**: Configuration types and loading logic
- **Why**: Centralized config used by all components during initialization

```rust
// Key types to define:

/// Top-level configuration loaded from config.toml + env vars
pub struct MintConfig {
    pub mint: MintSettings,
    pub database: DatabaseSettings,
    pub seed: SeedSettings,
    pub lnd: LndSettings,
    pub network: NetworkSettings,
    pub server: ServerSettings,
    pub fees: FeeSettings,
}

pub struct MintSettings {
    pub url: String,       // "https://mint.f7z.io"
    pub name: String,
    pub description: String,
}

pub struct DatabaseSettings {
    pub path: String,      // "./data/cascade_mint.db"
}

pub struct SeedSettings {
    pub path: String,      // "./data/mint_seed.key"
}

pub struct LndSettings {
    pub host: String,
    pub port: u16,
    pub cert_path: String,
    pub macaroon_path: String,
}

pub struct NetworkSettings {
    pub network_type: String,  // "testnet" | "mainnet"
}

pub struct ServerSettings {
    pub host: String,
    pub port: u16,
}

pub struct FeeSettings {
    pub trade_fee_percent: u64,  // Default 1
}
```

**Loading strategy:**
1. Load `config.toml` if present (via `toml` crate)
2. Override with environment variables (via `dotenvy` + `clap` derive)
3. Validate required fields, fail early with clear error messages

**CLI args (via clap derive):**
- `--config <path>` — Config file path (default: `config.toml`)
- `--db-path <path>` — Override database path
- `--listen <host:port>` — Override listen address
- `--network <testnet|mainnet>` — Override network

### `crates/cascade-mint/src/main.rs`
- **Action**: create
- **What**: Entry point that wires together CDK components and starts the server
- **Why**: This is the composition root — all CDK crates are assembled here

**Initialization sequence (pseudocode):**

```rust
#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 1. Initialize logging
    tracing_subscriber::init();

    // 2. Load configuration
    dotenvy::dotenv().ok();
    let config = MintConfig::load()?;

    // 3. Ensure data directory exists
    std::fs::create_dir_all("./data")?;

    // 4. Load or generate master seed
    let seed: [u8; 32] = load_or_generate_seed(&config.seed.path)?;

    // 5. Initialize SQLite database (CDK tables)
    let cdk_db = MintSqliteDatabase::new(&config.database.path).await?;

    // 6. Initialize Cascade-specific tables (via sqlx)
    let cascade_db = CascadeDatabase::new(&config.database.path).await?;
    cascade_db.run_migrations().await?;

    // 7. Initialize LND payment backend
    let lnd = LndMintPayment::new(
        config.lnd.host.clone(),
        config.lnd.port,
        config.lnd.cert_path.clone(),
        config.lnd.macaroon_path.clone(),
    ).await?;

    // 8. Load existing markets from database to determine supported units
    let existing_markets = cascade_db.list_markets().await?;
    let mut supported_units: Vec<CurrencyUnit> = Vec::new();
    for market in &existing_markets {
        supported_units.push(CurrencyUnit::custom(&format!("LONG_{}", market.slug)));
        supported_units.push(CurrencyUnit::custom(&format!("SHORT_{}", market.slug)));
    }

    // 9. Create DbSignatory with custom units
    //    (new markets add units dynamically via rotate_keyset)
    let signatory = DbSignatory::new(
        Arc::new(cdk_db.clone()),
        &seed,
        supported_units.clone(),
        HashMap::new(), // Use default hashed derivation paths
    );

    // 10. Build CDK Mint using MintBuilder
    let sat_unit = CurrencyUnit::Sat;
    let mut builder = MintBuilder::new(Arc::new(cdk_db.clone()))
        .with_name(config.mint.name.clone())
        .with_description(config.mint.description.clone());

    // Configure sat unit for Lightning deposits/withdrawals
    builder = builder
        .configure_unit(sat_unit.clone(), UnitConfig {
            amounts: vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
            input_fee_ppk: 0,
        })
        .add_payment_processor(
            sat_unit.clone(),
            PaymentMethod::Bolt11,
            MintMeltLimits { min: 1, max: 1_000_000 },
            Arc::new(lnd),
        );

    // Configure each market's LONG/SHORT units
    for unit in &supported_units {
        builder = builder.configure_unit(unit.clone(), UnitConfig {
            amounts: vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
            input_fee_ppk: 0, // No per-input fee; LMSR spread handles fees
        });
    }

    let mint = builder.build_with_signatory(Arc::new(signatory)).await?;

    // 11. Create MarketManager
    let market_manager = MarketManager::new(
        Arc::new(mint.clone()),
        Arc::new(cascade_db),
        config.fees.trade_fee_percent,
    );

    // 12. Build HTTP server (CDK standard + Cascade custom routes)
    let app = build_server(mint, market_manager, &config).await?;

    // 13. Start listening
    let addr = format!("{}:{}", config.server.host, config.server.port);
    tracing::info!("Cascade mint listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
```

**Seed management:**

```rust
/// Load seed from file or generate a new one.
/// Seed file is 32 raw bytes (or 64 hex characters, or BIP-39 mnemonic).
fn load_or_generate_seed(path: &str) -> anyhow::Result<[u8; 32]> {
    if Path::new(path).exists() {
        // Read existing seed
        let contents = std::fs::read_to_string(path)?;
        // Support both raw hex and BIP-39 mnemonic
        if contents.trim().contains(' ') {
            // BIP-39 mnemonic
            let mnemonic = bip39::Mnemonic::parse(contents.trim())?;
            Ok(mnemonic.to_seed("")[..32].try_into()?)
        } else {
            // Hex-encoded 32 bytes
            Ok(hex::decode(contents.trim())?[..32].try_into()?)
        }
    } else {
        // Generate new BIP-39 mnemonic and save
        let mnemonic = bip39::Mnemonic::generate(24)?;
        std::fs::write(path, mnemonic.to_string())?;
        tracing::warn!("Generated new mint seed at {}. BACK THIS UP!", path);
        Ok(mnemonic.to_seed("")[..32].try_into()?)
    }
}
```

### `crates/cascade-core/src/lib.rs`
- **Action**: create
- **What**: Module declarations and re-exports
- **Why**: Establishes the public API surface of the core crate

```rust
pub mod market;
pub mod market_manager;
pub mod lmsr;
pub mod trade;
pub mod error;

pub use market::{Market, MarketStatus, Side};
pub use market_manager::MarketManager;
pub use lmsr::LmsrEngine;
pub use trade::TradeExecutor;
pub use error::CascadeError;
```

### `crates/cascade-core/src/market.rs`
- **Action**: create
- **What**: Market type definitions matching the frontend's `Market` type
- **Why**: Canonical representation of prediction markets within the mint

```rust
// Core types (map to frontend src/market.ts):

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Market {
    pub event_id: String,       // Nostr event ID (hex) — canonical identifier
    pub slug: String,           // d-tag from kind 982 event
    pub title: String,
    pub description: String,
    pub b: f64,                 // LMSR sensitivity parameter
    pub q_long: f64,            // Outstanding LONG quantity
    pub q_short: f64,           // Outstanding SHORT quantity
    pub reserve_sats: u64,      // Total sats backing this market
    pub status: MarketStatus,
    pub resolution_outcome: Option<Side>,
    pub creator_pubkey: String, // hex pubkey of market creator
    pub created_at: i64,        // Unix timestamp
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum MarketStatus {
    Active,
    Resolved,
    Archived,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Side {
    Long,   // YES
    Short,  // NO
}

impl Market {
    /// CDK CurrencyUnit for the LONG side of this market
    pub fn long_unit(&self) -> CurrencyUnit {
        CurrencyUnit::custom(&format!("LONG_{}", self.slug))
    }

    /// CDK CurrencyUnit for the SHORT side of this market
    pub fn short_unit(&self) -> CurrencyUnit {
        CurrencyUnit::custom(&format!("SHORT_{}", self.slug))
    }

    /// Get the unit for a given side
    pub fn unit_for_side(&self, side: Side) -> CurrencyUnit {
        match side {
            Side::Long => self.long_unit(),
            Side::Short => self.short_unit(),
        }
    }
}
```

### `crates/cascade-core/src/market_manager.rs`
- **Action**: create
- **What**: Market registry and lifecycle management — creates keysets, tracks markets, coordinates with CDK Mint
- **Why**: Central coordinator between Cascade business logic and CDK's keyset/token system

**Key responsibilities:**
1. **Create market** — Register a new market, generate LONG/SHORT keysets via CDK signatory
2. **Get market** — Look up market by slug or event_id
3. **List markets** — Return all active markets
4. **Update LMSR state** — After trades, update q_long/q_short/reserve
5. **Resolve market** — Set outcome, enable payout for winning side

```rust
pub struct MarketManager {
    mint: Arc<Mint>,
    db: Arc<CascadeDatabase>,
    trade_fee_percent: u64,
}

impl MarketManager {
    pub fn new(
        mint: Arc<Mint>,
        db: Arc<CascadeDatabase>,
        trade_fee_percent: u64,
    ) -> Self { ... }

    /// Create a new prediction market.
    /// Generates LONG and SHORT keysets in CDK by calling rotate_keyset for each unit.
    pub async fn create_market(&self, params: CreateMarketParams) -> Result<Market, CascadeError> {
        // 1. Validate params (slug unique, reserve >= minimum)
        // 2. Create Market struct with initial LMSR state (q_long=0, q_short=0)
        // 3. Generate LONG keyset:
        //    - Call mint signatory to create keyset for CurrencyUnit::custom("LONG_{slug}")
        //    - CDK's DbSignatory automatically derives keys from:
        //      m/{hashed_derivation_index("LONG_{slug}")}'/0'/{keyset_index}'
        // 4. Generate SHORT keyset (same process)
        // 5. Persist market to Cascade database
        // 6. Return market with keyset IDs
    }

    /// Get market by slug
    pub async fn get_market(&self, slug: &str) -> Result<Option<Market>, CascadeError> { ... }

    /// Get market by Nostr event ID
    pub async fn get_market_by_event_id(&self, event_id: &str) -> Result<Option<Market>, CascadeError> { ... }

    /// List all markets, optionally filtered by status
    pub async fn list_markets(&self, status: Option<MarketStatus>) -> Result<Vec<Market>, CascadeError> { ... }

    /// Update LMSR state after a trade
    pub async fn update_lmsr_state(
        &self,
        slug: &str,
        new_q_long: f64,
        new_q_short: f64,
        new_reserve: u64,
    ) -> Result<(), CascadeError> { ... }

    /// Resolve a market — sets outcome, prevents further trading
    pub async fn resolve_market(
        &self,
        slug: &str,
        outcome: Side,
    ) -> Result<Market, CascadeError> {
        // 1. Load market, verify status == Active
        // 2. Set status = Resolved, resolution_outcome = outcome
        // 3. Persist to database
        // 4. Return updated market
        // NOTE: Payout is handled separately — winning token holders
        // melt their tokens to receive sats (standard NUT-05 melt flow)
    }
}

pub struct CreateMarketParams {
    pub event_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub b: f64,                    // LMSR sensitivity (default 0.0001)
    pub initial_reserve_sats: u64, // Minimum ~$100 worth
    pub creator_pubkey: String,
}
```

### `crates/cascade-core/src/error.rs`
- **Action**: create
- **What**: Custom error types for Cascade operations
- **Why**: Clean error propagation from core logic to HTTP responses

```rust
#[derive(Debug, thiserror::Error)]
pub enum CascadeError {
    #[error("Market not found: {slug}")]
    MarketNotFound { slug: String },

    #[error("Market already exists: {slug}")]
    MarketAlreadyExists { slug: String },

    #[error("Market is not active: {slug} (status: {status:?})")]
    MarketNotActive { slug: String, status: MarketStatus },

    #[error("Insufficient reserve: need {required} sats, have {available}")]
    InsufficientReserve { required: u64, available: u64 },

    #[error("Invalid trade: {reason}")]
    InvalidTrade { reason: String },

    #[error("LMSR calculation error: {0}")]
    LmsrError(String),

    #[error("CDK error: {0}")]
    CdkError(#[from] cdk::error::Error),

    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),

    #[error("Internal error: {0}")]
    Internal(#[from] anyhow::Error),
}
```

## CDK Keyset Generation — How It Works

When `MarketManager::create_market()` is called, it needs to create keysets for the new market's LONG and SHORT units. Here's the exact CDK mechanism:

1. **Custom Unit Creation**: `CurrencyUnit::custom("LONG_btc-100k")` creates a unit with an arbitrary string name.

2. **Derivation Index**: CDK's `hashed_derivation_index()` function takes the unit name string, SHA-256 hashes it, and takes the first 4 bytes as a `u32`. This becomes the derivation path index: `m/{hash_u32}'/0'/0'`.

3. **Keyset Registration**: Calling `rotate_keyset` on the signatory with the new unit causes CDK to:
   - Derive the xpriv for the new derivation path
   - Generate public keys for all configured denominations (1, 2, 4, 8, ... 1024)
   - Store the keyset in the SQLite database with a unique keyset ID
   - Make the keyset available via `/v1/keys` and `/v1/keysets` endpoints

4. **Determinism**: Given the same seed and the same unit name string, the exact same keyset is always generated. This means the mint can recover all keysets from just the seed + list of market slugs.

**Keyset ID format**: CDK generates keyset IDs as a hash of the public keys (per NUT-02). The frontend's `getKeysetForSide(market, side)` returns `'{LONG|SHORT}_{market.slug}'` which is the *unit name*, not the keyset ID. The frontend must map unit names to CDK keyset IDs — this is done via the `/v1/keysets` endpoint which returns `{keysets: [{id, unit, active}]}`.

> **IMPORTANT**: The frontend `cashuProofs.ts:getKeysetForSide()` currently returns a string like `"LONG_btc-100k"` — this is used as a *lookup key* to find the right keyset. The actual keyset ID from CDK will be a different string (hex hash). The `/v1/keysets` response includes the `unit` field, so the frontend can filter: `keysets.find(k => k.unit === "LONG_btc-100k")?.id`. This may require a minor frontend update but is outside this plan's scope (mint-side only).

## Execution Steps

1. **Implement `config.rs`** — Config types, TOML loading, env var overrides, CLI parsing with clap
   - Verify: Unit test that loads `.env.example` and `config.toml.example`

2. **Implement `error.rs`** — All error variants with proper `Display` and `From` impls
   - Verify: `cargo check -p cascade-core`

3. **Implement `market.rs`** — Market struct, MarketStatus, Side, unit helper methods
   - Verify: Unit test creating a market and checking `long_unit()` returns correct `CurrencyUnit::custom("LONG_{slug}")`

4. **Implement seed management in `main.rs`** — `load_or_generate_seed()` function
   - Verify: Integration test that generates seed, loads it back, gets same bytes

5. **Implement `market_manager.rs`** — Full market lifecycle (create, get, list, update, resolve)
   - Verify: Integration test with in-memory SQLite — create market, verify keysets appear in CDK signatory

6. **Implement `main.rs` initialization** — Wire together CDK Mint, signatory, database, LND
   - Verify: Binary starts up, connects to LND (or fails gracefully with clear error), `/v1/info` responds
