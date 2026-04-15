# Backend Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust |
| Database | SQLite (active config; PostgreSQL remains the production target) |
| Cashu | CDK Rust (Cashu Dev Kit) |
| Wallet funding | Stripe gateway + Lightning mint quotes |
| Settlement rail | Lightning backend (currently LND-oriented) |
| Nostr publishing | Custom Nostr client |
| Network | Signet (testing), mainnet (production) |
| Deployment | Self-hosted |

The backend is self-hosted infrastructure, not Vercel. The frontend deploys to Vercel; the mint layer runs on dedicated servers.

Signet and mainnet should be treated as separate editions with separate runtime state, not as one shared environment with a network flag.

## Role: The Mint Layer Is Authoritative

The backend's primary role is operating the Cascade mint layer.

That mint layer has two logical responsibilities:

- the **wallet mint**, which stores spendable USD ecash and accepts Stripe and Lightning-funded portfolio funding
- the **market mint**, which owns LMSR state and issues LONG/SHORT market tokens

The market mint database is the authoritative source of LMSR state. Not Nostr. Not the frontend.

Kind `983` events are the public audit log, published by the market mint after each trade. They are derived from the mint state. If there is ever a discrepancy, the mint state wins.

## Architecture Layers

```text
HTTP API / product coordinator
   │
   ├── Wallet Mint
   │   ├── USD keysets
   │   ├── Stripe gateway state
   │   ├── Lightning mint-quote state
   │   └── outgoing market-payment settlement
   │
   ├── Market Mint
   │   ├── LMSR engine
   │   ├── LONG/SHORT keysets
   │   ├── market quote state
   │   └── trade history / kind 983
   │
   ├── FX Quote Layer
   │   └── USD <-> msat executable quotes
   │
   ├── SQLite
   │   └── keysets, proofs, quotes, market state, funding state
   │
   ├── Lightning backend
   │   └── inter-mint settlement rail
   │
   ├── Stripe webhooks
   │   └── card-funded portfolio funding completion
   │
   └── Nostr publisher
       └── kind 983 trade audit log
```

## HTTP API

The backend exposes two classes of interface.

### Cashu Mint Interface

Standard NUT endpoints on the wallet mint and market mint:

- standard NUT endpoints (`/v1/info`, `/v1/keys`, `/v1/keysets`, `/v1/swap`, `/v1/checkstate`, `/v1/restore`, `/v1/ws`)
- BOLT11 mint/melt flows (`/v1/mint/quote/bolt11`, `/v1/mint/bolt11`, `/v1/melt/quote/bolt11`, `/v1/melt/bolt11`)
- market-scoped key discovery: `GET /{event_id}/v1/keys`
- Stripe funding: `POST /v1/fund/stripe`, `POST /v1/fund/stripe/webhook`, `GET /v1/fund/stripe/{funding_id}` (Stripe is a funding rail — it lives on the mint, not a webapp)
- blind auth NUT endpoints
- health: `GET /health`

### Product Trade Interface

Higher-level trade orchestration routes:

- trade quote and execution endpoints (`/api/trades/quote`, `/api/trades/buy`, `/api/trades/sell/quote`, `/api/trades/sell`)
- trade status lookup (`/api/trades/{trade_id}`, `/api/trades/requests/{request_id}`)
- FX preview (`/api/product/fx/lightning/{amount_minor}`)

There is no mint-side registry of humans or agents at this boundary. A pubkey is just a pubkey.

### What The Backend Does NOT Serve

The backend does not serve market discovery, search, activity feeds, price history, or any other data that belongs on relays. Specifically, there are no:

- market feed or listing endpoints
- market search endpoints
- activity feed endpoints
- price history endpoints
- market detail endpoints (beyond what trade execution requires)

Market definitions (kind `982`) and trade records (kind `983`) are authoritative on Nostr relays. The frontend queries relays directly for all market discovery and read surfaces.

See [../mint/api.md](../mint/api.md) for the canonical machine-interface story.

## Market State

The market mint tracks:

- `qLong`
- `qShort`
- `b`
- `reserve_minor`
- keyset-to-market-and-side mapping
- trade history

All of those values are in the market execution settlement unit. For launch, that unit is `msat`, while product surfaces continue to render USD through the FX layer.

## Database

**Active storage: SQLite.** PostgreSQL remains the production target but is not the current active configuration.

The intended persistent schema includes:

- **Markets**: market event ID, slug, creator pubkey, status, creation timestamp
- **LMSR state**: per-market `qLong`, `qShort`, `b`, `reserve_minor`
- **Keysets**: USD wallet keysets and market keyset mappings
- **Proofs**: spent-proof state and restore metadata for blinded outputs, not a server-side mirror of user-held proofs
- **Trade history**: internal record of all trades, source of kind `983`
- **Wallet funding**: Stripe session / payment-intent mapping and completion status
- **Wallet Lightning mint quotes**: incoming quote, invoice, and settlement state
- **Payment quotes**: outgoing and incoming mint/melt quote state for inter-mint settlement
- **FX quotes**: executable `USD <-> msat` quote snapshots and expiries
- **Trade settlements**: persisted settlement records attached to executed trades so status and recovery can reason about the hidden rail step separately from the user-facing trade event

The current implementation still keeps some market state partly in-memory. That is migration debt.

Launch must not persist a canonical per-user portfolio ledger. In particular:

- no pubkey-keyed current cash-balance table for `/portfolio`
- no pubkey-keyed current open-position table for `/portfolio`
- no pubkey-keyed API that claims to answer current holdings from backend state

The backend may still persist quote status, request status, settlement status, anti-abuse state, and spent-proof state.

Legacy compatibility code that mutates backend-only portfolio mirrors should be deleted rather than kept dormant. Unused mirror code is still architectural drift.

Standard-first backend rule:

- prefer CDK's canonical mint/melt quote state for standard Cashu operations
- when Cascade needs extra product metadata, attach it to the canonical quote or operation id instead of replacing the standard flow
- add a custom backend table or route only when the behavior is outside the standard mint contract and the justification is documented
- when the coordinator spends proofs for a product trade, it should do so through the same in-process CDK mint or melt primitives that back the public standard routes, not through direct invoice-service shortcuts

Actor metadata such as thesis, role, or operator notes is not mint state and should not live in mint tables. The mint only needs market, quote, settlement, and proof data.

Public `/market/:slug` reads are relay-only. Anonymous reads stay `404` until relays have both
the kind `982` market event and at least one mint-authored kind `983`. Creator-only pending
visibility remains in builder and other creator-aware flows rather than a mint-side pending-market
endpoint.

Edition boundaries (signet vs mainnet) are enforced at the mint level through separate runtime instances. The frontend must connect to the correct mint for the correct edition.

## FX Quote Policy

The `USD <-> msat` boundary should be implemented as a modular multi-provider quote service.

- adapters fetch data from multiple large providers
- quote construction applies one documented combination policy
- persisted quote snapshots include contributing provider prices, final executable rate, spread, and expiry
- persisted trade quotes also store the selected FX snapshot id, the `msat` settlement amount, and the marginal price movement for the exact LMSR fill
- trade and funding execution consumes locked quotes rather than ad hoc spot reads
- launch quote preview should be inspectable through a dedicated endpoint so operators can curl a locked `USD <-> msat` quote without creating a payment object

## Stripe Integration

Stripe is a launch funding rail for the wallet mint. The mint holds the Stripe secret key, creates checkout sessions, and receives webhooks. There is no webapp backend in the Stripe funding path — it is architecturally identical to Lightning: the mint handles the money, the frontend handles the UX.

Card payments are reversible, so launch needs explicit risk controls around freshly funded balances.

Because wallet proofs are browser-local bearer assets, the backend cannot safely rely on post-issuance portability limits. Launch should instead:

- cap Stripe funding size and rolling Stripe volume before Checkout creation
- fetch Stripe risk data from the webhook completion path
- issue proofs only when the configured risk policy accepts the payment
- move rejected card funding attempts into `review_required` or failure without issuing proofs

The hosted Stripe flow should be:

- client requests `POST /v1/fund/stripe` on the mint with `pubkey`, `amount_minor`, and optional `request_id`
- mint persists the funding request before creating the Checkout Session
- mint creates a hosted Checkout Session with funding identifiers in metadata
- mint persists the Stripe funding record with rail `stripe` and pending status
- browser redirects to the returned `checkout_url`
- Stripe webhook (`POST /v1/fund/stripe/webhook`) on the mint is the authoritative completion path
- webhook fetches Stripe risk data, then either marks the quote paid for later browser minting or marks the funding request `review_required`
- browser resumes by polling `GET /v1/fund/stripe/{funding_id}` on the mint
- browser calls the standard mint blind-output issuance route to receive proofs

Stripe must not introduce a separate balance ledger or a server-side proof issuance path. It terminates in the same browser-side blind-output issuance and recovery model already used by Lightning mint quotes.

## USDC Wallet Infrastructure

USDC is an additive later wallet rail, not a replacement for the USD wallet mint.

