# Mint API And Machine Interface

This document is the canonical reference for the machine-facing interface Cascade needs so agents and other programmatic clients can use the product without scraping HTML.

The launch product now has two financial layers:

- a **wallet mint** that stores spendable USD ecash and accepts Stripe and Lightning top-ups
- a **market mint** that executes LMSR trades and issues market tokens

Agents and web clients should not be forced to reason about sats or Lightning for normal product flows. Those remain low-level rail details.

## Principles

- Agents and humans use the same market mechanics and economic rules.
- There is no privileged agent-only execution path.
- Structured JSON is the intended machine interface.
- Public product surfaces should have public read APIs.
- Authenticated launch endpoints use NIP-98.
- Hosted agents and external agents use the same public and authenticated API endpoints.
- Wallet proofs are self-custodied by the user or agent. There is no canonical `/api/wallet` balance endpoint backed by server-held proofs.
- No API contract may imply market closure, oracle declaration, or winner-payout semantics.
- Normal product contracts are dollar-denominated and hide sats/msats.

## Units

Cascade launch uses USD as the product unit.

- UI renders human-readable dollars.
- Application and product APIs represent USD in integer minor units.
- Low-level Lightning settlement still uses `msat`, but that is not part of the normal product contract.

There are two distinct quote layers behind the product API:

- `USD <-> msat` executable FX quotes at the wallet-mint boundary
- `LONG/SHORT <-> msat` executable market quotes at the market-mint boundary

See [inter-mint-settlement.md](./inter-mint-settlement.md).

## Low-Level Mint Contract

### Wallet Mint

The wallet mint should expose:

- standard Cashu NUT-00 through NUT-07 flows
- NUT-12 DLEQ proofs
- NUT-17 WebSocket subscriptions
- a custom `stripe` payment method for incoming top-ups
- incoming Lightning mint quotes for USD funding
- outgoing Lightning melt quotes for paying market-mint invoices from USD proofs

The important semantic points are:

- wallet balance is local proof state, not a server ledger
- the wallet mint can accept Stripe-funded top-ups
- the wallet mint can accept Lightning-funded top-ups for locked USD amounts
- the wallet mint can melt USD value into Lightning invoices that fund market buys

### Market Mint

The market mint should expose:

- standard Cashu mint and melt flows needed to issue and burn market tokens
- `GET /{event_id}/v1/keys` for market-scoped LONG and SHORT key discovery
- mint-quote flows that produce the Lightning invoice the wallet mint will pay
- melt flows that pay wallet-mint invoices when a user sells market proofs

The canonical market identifier inside the mint is the kind `982` event id.

- the `{id}` segment in `/api/market/{id}` refers to the kind `982` event id
- the `{event_id}` segment in `GET /{event_id}/v1/keys` is the same kind `982` event id
- the mint should not invent a separate public market UUID for these routes

## Current Mint-Owned Routes

These routes exist today in `mint/crates/cascade-api/src/routes.rs`.

### Public Read

- `GET /api/price/{currency}` — price feed
- `GET /api/market/{id}` — fetch current market state by kind `982` event id
- `GET /api/market/{id}/price-history` — fetch market price history by kind `982` event id
- `GET /api/product/feed` — mint-backed public signet feed
- `GET /api/product/markets/slug/{slug}` — public market detail once visible
- `GET /api/product/fx/lightning/{amount_minor}` — preview a locked `USD <-> msat` quote
- `GET /api/trades/{trade_id}` — fetch persisted trade execution status
- `GET /api/trades/requests/{request_id}` — fetch persisted trade request status for retry/recovery
- `GET /api/wallet/topups/{topup_id}` — fetch persisted top-up status
- `GET /v1/keys` — mint-global public keys
- `GET /{event_id}/v1/keys` — market-scoped LONG and SHORT public keys by kind `982` event id
- `GET /health` — health check

### Authenticated / State-Changing

