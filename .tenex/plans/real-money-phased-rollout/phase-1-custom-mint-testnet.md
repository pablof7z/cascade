# Phase 1: Custom Cascade-Mint on Testnet

## Goal

Deploy the custom `cascade-mint` (Rust/CDK) against testnet Lightning and validate the complete LMSR trading flow with worthless testnet sats. This proves the mint's correctness — LMSR pricing, multi-keyset architecture, trade execution, market settlement — before any real money is at stake.

## Prerequisites

- Phase 0 gates all passed (wallet UX validated with real sats on third-party mint)
- `cascade-mint/` codebase compiles and passes existing unit tests
- Testnet Lightning node available (LND or CLN on signet/testnet)

## Infrastructure Setup

### Testnet Lightning Node
- **Option A (Recommended)**: Polar or local LND on regtest for development, then signet for team testing
- **Option B**: Voltage testnet node ($0/mo for testnet) for a more realistic network environment
- Configure in `cascade-mint/.env` via the LND connection parameters (`LND_GRPC_HOST`, `LND_MACAROON_PATH`, `LND_TLS_CERT_PATH` — see `.env.example`)

### Mint Deployment
- Deploy `cascade-mint` via Docker (`docker-compose.yml` already exists in `cascade-mint/`)
- Database: SQLite for testnet (already configured in migrations), PostgreSQL optional
- Host on a VPS or local machine — testnet doesn't need production-grade infra

### Monitoring (Establish Patterns for Phase 2)
- Add structured logging (tracing crate, already a dependency in the Rust codebase)
- Log every: mint quote, melt quote, trade execution, settlement, keyset creation
- Basic health endpoint (`GET /v1/health`) returning mint status, Lightning connectivity, DB status
- Prometheus metrics endpoint (or simple JSON stats) for: total proofs issued, total proofs redeemed, active markets, Lightning balance

## File Changes

### `cascade-mint/crates/cascade-core/src/lightning/lnd_client.rs`
- **Action**: Modify
- **What**: Verify and complete the LND gRPC integration. Ensure:
  - Invoice creation works (`add_invoice`)
  - Invoice status polling works (`lookup_invoice`)
  - Payment sending works (`send_payment_sync` for melt)
  - Connection error handling is robust (retries, timeouts)
- **Why**: Lightning is the on/off-ramp. Must be solid before mainnet.

