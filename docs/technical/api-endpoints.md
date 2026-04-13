# API Endpoints Inventory

This document is the single source of truth for all HTTP endpoints exposed by Cascade.

It reflects the current state of the codebase **plus** the architectural directives from Pablo (April 2026). Endpoints marked **[REMOVE]** exist in the codebase but must be deleted as part of the ongoing cleanup; they do not belong in the canonical API surface.

See [`../mint/api.md`](../mint/api.md) for the rationale and design contract behind each endpoint group.

---

## Mint API Endpoints

The Cascade mint (`mint/`) exposes two classes of route: CDK standard Cashu NUT routes (from `cdk-axum`) and Cascade-specific product routes (from `cascade-api/src/routes.rs`).

### CDK Standard Routes (NUT)

These are the canonical Cashu protocol endpoints registered by `cdk_axum::create_mint_router`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/info` | Mint info — name, description, supported NUTs (NUT-06) |
| `GET` | `/v1/keys` | Active wallet keysets and public keys |
| `GET` | `/v1/keysets` | All keysets (active and inactive) |
| `GET` | `/v1/keys/{keyset_id}` | Public keys for a specific keyset |
| `POST` | `/v1/swap` | Token swap — split, merge, or reissue proofs (NUT-03) |
| `POST` | `/v1/checkstate` | Check whether proofs are unspent, spent, or pending (NUT-07) |
| `POST` | `/v1/restore` | Deterministic proof restoration from blinded output seed (NUT-09) |
| `GET` | `/v1/ws` | WebSocket subscription for quote-state updates (NUT-17) |

### CDK Standard BOLT11 Payment Routes

Registered by CDK for the `bolt11` payment method.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/mint/quote/bolt11` | Create a Lightning (BOLT11) mint quote for USD funding |
| `GET` | `/v1/mint/quote/bolt11/{quote_id}` | Get status of a BOLT11 mint quote |
| `POST` | `/v1/mint/bolt11` | Issue proofs after a BOLT11 quote is paid |
| `POST` | `/v1/melt/quote/bolt11` | Create a BOLT11 melt quote (outgoing Lightning payment) |
| `GET` | `/v1/melt/quote/bolt11/{quote_id}` | Get status of a BOLT11 melt quote |
| `POST` | `/v1/melt/bolt11` | Execute a BOLT11 melt (pay Lightning invoice from proofs) |

### CDK Auth Routes

Blind auth endpoints registered by CDK (NUT-21 / blind auth).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/auth/keys` | Blind auth keyset public keys |
| `GET` | `/v1/auth/keysets` | All blind auth keysets |
| `GET` | `/v1/auth/keys/{keyset_id}` | Blind auth keys for a specific keyset |
| `POST` | `/v1/auth/mint` | Mint blind auth tokens |

### Cascade Custom Mint Routes

These are Cascade-specific routes defined in `cascade-api/src/routes.rs`.

#### Cashu Wallet Custom Methods

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/mint/quote/bolt11` | Create BOLT11 mint quote (Cascade-wrapped, overrides CDK) |
| `GET` | `/v1/mint/quote/bolt11/{quote_id}` | Get BOLT11 mint quote status (Cascade-wrapped) |
| `GET` | `/v1/mint/quote/wallet/{quote_id}` | Get wallet-method mint quote status |
| `GET` | `/v1/mint/quote/stripe/{quote_id}` | Get Stripe-method mint quote status |
| `POST` | `/v1/mint/bolt11` | Issue proofs from BOLT11 quote (Cascade-wrapped) |
| `POST` | `/v1/mint/wallet` | Issue proofs from wallet-method quote |
| `POST` | `/v1/mint/stripe` | Issue proofs from Stripe-method quote |

#### Market Key Discovery

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/{event_id}/v1/keys` | LONG and SHORT keysets for a market, scoped by kind `982` event ID |

#### Price and FX

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/price/{currency}` | Current price feed for a currency |
| `GET` | `/api/product/fx/lightning/{amount_minor}` | Preview a locked `USD <-> msat` FX quote without creating a payment object |

#### Market State

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/market/{id}` | Fetch current LMSR market state by kind `982` event ID |
| `GET` | `/api/market/{id}/price-history` | Fetch price history for a market by kind `982` event ID |
| `POST` | `/api/market/create` | ⚠️ Legacy migration debt — coordinate around an already-signed kind `982`; does not register the market; LMSR pools are lazy-initialized on first trade |

#### Trade Execution

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/trades/quote` | Get a buy quote (USD spend → LONG/SHORT quantity) |
| `GET` | `/api/trades/quotes/{quote_id}` | Get status of a persisted trade quote (open/expired/executed) |
| `POST` | `/api/trades/buy` | Execute a buy trade using locked quote and USD proofs |
| `POST` | `/api/trades/sell/quote` | Get a sell quote (LONG/SHORT quantity → USD proceeds) |
| `POST` | `/api/trades/sell` | Execute a sell trade using locked quote and market proofs |
| `GET` | `/api/trades/requests/{request_id}` | Recover a trade by idempotency key before `trade_id` is known |
| `GET` | `/api/trades/{trade_id}` | Get the status and settlement details of an executed trade |

