# The Cascade Mint

The Cascade Mint is a custom Cashu mint with built-in LMSR prediction market mechanics. It is the authoritative source of LMSR state for all markets.

---

## Why Custom

Off-the-shelf Cashu mints issue tokens 1:1 against Lightning deposits. One sat in → one ecash token. This doesn't work for prediction markets.

In a prediction market, tokens represent shares in an outcome. Their value depends on the current probability — a LONG share bought when probability is 70% costs ~0.7 sats, not 1 sat. Redemption value changes continuously. A standard mint has no concept of this.

Cascade requires a mint that:
1. Prices share issuance using LMSR (not 1:1)
2. Maintains `qLong` / `qShort` state per market
3. Manages separate token keysets per outcome per market
4. Settles resolved markets at the canonical 1.0/0.0 prices

No existing Cashu mint implementation supports this. We build custom.

**Implementation**: CDK Rust (Cashu Dev Kit). Not Nutshell, not cashu-ts.

---

## Token Model

Cascade uses standard Cashu bearer tokens. Users hold ecash directly in their wallets — not accounts on the platform.

**Key properties:**
- Bearer model: whoever holds the tokens, owns them
- Privacy: the mint cannot link tokens to identities
- Instant: no blockchain confirmation needed
- Lightning-backed: deposits via NUT-04, withdrawals via NUT-05

**Token unit**: Satoshis. 1 token = 1 sat (by denomination, though the economic value per share varies with LMSR pricing).

---

## Keysets: Two Per Market

Every market gets exactly two keysets:
- **LONG keyset** — for YES-side shares
- **SHORT keyset** — for NO-side shares

All users trading in the same market share the same keysets. There are no per-user keysets.

The mint maintains a mapping from (keyset ID) → (market event ID, direction). When a token is presented for redemption, the mint looks up which market and side it belongs to, checks the LMSR state, and pays out accordingly.

After resolution, the winning keyset pays out at 1.0 sat/share (minus fee). The losing keyset is worthless.

---

## Standard NUTs Implemented

| NUT | Description |
|-----|-------------|
| NUT-00 | Base protocol |
| NUT-01 | Key exchange |
| NUT-02 | Keyset IDs |
| NUT-03 | Swap (split/combine tokens) |
| NUT-04 | Minting via Lightning (deposits) |
| NUT-05 | Melting via Lightning (withdrawals) |
| NUT-06 | Mint info |
| NUT-07 | Token check |
| NUT-12 | DLEQ proofs |
| NUT-17 | WebSocket subscriptions |

---

## Custom Endpoints

Beyond the standard Cashu NUTs, the mint exposes prediction-market-specific endpoints:

### `POST /v1/cascade/trade`

Execute a prediction market trade. Input: market ID, direction (YES/NO), sat amount, Cashu proofs for payment. Output: new Cashu tokens representing the purchased shares.

The mint:
1. Validates the Cashu proofs
2. Computes the LMSR cost for the requested trade
3. Deducts the payment (burning the input proofs)
4. Updates `qLong` or `qShort` in the database
5. Issues new Cashu tokens at the correct denomination
6. Publishes a kind 983 trade event to Nostr

### `POST /v1/cascade/redeem`

Redeem outcome shares for sats. Input: Cashu proofs (representing shares), market ID. Output: sats (via Cashu or Lightning).

The mint:
1. Validates that the proofs are valid LONG or SHORT tokens for the given market
2. Computes the LMSR redemption value (or uses 1.0 if market is resolved)
3. Burns the share tokens
4. Issues standard Cashu ecash tokens for the sat payout
5. Publishes a kind 983 redeem event to Nostr

### `POST /v1/cascade/settle`

Settle a resolved market. Triggered after a kind 984 resolution event is confirmed.

The mint:
1. Marks the market as resolved (YES or NO)
2. Sets winning-side shares to redeem at exactly 1.0 sat/share
3. Marks losing-side shares as worthless
4. Updates database state

---

## LMSR State

The mint is the single source of truth for LMSR state. `qLong`, `qShort`, and the reserve for each market live in the mint's PostgreSQL database.

Nostr kind 983 events are the public audit trail derived from that state — not the reverse. If there's ever a discrepancy between on-chain Nostr events and the mint's database, the database wins.

The frontend computes estimated prices using the same LMSR functions, but the canonical state is always the mint's.

---

## Fee

**1% flat on every trade** (buy and sell). Applied at the mint level.

The fee stays in the mint as reserve and treasury. Cascade extracts revenue by melting accumulated ecash via Lightning.

---

## Mint Identity

The mint has its own Nostr keypair — separate from any user or platform identity. All kind 983 trade events are published with the mint's pubkey as the author. This provides a verifiable source for the trade audit log.

---

## URL Routing

The mint uses URL path segmentation to route between markets — not Nostr relay routing. Each market is addressable by its event ID or slug in the mint's URL structure.

---

## Solvency

The mint's reserve is always `C(qLong, qShort, b)` sats — the LMSR cost function evaluated at the current share state. This amount is mathematically sufficient to pay out whichever outcome wins entirely.

There is no leverage. There is no fractional reserve. The solvency guarantee is a property of the mathematics, not a policy.

See [lmsr.md](lmsr.md) for the mathematical details.