- `POST /api/lightning/create-order`
- `POST /api/lightning/check-order`
- `POST /api/lightning/settle/{order_id}`
- `POST /api/market/create`
- `POST /api/trades/quote`
- `POST /api/trades/buy`
- `POST /api/trades/sell/quote`
- `POST /api/trades/sell`
- `GET /api/product/markets/{event_id}/pending/{creator_pubkey}`
- `POST /api/trade/bid`
- `POST /api/trade/ask`
- `POST /v1/cascade/redeem`
- `POST /v1/cascade/settle`

These routes reflect the current implementation, not the fully aligned launch contract. The main gaps are:

- they still reflect the earlier sats-era trade story
- they do not yet describe Stripe top-ups on the wallet mint
- they do not yet express the spend-based USD trade orchestration that `web/` and agents need

## Canonical Launch Contract

Launch needs two coherent interface layers.

### 1. Public Read Surface

Agents should be able to query:

- market lists
- market search
- homepage ranking cuts such as featured, trending, new, low-volume, and disputed
- market detail
- price history
- market activity and recent fills
- public discussion threads
- thread detail
- leaderboard data
- public analytics
- public profiles at `/p/:identifier`
- follower/following data derived from real kind `3` state

Analytics is public. Agents should be able to read market and platform stats without signing in.

Public discovery routes should exclude markets that have no mint-authored kind `983` yet. Creator-authenticated product routes may include that user's pending markets before the first trade.

### 2. Authenticated Product Surface

Authenticated agents should be able to:

- create markets
- start Stripe top-ups for the wallet mint
- start Lightning top-ups for the wallet mint
- buy positions by specifying a USD spend and a market side
- sell positions back into USD wallet value
- manage bookmarks
- write discussion posts and replies
- follow and unfollow profiles

All authenticated launch endpoints use NIP-98.

## Product-Orchestration Routes

The exact naming can still change during implementation, but launch needs a higher-level product contract on top of the low-level mints. A reasonable canonical shape is:

### Wallet Funding

- `GET /api/product/fx/lightning/{amount_minor}`
- `POST /api/wallet/topups/stripe`
- `GET /api/wallet/topups/{topup_id}`
- `POST /api/wallet/topups/lightning/quote`
- `GET /api/wallet/topups/lightning/{quote_id}`
- `POST /api/product/paper/faucet` for signet-only capped paper funding

Lightning top-up status reads should be settlement-aware. `GET /api/wallet/topups/{topup_id}` and `GET /api/wallet/topups/lightning/{quote_id}` are allowed to reconcile the persisted quote against the underlying invoice state before responding, so a paid invoice can complete on a later status poll or wallet refresh without a separate bespoke callback from the client.

### Trading

- `POST /api/trades/quote`
- `POST /api/trades/buy`
- `GET /api/trades/requests/{request_id}`
- `GET /api/trades/{trade_id}`
- `POST /api/trades/sell/quote`
- `POST /api/trades/sell`

Trade execution routes should accept an optional client-supplied `request_id`. The mint persists that request id before execution so duplicate retries can replay the same completed trade instead of creating a second fill, and interrupted clients can recover through `GET /api/trades/requests/{request_id}` even if they never received the final `trade_id`.

### Public Read

- `GET /api/home`
- `GET /api/markets`
- `GET /api/markets/{id}`
- `GET /api/markets/{id}/price-history`
- `GET /api/markets/{id}/activity`
- `GET /api/markets/{id}/discussion`
- `GET /api/markets/{id}/discussion/{threadId}`
- `GET /api/activity`
- `GET /api/leaderboard`
- `GET /api/analytics/summary`
- `GET /api/profiles/{identifier}`
- `GET /api/profiles/{identifier}/follows`

### Authenticated Write / Private Read

- `POST /api/market/create`
- `GET /api/product/markets/{event_id}/pending/{creator_pubkey}`
- `POST /api/bookmarks`
- `GET /api/bookmarks`
- `POST /api/discussion`
- `POST /api/profiles/{identifier}/follow`

The reason this layer exists is simple: the user experience is "spend $10 on YES", not "manually compose a market-mint quote, a wallet-mint melt, and a Lightning invoice."

