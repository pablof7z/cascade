# Section 4: HTTP API — Standard NUT Endpoints + Custom Cascade Routes

## Overview

The HTTP layer has two parts:
1. **Standard Cashu NUT endpoints** — Served by `cdk-axum` out of the box. The frontend's `@cashu/cashu-ts` library calls these automatically.
2. **Custom Cascade endpoints** — Additional Axum routes under `/v1/cascade/` for market management, trading, pricing, and resolution.

Both share the same Axum application and port.

## Standard NUT Endpoints (provided by `cdk-axum`)

These require **zero custom code** — `cdk-axum` registers them automatically when you create the Axum router from a CDK `Mint` instance:

| Method | Path | NUT | Purpose |
|--------|------|-----|---------|
| GET | `/v1/info` | NUT-06 | Mint info (name, pubkey, supported NUTs, supported methods) |
| GET | `/v1/keys` | NUT-01 | Active keyset public keys |
| GET | `/v1/keys/{keyset_id}` | NUT-01 | Keys for a specific keyset |
| GET | `/v1/keysets` | NUT-02 | List all keysets (id, unit, active) |
| POST | `/v1/mint/quote/bolt11` | NUT-04 | Request a Lightning invoice for minting |
| GET | `/v1/mint/quote/bolt11/{quote_id}` | NUT-04 | Check mint quote status |
| POST | `/v1/mint/bolt11` | NUT-04 | Mint tokens after invoice paid |
| POST | `/v1/melt/quote/bolt11` | NUT-05 | Request a melt quote (tokens → Lightning) |
| GET | `/v1/melt/quote/bolt11/{quote_id}` | NUT-05 | Check melt quote status |
| POST | `/v1/melt/bolt11` | NUT-05 | Melt tokens (pay Lightning invoice) |
| POST | `/v1/swap` | NUT-03 | Swap proofs for new blinded signatures (same unit) |
| POST | `/v1/checkstate` | NUT-07 | Check proof states (spent/unspent/pending) |
| POST | `/v1/restore` | NUT-09 | Restore tokens from blinded messages |

**Frontend compatibility**: The `@cashu/cashu-ts` library (used internally by `NDKCashuWallet`) calls these endpoints directly. As long as the mint is NUT-compliant (which CDK guarantees), the frontend wallet works without modification.

**Keyset discovery flow** (how frontend finds market keysets):
1. Frontend calls `GET /v1/keysets` → receives `{keysets: [{id: "00abc123", unit: "LONG_btc-100k", active: true}, ...]}`
2. Frontend filters by `unit === "LONG_btc-100k"` to find the keyset ID
3. Frontend uses the keyset ID for constructing/verifying proofs

## Custom Cascade Endpoints

### File Changes

### `crates/cascade-api/src/lib.rs`
- **Action**: create
- **What**: Module declarations and the main `build_server()` function that composes CDK + Cascade routes
- **Why**: Single entry point for constructing the complete Axum application

```rust
pub mod routes;
pub mod handlers;
pub mod types;

use axum::Router;
use cdk_axum::create_mint_router;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;

/// Build the complete HTTP server combining CDK standard routes and Cascade custom routes.
pub async fn build_server(
    mint: Arc<Mint>,
    market_manager: Arc<MarketManager>,
    trade_executor: Arc<TradeExecutor>,
    config: &MintConfig,
) -> anyhow::Result<Router> {
    // 1. Create CDK standard NUT router
    let cdk_router = create_mint_router(mint.clone()).await?;

    // 2. Create Cascade custom router
    let cascade_router = routes::cascade_routes(
        market_manager.clone(),
        trade_executor.clone(),
    );

    // 3. Compose into single app
    let app = Router::new()
        .merge(cdk_router)                     // /v1/info, /v1/keys, etc.
        .nest("/v1/cascade", cascade_router)    // /v1/cascade/markets, etc.
        .layer(CorsLayer::permissive())         // CORS for frontend
        .layer(TraceLayer::new_for_http());     // Request logging

    Ok(app)
}
```

### `crates/cascade-api/src/routes.rs`
- **Action**: create
- **What**: Route definitions for all custom Cascade endpoints
- **Why**: Clean route registration separate from handler logic

