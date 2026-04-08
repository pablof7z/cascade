# Backend Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust |
| Database | SQLite (active config; PostgreSQL is the production target) |
| Lightning | LND (Lightning Network Daemon) |
| Cashu | CDK Rust (Cashu Dev Kit) |
| Nostr publishing | Custom Nostr client |
| Network | Signet (testing), mainnet (production) |
| Deployment | Self-hosted |

The backend is self-hosted infrastructure — not Vercel. The frontend deploys to Vercel; the backend runs on dedicated servers.

---

## Role: The Mint is Authoritative

The backend's primary role is operating the Cascade Mint — the custom Cashu mint with LMSR prediction market mechanics.

**The mint is the authoritative source of LMSR state.** Not Nostr. Not the frontend. The mint's database holds the canonical `qLong`, `qShort`, and reserve values for every market.

Nostr kind 983 events are the public audit log, published by the mint after each trade. They're derived from the database — if there's ever a discrepancy, the database wins.

**Note:** Currently, market state and spent-proof tracking are partly in-memory (`MarketManager` uses an in-memory `HashMap`). SQLite is used for CDK keyset and proof persistence, but full market state persistence to SQLite is not yet complete. PostgreSQL remains the production target.

---

## Architecture Layers

```
HTTP API
   │
   ├── LMSR Engine
   │   └── Computes prices, validates solvency
   │
   ├── Cashu Mint (CDK)
   │   └── Issues / redeems bearer tokens
   │
   ├── SQLite
   │   └── Persists CDK keysets, proofs (LMSR state currently partly in-memory)
   │
   ├── LND
   │   └── Lightning deposits (NUT-04) and withdrawals (NUT-05)
   │
   └── Nostr Publisher
       └── Publishes kind 983 trade events as audit log
```

---

## HTTP API

The backend exposes:

**Standard Cashu NUT endpoints** (used by the frontend wallet and by any standard Cashu client):
- Key exchange, keyset discovery, token swap, mint (deposit), melt (withdraw), token check, etc.

**Custom Cascade endpoints** (see `cascade-mint/crates/cascade-api/src/routes.rs`):
- `GET /api/price/{currency}` — price feed
- `POST /api/lightning/create-order` — create a Lightning-funded trade order
- `POST /api/lightning/check-order` — check Lightning invoice status
- `POST /api/lightning/settle/{order_id}` — settle a Lightning trade
- `POST /api/market/create` — create a new market
- `GET /api/market/{id}` — fetch market state
- `POST /api/market/{id}/resolve` — resolve a market
- `POST /api/trade/bid` — buy shares
- `POST /api/trade/ask` — sell shares
- `POST /v1/cascade/redeem` — redeem outcome shares for sats
- `POST /v1/cascade/settle` — settle a resolved market
- `GET /v1/keys` — mint public keys (for test proof construction)
- `GET /health` — health check

See [mint.md](mint.md) for detailed endpoint documentation.

---

## LMSR Engine

The LMSR engine computes prices and validates every trade before execution.

For each trade request:
1. Read current `qLong`, `qShort` from the database
2. Compute cost using `C(qLong + Δq, qShort) - C(qLong, qShort)`
3. Validate the user's payment (Cashu proofs) covers the cost
4. Update state atomically (database transaction)
5. Issue new tokens

The engine ensures the reserve invariant is maintained at all times: `reserve = C(qLong, qShort, b)`.

---

## Database

**Active storage: SQLite.** PostgreSQL is the production target but is not the current active configuration (see `cascade-mint/crates/cascade-mint/src/config.rs`).

SQLite currently stores CDK keyset and proof data. Market state (`qLong`, `qShort`, reserve) and spent-proof tracking are currently held partly in-memory in `MarketManager`. The intended persistent schema includes:

- **Markets**: market event ID, slug, creator pubkey, status, creation timestamp
- **LMSR state**: per-market `qLong`, `qShort`, `b`, reserve balance
- **Keysets**: keyset ID → (market event ID, direction) mapping
- **Spent proofs**: all Cashu proofs that have been consumed (double-spend prevention)
- **Trade history**: internal record of all trades (source of kind 983 events)
- **Lightning state**: pending payment hashes, settlement status

---

## Lightning Integration

**LND** handles all Lightning Network operations.

- **Deposits** (NUT-04): User creates a Lightning invoice via the mint. User pays it. Mint issues Cashu tokens.
- **Withdrawals** (NUT-05): User provides a BOLT11 invoice. Mint pays it via LND. User's tokens are burned.

The mint doesn't custody Lightning funds beyond the operational reserve. LND handles channel management, routing, and settlement.

---

## Nostr Publishing

After every trade, the backend publishes a kind 983 event to Nostr relays using the mint's own Nostr keypair (separate from any user identity).

This is the public audit trail. Anyone subscribed to kind 983 events for a given market can reconstruct the full trading history.

---

## Key Invariants

1. **Mint DB is authoritative** — never derive state from Nostr events
2. **Reserve is always solvent** — enforced by LMSR math; any code path that could violate this is a bug
3. **Atomic trade execution** — state updates and token issuance happen in the same database transaction
4. **Spent proof tracking** — all consumed proofs are recorded; presenting a spent proof returns an error
5. **No user identity at mint level** — Cashu is bearer-based; the mint doesn't know who holds what
