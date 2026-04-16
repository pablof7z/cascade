# M9 Exit Criteria: Signet Paper-Trading Gate

## Context

Milestone 9 is the "Signet Paper-Trading Gate" — the point at which the Cascade signet edition is stable and complete enough for real users to paper-trade end-to-end. It is defined in `docs/plan/end-to-end-launch-implementation.md:430–501` and sits after M8 (signet-specific config) and before M10 (mainnet production readiness).

The signet edition is configured via `web/.env.signet.example` which sets `PUBLIC_CASCADE_EDITION=signet`, disables Stripe top-ups, and points to a local mint at `http://127.0.0.1:3342`. Signet-specific code paths include:

- **Auto-pay for Lightning funding**: On signet, wallet-funding Lightning quotes auto-pay inside the mint (testnut-style), as clarified on 2026-04-15 (`docs/plan/end-to-end-launch-implementation.md:576–581`). The `internal_payable` flag in `mint/crates/cascade-core/src/lightning/lnd_client.rs:76` controls this.
- **Single/window funding limits**: `test_signet_funding_enforces_single_and_window_limits` in `mint/crates/cascade-api/tests/api_integration.rs:3466`.
- **Network type gating**: `mint/crates/cascade-mint/src/config.rs:437` enforces that `network_type` is `signet`, `testnet`, or `mainnet`.

An active bug exists where Lightning invoices on signet are not auto-settling post-payment. This is being investigated/fixed in parallel (conversation `1e64784bd0`). This bug is a **blocking** item for M9 exit.

There is **no existing M9 exit criteria document** — this plan creates one.

## Approach

Define exit criteria as a structured checklist organized into five categories:
1. **Core user flows** — the minimum user-facing journeys that must work end-to-end on signet
2. **Non-functional requirements** — reliability, security, and operational readiness
3. **Out-of-scope features** — explicit statement of what M9 does NOT require
4. **Test cases** — specific verifiable test scenarios (automated + manual)
5. **Priority ordering** — P0 (blockers), P1 (required), P2 (strongly desired)

This approach was chosen because:
- A flat checklist is easy for the owner to review and sign off on
- Separating core flows from non-functional requirements prevents conflation
- Explicit out-of-scope prevents scope creep
- Priority ordering allows incremental convergence

**Alternatives considered:**
- *Gherkin-style acceptance criteria*: Rejected — too verbose for a milestone gate document, and the codebase doesn't use Gherkin.
- *Test-only exit criteria*: Rejected — not all criteria are testable by automation (e.g., operator playbook exists, signet/mainnet isolation verified by review).

## File Changes

### `.tenex/plans/m9-signet-exit-criteria.md` (this file)
- **Action**: create
- **What**: Full M9 exit criteria specification with core flows, NFRs, out-of-scope, test cases, and priorities
- **Why**: No exit criteria document exists; the M9 milestone definition in the launch plan is descriptive but not verifiable

---

## M9 Exit Criteria

### 1. Core User Flows (P0 — All Must Pass)

These are the minimum end-to-end journeys a user must be able to complete on the signet edition.

#### 1.1 Fund Portfolio via Lightning
- User requests a Lightning funding quote on signet
- Signet mint auto-pays the invoice (testnut-style, no manual Lightning payment step)
- User receives USD ecash proofs in their browser-local wallet
- Proof amounts match the requested funding amount

**Key code path:** `POST /v1/mint/quote/bolt11` → auto-pay (`internal_payable=true` on signet) → `GET /v1/mint/quote/bolt11/{quote_id}` → `POST /v1/mint/bolt11` → proofs issued

**Blocking bug:** Lightning invoices not auto-settling post-payment (active investigation in conversation `1e64784bd0`). This must be resolved before M9 can exit.

#### 1.2 Create a Market
- User creates a new market (kind 982 event)
- Market appears in the discovery feed sourced from Nostr relays
- Market details (question, LONG/SHORT labels) render correctly

