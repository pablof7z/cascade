# Cashu Mint Deployment Strategy v2

**Owner**: Cascade Mint Engineer (mint-engineer)
**Target**: Vercel at `cascade-mint.f7z.io`
**Date**: 2026-04-05
**Status**: v2 — Corrected market mechanics

---

## Executive Summary

This document outlines the strategy to deploy a specialized Cashu mint on Vercel for Cascade's prediction market platform. The mint implements:
- LMSR (Logarithmic Market Scoring Rule) for efficient market-making
- Pure bearer tokens (NIP-60) — no escrow, no accounts
- 2 keysets per market (YES/NO) — no CANCEL, no general-purpose keyset
- NUT-05 Lightning integration for deposits/withdrawals
- Continuous trading — markets do NOT resolve

**Key correction from v1**: Users hold cryptographic proofs (tokens), NOT balances in escrow accounts. Ownership IS the proof.

---

## 1. Architecture Overview

### 1.1 Deployment Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Runtime | Node.js 20+ | TypeScript with CDK via `@cashu/cashu-ts` |
| Framework | Hono.js | Lightweight, portable |
| Hosting | Vercel Serverless Functions | Edge-compatible where possible |
| Database | Nostr relay + Turso SQLite | Keyset state + market events |
| Lightning | NUT-05 LSP integration | Deposit/withdraw via Lightning |

**WASM Feasibility Note**: `cashu-cdk` does not ship WASM bindings in the standard npm package. For Phase 1, we use `@cashu/cashu-ts` (pure TypeScript) which provides all necessary mint operations. If WASM becomes available from the Cashu team, we can migrate later.

### 1.2 Keyset Architecture

```
Per-market keysets (no mint-primary, no CANCEL):
├── keyset-{slug}-yes (YES shares)
└── keyset-{slug}-no (NO shares)
```

Each prediction market gets exactly 2 keysets:
- Users BUY shares → receive tokens from market-specific keyset
- Users SELL shares → return tokens → receive sats via Lightning melt (NUT-05)
- No `keyset-cancel` — markets do not have cancellation outcomes
- No `mint-primary` — tokens are market-specific, not general-purpose

---

## 2. Implementation Phases

### Phase 1: Foundation (This Week)
- [ ] Set up Hono.js project with TypeScript
- [ ] Integrate `@cashu/cashu-ts` for mint operations
- [ ] Configure per-market 2-keyset architecture (YES/NO only)
- [ ] Implement basic mint API (mint, melt, check)
- [ ] Add Nostr event persistence for keyset state
- [ ] Write unit tests for core mint operations

### Phase 2: Lightning Integration (Week 2)
- [ ] Integrate NUT-05 LSP client
- [ ] Implement deposit flow (Lightning → mint tokens, NUT-04)
- [ ] Implement withdraw flow (mint tokens → Lightning, NUT-05 melt)
- [ ] Handle Lightning failures gracefully

### Phase 3: LMSR Integration (Week 3)
- [ ] Implement LMSR math for share pricing
- [ ] Connect LMSR pricing to keyset minting (cost calculation)
- [ ] Add share selling with LMSR value calculation
- [ ] Apply 1% fee via LMSR spread (product spec requirement)
- [ ] Stress test concurrent trades

### Phase 4: Production Hardening (Week 4)
- [ ] Set up monitoring and alerting
- [ ] Configure Vercel environment variables
- [ ] Add rate limiting and DDoS protection
- [ ] Implement backup/restore for Turso SQLite
- [ ] Security audit and penetration testing

---

## 3. Technical Decisions

### 3.1 Why `@cashu/cashu-ts` (Not CDK Rust)?

**Phase 1 Decision**: Use `@cashu/cashu-ts` (pure TypeScript) instead of CDK Rust.

