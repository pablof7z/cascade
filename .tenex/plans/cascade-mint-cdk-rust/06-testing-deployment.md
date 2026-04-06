# Section 6: Testing Strategy & Deployment

## Overview

This section covers the complete testing strategy (unit, integration, end-to-end), build and deployment instructions, reverse proxy configuration, and frontend integration checklist.

## Testing Strategy

### Unit Tests

Located alongside source files in each crate using `#[cfg(test)]` modules.

#### LMSR Engine Tests (`cascade-core/src/lmsr.rs`)
- **Initial prices equal**: `price_long(0, 0, b) == price_short(0, 0, b) == 0.5`
- **Prices sum to 1.0**: For all valid `(q_long, q_short, b)` combinations
- **Monotonicity**: More demand for LONG increases LONG price
- **Buy cost positive**: All buys cost > 0 sats
- **Sell refund ≤ buy cost**: Round-trip buy+sell should lose to spread
- **Cost function numerical stability**: No NaN/Inf for extreme values
- **Cross-validation with TypeScript**: Run same inputs through both `src/market.ts` and Rust `lmsr.rs`, compare outputs to 6 decimal places
- **Sensitivity parameter edge cases**: Very small b (0.00001), very large b (1.0)

#### Market Type Tests (`cascade-core/src/market.rs`)
- **Unit naming**: `long_unit()` returns `CurrencyUnit::custom("LONG_{slug}")`
- **Serialization round-trip**: Market → JSON → Market preserves all fields
- **Status transitions**: Active → Resolved (valid), Resolved → Active (invalid)

#### Fee Calculation Tests (`cascade-core/src/trade.rs`)
- **1% fee**: `calculate_trade_fee(100, 1) == 1`
- **Rounding up**: `calculate_trade_fee(50, 1) == 1` (ceil of 0.5)
- **Zero amount**: `calculate_trade_fee(0, 1) == 0`

#### Database Tests (`cascade-core/src/db.rs`)
- **CRUD operations**: Insert, get, update, list markets
- **Trade recording**: Insert trade, list trades by market
- **LMSR snapshots**: Insert snapshot, query price history
- **Migration idempotency**: Run migrations twice, no errors