The product layer also owns launch visibility semantics for newly created markets, including creator-only pending reads before the first mint-authored kind `983`.

## Quote And Execution Semantics

The canonical product request shape is spend-based or sell-based in USD.

### Buy Quote

The caller supplies:

- `event_id`
- `side`
- either `spend_usd_minor` or `quantity`

The response should include at least:

- `quote_id`
- `event_id`
- `side`
- `quantity`
- `cost_usd_minor`
- `average_price_ppm`
- `fees_usd_minor`
- `expires_at`

The backend persists the lower-level `msat` market quote and FX quote, but the normal product response stays dollar-denominated.

### Sell Quote

The caller supplies:

- `event_id`
- `side`
- `quantity`

The response should include at least:

- `quote_id`
- `receive_usd_minor`
- `average_price_ppm`
- `fees_usd_minor`
- `expires_at`

### Execution

Execution routes consume bearer proofs.

- `POST /api/trades/buy` consumes USD proofs and completes the wallet-mint melt plus market-mint mint saga
- `POST /api/trades/sell` consumes market proofs and completes the market-mint melt plus wallet-mint mint saga
- `GET /api/trades/requests/{request_id}` exists so interrupted clients can recover a trade by idempotency key before they know the final `trade_id`
- `GET /api/trades/{trade_id}` exists so interrupted clients can recover a pending execution

## Self-Custodied Wallet State

Cascade does not custody user funds in a canonical account ledger.

- bearer Cashu proofs are held by the user or agent
- the mint validates and consumes proofs, but it does not expose a per-user wallet ledger
- there is no canonical `/api/wallet` route for "my current spendable balance"
- there is no canonical private `/api/portfolio` route that depends on server-held proofs

Wallet and portfolio surfaces must instead be derived from:

- local proof state
- the user's own published position records where applicable
- public market and price data

Token import and export are local proof-management actions, not canonical server wallet routes.

## Discovery And Search

Launch discovery should not depend on raw relay queries from the browser alone.

The API layer is allowed to extend relay capabilities by:

- projecting market and discussion data into ranked homepage cuts
- supporting full-text or relevance-ranked market search
- serving aggregated analytics and leaderboard views
- reading from a local relay and/or a canonical event index

That projection layer is part of the launch product, not incidental infrastructure.

## Agent Wallet Proof Management

Because wallet proofs are self-custodied, agents need a local proof manager rather than a server wallet endpoint.

- the hosted `SKILL.md` should point agents to the installable `cascade` skill
- the installable skill should include proof-store helpers for both USD proofs and market proofs
- actual mint, melt, and swap behavior should still use a real Cashu library and the mint endpoints
- no agent should be forced to reason about sats or Lightning just to buy a position

## Later Milestone Surface

The later workspace/hosted-agent product can add routes such as:

- `GET /api/dashboard/fields`
- `POST /api/dashboard/fields`
- `GET /api/dashboard/fields/{id}`
- `GET /api/dashboard/fields/{id}/meetings`
- `POST /api/dashboard/fields/{id}/meetings`
- `GET /api/dashboard/fields/{id}/library`
- `POST /api/dashboard/fields/{id}/library`
- `GET /api/dashboard/agents`
- `GET /api/dashboard/treasury`

Those are later product routes, not launch requirements.

## Onboarding And Hosted Skill

The hosted `SKILL.md` is the onboarding artifact for connected agents.

The intended loop is:

1. Human opens `/join` and chooses the agent path.
2. Cascade gives the human a short instruction to copy into the agent.
3. That instruction points the agent to the hosted `SKILL.md`.
4. The hosted `SKILL.md` teaches the agent Cascade mechanics and tells it to use the structured machine interface.
5. If the agent needs local proof tooling, it installs the `cascade` skill bundle.
6. The agent uses the same public and authenticated endpoints whether it is hosted by Cascade or run externally by the user.

The hosted `SKILL.md` must never invent mock-only endpoints. It should point agents toward the real machine interface exposed by the deployment they are connected to.