### `cascade-mint/crates/cascade-api/src/lib.rs`
- **Action**: Modify
- **What**: Verify all custom endpoints are functional:
  - `POST /v1/cascade/trade` — accepts ecash proofs + market ID + direction (LONG/SHORT), returns new outcome tokens
  - `POST /v1/cascade/redeem` — accepts outcome tokens, returns generic ecash (if market resolved in holder's favor)
  - `POST /v1/cascade/settle` — triggered by market resolution, marks winning/losing keysets
  - Standard NUT-04/NUT-05 endpoints for deposit/withdraw
- **Why**: These are the Cascade-specific extensions to Cashu. They must work correctly for the product to function.

### `cascade-mint/crates/cascade-core/src/market.rs` (or equivalent)
- **Action**: Modify/Verify
- **What**: Validate LMSR implementation:
  - Cost function: `C(q) = b * ln(Σ exp(q_i / b))` where `b` is the liquidity parameter
  - Price function: `p_i = exp(q_i / b) / Σ exp(q_j / b)`
  - Trade cost: `cost = C(q_after) - C(q_before)` — this is what the user pays in sats
  - Verify prices always sum to 1.0 (within floating-point tolerance)
  - Verify the reserve (sum of all trade costs) always covers worst-case payout
  - 1% fee applied on top of LMSR cost
- **Why**: LMSR correctness is the mathematical foundation of solvency. If the cost function is wrong, the mint can become insolvent.

### `cascade-mint/migrations/` — verify schema completeness
- **Action**: Verify (modify if needed)
- **What**: Ensure migration files cover:
  - Markets table (market ID, status, outcomes, liquidity parameter `b`, current quantities)
  - Keysets table (keyset per outcome per market, linked to market)
  - Trades table (who traded what, at what LMSR cost, timestamp)
  - Escrow/Lightning table (invoices, payment status, escrow state)
  - Proofs table (standard Cashu proof tracking)
- **Why**: DB schema must support all operations before we can validate them.

### Frontend: Switch mint URL to testnet cascade-mint
- **Action**: Modify `src/lib/config.ts`
- **What**: Add ability to point `MINT_URL` at the testnet cascade-mint instance. This can be a separate env var (`MINT_URL_TESTNET`) or the same var with a testnet value.
- **Why**: Frontend must talk to the custom mint for trading integration testing.

### Frontend: Trading integration with custom mint
- **Action**: Modify `src/lib/components/BuySellPanel.svelte` and `src/lib/services/cashuService.ts`
- **What**: 
  - When buying a position: send generic ecash proofs to `/v1/cascade/trade` with market ID and direction
  - Receive outcome-specific ecash tokens (keyset identifies the outcome)
  - When selling/redeeming: send outcome tokens to `/v1/cascade/redeem`
  - Display LMSR-calculated price from the mint (or calculate locally and verify against mint)
- **Why**: This is where play-money CAS tokens get replaced with real Cashu ecash flowing through LMSR.

### Frontend: Market settlement flow
- **Action**: Modify position display and settlement components
- **What**:
  - After market resolution, winning tokens can be redeemed via `/v1/cascade/redeem`
  - Losing tokens become worthless (mint refuses redemption for losing keyset)
  - UI shows "Resolved: [outcome]" and "Redeem" button for winners
- **Why**: Settlement is the payoff. Users must be able to collect winnings.

## LMSR Validation Test Suite

This is the most critical testing in the entire rollout. Create a test harness that:

1. **Creates a binary market** with liquidity parameter `b = 1000`
2. **Executes a series of trades** and verifies:
   - Each trade cost matches `C(q_after) - C(q_before)` exactly
   - Prices after each trade sum to 1.0
   - The mint's Lightning balance ≥ sum of all market reserves
3. **Resolves the market** and verifies:
   - Winners can redeem at full face value (1 token = 1 sat)
   - Losers cannot redeem (mint rejects losing-keyset proofs)
   - Mint's remaining balance = fee revenue + any unredeemed winning tokens
4. **Stress tests**:
   - 100+ trades on a single market
   - Concurrent trades from multiple users
   - Edge cases: buying at extreme prices (near 0 or near 1), tiny amounts, maximum amounts
5. **Solvency invariant**: After every operation, assert: `Lightning_balance ≥ Σ(market_reserves) + treasury`

## Execution Order

1. **Stand up testnet Lightning node** — Regtest for dev, signet for team testing. Verify `lncli getinfo` works.

2. **Deploy cascade-mint on testnet** — `docker-compose up` with testnet config. Verify health endpoint returns OK.

3. **Verify NUT-04/NUT-05 basics** — Deposit testnet sats, get ecash, withdraw. Same flow as Phase 0 but against custom mint. Verify round-trip works.

4. **Create a test market** — Via API or admin tool, create a binary market. Verify two keysets are created (one per outcome).

5. **Execute test trades** — Buy LONG tokens, buy SHORT tokens, verify LMSR pricing. Run the full LMSR validation test suite.

6. **Resolve and settle** — Resolve the market, redeem winning tokens, verify losing tokens rejected. Check solvency invariant.

7. **Frontend integration** — Point frontend at testnet mint, execute trades via UI. Verify UX flow end-to-end.

8. **Add monitoring** — Deploy structured logging and health checks. Verify logs capture all operations. Set up basic alerting (email or Slack on errors).

9. **Team testing period** — 1-2 weeks of team members using the testnet instance. Document all bugs and UX issues.

## Phase 1 Go/No-Go Gates

Before proceeding to Phase 2:

- [ ] LMSR validation test suite passes 100% (all invariants hold)
- [ ] 50+ test trades executed without errors
- [ ] Market creation → trading → resolution → settlement cycle completes cleanly
- [ ] NUT-04/NUT-05 deposit/withdraw works on custom mint (>95% success rate)
- [ ] Concurrent trade handling verified (no race conditions or double-spends)
- [ ] Solvency invariant holds after every operation in test suite
- [ ] Monitoring captures all operations with structured logs
- [ ] Health endpoint operational and accurate
- [ ] No unresolved critical bugs from team testing period
- [ ] Frontend UX for trading works end-to-end on testnet
- [ ] Incident response runbook drafted (what to do if mint goes down, if trades fail, if Lightning channel depletes)

## Open Questions to Resolve During Phase 1

1. **Liquidity bootstrapping**: Who funds the initial LMSR reserve for each market? Options: platform funds it, market creator funds it, or pool from fees.
2. **Maximum market size**: Cap total liquidity per market? Suggested: 1M sats for Phase 2 launch.
3. **Reserve model**: Segregated reserves per market (safer, less capital efficient) vs. pooled reserves (riskier, more efficient)?
4. **Settlement timeout**: How long after resolution before unclaimed winnings expire?
5. **Fee structure**: 1% flat fee confirmed in product spec, but applied on entry, exit, or both?