#### 1.3 Mint a Position (Buy)
- User selects a market and mints LONG or SHORT proofs
- User's USD ecash balance decreases by the correct amount
- User receives LONG or SHORT market proofs
- LMSR price updates after the trade

**Key code path:** `quote_trade_buy` → `buy_trade` → `execute_buy_trade_settlement` in `mint/crates/cascade-api/src/handlers/product.rs:2171+`

#### 1.4 Exit a Position (Sell/Withdraw)
- User returns LONG or SHORT proofs to the mint
- Mint returns USD ecash at the current LMSR price
- User's USD balance increases by the correct withdrawal proceeds
- LMSR price updates after the trade

**Key code path:** `quote_trade_sell` → `sell_trade` → `execute_sell_trade_settlement` in `mint/crates/cascade-api/src/handlers/product.rs:2493+`

#### 1.5 View Portfolio
- User sees their current positions with accurate LMSR pricing
- USD ecash balance displays correctly
- Position list shows each held market with LONG/SHORT quantity and current value

#### 1.6 Market Discovery
- Markets appear in the feed from Nostr relay data
- No backend mirror or database dependency for market reads
- Market cards show current LMSR price

---

### 2. Non-Functional Requirements

#### 2.1 Signet/Mainnet Isolation (P0)
- Signet-specific code paths (`internal_payable`, funding limits, network type) are gated by the `signet` network type only
- No signet-only code path leaks into mainnet builds
- `mint/crates/cascade-mint/src/config.rs:437` enforces `network_type` validation
- Signet and mainnet proof storage are namespaced by edition and mint URL

#### 2.2 Idempotency (P0)
- Duplicate Stripe webhook delivery cannot move funding out of `complete` or `review_required` (M4 carry-over)
- Trade request-id retries after a lost success response recover the same issued outputs or an equivalent redeemable quote path
- Sell interrupted after wallet-invoice payment but before client response can be recovered end-to-end

#### 2.3 FX Quote Integrity (P1)
- Stale FX quotes are rejected (not silently reused)
- Launch signet completion check fails when live FX providers are unavailable
- Multi-provider median policy is active for both signet and mainnet

#### 2.4 Error Recovery (P1)
- A client that loses the success response after proof issuance can recover the issued outputs through a documented redeemable quote path
- Sell-created wallet quotes are recoverable through `GET /v1/mint/quote/wallet/{quote_id}` and `POST /v1/mint/wallet`
- Trade request replay/status returns completed buy and sell proof bundles without re-executing the trade

#### 2.5 Operator Readiness (P1)
- An operator playbook exists for provider outages and quote drift
- Rollback and maintenance procedure is documented
- Manual smoke scripts exist for signet and mainnet before every deploy

#### 2.6 Product Language (P2)
- Public product APIs use `long` and `short` — not `yes` and `no`
- User-facing APIs avoid `settlement` terminology when the behavior is funding, minting, or withdrawal
- UI uses product language: "fund portfolio", "mint LONG/SHORT", "withdraw", "exit a position", "withdrawal proceeds"

---

### 3. Out-of-Scope for M9

These features are explicitly **not required** for M9 signet paper-trading gate exit:

- **Stripe top-ups on signet** — signet edition has `PUBLIC_CASCADE_ENABLE_STRIPE_TOPUPS=false`
- **USDC withdrawal/payout** — USDC addendum is post-launch
- **Bank payout or fiat cash-out** — explicit non-goal per launch plan
- **Direct per-market deposit rails** — explicit non-goal
- **Spark as canonical user wallet** — explicit non-goal
- **Mixed signet/mainnet discovery** — explicit non-goal
- **Mainnet production readiness** — that is M10
- **Performance/load testing at scale** — not paper-trading gate scope
- **Mobile native apps** — web-only for M9
- **Agent onboarding** — not a paper-trading gate requirement

---

### 4. Test Cases

#### 4.1 Automated Integration Tests (Mint)

Existing signet-specific tests in `mint/crates/cascade-api/tests/api_integration.rs`:

| Test | Status | What It Verifies |
|------|--------|------------------|
| `test_signet_lightning_funding_quote_auto_pays_after_status_poll` | Present | Signet funding quote auto-pays after status poll |
| `test_signet_lightning_funding_quote_auto_pays_with_cli_backend_when_self_pay_fails` | Present | Signet funding still auto-pays when internal self-pay falls back to the CLI-backed invoice service |
| `test_signet_funding_enforces_single_and_window_limits` | Present | Signet funding limits |

**M9 automated tests written on April 16, 2026:**

| Test Name | Category | Status | What It Verifies |
|-----------|----------|--------|------------------|
| `test_signet_buy_trade_issues_long_proofs` | Core Flow 1.3 | Written | Buy trade mints LONG proofs with correct amounts |
| `test_signet_buy_trade_issues_short_proofs` | Core Flow 1.3 | Written | Buy trade mints SHORT proofs with correct amounts |
| `test_signet_sell_trade_returns_usd_ecash` | Core Flow 1.4 | Written | Sell trade returns USD ecash at LMSR price |
| `test_signet_sell_trade_updates_lmsr_price` | Core Flow 1.4 | Written | Sell quote changes after a sell, covering LMSR price impact |
| `test_signet_market_creation_publishes_982` | Core Flow 1.2 | Written with relay-gap note | Verifies the seed-trade API accepts a signed raw kind 982 event and bootstraps a public market; relay publication still needs relay-backed or manual verification |
| `test_signet_trade_request_id_idempotent` | NFR 2.2 | Written | Trade request-id retry replays the original buy outputs |
| `test_signet_sell_recovery_after_interrupt` | NFR 2.2 | Written | Sell retry after a lost response replays the original USD and change bundles |
| `test_signet_stale_fx_quote_rejected` | NFR 2.3 | Written with freshness note | Verifies fresh FX observation timestamps on executable quotes; full stale-quote rejection still needs time-travel or dedicated stale-provider integration coverage |
| `test_signet_no_internal_payable_on_mainnet` | NFR 2.1 | Written | Mainnet Lightning funding stays unpaid until an external/manual payment arrives |

#### 4.2 Automated E2E Tests (Web)

Existing tests in `web/tests/e2e/`:

| Test File | What It Covers |
|-----------|----------------|
| `paper-trading.spec.ts` | Full paper trading flow (fund, trade, exit) |
| `portfolio-shell.spec.ts` | Portfolio display and position tracking |
| `frontend-health.spec.ts` | Frontend loads, no crash, basic connectivity |

**New E2E tests required for M9:**

| Test Name | Category | What It Verifies |
|-----------|----------|------------------|
| Signet market creation flow | Core Flow 1.2 | User can create a market, it appears in feed |
| Signet mint LONG position | Core Flow 1.3 | User can buy LONG, balance updates, proofs received |
| Signet mint SHORT position | Core Flow 1.3 | User can buy SHORT, balance updates, proofs received |
| Signet exit position | Core Flow 1.4 | User can sell/withdraw, USD ecash returned |
| Signet portfolio accuracy | Core Flow 1.5 | Portfolio shows correct positions and values |

#### 4.3 Manual Smoke Tests

| Scenario | How to Verify |
|----------|---------------|
| Full end-to-end paper trade | Run `web/scripts/smoke-edition.sh signet`, fund via Lightning, buy, sell, check portfolio |
| Signet/mainnet proof isolation | Verify signet proofs cannot be redeemed on mainnet mint |
| Operator playbook exists | `docs/` contains operator runbook with outage and rollback procedures |
| Product language in UI | No "settlement", "yes/no", or "sats" visible in signet web UI |

---

### 5. Priority Ordering

#### P0 — Blockers (M9 cannot exit until these pass)

