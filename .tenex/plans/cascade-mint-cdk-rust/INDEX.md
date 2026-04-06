# Cascade Cashu Mint — CDK Rust Implementation

## Executive Summary

The Cascade prediction market platform requires a Cashu ecash mint that issues per-market bearer tokens representing long (YES) and short (NO) positions. The original TypeScript/Hono mint (deleted in commit d6bdb87) must be rebuilt from scratch using CDK (Cashu Development Kit) in Rust — a production-grade library that provides the full Cashu protocol stack including blind signing, proof verification, keyset management, SQLite persistence, Lightning integration, and a compliant HTTP server.

CDK's composable architecture (`cdk` core + `cdk-sqlite` + `cdk-lnd` + `cdk-axum` + `cdk-signatory`) eliminates the need to hand-implement NUT protocol compliance. The mint will extend CDK with Cascade-specific capabilities: per-market keyset generation using custom currency units (`LONG`/`SHORT`), an LMSR pricing engine for automated market-making, and custom trade endpoints for atomic position acquisition. The system deploys as a single Rust binary on a VPS behind a reverse proxy at `mint.f7z.io`.

The frontend (SvelteKit at `cascade.f7z.io`) uses `NDKCashuWallet` which internally delegates to `@cashu/cashu-ts` — this library handles all standard NUT HTTP endpoints automatically. The mint must be fully NUT-04/05/07/08 compliant (which CDK provides out of the box) and additionally expose Cascade-specific REST endpoints for market creation, trading, and resolution.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    cascade-mint binary                       │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              HTTP Layer (cdk-axum)                    │   │
│  │                                                       │   │
│  │  Standard NUT Endpoints        Custom Cascade Routes  │   │
│  │  ───────────────────          ─────────────────────── │   │
│  │  GET  /v1/info                POST /v1/cascade/market │   │
│  │  GET  /v1/keys                POST /v1/cascade/trade  │   │
│  │  GET  /v1/keysets             GET  /v1/cascade/price  │   │
│  │  POST /v1/mint/quote/bolt11   POST /v1/cascade/resolve│   │
│  │  POST /v1/mint/bolt11         GET  /v1/cascade/markets│   │
│  │  POST /v1/swap                                        │   │
│  │  POST /v1/checkstate                                  │   │
│  │  POST /v1/melt/quote/bolt11                           │   │
│  │  POST /v1/melt/bolt11                                 │   │
│  └───────────────┬───────────────────────┬───────────────┘   │
│                  │                       │                   │
│  ┌───────────────▼───────────┐  ┌───────▼───────────────┐   │
│  │      CDK Mint Core        │  │   Cascade Market Mgr   │   │
│  │                           │  │                         │   │
│  │  • Blind signing          │  │  • Market registry      │   │
│  │  • Proof verification     │  │  • LMSR pricing engine  │   │
│  │  • Keyset rotation        │  │  • Trade execution      │   │
│  │  • Token state machine    │  │  • Position tracking    │   │
│  │  • NUT compliance         │  │  • Resolution & payout  │   │
│  └─────────┬─────────────────┘  └─────────┬─────────────┘   │
│            │                              │                   │
│  ┌─────────▼──────────────────────────────▼─────────────┐   │
│  │              DbSignatory (cdk-signatory)               │   │
│  │                                                        │   │
│  │  BIP-32 derivation: m/129372'/0'/{unit_hash}'          │   │
│  │  Custom units: LONG_{slug}, SHORT_{slug}               │   │
│  │  Per-market deterministic keysets                       │   │
│  └────────────────────────┬──────────────────────────────┘   │
│                           │                                   │
│  ┌────────────────────────▼──────────────────────────────┐   │
│  │           MintSqliteDatabase (cdk-sqlite)              │   │
│  │                                                        │   │
│  │  CDK tables: keysets, proofs, signatures, quotes, ...  │   │
│  │  Cascade tables: markets, positions, trades, lmsr_state│   │
│  └────────────────────────┬──────────────────────────────┘   │
│                           │                                   │
│  ┌────────────────────────▼──────────────────────────────┐   │
│  │              LND Payment Backend (cdk-lnd)             │   │
│  │                                                        │   │
│  │  gRPC connection to LND node                           │   │
│  │  Invoice generation (NUT-04) / Payment (NUT-05)        │   │
│  │  Testnet-first configuration                           │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         ▲                                    ▲
         │ HTTPS (reverse proxy)              │ gRPC
         │                                    │
    ┌────┴────┐                         ┌─────┴─────┐
    │  Nginx  │                         │  LND Node │
    │  :443   │                         │  testnet  │
    │  mint.  │                         │  :10009   │
    │  f7z.io │                         └───────────┘
    └─────────┘
         ▲                          ┌───────────────────┐
         │ HTTPS                    │   Nostr Relays    │
    ┌────┴──────────┐              │  (kind 983 trade  │
    │   Frontend    │              │   events, signed   │
    │ cascade.f7z.io│              │   by mint pubkey)  │
    │ NDKCashuWallet│              └─────────▲──────────┘
    └───────────────┘                        │ WSS
                                             │
                                   NostrPublisher (background task)
                                   fires after each trade execution
