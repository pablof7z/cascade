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

Beyond the standard Cashu NUTs, the mint exposes prediction-market-specific endpoints. The following reflects the actual routes in `cascade-mint/crates/cascade-api/src/routes.rs`:

### Price & Lightning

- `GET /api/price/{currency}` — price feed
- `POST /api/lightning/create-order` — create a Lightning-funded trade order
- `POST /api/lightning/check-order` — check Lightning invoice/order status
- `POST /api/lightning/settle/{order_id}` — settle a completed Lightning trade

### Market Management

- `POST /api/market/create` — register a new market with the mint
- `GET /api/market/{id}` — fetch current market state
- `POST /api/market/{id}/resolve` — mark a market as resolved

### Trade Execution

- `POST /api/trade/bid` — buy shares (LMSR-priced)
- `POST /api/trade/ask` — sell shares (LMSR-priced)

### Settlement & Redemption

- `POST /v1/cascade/redeem` — redeem outcome shares for sats after resolution
- `POST /v1/cascade/settle` — settle a resolved market (set winning/losing keysets)

### Utility

- `GET /v1/keys` — mint public keys (for proof construction)
- `GET /health` — health check

**Note:** There is no `/v1/cascade/trade` endpoint in the current implementation — trades go through the Lightning order flow (`/api/lightning/create-order` → `/api/lightning/settle/{order_id}`) or direct bid/ask endpoints.

---

## LMSR State

The mint is the single source of truth for LMSR state. `qLong`, `qShort`, and the reserve for each market are managed by the mint.

**Note on persistence:** Market state and spent-proof tracking are currently partly in-memory (`MarketManager` uses an in-memory `HashMap` keyed by event ID). SQLite is the active database (not PostgreSQL — see `cascade-mint/README.md`), used for CDK keyset and proof persistence. Full LMSR state persistence to SQLite is the target but not yet complete.

Nostr kind 983 events are the public audit trail derived from that state — not the reverse. If there's ever a discrepancy between on-chain Nostr events and the mint's database, the database wins.

The frontend computes estimated prices using the same LMSR functions, but the canonical state is always the mint's.

---

## Fees

Two separate fees apply:

- **1% trade fee** — applied on every buy and sell. Applied at the mint level (`src/services/tradingService.ts`).
- **2% redemption rake** — applied on the gross payout when redeeming shares from a resolved market (`src/services/redemptionService.ts`).

Fees stay in the mint as reserve and treasury. Cascade extracts revenue by melting accumulated ecash via Lightning.

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
