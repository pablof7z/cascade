# Inter-Mint Lightning Settlement

This document defines the canonical launch settlement model for Cascade.

It answers one specific question:

How does a user go from USD wallet value to LONG or SHORT market proofs, and back again, without introducing a new public swap primitive?

## Locked Decision Summary

- The user-facing wallet is a self-operated USD stablemint.
- Launch wallet funding rails are Stripe and Lightning.
- The market mint reuses standard Cashu mint and melt mechanics backed by BOLT11.
- The lingua franca between the wallet mint and the market mint is Lightning settlement in `msat`.
- The product layer hides `msat`, invoices, and cross-mint choreography from normal users.
- We do not introduce a bespoke public `USD -> LONG/SHORT` protocol primitive for launch.

## Why This Shape

We want three things at once:

- a dollar-denominated product for normal users
- interoperability through existing mint and Lightning primitives
- no custom cross-unit swap primitive that only Cascade understands

The result is a two-quote model composed behind one product action.

## Moving Parts

### Wallet Mint

The wallet mint is the canonical USD cash layer.

- issues USD ecash proofs
- accepts Stripe funding
- accepts Lightning-funded USD mint quotes
- melts USD proofs into BOLT11 invoices when paying the market mint

### Market Mint

The market mint is the execution layer.

- holds LMSR market state
- issues LONG and SHORT proofs
- computes exact buy and sell settlement amounts from LMSR
- accepts Lightning-paid mint quotes for market issuance
- melts market proofs into Lightning payments on exits

### FX Quote Service

The FX layer is external to LMSR.

- quotes `USD <-> msat`
- uses external market data and policy spread
- returns executable quotes with expiry
- is used by the wallet mint for Lightning funding and Lightning melts

### Product Coordinator

The product API composes the two mints.

- accepts spend-based and sell-based product requests in USD
- fetches market quotes and FX quotes
- manages quote expiry, retries, and recovery
- hides invoice choreography from `web/` and normal agents

## The Two Quote Layers

There are two distinct quote problems.

### 1. FX Quote: `USD <-> msat`

This quote belongs to the wallet mint boundary.

Examples:

- fund `$25.00` through Lightning
- pay a market-mint invoice from USD proofs
- redeem market value back into USD proofs

A valid FX quote must include at least:

- `usd_minor`
- `msat`
- `fx_rate`
- `spread_bps`
- `source`
- `expires_at`

### 2. Market Quote: `LONG/SHORT <-> msat`

This quote belongs to the market mint.

It is not a timeless spot price. It is an executable quote for a specific trade size against the current LMSR state.

A valid market quote must include at least:

- `event_id`
- `side`
- either `quantity` or `max_spend_msat`
- `settlement_msat`
- `average_price_ppm`
- `marginal_price_before_ppm`
- `marginal_price_after_ppm`
- `fees_msat`
- `expires_at`

## Funding The Wallet

### Stripe Funding

1. User chooses a dollar amount.
2. Wallet mint or coordinator creates a Stripe-backed funding request.
3. Stripe webhook confirms payment completion.
4. Wallet mint marks the quote paid.
5. User redeems the quote for USD proofs.

### Lightning Funding

1. User chooses a dollar amount.
2. Wallet mint locks a `USD <-> msat` quote through the standard Cashu NUT-23 mint-quote flow.
3. Wallet mint returns a BOLT11 invoice for the quoted `msat` amount.
4. User pays the invoice.
5. Wallet mint marks the mint quote `PAID`.
6. User calls the standard Cashu mint endpoint and receives USD proofs.

The user sees a dollar-denominated funding flow. The invoice is a funding mechanism, not the product's unit of account.

For wallet funding, the canonical public endpoints are:

- `POST /v1/mint/quote/bolt11`
- `GET /v1/mint/quote/bolt11/{quote_id}`
- `POST /v1/mint/bolt11`

## Buy Flow

The user experience is:

- spend `$X` on `YES`
- receive LONG proofs

The low-level composition is:

