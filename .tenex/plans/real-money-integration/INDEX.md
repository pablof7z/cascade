# Phase 8 — Real Money Integration

## Context

Cascade is a prediction market platform built on Nostr (data layer) and Cashu (payment layer) with LMSR pricing. The current implementation has a working prototype with significant gaps before real money can flow.

### What Exists Today

**CDK Rust Mint (`cascade-mint/`)**
- `cascade-core/`: LMSR engine (`lmsr.rs`), trade execution (`trade.rs`), escrow accounts (`escrow.rs`), market management (`market.rs`, `market_manager.rs`)
- `cascade-api/`: HTTP handlers including `trade.rs` (~514 lines) with rake/fee logic
- `cascade-mint-bin/`: Binary entry point
- `config.toml.example`: LND connection config (host, cert, macaroon), SQLite database path, seed key, signet network, `trade_fee_percent = 1`
- `Dockerfile`: Multi-stage Rust build, debian runtime, port 8080
- `docker-compose.yml`: Mint + LND (v0.17.4-beta, signet/neutrino) + nostr-relay services

**Frontend**
- `WalletWidget.svelte`: Partial Cashu wallet integration
- NDK-based Nostr authentication
- No deposit/withdrawal flows implemented
- No NIP-60 wallet integration found

**Market Logic**
- Dual-keyset architecture: each market has `long_keyset_id` and `short_keyset_id`
- `MarketManager`: In-memory `HashMap` behind `Arc<RwLock>` — **no database persistence**
- Tracks `q_long`, `q_short`, `reserve_sats` per market
- `resolve_market(event_id, outcome: Side)` exists but settlement flow after resolution is unclear

### Critical Gaps

| Gap | Severity | Description |
|-----|----------|-------------|
| No persistence | **Critical** | `MarketManager` uses in-memory HashMap. Server restart = data loss |
| No Lightning client | **Critical** | Config stubs exist but no `lnd_client.rs` or gRPC connection code |
| No NUT-05 endpoints | **Critical** | Mint/melt quote endpoints for Lightning deposits/withdrawals missing |
| No trade history | **High** | No database tables for audit trail or trade records |
| Fee mismatch | **Medium** | Config says `trade_fee_percent = 1` but product decision is 2% rake |
| No settlement logic | **High** | Market resolution exists but token redemption/payout flow is incomplete |
| No monitoring | **Medium** | No health checks, alerting, or operational tooling |
| No backup/recovery | **Medium** | No procedures for seed backup, database recovery, or failover |

### Product Constraints

From `PRODUCT-DECISIONS.md`:
- **2% rake** on trades (platform revenue)
- **Cashu** for payments (ecash)
- **LMSR** for market pricing
- **Nostr** as data layer
- **Self-custody wallets** (NIP-60)

## Approach

### Strategy: Incremental Infrastructure Build

Build real money capability in layers, each independently testable:

1. **Foundation** — Persistence + Lightning client (no user-facing changes)
2. **Protocol** — NUT-05 mint/melt endpoints (deposit/withdraw via Lightning)
3. **Frontend** — Wallet UI with deposit/withdrawal flows
4. **Operations** — Monitoring, backup, fee reconciliation
5. **Rollout** — Testnet → limited mainnet → general availability

### Why This Approach

- **Incremental risk**: Each layer can be tested before the next begins. Persistence can be verified before Lightning is connected.
- **Existing CDK foundation**: The CDK Rust crate already implements most Cashu NUT specs. We extend rather than rewrite.
- **Dual-keyset architecture is sound**: The existing long/short keyset per market is the correct Cashu pattern for binary prediction markets.
- **NIP-60 for self-custody**: Users hold their own ecash in Nostr events, consistent with product decisions. The mint never custodies user funds long-term.

### Alternatives Considered

| Alternative | Rejected Because |
|-------------|-----------------|
| Third-party mint (e.g., Minibits, LNbits) | Loses control over dual-keyset market architecture; can't enforce escrow or rake at mint level |
| CLN instead of LND | docker-compose already configured for LND; CDK has LND support; switching adds risk without benefit |
| PostgreSQL instead of SQLite | Premature for single-server deployment; SQLite sufficient for MVP; migration path exists if needed |
| Custodial wallet (server holds balances) | Contradicts product decision for self-custody; increases regulatory exposure |

## Section Overview

| Section | File | Covers |
|---------|------|--------|
| Mint Deployment | [`mint-deployment.md`](./mint-deployment.md) | Persistence layer, database schema, CDK configuration, infrastructure costs, deployment |
| Lightning Integration | [`lightning-integration.md`](./lightning-integration.md) | LND client, NUT-05 mint/melt, channel management, fee structure, liquidity |
| Frontend Integration | [`frontend-integration.md`](./frontend-integration.md) | Wallet UI, deposit/withdrawal flows, NIP-60, balance display, trade UX |
| Risk & Compliance | [`risk-compliance.md`](./risk-compliance.md) | KYC, regulatory, fraud prevention, rate limiting, audit trail |
| Phased Rollout | [`phased-rollout.md`](./phased-rollout.md) | Testnet → mainnet migration, MVP scope, deployment phases, risk assessment |

## Cross-Section Dependencies

```
mint-deployment ──► lightning-integration ──► frontend-integration
       │                    │                        │
       └────────────────────┴────────────────────────┴──► phased-rollout
                                                          (depends on all)
       risk-compliance ◄──────────────────────────────────(informs all phases)
```

- **Mint deployment** must complete before Lightning integration (persistence required for quote tracking)
- **Lightning integration** must complete before frontend deposit/withdrawal flows
- **Risk & compliance** decisions inform all sections but don't block implementation
- **Phased rollout** depends on all other sections being implemented

## Questions for Pablo

These decisions cannot be resolved from the codebase alone:

1. **Fee structure**: Config says 1% but product decisions say 2% rake. Which is correct? Is the rake on every trade or only on profitable exits?
2. **Lightning node**: Self-run LND (as docker-compose suggests) or use a hosted solution like Voltage for reduced ops burden?
3. **Initial liquidity**: How much sats to seed Lightning channels for the mint? What's the expected trading volume for month 1?
4. **KYC threshold**: Any per-user or per-transaction limits before requiring identity verification?
5. **Geographic restrictions**: Any jurisdictions to explicitly block at launch?
6. **Insurance/reserve**: Should the mint hold a reserve beyond what's needed for active markets? What happens if there's a catastrophic loss (e.g., LND channel force-close during active markets)?
7. **Testnet duration**: How long to run on signet/testnet before switching to mainnet? Is there an external trigger (e.g., audit, user count)?
8. **Multi-mint**: Is there a future plan for federated mints or multiple mint instances, or is single-mint sufficient for foreseeable scale?
