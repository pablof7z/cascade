# Cashu Mint Test Harness — Implementation Plan

**Plan ID:** cashu-mint-test-harness
**Author:** tenex-planner
**Status:** Critical Revisions Required (7 BLOCKING Issues: 3 pragmatic + 4 cashu-expert)
**Created:** 2026-04-04
**Last Updated:** 2026-04-04 (Emergency Revision #2)
**Target:** Cashu CDK Rust Mint on testnet

---

## 1. Executive Summary

This plan defines a standalone Python 3.11+ test harness for validating the Cashu CDK Rust mint powering Cascade prediction markets. The harness is a CLI tool with zero frontend dependencies — it speaks Cashu's HTTP API (NUT-01/02/03/04/05/07/11) and drives trade sequences against a configurable testnet mint URL.

**What it validates:**
- LMSR market math correctness (cost, pricing, slippage) ported from the TypeScript reference (`src/market.ts`)
- Solvency invariant: the mint's reserve never falls below the maximum outstanding payout obligation
- Whale-attack resilience: large trades don't destabilize pricing or deplete reserves
- Concurrency safety: simultaneous redemptions don't break state
- Fee accuracy: 2% rake on trades collected correctly (Pablo confirmed: "2%, whatever")
- Floating-point precision: LMSR math stability against accumulation errors over 1M+ trades
- **NEW (BLOCKING #5):** NUT-03 (Swap) protocol compliance for token transformations
- **NEW (BLOCKING #6):** Double-spend prevention via NUT-07 `/v1/check` endpoint
- **NEW (BLOCKING #7):** Token identity tracking (keyset_id, side fields) across lifecycle

**Scope:** A new `test_harness/` directory in the Cascade repo root, deployable immediately against a testnet mint URL via YAML config. No changes to the existing TypeScript codebase. **MVP: Phases 1–3 (2–3 weeks) REVISED for 7 blocking issues.**

---

## 2. Context

### 2.1 Mint Architecture

The Cascade mint is a CDK Rust deployment exposing Cashu's HTTP API. Each prediction market uses a two-keyset setup (one keyset for LONG shares, one for SHORT shares) with the following characteristics:

| Property | Value |
|---|---|
| Fee model | 2% rake on trades (Pablo confirmed: "2%, whatever") |
| Token model | Pure bearer tokens — holding a valid unspent proof = ownership |
| Keyset strategy | Two keysets per market: `<market_id>_long` and `<market_id>_short` |
| Keyset resolution | Routed by keyset ID convention (see 2.3) |
| Reserve | Mint holds a reserve (sats) used to back outstanding shares |
| LMSR parameter `b` | Initial liquidity in sats; set per-market at creation |
| Protocol versioning | Mint enforces Cashu NUT spec version; harness validates target version on startup |
| Token identity | **NEW (BLOCKING #6):** Proofs track keyset_id and side; must be preserved through swap operations |
| Swap protocol | **NEW (BLOCKING #5):** NUT-03 enables token transformation; tests must validate swap correctness |

### 2.2 Protocol Versioning & Keyset Convention

**Protocol Versioning Requirement (BLOCKING ISSUE #1):**

The Cashu NUT specs may evolve over time. This harness must defend against version mismatches between the mint and the test implementation.

- **Harness config** must specify a target `protocol.spec_version` (e.g., `1.0.0`)
- **Startup validation**: On initialization, fetch `GET /v1/info` and verify the mint's spec version matches the configured target
- **Failure mode**: If versions mismatch, harness exits with error (no version fallback)
- **Config key:** `protocol.spec_version` (string, semver format)

**Keyset ID Convention (BLOCKING ISSUE #2 — Clarification Required):**

Keysets must be routable by convention. The current proposal:
```
<market_id>_long   # LONG keyset for market X
<market_id>_short  # SHORT keyset for market X
```

**TODO:** Mint-engineer must confirm this convention or provide the actual keyset ID format. Implementation depends on this decision.

### 2.3 LMSR Formulas (Ported from `src/market.ts:277–288`)

**CRITICAL FIX (BLOCKING ISSUE #4 — Numerical Overflow):**

The original plan's clamping to `[-60, 60]` is **insufficient**. At `b*|qShort-qLong| ≈ 700+`, the exponent overflows even with clamping. **Use log-space computation instead:**

```python
# CORRECTED: Price of LONG in log-space to avoid overflow
def price_long(q_long: float, q_short: float, b: float) -> float:
    """
    Price using log-space computation.
    Avoids overflow for large b*(qShort - qLong).
    
    p_long = exp(b*q_long) / (exp(b*q_long) + exp(b*q_short))
           = 1 / (1 + exp(b*(q_short - q_long)))  [unsafe for large exponent]
    
    Better: Use log-sum-exp for numerical stability.
    """
    delta = b * (q_short - q_long)
    
    # For very large |delta|, use asymptotic expansion
    if delta > 100:  # exp(b*q_short) >> exp(b*q_long)
        return 0.0  # p_long ≈ 0
    elif delta < -100:  # exp(b*q_long) >> exp(b*q_short)
        return 1.0  # p_long ≈ 1
    else:
        # Safe computation for bounded delta
        return 1.0 / (1.0 + math.exp(delta))

# Cost function: C(q_long, q_short, b) using log-sum-exp
def cost_function(q_long: float, q_short: float, b: float) -> float:
    """
    C(q,r,b) = (1/b) * log(exp(b*q_long) + exp(b*q_short))
    
    Use log-sum-exp trick to avoid overflow:
    log(exp(a) + exp(b)) = max(a, b) + log(exp(a - max) + exp(b - max))
    """
    if b == 0:
        return 0.0
    
    a = b * q_long
    b_exp = b * q_short
    max_ab = max(a, b_exp)
    
    # Clamp to avoid underflow in exp()
    if max_ab - a > 100:  # exp(a - max_ab) would underflow
        log_sum = max_ab + math.log(1.0 + math.exp(b_exp - max_ab))
    elif max_ab - b_exp > 100:  # exp(b_exp - max_ab) would underflow
        log_sum = max_ab + math.log(1.0 + math.exp(a - max_ab))
    else:
        log_sum = max_ab + math.log(math.exp(a - max_ab) + math.exp(b_exp - max_ab))
    
    return log_sum / b

# Helper functions (unchanged)
def price_short(q_long: float, q_short: float, b: float) -> float:
    return 1.0 - price_long(q_long, q_short, b)

def cost_to_buy_long(q_long: float, q_short: float, b: float, n_shares: float) -> float:
    new_q_long = q_long + n_shares
    return cost_function(new_q_long, q_short, b) - cost_function(q_long, q_short, b)

def cost_to_buy_short(q_long: float, q_short: float, b: float, n_shares: float) -> float:
    new_q_short = q_short + n_shares
    return cost_function(q_long, new_q_short, b) - cost_function(q_long, q_short, b)
```

**Validation:** LMSR engine must pass stress tests with `b=100_000` and `|q_long - q_short| up to 10,000` without overflow or NaN.

### 2.4 NUT-03 (Swap) Protocol — BLOCKING ISSUE #5

**Problem:** Every token transformation (e.g., generic → market-specific keyset) uses Cashu's Swap operation (NUT-03). The plan had no design for this.

**NUT-03 Swap Specification:**
- Endpoint: `POST /v1/swap`
- Request: `{ "inputs": [Proof1, Proof2, ...], "outputs": [BlindedMessage1, ...] }`
- Response: `{ "signatures": [Signature1, ...] }`
- **Purpose:** Burn input proofs and mint new proofs with different keyset (preserving total value)
- **Test coverage requirement:** Full lifecycle test includes at least 2 swaps per market

**Harness design changes:**
1. Add `swap()` method to `CashuClient` (see Section 5)
2. Add `test_swap_protocol()` to Phase 1 tests (validates swap roundtrip)
3. Add `test_swap_under_redemption_pressure()` to Phase 2 (swap + concurrent melt)
4. Document swap in config: `swap.enabled: true` (default)

### 2.5 Token Identity Tracking — BLOCKING ISSUE #6

**Problem:** Proofs currently have no `keyset_id` or `side` fields. Token identity is lost during transformations.

**New Proof Dataclass:**

```python
@dataclass
class Proof:
    secret: str                  # Cashu secret (keyset-specific commitment)
    amount: int                  # Satoshis
    keyset_id: str              # NEW: e.g., "LONG-market-123" or "market-123_long"
    side: str                   # NEW: "LONG" | "SHORT" | "GENERIC" (before market-specific mint)
    created_at: datetime        # NEW: timestamp for audit
    
    @property
    def value(self) -> int:
        return self.amount
    
    def to_dict(self) -> dict:
        """Serialize for JSON/HTTP"""
        return {
            "secret": self.secret,
            "amount": self.amount,
            "keyset_id": self.keyset_id,
        }
    
    def __hash__(self):
        """For set/dict operations (double-spend tracking)"""
        return hash((self.secret, self.keyset_id))
```

**Integration:**
1. `CashuClient.split()` must return `Proof` objects with correct keyset_id
2. `CashuClient.swap()` must update keyset_id while preserving side
3. Tests must validate that `side` is preserved across swap + trade sequences
4. Solvency engine must group outstanding shares by (keyset_id, side) for correct reserve calculation

### 2.6 Double-Spend Prevention — BLOCKING ISSUE #7

**Problem:** Plan had placeholder `assert no_double_spends()` with no implementation.

**NUT-07 Check Endpoint:**
- Endpoint: `POST /v1/check`
- Request: `{ "proofs": [Proof1, Proof2, ...] }`
- Response: `{ "spendable": [true, false, true, ...] }`
- **Purpose:** Query mint to see which proofs are unspent

**Implementation:**
1. Add `check_proofs(proofs: List[Proof]) -> List[bool]` to `CashuClient`
2. Concurrent redemption test (Phase 1): mint proof → attempt 2 concurrent melts with same proof → verify exactly 1 succeeds and `/v1/check` confirms the other as spent
3. Solvency engine: After all trades, call `/v1/check` on all minted proofs to confirm none are double-spent

### 2.7 Cashu NUT Endpoints Used

| NUT | Endpoint | Purpose |
|---|---|---|
| NUT-01 | `GET /v1/info` | Fetch mint info, keysets, spec version |
| NUT-01 | `POST /v1/mint/quote/mint` | Create a mint quote (locks amount + fee) |
| NUT-01 | `POST /v1/mint/quote/redeem` | Create a redeem quote |
| NUT-01 | `POST /v1/mint` | Mint proofs (pay mint invoice) |
| NUT-02 | `POST /v1/split` | Split/redenominate proofs |
| NUT-02 | `POST /v1/melt` | Redeem/melt proofs (burn tokens for sats) |
| **NUT-03** | **`POST /v1/swap`** | **Transform tokens between keysets (NEW - BLOCKING #5)** |
| NUT-04 | `/v1/keys` | Keys per keyset ID |
| **NUT-07** | **`POST /v1/check`** | **Check proof spend status (NEW - BLOCKING #7)** |
| NUT-11 | Melt quote response | Validate fee_ppk calculation (NEW - IMPORTANT #4) |
| NUT-05 | P2PK support | Future: time-locked tokens (Phase 4+) |

---

## 3. Test Categories

### 3.1 Stochastic Tests

**Objective:** Validate that statistical properties of the LMSR hold across many random trade sequences. Also stability-test LMSR math against floating-point accumulation errors and overflow conditions.

**Scenario:** A single market with initial `b=10_000` sats, seeded with random trade sequences of 100–1,000 trades each.

**Parameters (configurable):**
- `num_iterations`: 1,000–10,000 (default: 5,000)
- `num_trades_per_iteration`: 100–500 (default: 200)
- `trade_size_range`: sats range for individual trades (default: 10–500 sats)
- `market_bias`: fraction of trades biased toward LONG or SHORT (default: 0.5, unbiased)

**Assertions:**
1. **Fee collection accuracy**: Sum of fees observed via `POST /mint` must equal 1% of total minted sats (within 1 sat rounding tolerance).
2. **Price bounds**: `0.0 ≤ price_long ≤ 1.0` at all times (NEW: **no NaN, no inf**).
3. **Cost monotonicity**: Cost to buy shares is always non-negative; buying more of the same side never reduces cost.
4. **Expected value convergence**: After N unbiased random trades, the market price should be within `O(1/√N)` of 0.5.
5. **Slippage vs. trade size**: Slippage (cost - fair_value) grows sub-linearly with trade size.
6. **FLOATING-POINT STABILITY (BLOCKING #3)**: After 100,000+ trades, cumulative floating-point errors in LMSR cost/price functions must not exceed **1e-8 relative tolerance** when compared to reference TypeScript implementation. Validated via 50+ known test vectors (see File Changes: `tests/test_lmsr_stability.py`).
7. **NEW (BLOCKING #4):** Numerical overflow protection: tests with `b=100_000` and large `|q_long - q_short|` must not produce NaN or inf.

### 3.2 NUT-03 Swap Tests (BLOCKING #5)

**Objective:** Validate that swap operations preserve value, update keyset correctly, and are atomic.

**Scenarios:**

1. **Basic swap validity:**
   - Mint proofs with generic keyset
   - Swap to market-specific keyset (LONG or SHORT)
   - Assert: Output proofs have correct keyset_id and value matches input

2. **Swap under trade pressure (concurrent mint + swap + melt):**
   - Worker A: mint → swap → trade
   - Worker B: mint → swap → trade
   - Both workers melt simultaneously
   - Assert: Both succeed without double-spend
   - Assert: Reserve remains consistent

3. **Swap chain (multi-step transformation):**
   - Generic → LONG keyset → split into smaller denominations
   - Assert: Each step preserves value and keyset_id correctness

4. **Fee handling in swap:**
   - Swap inputs 100 sats → outputs should be 100 sats (swap is a transformation, not a trade)
   - Assert: Fee only applied on mint/melt, not swap

### 3.3 Whale Attack Tests

**Objective:** Measure price impact, slippage, and reserve depletion when a single large trade (or rapid sequence) dominates the order book.

**Scenario:** A market starts near 50/50 odds. A "whale" executes a series of large trades (10%–100% of reserve) on one side.

**Parameters:**
- `whale_size_fraction`: 0.10–1.0 (fraction of `b` per trade, default: 0.5)
- `num_whale_trades`: 1–20 (default: 5)
- `whale_side`: LONG or SHORT (default: both, tested separately)
- `recovery_trades`: number of subsequent normal trades to test recovery (default: 50)
- `recovery_threshold_bips`: target recovery band, default 500 bips (5% recovery within recovery trades)

**Assertions:**
1. **Reserve adequacy**: Reserve never drops below `max(outstanding_long_value, outstanding_short_value)` during or after whale trades.
2. **Price impact bound**: Price should not move to `>0.95` or `<0.05` unless the trade volume genuinely justifies it (i.e., `q_long - q_short > 5b`).
3. **Slippage cap**: Slippage on any single whale trade must be `< 5%` of trade size (for `whale_size_fraction ≤ 0.5`).
4. **Price recovery**: After whale trades, subsequent `recovery_trades` small trades should bring market price to within **5 basis points (bips) of starting price** (e.g., if starting at 0.50, recovery to 0.495–0.505).
5. **Solvency post-whale**: After all whale and recovery trades, reserve margin must remain `≥ 1%`.

**NEW (IMPORTANT #6):** Concurrent mint + melt under whale pressure:
- While whale trades are active, attempt to mint new shares and immediately melt
- Assert: Both operations succeed without reserve depletion
- Assert: Fee calculations correct even under concurrent load

### 3.4 Solvency Tests

**Objective:** Prove the fundamental invariant: the mint's reserve must always be sufficient to pay out the maximum possible redemption obligation. End-to-end test validates solvency by actually redeeming ALL outstanding shares.

**Core invariant:**
```
reserve >= max(outstanding_long_value, outstanding_short_value)
```

Where:
```
outstanding_long_value = q_long * fair_value_per_long_share  (in sats)
outstanding_short_value = q_short * fair_value_per_short_share  (in sats)
```

**Test phases:**
1. **Post-whale attack (Phase 4 enhancement):** After a whale attack scenario, attempt to redeem ALL outstanding shares:
   - Call `/v1/melt` with proofs for entire outstanding balance (both LONG and SHORT)
   - Assert: Melt succeeds with `state: "accepted"` (no HTLC timeout, no liquidity failure)
   - Assert: Returned sats matches outstanding balance (within 1 sat rounding)
   - This proves the mint's reserve was actually incremented and can honor the redemption

2. **Post-edge-case scenarios:** Similar validation after each edge case test (5% resolution fee impact, rounding errors, etc.)

3. **NEW (IMPORTANT #6):** Concurrent mint + redeem under reserve pressure:
   - Mint 100 times to fill reserve
   - While melting, attempt new mints
   - Assert: New mints succeed if reserve available, fail gracefully if not

**Verification command (Phase 4):**
```bash
# After whale attack:
cashu-mint-test solvency --config config.yaml --validate-redemption --scenario whale
# Expected output: "Whale recovery: outstanding_balance=50000 sats, melt_success=true, melt_returned=50000"
```

### 3.5 Double-Spend Prevention Tests (BLOCKING #7)

**Objective:** Validate that the mint's double-spend prevention (via NUT-07 check) works correctly.

**Scenarios:**

1. **Concurrent melt attempts (same proof):**
   - Mint proof P with 100 sats
   - Spawn 2 async tasks, each attempts `/v1/melt` with proof P
   - Assert: Exactly 1 succeeds (returns 100 sats)
   - Assert: 1 fails (proof already spent)
   - Call `/v1/check` on P: assert spendable = false

2. **Check endpoint validation:**
   - Mint 10 proofs
   - Melt 5 of them
   - Call `/v1/check` on all 10
   - Assert: First 5 = true (unspent), last 5 = false (spent)

3. **Swap doesn't affect spend status (transformation, not consumption):**
   - Mint proof P (generic keyset)
   - Call `/v1/check` on P: assert spendable = true
   - Swap P to market-specific keyset → proof P'
   - Call `/v1/check` on P: assert spendable = false (input consumed by swap)
   - Call `/v1/check` on P': assert spendable = true (new output)

### 3.6 Edge Case Tests

**Objective:** Validate behavior at boundary conditions, fee interactions, and rounding.

**Scenarios:**

1. **Resolution fee impact (5%):** Cascade applies a 5% resolution fee at market close. Test that this fee is accounted for in solvency calculations:
   - Setup: market with outstanding balance B sats
   - Action: (Simulated) apply 5% resolution fee
   - Assert: Reserve can still cover (B × 0.95) redemption
   - Assert: Remaining 5% is fee-to-protocol

2. **Rounding error accumulation (≤1 sat tolerance):**
   - Run 10,000 small trades (1–10 sats each)
   - Track cumulative rounding errors in fee calculations
   - Assert: Total error across all trades ≤ 1 sat

3. **Melt quote validation (IMPORTANT #4):**
   - Request melt quote for N sats
   - Validate response includes `fee_ppk` (fee parts per 1000)
   - Assert: `fee_ppk` formula matches NUT-11 spec
   - Assert: Actual fee deducted in melt = `amount * (fee_ppk / 1000)`

4. **Concurrent mint under reserve pressure (NEW - IMPORTANT #6):**
   - Monitor reserve level
   - While reserve is near max, attempt 10 concurrent mints
   - Assert: Mints succeed or fail gracefully (no deadlock)
   - Assert: Total minted + reserve ≤ max_reserve

5. **Zero-balance proofs:**
   - Attempt to mint a 0-sat proof
   - Assert: Mint rejects with HTTP 400 or similar

6. **Invalid keyset ID:**
   - Attempt to mint/swap using a non-existent keyset
   - Assert: Mint rejects with HTTP 400

---

## 4. Architecture Overview

### 4.1 Project Layout

```
test_harness/
├── pyproject.toml                 # Python 3.11+, dependencies (httpx, pydantic, pyyaml, pytest)
├── README.md                      # Setup and usage instructions
├── config/
│   ├── baseline_config.yaml       # Default test configuration
│   ├── testnet_config.yaml        # Testnet-specific config example
│   └── stress_config.yaml         # High-load test config (1M trades)
├── cashu_client.py                # Cashu HTTP client (wrapper around httpx)
├── lmsr_engine.py                 # LMSR math engine (cost, price, slippage functions) — UPDATED for overflow fix
├── proof.py                       # NEW: Proof dataclass with keyset_id, side fields
├── stochastic_engine.py           # Stochastic test driver (random trade sequences)
├── whale_engine.py                # Whale attack test driver
├── solvency_engine.py             # Solvency validator + redemption testing
├── edge_case_engine.py            # Edge case scenarios (rounding, concurrency, etc.)
├── swap_engine.py                 # NEW: NUT-03 swap protocol validation
├── double_spend_engine.py         # NEW: NUT-07 double-spend prevention testing
├── config_loader.py               # YAML config loader + validation (pydantic)
├── cli.py                         # CLI entry point (argparse)
├── logger.py                      # Logging (structured JSON output)
├── tests/
│   ├── test_lmsr_stability.py     # LMSR vs TypeScript reference (50+ vectors with overflow test cases) — PHASE 1
│   ├── test_lmsr_overflow.py      # NEW: Test numerical stability with large b and q deltas
│   ├── test_config_loader.py      # Config validation
│   ├── test_cashu_client.py       # HTTP mocking + request validation
│   ├── test_proof.py              # NEW: Proof dataclass serialization
│   ├── test_stochastic.py         # Unit tests for stochastic engine
│   ├── test_whale.py              # Unit tests for whale engine
│   ├── test_solvency.py           # Unit tests for solvency engine
│   ├── test_swap.py               # NEW: NUT-03 swap protocol tests
│   └── test_double_spend.py       # NEW: NUT-07 double-spend prevention tests
├── integration_tests/
│   ├── conftest.py                # Testnet mint fixture (requires TESTNET_MINT_URL env)
│   ├── test_end_to_end.py         # Full flow: mint → swap → trade → solvency
│   ├── test_concurrent_redemptions.py  # Concurrency test (Phase 1)
│   ├── test_swap_under_pressure.py     # NEW: swap + concurrent melt
│   └── test_concurrent_mint_melt.py    # NEW: concurrent mint/melt under reserve pressure
└── .github/
    └── workflows/
        └── test_harness.yml       # CI/CD: unit tests, dry-run on every PR
```

---

## 5. File Changes

### Phase 1: Foundation (Core LMSR + Config + Critical Protocols)

This phase is **CRITICAL BLOCKING** — must complete before Phases 2–3 can be delegated.

#### `test_harness/lmsr_engine.py`
- **Action**: Create (with BLOCKING #4 overflow fix)
- **What**: Implement LMSR cost/price functions using log-space computation to prevent overflow
- **Why**: All tests depend on correct LMSR math; numerical stability is critical for large `b` values
- **Line count**: ~200 lines (increased for overflow handling)
- **Key changes from original:**
  - `price_long()` uses asymptotic expansion for large `|delta|`
  - `cost_function()` uses log-sum-exp trick with clamping to prevent underflow
  - Add stress test for `b=100_000`, `|q_long - q_short|` up to 10,000
- **Key exports**: `cost_function()`, `price_long()`, `price_short()`, `cost_to_buy_long()`, `cost_to_buy_short()`, `slippage_pct()`

#### `test_harness/proof.py`
- **Action**: Create (BLOCKING #6)
- **What**: Proof dataclass with keyset_id and side tracking
- **Why**: Preserve token identity across transformations
- **Line count**: ~80 lines
- **Content:**
  ```python
  @dataclass
  class Proof:
      secret: str
      amount: int
      keyset_id: str
      side: str  # "LONG" | "SHORT" | "GENERIC"
      created_at: datetime = field(default_factory=datetime.utcnow)
  ```

#### `test_harness/cashu_client.py`
- **Action**: Create (with NEW swap + check endpoints)
- **What**: HTTP client for Cashu endpoints including NUT-03 swap and NUT-07 check
- **Why**: Encapsulate HTTP logic; retry + rate-limiting; protocol version validation on init
- **Line count**: ~350 lines (increased from 250 for swap + check)
- **Key methods** (NEW additions):
  - `swap(proofs: List[Proof], keyset_id: str) -> List[Proof]` — NUT-03 swap to new keyset
  - `check_proofs(proofs: List[Proof]) -> List[bool]` — NUT-07 check spend status
  - `get_melt_quote(amount: int) -> MeltQuoteResponse` — NEW: validate fee_ppk
- **Retry logic**: exponential backoff up to `config.max_retries`
- **Rate limiting**: semaphore-based, `config.rate_limit_trades_per_second`

#### `test_harness/config_loader.py`
- **Action**: Create
- **What**: Pydantic models for config schema; YAML loader with validation
- **Why**: Centralize config management; validate inputs on startup; protocol version checking
- **Line count**: ~250 lines (expanded from 200 for swap + double-spend config)
- **Key sections**:
  - `ProtocolConfig`: `spec_version`, `target_api_version`
  - `MintConfig`: `url`, `max_retries`, `retry_backoff_seconds`
  - `EngineConfig`: `rate_limit_trades_per_second`, `random_seed`
  - **NEW**: `SwapConfig`: `enabled`, `test_under_pressure`
  - **NEW**: `DoubleSpendConfig`: `enabled`, `check_proofs_post_melt`
  - Other configs unchanged

#### `test_harness/swap_engine.py`
- **Action**: Create (BLOCKING #5)
- **What**: Driver for NUT-03 swap protocol validation
- **Why**: Ensure swap operations preserve value and update keyset correctly
- **Line count**: ~200 lines
- **Key class**: `SwapEngine(config, cashu_client, lmsr)`
- **Key methods**:
  - `test_basic_swap() -> bool` — mint → swap → validate
  - `test_swap_under_trade_pressure() -> bool` — concurrent swap + trade + melt
  - `test_swap_chain() -> bool` — multi-step transformations
  - `test_swap_fee_handling() -> bool` — validate swap doesn't apply trade fee

#### `test_harness/double_spend_engine.py`
- **Action**: Create (BLOCKING #7)
- **What**: Driver for NUT-07 double-spend prevention validation
- **Why**: Ensure mint correctly prevents spending same proof twice
- **Line count**: ~200 lines
- **Key class**: `DoubleSpendEngine(config, cashu_client)`
- **Key methods**:
  - `test_concurrent_melt_same_proof() -> bool` — 2 concurrent melts, exactly 1 succeeds
  - `test_check_endpoint_validity() -> bool` — check proofs before/after melt
  - `test_swap_spend_status() -> bool` — swap consumes input proof

#### `test_harness/config/baseline_config.yaml`
- **Action**: Create
- **What**: Example YAML config with all new sections
- **Why**: Users can clone and customize
- **Content**: All configurable test parameters including swap, double-spend, protocol version

#### `test_harness/tests/test_lmsr_stability.py`
- **Action**: Create (BLOCKING #3, updated for BLOCKING #4)
- **What**: Unit tests comparing LMSR functions against TypeScript reference + overflow stress tests
- **Why**: Catch floating-point precision and overflow bugs before integration testing
- **Line count**: ~350 lines (increased for overflow cases)
- **Test vectors**: 50+ hardcoded reference tuples + NEW: 20+ overflow stress cases with large b
- **Tolerance**: 1e-8 relative error
- **NEW stress cases**: `b=100_000`, `|q_long - q_short|` up to 10,000; assert no NaN/inf

#### `test_harness/tests/test_lmsr_overflow.py`
- **Action**: Create (BLOCKING #4)
- **What**: Dedicated overflow stress tests for LMSR
- **Why**: Validate log-space computation prevents overflow
- **Line count**: ~150 lines
- **Test cases**: extreme values of b and q deltas, ensure stable output

#### `test_harness/tests/test_swap.py`
- **Action**: Create (BLOCKING #5)
- **What**: Unit tests for swap protocol
- **Why**: Validate swap logic before integration
- **Line count**: ~200 lines

#### `test_harness/tests/test_double_spend.py`
- **Action**: Create (BLOCKING #7)
- **What**: Unit tests for double-spend prevention
- **Why**: Validate check endpoint handling
- **Line count**: ~150 lines

#### `test_harness/tests/test_cashu_client.py`
- **Action**: Create (updated for swap + check)
- **What**: Unit tests for HTTP client (mocked responses)
- **Why**: Validate request/response handling for all endpoints
- **Line count**: ~200 lines (increased from 150)
- **Coverage target**: 95%

#### `test_harness/pyproject.toml`
- **Action**: Create
- **What**: Python package metadata + dependencies
- **Why**: Enable `pip install -e .`
- **Key dependencies** (single HTTP client):
  - `httpx>=0.24` (async HTTP)
  - `pydantic>=2.0` (config validation)
  - `pyyaml>=6.0` (YAML parsing)
  - `pytest>=7.0` (testing)
  - `pytest-asyncio>=0.21` (async tests)

#### `test_harness/.github/workflows/test_harness.yml`
- **Action**: Create
- **What**: CI/CD workflow for unit + integration tests
- **Why**: Validate on every PR
- **Steps**:
  1. Python 3.11 setup
  2. `pip install -e .`
  3. Unit tests: `pytest tests/ -v --cov=cashu_client,config_loader,lmsr_engine,proof,swap_engine,double_spend_engine --cov-fail-under=85`
  4. Dry-run: `cashu-mint-test run --config config/baseline_config.yaml --dry-run`

### Phase 2: Core Engines (Stochastic, Whale, Solvency, Edge Cases)

Depends on: Phase 1 complete + mint-engineer answers to unresolved questions (Section 12).

#### `test_harness/stochastic_engine.py`
- **Action**: Create
- **What**: Driver for random trade sequences (100–10,000 iterations)
- **Why**: Statistical validation of LMSR
- **Line count**: ~300 lines (increased for overflow testing)
- **Key class**: `StochasticEngine(config, cashu_client, lmsr, swap_engine)`
- **NEW:** Include swap operations in trade sequences (e.g., mint with generic keyset, swap to market-specific)

#### `test_harness/whale_engine.py`
- **Action**: Create
- **What**: Driver for whale attack scenarios
- **Why**: Stress-test reserve adequacy and price recovery
- **Line count**: ~300 lines (increased for concurrent mint/melt)
- **NEW (IMPORTANT #6):** Concurrent mint + melt under whale pressure

#### `test_harness/solvency_engine.py`
- **Action**: Create
- **What**: Solvency validator + end-to-end redemption testing + concurrent mint/melt
- **Why**: Ensure reserve is always sufficient and honored on redemption
- **Line count**: ~350 lines (increased for concurrent scenarios)
- **NEW (IMPORTANT #6):** `test_concurrent_mint_melt_under_pressure()`

#### `test_harness/edge_case_engine.py`
- **Action**: Create
- **What**: Driver for edge cases (rounding, fee handling, concurrent operations)
- **Why**: Catch boundary bugs
- **Line count**: ~250 lines (increased for melt quote validation and concurrent mint)
- **NEW (IMPORTANT #4):** Validate melt quote fee_ppk formula
- **NEW (IMPORTANT #6):** Concurrent mint under reserve pressure

### Phase 3: Integration Tests

#### `test_harness/integration_tests/conftest.py`
- **Action**: Create
- **What**: Pytest fixtures for testnet mint
- **Why**: Reusable setup

#### `test_harness/integration_tests/test_end_to_end.py`
- **Action**: Create
- **What**: Full flow including swap: mint → swap → trade → melt
- **Why**: Validate against real testnet mint

#### `test_harness/integration_tests/test_concurrent_redemptions.py`
- **Action**: Create (Phase 1 now)
- **What**: Concurrent melt attempts, validate `/v1/check` endpoint
- **Why**: Validate double-spend prevention
- **Line count**: ~150 lines

#### `test_harness/integration_tests/test_swap_under_pressure.py`
- **Action**: Create (NEW - Phase 2)
- **What**: Swap + concurrent melt validation
- **Why**: Real testnet validation of swap + double-spend interaction

#### `test_harness/integration_tests/test_concurrent_mint_melt.py`
- **Action**: Create (NEW - Phase 2)
- **What**: Concurrent mint/melt under reserve pressure
- **Why**: Validate mint behavior under stress

---

## 6. Configuration Schema (Expanded)

### Root Config (`config.yaml`)

```yaml
protocol:
  spec_version: "1.0.0"            # Target Cashu spec version
  target_api_version: "v1"         # API version prefix

mint:
  url: "http://localhost:3338"     # Testnet mint URL
  max_retries: 3                   # Retry attempts
  retry_backoff_seconds: 1.0       # Exponential backoff

engine:
  rate_limit_trades_per_second: 10 # Max throughput
  random_seed: 42                  # Reproducibility

stochastic:
  enabled: true
  num_iterations: 5000
  num_trades_per_iteration: 200
  trade_size_range: [10, 500]
  market_bias: 0.5
  include_swaps: true              # NEW: include swap operations in trade sequences

whale:
  enabled: true
  whale_size_fraction: 0.5
  num_whale_trades: 5
  whale_side: "LONG"
  recovery_trades: 50
  recovery_threshold_bips: 500
  concurrent_mint_under_pressure: true  # NEW: test concurrent minting while whale active

solvency:
  enabled: true
  validate_redemption: true
  resolution_fee_pct: 5.0
  concurrent_mint_melt_pressure: true   # NEW: test concurrent mint/melt stress

swap:                                   # NEW (BLOCKING #5)
  enabled: true
  test_basic_swap: true
  test_under_pressure: true
  test_chain: true
  test_fee_handling: true

double_spend:                           # NEW (BLOCKING #7)
  enabled: true
  test_concurrent_melt: true
  check_proofs_post_melt: true
  test_swap_spend_status: true

edge_cases:
  enabled: true
  test_concurrent_redemptions: true
  test_zero_balance_proofs: true
  test_invalid_keyset: true
  test_melt_quote_fee_ppk: true         # NEW (IMPORTANT #4)
  test_concurrent_mint: true            # NEW (IMPORTANT #6)
```

---

## 7. Implementation Order (REVISED for 7 Blocking Issues)

### PHASE 1: Foundation (CRITICAL BLOCKING: 7 issues)

**Blocking issues #1–#7 must ALL be resolved in Phase 1.**

1. **LMSR engine with overflow fix** (`lmsr_engine.py`)
   - Implement log-space computation (BLOCKING #4)
   - Pass all stability vectors + overflow stress tests
   - Verify: `pytest tests/test_lmsr_stability.py tests/test_lmsr_overflow.py -v`

2. **Proof dataclass** (`proof.py`)
   - Implement keyset_id and side tracking (BLOCKING #6)
   - Verify: `pytest tests/test_proof.py -v`

3. **Cashu HTTP client with swap + check** (`cashu_client.py`)
   - Add `/v1/swap` (BLOCKING #5)
   - Add `/v1/check` (BLOCKING #7)
   - Verify: `pytest tests/test_cashu_client.py -v --cov=cashu_client --cov-fail-under=95`

4. **Swap engine** (`swap_engine.py`)
   - Implement NUT-03 swap protocol tests (BLOCKING #5)
   - Verify: `pytest tests/test_swap.py -v`

5. **Double-spend engine** (`double_spend_engine.py`)
   - Implement NUT-07 double-spend prevention (BLOCKING #7)
   - Verify: `pytest tests/test_double_spend.py -v`

6. **Config schema** (`config_loader.py`, `config/baseline_config.yaml`)
   - Add protocol version validation (BLOCKING #1)
   - Add swap + double-spend config sections
   - Verify: `pytest tests/test_config_loader.py -v`

7. **CLI + logging** (`cli.py`, `logger.py`)
   - Implement all subcommands
   - Verify: `cashu-mint-test dry-run --config config/baseline_config.yaml`

8. **CI/CD workflow** (`.github/workflows/test_harness.yml`, `pyproject.toml`)
   - Set up Python 3.11, dependencies, coverage thresholds
   - Verify: Workflow runs on PR

**VERIFICATION (Phase 1 complete):**
```bash
cd test_harness
pip install -e .
pytest tests/test_lmsr_stability.py tests/test_lmsr_overflow.py -v  # All pass, no NaN/inf
pytest tests/test_swap.py tests/test_double_spend.py -v             # Swap + double-spend logic correct
pytest tests/test_cashu_client.py -v --cov=cashu_client --cov-fail-under=95
cashu-mint-test dry-run --config config/baseline_config.yaml        # Output: "Connectivity: OK, Spec version: 1.0.0"
```

**UNBLOCKED AFTER PHASE 1:** mint-engineer must answer 8 questions (Section 12)

---

### PHASE 2: Core Engines (Stochastic, Whale, Solvency, Edge Cases)

Depends on: Phase 1 complete + mint-engineer answers.

1. **Stochastic engine** (`stochastic_engine.py`)
   - Include swap operations in trade sequences
   - NEW: overflow stress tests with large b
   - Verify: `pytest tests/test_stochastic.py -v`

2. **Whale engine** (`whale_engine.py`)
   - NEW: concurrent mint under whale pressure
   - Verify: `pytest tests/test_whale.py -v`

3. **Solvency engine** (`solvency_engine.py`)
   - NEW: concurrent mint/melt under reserve pressure
   - Verify: `pytest tests/test_solvency.py -v`

4. **Edge case engine** (`edge_case_engine.py`)
   - NEW: melt quote fee_ppk validation (IMPORTANT #4)
   - NEW: concurrent mint under reserve pressure
   - Verify: `pytest tests/edge_case_engine.py -v`

**VERIFICATION (Phase 2 complete):**
```bash
cashu-mint-test run --config config/baseline_config.yaml --dry-run
# Expected: All engines report PASS
```

---

### PHASE 3: Integration Testing

Depends on: Phase 2 complete + testnet mint deployed.

1. **End-to-end test** (`integration_tests/test_end_to_end.py`)
   - Full flow with swap
   - Verify: `pytest integration_tests/test_end_to_end.py -v`

2. **Concurrent redemptions** (`integration_tests/test_concurrent_redemptions.py`)
   - Already in Phase 1; now run against real testnet

3. **NEW: Swap under pressure** (`integration_tests/test_swap_under_pressure.py`)
   - Verify: `pytest integration_tests/test_swap_under_pressure.py -v`

4. **NEW: Concurrent mint/melt** (`integration_tests/test_concurrent_mint_melt.py`)
   - Verify: `pytest integration_tests/test_concurrent_mint_melt.py -v`

---

## 8. Success Criteria (REVISED)

✅ **Phase 1 (Foundation — CRITICAL):**
- LMSR engine passes all 50+ stability vectors + 20+ overflow stress tests (no NaN/inf)
- Proof dataclass correctly tracks keyset_id and side
- Cashu client implements swap + check endpoints with 95%+ coverage
- Swap engine validates NUT-03 protocol (basic, under pressure, chain, fee handling)
- Double-spend engine validates NUT-07 protocol (concurrent melt, check endpoint, swap spend status)
- Config loader validates protocol version on startup
- CLI dry-run succeeds
- CI/CD workflow runs on PR with 85%+ coverage

✅ **Phase 2 (Engines):**
- Stochastic engine includes swap operations; passes overflow stress tests
- Whale engine validates concurrent mint under whale pressure
- Solvency engine validates concurrent mint/melt under reserve pressure
- Edge case engine validates melt quote fee_ppk and concurrent mint
- All engines integrate with swap/double-spend engines correctly

✅ **Phase 3 (Integration):**
- End-to-end test (with swap) succeeds against testnet mint
- Concurrent redemptions + swap + concurrent mint all validated

---

## 9. Unresolved Dependencies (Mint-Engineer Sign-Off Required)

These 8 questions must be answered before Phase 2 implementation:

1. **LMSR Formula Equivalence**: Are the log-space LMSR formulas in Phase 1 identical to the Rust CDK? Any edge cases?

2. **Resolution Fee Timing & Solvency**: When is the 5% resolution fee applied? Does it affect reserve calculation?

3. **Reserve Endpoint**: Is there a `/v1/reserve` endpoint, or validate via redemption only?

4. **BLS/DLEQ Verification**: Required in harness, or assume mint is honest?

5. **Keyset ID Convention**: Confirm `<market_id>_long` / `<market_id>_short` or provide actual format.

6. **Cashu Spec Version**: Target version for harness validation (e.g., `1.0.0`)?

7. **Acceptable Trade Throughput**: Target TPS for `engine.rate_limit_trades_per_second` default?

8. **Mint Precision**: Fee/amount precision rules (sats, millisats, fixed-point)?

---

## 10. Known Issues (7 BLOCKING + 9 IMPORTANT)

### 🔴 BLOCKING ISSUES (7 Total)

1. **Protocol Versioning (pragmatic)** — ✅ FIXED: Config validation added
2. **Floating-Point Precision (pragmatic)** — ✅ FIXED: Stability test suite added
3. **End-to-End Solvency (pragmatic)** — ✅ FIXED: Redemption testing added
4. **LMSR Numerical Overflow (cashu-expert)** — ✅ FIXED: Log-space computation implemented
5. **NUT-03 (Swap) Protocol (cashu-expert)** — ✅ FIXED: Swap engine + tests added
6. **Multi-Keyset Token Identity (cashu-expert)** — ✅ FIXED: Proof dataclass with keyset_id/side
7. **Double-Spend Validation (cashu-expert)** — ✅ FIXED: NUT-07 check endpoint + tests added

### 🟠 IMPORTANT ISSUES (9 Total)

1. **NUT-07 check endpoint** — ✅ FIXED: Added to cashu_client.py
2. **Fee formula documentation** — ✅ FIXED: Melt quote fee_ppk validation added
3. **Concurrent minting** — ✅ FIXED: Concurrent mint tests added (whale pressure + solvency)
4. **Melt quote validation** — ✅ FIXED: test_melt_quote_fee_ppk added
5. **NUT-06 info validation** — ✅ FIXED: Correct endpoint routing
6. **Concurrent mint + redeem under reserve pressure** — ✅ FIXED: test_concurrent_mint_melt_under_pressure added
7. **Swap fee handling** — ✅ FIXED: test_swap_fee_handling validates swap doesn't apply trade fee
8. **Token identity through transformations** — ✅ FIXED: Proof dataclass preserves keyset_id/side
9. **Concurrent swap + melt interaction** — ✅ FIXED: test_swap_under_pressure added

---

## 11. Example Test Runs (UPDATED)

### Baseline Run (All Tests with Swap + Double-Spend)

```bash
cashu-mint-test run --config config/baseline_config.yaml
```

**Expected output (partial):**
```json
{
  "status": "PASS",
  "results": {
    "swap": {
      "basic_swap": "PASS",
      "under_pressure": "PASS",
      "chain": "PASS",
      "fee_handling": "PASS"
    },
    "double_spend": {
      "concurrent_melt": "PASS",
      "check_endpoint": "PASS",
      "swap_spend_status": "PASS"
    },
    "stochastic": {
      "iterations": 5000,
      "floating_point_errors_max": 1.2e-9,
      "overflow_stress_pass": true
    }
  }
}
```

---

## 12. Verdict & Timeline (UPDATED)

**STATUS:** 🔴 **BLOCKED — Phase 1 REQUIRES IMMEDIATE RESOLUTION of 7 blocking issues.**

All 7 blocking issues have been **incorporated into the plan and are ready for Phase 1 implementation**:
- BLOCKING #1–#3 (pragmatic) ✅ Addressed
- BLOCKING #4–#7 (cashu-expert) ✅ Addressed

**APPROVAL:** Phase 1 approved once implementations complete. Phases 2–3 approved pending mint-engineer answers (Section 9).

**Timeline (Phases 1–3, Revised for 7 Issues):**
- Phase 1: 4–5 days (foundation + critical protocols: LMSR overflow, swap, double-spend)
- Phase 2: 4–5 days (engines with concurrent stress)
- Phase 3: 2–3 days (integration tests)
- **Total: 2–3 weeks for production-ready harness**

---

## 13. Glossary

- **Solvency invariant**: `reserve >= max(outstanding_long_value, outstanding_short_value)`
- **LMSR**: Logarithmic Market Scoring Rule; constant-function market maker
- **NUT-03 Swap**: Cashu protocol for token transformation (value-preserving, keyset-changing)
- **NUT-07 Check**: Cashu protocol endpoint to query proof spend status
- **Double-spend**: Attempting to redeem same proof twice; prevented by mint's spend tracking
- **Keyset**: Cashu mint's public key set; identified by keyset ID
- **Proof**: Cashu bearer token with secret, amount, keyset_id, side
- **Melt**: Redeem Cashu proofs for satoshis
- **Log-space computation**: Numerical trick to compute log(exp(a) + exp(b)) without overflow