```rust
use axum::{routing::{get, post}, Router};

pub fn cascade_routes(
    market_manager: Arc<MarketManager>,
    trade_executor: Arc<TradeExecutor>,
) -> Router {
    Router::new()
        // Market management
        .route("/markets", get(handlers::market::list_markets))
        .route("/markets", post(handlers::market::create_market))
        .route("/markets/:slug", get(handlers::market::get_market))

        // Trading
        .route("/trade/buy", post(handlers::trade::buy))
        .route("/trade/sell", post(handlers::trade::sell))
        .route("/trade/payout", post(handlers::trade::payout))

        // Pricing
        .route("/price/:slug", get(handlers::price::get_prices))
        .route("/price/:slug/quote", post(handlers::price::get_quote))

        // Resolution
        .route("/resolve/:slug", post(handlers::resolve::resolve_market))

        // Shared state
        .with_state(AppState {
            market_manager,
            trade_executor,
        })
}

#[derive(Clone)]
pub struct AppState {
    pub market_manager: Arc<MarketManager>,
    pub trade_executor: Arc<TradeExecutor>,
}
```

### `crates/cascade-api/src/types.rs`
- **Action**: create
- **What**: Request and response DTOs for all Cascade endpoints
- **Why**: Typed API contract — serialization/deserialization with serde

```rust
// === Market Endpoints ===

#[derive(Debug, Deserialize)]
pub struct CreateMarketRequest {
    pub event_id: String,           // Nostr event ID (hex)
    pub slug: String,               // d-tag from kind 982
    pub title: String,
    pub description: String,
    pub b: Option<f64>,             // LMSR sensitivity (default: 0.0001)
    pub initial_reserve_sats: u64,  // Seed reserve from creator
    pub creator_pubkey: String,     // hex pubkey
}

#[derive(Debug, Serialize)]
pub struct MarketResponse {
    pub event_id: String,
    pub slug: String,
    pub title: String,
    pub description: String,
    pub status: MarketStatus,
    pub prices: MarketPrices,
    pub reserve_sats: u64,
    pub keysets: MarketKeysets,
    pub created_at: i64,
}

#[derive(Debug, Serialize)]
pub struct MarketKeysets {
    pub long_keyset_id: String,     // CDK keyset ID for LONG unit
    pub long_unit: String,          // "LONG_{slug}"
    pub short_keyset_id: String,    // CDK keyset ID for SHORT unit
    pub short_unit: String,         // "SHORT_{slug}"
}

#[derive(Debug, Serialize)]
pub struct MarketListResponse {
    pub markets: Vec<MarketResponse>,
}

// === Trade Endpoints ===

#[derive(Debug, Deserialize)]
pub struct BuyRequest {
    pub market_slug: String,
    pub side: Side,                 // "LONG" or "SHORT"
    pub amount: f64,                // Number of tokens to buy
    pub proofs: Vec<SerializedProof>,     // Sat proofs as payment
    pub outputs: Vec<SerializedBlindedMessage>, // For position tokens
    pub change_outputs: Option<Vec<SerializedBlindedMessage>>, // For sat change
}

#[derive(Debug, Serialize)]
pub struct BuyResponse {
    pub market_slug: String,
    pub side: Side,
    pub amount: f64,
    pub cost_sats: u64,
    pub fee_sats: u64,
    pub signatures: Vec<SerializedBlindSignature>, // Signed position tokens
    pub change_signatures: Option<Vec<SerializedBlindSignature>>, // Signed change
    pub new_prices: MarketPrices,
}

#[derive(Debug, Deserialize)]
pub struct SellRequest {
    pub market_slug: String,
    pub side: Side,
    pub proofs: Vec<SerializedProof>,     // Position token proofs
    pub outputs: Vec<SerializedBlindedMessage>, // For sat refund tokens
}

#[derive(Debug, Serialize)]
pub struct SellResponse {
    pub market_slug: String,
    pub side: Side,
    pub amount: f64,                // Amount sold (from proofs)
    pub refund_sats: u64,
    pub fee_sats: u64,
    pub signatures: Vec<SerializedBlindSignature>, // Signed sat tokens
    pub new_prices: MarketPrices,
}

#[derive(Debug, Deserialize)]
pub struct PayoutRequest {
    pub market_slug: String,
    pub proofs: Vec<SerializedProof>,     // Winning-side position proofs
    pub outputs: Vec<SerializedBlindedMessage>, // For sat payout tokens
}

#[derive(Debug, Serialize)]
pub struct PayoutResponse {
    pub market_slug: String,
    pub payout_sats: u64,
    pub signatures: Vec<SerializedBlindSignature>,
}

// === Price Endpoints ===

#[derive(Debug, Serialize)]
pub struct PriceResponse {
    pub market_slug: String,
    pub prices: MarketPrices,
}

#[derive(Debug, Deserialize)]
pub struct QuoteRequest {
    pub side: Side,
    pub amount: f64,
    pub direction: TradeDirection,  // "buy" or "sell"
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TradeDirection {
    Buy,
    Sell,
}

#[derive(Debug, Serialize)]
pub struct QuoteResponse {
    pub market_slug: String,
    pub side: Side,
    pub direction: TradeDirection,
    pub amount: f64,
    pub cost_or_refund_sats: u64,
    pub fee_sats: u64,
    pub total_sats: u64,
    pub price_before: f64,
    pub price_after: f64,
}

// === Resolution Endpoint ===

#[derive(Debug, Deserialize)]
pub struct ResolveRequest {
    pub outcome: Side,              // LONG (YES) or SHORT (NO)
    pub proof: ResolveProof,        // Authorization (Nostr event signature or admin key)
}

#[derive(Debug, Deserialize)]
pub struct ResolveProof {
    /// Nostr event (kind TBD) signed by market creator authorizing resolution
    pub nostr_event: Option<String>,
    /// Admin secret key (for development/testing only)
    pub admin_key: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ResolveResponse {
    pub market_slug: String,
    pub outcome: Side,
    pub status: MarketStatus,
}

// === Error Response ===

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub code: String,       // Machine-readable error code
    pub detail: Option<String>,
}
```