#### NostrPublisher Tests (`cascade-core/src/nostr_publisher.rs`)
- **Keypair derivation determinism**: Same seed → same Nostr pubkey, every time
- **Keypair independence from CDK**: Nostr key ≠ any CDK BIP-32 derived key for same seed
- **Event construction**: `publish_trade()` produces valid kind 983 event with all required tags
- **Tag format compliance**: `e` tag has valid hex event ID, `amount` is positive integer string, `unit` is "sat", `direction` is "yes"|"no", `type` is "issue"|"redeem", `price` is integer in [1, 999999]
- **Price PPM conversion**: `price_to_ppm(50, 100) == 500_000` (50%), `price_to_ppm(1, 100) == 10_000` (1%), edge cases (0 amount, extreme ratios)
- **No trader identity**: Constructed event has no `p` tag
- **Content is empty**: `event.content == ""`

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keypair_deterministic() {
        let seed = [42u8; 32];
        // Derive twice, verify same pubkey
        let key1 = derive_nostr_keypair(&seed);
        let key2 = derive_nostr_keypair(&seed);
        assert_eq!(key1.public_key(), key2.public_key());
    }

    #[test]
    fn test_price_to_ppm() {
        // 50% probability: cost 50 sats for 100 tokens
        assert_eq!(NostrPublisher::price_to_ppm(50, 100), 500_000);
        // 1% probability: cost 1 sat for 100 tokens
        assert_eq!(NostrPublisher::price_to_ppm(1, 100), 10_000);
        // Edge: zero amount defaults to 500_000
        assert_eq!(NostrPublisher::price_to_ppm(0, 0), 500_000);
        // Edge: clamped to [1, 999_999]
        assert!(NostrPublisher::price_to_ppm(100, 1) <= 999_999);
    }

    #[test]
    fn test_event_structure() {
        // Construct event params and verify tag structure
        let params = TradeEventParams {
            market_event_id: "abcd1234".repeat(8),
            amount: 1000,
            unit: "sat".into(),
            direction: "yes".into(),
            trade_type: "issue".into(),
            price_ppm: 623_000,
        };
        // Verify event has kind 983, empty content, correct tags
        // (implementation constructs unsigned event for inspection)
    }

    #[test]
    fn test_no_p_tag() {
        // Verify constructed event contains no p tag (trader privacy)
    }
}
```

#### Config Tests (`cascade-mint/src/config.rs`)
- **Load from TOML**: Parse example config
- **Env var override**: ENV takes precedence over TOML
- **Missing required fields**: Clear error messages
- **Default values**: Unset optional fields use defaults

### Integration Tests

Located in `crates/cascade-core/tests/` and `crates/cascade-api/tests/`.

#### CDK Mint Integration (`cascade-core/tests/mint_integration.rs`)

```rust
/// Test that creates a CDK Mint with in-memory SQLite,
/// generates market keysets, and verifies they appear in keyset list.
#[tokio::test]
async fn test_market_keyset_creation() {
    // 1. Create MintSqliteDatabase with ":memory:"
    // 2. Create DbSignatory with test seed
    // 3. Build Mint via MintBuilder
    // 4. Create MarketManager
    // 5. Call create_market("btc-100k", ...)
    // 6. Verify GET /v1/keysets includes LONG_btc-100k and SHORT_btc-100k units
    // 7. Verify keyset IDs are deterministic (create again with same seed → same IDs)
}
```

#### Trade Execution Integration (`cascade-core/tests/trade_integration.rs`)

```rust
/// Full trade lifecycle: create market → buy LONG → check state → sell LONG → check state
#[tokio::test]
async fn test_buy_sell_lifecycle() {
    // 1. Set up mint with mock Lightning backend (for sat deposits)
    // 2. Create market with initial reserve
    // 3. Mint sat tokens (simulating a Lightning deposit)
    // 4. Execute buy: sat proofs → LONG tokens
    // 5. Verify: LMSR state updated, reserve increased, proofs spent
    // 6. Execute sell: LONG tokens → sat proofs
    // 7. Verify: LMSR state returned toward original, reserve decreased
    // 8. Verify: Total sats in system consistent (no creation/destruction beyond fees)
}
```

#### Resolution Integration (`cascade-core/tests/resolution_integration.rs`)

```rust
/// Resolution lifecycle: create → buy → resolve → payout winning → reject losing
#[tokio::test]
async fn test_resolution_payout() {
    // 1. Create market, buy LONG and SHORT tokens
    // 2. Resolve market as LONG (YES wins)
    // 3. Redeem LONG tokens → receive sat tokens (1:1)
    // 4. Attempt to redeem SHORT tokens → error (losing side)
    // 5. Verify total sats out ≤ total sats in (accounting is sound)
}
```

#### Kind 983 Event Publishing Integration (`cascade-core/tests/nostr_integration.rs`)

```rust
/// Verify kind 983 events are correctly constructed during trade execution.
/// Uses a mock relay (or channel inspection) to capture published events.
#[tokio::test]
async fn test_trade_publishes_kind_983() {
    // 1. Create NostrPublisher with test seed and no real relays
    //    (capture events from the mpsc channel instead)
    // 2. Create TradeExecutor with the publisher
    // 3. Execute a buy trade
    // 4. Receive the event from the channel
    // 5. Verify: kind == 983
    // 6. Verify: e tag matches market's nostr_event_id
    // 7. Verify: amount tag matches trade amount
    // 8. Verify: direction == "yes" for Side::Long
    // 9. Verify: type == "issue" for buy trade
    // 10. Verify: price tag is valid ppm integer
    // 11. Verify: content is empty string
    // 12. Verify: no p tag present (trader privacy)
    // 13. Verify: pubkey matches mint's derived Nostr pubkey
}

