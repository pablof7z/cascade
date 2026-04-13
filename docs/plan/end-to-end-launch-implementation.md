# End-To-End Launch Implementation Plan

**Status:** Canonical implementation plan  
**Date:** 2026-04-11  
**Purpose:** Sequence the full Cascade build across mint, coordinator/backend, and `web/`, with separate signet and mainnet editions and a clear path to paper trading.

## Related Docs

- [usd-stablemint-stripe-implementation.md](./usd-stablemint-stripe-implementation.md)
- [web-launch-implementation.md](./web-launch-implementation.md)
- [usdc-wallet-rail-addendum.md](./usdc-wallet-rail-addendum.md)
- [../mint/architecture.md](../mint/architecture.md)
- [../mint/api.md](../mint/api.md)
- [../product/spec.md](../product/spec.md)
- [../design/product-decisions.md](../design/product-decisions.md)
- [../../mint/DEPLOYMENT.md](../../mint/DEPLOYMENT.md)

## What This Plan Locks

- The active frontend is `web/`, not `webapp/`.
- Launch funding rails are Stripe and Lightning.
- USDC is an additive later rail, not a launch blocker.
- Paper trading and real-money trading are separate editions.
- Mainnet and signet use the same product model, but never the same funds, proofs, relays, or backing infrastructure.
- Mainnet and signet also use the same proof-custody implementation: browser-local proof storage, not NIP-60 in only one edition.
- The backend never stores a canonical mirror of user proofs in either edition.

## Edition Model

Cascade runs two editions from one codebase.

### Mainnet Edition

- real money
- production relays and projections
- real Stripe mode
- real Lightning backend
- real reserves
- public production domains

### Signet Edition

- paper trading
- signet Lightning backend
- paper reserves only
- separate relays or projection boundary
- separate mint identity and key material
- no shared proofs or local-storage namespace with mainnet

### Hard Separation Rules

- separate mint seeds and keysets
- separate databases
- separate Lightning nodes or wallets
- separate Stripe configuration
- separate Nostr publisher keys
- separate relay inputs or environment filters for discovery
- separate frontend environment labels and local proof namespaces
- same browser-local proof manager implementation in both editions
- same blinded-output minting and trade-recovery model in both editions

If any of those boundaries are blurred, the editions are not safe.

## Target Runtime Shape

Launch should prefer a small number of deployable services with clear logical modules, not a large microservice graph.

### Core Runtime

- `product API / coordinator`
- `wallet mint`
- `market mint`
- `Nostr publisher`
- `discovery projection and read API`
- `background reconciliation worker`

### Supporting Modules

- `FX quote module`
- `Stripe webhook handler`
- `Lightning integration`
- `local proof manager in web`
- no launch dependency on NIP-60

### Optional Supporting Modules

- `signet invoice-driven paper funding` on the same top-up lifecycle as mainnet
- `USDC deposit module` later, as described in the addendum

The preferred first implementation is one backend deployment with these modules, not separate network services for each concern.

## Milestones

## Milestone 0: Contract Freeze And Environment Skeleton

### Scope

- freeze the canonical product contract
- freeze the signet/mainnet deployment model
- define domains, env vars, config files, and storage namespaces
- define how public discovery distinguishes signet from mainnet

### Deliverables

- final plan docs committed
- environment matrix committed
- config keys named for edition-aware deploys
- explicit decision on signet discovery isolation

### Success Gates

- a developer can explain the difference between signet and mainnet in one paragraph
- no doc still implies a single mixed deployment
- no doc still treats `webapp/` as active frontend scope

### Failure Gates

- signet/mainnet data boundaries are still ambiguous
- the market visibility rule differs across docs
- local proof storage naming is unspecified

### Best Practices

- use config-driven editions, not long-lived code branches
- keep domain names and env var names edition-specific from the start
- prefer one explicit environment enum everywhere

## Milestone 1: Mint Core Refactor

### Scope

- make market settlement-unit naming explicit
- finish market-id canonicalization around kind `982` event ids
- remove remaining sat-first assumptions from the market execution path
- keep market-scoped key discovery on `GET /{event_id}/v1/keys`

### Deliverables

- `cascade-core` uses settlement-unit-neutral naming
- market creation stores canonical event ids
- quote structs and trade structs no longer imply user-facing sats

### Success Gates

- buy and sell quote math is deterministic and test-covered
- all new code paths use the kind `982` event id as the market id
- market key discovery is market-scoped only

### Failure Gates

- any new state or API field reintroduces sat-specific product semantics
- a separate public market UUID leaks back into the contract

### Best Practices

- update DB schema, serialization, and docs together
- keep migration patches targeted
- add fixture-based tests for exact LMSR quote expectations

## Milestone 2: Persistence, Recovery, And Saga State

### Scope

- persist market state fully
- persist quote state, top-up state, trade state, and recovery state
- support idempotent retries for top-ups and trades