### `crates/cascade-api/src/handlers/market.rs`
- **Action**: create
- **What**: HTTP handlers for market CRUD operations
- **Why**: Thin handlers that validate input, call MarketManager, format responses

```rust
/// POST /v1/cascade/markets — Create a new prediction market
pub async fn create_market(
    State(state): State<AppState>,
    Json(request): Json<CreateMarketRequest>,
) -> Result<Json<MarketResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 1. Validate request (slug format, reserve minimum, pubkey format)
    // 2. Call state.market_manager.create_market(params)
    // 3. Convert to MarketResponse including keyset IDs
    // 4. Return 201 Created
}

/// GET /v1/cascade/markets — List all markets
pub async fn list_markets(
    State(state): State<AppState>,
    Query(params): Query<ListMarketsParams>,
) -> Result<Json<MarketListResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Optional query params: ?status=active
}

/// GET /v1/cascade/markets/:slug — Get a single market
pub async fn get_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<MarketResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Look up by slug, return 404 if not found
}
```

### `crates/cascade-api/src/handlers/trade.rs`
- **Action**: create
- **What**: HTTP handlers for buy/sell/payout operations
- **Why**: Delegates to TradeExecutor, handles proof deserialization and error mapping

```rust
/// POST /v1/cascade/trade/buy — Buy position tokens with sats
pub async fn buy(
    State(state): State<AppState>,
    Json(request): Json<BuyRequest>,
) -> Result<Json<BuyResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 1. Deserialize proofs and blinded messages from JSON to CDK types
    // 2. Call state.trade_executor.execute_buy(...)
    // 3. Serialize signed blinded messages back to JSON
    // 4. Return response with new prices
    //
    // Error mapping:
    // - MarketNotFound → 404
    // - MarketNotActive → 409 Conflict
    // - InsufficientReserve → 400
    // - InvalidTrade → 400
    // - CdkError (proof invalid) → 400
    // - Internal → 500
}

/// POST /v1/cascade/trade/sell — Sell position tokens for sats
pub async fn sell(
    State(state): State<AppState>,
    Json(request): Json<SellRequest>,
) -> Result<Json<SellResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Same pattern as buy but reversed
}

/// POST /v1/cascade/trade/payout — Redeem winning tokens after resolution
pub async fn payout(
    State(state): State<AppState>,
    Json(request): Json<PayoutRequest>,
) -> Result<Json<PayoutResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 1. Verify market is resolved
    // 2. Verify proofs are for winning side
    // 3. Execute payout at 1:1 sat value
    // 4. Return signed sat tokens
}
```

