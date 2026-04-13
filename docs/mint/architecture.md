# Mint Architecture

The Cascade mint layer is a custom Cashu system with an LMSR execution layer on top. It is not a generic 1:1 ecash issuer. It prices market buys and sells, manages market reserves, and publishes the trade audit log.

This document describes the target architecture the product is being built toward. Parts of the current codebase still reflect earlier iterations and should be treated as migration debt.

The canonical settlement spec is [inter-mint-settlement.md](inter-mint-settlement.md).

## Logical Mints

Cascade has two logical mint roles.

### Wallet Mint

The wallet mint is the user-facing cash layer.

- issues USD-denominated ecash
- accepts Stripe funding
- accepts Lightning-funded mint quotes for a locked USD amount
- stores the user's liquid wallet balance as bearer proofs
- melts USD proofs into Lightning invoices when paying the market mint

### Market Mint

The market mint is the execution layer for positions.

- maintains LMSR market state
- issues LONG and SHORT tokens per market
- burns market tokens on exits
- publishes mint-authored kind `983` events
- creates invoice-backed mint quotes for market issuance
- computes exact market settlement amounts in `msat`

### Coordinator Layer

The web app and agent-facing product API compose the two mints.

- users ask to spend dollars on LONG or SHORT
- the coordinator gets a fresh `USD <-> msat` FX quote
- the coordinator gets a fresh market `LONG/SHORT <-> msat` quote
- the coordinator lazy-initializes the LMSR pool on the first trade for a market (fetching the kind `982` event from relays by event ID)
- the coordinator executes the stablemint melt and market-mint mint flow
- the coordinator stores recovery state for interrupted client flows

The mints do not need a bespoke public protocol between them. The public wire shape remains Cashu mint and melt plus BOLT11 while the product layer hides that complexity.

## System Shape

```text
web / agents
  -> product API / trade coordinator
  -> wallet mint (USD ecash, Stripe + Lightning funding)
  -> market mint (LMSR execution, LONG/SHORT issuance)
  -> FX quote source
  -> SQLite / persistent mint storage
  -> Lightning backend
  -> Stripe webhooks
  -> Nostr publisher
```

## Units And Quote Layers

Cascade has three unit contexts.

### Product Unit

The normal product unit is USD.

- normal UI shows dollars, not sats or msats
- product APIs represent USD in integer minor units
- wallet funding, buy, sell, portfolio, and PnL surfaces stay dollar-denominated

### Settlement Rail Unit

The inter-mint rail unit is `msat`.

- Lightning invoices are denominated in `msat`
- the wallet mint pays market-mint invoices over Lightning
- the market mint pays wallet-mint invoices over Lightning on exits

### Market Execution Quote Unit

The market mint produces executable quotes for LONG and SHORT in `msat`.

- market costs, fees, and proceeds are computed against LMSR for an exact trade size
- the product layer composes those quotes with `USD <-> msat` FX quotes
- the user still experiences the trade in dollars

This is the key design choice: the product is dollar-denominated, but the cross-mint settlement language is `msat`.

## Token Model

Cascade uses pure bearer Cashu tokens.

- users hold USD ecash directly in their wallets
- users hold market tokens directly in their wallets
- the mint does not maintain a per-user custody ledger for spendable balance
- market tokens are not bound to a permanent user identity by default
- users can swap or transfer proofs without creating market activity

This is why kind `983` stays mint-authored and request attribution stays optional.

## Keysets

The wallet mint has USD keyset material for wallet balances.

Each market on the market mint has two keysets:

- LONG keyset for the YES side
- SHORT keyset for the NO side

All users in the same market share those keysets. The market mint keeps the mapping from keyset id to market id and direction so it can interpret incoming proofs during exits.

The canonical public discovery path for market keysets is market-scoped:

- `GET /{event_id}/v1/keys`

The path segment is the kind `982` event id, not the slug and not an internal mint UUID.

## State Authority

The market mint is the source of truth for executable market state.

- `qLong` and `qShort` define the current outstanding supply on each side
- `reserve_msat` is the current LMSR reserve implied by that state
- quote state ties an executable market quote to a specific LMSR snapshot and expiry
- keyset metadata ties proofs back to a market and side
- trade history inside the market mint is the source material for kind `983`
- public discovery eligibility begins only after the first mint-authored kind `983` for that market (triggered by the first trade, which also lazy-initializes the LMSR pool)

The wallet mint is the source of truth for:

- USD keysets
- wallet funding quotes
- Stripe funding state
- Lightning funding state
- outgoing melt state when the wallet funds a market buy
- incoming mint state when market exits return value to the wallet
- Stripe risk-policy state attached to pending card funding before proof issuance

The intended steady state is full mint-side persistence for both wallet-mint and market-mint state. The current code still has some in-memory market state, which is implementation debt.

## Payment Processors And Settlement

Stock CDK flows are not enough for this product shape because:

- standard swaps are same-unit only
- stock amount conversion only knows `sat <-> msat`
- built-in internal settlement only handles same-mint, same-unit paths
- the product needs executable `USD <-> msat` quotes as well as executable `LONG/SHORT <-> msat` quotes

Cascade therefore needs custom payment processors at the mint boundary.

### Wallet Mint Processors

The wallet mint needs:

- an incoming `stripe` payment method for card funding
- an incoming Lightning mint-quote path that prices a USD amount into `msat`
- an outgoing Lightning melt path that prices a market-mint invoice into USD minor units and consumes the correct USD proofs
- a risk-policy hook that can cap Stripe funding volume before checkout creation and gate proof issuance after webhook completion