Rationale:
- `cashu-cdk` does not currently ship WASM bindings in its npm package
- TypeScript SDK provides all mint operations: `mint`, `melt`, `check`, `checkSpend`, `split`, `join`
- Simpler deployment on Vercel (no WASM compatibility concerns)
- Easier debugging and logging

**Future Migration**: If `cashu-cdk` releases official WASM bindings, we can migrate. The LMSR math (a separate concern) can be implemented in TypeScript directly.

### 3.2 Why Hono over Express?

- **Edge-compatible**: Hono works on Cloudflare Workers, Vercel Edge, Lambda
- **Lightweight**: 14KB vs Express's 700KB+
- **TypeScript-first**: Native TS support, excellent types
- **Flexible**: Easy to swap adapters if we change hosts

### 3.3 Database Strategy

**Database**: Turso SQLite (NOT plain SQLite)

**Why Turso?**: Vercel serverless functions are ephemeral — plain SQLite won't persist between invocations. Turso provides:
- SQLite-compatible edge database
- Edge replicas for low-latency reads
- Automatic sync to primary

```
┌─────────────────────────────────────────┐
│              Nostr Relay                │
│  (Market events, pubkeys, signatures)   │
└─────────────────────────────────────────┘
         ▲
         │ persist
         ▼
┌─────────────────────────────────────────┐
│           Turso SQLite                  │
│  (Keyset state, proofs, reserve logs)   │
└─────────────────────────────────────────┘
```

- **Nostr**: Source of truth for market events and creator pubkeys
- **Turso SQLite**: Fast edge storage for mint state (proofs, keysets)
- **Reserve field**: Tracks LMSR liquidity pool backing, NOT escrow balances

**Critical correction**: The `reserve` field in market state tracks how many sats back the LMSR liquidity pool. It does NOT represent user funds in escrow.

### 3.4 Keyset Design

Each prediction market gets:
1. Unique `keyset-id` derived from market slug
2. Two keysets: `keyset-{slug}-yes` and `keyset-{slug}-no`
3. Shares minted as blinded tokens from respective keysets

```typescript
interface MarketKeyset {
  marketSlug: string;
  yesKeysetId: string;
  noKeysetId: string;
  reserve: bigint; // LMSR liquidity pool backing (NOT escrow)
  totalYesShares: bigint;
  totalNoShares: bigint;
  lmsrCoefficient: bigint; // b parameter
}
```

---

## 4. Trade Flows

### 4.1 Buy Flow (NUT-04)

```
User                    Mint                      Lightning
 │                       │                           │
 │  Want to BUY Y YES    │                           │
 │  shares               │                           │
 │ ────────────────────► │                           │
 │                       │                           │
 │                       │  Calculate LMSR cost      │
 │                       │  (Y shares × price + 1%)  │
 │                       │ ─────────────────────────►│
 │                       │  Create invoice           │
 │                       │ ◄──────────────────────── │
 │                       │                           │
 │  Pay invoice          │                           │
 │ ◄─────────────────── │                           │
 │                       │                           │
 │                       │  Verify payment            │
 │                       │ ─────────────────────────►│
 │                       │  Payment confirmed        │
 │                       │ ◄──────────────────────── │
 │                       │                           │
 │  Receive Y YES tokens │                           │
 │  from market keyset    │                           │
 │ ◄─────────────────────│                           │
 │                       │                           │
 │  Store in NIP-60      │                           │
 │  wallet               │                           │
```

**Steps**:
1. User requests to buy Y shares of YES or NO
2. Mint calculates LMSR cost: `cost = Y × current_price × 1.01` (1% fee in spread)
3. Mint creates Lightning invoice for the cost
4. User pays via Lightning
5. Mint verifies payment (NUT-04)
6. Mint issues Y tokens from market-specific keyset
7. User stores tokens in NIP-60 wallet

### 4.2 Sell Flow (NUT-05)

