# LMSR: How Pricing Works

Cascade uses the **Logarithmic Market Scoring Rule (LMSR)** as its automated market maker. Every market — module and thesis — is priced by LMSR. This document explains how it works and why.

---

## What LMSR Does

LMSR is an automated market maker. Unlike a traditional order book, there's no counterparty matching. The platform itself is always willing to buy or sell shares at a price determined by the current state of the market.

This means:
- Trades execute instantly — no waiting for a counterparty
- Prices update continuously with every trade
- The reserve is always solvent (mathematically guaranteed)
- Early buyers get cheaper prices; later buyers pay more

---

## The Math

**State variables:**
- `qLong` — total outstanding LONG shares
- `qShort` — total outstanding SHORT shares
- `b` — liquidity sensitivity parameter (currently `0.0001`)

**Cost function:**
```
C(qLong, qShort) = (1/b) * ln(e^(b*qLong) + e^(b*qShort))
```

**Prices:**
```
p_long  = e^(b*qLong) / (e^(b*qLong) + e^(b*qShort))
p_short = 1 - p_long
```

Prices are always between 0 and 1. They represent the market's current probability estimate for each outcome. At any moment, `p_long + p_short = 1`.

**Starting state:**
When `qLong = qShort = 0`, the cost function evaluates to `(1/b) * ln(2)`, and both prices equal exactly 0.5. All markets start at 50/50.

---

## Buying Shares

To buy Δq LONG shares, the cost is:
```
cost = C(qLong + Δq, qShort) - C(qLong, qShort)
```

The more LONG shares already outstanding (`qLong` is large), the more expensive each additional LONG share becomes. This is the core self-reinforcing property: buying moves the price, making it more expensive to buy in the same direction.

In practice, a user specifies how many sats they want to spend, and the system solves for Δq. This is done via binary search (internal helper `solveBuyTokens` in `src/market.ts` — not part of the public API) because there's no closed-form inverse.

---

## Selling (Redeeming) Shares

To sell Δq LONG shares back, the payout is:
```
payout = C(qLong, qShort) - C(qLong - Δq, qShort)
```

Selling decreases outstanding shares and reduces the reserve proportionally. The payout is always less than or equal to what was paid to acquire the shares (if the price hasn't moved in your favor).

After resolution, winning shares redeem at the LMSR fill price (minus the 2% redemption rake). Losing shares are worth 0.

---

## Solvency Guarantee

The LMSR reserve is always exactly `C(qLong, qShort)` sats. This amount is sufficient to pay out whichever side wins entirely, even in the worst case (e.g., all LONG shares redeem and SHORT shares are worthless).

Formally: the reserve always covers `max(qLong, qShort)` sats of payouts. This is a mathematical property of the cost function, not a policy or promise.

This is **not** fractional reserve. There is no leverage. The money is there.

---

## The b Parameter

`b` is the liquidity sensitivity parameter. Currently `0.0001`.

- **Small b**: Prices move dramatically with each trade. A small trade shifts the probability significantly.
- **Large b**: Prices are sticky. Large trades are needed to move the market meaningfully.

`b` also determines how much liquidity the market maker implicitly commits. Lower `b` means more responsive prices but less liquidity depth.

The current value of `0.0001` is set in the codebase. It may be tuned per-market in future versions.

---

## Implementation

There are two independent LMSR implementations that may differ in parameterization.

### Frontend LMSR (`src/market.ts`)

Uses the form: `C(qLong, qShort) = ln(e^(b·qLong) + e^(b·qShort)) / b`

| Function | Visibility | Description |
|----------|------------|-------------|
| `costFunction(qLong, qShort, b)` | public | Computes C(qLong, qShort) |
| `priceLong(qLong, qShort, b)` | public | Current probability of LONG outcome |
| `priceShort(qLong, qShort, b)` | public | Current probability of SHORT outcome |
| `solveBuyTokens(market, side, sats)` | **internal** | Binary search: given N sats, how many shares? Not exported. |
| `solveRedeemValue(market, side, tokens)` | **internal** | Given N shares, how many sats to receive? Not exported. |
| `applyBuy(market, shares, direction)` | public | Returns new market state after a buy |
| `applyRedeem(market, shares, direction)` | public | Returns new market state after a redeem |

The frontend uses these functions for price display and local state estimation only.

### Rust Mint LMSR (`cascade-mint/crates/cascade-core/src/lmsr.rs`)

Uses the standard Hanson form: `C(qLong, qShort) = b · ln(e^(qLong/b) + e^(qShort/b))`

This is mathematically equivalent to the frontend form but the `b` parameter has the inverse interpretation — a larger `b` means a deeper (less price-sensitive) market in the Rust implementation, whereas the frontend's small `b = 0.0001` produces high price sensitivity. The two implementations may use different `b` values.

The mint's `LmsrEngine` exposes `price_long`, `price_short`, and internal `cost_function` methods.

**Note on state persistence:** The current Rust mint market state is held in an in-memory `HashMap` inside `MarketManager` — not yet fully DB-authoritative. Market state does not persist across restarts in the current implementation. Full SQLite persistence is the target.

---

## Why LMSR

**No order book**: No need to match buyers and sellers. The platform is always the counterparty.

**Guaranteed liquidity**: There's always a price. You can always buy or sell any amount (though large trades get worse prices).

**Automated price discovery**: Prices update with every trade without any external input.

**Solvency by construction**: The reserve exactly matches what's needed. No risk of underfunding.

**Well-studied**: LMSR was developed by Robin Hanson specifically for prediction markets. It has extensive academic literature and is proven to aggregate information efficiently.