1. **Lightning auto-settlement on signet** — Bug where invoices don't auto-settle post-payment must be fixed
2. **Fund portfolio via Lightning** — Core Flow 1.1 must work end-to-end
3. **Mint a position (buy)** — Core Flow 1.3 must work end-to-end
4. **Exit a position (sell)** — Core Flow 1.4 must work end-to-end
5. **Signet/mainnet isolation** — No signet-only code path leaks to mainnet
6. **Idempotency** — Duplicate requests don't double-execute or strand value

#### P1 — Required (M9 should not exit without these)

7. **Create a market** — Core Flow 1.2
8. **View portfolio** — Core Flow 1.5
9. **Market discovery** — Core Flow 1.6
10. **Error recovery** — Sell and buy recovery paths work after interruption
11. **FX quote integrity** — Stale quotes rejected, multi-provider policy active
12. **Operator readiness** — Playbook and smoke scripts exist

#### P2 — Strongly Desired (M9 can exit if deferred with documented justification)

13. **Product language compliance** — API and UI use correct terminology everywhere
14. **Complete E2E test coverage** — All new test cases in §4.1 and §4.2 are passing
15. **Manual smoke test pass** — All scenarios in §4.3 verified by a human

---

## Execution Order

1. **Fix Lightning auto-settlement bug** — Resolve the active bug where signet Lightning invoices don't auto-settle post-payment. Verify with `test_signet_lightning_funding_quote_auto_pays_after_status_poll` and `test_signet_lightning_funding_quote_auto_pays_without_lncli_payinvoice`. *This is the critical path item — nothing else in P0 is testable without funding.*

2. **Verify core buy/sell flows** — Run existing and new integration tests for buy trade (LONG and SHORT proof issuance) and sell trade (USD ecash return). Verify LMSR price updates after each trade.

3. **Verify market creation and discovery** — Confirm kind 982 events publish correctly and markets appear in the web feed from relay data (no backend mirror).

4. **Write and pass new integration tests** — Implement the 9 new automated test cases listed in §4.1. These cover idempotency, sell recovery, FX rejection, and signet/mainnet isolation.

5. **Write and pass new E2E tests** — Implement the 5 new web E2E test cases listed in §4.2 covering market creation, mint, exit, and portfolio accuracy on signet.

6. **Verify signet/mainnet isolation** — Run `test_signet_no_internal_payable_on_mainnet` plus manual review that all signet code paths are gated by network type.

7. **Create operator playbook** — Document outage procedures, rollback steps, and quote drift handling. Save to `docs/operations/` or equivalent.

8. **Run manual smoke tests** — Execute `web/scripts/smoke-edition.sh signet`, verify full E2E paper trade, check proof isolation, verify product language in UI.

9. **Owner sign-off** — Present completed exit criteria checklist with pass/fail status for each item. Owner confirms M9 exit.

## Verification

**Automated verification commands:**

```bash
# Run all mint integration tests (includes signet-specific)
cd mint && cargo test --test api_integration

# Run web E2E tests against signet
cd web && bun run test:e2e

# Build signet edition
cd web && ./scripts/build-node-edition.sh signet
```

**Manual verification checklist:**

- [ ] Lightning funding on signet: request quote → auto-pay → receive proofs
- [ ] Market creation: publish → appears in feed → accurate display
- [ ] Buy LONG: spend USD → receive LONG proofs → price moves
- [ ] Buy SHORT: spend USD → receive SHORT proofs → price moves
- [ ] Sell/withdraw: return proofs → receive USD ecash → price moves
- [ ] Portfolio: positions display with accurate LMSR pricing
- [ ] No "sats", "yes/no", or "settlement" language in web UI
- [ ] Signet proofs cannot be spent on mainnet mint
- [ ] Operator playbook exists with rollback procedures
- [ ] `smoke-edition.sh signet` passes without errors

**Edge cases to test:**

- Fund with zero-amount invoice
- Trade on a market with extreme LMSR prices (near 0 or 1)
- Concurrent trades on the same market
- Sell immediately after buying (same block)
- Lose browser state mid-trade, recover through quote path
- Duplicate funding webhook delivery
