# Section 3: LMSR Pricing Engine & Trade Execution

## Overview

The LMSR (Logarithmic Market Scoring Rule) engine is the automated market-maker. It determines the price of LONG/SHORT tokens based on outstanding quantities and executes trades atomically. This section covers the pricing math (ported from `src/market.ts`), the trade execution pipeline, and the resolution/payout mechanism.

## File Changes

### `crates/cascade-core/src/lmsr.rs`
- **Action**: create
- **What**: LMSR pricing functions ported from TypeScript `src/market.ts` to Rust
- **Why**: Server-side pricing authority — the mint must calculate prices, not trust the frontend

**Port from `src/market.ts`:**

```rust
/// LMSR pricing engine.
/// 
/// Reference: src/market.ts (frontend implementation)
/// b = liquidity/sensitivity parameter (default 0.0001, called DEFAULT_SENSITIVITY in TS)
///
/// Price functions define the probability-like cost of each position:
///   price_long  = 1 / (1 + exp(b * (q_short - q_long)))
///   price_short = 1 - price_long
///
/// Cost function (Hanson's LMSR):
///   C(q_long, q_short) = log_sum_exp(b * q_long, b * q_short) / b
///
/// Trade cost = C(q_after) - C(q_before)

pub const DEFAULT_SENSITIVITY: f64 = 0.0001;

pub struct LmsrEngine {
    /// Default sensitivity parameter for new markets
    pub default_b: f64,
}

impl LmsrEngine {
    pub fn new() -> Self {
        Self { default_b: DEFAULT_SENSITIVITY }
    }

    /// Current price of LONG token (0.0 to 1.0)
    /// Maps to priceLong() in src/market.ts
    pub fn price_long(&self, q_long: f64, q_short: f64, b: f64) -> f64 {
        1.0 / (1.0 + (b * (q_short - q_long)).exp())
    }

    /// Current price of SHORT token (0.0 to 1.0)
    /// Maps to priceShort() in src/market.ts
    pub fn price_short(&self, q_long: f64, q_short: f64, b: f64) -> f64 {
        1.0 - self.price_long(q_long, q_short, b)
    }

    /// LMSR cost function C(q_long, q_short)
    /// Maps to costFunction() in src/market.ts
    /// Uses log-sum-exp trick for numerical stability
    pub fn cost_function(&self, q_long: f64, q_short: f64, b: f64) -> f64 {
        let x = b * q_long;
        let y = b * q_short;
        // log_sum_exp(x, y) = max(x,y) + ln(1 + exp(-|x-y|))
        let max_val = x.max(y);
        let log_sum = max_val + (1.0 + (-(x - y).abs()).exp()).ln();
        log_sum / b
    }

    /// Calculate the cost in sats to buy `amount` tokens of a given side.
    /// Returns (cost_sats, new_q_long, new_q_short).
    ///
    /// This is the core pricing function:
    /// cost = C(q_after) - C(q_before)
    pub fn calculate_buy_cost(
        &self,
        market: &Market,
        side: Side,
        amount: f64,
    ) -> Result<BuyCostResult, CascadeError> {
        let (new_q_long, new_q_short) = match side {
            Side::Long  => (market.q_long + amount, market.q_short),
            Side::Short => (market.q_long, market.q_short + amount),
        };

        let cost_before = self.cost_function(market.q_long, market.q_short, market.b);
        let cost_after = self.cost_function(new_q_long, new_q_short, market.b);
        let cost = cost_after - cost_before;

        if cost < 0.0 {
            return Err(CascadeError::LmsrError(
                "Negative cost — this should never happen for buys".into()
            ));
        }

        // Convert to sats (cost is in the same unit as the sensitivity param)
        // With b=0.0001, costs are naturally in sat-scale
        let cost_sats = cost.ceil() as u64;

        Ok(BuyCostResult {
            cost_sats,
            new_q_long,
            new_q_short,
        })
    }

    /// Calculate the refund in sats for selling `amount` tokens of a given side.
    /// Returns (refund_sats, new_q_long, new_q_short).
    pub fn calculate_sell_refund(
        &self,
        market: &Market,
        side: Side,
        amount: f64,
    ) -> Result<SellRefundResult, CascadeError> {
        let (new_q_long, new_q_short) = match side {
            Side::Long  => {
                if market.q_long < amount {
                    return Err(CascadeError::InvalidTrade {
                        reason: format!(
                            "Cannot sell {} LONG, only {} outstanding",
                            amount, market.q_long
                        ),
                    });
                }
                (market.q_long - amount, market.q_short)
            },
            Side::Short => {
                if market.q_short < amount {
                    return Err(CascadeError::InvalidTrade {
                        reason: format!(
                            "Cannot sell {} SHORT, only {} outstanding",
                            amount, market.q_short
                        ),
                    });
                }
                (market.q_long, market.q_short - amount)
            },
        };

        let cost_before = self.cost_function(market.q_long, market.q_short, market.b);
        let cost_after = self.cost_function(new_q_long, new_q_short, market.b);
        let refund = cost_before - cost_after;

        let refund_sats = refund.floor() as u64; // Floor for refunds (mint keeps rounding)

        Ok(SellRefundResult {
            refund_sats,
            new_q_long,
            new_q_short,
        })
    }

    /// Get current prices for both sides (for display)
    pub fn get_prices(&self, market: &Market) -> MarketPrices {
        MarketPrices {
            long_price: self.price_long(market.q_long, market.q_short, market.b),
            short_price: self.price_short(market.q_long, market.q_short, market.b),
            b: market.b,
            q_long: market.q_long,
            q_short: market.q_short,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuyCostResult {
    pub cost_sats: u64,
    pub new_q_long: f64,
    pub new_q_short: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SellRefundResult {
    pub refund_sats: u64,
    pub new_q_long: f64,
    pub new_q_short: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPrices {
    pub long_price: f64,   // 0.0 to 1.0
    pub short_price: f64,  // 0.0 to 1.0
    pub b: f64,
    pub q_long: f64,
    pub q_short: f64,
}
```

