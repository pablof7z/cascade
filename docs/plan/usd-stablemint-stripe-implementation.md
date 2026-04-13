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
- [wallet-rail-options-evaluation.md](./wallet-rail-options-evaluation.md)
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

Implement the USD wallet mint with both launch funding paths.

- add wallet-mint configuration for USD operation
- implement or integrate a `stripe` payment processor / gateway
- add incoming Lightning mint-quote support for USD-denominated funding on the standard Cashu NUT-23 BOLT11 endpoints
- map Stripe and Lightning payment completion to mint quote completion
- let the browser mint and recover USD proofs locally after successful Lightning funding
- issue USD proofs only after verified Stripe completion and risk acceptance
- add risk controls for reversible card payments
- gate proof issuance on Stripe risk signals and conservative volume caps
- keep one persisted funding saga model across Stripe and Lightning, with rail-specific metadata instead of rail-specific custody paths

Definition of done:

- user can start Stripe funding
- Stripe webhook marks the payment complete
- user can start Lightning funding for a locked USD amount through `POST /v1/mint/quote/bolt11`
- Lightning payment marks the mint quote `PAID`
- the browser can call `POST /v1/mint/bolt11` and recover the issued proofs locally after interruption
- Stripe retains the persisted request/status saga because card checkout is not a standard Cashu mint flow

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
- expose creator-visible pending-market state before the first mint-authored kind `983`

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
- add smoke checks for creator-only pending-market visibility before first funding and public visibility after first kind `983`
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
