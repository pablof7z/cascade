# Cashu Mint Implementation Plan for Cascade Phase 2

**Status**: Implementation Blueprint  
**Audience**: Engineering Team, CDK Rust Developers, Cashu Experts  
**Architecture Reference**: `.tenex/plans/cashu-phase2-architecture.md` (locked design decisions)

---

## Context

Cascade Phase 2 deploys a specialized Cashu mint built in **CDK Rust** for binary prediction market trading. The architecture is **pure bearer-token based** — no custodial accounts, no escrow, no special ledgers. 

**Key locked decisions** (from phase 2 architecture):
- **Two keysets per market**: YES keyset + NO keyset (standard Cashu outcome isolation)
- **Pure bearer tokens**: All users share market keysets; tokens are bearer tokens backed by blind signatures
- **LMSR pricing in frontend**: Mint validates prices only
- **Keyset deactivation for outcome isolation**: Losing keyset marked inactive after resolution
- **Rake accumulation**: Stays in mint as liquidity; extracted via melt operations when needed
- **Standard Cashu endpoints**: NUT-06 (mint), NUT-03/04 (swap), NUT-05 (melt) — no custom `/trade` endpoint

**Why this matters**: Mint security, privacy, and simplicity depend on strict adherence to this design. Deviations (e.g., adding per-user escrow accounts, per-user keysets, custom `/trade` endpoint) break the model.

---

## 1. CDK Rust Setup

### 1.1 Project Structure

The mint is implemented as a **single Rust crate** using CDK as the core library.

```
cascade-mint/
├── Cargo.toml                          # CDK + dependencies
├── src/
│   ├── lib.rs                          # Module exports
│   ├── main.rs                         # Entry point (if standalone server)
│   ├── config.rs                       # Environment config (mint URL, Lightning, DB)
│   ├── db/
│   │   ├── mod.rs                      # Database abstraction
│   │   ├── schema.rs                   # SQL migrations, tables
│   │   └── models.rs                   # Rust types for DB rows
│   ├── keysets/
│   │   ├── mod.rs                      # Keyset management
│   │   ├── manager.rs                  # Create, track, deactivate keysets
│   │   └── resolution.rs               # Market resolution + keyset deactivation logic
│   ├── lmsr/
│   │   ├── mod.rs                      # LMSR math module
│   │   ├── pricing.rs                  # Price calculation, slippage
│   │   └── validation.rs               # Validate client-submitted prices
│   ├── lightning/
│   │   ├── mod.rs                      # Lightning integration
│   │   ├── invoice.rs                  # BOLT11 creation, validation
│   │   ├── payment.rs                  # Monitor HTLC, handle payment notifications
│   │   └── lnd_rpc.rs                  # LND/CLN gRPC client wrapper
│   ├── swap/
│   │   ├── mod.rs                      # Swap handler (CDK extension)
│   │   ├── validation.rs               # Proof validation, keyset checks
│   │   ├── lmsr_validator.rs           # Integrate LMSR into swap
│   │   └── execution.rs                # Sign blinded messages, issue tokens
│   ├── rake/
│   │   ├── mod.rs                      # Rake accounting
│   │   ├── accumulation.rs             # Track rake per trade
│   │   └── extraction.rs               # Withdraw rake to operator
│   ├── nostr/
│   │   ├── mod.rs                      # Nostr integration
│   │   ├── client.rs                   # Nostr relay client
│   │   ├── market_sync.rs              # Fetch kind 982 market events
│   │   └── oracle.rs                   # Listen for kind 30023 resolution events
│   ├── api/
│   │   ├── mod.rs                      # API routes
│   │   ├── cashu_routes.rs             # Standard Cashu endpoints (NUT-06, NUT-03/04, NUT-05)
│   │   └── health.rs                   # Health check endpoint
│   ├── error.rs                        # Error types
│   ├── crypto.rs                       # Crypto utilities (RNG, hashing)
│   └── tests/
│       ├── integration_test.rs         # End-to-end tests
│       ├── lmsr_test.rs                # LMSR math tests
│       ├── swap_test.rs                # Swap handler tests
│       ├── lightning_test.rs           # Mocked Lightning tests
│       └── resolution_test.rs          # Market resolution + keyset deactivation
├── migrations/                         # SQL migration files
│   ├── 001_initial_schema.sql
│   ├── 002_keyset_resolution_status.sql
│   └── 003_rake_accounting.sql
└── README.md                           # Build, test, deploy instructions
```

### 1.2 Key Dependencies

**Cargo.toml**:

```toml
[package]
name = "cascade-mint"
version = "0.1.0"
edition = "2021"

[dependencies]
# Cashu
cdk = { path = "../cdk-rust", version = "0.1.0" }  # CDK Rust library
cdk_lightning = { path = "../cdk-rust/cdk_lightning" }

# Web server
actix-web = "4.4"
actix-rt = "2.9"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.35", features = ["full"] }

# Database
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio-rustls", "chrono", "uuid", "json"] }
postgres = "0.19"

# Lightning
tonic = "0.10"  # gRPC for LND/CLN
tonic-build = "0.10"
lightning-invoice = "0.28"

# Nostr
nostr = "0.28"
nostr-sdk = "0.28"
nostr-zap = "0.28"

# Crypto
sha2 = "0.10"
rand = "0.8"

# Utilities
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1.6", features = ["v4", "serde"] }
tracing = "0.1"
tracing-subscriber = "0.3"
dotenv = "0.15"
anyhow = "1.0"
thiserror = "1.0"

[dev-dependencies]
tokio-test = "0.4"
mockito = "1.2"
```

### 1.3 Build & Test Setup

**Build**:
```bash
# Local development
cargo build

# Production release
cargo build --release

# Run tests
cargo test --all
```

**Test Suite**:
- **Unit tests**: Located in `src/*/tests.rs` (inline) or `tests/unit/*.rs`
- **Integration tests**: `tests/integration_test.rs` (full flow: deposit → trade → resolution → claim)
- **Mock Lightning**: Use `mockito` or `wiremock` to stub LND/CLN gRPC
- **Test database**: Use ephemeral PostgreSQL container (Docker) for integration tests

**CI/CD** (GitHub Actions or similar):
```yaml
- Run: cargo test --all
- Run: cargo build --release
- Run: cargo clippy (linting)
- Run: cargo fmt --check (formatting)
```

### 1.4 Development Environment Setup

**Prerequisites**:
- Rust 1.70+
- PostgreSQL 14+
- Docker (for running LND/CLN mock)

**Local setup script** (`scripts/dev-setup.sh`):
```bash
#!/bin/bash
# 1. Install Rust (if needed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 2. Create local PostgreSQL DB
createdb cascade_mint_dev
sqlx database create

# 3. Run migrations
sqlx migrate run

# 4. Start mocked Lightning (optional)
docker run --rm -p 10009:10009 lnd-mock  # Or use mockito in tests

# 5. Build
cargo build

# 6. Run tests
cargo test --all
```

**Environment variables** (`.env.local`):
```
MINT_URL=http://localhost:8080
DATABASE_URL=postgres://user:pass@localhost/cascade_mint_dev
LND_ADDR=127.0.0.1:10009
LND_CERT_PATH=./test-fixtures/lnd.cert
LND_MACAROON_PATH=./test-fixtures/lnd.macaroon
NOSTR_RELAY_URL=wss://relay.example.com
RUST_LOG=debug
```

---

## 2. LMSR Math Implementation

### 2.1 LMSR Formula

The **Logarithmic Market Scoring Rule (LMSR)** is a market prediction mechanism. The cost function is:

```
Cost(qYES, qNO) = b * ln(e^(qYES/b) + e^(qNO/b))
```

Where:
- `qYES` = quantity of YES shares minted
- `qNO` = quantity of NO shares minted
- `b` = market depth parameter (higher = less volatile, deeper liquidity)

**Marginal price of YES** (cost to buy 1 more YES share):

```
P(YES) = e^(qYES/b) / (e^(qYES/b) + e^(qNO/b))
```

This is the probability of YES. Price ranges [0, 1].

**Cost to buy `amount_sats` of YES**:

```
shares_purchased = amount_sats / P(YES)
new_qYES = qYES + shares_purchased
new_price = e^(new_qYES/b) / (e^(new_qYES/b) + e^(qNO/b))
cost_to_user = amount_sats  (user pays sats, receives shares)
```

### 2.2 Implementation in Rust

**File: `src/lmsr/pricing.rs`**