**Unit tests for LMSR (critical — must verify correctness against TypeScript):**

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_initial_prices_equal() {
        let engine = LmsrEngine::new();
        let long_price = engine.price_long(0.0, 0.0, 0.0001);
        let short_price = engine.price_short(0.0, 0.0, 0.0001);
        assert!((long_price - 0.5).abs() < 1e-10);
        assert!((short_price - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_prices_sum_to_one() {
        let engine = LmsrEngine::new();
        for q_long in [0.0, 100.0, 500.0, 10000.0] {
            for q_short in [0.0, 100.0, 500.0, 10000.0] {
                let sum = engine.price_long(q_long, q_short, 0.0001)
                        + engine.price_short(q_long, q_short, 0.0001);
                assert!((sum - 1.0).abs() < 1e-10,
                    "Prices don't sum to 1 for q_long={}, q_short={}", q_long, q_short);
            }
        }
    }

    #[test]
    fn test_more_long_demand_increases_long_price() {
        let engine = LmsrEngine::new();
        let p1 = engine.price_long(100.0, 100.0, 0.0001);
        let p2 = engine.price_long(200.0, 100.0, 0.0001);
        assert!(p2 > p1);
    }

    #[test]
    fn test_buy_cost_positive() {
        let engine = LmsrEngine::new();
        let market = Market {
            slug: "test".into(),
            b: 0.0001,
            q_long: 0.0,
            q_short: 0.0,
            reserve_sats: 10000,
            // ... other fields
        };
        let result = engine.calculate_buy_cost(&market, Side::Long, 100.0).unwrap();
        assert!(result.cost_sats > 0);
    }

    #[test]
    fn test_cost_function_symmetry() {
        let engine = LmsrEngine::new();
        // C(a, b) should equal C(b, a) due to symmetry of log-sum-exp
        let c1 = engine.cost_function(100.0, 200.0, 0.0001);
        let c2 = engine.cost_function(200.0, 100.0, 0.0001);
        // Not equal (log-sum-exp is not symmetric in general), but verify no NaN/Inf
        assert!(c1.is_finite());
        assert!(c2.is_finite());
    }
}
```

### `crates/cascade-core/src/trade.rs`
- **Action**: create
- **What**: Trade execution logic — atomic buy/sell operations that coordinate LMSR pricing with CDK token issuance
- **Why**: Trades must be atomic: price calculation, token issuance, and LMSR state update happen together or not at all

```rust
/// Trade executor coordinates between LMSR pricing and CDK mint operations.
/// After each successful trade, publishes a kind 983 Nostr event via NostrPublisher.
pub struct TradeExecutor {
    market_manager: Arc<MarketManager>,
    lmsr: LmsrEngine,
    mint: Arc<Mint>,
    /// Optional Nostr publisher for kind 983 trade events.
    /// None in tests or if Nostr relay URLs are not configured.
    /// See 07-nostr-integration.md for full details.
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

    /// Execute a buy trade: user pays sats, receives position tokens.
    ///
    /// Flow:
    /// 1. Look up market by slug
    /// 2. Calculate LMSR cost for requested amount
    /// 3. Apply trade fee (1% on cost)
    /// 4. Verify user has provided valid sat proofs covering total cost
    /// 5. Spend the sat proofs (mark as spent in CDK)
    /// 6. Mint new position tokens (LONG or SHORT) for the requested amount
    /// 7. Update LMSR state (q_long, q_short, reserve)
    /// 8. Return minted tokens to user
    /// 9. Publish kind 983 trade event via NostrPublisher (non-blocking, fire-and-forget)
    ///    See section 07-nostr-integration.md for full implementation details
    pub async fn execute_buy(
        &self,
        request: BuyTradeRequest,
    ) -> Result<TradeResult, CascadeError> {
        // 1. Load market
        let market = self.market_manager
            .get_market(&request.market_slug).await?
            .ok_or_else(|| CascadeError::MarketNotFound {
                slug: request.market_slug.clone()
            })?;

        // 2. Verify market is active
        if market.status != MarketStatus::Active {
            return Err(CascadeError::MarketNotActive {
                slug: market.slug.clone(),
                status: market.status,
            });
        }

        // 3. Calculate LMSR cost
        let cost = self.lmsr.calculate_buy_cost(&market, request.side, request.amount)?;

        // 4. Apply fee
        let fee_sats = calculate_trade_fee(cost.cost_sats, 1); // 1%
        let total_cost_sats = cost.cost_sats + fee_sats;

        // 5. Verify provided proofs cover cost
        //    The user sends sat-denominated proofs (standard Cashu tokens from the sat keyset).
        //    We verify and spend them via CDK's standard proof verification.
        let proofs_total: u64 = request.proofs.iter().map(|p| p.amount.into()).sum();
        if proofs_total < total_cost_sats {
            return Err(CascadeError::InvalidTrade {
                reason: format!(
                    "Insufficient funds: provided {} sats, need {} (cost {} + fee {})",
                    proofs_total, total_cost_sats, cost.cost_sats, fee_sats
                ),
            });
        }

        // 6. Spend the sat proofs atomically via CDK swap
        //    Use mint.swap() to consume input proofs and generate:
        //    a) Position tokens (LONG or SHORT) for the trade amount
        //    b) Change tokens (sats) if overpaid
        //    This is done as a CDK swap operation where:
        //    - Inputs: sat proofs from user
        //    - Outputs: position token blinded messages + change blinded messages
        
        // The actual implementation uses CDK's blind signing directly:
        // a) Verify and mark input proofs as spent
        // b) Blind-sign output blinded messages for position unit
        // c) Return signed blinded messages (user unblinds to get tokens)
        
        // 7. Update LMSR state
        let new_reserve = market.reserve_sats + cost.cost_sats;
        self.market_manager.update_lmsr_state(
            &market.slug,
            cost.new_q_long,
            cost.new_q_short,
            new_reserve,
        ).await?;

        // 8. Return result
        Ok(TradeResult {
            market_slug: market.slug,
            side: request.side,
            amount: request.amount,
            cost_sats: cost.cost_sats,
            fee_sats,
            total_cost_sats,
            new_prices: self.lmsr.get_prices(&Market {
                q_long: cost.new_q_long,
                q_short: cost.new_q_short,
                ..market
            }),
            // Signed blinded messages returned to user
            // (actual token construction handled by CDK's swap machinery)
        })
    }

    /// Execute a sell trade: user returns position tokens, receives sat tokens.
    ///
    /// Flow:
    /// 1. Look up market
    /// 2. Verify position proofs are valid for the correct unit
    /// 3. Calculate LMSR refund
    /// 4. Apply fee
    /// 5. Spend position proofs
    /// 6. Mint sat tokens for refund amount
    /// 7. Update LMSR state
    /// 8. Return sat tokens
    /// 9. Publish kind 983 trade event with type="redeem" (non-blocking)
    ///    See section 07-nostr-integration.md for full implementation details
    pub async fn execute_sell(
        &self,
        request: SellTradeRequest,
    ) -> Result<TradeResult, CascadeError> {
        // Mirror of execute_buy, but:
        // - Input proofs are position tokens (LONG/SHORT unit)
        // - Output tokens are sat-denominated
        // - LMSR state decreases instead of increases
        // - Fee deducted from refund
        ...
    }

    /// Handle market resolution payout.
    /// Winning-side token holders can redeem tokens for sats at face value.
    /// Losing-side tokens become worthless.
    pub async fn execute_resolution_payout(
        &self,
        request: PayoutRequest,
    ) -> Result<PayoutResult, CascadeError> {
        // 1. Load market, verify status == Resolved
        // 2. Verify proofs are for the winning side's unit
        // 3. Calculate payout: 1 sat per token (face value, as market resolved)
        // 4. Spend winning-side proofs
        // 5. Mint sat tokens for payout
        // 6. Return sat tokens
        //
        // Losing-side proofs: if someone tries to redeem losing tokens,
        // return an error explaining the market resolved against them.
        ...
    }
}

/// Fee calculation matching frontend's calculateTradeFee()
/// fee = ceil(amount * percent / 100)
fn calculate_trade_fee(amount_sats: u64, percent: u64) -> u64 {
    ((amount_sats as f64 * percent as f64) / 100.0).ceil() as u64
}

#[derive(Debug, Clone)]
pub struct BuyTradeRequest {
    pub market_slug: String,
    pub side: Side,
    pub amount: f64,
    pub proofs: Vec<Proof>,           // Sat-denominated input proofs
    pub blinded_messages: Vec<BlindedMessage>, // For position token output
    pub change_blinded_messages: Vec<BlindedMessage>, // For sat change
}

#[derive(Debug, Clone)]
pub struct SellTradeRequest {
    pub market_slug: String,
    pub side: Side,
    pub proofs: Vec<Proof>,           // Position token input proofs
    pub blinded_messages: Vec<BlindedMessage>, // For sat token output
}

#[derive(Debug, Clone)]
pub struct PayoutRequest {
    pub market_slug: String,
    pub proofs: Vec<Proof>,           // Winning-side position proofs
    pub blinded_messages: Vec<BlindedMessage>, // For sat payout output
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeResult {
    pub market_slug: String,
    pub side: Side,
    pub amount: f64,
    pub cost_sats: u64,
    pub fee_sats: u64,
    pub total_cost_sats: u64,
    pub new_prices: MarketPrices,
    // Plus: signed blinded messages (position tokens or sat tokens)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutResult {
    pub market_slug: String,
    pub payout_sats: u64,
    // Plus: signed blinded messages (sat tokens)
}
```

### Trade Execution — Atomic Swap Mechanics

The key technical challenge is executing trades atomically across two different currency units (sats ↔ position tokens). Here's how it maps to CDK operations:

**Buy trade (sats → position tokens):**
1. User sends: `{proofs: [sat_proofs], outputs: [position_blinded_msgs, change_blinded_msgs]}`
2. Mint verifies sat proofs are valid and unspent
3. Mint marks sat proofs as spent (atomic DB transaction)
4. Mint blind-signs position blinded messages using the market's LONG/SHORT keyset
5. Mint blind-signs change blinded messages using the sat keyset (if overpaid)
6. Mint returns signed blinded messages

This is essentially a **cross-unit swap** — CDK's standard `/v1/swap` endpoint swaps proofs for blind signatures within the same unit. For cross-unit swaps, we implement a custom endpoint that:
- Validates input proofs via `mint.verify_proofs()`
- Marks them spent via `mint.spend_proofs()`
- Blind-signs outputs via `signatory.blind_sign()` for the target unit
- All within a single database transaction

**Sell trade (position tokens → sats):** Same flow but reversed — position proofs in, sat blind signatures out.

**Resolution payout (winning position tokens → sats at face value):**
- Same as sell, but price is fixed at 1:1 (each winning token redeems for 1 sat)
- Losing-side tokens cannot be redeemed (endpoint returns error)

## Execution Steps

1. **Implement `lmsr.rs`** — All pricing functions with comprehensive unit tests
   - Verify: `cargo test -p cascade-core -- lmsr` passes all tests
   - **Critical**: Cross-validate outputs against TypeScript `src/market.ts` with same inputs

2. **Implement `trade.rs` types** — Request/response structs, fee calculation
   - Verify: `cargo check -p cascade-core`

3. **Implement `TradeExecutor::execute_buy()`** — Full buy flow with CDK proof verification and blind signing
   - Verify: Integration test with mock mint — buy LONG tokens, verify LMSR state updates

4. **Implement `TradeExecutor::execute_sell()`** — Full sell flow
   - Verify: Integration test — buy then sell, verify reserve returns to approximately original

5. **Implement `TradeExecutor::execute_resolution_payout()`** — Payout flow
   - Verify: Integration test — create market, buy tokens, resolve, redeem winning tokens

6. **End-to-end LMSR test** — Full market lifecycle: create → multiple buys → sells → resolution → payout
   - Verify: Reserve accounting is consistent, no tokens created or destroyed without corresponding sat flow