```

## Approach

**Strategy: Maximally leverage CDK crates, extend only where Cascade-specific logic is needed.**

CDK provides production-grade implementations of the entire Cashu protocol stack. Rather than reimplementing NUT compliance, blind signing, or proof state management, we compose CDK's modular crates and add a thin Cascade layer on top:

1. **`cdk` core** — Mint struct with all NUT logic
2. **`cdk-sqlite`** — Full database persistence (keysets, proofs, quotes, signatures)
3. **`cdk-signatory`** — BIP-32 key derivation with custom unit support
4. **`cdk-axum`** — HTTP server with all standard NUT endpoints pre-wired
5. **`cdk-lnd`** — Lightning invoice generation and payment verification

What we build on top:
- **MarketManager** — Registry of prediction markets, maps market slugs to CDK keysets
- **LMSR Engine** — Log-Market Scoring Rule pricing (ported from `src/market.ts`)
- **Trade Executor** — Atomic trade endpoint that prices via LMSR and issues tokens
- **Custom Axum Routes** — `/v1/cascade/*` endpoints bolted onto the CDK HTTP server
- **Cascade SQLite Tables** — Additional tables for markets, positions, LMSR state
- **NostrPublisher** — Kind 983 trade event publishing to Nostr relays (mint-signed, anonymous, non-blocking)

**Alternatives Considered:**

| Alternative | Why Rejected |
|---|---|
| Build mint from scratch in Rust | CDK already implements all 29 NUTs — reimplementing is months of work for no benefit |
| Use `cdk-mintd` reference binary directly | Too opinionated — no extension points for custom units or LMSR |
| Keep TypeScript mint, just fix it | Non-negotiable decision: must be CDK Rust |
| Use PostgreSQL instead of SQLite | Over-engineered for single-binary VPS deployment; CDK has first-class SQLite support |
| Use CLN instead of LND | LND specified as non-negotiable; `cdk-lnd` exists as a ready-made crate |

## Section Overview

| # | File | Covers |
|---|---|---|
| 1 | [01-project-setup.md](./01-project-setup.md) | Cargo workspace, dependencies, directory structure, feature flags |
| 2 | [02-core-mint.md](./02-core-mint.md) | CDK Mint initialization, signatory setup, per-market keyset generation, custom units |
| 3 | [03-market-manager.md](./03-market-manager.md) | Market registry, LMSR pricing engine, trade execution, resolution |
| 4 | [04-http-api.md](./04-http-api.md) | Standard NUT endpoints (via cdk-axum), custom Cascade routes, request/response schemas |
| 5 | [05-lightning-db.md](./05-lightning-db.md) | LND integration, SQLite schema (CDK + Cascade tables), configuration |
| 6 | [06-testing-deployment.md](./06-testing-deployment.md) | Test strategy, build instructions, deployment, reverse proxy, frontend integration |
| 7 | [07-nostr-integration.md](./07-nostr-integration.md) | Kind 983 trade event publishing, NostrPublisher module, relay management, mint keypair derivation |

## Cross-Section Dependencies

```
01-project-setup ──► 02-core-mint ──► 03-market-manager ──► 04-http-api
                         │                    │                   │
                         ▼                    ▼                   ▼
                    05-lightning-db ◄──── (shared DB) ────► 06-testing-deployment
                                              │
                                              ▼
                                     07-nostr-integration
                                     (kind 983 trade events)
```

- **01 → 02**: Project structure must exist before implementing core mint
- **02 → 03**: Mint and signatory must be initialized before MarketManager can create keysets
- **02 → 05**: Mint initialization requires both database and Lightning backend
- **03 → 04**: Trade/market logic must exist before wiring HTTP endpoints
- **03 → 07**: Trade execution must exist before Nostr publishing can be wired in
- **04 → 06**: All endpoints must be defined before testing and deployment
- **05 is parallel with 03**: Database schema and Lightning can be set up independently of market logic, but both feed into 02's initialization
- **07 is parallel with 04/05/06**: Nostr integration only depends on trade.rs (section 03). Can be implemented in parallel with HTTP API, Lightning, and testing sections

## Key Design Decisions

### Per-Market Keysets via Custom Currency Units

CDK's `CurrencyUnit::Custom(String)` allows arbitrary unit names. For each market with slug `btc-100k`, we create two units:
- `CurrencyUnit::custom("LONG_btc-100k")` 
- `CurrencyUnit::custom("SHORT_btc-100k")`

CDK's `DbSignatory` uses `hashed_derivation_index()` which SHA-256 hashes the unit name to produce a deterministic derivation index. This means keysets are fully deterministic from `(seed, unit_name)` — no need for a separate keyset registry.

### LMSR Pricing Lives in Rust, Not Frontend

The LMSR pricing engine (`market.ts` functions) must be ported to Rust and live server-side. The mint is the sole authority on pricing — the frontend displays prices but the mint calculates them. This prevents price manipulation and ensures atomic execution.

### Standard NUT Endpoints + Custom Trade Endpoints

The standard Cashu NUT endpoints (`/v1/info`, `/v1/keys`, `/v1/mint/*`, `/v1/swap`, etc.) are served by `cdk-axum` unchanged. Custom Cascade endpoints (`/v1/cascade/*`) are added as additional Axum routes that call into `MarketManager` and `LmsrEngine`.

### Bearer Token Model

Position ownership is purely determined by token possession. There is no on-chain or database record of "who owns what" — if you hold valid LONG tokens for a market, you have a long position. Resolution pays out by allowing winning-side tokens to be melted for Lightning sats.