1. User requests a buy quote in USD.
2. Coordinator gets a fresh `USD <-> msat` FX quote.
3. Coordinator computes the `msat` budget implied by the USD spend.
4. Coordinator asks the market mint for the executable `LONG/SHORT <-> msat` quote for that trade.
5. Market mint creates a standard mint quote backed by a BOLT11 invoice.
6. Wallet mint creates a standard melt quote for that invoice in USD.
7. User submits USD proofs to the wallet mint melt.
8. Wallet mint consumes the USD proofs and pays the invoice.
9. User redeems the market-mint quote and receives LONG or SHORT proofs.

Persisted settlement records for buys should expose that logical direction explicitly:

- payer role: `wallet_mint`
- receiver role: `market_mint`
- settlement mode: `bolt11_wallet_to_market`

No new public swap primitive is required. The product coordinator simply makes the standard path feel like one action.

## Sell Flow

The user experience is:

- sell market proofs
- receive USD proofs

The low-level composition is:

1. User requests a sell quote.
2. Market mint computes the exact `msat` proceeds for the supplied quantity at the current LMSR state.
3. Coordinator gets a fresh `USD <-> msat` quote for the return path.
4. Wallet mint creates an incoming Lightning mint quote for the target USD amount.
5. Market mint creates a melt quote that will pay that wallet-mint invoice.
6. User submits market proofs to the market mint melt.
7. Market mint consumes those proofs and pays the wallet-mint invoice.
8. User redeems the wallet-mint quote and receives USD proofs.

Persisted settlement records for sells should expose that logical direction explicitly:

- payer role: `market_mint`
- receiver role: `wallet_mint`
- settlement mode: `bolt11_market_to_wallet`

## Why We Reuse Existing Primitives

This architecture deliberately stays inside existing boundaries:

- NUT-04 for mint quotes and minting
- NUT-05 for melt quotes and proof spending
- BOLT11 for inter-mint settlement

That matters for two reasons:

- Cascade does not need a protocol nobody else understands.
- External wallets and agents can still participate if they understand multiple mints, BOLT11, and custom units.

The product API hides the choreography, but the underlying primitives remain recognizable and composable.

For clarity, that means the internal Lightning settlement choreography should be backed by the standard routes:

- wallet funding in Lightning: `POST /v1/mint/quote/bolt11`, `GET /v1/mint/quote/bolt11/{quote_id}`, `POST /v1/mint/bolt11`
- buy-side settlement: `POST /v1/melt/quote/bolt11`, `GET /v1/melt/quote/bolt11/{quote_id}`, `POST /v1/melt/bolt11` on the wallet mint, paired with standard mint-quote redemption on the market mint
- sell-side settlement: `POST /v1/melt/quote/bolt11`, `GET /v1/melt/quote/bolt11/{quote_id}`, `POST /v1/melt/bolt11` on the market mint, paired with standard mint-quote redemption on the wallet mint

If the codebase still uses a custom route for one of those jobs, that route is migration debt unless it has a documented product-specific justification.

## Recovery And State

This is not a single on-chain atomic transaction. It is a quote-based saga and must be treated that way.

Launch requires persisted state for:

- funding quotes
- FX quotes
- market quotes
- mint quotes
- melt quotes
- payment identifiers
- trade execution records

Launch also requires:

- idempotent execution keys
- quote expiry handling
- paid-but-not-redeemed recovery
- client retry safety
- explicit status endpoints for interrupted buys and sells

The important recovery cases are:

- wallet melt succeeded but market quote not yet redeemed
- market melt succeeded but wallet quote not yet redeemed
- quote expired before payment
- invoice was paid after the client disconnected

## Product Contract Consequences

The product API should stay dollar-denominated.

Normal product routes talk about:

- `spend_usd_minor`
- `receive_usd_minor`
- token quantity
- average price
- fee and slippage

They should not require the caller to manually handle:

- raw BOLT11 invoice composition
- `msat` budgeting
- multiple mint quote IDs

Those are low-level details owned by the coordinator and low-level wallet tooling.

## Launch Boundary

For launch, the only wallet funding rails we commit to are:

- Stripe
- Lightning

Later rails can plug into the same USD wallet mint model without changing the market mint or the product contract.