#[tokio::test]
async fn test_sell_publishes_redeem_event() {
    // Same as above but for sell trade:
    // Verify type == "redeem" and direction matches
}

#[tokio::test]
async fn test_trade_succeeds_without_publisher() {
    // Create TradeExecutor with nostr_publisher = None
    // Execute trade — must succeed without error
    // Verifies Nostr is truly optional
}
```

#### Mock Lightning Backend

For integration tests without a real LND node:

```rust
/// Mock implementation of MintPayment trait for testing
pub struct MockLightning {
    invoices: Arc<Mutex<HashMap<String, MockInvoice>>>,
}

impl MockLightning {
    pub fn new() -> Self { ... }

    /// Auto-mark an invoice as paid (simulate instant payment)
    pub async fn auto_pay(&self, payment_hash: &str) { ... }
}

// Implement the MintPayment trait from CDK
// - create_invoice: Generate fake invoice, store in HashMap
// - check_invoice_status: Return Paid if auto_pay was called
// - pay_invoice: Always succeed, deduct from mock balance
```

### HTTP API Tests

Located in `crates/cascade-api/tests/`.

```rust
/// Test the full HTTP API using axum's test utilities
#[tokio::test]
async fn test_market_api() {
    // 1. Build app with mock Lightning
    // 2. POST /v1/cascade/markets — create market
    // 3. GET /v1/cascade/markets — verify it appears
    // 4. GET /v1/cascade/markets/btc-100k — verify details
    // 5. GET /v1/cascade/price/btc-100k — verify initial prices 50/50
}

#[tokio::test]
async fn test_trade_api() {
    // 1. Set up market with sat tokens available
    // 2. POST /v1/cascade/trade/buy — buy LONG tokens
    // 3. Verify response has signatures and new prices
    // 4. POST /v1/cascade/trade/sell — sell LONG tokens back
    // 5. Verify refund sats received
}

#[tokio::test]
async fn test_standard_nut_endpoints() {
    // Verify CDK standard endpoints work alongside custom routes
    // 1. GET /v1/info — returns mint info
    // 2. GET /v1/keysets — returns keysets including market units
    // 3. POST /v1/checkstate — returns proof states
}

#[tokio::test]
async fn test_error_responses() {
    // 1. GET /v1/cascade/markets/nonexistent — 404 with error JSON
    // 2. POST /v1/cascade/trade/buy with bad proofs — 400 with error JSON
    // 3. POST /v1/cascade/resolve/active-market without auth — 401
}
```

### Cross-Validation Tests

Create a test that runs the same LMSR calculations in both TypeScript and Rust:

```rust
/// Generate test vectors from TypeScript, verify Rust matches
#[test]
fn test_lmsr_cross_validation() {
    // Pre-computed values from src/market.ts:
    // priceLong(0, 0, 0.0001) = 0.5
    // priceLong(1000, 0, 0.0001) = 0.5249791...
    // costFunction(0, 0, 0.0001) = 6931.471805599453
    // costFunction(1000, 500, 0.0001) = 10099.022...
    //
    // Run same inputs through Rust LmsrEngine, assert within 1e-6
    let engine = LmsrEngine::new();
    assert!((engine.price_long(0.0, 0.0, 0.0001) - 0.5).abs() < 1e-10);
    // ... more test vectors
}
```

### Test Commands

```bash
# Run all tests
cargo test --workspace

# Run only LMSR tests
cargo test -p cascade-core -- lmsr

# Run only integration tests
cargo test -p cascade-core --test mint_integration
cargo test -p cascade-core --test trade_integration
cargo test -p cascade-api --test '*'

# Run only Nostr publisher tests
cargo test -p cascade-core -- nostr

# Run Nostr integration tests
cargo test -p cascade-core --test nostr_integration

