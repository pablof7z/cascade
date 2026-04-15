# USD Stablemint, Stripe, And Lightning Implementation Plan

This document is the canonical implementation roadmap for the Cascade financial layer after locking the launch architecture.

It covers the mint layer, the FX layer, the Stripe and Lightning wallet-funding rails, and the end-to-end web integration needed so a user can:

1. add funds in dollars through Stripe
2. add funds in dollars through a Lightning funding flow
3. spend dollars on a market position
4. sell the position back into dollar wallet value

Related docs:

- [end-to-end-launch-implementation.md](./end-to-end-launch-implementation.md)
- [usdc-wallet-rail-addendum.md](./usdc-wallet-rail-addendum.md)
- [../mint/inter-mint-settlement.md](../mint/inter-mint-settlement.md)

## Locked Decisions

- The user-facing base unit is USD.
- Application and product APIs represent USD in integer minor units.
- Wallet funding rails for launch are Stripe and Lightning.
- Market execution remains LMSR-based.
- The market mint settles across Lightning in `msat`.
- The wallet mint prices `USD <-> msat` at the payment boundary.
- The market mint prices `LONG/SHORT <-> msat` internally from LMSR.
- Market key discovery is `GET /{event_id}/v1/keys`.
- The normal UI should not expose sats, msats, or Lightning invoice mechanics during trading.
- We are not introducing a bespoke public cross-unit swap primitive for launch.
- A market is not publicly visible until it has at least one mint-authored kind `983`.
- Signet and mainnet run as separate editions with separate funds, proofs, and infrastructure.
- Stripe is a funding rail. Funding rails are mint concern. The mint holds the Stripe secret key, creates checkout sessions, and receives webhooks. No webapp backend involvement in funding flows.
- The mint does not maintain a mirror of relay data. Market discovery, search, activity, and price history are relay concerns — the frontend queries relays directly. The mint database stores only execution state.

## Target System

Cascade has four cooperating layers:

### 1. Wallet Mint

- issues USD ecash
- accepts Stripe funding
- accepts Lightning-funded mint quotes
- stores the user's liquid wallet balance as bearer proofs
- pays market-mint invoices by consuming USD proofs

### 2. Market Mint

- maintains LMSR state
- issues LONG and SHORT proofs
- burns market proofs on exits
- computes executable market quotes in `msat`
- publishes kind `983`

### 3. FX Quote Layer

- quotes `USD <-> msat`
- locks executable rates with expiry
- combines multiple major provider feeds behind one modular quote-source interface
- is used by the wallet mint for Lightning funding and Lightning melts

### 4. Product Coordinator

- offers spend-based and sell-based APIs in USD
- composes FX quotes with market quotes
- hides inter-mint settlement complexity from `web/` and agents
- persists trade and funding state needed for UX and recovery

### 5. Edition Split

- signet edition supports paper trading
- mainnet edition supports real-money flows
- proofs, relay projections, mint identities, and funding rails stay separated by edition

## Workstream 1: Make Market Settlement Semantics Explicit

Refactor `cascade-core` and mint state so the market side is explicitly modeled as a Lightning-settlement execution engine rather than a generic dollar-clearing engine.

- rename sat-specific fields like `reserve_sats`, `cost_sats`, and `fee_sats` to explicit settlement-unit fields
- target `msat` precision for executable quote interfaces
- update serialization, DB schema, tests, and docs together
- keep probabilities and `price` ppm semantics unchanged

Definition of done:

- market state uses explicit settlement-unit naming
- buy and sell quote math returns settlement amounts with consistent precision
- docs and tests no longer imply internal USD clearing on the market side

## Workstream 2: FX Quote Service

Implement the `USD <-> msat` quote layer used by the wallet mint.

- add a quote source abstraction for external FX data
- add multiple provider adapters and a documented combination policy
- persist executable quote snapshots with expiry, spread, and source metadata
- use the same quote layer for Lightning funding and Lightning melts
- expose internal diagnostics needed for recovery and auditability

Definition of done:

- wallet mint can lock a Lightning funding quote for a USD amount
- wallet mint can lock a melt quote for a market-mint invoice in USD
- expired or stale FX quotes are rejected safely

## Workstream 3: Wallet Mint Funding Rails

Implement the USD wallet mint with both launch funding paths. All funding rails live on the mint — the mint holds keys, creates sessions, receives webhooks. No webapp backend involvement.