#### Portfolio Funding

Client browsers and agents call these endpoints **directly on the mint** — the webapp has no proxy routes for funding.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/portfolio/funding/stripe` | Create a Stripe Checkout session for USD wallet funding |
| `POST` | `/api/portfolio/funding/stripe/webhook` | Stripe webhook — authoritative completion signal for card funding |
| `GET` | `/api/portfolio/funding/requests/{request_id}` | Recover a funding request by idempotency key |
| `GET` | `/api/portfolio/funding/{quote_id}` | Get status of a persisted Stripe funding record |

#### Portfolio Funding — USDC (later milestone)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/portfolio/funding/usdc/deposit-intents` | Create a USDC deposit intent |
| `GET` | `/api/portfolio/funding/usdc/deposit-intents/{intent_id}` | Get status of a USDC deposit intent |
| `POST` | `/api/portfolio/withdrawals/usdc` | Create a USDC withdrawal (disabled by default) |
| `GET` | `/api/portfolio/withdrawals/usdc/requests/{request_id}` | Get withdrawal by idempotency key |
| `GET` | `/api/portfolio/withdrawals/usdc/{withdrawal_id}` | Get status of a USDC withdrawal |

#### Product Activity

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/product/activity` | Network-wide activity feed |
| `GET` | `/api/product/markets/search` | Search markets by keyword or filter |

#### Portfolio Funding Routes

`/api/portfolio/funding/*` is the only route family for portfolio funding status and Stripe orchestration. There are no `/api/wallet/topups/*` aliases.

#### Infrastructure

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check — returns `200 OK` |

---

### Endpoints Removed by Pablo's Architectural Directive (April 2026)

These routes exist in `routes.rs` but **must be deleted**. They are not part of the canonical API surface.

| Method | Path | Reason |
|--------|------|--------|
| `GET` | `/api/product/runtime` | Removed — no runtime config HTTP endpoint; configuration is build-time or Nostr-native |
| `GET` | `/api/product/feed` | Removed — Nostr events must come from relays, not HTTP endpoints |
| `GET` | `/api/product/markets/slug/{slug}` | Removed — market data from relays; slug resolution is a webapp/relay concern |
| `POST` | `/api/product/markets` | Removed — no market registration step; LMSR pools lazy-initialize on first trade |
| `GET` | `/api/product/markets/{event_id}/pending/{creator_pubkey}` | Removed — no pending-state endpoint; visibility gate is kind `983` existence only |

---

## Webapp API Endpoints

The Cascade webapp (`web/`) is a SvelteKit application. It exposes a small set of server-side API routes for identity, social auth, and NIP-05 management. It does **not** proxy mint funding, trading, or Nostr event endpoints.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/.well-known/nostr.json` | NIP-05 public key resolution (managed NIP-05 domain) |
| `GET` | `/api/nip05` | Query NIP-05 records managed by this deployment |
| `POST` | `/api/nip05` | Register or update a NIP-05 identifier for the authenticated user |
| `DELETE` | `/api/nip05` | Remove a NIP-05 identifier for the authenticated user |
| `GET` | `/api/social-auth/google/start` | Initiate Google OAuth flow for profile bootstrap |
| `GET` | `/api/social-auth/google/callback` | Handle Google OAuth callback and import profile data |
| `GET` | `/api/social-auth/x/start` | Initiate X (Twitter) OAuth flow for profile bootstrap |
| `GET` | `/api/social-auth/x/callback` | Handle X OAuth callback and import profile data |
| `GET` | `/api/social-auth/telegram/start` | Initiate Telegram OAuth flow for profile bootstrap |
| `GET` | `/api/social-auth/telegram/callback` | Handle Telegram OAuth callback and import profile data |
| `GET` | `/og/note/[id]` | Generate Open Graph image for a note/discussion post |
| `GET` | `/api/debug/front-page-cache` | Debug: inspect front-page cache state (non-production) |

---

## Key Architectural Rules

1. **Nostr events via relays only.** The mint never serves raw kind `982` or kind `983` data over HTTP. Clients fetch market definitions from relays and subscribe to relays for trade history.

2. **Lazy LMSR initialization.** There is no market registration endpoint. The mint initializes the LMSR pool on the first trade for any market, by fetching the kind `982` event from relays.

3. **Direct client-to-mint funding.** The webapp has no proxy routes for Stripe, Lightning, or USDC funding. The browser or agent calls the mint directly.

4. **No runtime config endpoint.** `GET /api/product/runtime` is removed. Client configuration is build-time or Nostr-native.

5. **Kind `9802` is not a Cascade feature.** It must never appear in any endpoint, spec, or plan document.
