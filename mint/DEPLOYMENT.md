# Cascade Mint Deployment Guide

## Overview

This document describes how to run the Cascade mint layer in a production-friendly way.

Cascade is not a generic Cashu deployment. The target architecture has two logical mint roles:

- a **wallet mint** that issues USD ecash and accepts Stripe and Lightning-funded top-ups
- a **market mint** that executes LMSR trades and issues LONG/SHORT market tokens

The current codebase is still migrating toward that full target. Use this file together with:

- [`../docs/mint/architecture.md`](../docs/mint/architecture.md)
- [`../docs/mint/api.md`](../docs/mint/api.md)
- [`../docs/plan/usd-stablemint-stripe-implementation.md`](../docs/plan/usd-stablemint-stripe-implementation.md)
- [`../docs/plan/end-to-end-launch-implementation.md`](../docs/plan/end-to-end-launch-implementation.md)
- [`../docs/plan/usdc-wallet-rail-addendum.md`](../docs/plan/usdc-wallet-rail-addendum.md)

## Current Production Shape

The live deployment on this machine uses:

- a long-running supervised mint process
- Caddy as the TLS terminator and reverse proxy
- SQLite for active persistent storage
- a Lightning backend for settlement

On macOS the current process supervisor is `launchd`. On Linux, the equivalent should be `systemd`.

## Logical Service Topology

```text
Caddy / TLS
  -> Cascade product API / coordinator
  -> wallet mint (USD, Stripe + Lightning top-ups)
  -> market mint (LMSR, LONG/SHORT keysets)
  -> FX quote source
  -> SQLite
  -> Lightning backend
  -> Stripe webhook handler
  -> Nostr publisher
```

The user-facing product should be dollar-denominated even when Lightning is used behind the scenes as the inter-mint settlement rail.

## Edition Split

Deployment should assume two editions:

- `mainnet` for real-money trading
- `signet` for paper trading

Recommended practice:

- separate process instances
- separate config files
- separate databases
- separate mint seeds and Nostr publisher keys
- separate Lightning backends
- separate Stripe mode and webhook endpoints
- separate hostnames or at minimum separate environment routing

Do not let proofs, reserves, or public discovery projections mix across editions.

## Prerequisites

### Required

- Rust toolchain with `cargo`
- SQLite
- Caddy or equivalent reverse proxy
- a Lightning backend
- persistent writable storage for mint data

### Required For Launch Wallet Funding

- Stripe account and webhook configuration
- wallet-mint payment processor or gateway integration for Stripe
- wallet-mint incoming Lightning quote support with locked `USD <-> msat` pricing

### Optional

- Nostr relay access for kind `983` publishing
- monitoring / metrics collection

## Runtime Configuration

The current code reads from `config.toml` and related runtime configuration under `mint/`.

Configuration categories include:

- mint URL and bind address
- database path
- seed / signing material
- Lightning backend connection
- network selection
- trade fees

As the USD wallet mint and Stripe gateway land, configuration will also need:

- Stripe API credentials
- Stripe webhook secret
- FX source configuration for `USD <-> msat` quoting
- wallet-mint funding limits and risk controls
- any coordinator-specific routing between wallet and market mint roles
- edition-specific local proof namespace and relay/projection inputs

## Reverse Proxy

Caddy should terminate TLS and proxy the mint layer to a local bind address.

At minimum the proxy should:

- serve the public mint hostname
- forward standard HTTP headers
- support WebSocket upgrade if required by mint subscriptions
- keep the product hostname stable even if the local bind port changes

## Process Supervision

The mint process must survive restarts.

Acceptable production patterns:

- `launchd` on macOS
- `systemd` on Linux
- container orchestration with equivalent restart guarantees

The important requirement is that mint state is persisted and the process restarts automatically after reboot or crash.

### Local macOS Templates

This repository now includes launchd templates for both editions under `mint/deploy/macos/`:

- `io.f7z.cascade-mint-signet.plist`
- `io.f7z.cascade-mint-mainnet.plist`

The shared runner is:

```bash
./scripts/run-edition.sh signet
./scripts/run-edition.sh mainnet
```

The signet runtime config used on this machine lives at:

- `mint/data/signet/config.toml`

Template configs for both editions live at:

- `mint/config.signet.toml.example`
- `mint/config.mainnet.toml.example`

## Storage

SQLite is the active persistent store today.

Persist at least:

- keysets
- proofs / spent-proof state
- market state
- trade history
- payment quote state
- FX quote state
- Stripe top-up state once the gateway lands
- Lightning top-up quote state

Back up the database and seed material before upgrades.

## Networking

Typical public exposure:

- `mint.f7z.io` (or equivalent mint hostname) behind Caddy

Typical edition split:

- mainnet mint hostname
- signet mint hostname
- separate app hostnames or Vercel projects for mainnet and paper trading

Typical private dependencies:

- SQLite file path on local disk
- Lightning backend on local or private network
- Stripe webhook ingress

## Smoke Checks

After deployment, verify at least:

```bash
curl -sS https://mint.f7z.io/v1/info
curl -sS https://mint.f7z.io/health
```

For the local signet edition on this machine:

```bash
./scripts/smoke-edition.sh signet
```

For market-scoped key discovery, verify:

```bash
curl -sS https://mint.f7z.io/<event_id>/v1/keys
```

As the wallet mint lands, also verify:

- Stripe webhook delivery
- Lightning top-up creation and completion
- wallet top-up creation and completion
- buy flow from USD wallet value into market tokens
- sell flow from market tokens back into USD wallet value
- signet paper-funding path
- edition boundaries between signet and mainnet

## Operational Notes

- Card payments are reversible; bearer ecash is not. Add explicit top-up risk controls.
- Do not expose sats or Lightning concepts in the normal product UI.
- Treat the older sat-oriented route set as migration debt, not the final deployment contract.

## Migration Note

This repository previously documented a sat-first mint with outdated naming and payout language. That is no longer the target architecture.

The canonical implementation roadmap is now [`../docs/plan/usd-stablemint-stripe-implementation.md`](../docs/plan/usd-stablemint-stripe-implementation.md).