- add wallet-mint configuration for USD operation
- implement Stripe funding directly on the mint: `POST /v1/fund/stripe` creates a checkout session, `POST /v1/fund/stripe/webhook` receives Stripe events, `GET /v1/fund/stripe/{funding_id}` returns status, `POST /v1/mint/stripe` issues proofs
- the mint holds the Stripe secret key — it is never exposed to or proxied through a webapp backend
- add incoming Lightning mint-quote support for USD-denominated funding on the standard Cashu NUT-23 BOLT11 endpoints
- map Stripe and Lightning payment completion to mint quote completion
- let the browser mint and recover USD proofs locally after successful Lightning funding
- issue USD proofs only after verified Stripe completion and risk acceptance
- add risk controls for reversible card payments
- gate proof issuance on Stripe risk signals and conservative volume caps
- keep one persisted funding saga model across Stripe and Lightning, with rail-specific metadata instead of rail-specific custody paths

Definition of done:

- user can start Stripe funding by calling `POST /v1/fund/stripe` on the mint directly
- Stripe webhook hits the mint directly at `POST /v1/fund/stripe/webhook` and marks the payment complete
- user can start Lightning funding for a locked USD amount through `POST /v1/mint/quote/bolt11`
- Lightning payment marks the mint quote `PAID`
- the browser can call `POST /v1/mint/bolt11` and recover the issued proofs locally after interruption
- Stripe retains the persisted request/status saga because card checkout is not a standard Cashu mint flow
- there are no `/api/portfolio/funding/stripe` routes — Stripe lives at `/v1/fund/stripe` on the mint

## Workstream 4: Market Mint Quote And Payment Processors

Implement the market-mint side of inter-mint settlement.

- create invoice-backed mint quotes for LONG and SHORT issuance
- compute exact `msat` settlement amounts from LMSR for a requested trade size
- translate paid incoming settlement into market-proof issuance
- support the reverse path for selling market proofs back into wallet value
- keep public market key discovery market-scoped by event id

Definition of done:

- market mint can issue LONG/SHORT after Lightning payment confirmation
- market mint can burn LONG/SHORT and pay a wallet-mint invoice on exit
- market quotes are persisted and recoverable

## Workstream 5: Product Trade Coordinator

Build the spend-based USD trade surface on top of the low-level quotes.

- quote "spend `$X` on YES/NO"
- solve quantity and fill preview from current LMSR state plus current FX quote
- coordinate wallet-mint payment and market-mint issuance
- coordinate exit melts and wallet reminting
- provide recovery and status endpoints for interrupted client flows
- keep authenticated actions on NIP-98

Definition of done:

- `web/` and agents can buy without manually composing low-level mint operations
- `web/` and agents can sell without manually composing low-level mint operations
- normal product flows never expose Lightning details during trading

## Workstream 6: Wallet And Trading UX In `web/`

Wire the active frontend to the new financial layer.

- show portfolio balance in USD
- launch Stripe funding from `/portfolio`
- launch Lightning funding from `/portfolio` for a chosen USD amount
- store USD proofs and market proofs locally
- show trade inputs in USD on market pages
- show portfolio and PnL in USD
- keep token import/export local

Definition of done:

- a signed-in user can add funds, buy a position, and see the resulting portfolio and position state in the active `web/` app

## Workstream 7: Position, Event, And Analytics Consistency

Align all state projections and public surfaces with the final launch unit model.

- update position records and portfolio math to remain USD-denominated at the product layer
- define how kind `983` normalizes product-facing notional values versus low-level settlement values
- update analytics and leaderboard pipelines to use the final launch notional model
- update machine-interface docs and hosted `SKILL.md`

## Workstream 8: Deployment And Operations

Make the new system production-safe.

- deploy the mint layer under process supervision
- keep TLS termination stable via Caddy
- persist mint, quote, FX, and funding state
- configure Stripe webhooks
- add smoke checks for Stripe funding, Lightning funding, buy, and sell flows
- add smoke checks for public market visibility after first kind `983`
- run separate signet and mainnet deployments with separate config, data, and operator identities

## Launch Definition

This work is complete when a human user can:

1. visit `cascade.f7z.io`
2. create or restore an identity
3. add funds in dollars through Stripe or Lightning
4. spend dollars on a market position without seeing sats or Lightning settlement details
5. sell that position back into dollar wallet value
6. see portfolio balance, position state, and PnL update coherently across portfolio, market, and activity surfaces

## Explicit Non-Goals For Launch

