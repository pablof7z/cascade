# Mint Deployment Strategy — Real Money Integration

## Context

Cascade is a prediction market platform built on Nostr and Cashu ecash. The current codebase has:

- **CDK Rust mint** at `/cdk-mintd/` — a full Cashu NUT-compliant mint (NUT-01 through NUT-17) with configurable Lightning backends (CLN, LND, LNbits, Strike, Phoenixd) and database options (redb, SQLite).
- **Cascade-specific mint logic** at `/cascade-mint/` — LMSR market maker, escrow account patterns (`EscrowAccount`), market resolution via kind 30078 Nostr events, and rake application during settlement.
- **Frontend wallet** — NIP-60 Cashu wallet integration via `@nostr-dev-kit/ndk-wallet`, with `WalletWidget.svelte` and `walletStore.ts` managing user-facing flows.
- **No production deployment configuration** — all current infrastructure is local development only. No Dockerfiles, no CI/CD, no monitoring, no key management strategy.

The platform monetizes via a **2% rake on winnings** (applied during settlement when winning positions pay out, not on deposits or trades). Moving from play-money to real money requires deploying a production Cashu mint backed by Lightning, which introduces custodial responsibility, operational costs, and regulatory considerations.

## Approach

**Strategy: Phased self-hosted deployment with Phoenixd as initial Lightning backend, graduating to full LND as volume grows.**

This approach balances three competing constraints:

1. **Minimize upfront cost** — Phoenixd requires minimal infrastructure (~$50-100/mo) vs. a full Lightning node ($200-500/mo), making it viable before revenue materializes.
2. **Maintain sovereignty** — Self-hosted mint keeps full control over keys, uptime, and fee structure, unlike third-party mints where Cascade has no control over availability or policy.
3. **Preserve upgrade path** — CDK's pluggable Lightning backend architecture means switching from Phoenixd to LND/CLN requires only config changes, not code rewrites.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Third-party mint (e.g., Minibits, LNbits hosted)** | No control over uptime, key management, or fee structure. Cascade's escrow/rake logic requires custom mint behavior that third-party mints don't support. |
| **Full LND node from day one** | $200-500/mo hosting + channel management overhead before any revenue. Premature optimization for a platform that hasn't proven market-product fit with real money yet. |
| **Strike API backend** | US-regulated, custodial, KYC built-in. Simplest operationally but creates hard dependency on a single company and limits international users. Could be a secondary backend later. |
| **No mint — pure Lightning** | Loses Cashu's offline/private trading capability. The LMSR market maker and escrow patterns are built around ecash token flows. |

## Section Overview

| Section | File | Contents |
|---|---|---|
| Infrastructure | `infrastructure.md` | Cloud hosting requirements, server specifications, networking, database selection |
| Lightning Backend | `lightning-backend.md` | Lightning backend options, selection criteria, Phoenixd → LND graduation path |
| Economics | `economics.md` | Cost structure, revenue model analysis, break-even calculations, liquidity management |
| Security & Keys | `security-keys.md` | Mint key management, backup strategy, HSM considerations, incident response |
| Deployment & Ops | `deployment-operations.md` | Deployment pipeline, monitoring, alerting, operational runbooks |
| Decisions | `decisions.md` | Critical pre-deployment decisions matrix with recommendations |

## Cross-Section Dependencies

Sections should be read and decided in this order:

1. **Decisions** (first) — Strategic choices that constrain all other sections
2. **Lightning Backend** — Backend choice determines infrastructure requirements
3. **Infrastructure** — Server specs depend on Lightning backend selection
4. **Security & Keys** — Key management depends on infrastructure choices
5. **Economics** — Cost model depends on infrastructure + Lightning choices
6. **Deployment & Ops** — Operational design depends on all above choices

## Verification

The plan is complete when:
- All critical decisions in `decisions.md` have been made by stakeholders
- Infrastructure can be provisioned based on `infrastructure.md` specs
- Lightning backend selection is finalized per `lightning-backend.md` criteria
- Key management procedures from `security-keys.md` are documented and tested
- Break-even thresholds from `economics.md` are validated against market projections
- Deployment pipeline from `deployment-operations.md` can execute a mint deployment end-to-end
