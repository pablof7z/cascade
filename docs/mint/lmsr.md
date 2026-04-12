# LMSR In The Mint

Cascade uses the Logarithmic Market Scoring Rule (LMSR) as its automated market maker. The market mint executes every buy and sell against this curve.

## What LMSR Does

LMSR replaces the order book.

- there is no counterparty matching
- prices update continuously with each trade
- the market mint can always quote a buy or sell
- the reserve stays solvent by construction

## Market State

Each market tracks:

- `qLong` — outstanding LONG shares
- `qShort` — outstanding SHORT shares
- `b` — liquidity sensitivity

These values are enough to compute both price and reserve requirement.

## Accounting Unit

The market accounting unit is the unit the LMSR engine uses for cost, fees, reserve, and proceeds.

- for launch settlement, Cascade uses **`msat`**
- UI still renders the product in USD
- `USD <-> msat` conversion is handled outside the LMSR math by the wallet-mint FX layer

This means the LMSR reserve is a Lightning-settlement reserve, while the product still speaks dollars at the boundary.

## Cost Function

```text
C(qLong, qShort) = (1 / b) * ln(e^(b*qLong) + e^(b*qShort))
```

This is the reserve requirement implied by the current market state.

## Prices

```text
p_long  = e^(b*qLong) / (e^(b*qLong) + e^(b*qShort))
p_short = 1 - p_long
```

Prices are always between `0` and `1`. They are the current implied probability for each side.

## Buy Dynamics

To buy `delta_q` LONG shares:

```text
cost = C(qLong + delta_q, qShort) - C(qLong, qShort)
```

Buying increases outstanding supply on that side and pushes the price further in that direction. Early buyers get cheaper entry than later buyers.

In practice, users usually specify a dollar spend, not a share count. The coordinator first maps the user's USD budget into an `msat` budget through the FX layer, then the market mint solves how many shares that budget buys.

## Sell Dynamics

To sell `delta_q` LONG shares:

```text
proceeds = C(qLong, qShort) - C(qLong - delta_q, qShort)
```

Selling removes outstanding supply on that side and reduces the reserve accordingly.

Important distinction:

- selling against LMSR is market activity
- swapping bearer proofs is not

Only the first case changes market state and produces kind `983`.

## Starting State

When `qLong = qShort = 0`, both sides start at `0.5`.

That means every market opens at a neutral midpoint and moves only through trading.

## Solvency

The reserve is always:

```text
reserve = C(qLong, qShort)
```

That reserve is sufficient to cover the dominant side in the worst case.

This is not fractional reserve. Solvency is a mathematical property of the cost function, not an operator promise.

## The `b` Parameter

`b` controls sensitivity.

- smaller `b` means sharper price movement
- larger `b` means deeper, slower-moving liquidity

Current code paths may use different parameterizations between frontend preview math and the Rust mint implementation, but they are intended to represent the same LMSR behavior.

## Implementation Notes

### Frontend Preview Math

The frontend keeps local LMSR helpers for display and estimation only. Those values are previews, not execution authority.

### Rust Mint Execution

The Rust market mint is the execution authority. It computes the actual transition that governs token issuance, token consumption, and reserve updates.

If preview math and mint execution ever disagree, the mint wins.

## Product Consequences

- markets never need an oracle or formal closing phase
- there is no resolution event
- prices drift toward extremes as traders react to reality
- users sell when the current price is favorable to them
- market cap disappears through trading behavior, not an admin command
