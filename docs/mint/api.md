# Mint API

This document is the canonical machine-interface reference for the mint routes exposed by `mint/`.

The mint handles funding, trading, and proof lifecycle. It does NOT handle market discovery, search, activity feeds, or price history — those are relay concerns.

## Route Families

### Standard Cashu Routes

Provided by CDK:

- `GET /v1/info`
- `GET /v1/keys`
- `GET /v1/keysets`
- `GET /v1/keys/{keyset_id}`
- `POST /v1/swap`
- `POST /v1/checkstate`
- `POST /v1/restore`
- `GET /v1/ws`

Standard BOLT11 flows:

- `POST /v1/mint/quote/bolt11`
- `GET /v1/mint/quote/bolt11/{quote_id}`
- `POST /v1/mint/bolt11`
- `POST /v1/melt/quote/bolt11`
- `GET /v1/melt/quote/bolt11/{quote_id}`
- `POST /v1/melt/bolt11`

Blind auth routes:

- `GET /v1/auth/keys`
- `GET /v1/auth/keysets`
- `GET /v1/auth/keys/{keyset_id}`
- `POST /v1/auth/mint`

### Market-Scoped Key Discovery

- `GET /{event_id}/v1/keys`

This is the market-scoped key discovery surface keyed by the kind `982` event id.

### Product Trading Routes

- `POST /api/trades/quote`
- `GET /api/trades/quotes/{quote_id}`
- `POST /api/trades/buy`
- `POST /api/trades/sell/quote`
- `POST /api/trades/sell`
- `GET /api/trades/requests/{request_id}`
- `GET /api/trades/{trade_id}`

These are the main product routes used by web and agents for spend-based trading in USD terms.

### Stripe Funding Routes

Stripe is a funding rail. Funding rails are mint concern. The mint holds the Stripe secret key, creates checkout sessions, and receives webhooks directly. There is no webapp backend in this path.

- `POST /v1/fund/stripe` — create a Stripe checkout session (browser calls this on the mint)
- `POST /v1/fund/stripe/webhook` — Stripe sends webhook here (mint receives it directly)
- `GET /v1/fund/stripe/{funding_id}` — browser polls funding status
- `POST /v1/mint/stripe` — browser mints proofs after funding completes

### Lightning Funding Routes

Standard Cashu mint-quote flow — browser talks to mint directly:

- `POST /v1/mint/quote/bolt11` — create invoice
- `GET /v1/mint/quote/bolt11/{quote_id}` — poll invoice status
- `POST /v1/mint/bolt11` — mint proofs after invoice paid

### USDC Later-Rail Routes

Present in codebase, not yet active:

- `POST /api/portfolio/funding/usdc/deposit-intents`
- `GET /api/portfolio/funding/usdc/deposit-intents/{intent_id}`
- `POST /api/portfolio/withdrawals/usdc`
- `GET /api/portfolio/withdrawals/usdc/requests/{request_id}`
- `GET /api/portfolio/withdrawals/usdc/{withdrawal_id}`

### Utility

- `GET /api/product/fx/lightning/{amount_minor}` — FX preview
- `GET /health`

## Routes That Must Be Removed

These routes exist in `routes.rs` but must be deleted. They serve relay data through the mint, which is architecturally wrong:

**Market read routes (relay concern, not mint concern):**

- `GET /api/market/{id}` — market state belongs on relays (kind `982`)
- `GET /api/market/{id}/price-history` — derived from kind `983` on relays
- `GET /api/product/activity` — derived from kind `983` on relays
- `GET /api/product/markets/search` — relay query or frontend-side search
- `GET /api/product/feed` — relay subscription
- `GET /api/product/runtime` — build-time or deployment config, not an HTTP manifest

**Market creation routes (relay concern):**

- `GET /api/product/markets/slug/{slug}` — slug lookup is a relay query
- `GET /api/product/markets/{event_id}/pending/{creator_pubkey}` — no pending-state endpoint needed
- `POST /api/product/markets` — market creation publishes kind `982` to relays
- `POST /api/market/create` — duplicate of above

**Stripe routes at wrong path (moved to mint `/v1/fund/stripe`):**

- `POST /api/portfolio/funding/stripe` — replaced by `POST /v1/fund/stripe`
- `POST /api/portfolio/funding/stripe/webhook` — replaced by `POST /v1/fund/stripe/webhook`
- `GET /api/portfolio/funding/requests/{request_id}` — replaced by `GET /v1/fund/stripe/{funding_id}`
- `GET /api/portfolio/funding/{quote_id}` — replaced by `GET /v1/fund/stripe/{funding_id}`

### SQLite Market Mirror Tables To Remove

The mint database currently mirrors relay data in tables like `market_launch_state`. This mirror must be removed. The mint database stores only execution state:

- LMSR parameters per market (`qLong`, `qShort`, `b`, `reserve`)
- Keyset-to-market mappings
- Spent-proof tracking
- Trade execution records (source of kind `983` publishing)
- Wallet funding state (Stripe sessions, Lightning quotes, USDC intents)
- FX quote snapshots
- Settlement state
- Risk/anti-abuse state

It does NOT store market titles, descriptions, slugs (beyond keyset mapping), visibility state, volume projections, search indexes, or any data that exists for serving to clients. The mint publishes kind `983` to relays after trade execution — it does not serve trade history back through HTTP.

## Interface Rules

- clients fetch Nostr events (market definitions, trade history) from relays, not from the mint
- all funding rails (Stripe, Lightning, later USDC) are direct client-to-mint — no webapp backend intermediary
- pure Lightning portfolio funding stays on the standard Cashu mint-quote path
- humans and agents use the same authenticated and public routes
- proof custody stays local; status routes do not replace self-custody