```rust
use std::f64;

/// Market state from kind 982 event
#[derive(Clone, Debug)]
pub struct MarketState {
    pub qyes: f64,        // Quantity of YES shares minted
    pub qno: f64,         // Quantity of NO shares minted
    pub b: f64,           // Market depth parameter
}

/// Compute LMSR price for YES outcome
/// Returns probability: 0.0 (NO highly likely) to 1.0 (YES highly likely)
pub fn compute_lmsr_price(state: &MarketState) -> f64 {
    let exp_yes = (state.qyes / state.b).exp();
    let exp_no = (state.qno / state.b).exp();
    exp_yes / (exp_yes + exp_no)
}

/// Compute shares purchased for given sats spent
/// Assumes user pays `amount_sats` and receives shares at current marginal price
pub fn compute_shares_purchased(
    amount_sats: f64,
    state: &MarketState,
) -> f64 {
    let price = compute_lmsr_price(state);
    amount_sats / price
}

/// Compute new market state after trade
pub fn compute_new_market_state(
    amount_sats: f64,
    outcome: &str,  // "YES" or "NO"
    state: &MarketState,
) -> MarketState {
    let shares = compute_shares_purchased(amount_sats, state);
    
    match outcome {
        "YES" => MarketState {
            qyes: state.qyes + shares,
            qno: state.qno,
            b: state.b,
        },
        "NO" => MarketState {
            qyes: state.qyes,
            qno: state.qno + shares,
            b: state.b,
        },
        _ => panic!("Invalid outcome"),
    }
}

/// Compute slippage as percentage
/// Before trade: price_before
/// After trade: price_after
/// Slippage = (price_before - price_after) / price_before (for YES)
pub fn compute_slippage(
    amount_sats: f64,
    outcome: &str,
    state: &MarketState,
) -> f64 {
    let price_before = compute_lmsr_price(state);
    let new_state = compute_new_market_state(amount_sats, outcome, state);
    let price_after = compute_lmsr_price(&new_state);
    
    (price_before - price_after).abs() / price_before
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lmsr_price_equal_quantities() {
        // When qYES == qNO, price should be 0.5
        let state = MarketState {
            qyes: 100.0,
            qno: 100.0,
            b: 500.0,
        };
        let price = compute_lmsr_price(&state);
        assert!((price - 0.5).abs() < 0.0001);
    }

    #[test]
    fn test_lmsr_price_skewed() {
        // When qYES > qNO, price should be > 0.5
        let state = MarketState {
            qyes: 200.0,
            qno: 100.0,
            b: 500.0,
        };
        let price = compute_lmsr_price(&state);
        assert!(price > 0.5);
    }

    #[test]
    fn test_shares_purchased() {
        let state = MarketState {
            qyes: 100.0,
            qno: 100.0,
            b: 500.0,
        };
        let shares = compute_shares_purchased(50.0, &state);
        // At 0.5 price, 50 sats = 100 shares
        assert!((shares - 100.0).abs() < 0.1);
    }

    #[test]
    fn test_slippage_on_trade() {
        let state = MarketState {
            qyes: 150.0,
            qno: 100.0,
            b: 500.0,
        };
        let slippage = compute_slippage(50.0, "YES", &state);
        // Slippage > 0 because market moves against trader
        assert!(slippage > 0.0);
    }
}
```

### 2.3 Mapping to Token Issuance

When a user buys YES tokens:

1. **Frontend computes**:
   - Current LMSR price from kind 982 state
   - Shares purchased for the sats amount
   - New market state after trade

2. **Frontend creates swap request**:
   - Input: X sats of generic sat proofs
   - Output: Blinded messages for YES keyset
   - Includes: market state, price, outcome

3. **Mint validates**:
   - Proof validity (standard Cashu)
   - Price matches LMSR calculation (see section 2.4)
   - Keyset matches outcome (YES keyset for YES outcome)
   - Issues blind signatures for YES outcome

4. **Frontend unblind**:
   - User receives YES outcome proofs (bearer tokens)

**Example**: User wants $10 worth of YES in Bitcoin market.

- Market state: qYES=150, qNO=100, b=500
- LMSR price: 0.55 (55% probability)
- Sats to spend: 10
- Shares to receive: 10 / 0.55 ≈ 18 shares
- New market state: qYES=168, qNO=100

The user swaps 10 sats for 18 shares (YES outcome proofs worth 18 sats notionally, but only worth something if YES wins).

### 2.4 CDK Integration: LMSR Validation in Swap Handler

**File: `src/swap/lmsr_validator.rs`**

The swap handler (CDK standard endpoint `POST /swap`) is extended with optional LMSR validation:

```rust
use cdk::nuts::SwapRequest;
use anyhow::{anyhow, Result};
use crate::lmsr::pricing::{MarketState, compute_lmsr_price};

/// Validate LMSR parameters in swap request
/// Called by swap handler before signing blinded messages
pub fn validate_lmsr_swap(
    request: &SwapRequest,
    market_state: &MarketState,
    expected_keyset_id: &str,
) -> Result<()> {
    // Extract custom fields from request
    // These would be serialized in the swap request body
    let client_price = request
        .0
        .iter()
        .find_map(|output| {
            // Custom: price field in swap request
            output.metadata.get("price").and_then(|v| v.as_f64())
        })
        .ok_or(anyhow!("Price not provided in swap request"))?;

    let outcome = request
        .0
        .iter()
        .find_map(|output| {
            output.metadata.get("outcome").and_then(|v| v.as_str())
        })
        .ok_or(anyhow!("Outcome not provided"))?;

    let keyset_id = request
        .0
        .iter()
        .find_map(|output| {
            output.metadata.get("keyset_id").and_then(|v| v.as_str())
        })
        .ok_or(anyhow!("Keyset ID not provided"))?;

    // Compute expected price
    let computed_price = compute_lmsr_price(market_state);

    // Allow 0.5% tolerance (slippage acceptable)
    const PRICE_TOLERANCE: f64 = 0.005;
    if (client_price - computed_price).abs() > PRICE_TOLERANCE {
        return Err(anyhow!(
            "Price mismatch: client={}, computed={}",
            client_price,
            computed_price
        ));
    }

    // Verify keyset matches outcome
    if keyset_id != expected_keyset_id {
        return Err(anyhow!("Keyset ID mismatch"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_lmsr_price() {
        let market_state = MarketState {
            qyes: 150.0,
            qno: 100.0,
            b: 500.0,
        };
        let computed = compute_lmsr_price(&market_state);
        assert!((computed - 0.55).abs() < 0.01);
    }

    #[test]
    fn test_price_mismatch_rejected() {
        // If client submits wrong price, validation should fail
        // (Implementation depends on how we serialize custom fields in SwapRequest)
    }
}
```

**Integration with CDK Swap Handler** (`src/swap/execution.rs`):

```rust
use cdk::nuts::SwapRequest;
use cdk::CASHU_KEYSET;
use crate::lmsr::pricing::MarketState;
use crate::swap::lmsr_validator::validate_lmsr_swap;

pub struct SwapHandler {
    // CDK's native swap handler + our custom fields
    cashu_handler: CashuSwapHandler,
}

impl SwapHandler {
    pub fn handle_swap(
        &self,
        request: SwapRequest,
        market_state: Option<&MarketState>,
        keyset_id: Option<&str>,
    ) -> Result<SwapResponse> {
        // 1. Standard Cashu validation (proof verification, denomination checks)
        self.cashu_handler.validate_proofs(&request)?;
        self.cashu_handler.validate_denominations(&request)?;

        // 2. LMSR validation (optional, only if market_state provided)
        if let (Some(state), Some(kid)) = (market_state, keyset_id) {
            validate_lmsr_swap(&request, state, kid)?;
        }

        // 3. Sign blinded messages with correct keyset
        let signatures = self.cashu_handler.sign_blinded_messages(&request)?;

        Ok(SwapResponse {
            signatures,
            // Additional metadata (fee, keyset ID, etc.)
        })
    }
}
```

---

## 3. Multi-Keyset Architecture (YES + NO per Market)

### 3.1 Keyset Creation

When Cascade creates a new market (kind 982 event), the mint creates two keysets:

**File: `src/keysets/manager.rs`**

```rust
use cdk::nuts::Keyset;
use uuid::Uuid;
use anyhow::Result;
use sqlx::PgPool;

pub struct KeysetManager {
    db: PgPool,
    mint_secret: Vec<u8>,  // Mint's master secret (HSM-protected)
}

impl KeysetManager {
    /// Create two keysets for a new market
    /// Called when Cascade publishes kind 982 event
    pub async fn create_market_keysets(
        &self,
        market_id: &str,
    ) -> Result<(Keyset, Keyset)> {
        // Generate unique IDs for YES and NO keysets
        let keyset_yes_id = format!("cascade_yes_{}", market_id);
        let keyset_no_id = format!("cascade_no_{}", market_id);

        // Derive keypair from mint secret (deterministic)
        let keyset_yes_secret = derive_keyset_secret(&self.mint_secret, &keyset_yes_id)?;
        let keyset_no_secret = derive_keyset_secret(&self.mint_secret, &keyset_no_id)?;

        // Create Cashu keysets with standard denominations
        let keyset_yes = Keyset::new(
            keyset_yes_id.clone(),
            keyset_yes_secret,
            vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],  // Power-of-2 denominations
        )?;

        let keyset_no = Keyset::new(
            keyset_no_id.clone(),
            keyset_no_secret,
            vec![1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024],
        )?;

        // Store in database with resolution_status = "active"
        self.store_keyset(&keyset_yes, market_id, "YES", "active")
            .await?;
        self.store_keyset(&keyset_no, market_id, "NO", "active")
            .await?;

        Ok((keyset_yes, keyset_no))
    }

    /// Store keyset metadata in database
    async fn store_keyset(
        &self,
        keyset: &Keyset,
        market_id: &str,
        outcome: &str,
        status: &str,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO market_keysets (keyset_id, market_id, outcome, resolution_status, active)
            VALUES ($1, $2, $3, $4, true)
            ON CONFLICT (keyset_id) DO UPDATE
            SET resolution_status = $4
            "#,
        )
        .bind(keyset.id.clone())
        .bind(market_id)
        .bind(outcome)
        .bind(status)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Mark a keyset as inactive (used on market resolution)
    pub async fn deactivate_keyset(&self, keyset_id: &str) -> Result<()> {
        sqlx::query(
            r#"
            UPDATE market_keysets
            SET resolution_status = 'inactive', active = false, resolved_at = NOW()
            WHERE keyset_id = $1
            "#,
        )
        .bind(keyset_id)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Get keyset by ID (with resolution status)
    pub async fn get_keyset(&self, keyset_id: &str) -> Result<Option<KeysetRecord>> {
        let record = sqlx::query_as::<_, KeysetRecord>(
            r#"
            SELECT keyset_id, market_id, outcome, resolution_status, active, resolved_at
            FROM market_keysets
            WHERE keyset_id = $1
            "#,
        )
        .bind(keyset_id)
        .fetch_optional(&self.db)
        .await?;

        Ok(record)
    }
}

/// Helper: Derive deterministic keyset secret from mint secret
fn derive_keyset_secret(mint_secret: &[u8], keyset_id: &str) -> Result<Vec<u8>> {
    use sha2::{Sha256, Digest};

    let mut hasher = Sha256::new();
    hasher.update(mint_secret);
    hasher.update(keyset_id.as_bytes());
    Ok(hasher.finalize().to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_create_market_keysets() {
        // Test keyset creation for a market
        // Verify: two keysets created with IDs cascade_yes_*, cascade_no_*
    }

    #[tokio::test]
    async fn test_deactivate_keyset() {
        // Test keyset deactivation
        // Verify: resolution_status = "inactive", active = false
    }
}
```

