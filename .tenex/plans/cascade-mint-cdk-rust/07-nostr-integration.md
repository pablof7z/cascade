# Section 7: Nostr Integration — Kind 983 Trade Event Publishing

## Overview

Every time a trade executes on the mint (token issue or redeem), the mint publishes a kind 983 Nostr event recording the trade metadata. Events are signed by the mint's own Nostr keypair — derived deterministically from the master seed — and published to configured relays. Trade events contain no trader identity, preserving Cashu's privacy guarantees while creating a public, auditable trade history.

**Spec reference:** `tenex/docs/kind-983-trade-event.md`

**Key constraint:** Relay failures MUST NOT block trades. Publishing is fire-and-forget with logging. A failed relay write is an operational concern, never a trade-blocking error.

## File Changes

### `crates/cascade-core/src/nostr_publisher.rs`
- **Action**: create
- **What**: NostrPublisher struct that constructs, signs, and publishes kind 983 events
- **Why**: Encapsulates all Nostr logic in a single module — trade executor calls one method, doesn't know about event construction or relay management

```rust
use nostr_sdk::prelude::*;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{info, warn, error};

/// Publishes kind 983 trade events to Nostr relays.
///
/// Architecture:
/// - Holds a pre-derived Nostr keypair (from mint master seed)
/// - Maintains persistent relay connections via nostr-sdk Client
/// - Exposes a non-blocking `publish_trade()` that sends events through
///   an mpsc channel to a background task
///
/// The background task approach ensures:
/// 1. Trade execution never blocks on relay I/O
/// 2. Relay reconnection is handled transparently
/// 3. Events are buffered if relays are temporarily unreachable
pub struct NostrPublisher {
    /// Sender side of the event channel — trade executor sends here
    event_tx: mpsc::UnboundedSender<UnsignedEvent>,
    /// Mint's Nostr public key (for logging/diagnostics)
    pub mint_pubkey: PublicKey,
    /// Nostr keypair (needed for signing events synchronously before sending)
    keys: Keys,
}

/// Parameters needed to construct a kind 983 event.
/// Passed from TradeExecutor after a successful trade.
#[derive(Debug, Clone)]
pub struct TradeEventParams {
    /// Kind 982 event ID for the market (hex string)
    pub market_event_id: String,
    /// Token quantity in base units (satoshis)
    pub amount: u64,
    /// Currency unit (e.g. "sat")
    pub unit: String,
    /// Market side: "yes" or "no"
    pub direction: String,
    /// Trade type: "issue" or "redeem"
    pub trade_type: String,
    /// Average execution price in ppm (0–999999)
    pub price_ppm: u64,
}

impl NostrPublisher {
    /// Create a new NostrPublisher from the mint's master seed.
    ///
    /// Keypair derivation: The Nostr secret key is derived from the
    /// master seed using HMAC-SHA256 with domain separator "nostr-key".
    /// This ensures the Nostr key is deterministic (same seed = same pubkey)
    /// but cryptographically independent from the BIP-32 keys CDK uses
    /// for Cashu blind signing.
    ///
    /// ```
    /// nostr_secret = HMAC-SHA256(key=master_seed, msg=b"cascade-nostr-key")
    /// ```
    pub async fn new(
        master_seed: &[u8; 32],
        relay_urls: Vec<String>,
    ) -> Result<Self, anyhow::Error> {
        // 1. Derive Nostr keypair from master seed
        use bitcoin::hashes::{hmac, sha256, Hash, HashEngine};
        let mut hmac_engine = hmac::HmacEngine::<sha256::Hash>::new(master_seed);
        hmac_engine.input(b"cascade-nostr-key");
        let hmac_result = hmac::Hmac::<sha256::Hash>::from_engine(hmac_engine);
        let secret_bytes: [u8; 32] = hmac_result.to_byte_array();

        let secret_key = SecretKey::from_slice(&secret_bytes)?;
        let keys = Keys::new(secret_key);
        let mint_pubkey = keys.public_key();

        info!("Nostr publisher initialized with mint pubkey: {}", mint_pubkey);

        // 2. Create background relay client
        let client = Client::new(&keys);
        for url in &relay_urls {
            match RelayUrl::parse(url) {
                Ok(relay_url) => { client.add_relay(relay_url).await?; }
                Err(e) => { warn!("Invalid relay URL '{}': {}", url, e); }
            }
        }
        client.connect().await;

        // 3. Spawn background event publisher
        let (event_tx, mut event_rx) = mpsc::unbounded_channel::<UnsignedEvent>();
        let publish_keys = keys.clone();
        tokio::spawn(async move {
            while let Some(unsigned_event) = event_rx.recv().await {
                // Sign the event
                match unsigned_event.sign(&publish_keys) {
                    Ok(signed_event) => {
                        match client.send_event(signed_event).await {
                            Ok(output) => {
                                info!(
                                    "Published kind 983 event: {} (accepted by {} relays)",
                                    output.id(),
                                    output.success().len()
                                );
                                if !output.failed().is_empty() {
                                    warn!(
                                        "Kind 983 event {} failed on relays: {:?}",
                                        output.id(),
                                        output.failed()
                                    );
                                }
                            }
                            Err(e) => {
                                error!("Failed to publish kind 983 event: {}", e);
                                // Do NOT retry — log and move on.
                                // Future enhancement: dead-letter queue to SQLite.
                            }
                        }
                    }
                    Err(e) => {
                        error!("Failed to sign kind 983 event: {}", e);
                    }
                }
            }
        });

        Ok(Self {
            event_tx,
            mint_pubkey,
            keys,
        })
    }

    /// Publish a kind 983 trade event. Non-blocking — returns immediately.
    ///
    /// This method:
    /// 1. Constructs the unsigned event with all required tags
    /// 2. Sends it to the background publisher via channel
    /// 3. Returns Ok(()) immediately — the caller never waits on relay I/O
    ///
    /// If the channel is full or closed, logs an error but does NOT
    /// return an error to the caller. Trade execution must never fail
    /// due to Nostr publishing.
    pub fn publish_trade(&self, params: TradeEventParams) {
        // Validate price_ppm range
        let price_ppm = params.price_ppm.min(999999).max(1);

        // Construct the unsigned event
        let event = EventBuilder::new(
            Kind::Custom(983),
            "",  // content is empty per spec
        )
        .tag(Tag::event(EventId::from_hex(&params.market_event_id).unwrap_or_default()))
        .tag(Tag::custom(
            TagKind::custom("amount"),
            vec![params.amount.to_string()],
        ))
        .tag(Tag::custom(
            TagKind::custom("unit"),
            vec![params.unit],
        ))
        .tag(Tag::custom(
            TagKind::custom("direction"),
            vec![params.direction],
        ))
        .tag(Tag::custom(
            TagKind::custom("type"),
            vec![params.trade_type],
        ))
        .tag(Tag::custom(
            TagKind::custom("price"),
            vec![price_ppm.to_string()],
        ))
        .build(self.keys.public_key());

        if let Err(e) = self.event_tx.send(event) {
            error!(
                "Failed to queue kind 983 event (channel closed): {}",
                e
            );
        }
    }

    /// Convert an LMSR floating-point price (0.0–1.0) to ppm (0–999999).
    ///
    /// For buy trades, the average price is: cost_sats / amount
    /// Then convert to ppm: (avg_price * 1_000_000) as u64
    ///
    /// For trades that walk the LMSR curve, this gives the average
    /// execution price across the entire trade.
    pub fn price_to_ppm(cost_sats: u64, amount: u64) -> u64 {
        if amount == 0 {
            return 500_000; // Default to 50% if no amount
        }
        // avg_price = cost / amount (this is a ratio 0.0–1.0 for binary markets)
        // ppm = avg_price * 1_000_000
        let avg_price = cost_sats as f64 / amount as f64;
        let ppm = (avg_price * 1_000_000.0).round() as u64;
        ppm.clamp(1, 999_999)
    }
}
```

**Design decisions:**

| Decision | Rationale |
|---|---|
| HMAC-SHA256 derivation instead of BIP-32 | Simpler than BIP-32 for a single key. No need for hierarchical derivation — just one Nostr keypair per mint. Domain separator `"cascade-nostr-key"` prevents key reuse with CDK's BIP-32 paths. |
| Unbounded mpsc channel | Trades are infrequent relative to channel capacity. Bounded channels risk blocking trades if relays are slow. If the channel somehow grows unbounded, the mint has bigger problems. |
| Sign-then-send in background task | Signing is fast (secp256k1) but keeping it in the background task simplifies the publish_trade() interface to a pure data-in call. |
| No retry logic | Relay failures are expected and tolerable. A dead-letter queue to SQLite is a future enhancement — for now, log and move on. The event is lost, but trade integrity is preserved. |
| Price as ppm via `price_to_ppm()` | Matches the kind 983 spec's integer ppm format. Calculated from actual cost/amount ratio, giving the true average execution price including LMSR curve walk. |

### `crates/cascade-core/src/market.rs` (modification)
- **Action**: modify
- **What**: Add `nostr_event_id: Option<String>` field to the `Market` struct
- **Why**: Each market references a kind 982 Nostr event. The mint needs this event ID to construct the `e` tag in kind 983 trade events. This field is populated when a market is created (either from a known kind 982 event or generated).

```rust
// Add to existing Market struct:
pub struct Market {
    // ... existing fields ...

