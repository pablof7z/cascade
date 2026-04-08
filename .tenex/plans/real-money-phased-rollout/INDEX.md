# Real Money Phased Rollout Plan

## Context

Cascade is a prediction market platform built on Nostr (SvelteKit frontend) with a custom Cashu mint (`cascade-mint/`) written in Rust using CDK. The platform currently operates with play-money CAS tokens. The mint codebase already contains:

- **LMSR pricing engine** (`src/market.ts` on frontend, mirrored in mint core)
- **Lightning integration code** (`cascade-mint/crates/cascade-core/src/lightning/lnd_client.rs`, `invoice.rs`)
- **Escrow DB schema** (`cascade-mint/migrations/002_lightning_escrow.sql`)
- **Custom trade/redeem/settle endpoints** designed in the product spec
- **NIP-60 wallet UI** (`WalletBalance.svelte`, `BuySellPanel.svelte`)
- **Two-keyset-per-market architecture** (one keyset per outcome: LONG/SHORT)

However, critical infrastructure is missing:
- No KYC/KYB/AML, no terms of service, no privacy policy
- No CI/CD pipeline, no monitoring/alerting, no backup strategy
- No transaction limits, no geographic restrictions, no fraud detection
- Lightning code exists but is untested in production
- Custom mint has never processed real satoshis

The task is to define a phased rollout from play money to real satoshis, starting with a third-party mint to de-risk the critical path, then migrating to the custom self-hosted mint.

## Approach

**Strategy: Progressive De-risking via Three Phases**

The rollout uses a third-party mint (Nutshell or minibits.cash) as a stepping stone. This lets the frontend wallet integration, NIP-60 flows, and user experience be validated with real sats before the custom mint (with its complex LMSR + multi-keyset logic) bears any financial risk.

### Why third-party first?

1. **Isolates risk**: Frontend wallet bugs and UX issues are discovered before the custom mint holds funds
2. **Validates Cashu interop**: Proves the NIP-60/NIP-61 wallet stack works with standard mints
3. **Buys time for compliance**: Legal review can happen in parallel while users test with small amounts on a third-party mint
4. **Reduces blast radius**: A third-party mint bug loses only deposited sats; a custom mint bug could corrupt LMSR state AND lose sats

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| Skip to custom mint immediately | Too much simultaneous risk: untested LMSR + untested Lightning + untested wallet UX. A single bug could lose real money with no fallback. |
| Use Fedimint instead of Cashu | Cascade's architecture is deeply Cashu-native (CDK, keysets-per-market, NIP-60). Fedimint would require a full rewrite. |
| Stay play-money indefinitely | Defeats the product thesis. Real money creates real engagement and real signal in prediction markets. |
| Launch on testnet Lightning only | Testnet sats have no value, so user behavior doesn't reflect real usage. Useful for Phase 1 testing but not as a product. |

## Section Overview

| Section File | Content |
|---|---|
| [phase-0-third-party-mint.md](./phase-0-third-party-mint.md) | Phase 0: Third-party mint integration for wallet validation and initial real-sat flow |
| [phase-1-custom-mint-testnet.md](./phase-1-custom-mint-testnet.md) | Phase 1: Custom cascade-mint on testnet Lightning with LMSR validation |
| [phase-2-mainnet-mvp.md](./phase-2-mainnet-mvp.md) | Phase 2: Mainnet MVP with custom mint, real sats, and operational guardrails |
| [blast-radius-analysis.md](./blast-radius-analysis.md) | Blast radius analysis: failure modes, fund exposure, mitigation, and recovery |

## Cross-Section Dependencies

```
Phase 0 (Third-Party Mint)
  ├── Frontend wallet integration validated → feeds into Phase 1 & 2
  ├── NIP-60 flow proven → required before Phase 2
  └── Compliance workstream started → must complete before Phase 2 mainnet
  
Phase 1 (Custom Mint Testnet)
  ├── LMSR + multi-keyset validated → required for Phase 2
  ├── Lightning on/off-ramp tested → required for Phase 2
  └── Monitoring + alerting operational → required for Phase 2
  
Phase 2 (Mainnet MVP)
  └── Depends on ALL Phase 0 + Phase 1 gates passing
```

**Gate model**: Each phase has explicit go/no-go criteria. No phase begins until the prior phase's gates are met.

## Verification

Overall plan success is verified by:
1. Phase 0 gate: Users can deposit/withdraw real sats via third-party mint, wallet UI works end-to-end
2. Phase 1 gate: Custom mint passes all Cashu compliance tests, LMSR pricing matches frontend, Lightning invoices settle on testnet
3. Phase 2 gate: Mainnet MVP with ≤100 users, ≤1M sats total exposure, full monitoring, documented incident response
4. Blast radius at every phase is bounded and documented (see blast-radius-analysis.md)