### 3.2 Keyset Naming Convention

Each keyset ID follows a deterministic pattern:

```
YES keyset:  cascade_yes_{marketId}
NO keyset:   cascade_no_{marketId}

Example:
  Market ID: "bitcoin"
  YES keyset: "cascade_yes_bitcoin"
  NO keyset:  "cascade_no_bitcoin"
```

This allows the frontend to construct keyset IDs from the market ID without querying the mint first.

### 3.3 Blinding/Unblinding Across Keysets

**No special handling required**. Blinding and unblinding use standard Cashu cryptography:

1. Frontend blinds messages with random blinding factors
2. Frontend sends blinded messages to mint for specific keyset
3. Mint signs with keyset's private key
4. Frontend unblindss signatures (only frontend knows blinding factors)

The keyset ID determines which key signs the blinded messages. Different keysets sign with different keys.

**File: `src/crypto.rs` (standard Cashu)**

```rust
use rand::Rng;

/// Generate random blinding factor
pub fn generate_blinding_factor() -> Vec<u8> {
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; 32];
    rng.fill(&mut bytes[..]);
    bytes
}

/// Blind message (standard Cashu)
pub fn blind_message(message: &[u8], blinding_factor: &[u8]) -> Result<Vec<u8>> {
    // Standard Cashu blinding formula
    // Uses Pedersen commitment
    // Implementation uses BN254 elliptic curve
    Ok(cdk::crypto::blind(message, blinding_factor)?)
}

/// Unblind signature (standard Cashu)
pub fn unblind_signature(
    signature: &[u8],
    blinding_factor: &[u8],
) -> Result<Vec<u8>> {
    // Standard Cashu unblinding formula
    Ok(cdk::crypto::unblind(signature, blinding_factor)?)
}
```

### 3.4 Keyset Lifecycle

| Phase | Keyset Status | Can Swap? | Notes |
|-------|---------------|-----------|-------|
| **Market Active** | active | YES, both keysets | Trading ongoing |
| **Resolution Published** | active/inactive | YES (winning), NO (rejected) | Losing keyset marked inactive |
| **Claim Window** (30 days) | active/inactive | YES winners only | NO keyset stays inactive |
| **Claim Deadline Passed** | inactive | Never | Both keysets inactive; loser proofs deleted |

**File: `src/keysets/resolution.rs`**

```rust
use anyhow::Result;
use sqlx::PgPool;
use crate::nostr::oracle::OracleOutcome;

pub struct ResolutionHandler {
    db: PgPool,
    keyset_manager: KeysetManager,
}

impl ResolutionHandler {
    /// Mark losing keyset inactive after oracle resolution
    pub async fn resolve_market(
        &self,
        market_id: &str,
        outcome: &OracleOutcome,  // "YES" or "NO"
    ) -> Result<()> {
        // Determine losing keyset
        let losing_outcome = match outcome.outcome.as_str() {
            "YES" => "NO",
            "NO" => "YES",
            _ => return Err(anyhow!("Invalid outcome")),
        };

        // Construct keyset IDs
        let losing_keyset_id = format!("cascade_{}_{}", losing_outcome.to_lowercase(), market_id);

        // Mark as inactive
        self.keyset_manager
            .deactivate_keyset(&losing_keyset_id)
            .await?;

        // Log resolution
        sqlx::query(
            r#"
            INSERT INTO market_resolutions (market_id, winning_outcome, resolved_at)
            VALUES ($1, $2, NOW())
            "#,
        )
        .bind(market_id)
        .bind(outcome.outcome.clone())
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Check if keyset is still active (for swap handler)
    pub async fn is_keyset_active(&self, keyset_id: &str) -> Result<bool> {
        let record = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT active FROM market_keysets WHERE keyset_id = $1
            "#,
        )
        .bind(keyset_id)
        .fetch_optional(&self.db)
        .await?;

        Ok(record.unwrap_or(false))
    }
}
```

### 3.5 Privacy: All Users Share Keysets

**Important**: Unlike custodial exchanges that issue per-user keysets, Cascade uses **shared market keysets**:

- All users trading YES in Bitcoin market receive tokens from the **same** `cascade_yes_bitcoin` keyset
- Tokens are bearer tokens — the mint cannot correlate tokens to users
- No user identification in swap requests (except in custom LMSR fields, which don't include user ID)

This preserves privacy: the mint cannot build a transaction graph of users trading.

---

## 4. Escrow Account System

### 4.1 Database Schema

**NO escrow accounts or user balances in the mint**. The mint stores **only**:
- Market keysets (keyset IDs, resolution status)
- Rake accounting (total sats accumulated)
- Market resolutions (oracle outcomes)

**File: `migrations/001_initial_schema.sql`**

```sql
-- Market keysets (outcome isolation)
CREATE TABLE market_keysets (
    id SERIAL PRIMARY KEY,
    keyset_id VARCHAR(255) UNIQUE NOT NULL,
    market_id VARCHAR(255) NOT NULL,
    outcome VARCHAR(10) NOT NULL,  -- "YES" or "NO"
    resolution_status VARCHAR(20) DEFAULT 'active',  -- "active" or "inactive"
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,
    INDEX idx_market_id (market_id),
    INDEX idx_keyset_id (keyset_id)
);

-- Market resolutions (oracle outcomes)
CREATE TABLE market_resolutions (
    id SERIAL PRIMARY KEY,
    market_id VARCHAR(255) UNIQUE NOT NULL,
    winning_outcome VARCHAR(10) NOT NULL,  -- "YES" or "NO"
    resolved_at TIMESTAMP DEFAULT NOW(),
    oracle_pubkey VARCHAR(255),
    oracle_event_id VARCHAR(255)
);

-- Rake accounting (accumulated fees)
CREATE TABLE rake_accounting (
    id SERIAL PRIMARY KEY,
    total_sats BIGINT DEFAULT 0,
    market_id VARCHAR(255),  -- NULL for global rake
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    INDEX idx_market_id (market_id)
);

-- Lightning invoice tracking (for deposit/withdrawal)
CREATE TABLE lightning_invoices (
    id SERIAL PRIMARY KEY,
    invoice_hash VARCHAR(255) UNIQUE NOT NULL,
    amount_sats BIGINT NOT NULL,
    invoice_type VARCHAR(20) NOT NULL,  -- "mint" or "melt"
    status VARCHAR(20) DEFAULT 'pending',  -- "pending", "paid", "expired"
    bolt11 TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_invoice_hash (invoice_hash)
);
```

### 4.2 Deposit Flow

No "account balance" is created. Instead:

1. User deposits sats via Lightning (NUT-06)
2. Mint issues generic sat-denomination proofs (bearer tokens)
3. User holds proofs locally (no mint balance tracking)

**File: `src/lightning/invoice.rs`**

```rust
use anyhow::Result;
use sqlx::PgPool;

pub struct InvoiceManager {
    db: PgPool,
    lnd_client: LndClient,  // Lightning RPC client
}

impl InvoiceManager {
    /// Create deposit invoice (NUT-06 mint quote)
    pub async fn create_mint_invoice(
        &self,
        amount_sats: u64,
    ) -> Result<MintQuote> {
        // 1. Create BOLT11 invoice via LND/CLN
        let invoice = self.lnd_client.create_invoice(amount_sats).await?;

        // 2. Store invoice metadata
        let quote_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO lightning_invoices (invoice_hash, amount_sats, invoice_type, bolt11, status)
            VALUES ($1, $2, 'mint', $3, 'pending')
            "#,
        )
        .bind(&invoice.r_hash)
        .bind(amount_sats as i64)
        .bind(&invoice.payment_request)
        .execute(&self.db)
        .await?;

        Ok(MintQuote {
            quote: quote_id,
            request: invoice.payment_request,
            amount: amount_sats,
        })
    }

    /// Check if invoice is paid (polling endpoint)
    pub async fn check_mint_invoice(&self, invoice_hash: &str) -> Result<bool> {
        let record = sqlx::query_scalar::<_, String>(
            r#"
            SELECT status FROM lightning_invoices WHERE invoice_hash = $1
            "#,
        )
        .bind(invoice_hash)
        .fetch_optional(&self.db)
        .await?;

        if let Some(status) = record {
            return Ok(status == "paid");
        }

        // If not in DB, check LND directly
        let is_paid = self.lnd_client.invoice_settled(invoice_hash).await?;
        if is_paid {
            sqlx::query(
                r#"
                UPDATE lightning_invoices SET status = 'paid', paid_at = NOW() WHERE invoice_hash = $1
                "#,
            )
            .bind(invoice_hash)
            .execute(&self.db)
            .await?;
        }

        Ok(is_paid)
    }
}

#[derive(Serialize)]
pub struct MintQuote {
    pub quote: String,
    pub request: String,  // BOLT11 string
    pub amount: u64,
}
```

### 4.3 Trade Flow

**No account debits**. Instead:

1. User selects sats from bearer token proofs
2. User creates blinded messages for outcome keyset
3. User submits swap request with proofs + blinded messages
4. Mint validates proofs (bearer tokens, valid signatures) and swaps
5. Mint issues new proofs (outcome tokens)

**No balance checking** — the proofs themselves prove ownership.

### 4.4 Account Isolation via Bearer Tokens

The key insight: **The proofs ARE the account**. Each user holds different proofs (bearer tokens). The mint cannot forge proofs or issue them to wrong users because:

1. **Blind signatures**: Mint signs blinded messages without seeing the content
2. **Proof verification**: Swap handler verifies proof signatures match the keyset key
3. **No reuse**: Proofs are marked spent after a swap

This is pure Cashu security model — no custom account logic needed.

### 4.5 The Mint MUST Separate "Account Balance" from "Proofs Held"

**Clear separation**:

| Concept | Storage | Who Holds | Ownership |
|---------|---------|-----------|-----------|
| **Proofs (bearer tokens)** | User's local wallet | User | Whoever holds the proof |
| **Account balance** | Mint database | Mint | Tied to user (FORBIDDEN) |
| **Rake** | Mint database | Mint | Mint operator |

**This plan uses ONLY bearer tokens and rake accounting. NO user account balances.**

---

## 5. Market Lifecycle

### 5.1 Market Creation (Cascade Publishes Kind 982)

When Cascade publishes a market event (kind 982):

```json
{
  "kind": 982,
  "tags": [
    ["d", "bitcoin"],
    ["title", "Bitcoin Price > $100k"],
    ["mint", "https://mint.contrarian.markets"],
    ["keyset_yes", "cascade_yes_bitcoin"],
    ["keyset_no", "cascade_no_bitcoin"],
    ["qLong", "0"],
    ["qShort", "0"],
    ["b", "500"],
    ["oracle_pubkey", "npub1oracle..."]
  ]
}
```

**Mint's role**:

1. Detect kind 982 event (via Nostr relay subscription)
2. Extract market ID from `d` tag
3. Create two keysets: `cascade_yes_bitcoin` and `cascade_no_bitcoin`
4. Store market metadata (mint_url, oracle_pubkey, b parameter)
5. Initialize LMSR state: qYES=0, qNO=0

**File: `src/nostr/market_sync.rs`**

```rust
use nostr_sdk::{Event, EventBuilder, Kind, Tag};
use anyhow::Result;
use sqlx::PgPool;
use crate::keysets::KeysetManager;

pub struct MarketSync {
    db: PgPool,
    keyset_manager: KeysetManager,
    nostr_client: NostrClient,
}

impl MarketSync {
    /// Poll for new kind 982 events and create keysets
    pub async fn sync_markets(&self) -> Result<()> {
        // Subscribe to kind 982 (binary markets)
        let filter = Filter::new()
            .kind(Kind::Custom(982))
            .limit(100);

        let events = self.nostr_client.fetch_events(&filter).await?;

        for event in events {
            self.process_market_event(&event).await?;
        }

        Ok(())
    }

    async fn process_market_event(&self, event: &Event) -> Result<()> {
        // Extract market ID from "d" tag
        let market_id = event
            .tags
            .iter()
            .find(|tag| tag.as_vec().first() == Some(&"d".to_string()))
            .and_then(|tag| tag.as_vec().get(1))
            .ok_or(anyhow!("Market ID not found in event"))?
            .clone();

        // Check if market already exists
        let exists = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(SELECT 1 FROM market_keysets WHERE market_id = $1)
            "#,
        )
        .bind(&market_id)
        .fetch_one(&self.db)
        .await?;

        if exists {
            return Ok(());  // Market already synced
        }

        // Extract market metadata
        let b_param = extract_tag(&event.tags, "b")
            .and_then(|v| v.parse::<f64>().ok())
            .unwrap_or(500.0);

        let oracle_pubkey = extract_tag(&event.tags, "oracle_pubkey")
            .unwrap_or_default();

        // Create keysets
        let (keyset_yes, keyset_no) = self
            .keyset_manager
            .create_market_keysets(&market_id)
            .await?;

        // Store market metadata
        sqlx::query(
            r#"
            INSERT INTO market_metadata (market_id, b_param, oracle_pubkey, keyset_yes_id, keyset_no_id, event_id)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
        )
        .bind(&market_id)
        .bind(b_param)
        .bind(&oracle_pubkey)
        .bind(&keyset_yes.id)
        .bind(&keyset_no.id)
        .bind(&event.id)
        .execute(&self.db)
        .await?;

        Ok(())
    }
}

fn extract_tag(tags: &[Tag], name: &str) -> Option<String> {
    tags.iter()
        .find(|tag| tag.as_vec().first() == Some(&name.to_string()))
        .and_then(|tag| tag.as_vec().get(1))
        .map(|v| v.clone())
}
```

### 5.2 Trading (LMSR Pricing + Token Issuance)

User initiates trade:

1. Frontend fetches kind 982 (market state: qYES, qNO, b)
2. Frontend computes LMSR price
3. Frontend submits swap request to POST `/swap` with:
   - Input proofs (sats)
   - Blinded messages (outcome keyset)
   - Market state (qYES, qNO, b)
   - Price (computed by frontend)
   - Outcome (YES/NO)

4. Mint validates:
   - Proofs are valid (bearer token signature check)
   - Price matches LMSR formula (0.5% tolerance)
   - Keyset matches outcome
   - Denominations are standard Cashu

5. Mint signs blinded messages with outcome keyset

6. Frontend unblinds and receives outcome tokens

**No mint state changes during trade** — qYES and qNO are tracked in kind 982 event, updated by Cascade (not mint).

### 5.3 Oracle Resolution (Kind 30023 Event)

When market outcome is determined, oracle publishes kind 30023 event:

```json
{
  "kind": 30023,
  "tags": [
    ["d", "bitcoin_resolution"],
    ["market", "bitcoin"],
    ["outcome", "YES"],
    ["timestamp", "1712234400"]
  ],
  "content": "Market resolved: YES"
}
```

**Mint's role**:

1. Detect kind 30023 event via Nostr relay
2. Verify oracle signature (oracle_pubkey matches market event)
3. Extract outcome (YES/NO)
4. Mark losing keyset as inactive (deactivate_keyset)
5. Record resolution timestamp

**File: `src/nostr/oracle.rs`**

```rust
use nostr_sdk::Event;
use anyhow::Result;
use sqlx::PgPool;
use crate::keysets::resolution::ResolutionHandler;

pub struct OracleListener {
    db: PgPool,
    resolution_handler: ResolutionHandler,
    nostr_client: NostrClient,
}

pub struct OracleOutcome {
    pub market_id: String,
    pub outcome: String,  // "YES" or "NO"
    pub timestamp: u64,
}

impl OracleListener {
    /// Monitor for kind 30023 (oracle resolution) events
    pub async fn monitor_resolutions(&self) -> Result<()> {
        let filter = Filter::new()
            .kind(Kind::Custom(30023))
            .limit(100);

        let events = self.nostr_client.fetch_events(&filter).await?;

        for event in events {
            self.process_resolution_event(&event).await?;
        }

        Ok(())
    }

    async fn process_resolution_event(&self, event: &Event) -> Result<()> {
        // Extract market ID and outcome
        let market_id = extract_tag(&event.tags, "market")
            .ok_or(anyhow!("Market ID not found"))?;

        let outcome = extract_tag(&event.tags, "outcome")
            .ok_or(anyhow!("Outcome not found"))?;

        // Verify oracle signature (should match oracle_pubkey in market event)
        self.verify_oracle_signature(&market_id, event).await?;

        // Check if already resolved
        let already_resolved = sqlx::query_scalar::<_, bool>(
            r#"
            SELECT EXISTS(SELECT 1 FROM market_resolutions WHERE market_id = $1)
            "#,
        )
        .bind(&market_id)
        .fetch_one(&self.db)
        .await?;

        if already_resolved {
            return Ok(());
        }

        // Mark losing keyset as inactive
        self.resolution_handler
            .resolve_market(&market_id, &OracleOutcome {
                market_id: market_id.clone(),
                outcome: outcome.clone(),
                timestamp: event.created_at.as_u64(),
            })
            .await?;

        Ok(())
    }

    async fn verify_oracle_signature(&self, market_id: &str, event: &Event) -> Result<()> {
        // Fetch oracle_pubkey from market metadata
        let oracle_pubkey = sqlx::query_scalar::<_, String>(
            r#"
            SELECT oracle_pubkey FROM market_metadata WHERE market_id = $1
            "#,
        )
        .bind(market_id)
        .fetch_one(&self.db)
        .await?;

        // Verify event signature
        event.verify()?;

        // Verify event author matches oracle
        if event.author.to_string() != oracle_pubkey {
            return Err(anyhow!("Oracle signature mismatch"));
        }

        Ok(())
    }
}
```

### 5.4 Claim Flow (Winners Swap Outcome Tokens → Sats)

After resolution, winners initiate a **claim swap** to convert outcome tokens back to sats:

**Winner has**: 50 sats of YES outcome proofs (from trade)

**Claim swap request** (POST `/swap`):
```json
{
  "inputs": [50 sats YES proofs],
  "outputs": [
    {"amount": 32, "blinded": "..."},
    {"amount": 16, "blinded": "..."},
    {"amount": 2, "blinded": "..."}
  ],
  "payout_type": "claim",
  "market_keyset_yes_id": "cascade_yes_bitcoin"
}
```

**Mint's role**:

1. Verify YES proofs (keyset is still active — outcome won)
2. Validate proof signatures
3. Compute payout: 50 * 0.98 = 49 sats (2% rake)
4. Sign blinded messages with generic sat-denomination keyset
5. Increment rake: rake_sats += 1

**File: `src/swap/claim_handler.rs`**

```rust
use cdk::nuts::SwapRequest;
use anyhow::Result;
use sqlx::PgPool;
use crate::rake::RakeAccounting;

pub struct ClaimHandler {
    db: PgPool,
    rake: RakeAccounting,
    resolution_handler: ResolutionHandler,
}

impl ClaimHandler {
    /// Handle claim swap (outcome tokens → sats, minus rake)
    pub async fn handle_claim_swap(
        &self,
        request: &SwapRequest,
        keyset_id: &str,
    ) -> Result<SwapResponse> {
        // 1. Verify keyset is still active (outcome won)
        let is_active = self.resolution_handler.is_keyset_active(keyset_id).await?;
        if !is_active {
            return Err(anyhow!("Keyset is inactive (losing outcome)"));
        }

        // 2. Validate input proofs (standard Cashu)
        self.validate_proofs(&request.inputs)?;

        // 3. Calculate total input amount
        let total_input = request
            .inputs
            .iter()
            .map(|proof| proof.amount)
            .sum::<u64>();

        // 4. Compute payout (with rake deduction)
        const RAKE_PERCENTAGE: f64 = 0.02;
        let rake_amount = (total_input as f64 * RAKE_PERCENTAGE) as u64;
        let payout_amount = total_input - rake_amount;

        // 5. Sign blinded messages with sat-denomination keyset
        let signatures = self.sign_blinded_messages(
            &request.outputs,
            &request.outputs[0].keyset_id,  // Generic sat keyset
        )?;

        // 6. Record rake
        self.rake
            .accumulate_rake(rake_amount, Some(keyset_id))
            .await?;

        Ok(SwapResponse {
            signatures,
            payout_amount,
        })
    }

    fn validate_proofs(&self, proofs: &[Proof]) -> Result<()> {
        for proof in proofs {
            // Verify proof signature using keyset public key
            // Standard Cashu proof validation
        }
        Ok(())
    }

    fn sign_blinded_messages(
        &self,
        outputs: &[BlindedMessage],
        keyset_id: &str,
    ) -> Result<Vec<Signature>> {
        // Sign with sat-denomination keyset (generic)
        Ok(vec![])
    }
}
```

### 5.5 Loser Tokens Become Worthless

After resolution, losing keyset is marked `inactive`. Any swap request with losing keyset proofs is rejected:

**Swap handler validation** (checks keyset status):

```rust
pub async fn validate_keyset_for_swap(keyset_id: &str) -> Result<()> {
    let keyset = get_keyset(keyset_id).await?;

    if !keyset.active {
        return Err(anyhow!(
            "Keyset {} is inactive (losing outcome)",
            keyset_id
        ));
    }

    Ok(())
}
```

---

## 6. NUT-05 Lightning Withdrawal (Melt)

### 6.1 Melt Quote Creation

User generates BOLT11 invoice from personal Lightning wallet (e.g., Strike, Alby). User submits withdrawal request:

**Endpoint**: `POST /melt/quote/bolt11`

**Request**:
```json
{
  "request": "lnbc100n1p0qqqx2pp5qq...",
  "unit": "sat"
}
```

**Mint's role**:

1. Validate BOLT11 format and amount
2. Create melt quote (mint-side tracking)
3. Return quote ID and fee estimation

**File: `src/lightning/melt.rs`**

```rust
use lightning_invoice::Bolt11Invoice;
use anyhow::{anyhow, Result};
use sqlx::PgPool;

pub struct MeltQuoteHandler {
    db: PgPool,
    lnd_client: LndClient,
}

impl MeltQuoteHandler {
    /// Create melt quote from user's BOLT11 invoice
    pub async fn create_melt_quote(
        &self,
        bolt11: &str,
        unit: &str,
    ) -> Result<MeltQuote> {
        // 1. Parse BOLT11
        let invoice = Bolt11Invoice::from_str(bolt11)
            .map_err(|_| anyhow!("Invalid BOLT11 format"))?;

        // 2. Extract amount (in sats)
        let amount_sats = invoice
            .amount_milli_satoshis()
            .map(|m| m / 1000)
            .ok_or(anyhow!("Invoice has no amount"))?;

        // 3. Estimate routing fee (LND provides)
        let fee_sats = self.lnd_client.estimate_fee(amount_sats).await?;

        // 4. Verify expiry (invoice must not expire soon)
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)?
            .as_secs();
        let expiry = invoice.expires_at();

        if let Some(expiry_time) = expiry {
            if expiry_time < now {
                return Err(anyhow!("Invoice has expired"));
            }
            if expiry_time - now < 600 {
                return Err(anyhow!("Invoice expires too soon (< 10 min)"));
            }
        }

        // 5. Store melt quote
        let quote_id = uuid::Uuid::new_v4().to_string();
        sqlx::query(
            r#"
            INSERT INTO melt_quotes (quote_id, bolt11, amount_sats, fee_sats, status)
            VALUES ($1, $2, $3, $4, 'pending')
            "#,
        )
        .bind(&quote_id)
        .bind(bolt11)
        .bind(amount_sats as i64)
        .bind(fee_sats as i64)
        .execute(&self.db)
        .await?;

        Ok(MeltQuote {
            quote: quote_id,
            amount: amount_sats,
            fee_reserve: fee_sats,
        })
    }

    /// Validate melt quote exists and is pending
    pub async fn validate_melt_quote(&self, quote_id: &str) -> Result<MeltQuoteRecord> {
        let record = sqlx::query_as::<_, MeltQuoteRecord>(
            r#"
            SELECT quote_id, bolt11, amount_sats, fee_sats, status, created_at
            FROM melt_quotes
            WHERE quote_id = $1 AND status = 'pending'
            "#,
        )
        .bind(quote_id)
        .fetch_one(&self.db)
        .await?;

        Ok(record)
    }
}

#[derive(Serialize)]
pub struct MeltQuote {
    pub quote: String,
    pub amount: u64,        // Amount user receives (net of fees)
    pub fee_reserve: u64,   // Max fee to reserve
}
```

### 6.2 Invoice Validation

**Validation rules**:
- BOLT11 format is valid
- Amount is present and reasonable (not too large, not zero)
- Invoice has not expired and expires > 10 minutes from now
- Invoice is for a different address (not self-payment)

### 6.3 HTLC Monitoring and Payment

After user submits melt request:

**Endpoint**: `POST /melt/bolt11`

**Request**:
```json
{
  "quote": "quote_id",
  "proofs": [sat proofs]
}
```

**Mint's role**:

1. Validate melt quote (exists, pending)
2. Validate proofs (bearer token signature check, amount matches)
3. Pay invoice via Lightning (LND/CLN)
4. Monitor HTLC until payment settles
5. Burn proofs (mark spent)

**File: `src/lightning/payment.rs`**

```rust
use anyhow::Result;
use sqlx::PgPool;
use cdk::nuts::Proof;

pub struct PaymentHandler {
    db: PgPool,
    lnd_client: LndClient,
}

impl PaymentHandler {
    /// Execute melt (pay invoice, burn proofs)
    pub async fn execute_melt(
        &self,
        quote_id: &str,
        proofs: &[Proof],
    ) -> Result<MeltResponse> {
        // 1. Validate quote
        let quote = self.validate_melt_quote(quote_id).await?;

        // 2. Validate proofs
        let total_amount = proofs.iter().map(|p| p.amount).sum::<u64>();
        if total_amount < quote.amount_sats {
            return Err(anyhow!(
                "Insufficient proofs: {} < {}",
                total_amount,
                quote.amount_sats
            ));
        }

        // 3. Pay invoice via LND
        let payment_result = self
            .lnd_client
            .send_payment(&quote.bolt11)
            .await?;

        let preimage = payment_result.preimage;

        // 4. Monitor HTLC (LND provides preimage on settlement)
        // 5. Burn proofs (mark as spent in database)
        sqlx::query(
            r#"
            INSERT INTO spent_proofs (proof_secret, spent_at)
            SELECT secret, NOW() FROM (
              SELECT UNNEST($1::TEXT[]) as secret
            ) AS t
            "#,
        )
        .bind(proofs.iter().map(|p| p.secret.clone()).collect::<Vec<_>>())
        .execute(&self.db)
        .await?;

        // 6. Mark quote as paid
        sqlx::query(
            r#"
            UPDATE melt_quotes SET status = 'paid', paid_at = NOW(), preimage = $1
            WHERE quote_id = $2
            "#,
        )
        .bind(&preimage)
        .bind(quote_id)
        .execute(&self.db)
        .await?;

        Ok(MeltResponse {
            status: "paid".to_string(),
            preimage,
        })
    }

    async fn validate_melt_quote(&self, quote_id: &str) -> Result<MeltQuoteRecord> {
        // Fetch and validate quote
        Ok(MeltQuoteRecord::default())
    }
}

#[derive(Serialize)]
pub struct MeltResponse {
    pub status: String,
    pub preimage: String,
}
```

### 6.4 Fee Calculation and Deduction

**Fee model**:
- Mint estimates routing fee at quote time
- Fee is deducted from proofs at melt time
- Example: User submits 100 sats proofs, fee reserve = 2 sats → user receives 98 sats, 2 sats held for fees

**Standard approach**: NUT-02 fees are published in `/keys` response, and melt respects those fees.

### 6.5 Edge Cases

| Scenario | Behavior |
|----------|----------|
| **Invoice expired before payment** | Reject melt, mark quote as "expired" |
| **Payment fails (route not found)** | Mint cancels melt, user can retry with different invoice |
| **Partial melt** | Not supported in Phase 2 (whole quote must settle) |
| **Proofs insufficient** | Reject melt, user must provide more proofs |

---

## 7. Rake Accumulation

### 7.1 Rake Per Trade

Rake is a **configurable fee** deducted on resolution (claim flow), not on trades.

**Configuration** (in `.env` or config):
```
RAKE_PERCENTAGE=0.02  # 2% on claim swaps
```

### 7.2 Accumulation

On each claim swap:

1. Winner submits YES (winning) outcome proofs
2. Mint computes payout: amount * (1 - RAKE_PERCENTAGE)
3. Rake is credited to a **mint-owned reserve** (not per-user)
4. Rake stays in mint as liquidity

**No "rake account"** — rake is just a running total in the database.

**File: `src/rake/accumulation.rs`**

```rust
use sqlx::PgPool;
use anyhow::Result;

pub struct RakeAccounting {
    db: PgPool,
}

impl RakeAccounting {
    /// Record rake on claim swap
    pub async fn accumulate_rake(
        &self,
        rake_sats: u64,
        market_id: Option<&str>,
    ) -> Result<()> {
        // Update global rake total
        sqlx::query(
            r#"
            INSERT INTO rake_accounting (market_id, total_sats, updated_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (market_id) DO UPDATE
            SET total_sats = rake_accounting.total_sats + $2, updated_at = NOW()
            "#,
        )
        .bind(market_id)
        .bind(rake_sats as i64)
        .execute(&self.db)
        .await?;

        // Log rake event for transparency
        sqlx::query(
            r#"
            INSERT INTO rake_events (market_id, amount_sats, source, recorded_at)
            VALUES ($1, $2, 'claim_swap', NOW())
            "#,
        )
        .bind(market_id)
        .bind(rake_sats as i64)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Get current rake total (global)
    pub async fn get_total_rake(&self) -> Result<u64> {
        let total = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(SUM(total_sats), 0) FROM rake_accounting WHERE market_id IS NULL
            "#,
        )
        .fetch_one(&self.db)
        .await?;

        Ok(total as u64)
    }

    /// Get rake per market
    pub async fn get_rake_by_market(&self, market_id: &str) -> Result<u64> {
        let rake = sqlx::query_scalar::<_, Option<i64>>(
            r#"
            SELECT total_sats FROM rake_accounting WHERE market_id = $1
            "#,
        )
        .bind(market_id)
        .fetch_optional(&self.db)
        .await?
        .flatten()
        .unwrap_or(0);

        Ok(rake as u64)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_accumulate_rake() {
        // Test rake accumulation on claim swap
        // Verify: total_sats incremented correctly
    }

    #[tokio::test]
    async fn test_rake_per_market() {
        // Test per-market rake tracking
    }
}
```

### 7.3 Tracking

All rake events are logged with source and timestamp:

```sql
INSERT INTO rake_events (market_id, amount_sats, source, recorded_at)
VALUES ('bitcoin', 1, 'claim_swap', NOW());
```

This allows transparency: operators can see when rake accumulated.

### 7.4 Extraction (Operator Withdrawal)

The mint operator **withdraws rake** by creating a melt request:

1. Operator generates BOLT11 invoice from personal wallet (e.g., 1000 sats)
2. Mint creates fake proofs for the rake amount (only operator can do this)
3. Operator submits melt with fake proofs
4. Mint verifies operator credentials and pays invoice

**File: `src/rake/extraction.rs`**

```rust
use anyhow::Result;
use sqlx::PgPool;

pub struct RakeExtraction {
    db: PgPool,
    lnd_client: LndClient,
}

impl RakeExtraction {
    /// Extract rake (operator-only)
    pub async fn extract_rake(
        &self,
        operator_secret: &str,  // Operator authentication (hmac signature)
        bolt11: &str,
        amount_sats: u64,
    ) -> Result<()> {
        // 1. Verify operator secret
        self.verify_operator_auth(operator_secret)?;

        // 2. Check rake balance
        let available_rake = self.get_available_rake().await?;
        if available_rake < amount_sats {
            return Err(anyhow!(
                "Insufficient rake: {} < {}",
                available_rake,
                amount_sats
            ));
        }

        // 3. Create melt request and pay invoice
        let melt_result = self
            .lnd_client
            .send_payment(bolt11)
            .await?;

        // 4. Deduct from rake
        sqlx::query(
            r#"
            INSERT INTO rake_accounting (market_id, total_sats, updated_at)
            VALUES (NULL, $1, NOW())
            ON CONFLICT (market_id) DO UPDATE
            SET total_sats = rake_accounting.total_sats + $1, updated_at = NOW()
            "#,
        )
        .bind(-(amount_sats as i64))
        .execute(&self.db)
        .await?;

        // Log extraction
        sqlx::query(
            r#"
            INSERT INTO rake_events (market_id, amount_sats, source, recorded_at)
            VALUES (NULL, $1, 'operator_extraction', NOW())
            "#,
        )
        .bind(amount_sats as i64)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    fn verify_operator_auth(&self, secret: &str) -> Result<()> {
        // Verify operator HMAC signature (must match configured operator key)
        Ok(())
    }

    async fn get_available_rake(&self) -> Result<u64> {
        let rake = sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COALESCE(SUM(total_sats), 0) FROM rake_accounting WHERE market_id IS NULL
            "#,
        )
        .fetch_one(&self.db)
        .await? as u64;

        Ok(rake)
    }
}
```

### 7.5 Why Rake Stays in Mint

The design decision: **Rake is not withdrawn regularly; it stays in the mint as liquidity.**

**Rationale**:
- No external capital needed (mint is self-funding)
- Rake accumulates and grows the liquidity pool
- Mint can handle larger withdrawal amounts
- Operator can extract if needed, but not required

**Alternative** (rejected): Withdraw rake daily/weekly → Requires operator to keep replenishing liquidity.

---

## 8. API Endpoints

### 8.1 Standard Cashu Endpoints

All endpoints follow **NUT-06, NUT-03/04, NUT-05** standards.

| Endpoint | Method | NUT | Purpose |
|----------|--------|-----|---------|
| `GET /mint/info` | GET | NUT-01 | Mint metadata (pubkeys, version) |
| `GET /mint/keysets` | GET | NUT-07 | List all active keysets (with resolution status) |
| `GET /mint/keys` | GET | NUT-01 | Public keys for all keysets |
| `POST /mint/quote/bolt11` | POST | NUT-06 | Create deposit invoice |
| `GET /mint/quote/bolt11/{id}` | GET | NUT-06 | Check deposit paid |
| `POST /mint/bolt11` | POST | NUT-06 | Mint tokens after payment |
| `POST /swap` | POST | NUT-03/04 | Swap tokens (with LMSR validation) |
| `POST /melt/quote/bolt11` | POST | NUT-05 | Create melt quote |
| `GET /melt/quote/bolt11/{id}` | GET | NUT-05 | Check melt quote |
| `POST /melt/bolt11` | POST | NUT-05 | Execute melt |

### 8.2 Custom Account Endpoints (DEPRECATED)

**NOT implemented** — this plan uses pure bearer tokens, not accounts.

### 8.3 Implementation

**File: `src/api/cashu_routes.rs`**

```rust
use actix_web::{web, HttpResponse, Responder};
use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Serialize)]
pub struct MintInfo {
    pub name: String,
    pub pubkey: String,
    pub version: String,
    pub description: String,
    pub contact: Vec<String>,
    pub motd: String,
    pub nuts: NutsInfo,
}

#[derive(Serialize)]
pub struct NutsInfo {
    #[serde(rename = "1")]
    pub nut1: MintNutInfo,
    #[serde(rename = "3")]
    pub nut3: MintNutInfo,
    #[serde(rename = "4")]
    pub nut4: MintNutInfo,
    #[serde(rename = "5")]
    pub nut5: MintNutInfo,
    #[serde(rename = "6")]
    pub nut6: MintNutInfo,
    #[serde(rename = "7")]
    pub nut7: MintNutInfo,
}

#[derive(Serialize)]
pub struct MintNutInfo {
    pub supported: bool,
    pub methods: Vec<String>,
}

pub async fn get_mint_info() -> impl Responder {
    let info = MintInfo {
        name: "Cascade Binary Markets Mint".to_string(),
        pubkey: "...".to_string(),
        version: "0.1.0".to_string(),
        description: "CDK Rust mint for binary prediction markets".to_string(),
        contact: vec!["admin@cascade.markets".to_string()],
        motd: "Welcome to Cascade!".to_string(),
        nuts: NutsInfo {
            nut1: MintNutInfo {
                supported: true,
                methods: vec!["bolt11".to_string()],
            },
            nut3: MintNutInfo {
                supported: true,
                methods: vec!["bolt11".to_string()],
            },
            nut4: MintNutInfo {
                supported: true,
                methods: vec!["bolt11".to_string()],
            },
            nut5: MintNutInfo {
                supported: true,
                methods: vec!["bolt11".to_string()],
            },
            nut6: MintNutInfo {
                supported: true,
                methods: vec!["bolt11".to_string()],
            },
            nut7: MintNutInfo {
                supported: true,
                methods: vec!["bolt11".to_string()],
            },
        },
    };

    HttpResponse::Ok().json(info)
}

pub async fn get_keysets(keyset_manager: web::Data<KeysetManager>) -> impl Responder {
    match keyset_manager.list_keysets().await {
        Ok(keysets) => HttpResponse::Ok().json(keysets),
        Err(e) => HttpResponse::InternalServerError().body(e.to_string()),
    }
}

pub async fn handle_swap(
    request: web::Json<SwapRequest>,
    swap_handler: web::Data<SwapHandler>,
) -> impl Responder {
    match swap_handler
        .handle_swap(request.into_inner())
        .await
    {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::BadRequest().body(e.to_string()),
    }
}

pub async fn handle_melt(
    request: web::Json<MeltRequest>,
    melt_handler: web::Data<PaymentHandler>,
) -> impl Responder {
    match melt_handler
        .execute_melt(&request.quote, &request.proofs)
        .await
    {
        Ok(response) => HttpResponse::Ok().json(response),
        Err(e) => HttpResponse::BadRequest().body(e.to_string()),
    }
}

pub fn configure_routes(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/mint")
            .route("/info", web::get().to(get_mint_info))
            .route("/keysets", web::get().to(get_keysets))
    )
    .service(
        web::scope("")
            .route("/swap", web::post().to(handle_swap))
            .route("/melt/bolt11", web::post().to(handle_melt))
    );
}
```

---

## 9. Security Considerations

### 9.1 Mint Key Storage

**Critical**: Mint keys must be protected from compromise.

**Implementation**:
- Keys stored encrypted in database (AES-256-GCM)
- Decryption key held in environment variable or hardware security module (HSM)
- Keys never printed to logs
- Access to key material restricted to signing operations

**File: `src/crypto.rs`**

```rust
use aes_gcm::{Aes256Gcm, Key, Nonce};
use anyhow::Result;

pub struct KeyVault {
    master_key: Vec<u8>,  // Loaded from HSM or env
}

impl KeyVault {
    /// Decrypt mint secret from database
    pub fn decrypt_key(&self, encrypted: &[u8], nonce: &[u8]) -> Result<Vec<u8>> {
        let key = Key::<Aes256Gcm>::from_slice(&self.master_key);
        let nonce = Nonce::from_slice(nonce);
        let cipher = Aes256Gcm::new(key);

        cipher
            .decrypt(nonce, encrypted.as_ref())
            .map_err(|_| anyhow!("Decryption failed"))
    }

    /// Encrypt key for storage
    pub fn encrypt_key(&self, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>)> {
        let key = Key::<Aes256Gcm>::from_slice(&self.master_key);
        let nonce = generate_nonce();
        let cipher = Aes256Gcm::new(key);

        let ciphertext = cipher
            .encrypt(&nonce, plaintext.as_ref())
            .map_err(|_| anyhow!("Encryption failed"))?;

        Ok((ciphertext, nonce.to_vec()))
    }
}

fn generate_nonce() -> Nonce {
    use rand::Rng;
    let mut rng = rand::thread_rng();
    let mut bytes = [0u8; 12];
    rng.fill(&mut bytes);
    Nonce::from(bytes)
}
```

### 9.2 DLEQ Proofs (Discrete Log Equality)

DLEQ proofs prevent signature forgery by proving the mint's signature is valid without revealing the key.

**Standard Cashu implementation** — no custom logic needed. CDK handles DLEQ proof generation and verification.

### 9.3 Blinding Factor Security

Blinding factors MUST be high-quality random numbers generated by cryptographically secure RNG.

```rust
pub fn generate_blinding_factor() -> Vec<u8> {
    use rand::RngCore;
    let mut rng = rand::thread_rng();
    let mut bytes = vec![0u8; 32];
    rng.fill_bytes(&mut bytes);
    bytes
}
```

### 9.4 Account Balance Integrity

**No per-user balances** — this section doesn't apply to this design.

### 9.5 Lightning Fraud Prevention

| Attack | Prevention |
|--------|-----------|
| **Invoice amount mismatch** | Validate BOLT11 amount matches request |
| **Invoice reuse** | Mark invoice as paid after settlement |
| **Expired invoices** | Reject invoices expiring < 10 minutes |
| **Large withdrawals** | Add withdrawal limits per user (optional) |
| **Rate limiting** | Limit melt requests per IP/user |

### 9.6 Oracle Spoofing

**Prevention**:
- Verify oracle signature matches `oracle_pubkey` in market event
- Only process kind 30023 events with valid signatures
- Log all resolution events for audit trail

```rust
async fn process_resolution_event(&self, event: &Event) -> Result<()> {
    // Verify signature
    event.verify()?;

    // Verify author matches oracle
    let oracle_pubkey = fetch_oracle_pubkey(market_id).await?;
    if event.author.to_string() != oracle_pubkey {
        return Err(anyhow!("Oracle signature mismatch"));
    }

    Ok(())
}
```

---

## 10. Testing Strategy

### 10.1 Unit Tests: LMSR Math

**File: `tests/lmsr_test.rs`**

30+ tests covering:

| Category | Count | Tests |
|----------|-------|-------|
| Price calculation | 5 | Equal quantities → 0.5, skewed quantities, extreme values, boundary cases |
| Cost function | 4 | Cost increases with quantity, monotonic, no NaN |
| Slippage | 3 | Slippage > 0, increases with size, fee impact |
| Share computation | 4 | Correct shares for given amount, rounding, precision |
| Edge cases | 3 | Zero amount, very large amounts, very small b parameter |

```rust
#[cfg(test)]
mod lmsr_tests {
    use super::*;

    #[test]
    fn test_price_equal_quantities() {
        let state = MarketState { qyes: 100.0, qno: 100.0, b: 500.0 };
        assert!((compute_lmsr_price(&state) - 0.5).abs() < 0.0001);
    }

    // ... 29 more tests
}
```

### 10.2 Integration Tests: Full Flow

**File: `tests/integration_test.rs`**

End-to-end tests for:

| Scenario | Steps | Verifications |
|----------|-------|---------------|
| **Deposit → Trade → Claim** | 1. Deposit 100 sats 2. Buy 50 YES 3. Claim YES 4. Withdraw | User receives sats minus rake |
| **Multiple trades** | 1. Deposit 100 2. Buy 50 YES 3. Buy 50 NO 4. Market resolves YES | Winners get payout, losers lose investment |
| **Market resolution** | 1. Create market 2. Trade 3. Oracle publishes outcome 4. Try to swap losing keyset | Losing keyset rejected |
| **Rake accumulation** | 1. Multiple claims 2. Check rake total | Rake tracks correctly |
| **Lightning deposit** | 1. Request invoice 2. Pay | Tokens minted after payment |
| **Lightning withdrawal** | 1. Melt request 2. Pay invoice | Invoice settled, proofs burned |

### 10.3 Lightning Tests

**Mocked LND/CLN** using `mockito`:

```rust
#[cfg(test)]
mod lightning_tests {
    use mockito::{mock, matchers};
    use super::*;

    #[tokio::test]
    async fn test_invoice_creation() {
        let _m = mock("POST", "/v1/invoices")
            .with_status(200)
            .with_body(r#"{"payment_request": "lnbc100n...", "r_hash": "..."}"#)
            .expect(1)
            .mount_as_global();

        // Test invoice creation
    }

    #[tokio::test]
    async fn test_payment_settlement() {
        // Mock payment via LND
        // Verify preimage returned
    }
}
```

### 10.4 Escrow Accounting (Not Applicable)

This design uses bearer tokens, so no escrow accounting tests needed.

### 10.5 Concurrency Tests

Multiple users trading simultaneously:

```rust
#[tokio::test]
async fn test_concurrent_swaps() {
    // Spawn 10 concurrent swap tasks
    // Verify all complete without state corruption
    // Verify LMSR prices computed correctly
}
```

### 10.6 NUT Spec Compliance

Verify CDK implementation matches Cashu specs:

| NUT | Check | Test |
|-----|-------|------|
| NUT-01 | Keyset format | Verify pubkeys in `/keys` response match spec |
| NUT-03/04 | Swap request/response | Verify proofs, blinded messages, signatures |
| NUT-05 | Melt format | Verify BOLT11 parsing, fee calculation |
| NUT-06 | Mint quote | Verify invoice creation, polling |
| NUT-07 | Keyset IDs | Verify ID format and uniqueness |
| NUT-08 | Blind signatures | Verify DLEQ proofs |

### 10.7 Load Test

Measure throughput:

```bash
# Run 1000 swaps concurrently
cargo bench --bench load_test

# Expected: > 100 swaps/second (depends on hardware)
```

### 10.8 Test Coverage

**Target**: 80%+ code coverage (measured via `tarpaulin` or `llvm-cov`)

```bash
cargo tarpaulin --out Html
```

---

## Execution Order

### Phase 1: Setup (Database, Crypto, Core Libraries)

1. **Create project structure** — Verify: `cargo build` succeeds
2. **Set up PostgreSQL** — Verify: `sqlx database create` succeeds
3. **Run migrations** — Verify: `sqlx migrate run` succeeds
4. **Implement crypto utilities** (`src/crypto.rs`) — Verify: unit tests pass
5. **Implement LMSR math** (`src/lmsr/pricing.rs`) — Verify: 30+ unit tests pass

### Phase 2: Keysets & Resolution (Core Cashu Logic)

6. **Implement keyset manager** (`src/keysets/manager.rs`) — Verify: unit tests for creation, deactivation
7. **Implement market resolution** (`src/keysets/resolution.rs`) — Verify: integration test for resolution flow
8. **Integrate with Nostr** (`src/nostr/market_sync.rs`, `src/nostr/oracle.rs`) — Verify: integration test for market detection and oracle processing

### Phase 3: Swap Handler (Trading)

9. **Implement LMSR validation** (`src/swap/lmsr_validator.rs`) — Verify: unit tests for price validation
10. **Integrate with CDK swap handler** (`src/swap/execution.rs`) — Verify: integration test for swap + blinding
11. **Implement claim swap handler** (`src/swap/claim_handler.rs`) — Verify: integration test for claim → sats

### Phase 4: Lightning (Deposits & Withdrawals)

12. **Implement invoice creation** (`src/lightning/invoice.rs`) — Verify: unit test for BOLT11 parsing
13. **Implement melt quote** (`src/lightning/melt.rs`) — Verify: unit test for melt quote creation
14. **Implement payment handler** (`src/lightning/payment.rs`) — Verify: integration test with mocked LND

### Phase 5: Rake & Accounting

15. **Implement rake accumulation** (`src/rake/accumulation.rs`) — Verify: unit tests for tracking
16. **Implement rake extraction** (`src/rake/extraction.rs`) — Verify: integration test for operator withdrawal

### Phase 6: API & Routes

17. **Implement Cashu routes** (`src/api/cashu_routes.rs`) — Verify: integration test for all endpoints
18. **Health check** (`src/api/health.rs`) — Verify: `GET /health` returns 200

### Phase 7: Integration & Testing

19. **Run full integration test suite** (`tests/integration_test.rs`) — Verify: all scenarios pass
20. **Run concurrent/load tests** — Verify: no race conditions, > 100 swaps/second
21. **Verify NUT spec compliance** — Verify: all endpoints match Cashu specs
22. **Code coverage** — Verify: 80%+ coverage

---

## Verification

### Automated Checks

```bash
# Tests
cargo test --all

# Coverage
cargo tarpaulin --out Html

# Linting
cargo clippy -- -D warnings

# Formatting
cargo fmt -- --check

# Build (release)
cargo build --release
```

### Integration Test Scenarios

1. **Deposit → Trade → Claim → Withdraw**
   - User deposits 100 sats
   - Buys 50 YES shares (at 0.55 price)
   - Market resolves YES
   - Claims 49 sats (50 - 2% rake)
   - Withdraws 49 sats via Lightning
   - Verify: sats received == 49

2. **Losing Position**
   - User deposits 100 sats
   - Buys 50 NO shares
   - Market resolves YES
   - Attempts to claim NO tokens
   - Verify: Swap rejected (keyset inactive)

3. **Multiple Markets, Concurrent Trading**
   - Create 5 markets
   - 10 users trade simultaneously (2 per market)
   - All completes without state corruption
   - Verify: Final balances correct

4. **Market Resolution via Oracle**
   - Create market
   - Publish fake kind 30023 oracle event
   - Verify: Losing keyset deactivated
   - Verify: Winning keyset still active

5. **Rake Accumulation**
   - Trade and resolve 3 markets
   - Each claim swaps 100 sats (2% rake = 2 sats)
   - Verify: rake_total == 6 sats

### Manual Testing Checklist

- [ ] GET /mint/info returns valid JSON
- [ ] GET /mint/keysets lists all active keysets
- [ ] POST /mint/quote/bolt11 creates invoice
- [ ] POST /swap with valid LMSR params succeeds
- [ ] POST /swap with invalid price fails
- [ ] POST /swap with inactive keyset fails
- [ ] POST /melt/quote/bolt11 with valid BOLT11 succeeds
- [ ] POST /melt/bolt11 with valid proofs settles
- [ ] Proof verification rejects invalid signatures

### Edge Cases

| Case | Expected Behavior |
|------|-------------------|
| **Very high slippage** | User receives fewer shares, sees large slippage warning in frontend |
| **Market b → 0** | Prices become extreme; very small amounts cause large swings |
| **Large withdrawal** | Takes longer to route; mint can reject if fees too high |
| **Concurrent swaps same keyset** | Both succeed (independent proofs) |
| **Swap after keyset deactivation** | Rejected with "keyset inactive" error |

---

## Scope & Limitations

### In Scope for Phase 2

- ✅ Pure bearer token trading (LMSR-based)
- ✅ Two keysets per market (YES + NO)
- ✅ Standard Cashu endpoints (NUT-06, NUT-03/04, NUT-05)
- ✅ Keyset deactivation for outcome isolation
- ✅ Rake accumulation in mint
- ✅ Lightning deposits/withdrawals
- ✅ Nostr market sync + oracle integration
- ✅ Single mint (not federated)

### Out of Scope / Deferred

- ❌ Federated mints (Phase 3+)
- ❌ Multi-outcome markets (Phase 3+)
- ❌ P2PK (Proof of Payment) — replaced by keyset deactivation
- ❌ Per-user escrow accounts
- ❌ Custom `/trade` endpoint
- ❌ Per-user keysets
- ❌ Partial melts
- ❌ Token mixing/privacy enhancements beyond blind signatures

### Acceptable Trade-Offs

1. **No withdrawal limits** — Users can withdraw any amount (limited by mint balance)
2. **No rate limiting** — Phase 2 assumes low user load; Phase 3 will add rate limits
3. **No minimum deposit** — Accepts any amount
4. **Simple fee model** — Fixed 2% rake on claims; no sliding scale

---

## Success Criteria

Implementation is complete and correct when:

1. **Type Safety**
   - ✅ All functions have explicit parameter and return types
   - ✅ No `unwrap()` in production code (use `?` and `Result<T>`)
   - ✅ Keyset IDs are strongly typed (not bare strings)

2. **Test Coverage**
   - ✅ 80%+ code coverage (measured via tarpaulin)
   - ✅ All LMSR calculations tested (price, shares, slippage)
   - ✅ All swap scenarios tested (valid, invalid price, inactive keyset)
   - ✅ All lightning scenarios tested (valid invoice, expired, amount mismatch)
   - ✅ All rake scenarios tested (accumulation, extraction)

3. **Backward Compatibility**
   - ✅ All standard Cashu endpoints match NUT specs
   - ✅ Existing Cashu wallets can deposit/withdraw without modification
   - ✅ No breaking changes to `/keys`, `/keysets`, `/swap` signatures

4. **Error Resilience**
   - ✅ Invalid LMSR prices rejected (0.5% tolerance)
   - ✅ Inactive keyset swaps rejected
   - ✅ Expired invoices rejected
   - ✅ Invalid proofs rejected
   - ✅ All errors return descriptive JSON (not HTML)

5. **Functional Requirements**
   - ✅ Deposit via Lightning (NUT-06) → tokens issued
   - ✅ Trade via swap (POST /swap) → outcome tokens issued
   - ✅ Market resolution (oracle event) → losing keyset inactive
   - ✅ Claim (winner swap) → sats issued minus rake
   - ✅ Withdraw via Lightning (NUT-05) → proofs burned, invoice paid
   - ✅ Rake accumulation tracked per market
   - ✅ Rake extractable by operator

6. **Cashu Compliance**
   - ✅ All proofs validate against keyset public keys
   - ✅ DLEQ proofs prevent signature forgery
   - ✅ Blind signatures prevent minting forgery
   - ✅ Denomination checks enforce power-of-2 limits
   - ✅ Keyset IDs stable across restarts

7. **Security**
   - ✅ Mint keys encrypted at rest (AES-256-GCM)
   - ✅ No user identification in swap requests
   - ✅ Oracle signature validation prevents resolution spoofing
   - ✅ BOLT11 validation prevents invoice spoofing
   - ✅ No unilateral minting (all tokens backed by proofs or rake)

8. **Performance**
   - ✅ Swap throughput > 100 requests/second
   - ✅ Lightning payment settlement < 10 seconds
   - ✅ Database queries < 100ms (p95)
   - ✅ Memory usage < 500MB under load

---

## Conclusion

This implementation plan specifies a **pure Cashu mint** for Cascade's binary prediction markets using **CDK Rust**. The design preserves privacy (bearer tokens, blind signatures), uses standard Cashu flows (NUT-06, NUT-03/04, NUT-05), and achieves outcome isolation via keyset deactivation.

**Key principles**:
1. **No escrow accounts** — Users hold bearer tokens
2. **Two keysets per market** — YES and NO are separate Cashu units
3. **LMSR in frontend** — Mint only validates prices
4. **Rake stays in mint** — Accumulates as liquidity
5. **Standard Cashu** — No custom `/trade` endpoint, no per-user keysets

The mint is ready for implementation once this plan is approved and any blocking questions are resolved.