    /// Kind 982 Nostr event ID for this market (hex string).
    /// Used as the `e` tag value in kind 983 trade events.
    /// None if market was created before Nostr integration.
    pub nostr_event_id: Option<String>,
}
```

### `crates/cascade-core/src/lib.rs` (modification)
- **Action**: modify
- **What**: Add `pub mod nostr_publisher;` to module declarations
- **Why**: Expose the new module from the cascade-core crate

## Integration with Trade Executor

The `TradeExecutor` (defined in section 03, `trade.rs`) must be modified to accept and use a `NostrPublisher`:

### `crates/cascade-core/src/trade.rs` (modification)
- **Action**: modify
- **What**: Add `NostrPublisher` as an optional dependency of `TradeExecutor`, call `publish_trade()` after every successful trade
- **Why**: Every trade must publish a kind 983 event. Optional because tests may run without Nostr.

**Changes to `TradeExecutor`:**

```rust
pub struct TradeExecutor {
    market_manager: Arc<MarketManager>,
    lmsr: LmsrEngine,
    mint: Arc<Mint>,
    /// Optional Nostr publisher for kind 983 trade events.
    /// None in tests or if Nostr is disabled.
    nostr_publisher: Option<Arc<NostrPublisher>>,
}

impl TradeExecutor {
    pub fn new(
        market_manager: Arc<MarketManager>,
        mint: Arc<Mint>,
        nostr_publisher: Option<Arc<NostrPublisher>>,
    ) -> Self {
        Self {
            market_manager,
            lmsr: LmsrEngine::new(),
            mint,
            nostr_publisher,
        }
    }

