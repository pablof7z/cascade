# Market Lifecycle

## Creation

### Who Can Create Markets

Any user — human or AI agent — can create a market. There are no permissions, whitelists, or curation gates.

### What Creation Requires

1. **A kind 982 Nostr event** — the market definition, including title, description, markdown content, category, and a unique slug (d-tag).
2. **Initial liquidity** — by design, the creator should seed the market with sats. The intended flow is that you cannot launch a $0 market — initial funding establishes the LMSR reserve and gives the creator their opening position. (Note: this requirement is intended design direction; enforcement in the current codebase is not yet complete.)

The creator is the first buyer. Because LMSR prices shares cheapest when the reserve is smallest, the market creator benefits from the lowest entry price. This creates a natural incentive to create good markets — if you believe your prediction, you're rewarded for being first.

### Creation Flow

```
1. User publishes kind 982 event → market definition is on Nostr
2. User deposits sats (via Lightning / Cashu)
3. User mints initial shares → seeds LMSR reserve
4. Market is live — tradeable by anyone
```

---

## Active Trading

Once funded, a market accepts trades from anyone. Each trade:
- Moves sats into or out of the LMSR reserve
- Updates qLong / qShort (outstanding shares per side)
- Changes the market's probability (price moves continuously)
- Mints or burns Cashu bearer tokens

The mint is the authority on LMSR state. Nostr kind 983 events are the public audit log of trades, published by the mint after each transaction.

**Every "buy" is a mint**: you deposit sats and receive new Cashu tokens at the current LMSR price.
**Every "sell" is a withdrawal**: you return tokens to the mint and receive sats at the current LMSR price.

There is no secondary market. All trading is against the LMSR.

---

## Markets Never Close

There is no expiration mechanism. Markets do not close on a schedule. There is no date field, no countdown timer, no admin action that forces a market closed. There is no oracle. There is no resolution event. There is no "winner" declared by anyone.

A market that was created in 2026 is still tradeable in 2030 if the question is still unresolved. This is intentional: forcing closures would require a trusted party to enforce them, which contradicts the open, permissionless design.

---

## Economic Exhaustion

Markets don't close by decree. They reach exhaustion by gravity.

The process:

1. **Reality asserts itself.** The real-world event the market was predicting either happens or doesn't.
2. **Information enters the market.** Informed traders recognize that the outcome is now clear.
3. **Arbitrage kicks in.** Traders mint the undervalued side and withdraw from the overpriced side.
4. **Price converges.** The winning side approaches 100%. The losing side approaches 0%.
5. **Holders withdraw.** Traders holding high-priced tokens withdraw their sats at the LMSR price. As they do, the reserve drains and outstanding shares decrease.
6. **Market exhausts.** When all profitable positions have been withdrawn, the reserve reaches its minimum. The market is economically exhausted — not closed by decree, but by participants extracting their proceeds.

This is market microstructure working as intended. No oracle needed. No admin button. Just price signals and rational actors.

---

## Kind 984 — NOT APPLICABLE

> **Kind 984 "resolution events" do not apply to Cascade's model.** Cascade markets have no oracle, no resolution authority, and no close mechanism. The concept of a kind 984 resolution event has been removed from the design. Markets reach equilibrium through trading and withdrawal — not through a declared outcome.

---

## Withdrawals

**Withdrawing shares**: Return tokens to the mint at any time, receive sats at the current LMSR price minus the **2% withdrawal fee** → `gross_sats * 0.98` effective proceeds. (See `src/services/redemptionService.ts` — note: service name is a historical misnomer.)

**Shares near price 0**: Worth nearly nothing at the current LMSR price. Holders can still withdraw at any time for whatever the current price yields — there is no forced expiry or "worthless" declaration by any authority.

**Fee structure (two separate fees):**
- **1% trade fee** — applied on every mint (buy) and every withdrawal (sell) (`src/services/tradingService.ts`). Stays in the mint as reserve and treasury.
- **2% withdrawal fee** — applied on the gross withdrawal proceeds (`src/services/redemptionService.ts`). Separate from the trade fee.

These are distinct revenue streams. A trader pays the 1% trade fee when minting shares, then a 2% withdrawal fee on gross proceeds when withdrawing.

---

## Solvency

The LMSR reserve is mathematically guaranteed to always cover the worst-case withdrawal. It is not fractional reserve.

At any point:
```
Reserve ≥ max(qLong, qShort) × 1.0 sat/share
```

This is a property of the cost function, not a policy choice. The reserve can never be insufficient to pay out all holders on the dominant side.

See [lmsr.md](../technical/lmsr.md) for the mathematical details.

---

## Market Status Tags

A kind 982 event carries a `["status", ...]` tag:

| Status | Meaning |
|--------|---------|
| `open` | Market is live and tradeable |
| `archived` | Market removed from active listing (not deleted — events are permanent) |

Status is part of the market event metadata. Because kind 982 is non-replaceable (immutable), status updates are conveyed by convention in the application layer.
