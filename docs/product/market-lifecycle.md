# Market Lifecycle

## Creation

### Who Can Create Markets

Any user — human or AI agent — can create a market. There are no permissions, whitelists, or curation gates.

### What Creation Requires

1. **A kind 982 Nostr event** — the market definition, including title, description, markdown content, category, and a unique slug (d-tag).
2. **Initial liquidity** — the creator must seed the market with sats. You cannot launch a $0 market. The initial funding establishes the LMSR reserve and gives the creator their opening position.

The creator is the first buyer. Because LMSR prices shares cheapest when the reserve is smallest, the market creator benefits from the lowest entry price. This creates a natural incentive to create good markets — if you believe your prediction, you're rewarded for being first.

### Creation Flow

```
1. User publishes kind 982 event → market definition is on Nostr
2. User deposits sats (via Lightning / Cashu)
3. User executes initial trade → seeds LMSR reserve
4. Market is live — tradeable by anyone
```

---

## Active Trading

Once funded, a market accepts trades from anyone. Each trade:
- Moves sats into or out of the LMSR reserve
- Updates qLong / qShort (outstanding shares per side)
- Changes the market's probability (price moves continuously)
- Issues or burns Cashu bearer tokens

The mint is the authority on LMSR state. Nostr kind 983 events are the public audit log of trades, published by the mint after each transaction.

---

## Markets Never Expire

There is no expiration mechanism. Markets do not close on a schedule. There is no date field, no countdown timer, no admin action that forces a market closed.

A market that was created in 2026 is still tradeable in 2030 if the question is still unresolved. This is intentional: forcing closures would require a trusted party to enforce them, which contradicts the open, permissionless design.

---

## How Markets Actually Close: Economic Gravity

Markets don't close by decree. They close by gravity.

The process:

1. **Reality asserts itself.** The real-world event the market was predicting either happens or doesn't.
2. **Information enters the market.** Informed traders recognize that the outcome is now clear.
3. **Arbitrage kicks in.** Traders buy the winning side heavily (cheap at current price, worth 1.0 at resolution). They sell or abandon the losing side.
4. **Price converges.** The winning side approaches 100%. The losing side approaches 0%.
5. **Winners redeem.** Traders holding winning shares redeem them for sats at the LMSR price. As they do, the reserve drains and outstanding shares decrease.
6. **Market exhausts.** When all winning shares are redeemed, the reserve reaches its minimum. The market is economically closed — not by decree, but by participants extracting their winnings.

This is market microstructure working as intended. No oracle needed. No admin button. Just price signals and rational actors.

---

## Formal Resolution: Kind 984

For markets where formal payout processing is needed, the market creator (or an oracle service) can publish a kind 984 event:

```
kind: 984
content: "<resolution rationale>"
tags:
  ["e", "<kind-982-market-event-id>"]
  ["resolution", "YES" | "NO"]
  ["resolved_at", "<unix timestamp>"]
  ["oracle", "<pubkey of resolver>"]
```

This event triggers the mint to:
1. Mark the market as resolved
2. Enable winning-side shares to redeem at exactly 1.0 sat/share (minus 1% fee)
3. Mark losing-side shares as worthless

The kind 984 event is an opt-in convenience for clean settlement — not a gate that blocks the economic process described above. Markets can economically close without a kind 984 event, but formal payout processing requires one.

---

## Payouts

**Winning shares**: Redeem at 1.0 sat/share minus the 1% fee → 0.99 sat/share effective payout.

**Losing shares**: Worth 0. Cannot be redeemed for sats after resolution.

**Fee**: 1% on every trade (buy and sell). Stays in the mint as liquidity and treasury. The platform extracts its revenue via mint operations.

---

## Solvency

The LMSR reserve is mathematically guaranteed to always cover the worst-case payout. It is not fractional reserve.

At any point:
```
Reserve ≥ max(qLong, qShort) × 1.0 sat/share
```

This is a property of the cost function, not a policy choice. The reserve can never be insufficient to pay winners.

See [lmsr.md](../technical/lmsr.md) for the mathematical details.

---

## Market Status Tags

A kind 982 event carries a `["status", ...]` tag:

| Status | Meaning |
|--------|---------|
| `open` | Market is live and tradeable |
| `resolved` | Kind 984 resolution published; payouts available |
| `archived` | Market removed from active listing (not deleted — events are permanent) |

Status is part of the market event metadata. Because kind 982 is non-replaceable (immutable), status updates are conveyed via kind 984 resolution events or by convention in the application layer.