### Deliverables

- tables for quote snapshots, trade sagas, payment identifiers, and funding states
- durable status model for interrupted client flows
- replay-safe handlers

### Success Gates

- restart does not lose pending trade/top-up state
- a paid-but-not-redeemed flow can be recovered
- duplicate webhook or client retry does not double-issue proofs

### Failure Gates

- any paid state is kept only in memory
- client interruption can strand paid value irrecoverably

### Best Practices

- every externally triggered state transition gets an idempotency key
- persist external provider identifiers exactly as received
- keep saga states explicit rather than inferred

## Milestone 3: FX Quote Layer

### Scope

- implement `USD <-> msat` quote sourcing
- support multiple provider adapters
- persist executable quote snapshots with expiry and spread

### Deliverables

- quote-source interface
- first provider set
- combination policy
- diagnostics and admin visibility into quote formation

### Recommended Launch Sources

- Coinbase
- Kraken
- Bitstamp

### Success Gates

- wallet top-ups and market buys can both consume locked FX quotes
- expired quotes are rejected predictably
- provider outage degrades safely instead of silently using stale data

### Failure Gates

- the system reads one loose spot ticker during execution
- quote provenance is not persisted

### Best Practices

- make quote timestamps explicit
- store raw provider observations alongside final executable rate
- reject quotes when provider disagreement breaches a sanity threshold

## Milestone 4: Wallet Funding Rails

### Scope

- implement Stripe top-ups
- implement Lightning top-ups
- keep signet on the normal top-up paths and the same invoice lifecycle as mainnet

### Deliverables

- Stripe top-up initiation and webhook completion
- Lightning top-up quote and mint flow on standard Cashu NUT-23 endpoints
- signet top-up settlement that ends in edition-local Cashu proofs, not a pubkey-keyed server wallet ledger
- one rail-agnostic top-up recovery model shared by Stripe and Lightning
- runtime manifest and request-edition guard so the frontend cannot create a signet invoice from a mainnet surface

### Signet Recommendation

Paper trading should not require real card rails. The signet edition should expose:

- signet top-up quotes on the same rails and API shapes as mainnet
- signet quote settlement after actual payment on signet-value rails instead of a separate faucet concept

Those signet-only rails should still feed the same wallet model as mainnet:

- one canonical `/portfolio` product surface in both editions
- local proof custody in both editions
- no signet-only "paper wallet" account model backed by a per-pubkey balance API

Stripe test mode is useful for integration testing, but not sufficient as the only paper-funding mechanism.

### Success Gates

- a user with `$0` can fund the portfolio in signet without real money
- the Lightning portfolio rail works through `POST /v1/mint/quote/bolt11`, `GET /v1/mint/quote/bolt11/{quote_id}`, and `POST /v1/mint/bolt11`
- browser-local recovery can restore a paid Lightning quote after refresh without a server-held proof copy
- the backend does not maintain a pubkey-keyed current portfolio ledger in either edition
- a user with `$0` can fund the portfolio in mainnet through Stripe or Lightning
- Stripe redirect returns to the product, but proof issuance still depends on webhook completion
- no funding path issues proofs before confirmed payment
- no mainnet surface can create a signet Lightning invoice or signet Stripe session silently

### Failure Gates

- signet paper trading depends on real-money rails
- Stripe completion depends on browser redirect rather than webhook confirmation
- Stripe introduces a second recovery/status model that diverges from Lightning
- signet funding credits a pubkey-keyed server wallet instead of issuing signet-edition proofs to the user or agent
- the signet app depends on a separate portfolio product model rather than the same self-custodied proof behavior as mainnet
- the browser depends on a backend current-balance or current-position snapshot to render `/portfolio`
- a frontend can point at the wrong edition backend and still create funding or trading state without an explicit mismatch error

### Best Practices

- keep funding rails additive behind one wallet-mint abstraction
- gate freshly card-funded value with explicit temporary limits
- never couple proof issuance to a frontend-only callback

## Milestone 5: Market Mint Quotes And Settlement

### Scope

- implement invoice-backed market-mint issuance
- implement exit flows back into the wallet mint
- persist market quote state and settlement metadata

### Deliverables

- LONG and SHORT issuance via paid quotes
- exit path from market proofs to portfolio proofs
- exact quantity and proceeds handling for finite LMSR trades

### Success Gates

- buy and sell both complete through standard mint/melt plus Lightning choreography
- market quotes are recoverable and auditable
- first mint-authored `983` is emitted on initial seed trade

### Failure Gates

- market activity still depends on ad hoc custom settlement endpoints
- quote recovery after restart is incomplete

### Best Practices

- keep low-level wire shapes as standard as practical
- separate proof movement from public trade-history logic
- treat NUT-03 swap as non-market activity everywhere

## Milestone 6: Product Coordinator

### Scope

- expose spend-based and sell-based USD APIs
- coordinate wallet-mint and market-mint sagas
- own creator-only pending market visibility