### Market Mint Processors

The market mint needs:

- incoming payment logic that turns a requested LONG or SHORT quantity into a BOLT11 invoice amount using LMSR
- outgoing payment logic for exits when market value is returned to the wallet mint over Lightning

## Endpoint Layers

There are two layers of machine interface.

### Low-Level Mint Contract

This is the Cashu-facing layer:

- standard NUT routes on the wallet mint
- standard NUT routes on the market mint
- custom `stripe` payment-method routes on the wallet mint
- standard BOLT11 quote and melt flows on both mints
- market-scoped `GET /{event_id}/v1/keys` on the market mint

### Product Orchestration Contract

This is the layer `web/` and agents should normally use:

- wallet funding creation and status in USD
- spend-based trade quote and execute endpoints in USD
- sell quote and execute endpoints in USD
- public discovery, analytics, discussion, and profile APIs

The product contract exists because the user experience is "spend $10 on YES", not "manually compose mint quotes, melt quotes, and Lightning invoices."

## Standard-First Rule

Reuse standard CDK/Cashu mint and melt flows whenever the required behavior is already expressible there.

- incoming Lightning funding should stay on the standard mint-quote and mint endpoints
- outgoing Lightning settlement between mints should stay on the standard melt-quote and melt endpoints
- custom Cascade routes should sit above those standard flows as orchestration, not replace them

Custom logic is justified only for product-specific behavior such as Stripe funding, edition/runtime protection, public discovery reads, and spend-based LMSR trade orchestration.

## Trade Lifecycle

### Wallet Funding With Stripe

1. User starts an add-funds flow in dollars.
2. Wallet mint creates a Stripe-backed funding request.
3. User completes the card payment through Stripe.
4. Stripe webhook fetches Stripe risk data for the completed payment.
5. If the payment passes the configured Stripe risk policy, wallet mint issues USD proofs to the user's local wallet.
6. If the payment fails the configured Stripe risk policy, the funding request moves to `review_required` and no proofs are issued.

### Wallet Funding With Lightning

1. User starts an add-funds flow in dollars.
2. Wallet mint locks a `USD <-> msat` FX quote.
3. Wallet mint creates a BOLT11 invoice for the quoted `msat` amount.
4. User pays the invoice.
5. Wallet mint marks the quote paid.
6. Wallet mint issues USD proofs to the user's local wallet.

### Buy

1. User asks to spend `$X` on LONG or SHORT for a market.
2. **Lazy initialization (first trade only):** If no LMSR pool exists for the market, the coordinator fetches the kind `982` event from Nostr relays by event ID, extracts LMSR parameters, and creates the pool. No pre-registration is required.
3. Coordinator gets a fresh `USD <-> msat` FX quote.
4. Coordinator computes the implied `msat` budget.
5. Market mint computes the executable `LONG/SHORT <-> msat` quote.
6. Market mint creates a standard mint quote backed by a Lightning invoice.
7. Wallet mint creates a melt quote for that invoice in USD minor units.
8. User authorizes spending local USD proofs.
9. Wallet mint consumes the USD proofs and pays the invoice.
10. User redeems the market-mint quote and receives LONG or SHORT proofs.
11. Market mint publishes a kind `983` buy event.
12. If this is the market's first kind `983`, the market becomes publicly discoverable.

The persisted settlement record for this leg should identify the logical rail path as `wallet_mint -> market_mint` with `mode = bolt11_wallet_to_market`.

### Sell

1. User asks to sell some or all market proofs.
2. Market mint computes the exact `msat` proceeds for that exit.
3. Coordinator gets a fresh `USD <-> msat` FX quote for the return path.
4. Wallet mint creates an incoming USD mint quote backed by a Lightning invoice.
5. Market mint creates a melt quote that pays the wallet-mint invoice.
6. User submits market proofs to the market mint melt.
7. Market mint consumes the proofs and pays the invoice.
8. User redeems the wallet-mint quote and receives USD proofs.
9. Market mint publishes a kind `983` sell event.

The persisted settlement record for this leg should identify the logical rail path as `market_mint -> wallet_mint` with `mode = bolt11_market_to_wallet`.

### Swap

NUT-03 swap is not market activity.

- it splits, merges, or reissues bearer proofs
- it may change who controls the proofs
- it does not change `qLong`, `qShort`, reserve, or price
- it must not produce kind `983`

That separation keeps price history and volume tied only to actual LMSR execution.

## Nostr Publishing

Every kind `983` is authored by the market mint.

- `pubkey` on the event is always the mint's Nostr pubkey
- the optional `p` tag is not proof ownership metadata
- if present, `p` identifies the Nostr pubkey that authenticated the HTTP trade request

See [auth.md](auth.md) for the exact attribution model.

## Operational Constraints

Card payments are reversible. Bearer ecash is not.

Launch therefore needs explicit risk controls around the Stripe gateway. Examples include:

- funding limits
- fraud checks
- webhook-time proof issuance gates keyed off Stripe risk signals
- `review_required` handling for completed but higher-risk payments

Launch also needs explicit quote and saga controls:

- quote expiry handling
- persisted payment identifiers
- paid-but-not-redeemed recovery
- idempotent trade execution

Those are operational controls, not changes to market mechanics.

## Why This Shape

This architecture gives Cascade:

- a dollar-denominated product for non-Bitcoin users
- a self-custodied wallet model for USD and market proofs
- a standard primitive path under the hood rather than a bespoke cross-unit swap protocol
- a single authoritative execution layer for markets
- public verifiability through mint-authored Nostr events
- a clean separation between market activity and simple token movement