# Run with logging for debugging
RUST_LOG=debug cargo test --workspace -- --nocapture
```

---

## Build Instructions

### Prerequisites

```bash
# Rust toolchain (stable)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# SQLite development libraries (for sqlx)
# macOS: brew install sqlite
# Ubuntu: apt install libsqlite3-dev

# Protocol Buffers compiler (for LND gRPC)
# macOS: brew install protobuf
# Ubuntu: apt install protobuf-compiler
```

### Build Commands

```bash
# Development build
cargo build --workspace

# Release build (optimized)
cargo build --release

# Binary location
ls -la target/release/cascade-mint

# Check binary size (expect ~20-40MB)
du -h target/release/cascade-mint
```

### Cross-Compilation (if building on macOS for Linux VPS)

```bash
# Add Linux target
rustup target add x86_64-unknown-linux-gnu

# Install cross-compiler
# macOS: brew install FiloSottile/musl-cross/musl-cross
# Or use `cross` tool:
cargo install cross

# Build for Linux
cross build --release --target x86_64-unknown-linux-gnu
```

---

## Deployment

### Directory Layout on VPS

```
/opt/cascade-mint/
├── cascade-mint              # Binary
├── config.toml               # Configuration
├── .env                      # Environment variables
├── data/
│   ├── cascade_mint.db       # SQLite database
│   └── mint_seed.key         # Master seed (BACKUP THIS!)
└── migrations/
    └── 001_cascade_tables.sql
```

### First Run

```bash
# 1. Copy binary and config to VPS
scp target/release/cascade-mint user@vps:/opt/cascade-mint/
scp config.toml.example user@vps:/opt/cascade-mint/config.toml

# 2. Edit config.toml with real LND paths
vim /opt/cascade-mint/config.toml

# 3. Create .env file
cp .env.example /opt/cascade-mint/.env
vim /opt/cascade-mint/.env

# 4. First run (generates seed, creates database)
cd /opt/cascade-mint
./cascade-mint

# 5. IMMEDIATELY backup the generated seed
cp data/mint_seed.key /secure/backup/location/
```

### systemd Service

```ini
# /etc/systemd/system/cascade-mint.service
[Unit]
Description=Cascade Cashu Mint
After=network.target lnd.service
Requires=lnd.service

[Service]
Type=simple
User=cascade
Group=cascade
WorkingDirectory=/opt/cascade-mint
ExecStart=/opt/cascade-mint/cascade-mint
Restart=always
RestartSec=5

# Environment
EnvironmentFile=/opt/cascade-mint/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/cascade-mint/data
ProtectHome=true

[Install]
WantedBy=multi-user.target
```

```bash
# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable cascade-mint
sudo systemctl start cascade-mint
sudo systemctl status cascade-mint

# View logs
sudo journalctl -u cascade-mint -f
```

### Nginx Reverse Proxy

```nginx
# /etc/nginx/sites-available/mint.f7z.io
server {
    listen 443 ssl http2;
    server_name mint.f7z.io;

    ssl_certificate /etc/letsencrypt/live/mint.f7z.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mint.f7z.io/privkey.pem;

    # Standard headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;

    location / {
        proxy_pass http://127.0.0.1:3338;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (for NUT-17 if enabled)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts for long-polling mint quotes
        proxy_read_timeout 300;
        proxy_connect_timeout 10;
    }
}