### `crates/cascade-api/src/handlers/price.rs`
- **Action**: create
- **What**: HTTP handlers for price queries (read-only, no proofs needed)
- **Why**: Frontend needs to display current prices without executing trades

```rust
/// GET /v1/cascade/price/:slug — Current market prices
pub async fn get_prices(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> Result<Json<PriceResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Load market, return LMSR prices
}

/// POST /v1/cascade/price/:slug/quote — Get a quote for a hypothetical trade
pub async fn get_quote(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(request): Json<QuoteRequest>,
) -> Result<Json<QuoteResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Calculate cost/refund WITHOUT executing
    // Shows price impact of the trade
}
```

### `crates/cascade-api/src/handlers/resolve.rs`
- **Action**: create
- **What**: HTTP handler for market resolution
- **Why**: Authorized endpoint to set market outcome

```rust
/// POST /v1/cascade/resolve/:slug — Resolve a market
pub async fn resolve_market(
    State(state): State<AppState>,
    Path(slug): Path<String>,
    Json(request): Json<ResolveRequest>,
) -> Result<Json<ResolveResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 1. Verify authorization:
    //    - Check nostr_event is signed by market creator pubkey
    //    - OR check admin_key matches configured admin key (dev only)
    // 2. Call market_manager.resolve_market(slug, outcome)
    // 3. Return resolution confirmation
}
```

### `crates/cascade-api/src/handlers/mod.rs`
- **Action**: create
- **What**: Module declarations for handler submodules
- **Why**: Standard Rust module organization

```rust
pub mod market;
pub mod trade;
pub mod price;
pub mod resolve;
```

## API Error Response Format

All error responses follow a consistent format:

```json
{
    "error": "Human-readable error message",
    "code": "MARKET_NOT_FOUND",
    "detail": "Optional additional context"
}
```

Error code mapping:

| Code | HTTP Status | When |
|------|------------|------|
| `MARKET_NOT_FOUND` | 404 | Market slug doesn't exist |
| `MARKET_NOT_ACTIVE` | 409 | Trying to trade on resolved/archived market |
| `INSUFFICIENT_FUNDS` | 400 | Proofs don't cover cost |
| `INVALID_PROOFS` | 400 | Proofs are invalid, already spent, or wrong unit |
| `INVALID_REQUEST` | 400 | Malformed request body |
| `WRONG_SIDE` | 400 | Trying to redeem losing-side tokens |
| `UNAUTHORIZED` | 401 | Resolution without valid authorization |
| `INTERNAL_ERROR` | 500 | Unexpected server error |

## CORS Configuration

The mint must allow cross-origin requests from the frontend at `cascade.f7z.io`:

```rust
CorsLayer::new()
    .allow_origin(["https://cascade.f7z.io".parse().unwrap()])
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers([header::CONTENT_TYPE, header::AUTHORIZATION])
    .max_age(Duration::from_secs(3600))
```

For development, use `CorsLayer::permissive()` and tighten for production.

## Execution Steps

1. **Implement `lib.rs` with `build_server()`** — Compose CDK router + Cascade router
   - Verify: `cargo check -p cascade-api`

2. **Implement `types.rs`** — All request/response DTOs with serde derives
   - Verify: JSON serialization round-trip tests

3. **Implement `handlers/price.rs`** — Read-only price endpoints (simplest, good for testing)
   - Verify: `curl http://localhost:3338/v1/cascade/price/test-market` returns prices

4. **Implement `handlers/market.rs`** — Market CRUD
   - Verify: Create market via POST, verify it appears in GET list and GET by slug

5. **Implement `handlers/trade.rs`** — Buy/sell/payout handlers
   - Verify: Full trade round-trip with actual CDK proofs

6. **Implement `handlers/resolve.rs`** — Resolution handler
   - Verify: Resolve market, verify status change, verify payout works

7. **Implement error handling middleware** — Consistent error response format
   - Verify: Invalid requests return proper error JSON with correct HTTP status codes
