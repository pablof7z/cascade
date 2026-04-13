# Cascade Mint

This directory is the canonical documentation set for the Cascade mint layer.

The mint layer is the financial core of the product. It is a custom CDK Rust Cashu system with two logical roles:

- a **wallet mint** that issues USD-denominated ecash and accepts Stripe and Lightning funding
- a **market mint** that prices LONG and SHORT market tokens with LMSR, tracks per-market state, settles buys and sells, and publishes mint-authored kind `983` trade events

The user-facing product is dollar-denominated. Lightning may still exist behind the scenes as the settlement rail between the wallet mint and the market mint, but it is not the normal product language.

## Core Invariants

- The mint layer is the authoritative execution layer for market trades.
- The wallet mint is the canonical source of USD ecash.
- Product and application APIs represent USD in integer minor units.
- Users can hold both USD proofs and market proofs directly in their wallets.
- Every market has exactly two keysets: one for LONG and one for SHORT.
- Only buys and sells against the LMSR curve count as market activity.
- NUT-03 swaps are token movement, not market trades, and do not produce kind `983`.
- Kind `983` is always authored by the market mint. The optional `p` tag is only present when the HTTP trade request was authenticated with NIP-98.

## Map

- [architecture.md](architecture.md) — logical components, settlement flow, state authority, and trade lifecycle
- [inter-mint-settlement.md](inter-mint-settlement.md) — exact quote model and low-level buy/sell composition over Lightning
- [api.md](api.md) — low-level mint contract and the higher-level machine interface needed by web and agents
- [lmsr.md](lmsr.md) — pricing math, reserve dynamics, and the market accounting unit
- [auth.md](auth.md) — Cashu bearer model, optional NIP-98 attribution, and `983` `p`-tag semantics

## Related Docs

- [../design/product-decisions.md](../design/product-decisions.md) — owner directives, including USD base-unit, funding rails, and Lightning bridge decisions
- [../technical/backend.md](../technical/backend.md) — deployment shape and service boundaries
- [../technical/frontend.md](../technical/frontend.md) — how `web/` presents the wallet and trade flows
- [../plan/usd-stablemint-stripe-implementation.md](../plan/usd-stablemint-stripe-implementation.md) — implementation roadmap for the stablemint, Lightning bridge, gateway, and web integration
- [../technical/nostr-events.md](../technical/nostr-events.md) — event kind inventory
- [../kind-983-trade-event.md](../kind-983-trade-event.md) — detailed kind `983` schema
- [../product/market-lifecycle.md](../product/market-lifecycle.md) — product-level market behavior

`docs/technical/mint.md` and `docs/technical/lmsr.md` remain only as compatibility pointers to this directory.