- bank payout or fiat cash-out
- more funding rails beyond Stripe and Lightning
- USDC wallet funding as a launch requirement
- exposing Lightning invoice mechanics in the normal trading UI
- a server-custodied `/api/wallet` balance model
- a bespoke public cross-unit swap protocol
- market closure, oracle, or settlement mechanics

USDC is defined separately in [usdc-wallet-rail-addendum.md](./usdc-wallet-rail-addendum.md) as an additive later rail.

## Progress Notes

### 2026-04-13

- Workstream 2 now has a concrete `QuoteSource` trait with Coinbase, Kraken, and Bitstamp adapters feeding one shared `USD <-> msat` FX service for Lightning funding and Lightning melts.
- The combination policy is now implemented and test-covered: stale observations are rejected, a minimum fresh-provider count is enforced, the median fresh BTC/USD rate becomes the reference quote, excessive provider spread is rejected, and a directional execution spread is applied before quote lock.
- Persisted FX snapshots now carry expiry, executable and reference BTC/USD rates, provider observations, and source metadata so quote provenance is durable across recovery, audit, funding, and melt flows.
- Locked quote reuse now rejects expired snapshots instead of accepting stale execution prices.
- Scope note: `mint/migrations/017_fx_quote_source_metadata.sql` is the schema change mechanism for FX quote source metadata.
- Workstream 4 now has a shared post-payment recovery model across Lightning and Stripe: persisted funding reads reconcile mirrored CDK mint-quote state, Lightning funding status now moves to `complete` after standard quote issuance, and verified Stripe webhooks now leave the funding in redeemable `PAID` state until the browser mints proofs through `/v1/mint/stripe`.
- Stripe funding creation now mirrors each funding id into mint localstore immediately so webhook completion, later minting, and interrupted client recovery all reference one durable quote id instead of a Stripe-only saga row.

### 2026-04-13 Review Addendum

- Workstream 2 is not complete unless signet and mainnet both require the live multi-provider quote path.
- Workstream 3 was temporarily treated as incomplete while signet Lightning funding auto-settled invoices inside the backend. Superseded by the 2026-04-15 clarification that signet wallet-funding quotes should auto-pay testnut-style while staying on the standard quote and mint routes.
- Workstream 4 is not complete until the new sell-side wallet quote is actually recoverable. Persisting `wallet_mint_quote_id`, state, and expiry in trade metadata is not enough if the standard mint-quote routes cannot read or redeem that quote after interruption.
- Do not manually force a wallet mint quote to `ISSUED` unless the corresponding blinded-output recovery path is durable and externally reachable.
- Request-id idempotency must cover response loss, not only duplicate execution. After successful funding or sell issuance, the client must be able to recover the same outputs or resume through a documented redeemable quote path.
- Outbound product APIs should emit `long` and `short`, not `yes` and `no`, and should avoid `settlement` language when the user-facing behavior is wallet funding, market minting, or withdrawal.
Required test additions:
- duplicate Stripe webhook delivery after `paid`, `complete`, and `review_required`
- interrupted sell after wallet invoice payment but before client receipt of proofs
- interrupted funding after `PAID` and after successful proof issuance
- signet paper funding behavior is explicitly documented and test-covered so the signet mint's auto-payment rule cannot drift silently
- launch checks that fail when live FX providers are unavailable

### 2026-04-13 Round 3

- Workstream 2 now rejects missing or stale provider observations in every edition instead of silently falling back to a static signet BTC/USD rate, so launch completion depends on the live multi-provider quote path for both signet and mainnet.
- Workstream 3 was previously aligned to a manual-payment signet model. Superseded by the 2026-04-15 clarification that signet wallet-funding quotes should auto-pay testnut-style while the browser still observes `UNPAID -> PAID -> ISSUED` on the standard routes.
- Workstream 4 recovery is now externally replayable end to end: sell-created wallet quotes are recoverable through the standard `bolt11` quote and mint routes, and completed trade request retries can return the same issued/change bundles without re-executing the trade.

### 2026-04-15 Signet Funding Clarification

- Owner clarification: signet wallet-funding Lightning quotes should auto-pay inside the signet mint, testnut-style.
- The signet edition still uses the standard wallet-mint quote and mint routes and still issues browser-local proofs; the auto-payment shortcut does not justify a separate server-held paper wallet model.
- Integration tests should therefore assert automatic transition from `UNPAID` to `PAID` for signet wallet-funding quotes without requiring an external manual `pay_invoice` step.