    pub async fn execute_buy(
        &self,
        request: BuyTradeRequest,
    ) -> Result<TradeResult, CascadeError> {
        // ... existing steps 1–8 unchanged ...

        let result = TradeResult { /* ... existing ... */ };

        // Step 9: Publish kind 983 trade event (non-blocking, fire-and-forget)
        if let Some(publisher) = &self.nostr_publisher {
            if let Some(ref event_id) = market.nostr_event_id {
                let direction = match request.side {
                    Side::Long => "yes",
                    Side::Short => "no",
                };
                publisher.publish_trade(TradeEventParams {
                    market_event_id: event_id.clone(),
                    amount: request.amount as u64,
                    unit: "sat".to_string(),
                    direction: direction.to_string(),
                    trade_type: "issue".to_string(),
                    price_ppm: NostrPublisher::price_to_ppm(
                        cost.cost_sats,
                        request.amount as u64,
                    ),
                });
            }
        }

        Ok(result)
    }

    pub async fn execute_sell(
        &self,
        request: SellTradeRequest,
    ) -> Result<TradeResult, CascadeError> {
        // ... existing sell logic unchanged ...

        // After successful sell, publish kind 983 with type "redeem"
        if let Some(publisher) = &self.nostr_publisher {
            if let Some(ref event_id) = market.nostr_event_id {
                let direction = match request.side {
                    Side::Long => "yes",
                    Side::Short => "no",
                };
                publisher.publish_trade(TradeEventParams {
                    market_event_id: event_id.clone(),
                    amount: sell_amount as u64,
                    unit: "sat".to_string(),
                    direction: direction.to_string(),
                    trade_type: "redeem".to_string(),
                    price_ppm: NostrPublisher::price_to_ppm(
                        refund.refund_sats,
                        sell_amount as u64,
                    ),
                });
            }
        }

        Ok(result)
    }

