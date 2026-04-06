# Cascade Cashu Mint — CDK Rust Plan Review Summary

**Reviewer**: Cascade Mint Engineer (mint-engineer)  
**Plan**: `.tenex/plans/cascade-mint-cdk-rust/` (7 files)  
**Date**: 2026-04-06  
**Status**: ✅ APPROVED FOR IMPLEMENTATION  

---

## Quick Assessment

| Category | Rating | Notes |
|----------|--------|-------|
| **Architecture Soundness** | ✅ STRONG | CDK composition correct, zero NUT reimplementation |
| **Multi-Keyset Design** | ✅ STRONG | Per-market keysets via CurrencyUnit::Custom() is elegant |
| **LMSR Implementation** | ✅ STRONG | Log-space math correct, cross-validation planned |
| **Lightning Integration** | ✅ GOOD | cdk-lnd usage appropriate, health check included |
| **Database Design** | ✅ GOOD | Schema clear, concurrency via WAL, sqlx verified |
| **Atomic Trades** | ⚠️ NEEDS CLARIFICATION | DB transaction semantics not fully detailed |
| **Testing Strategy** | ✅ GOOD | Unit, integration, mock Lightning, cross-validation |
| **Production Readiness** | ✅ GOOD | systemd, Nginx, monitoring, deployment checklist |

**Overall Verdict**: Ready to implement with 3 clarifications on trade atomicity, fee model, and proof serialization.

---

## Key Strengths

1. **Maximal CDK Leverage**: Using 5 purpose-built CDK crates (cdk, cdk-sqlite, cdk-signatory, cdk-axum, cdk-lnd) eliminates months of NUT protocol reimplementation. This is the correct architectural choice.

2. **Elegant Unit Isolation**: Per-market keysets via `CurrencyUnit::custom("LONG_{slug}", "SHORT_{slug}")` with deterministic BIP-32 derivation enables keyset recovery from seed without maintaining a registry.

3. **Clean HTTP Layering**: CDK's cdk-axum auto-wires all NUT endpoints; custom Cascade logic lives in `/v1/cascade/*`. Zero protocol conflicts.

4. **Comprehensive Testing**: Unit tests, integration tests, mock Lightning, cross-validation with TypeScript, smoke test checklist.

5. **Production Operations**: systemd service, Nginx reverse proxy, logging, monitoring, deployment instructions — all included.

---

## Important Clarifications Needed (Before Dev Starts)

### 1. Trade Atomicity — DB Transaction Semantics
**Issue**: Plan says "all within single DB transaction" but doesn't detail:
- Who marks proofs as spent? (CDK's method or custom SQL?)
- How does CDK's proof verification integrate with custom TradeExecutor?
- Concurrent trade race condition handling?

**Action**: During implementation, verify CDK Mint exposes public `verify_proofs()` and `spend_proofs()` methods. If not, custom verification needed.

**Risk**: IMPORTANT — affects correctness, not blocking architecture

### 2. Fee Model Clarity
**Issue**: Plan shows explicit fee calculation ("Apply fee" line 310) but also states "LMSR spread handles fees" (line 152). Contradiction.

**Action**: Clarify before dev starts:
- Are fees explicit sats deduction from user's input proofs?
- Or are fees embedded in LMSR price difference?
- Where is fee balance stored (reserve? separate account?)?

**Risk**: IMPORTANT — affects accounting and reserve tracking

### 3. Proof JSON Serialization
**Issue**: Plan uses `SerializedProof` and `SerializedBlindedMessage` types but exact JSON schema not specified.

**Action**: During HTTP API implementation, validate against @cashu/cashu-ts serialization format.

**Risk**: MINOR — will be caught in integration testing

---

## Minor Improvements (Not Blocking)

| Item | Concern | Recommendation |
|------|---------|-----------------|
| **sqlx compile-time verification** | Requires live SQLite during build | Document sqlx offline mode for CI builds |
| **Fee reserve handling** | How CDK calculates melt quote fee_reserve | Add integration test for fee calculation accuracy |
| **Keyset discovery UX** | Frontend must filter /v1/keysets by unit | Consider adding /v1/cascade/keysets/{slug} convenience endpoint |
| **LMSR at saturation** | Prices round to 0 sats at extreme imbalances | Document minimum trade size or validate b parameter |
| **No pruning strategy** | Archived markets bloat DB indefinitely | Document as future optimization |

---

## Feasibility & Effort Estimate

**Can experienced Rust engineer build this?** ✅ YES

**Effort breakdown**:
- Section 1 (Project Setup): 4 hours
- Section 2 (Core Mint): 16 hours
- Section 3 (LMSR + Trade): 24 hours
- Section 4 (HTTP API): 16 hours
- Section 5 (Lightning + DB): 12 hours
- Section 6 (Testing + Deployment): 20 hours
- **Total: ~92 hours (~2.3 engineer-weeks)**

**Critical path**: Sections 1 → 2 → 3 → 4 (sequential)
**Parallelizable**: Sections 5 & 6 can start after Section 2 completes

---

## What's Not in the Plan (And Why That's OK)

| Feature | Why Deferred |
|---------|--------------|
| **NUT-12 DLEQ proofs** | Trust-minimal verification nice-to-have; mint-side verification sufficient |
| **Per-user keysets** | Bearer tokens intentional; no identity binding for MVP |
| **Key rotation** | Single-seed model works initially; rotation adds complexity |
| **On-chain withdrawal** | Lightning-only for MVP |
| **Rate limiting** | Add when operational load data available |
| **Analytics dashboard** | Logs sufficient for MVP |

All documented as future work, not architectural gaps.

---

## Next Steps

**Before implementation kicks off**:
1. Resolve 3 clarifications (trade atomicity, fee model, proof serialization)
2. Validate CDK v0.7 API assumptions (verify_proofs, spend_proofs)
3. Confirm fee model with human-replica

**During implementation**:
1. Test frequently: `cargo test --workspace` after each section
2. Cross-validate LMSR: Run TypeScript test vectors through Rust immediately
3. Have MockLightning working by end of Section 5

**Pre-deployment**:
1. Run 12-step smoke test sequence
2. Concurrent trade load test
3. LND failover test
4. Database integrity check

---

## Detailed Review Document

Full technical review with all 8 dimensions of analysis available at:
`/Users/customer/.tenex/home/77b96fae/cascade-mint-cdk-rust-review.md` (23KB)

Includes:
- CDK architecture & composability analysis
- Multi-keyset design critique
- NUT compliance verification
- Lightning integration feasibility
- SQLite concurrency analysis
- LMSR math precision assessment
- Atomic trade execution patterns
- Testing strategy review
- 10 critical technical questions
- Implementation complexity estimate

---

**Sign-off**: ✅ Ready for implementation. Clarifications should be resolved before dev starts, but none block the architecture itself.
