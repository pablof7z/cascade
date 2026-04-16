# Cascade Mint

This directory is the canonical documentation set for the Cascade mint layer.

Cascade uses a custom CDK Rust Cashu mint system with two logical roles:

- a **wallet mint** that issues USD ecash and accepts Stripe or Lightning funding
- a **market mint** that prices LONG and SHORT exposure with LMSR and publishes mint-authored trade records

The user-facing product is dollar-denominated. Lightning may appear behind the scenes as settlement plumbing, but it is not the normal product language.

## Core Invariants

- the mint is the authority for trade execution and exit pricing
- each market has exactly two keysets: one LONG keyset and one SHORT keyset
- only buys and exits against LMSR count as market activity
- NUT-03 swaps are token movement, not market trades
- trade events are mint-authored
- Live uses trade kind `983`; Practice uses trade kind `981`
- the optional `p` tag on a trade event is request attribution, not proof ownership

## Map

- [architecture.md](architecture.md) — mint shape, state authority, and trade lifecycle
- [api.md](api.md) — route inventory and machine interface contract
- [lmsr.md](lmsr.md) — pricing and solvency mechanics
- [auth.md](auth.md) — bearer-proof model and NIP-98 attribution
- [inter-mint-settlement.md](inter-mint-settlement.md) — hidden Lightning rail choreography

## Related Docs

- [../design/product-decisions.md](../design/product-decisions.md)
- [../technical/backend.md](../technical/backend.md)
- [../technical/frontend.md](../technical/frontend.md)
- [../technical/nostr-events.md](../technical/nostr-events.md)
- [../product/market-lifecycle.md](../product/market-lifecycle.md)