### Deliverables

- `POST /api/trades/quote`
- `POST /api/trades/buy`
- `POST /api/trades/sell/quote`
- `POST /api/trades/sell`
- top-up status routes
- pending market read route for creator flows

### Success Gates

- `web/` and agents can trade in USD without handling Lightning directly
- creator can publish kind `982`, fund later, and resume launch cleanly
- public discovery excludes unfunded markets until the first mint-authored `983`

### Failure Gates

- the coordinator leaks Lightning invoice mechanics into normal trade UX
- creator funding and market launch are not resumable

### Best Practices

- treat create-and-seed as one saga with resumable checkpoints
- keep quote IDs, trade IDs, and top-up IDs stable and externally visible
- make status endpoints the recovery contract

## Milestone 7: Discovery, Projection, And Read APIs

### Scope

- build public read models for homepage, search, market detail, activity, analytics, and profiles
- enforce creator-only pending visibility
- enforce edition boundaries in discovery

### Deliverables

- API-backed homepage cuts
- market search
- market detail projection
- activity projection
- edition-aware public discovery

### Success Gates

- a paper-trading market never appears in the mainnet app
- an unfunded market never appears in public discovery
- the creator can still read their own pending market

### Failure Gates

- raw relay queries in the browser are still treated as canonical discovery
- discovery mixes signet and mainnet records

### Best Practices

- projection keys should include edition as a first-class dimension
- prefer append-only rebuildable projections
- keep projection logic deterministic and backfillable

## Milestone 8: `web/` Integration

### Scope

- wire `web/` to real wallet funding and trade APIs
- store proofs locally
- expose clear edition context in the UI

### Deliverables

- portfolio top-ups in the active app
- buy/sell flows in USD
- creator builder flow with pending visibility and resume
- portfolio and activity views wired to real data
- environment banner or switcher
- `/portfolio` is the canonical self-custodied account route and `/wallet` is only a compatibility redirect at launch

### Success Gates

- a human can create a market, fund it, seed it, and trade it end to end in signet
- an agent can use the same authenticated/public APIs
- local proof state is namespaced by edition

### Failure Gates

- `web/` still depends on legacy `webapp/` code for launch-critical behavior
- signet and mainnet proofs can collide in browser storage

### Best Practices

- make the current edition impossible to miss in the UI
- keep proof import/export explicit and local
- never infer spendable balance from a server custody ledger

## Milestone 9: Signet Paper-Trading Exit Gate

### Scope

- prove the entire product loop in signet before mainnet rollout

### Required Scenario

1. User starts with `$0`
2. User creates a market
3. User sees it as creator-only pending
4. User paper-funds the portfolio balance
5. User seeds the market
6. First mint-authored `983` makes it public in the signet app
7. A second user or agent buys and sells against it
8. Activity, portfolio, and market views stay coherent

### Success Gates

- all eight steps work without manual DB edits
- restart recovery works for at least one interrupted top-up and one interrupted trade
- no mainnet systems are touched during signet testing

### Failure Gates

- paper trading requires hidden operator intervention
- edition boundaries are not operationally enforced
- proof portability or top-up flows are not recoverable after restart

## Milestone 10: Mainnet Launch Gate

### Scope

- deploy the same product shape on mainnet with real rails and real reserves

### Required Scenario

1. User funds wallet through Stripe or Lightning
2. User sees funds and positions through `/portfolio`
3. User creates and seeds a market
4. Market becomes public only after first `983`
5. Another user buys and sells successfully
6. Portfolio, market, activity, and funding flows remain coherent

### Success Gates

- all critical flows pass on production infrastructure
- monitoring and alerting are in place
- rollback and maintenance procedure is documented

### Failure Gates

- signet-only code paths leak into mainnet
- there is no operator playbook for provider outages or quote drift

## Cross-Cutting Best Practices

- prefer one codebase and environment-driven configuration over branching product logic
- keep proof issuance behind confirmed funding only
- use idempotency everywhere an external provider can retry
- separate paper and real-money environments at every storage and identity boundary
- persist raw provider payload references for auditability
- reject stale quotes aggressively
- keep local proof storage namespaced by edition and mint URL
- make every public market projection rebuildable from canonical sources
- add manual smoke scripts for signet and mainnet before every deploy
- keep the first implementation modular, not over-distributed

## Recommended Execution Order

1. Milestone 0
2. Milestones 1 and 2
3. Milestone 3
4. Milestone 4
5. Milestones 5 and 6
6. Milestone 7
7. Milestone 8
8. Milestone 9
9. Milestone 10
10. USDC addendum after launch-critical stability, or earlier only as a parallel non-blocking track

## Explicit Non-Goals For Initial Launch

- bank payout or fiat cash-out
- direct per-market deposit rails
- Spark as the canonical user wallet
- mixed signet/mainnet discovery
- making USDC a prerequisite for launch