```
User                    Mint                      Lightning
 │                       │                           │
 │  Present Y YES tokens │                           │
 │  to sell              │                           │
 │ ────────────────────► │                           │
 │                       │                           │
 │                       │  Verify proofs valid      │
 │                       │  Check not double-spent    │
 │                       │                           │
 │                       │  Calculate LMSR value     │
 │                       │  (Y shares × price - 1%)   │
 │                       │                           │
 │                       │  Create payout invoice     │
 │                       │ ─────────────────────────►│
 │                       │  Invoice created           │
 │                       │ ◄──────────────────────── │
 │                       │                           │
 │                       │  Burn tokens (melt)        │
 │                       │                           │
 │  Receive sats via     │                           │
 │  Lightning melt       │                           │
 │ ◄─────────────────────│                           │
```

**Steps**:
1. User presents tokens (proofs) to sell
2. Mint verifies proofs are valid and not double-spent
3. Mint calculates LMSR value: `value = Y × current_price × 0.99` (1% fee in spread)
4. Mint creates Lightning invoice for the value
5. Mint burns tokens via NUT-05 melt operation
6. User receives sats via Lightning

### 4.3 Winning on Cascade

**Correction**: There is NO resolution, NO payout, NO oracle trigger.

**Winning = selling position at higher price than bought**:

1. User buys YES at 0.40 (cost: 40 sats per share)
2. Market probability shifts → YES now trades at 0.70
3. User sells YES at 0.70 (receives: 70 sats per share)
4. **Profit: 30 sats per share** — no resolution required

Markets trade continuously. Price IS the probability. Users realize P&L by trading in and out.

---

## 5. API Endpoints

### 5.1 Mint Endpoints (Standard NUT-07)

```
POST /mint
  Body: { amount: number, keyset_id?: string }
  Response: { pr: string, hash: string } // Lightning invoice

POST /mint/bolt11
  Body: { pr: string } // BOLT11 invoice
  Response: { promises: BlindedSignature[] }

POST /melt
  Body: { pr: string, proofs: Proof[] }
  Response: { paid: boolean, preimage?: string }

GET /keysets
  Response: { keysets: string[] }

GET /keys/{keyset_id}
  Response: { pubkey: string, valid_from: number }
```

### 5.2 Market Trade Endpoints

```
POST /market/{slug}/create
  Body: { slug: string, title: string, b: bigint, mint: string }
  Response: { yesKeysetId: string, noKeysetId: string }

POST /market/{slug}/buy
  Body: { side: 'yes' | 'no', amount: number, invoice: string }
  Response: { proofs: Proof[], change?: Proof[] }
  Note: Cost calculated via LMSR, 1% fee included in price

POST /market/{slug}/sell
  Body: { side: 'yes' | 'no', proofs: Proof[] }
  Response: { pr: string, preimage?: string }
  Note: Value calculated via LMSR, 1% fee deducted from price
```

### 5.3 NO Resolution Endpoint

**Removed**: `POST /market/{slug}/resolve`

Cascade markets do NOT resolve. Markets trade continuously. Users exit positions by selling shares.

### 5.4 Admin Endpoints

```
GET /admin/markets
  Response: { markets: MarketState[] }

GET /admin/reserve/{slug}
  Response: { reserve: number, totalShares: number }
  Note: Shows LMSR liquidity pool backing, NOT escrow

POST /admin/backup
  Response: { backupId: string, downloadUrl: string }
```

---

## 6. Security Considerations

### 6.1 Key Management
- Private keys stored in Vercel environment variables (encrypted at rest)
- Key rotation schedule: quarterly
- Multi-sig for large operations if needed

### 6.2 Proof Validation
- All proofs validated against keyset public keys
- Double-spend detection via Turso proof registry
- DLEQ proofs verified on mint

### 6.3 Rate Limiting
- Mint: 100 requests/minute per IP
- Melt: 50 requests/minute per IP
- Market operations: 20 requests/minute per pubkey