    // Note: execute_resolution_payout() does NOT publish kind 983.
    // Resolution payouts are not trades — they are redemptions of
    // winning tokens at face value. The market is already resolved.
}
```

**Mapping trade fields to kind 983 tags:**

| Trade field | Kind 983 tag | Mapping |
|---|---|---|
| `market.nostr_event_id` | `e` | Direct: hex event ID of the kind 982 market |
| `request.amount` | `amount` | Direct: token quantity as integer |
| `"sat"` | `unit` | Hardcoded: all Cascade markets are sat-denominated |
| `Side::Long → "yes"`, `Side::Short → "no"` | `direction` | Enum mapping |
| Buy → `"issue"`, Sell → `"redeem"` | `type` | By operation type |
| `cost_sats / amount * 1_000_000` | `price` | Calculated average price in ppm |

## Initialization

### `crates/cascade-mint/src/main.rs` (modification)
- **Action**: modify
- **What**: Initialize `NostrPublisher` during mint startup, pass to `TradeExecutor`
- **Why**: Publisher must be created once at startup with relay connections, then shared

**Add to the existing startup sequence (after seed loading, before server start):**

```rust
// After: let seed = load_or_generate_seed(&config.seed.path)?;
// After: let signatory = DbSignatory::new(seed, ...);

// Initialize Nostr publisher (optional — skip if no relay URLs configured)
let nostr_publisher = if !config.nostr.relay_urls.is_empty() {
    match NostrPublisher::new(&seed, config.nostr.relay_urls.clone()).await {
        Ok(publisher) => {
            info!(
                "Nostr publisher ready — mint pubkey: {}",
                publisher.mint_pubkey
            );
            Some(Arc::new(publisher))
        }
        Err(e) => {
            warn!("Failed to initialize Nostr publisher: {}. Trades will not publish events.", e);
            None
        }
    }
} else {
    info!("No Nostr relay URLs configured — kind 983 publishing disabled");
    None
};

// Pass to TradeExecutor
let trade_executor = TradeExecutor::new(
    market_manager.clone(),
    mint.clone(),
    nostr_publisher,
);
```

## Configuration

### `crates/cascade-mint/src/config.rs` (modification)
- **Action**: modify
- **What**: Add `NostrConfig` struct with relay URLs
- **Why**: Relay URLs must be configurable per deployment

```rust
#[derive(Debug, Clone, Deserialize)]
pub struct NostrConfig {
    /// Relay URLs to publish kind 983 events to.
    /// If empty, Nostr publishing is disabled.
    #[serde(default)]
    pub relay_urls: Vec<String>,
}

impl Default for NostrConfig {
    fn default() -> Self {
        Self {
            relay_urls: vec![],
        }
    }
}

// Add to existing Config struct:
pub struct Config {
    // ... existing fields ...

    /// Nostr relay configuration for trade event publishing
    #[serde(default)]
    pub nostr: NostrConfig,
}
```

## Execution Steps

1. **Add `nostr-sdk` dependency** — Update workspace `Cargo.toml` and `cascade-core/Cargo.toml` (see section 01 updates)
   - Verify: `cargo check -p cascade-core` compiles with nostr-sdk

2. **Implement `nostr_publisher.rs`** — Full `NostrPublisher` struct with keypair derivation, channel-based publishing, and `publish_trade()` method
   - Verify: Unit tests pass (see section 06 updates for test specs)

3. **Add `nostr_event_id` to `Market` struct** — Update `market.rs` and migration
   - Verify: `cargo check -p cascade-core` compiles

4. **Integrate with `TradeExecutor`** — Add optional `NostrPublisher` field, call `publish_trade()` in `execute_buy()` and `execute_sell()`
   - Verify: Existing trade tests still pass (publisher is None in tests)

5. **Add `NostrConfig` to config** — Update `config.rs` and `config.toml.example`
   - Verify: Config loads with and without `[nostr]` section

6. **Initialize in `main.rs`** — Create publisher at startup, wire into trade executor
   - Verify: Mint starts with `NOSTR_RELAY_URLS` set, logs "Nostr publisher ready"

7. **Integration test** — Construct kind 983 event, verify tag structure matches spec
   - Verify: `cargo test -p cascade-core -- nostr` passes
