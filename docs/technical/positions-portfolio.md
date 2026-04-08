# Positions & Portfolio

## What a Position Is

A position is a record that a user holds shares in a prediction market outcome. It captures:
- Which market
- Which side (YES / NO)
- How many shares held
- How much was paid (in sats) to acquire them
- The average purchase price

---

## Current Implementation: Kind 30078 (NIP-78)

Positions are stored as NIP-78 application-specific data events (kind 30078). The user signs and publishes these events themselves.

```
kind: 30078
pubkey: <user's pubkey>
content: <JSON-stringified position object>
tags:
  ["d", "cascade:position:<marketId>:<direction>"]
  ["c", "cascade"]
  ["v", "1"]
```

**d-tag format**: `cascade:position:<marketId>:<direction>`

Example: `cascade:position:abc123def456:yes`

**Notes on the actual event shape:**
- `content` is a JSON-stringified position object (not an empty string)
- `direction` in the d-tag is lowercase: `"yes"` (LONG) or `"no"` (SHORT)
- Tags use the `d/c/v` pattern: `d` = identity, `c` = app namespace (`"cascade"`), `v` = version (`"1"`)
- The position fields (shares, amount, avg_price, etc.) are inside the JSON content, not in tags

### Replaceability

Kind 30078 is a replaceable event (NIP-78 / parameterized replaceable). For a given pubkey + d-tag combination, only the most recent event counts. Last-write-wins.

There's no concurrency concern because each user writes only their own positions, and each position (market + direction) has a unique d-tag. No two devices can conflict on the same position without the user being the author of both.

---

## Updating Positions

After each trade, the frontend publishes an updated kind 30078 event reflecting the new position state:

- After **buying** YES shares: increment `shares`, update `amount` (add sats spent), recalculate `avg_price`
- After **selling** YES shares: decrement `shares`, update `amount` proportionally
- After **full redeem**: either delete the event or set `shares` to `"0"`

The average price is recalculated on each buy:
```
new_avg_price = (old_shares * old_avg_price + new_shares * new_price) / (old_shares + new_shares)
```

---

## PnL Calculation

**Unrealized PnL**: The position's current mark-to-market value minus the amount paid.
```
unrealized_pnl = (current_lmsr_price * shares_held * 1 sat) - total_sats_committed
```

Current LMSR price is fetched from the mint (authoritative) or computed from the market's `qLong`/`qShort` values visible in kind 983 trade events.

**Realized PnL**: Locked in after a redeem. The difference between the sats received and the sats paid for the redeemed shares.

---

## Portfolio Page (`/portfolio`)

Shows the current user's open positions across all markets:
- Market title and link
- Direction (YES / NO)
- Shares held
- Average purchase price
- Current price
- Unrealized PnL (absolute and percentage)

Only open (non-zero) positions are shown. Closed/redeemed positions may appear in a trade history section.

---

## Profile Page (`/profile/[pubkey]`)

Shows another user's positions. Kind 30078 events are published publicly to Nostr — anyone can see them.

The profile page displays:
- Active positions with current values
- A performance summary (win rate, total PnL if visible)
- Recent market activity

---

## Kind 30079 — Payout Records

After a successful redemption from a resolved market, the app publishes a kind 30079 payout event recording the completed payout. This is a parameterized replaceable event (one per position per market).

See `src/services/resolutionService.ts` and `src/services/nostrService.ts` (`PAYOUT_EVENT_KIND = 30079`) for the implementation.

---

## Local Storage

`src/positionStore.ts` maintains position state with a localStorage fallback. Positions are loaded from Nostr (kind 30078) and merged with any locally-held state. This hybrid approach handles offline scenarios and multi-device edge cases.

---

## Future: Deriving Positions from Kind 983

The current kind 30078 approach has a limitation: it's a user-maintained record. If a user trades on multiple devices, or uses an agent on their behalf, kind 30078 can become stale.

A more robust approach: derive positions from kind 983 trade events published by the mint.

The challenge is that Cashu is a bearer system — kind 983 events don't carry the trader's pubkey. The mint doesn't know who holds what. Linking kind 983 events back to user positions requires either:
1. The user publishing their own signed trade attribution events
2. A deterministic derivation from the user's Cashu tokens

This is a known limitation. Kind 30078 is the current solution. Kind 983-based derivation is a future improvement. If/when the derivation approach is implemented, kind 30078 may be deprecated.