# HTTP → HTTPS redirect
server {
    listen 80;
    server_name mint.f7z.io;
    return 301 https://$host$request_uri;
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/mint.f7z.io /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL certificate (if not already done)
sudo certbot --nginx -d mint.f7z.io
```

### Alternative: Caddy (simpler)

```
# /etc/caddy/Caddyfile
mint.f7z.io {
    reverse_proxy 127.0.0.1:3338
}
```

Caddy handles SSL automatically via Let's Encrypt.

---

## Frontend Integration Checklist

After the mint is deployed and running:

### 1. Environment Variable

Set in the frontend deployment:

```env
VITE_CASCADE_MINT_URL=https://mint.f7z.io
```

The frontend's `walletStore.ts` reads: `import.meta.env.VITE_CASCADE_MINT_URL || import.meta.env.VITE_CASHU_MINT_URL`

### 2. Verify Standard NUT Endpoints

```bash
# Mint info
curl https://mint.f7z.io/v1/info

# Expected response (example):
{
  "name": "Cascade Markets Mint",
  "pubkey": "02abc123...",
  "version": "cascade-mint/0.1.0",
  "description": "Cashu mint for Cascade prediction markets",
  "nuts": {
    "4": {"methods": [{"method": "bolt11", "unit": "sat"}], "disabled": false},
    "5": {"methods": [{"method": "bolt11", "unit": "sat"}], "disabled": false},
    ...
  }
}

# Keysets
curl https://mint.f7z.io/v1/keysets

# Expected: includes sat keyset + any market keysets
{
  "keysets": [
    {"id": "00abcdef", "unit": "sat", "active": true},
    {"id": "00123456", "unit": "LONG_btc-100k", "active": true},
    {"id": "00789abc", "unit": "SHORT_btc-100k", "active": true}
  ]
}

# Keys for a specific keyset
curl https://mint.f7z.io/v1/keys/00abcdef
```

### 3. Verify Cascade Custom Endpoints

```bash
# List markets
curl https://mint.f7z.io/v1/cascade/markets

# Get prices
curl https://mint.f7z.io/v1/cascade/price/btc-100k

# Get trade quote
curl -X POST https://mint.f7z.io/v1/cascade/price/btc-100k/quote \
  -H 'Content-Type: application/json' \
  -d '{"side": "LONG", "amount": 100, "direction": "buy"}'
```

### 4. Frontend Keyset Discovery

The frontend's `cashuProofs.ts:getKeysetForSide()` returns a unit name like `"LONG_btc-100k"`. It must map this to a CDK keyset ID by querying `/v1/keysets` and filtering by unit. This may require a small frontend utility:

```typescript
// Potential frontend helper (outside this plan's scope, but documenting the need):
async function getKeysetIdForUnit(mintUrl: string, unitName: string): Promise<string> {
  const response = await fetch(`${mintUrl}/v1/keysets`);
  const data = await response.json();
  const keyset = data.keysets.find((k: any) => k.unit === unitName && k.active);
  if (!keyset) throw new Error(`No active keyset for unit ${unitName}`);
  return keyset.id;
}
```

### 5. Smoke Test Sequence

After deployment, run through this sequence to verify everything works:

1. `GET /v1/info` → 200 with mint info ✓
2. `GET /v1/keysets` → 200 with sat keyset ✓
3. `POST /v1/cascade/markets` → 201 with new market ✓
4. `GET /v1/keysets` → now includes LONG/SHORT keysets ✓
5. `POST /v1/mint/quote/bolt11` → 200 with Lightning invoice ✓
6. Pay Lightning invoice (testnet) ✓
7. `POST /v1/mint/bolt11` → 200 with signed tokens ✓
8. `POST /v1/cascade/trade/buy` → 200 with position tokens ✓
9. `GET /v1/cascade/price/{slug}` → prices reflect trade ✓
10. `POST /v1/cascade/trade/sell` → 200 with sat tokens ✓
11. `POST /v1/cascade/resolve/{slug}` → 200 market resolved ✓
12. `POST /v1/cascade/trade/payout` → 200 winning tokens → sats ✓
13. Query Nostr relay for kind 983 events from mint pubkey → verify trade events published ✓
    ```bash
    # Verify kind 983 events were published (requires nak or similar tool)
    nak req -k 983 --author <mint-hex-pubkey> wss://relay.damus.io
    # Expected: at least 2 events (buy from step 8, sell from step 10)
    # Each event should have: e tag, amount, unit, direction, type, price tags
    # Content should be empty string
    # No p tag present (trader privacy)
    ```

---

## Monitoring & Operations

### Logging

The mint uses `tracing` with structured JSON logging:

```env
# Development
RUST_LOG=cascade_mint=debug,cascade_core=debug,cascade_api=debug,cdk=info,tower_http=debug

# Production
RUST_LOG=cascade_mint=info,cascade_core=info,cascade_api=info,cdk=warn,tower_http=info
```

### Key Metrics to Monitor

- **Request latency**: Track via `tower_http::TraceLayer` (logged per-request)
- **Trade volume**: Query `trades` table: `SELECT COUNT(*), SUM(total_sats) FROM trades WHERE created_at > ?`
- **Active markets**: `SELECT COUNT(*) FROM markets WHERE status = 'active'`
- **LND balance**: Monitor via LND's own APIs/tools
- **Database size**: Monitor `cascade_mint.db` file size
- **Proof states**: `SELECT state, COUNT(*) FROM proof GROUP BY state` (CDK table)
- **Kind 983 events published**: Monitor via tracing logs — search for "Published kind 983 event" (success) and "Failed to publish kind 983 event" (failure)
- **Relay connectivity**: Monitor relay connection logs from nostr-sdk — warn on persistent disconnects

### Backup Strategy

**Critical: Back up these files regularly:**
1. `data/mint_seed.key` — **MOST IMPORTANT**. Without this, all tokens become irredeemable. Back up once, store offline.
2. `data/cascade_mint.db` — SQLite database. Back up daily. Use `.backup` command or copy when mint is stopped.

```bash
# Safe SQLite backup (while mint is running)
sqlite3 /opt/cascade-mint/data/cascade_mint.db ".backup /backup/cascade_mint_$(date +%Y%m%d).db"
```

### Disaster Recovery

If the database is lost but seed is preserved:
1. Recreate database with fresh `MintSqliteDatabase::new()`
2. CDK can regenerate keysets from seed (deterministic derivation)
3. Cascade markets table must be recreated from external source (Nostr kind 982 events)
4. Outstanding proofs cannot be recovered (users must present them)
5. LMSR state is lost — markets may need to be re-initialized

If the seed is lost:
- **All tokens become irredeemable** — this is catastrophic
- No recovery possible
- Must create new mint with new seed, all existing tokens worthless

## Execution Steps

1. **Write LMSR cross-validation test vectors** — Run TypeScript LMSR functions, record outputs
   - Verify: Test vectors match src/market.ts exactly

2. **Implement MockLightning** — Mock MintPayment trait for integration tests
   - Verify: Can create invoices, auto-pay, and check status

3. **Write integration tests** — Keyset creation, trade lifecycle, resolution lifecycle
   - Verify: `cargo test --workspace` passes all tests

4. **Write HTTP API tests** — All endpoints with valid and invalid inputs
   - Verify: Error responses have correct HTTP status codes and error JSON

5. **Create deployment artifacts** — systemd service file, nginx config, .env.example
   - Verify: Files are syntactically valid

6. **Build release binary** — `cargo build --release`
   - Verify: Binary runs, responds to `/v1/info`

7. **Deploy to VPS** — Copy binary, configure, start service
   - Verify: `curl https://mint.f7z.io/v1/info` returns mint info

8. **Run smoke test sequence** — All 12 steps from the checklist above
   - Verify: Each step succeeds

9. **Update frontend env** — Set `VITE_CASCADE_MINT_URL=https://mint.f7z.io`
   - Verify: Frontend wallet connects to mint, can deposit sats

10. **Write NostrPublisher unit tests** — Keypair determinism, event construction, ppm conversion, no p-tag
    - Verify: `cargo test -p cascade-core -- nostr` passes all tests

11. **Write Nostr integration tests** — Trade publishes kind 983, sell publishes redeem, trade works without publisher
    - Verify: `cargo test -p cascade-core --test nostr_integration` passes

12. **Verify kind 983 on relay** — After smoke test, query relay for mint's published events
    - Verify: `nak req -k 983 --author <mint-pubkey> wss://relay.damus.io` returns trade events
