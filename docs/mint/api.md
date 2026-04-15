# Mint API

This document is the canonical machine-interface reference for the active mint and product routes exposed by `mint/`.

It reflects the route surface currently wired in [`mint/crates/cascade-api/src/routes.rs`](../../mint/crates/cascade-api/src/routes.rs) plus the architectural cleanup direction already decided in the product docs.

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

### Market Read Routes

- `GET /api/market/{id}`
- `GET /api/market/{id}/price-history`
- `GET /api/product/activity`
- `GET /api/product/markets/search`
- `GET /api/product/fx/lightning/{amount_minor}`

### Funding Routes

Stripe funding:

- `POST /api/portfolio/funding/stripe`
- `POST /api/portfolio/funding/stripe/webhook`
- `GET /api/portfolio/funding/requests/{request_id}`
- `GET /api/portfolio/funding/{quote_id}`

Mint-quote status helpers currently exposed:

- `GET /v1/mint/quote/wallet/{quote_id}`
- `GET /v1/mint/quote/stripe/{quote_id}`
- `POST /v1/mint/wallet`
- `POST /v1/mint/stripe`

USDC later-rail routes currently present:

- `POST /api/portfolio/funding/usdc/deposit-intents`
- `GET /api/portfolio/funding/usdc/deposit-intents/{intent_id}`
- `POST /api/portfolio/withdrawals/usdc`
- `GET /api/portfolio/withdrawals/usdc/requests/{request_id}`
- `GET /api/portfolio/withdrawals/usdc/{withdrawal_id}`

### Health

- `GET /health`

## Current Route Debt

These routes are still in `routes.rs` but do not belong in the long-term canonical contract:

- `GET /api/product/feed`
- `GET /api/product/runtime`
- `GET /api/product/markets/slug/{slug}`
- `GET /api/product/markets/{event_id}/pending/{creator_pubkey}`
- `POST /api/product/markets`
- `POST /api/market/create`

Reason:

- market definitions belong on relays, not behind a registry API
- public discovery should key off real market events plus the first kind `983`
- runtime configuration should be build-time or deployment config, not an HTTP manifest

## Interface Rules

- clients fetch Nostr events from relays, not from the mint over HTTP
- portfolio funding is direct client-to-mint, not proxied through `web/`
- pure Lightning portfolio funding should stay on the standard Cashu mint-quote path
- humans and agents use the same authenticated and public routes
- proof custody stays local; status routes do not replace self-custody