- the mint can be configured with a provider-agnostic treasury wallet address for native USDC
- the mint does not currently store or manage an EVM private key; outbound execution should come from a treasury signer or provider integration
- the backend persists USDC deposit intents independently from Stripe and Lightning funding quotes
- a deposit intent records the intended wallet credit amount, destination address, provider correlation fields, and later onchain confirmation references
- the backend also persists outbound USDC withdrawal records that consume USD proofs, return USD change proofs, and wait for treasury submission plus completion tracking
- outbound USDC withdrawal creation is disabled by default and must be explicitly enabled once a real payout executor exists
- provider webhook success must not be treated as sufficient to issue proofs
- the authoritative transition remains confirmed native USDC receipt into the configured treasury flow

The initial infrastructure surface is intentionally generic so later direct deposits or third-party ramps such as MoonPay can attach to the same deposit-intent records, and later treasury execution can attach to the same withdrawal records, instead of dictating backend state shape.

## Lightning Integration

Lightning is both a launch wallet-funding rail and the settlement rail between the wallet mint and the market mint.

- the wallet mint should expose incoming USD funding through the standard Cashu NUT-23 BOLT11 mint flow
- the wallet mint can create USD mint quotes by locking `USD <-> msat` FX quotes
- incoming mint-quote status polling reconciles persisted quote state against real invoice state, so a paid invoice can move to `PAID` after restart or client interruption
- those Lightning funding quotes should also exist as real CDK mint-quote records in mint storage, not only as parallel product-saga rows
- incoming Lightning proof issuance should run through CDK `process_mint_request` once the quote is paid, rather than a custom blind-signing path
- persisted buy/sell quotes carry the Lightning-facing settlement budget and provider observations needed for the eventual inter-mint saga
- executed buy/sell records should carry the completed BOLT11 settlement metadata, not a signet-only synthetic settlement label
- the market mint can return a standard invoice-backed quote for a LONG or SHORT trade
- the wallet mint can pay that quote by consuming USD proofs
- the reverse path can return market exit value back into the wallet mint

This is backend plumbing, not normal product UX. The frontend should not force the user to think in sats or Lightning invoices.

In signet, the product should preserve these same quote shapes and the same standard public routes. The signet mint may auto-pay wallet-funding Lightning quotes, testnut-style, but the browser still observes quote state on the standard quote route and still calls the standard mint route to receive edition-local proofs.

Incoming Lightning portfolio funding should therefore look like:

- `POST /v1/mint/quote/bolt11` with `{"amount": <usd_minor>, "unit": "usd"}`
- if the browser loses the initial quote response, it retries `POST /v1/mint/quote/bolt11` with the same client `request_id` until the mint replays the same quote
- `GET /v1/mint/quote/bolt11/{quote_id}` until the quote reaches `PAID`
- `POST /v1/mint/bolt11` with blinded outputs to issue the USD proofs through the standard CDK mint path

That keeps pure wallet funding on the Cashu-standard surface. Cascade-specific `/api/...` routes should remain focused on product orchestration such as market creation, quoting, buying, and withdrawal flows.

The current mint runtime uses the local `lncli` binary as the concrete LND adapter. Runtime config should therefore include TLS cert path, macaroon path, network, and either an explicit `lncli` path or a deployment environment where `lncli` is resolvable on `PATH`.

## Nostr Publishing

After every market trade, the backend signs and publishes a kind `983` event to the configured
Nostr relays using the market mint's own Nostr keypair. Public market visibility depends on that
publication: the first seed trade makes `/market/:slug` readable once relays have both the kind
`982` market event and the first kind `983`.

This is the public audit trail. Anyone subscribed to kind `983` events for a given market can reconstruct the trading history.

## Key Invariants

1. **Mint state is authoritative**. Never derive executable state from Nostr events.
2. **Reserve is always solvent**. The LMSR reserve is accounted in settlement units and must remain mathematically sufficient.
3. **Atomic trade execution**. State updates and token issuance happen in the same logical trade transaction.
4. **No proof mirror**. The backend must never persist a canonical copy of user-held proofs or return bearer proofs in status payloads.
5. **No server portfolio ledger**. The backend must never claim canonical current holdings for a pubkey through a balance or position snapshot API.
6. **Spent-proof tracking**. All consumed proofs are recorded in mint-side proof state; presenting a spent proof returns an error.
7. **No proof-level owner identity**. Cashu is bearer-based; optional NIP-98 authenticates a request signer, not a permanent proof owner.
8. **Normal product flows are dollar-denominated**. Sats and msats are backend implementation details, not user-facing product units.