### 6.4 Lightning Security
- Invoice expiry: 15 minutes max
- HTLC timeout: 40 blocks
- Automatic refund for stuck payments

---

## 7. Monitoring & Observability

### 7.1 Metrics
- Mint operations per minute
- Active proofs count
- Reserve by market (LMSR liquidity, NOT escrow)
- Lightning payment success rate
- Keyset rotation status

### 7.2 Alerts
- Reserve < 10% of theoretical minimum for LMSR backing
- >5% proof rejections
- Lightning payment failures > 2%
- Unusual mint volume patterns

### 7.3 Logging
- All mint/melt operations logged with pubkey hash
- Market creation events
- Lightning webhook events
- Error stack traces (sanitized)

---

## 8. Testing Strategy

### 8.1 Unit Tests
- LMSR math correctness
- Keyset derivation
- Proof serialization
- DLEQ verification

### 8.2 Integration Tests
- Full mint → melt cycle
- Lightning deposit/withdraw
- Per-market keyset isolation
- Buy/sell P&L calculation

### 8.3 Load Tests
- 1000 concurrent mint requests
- 100 concurrent market trades
- Lightning payment throughput

---

## 9. Rollout Plan

### Week 1: Alpha
- Deploy to `mint-alpha.cascade-mint.f7z.io`
- Invite-only testing with 10 internal users
- Monitor closely, fix bugs rapidly

### Week 2: Beta
- Open to all Cascade users
- Limit to small amounts (<1000 sats per trade)
- Collect feedback, iterate

### Week 3: Production Soft Launch
- Full amounts allowed
- Marketing: "Beta" label
- Support channel active

### Week 4: GA
- Remove "Beta" label
- SLA: 99.5% uptime
- Full support and documentation

---

## 10. Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Vercel cold starts | Medium | Medium | Keep functions warm, edge caching |
| Lightning failures | Low | High | Auto-refund, retry queue |
| Key compromise | Very Low | Critical | HSM, key rotation, monitoring |
| Nostr relay downtime | Low | Low | Turso backup |
| LMSR math bug | Low | High | Audit, fuzzing, testnet first |
| Turso sync issues | Low | Medium | Local cache, retry logic |

---

## 11. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @cashu/cashu-ts | ^0.10.0 | TypeScript mint SDK |
| hono | ^4.0.0 | Web framework |
| @libsql/client | ^0.6.0 | Turso SQLite client |
| nostr-tools | ^1.20.0 | Nostr event handling |
| ln-telegram | (custom) | Lightning LSP client |

---

## 12. Open Questions (v2 Status)

| Question | Status |
|----------|--------|
| Liquidity funding | Who seeds the initial LMSR reserve? Cascade treasury. |
| Fee structure | 1% per trade, embedded in LMSR spread (product spec). |
| Keyset migration | If we need to rotate keysets, how to handle existing proofs? |
| Multi-mint support | Should users be able to use external mints? Phase 1: Cascade-only. |
| Disaster recovery | What's the RTO/RPO for mint state loss? |

---

## 13. Corrections Applied (v1 → v2)

| # | Correction | Change |
|---|-------------|--------|
| 1 | NO ESCROW | Removed all 15+ escrow references. Users hold tokens, not balances. |
| 2 | NO RESOLUTION | Removed resolve endpoint, Phase 3 resolution logic, CANCEL keyset. |
| 3 | Keyset Architecture | 2 keysets per market only. No mint-primary, no CANCEL. |
| 4 | Fee Structure | 1% per trade, applied via LMSR spread. |
| 5 | WASM Feasibility | Default to `@cashu/cashu-ts` for Phase 1. |
| 6 | SQLite on Vercel | Replaced with Turso SQLite for edge persistence. |
| 7 | Trade Flow | Documented correct NUT-04 buy / NUT-05 sell flows. |

---

*Document Version: 2.0*
*Last Updated: 2026-04-05*
