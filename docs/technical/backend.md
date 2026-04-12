# Backend Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Language | Rust |
| Database | SQLite (active config; PostgreSQL remains the production target) |
| Cashu | CDK Rust (Cashu Dev Kit) |
| Wallet funding | Stripe gateway + Lightning top-up quotes |
| Settlement rail | Lightning backend (currently LND-oriented) |
| Nostr publishing | Custom Nostr client |
| Network | Signet (testing), mainnet (production) |
| Deployment | Self-hosted |

The backend is self-hosted infrastructure, not Vercel. The frontend deploys to Vercel; the mint layer runs on dedicated servers.

Signet and mainnet should be treated as separate editions with separate runtime state, not as one shared environment with a network flag.

## Role: The Mint Layer Is Authoritative

The backend's primary role is operating the Cascade mint layer.

That mint layer has two logical responsibilities:

- the **wallet mint**, which stores spendable USD ecash and accepts Stripe and Lightning-funded top-ups
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
   │   ├── Lightning top-up quote state
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
   │   └── keysets, proofs, quotes, market state, top-up state
   │
   ├── Lightning backend
   │   └── inter-mint settlement rail
   │
   ├── Stripe webhooks
   │   └── card-funded top-up completion
   │
   └── Nostr publisher
       └── kind 983 trade audit log
```

## HTTP API

The backend exposes two classes of interface.

### Low-Level Mint Interface

These are the Cashu-facing endpoints used by the wallet and by any Cashu-aware client:

- standard NUT endpoints on the wallet mint
- standard NUT endpoints on the market mint
- market-scoped key discovery: `GET /{event_id}/v1/keys`
- custom `stripe` payment-method routes on the wallet mint

### Product Interface

These are the higher-level routes `web/` and agents should normally use:

- public discovery, analytics, profile, and discussion APIs
- Stripe and Lightning top-up initiation and status
- spend-based trade quote and execute endpoints in USD
- persisted trade status lookup by `trade_id`
- creator-only pending-market reads before first public trade
- market creation and other authenticated product actions

The current `mint/crates/cascade-api/src/routes.rs` still contains earlier sat-oriented routes such as `/api/lightning/*` and `/api/trade/bid`. Those are implementation debt, not the final product contract.

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
- **Proofs**: issued and spent-proof state
- **Trade history**: internal record of all trades, source of kind `983`
- **Wallet top-ups**: Stripe session / payment-intent mapping and completion status
- **Wallet Lightning top-ups**: incoming quote, invoice, and settlement state
- **Payment quotes**: outgoing and incoming mint/melt quote state for inter-mint settlement
- **FX quotes**: executable `USD <-> msat` quote snapshots and expiries

The current implementation still keeps some market state partly in-memory. That is migration debt.

Public market projections must exclude markets that do not yet have at least one mint-authored kind `983`. Creator-authenticated reads may include those markets in a pending state.

Projection keys and runtime configuration should also include the edition boundary so signet and mainnet discovery cannot mix.

## FX Quote Policy

The `USD <-> msat` boundary should be implemented as a modular multi-provider quote service.

- adapters fetch data from multiple large providers
- quote construction applies one documented combination policy
- persisted quote snapshots include contributing provider prices, final executable rate, spread, and expiry
- trade and top-up execution consumes locked quotes rather than ad hoc spot reads
- launch quote preview should be inspectable through a dedicated endpoint so operators can curl a locked `USD <-> msat` quote without creating a payment object

## Stripe Integration

Stripe is a launch funding rail for the wallet mint.

- user starts a dollar top-up
- backend creates the Stripe session or payment intent
- Stripe webhook confirms completion
- wallet mint marks the quote paid and issues USD ecash

Card payments are reversible, so launch needs explicit risk controls around freshly funded balances.

The backend should ingest Stripe risk signals and map them into temporary purchase and proof-portability limits for newly funded value.

## Lightning Integration

Lightning is both a launch wallet-funding rail and the settlement rail between the wallet mint and the market mint.

- the wallet mint can create USD top-up invoices by locking `USD <-> msat` FX quotes
- incoming top-up status polling reconciles persisted quote state against real invoice state, so a paid invoice can complete after restart or client interruption
- the market mint can return a standard invoice-backed quote for a LONG or SHORT trade
- the wallet mint can pay that quote by consuming USD proofs
- the reverse path can return market exit value back into the wallet mint

This is backend plumbing, not normal product UX. The frontend should not force the user to think in sats or Lightning invoices.

The current mint runtime uses the local `lncli` binary as the concrete LND adapter. Runtime config should therefore include TLS cert path, macaroon path, network, and either an explicit `lncli` path or a deployment environment where `lncli` is resolvable on `PATH`.

## Nostr Publishing

After every market trade, the backend publishes a kind `983` event to Nostr relays using the market mint's own Nostr keypair.

This is the public audit trail. Anyone subscribed to kind `983` events for a given market can reconstruct the trading history.

## Key Invariants

1. **Mint state is authoritative**. Never derive executable state from Nostr events.
2. **Reserve is always solvent**. The LMSR reserve is accounted in settlement units and must remain mathematically sufficient.
3. **Atomic trade execution**. State updates and token issuance happen in the same logical trade transaction.
4. **Spent-proof tracking**. All consumed proofs are recorded; presenting a spent proof returns an error.
5. **No proof-level owner identity**. Cashu is bearer-based; optional NIP-98 authenticates a request signer, not a permanent proof owner.
6. **Normal product flows are dollar-denominated**. Sats and msats are backend implementation details, not user-facing product units.
