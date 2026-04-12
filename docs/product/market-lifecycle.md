# Market Lifecycle

## Creation

### Who Can Create Markets

Any user — human or AI agent — can create a market. There are no permissions, whitelists, or curation gates.

### What Creation Requires

1. **A kind 982 Nostr event** — the market definition, including title, description, markdown content, category, and a unique slug (d-tag).
2. **Initial liquidity** — by design, the creator should seed the market with dollars from the wallet mint. The intended flow is that you cannot launch a $0 market — initial funding establishes the LMSR reserve and gives the creator their opening position. (Note: this requirement is intended design direction; enforcement in the current codebase is not yet complete.)

The creator is the first buyer. Because LMSR prices shares cheapest when the reserve is smallest, the market creator benefits from the lowest entry price. This creates a natural incentive to create good markets — if you believe your prediction, you're rewarded for being first.

### Creation Flow

```
1. User signs and publishes kind 982 event → market definition is on Nostr
2. Creator sees the market in a pending creator-only state
3. User funds the USD wallet mint
4. User spends USD into the market mint → seeds LMSR reserve
5. Mint publishes the first kind 983 trade event e-tagging that market
6. Market becomes visible in public discovery and tradeable by anyone
```

### Pending Visibility Rule

A market can exist on Nostr before it is publicly discoverable in the product.

- The creator can see their own newly published kind `982` market immediately.
- Public discovery surfaces should exclude markets that do not yet have at least one mint-authored kind `983`.
- The first kind `983` is the point where the market becomes publicly visible in the app.

---

## Active Trading

Once funded, a market accepts trades from anyone. Each trade:
- Moves dollars into or out of the LMSR reserve
- Updates qLong / qShort (outstanding shares per side)
- Changes the market's probability (price moves continuously)
- Mints or burns Cashu bearer tokens

The mint is the authority on LMSR state. Nostr kind 983 events are the public audit log of trades, published by the mint after each transaction.

**Every "buy" is a mint**: you spend USD from the wallet mint and receive new Cashu tokens at the current LMSR price.
**Every "sell" is an exit trade**: you return tokens to the mint and receive USD ecash at the current LMSR price.

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
3. **Arbitrage kicks in.** Traders mint the undervalued side and sell the overpriced side.
4. **Price converges.** The winning side approaches 100%. The losing side approaches 0%.
5. **Holders sell.** Traders holding high-priced tokens sell at the LMSR price. As they do, the reserve drains and outstanding shares decrease.
6. **Market exhausts.** When all profitable positions have been sold, the reserve reaches its minimum. The market is economically exhausted — not closed by decree, but by participants extracting their proceeds.

This is market microstructure working as intended. No oracle needed. No admin button. Just price signals and rational actors.

---

Markets never close. There is no resolution event and no admin close button. The market cap simply disappears naturally as users sell at prices that make sense to them.

---

## Exits

**Selling shares**: Return tokens to the mint at any time, receive USD ecash at the current LMSR price.

**Shares near price 0**: Worth nearly nothing at the current LMSR price. Holders can still sell at any time for whatever the current price yields — there is no forced expiry or "worthless" declaration by any authority.

---

## Solvency

The LMSR reserve is mathematically guaranteed to always cover the worst-case sell-side payout. It is not fractional reserve.

At any point:
```
Reserve ≥ max(qLong, qShort) in the market's accounting unit
```

For launch, the settlement accounting unit is `msat`. Product surfaces can still normalize notional values into USD, but the reserve guarantee itself is enforced in the market mint's settlement unit. The reserve can never be insufficient to pay out all holders on the dominant side.

See [lmsr.md](../mint/lmsr.md) for the mathematical details.

---

## Market Status Tags

A kind 982 event carries a `["status", ...]` tag:

| Status | Meaning |
|--------|---------|
| `open` | Market is live and tradeable |
| `archived` | Market removed from active listing (not deleted — events are permanent) |

Status is part of the market event metadata. Because kind 982 is non-replaceable (immutable), status updates are conveyed by convention in the application layer.
