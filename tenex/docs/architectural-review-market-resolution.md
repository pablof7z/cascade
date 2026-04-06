# Architectural Review: Market Resolution Mechanism Plan

**Reviewer:** Architect-Orchestrator  
**Date:** 2026-04-06  
**Plan Reviewed:** `.tenex/plans/market-resolution/` (6 sections: INDEX, nostr-event-design, payout-logic, service-layer, testing, ui-flow)

---

## Executive Summary

The plan is **structurally sound with 4 Blocking Issues, 5 Important Issues, and 3 Minor Issues** that must be addressed before implementation. The plan correctly identifies existing infrastructure and proposes a clean bridge pattern. The core architectural decision to wire kind:984 into the existing resolutionService is sound. However, there are critical gaps in vault atomicity, queue idempotency, and Cashu failure handling that create real fund-safety risks.

**Overall Assessment:** ⚠️ Proceed with modifications — address all blocking issues first.

---

## 0. Plan Accuracy Verification

All plan claims about existing infrastructure were verified against the actual codebase:

| Claim | Status | Evidence |
|-------|--------|----------|
| Market type needs `resolutionEventId` | ✅ Confirmed | `src/market.ts` has status/outcome/resolvedAt but no resolutionEventId |
| resolutionService has `resolveMarket(market, outcome, outcomePrice)` | ✅ Confirmed | `src/services/resolutionService.ts` lines 139-142 |
| resolutionService has `computeWinnerPayouts(positions, outcome, outcomePrice)` | ✅ Confirmed | `src/services/resolutionService.ts` lines 115-131 |
| resolutionQueue FIFO mechanism exists | ✅ Confirmed | `src/resolutionQueue.ts` — `_tail` promise chain, `setResolutionRunner` |
| vaultStore has `sendPayoutTokens(amount, pubkey)` | ✅ Confirmed | `src/vaultStore.ts` lines 74-81 |
| 2% platform rake (RAKE_FRACTION = 0.02) | ✅ Confirmed | `src/services/resolutionService.ts` line 30 |
| localStorage TX log | ✅ Confirmed | `src/services/resolutionService.ts` — `appendTxEntry`, `updateTxEntry` |
| kind:30079 payout events | ✅ Confirmed | `src/services/nostrService.ts` line 549 |
| kind 984 documented in nostr-kinds.md | ✅ Confirmed | `tenex/docs/nostr-kinds.md` lines 87-107 |

**The plan is accurate in all its claims about existing infrastructure.**

---

## 1. Architectural Soundness (Bridge Pattern)

### ✅ Bridge Pattern Is Correct

The plan correctly proposes wiring kind:984 → `resolutionService.resolveMarket()` into the existing pipeline:

```
kind:984 event → publishResolutionEvent() → resolveMarket() → queue → _executeResolution()
                                                                                  ├── computeWinnerPayouts()
                                                                                  ├── getVaultBalance() [pre-check]
                                                                                  ├── log TX entries [pending]
                                                                                  ├── sendPayoutTokens() loop
                                                                                  └── publishPayoutEvent() loop
```

This correctly reuses all existing infrastructure: the FIFO queue, payout computation, vault check, TX log, and kind:30079 events.

### ✅ Idempotency via Transaction Log Is Sound

The plan correctly proposes logging `{ type: 'resolution', marketId, outcome, resolutionEventId, timestamp }` to localStorage. The existing resolutionService already uses a transaction log with `id = txEntryId(market.slug, w.position.id)` for per-winner entries. Extending this to resolution-level entries is the right approach.

### ⚠️ Important: `publishResolutionEvent` Is New — Must Be Implemented

`nostrService.ts` currently has NO `publishResolutionEvent` function. The plan correctly identifies this as a new addition. The implementation must:
- Define `RESOLUTION_EVENT_KIND = 984` constant
- Build the event with `['e', marketEventId]`, `['resolution', outcome]`, `['resolved_at', unixTs]`, `['oracle', pubkey]` tags
- Content: resolution rationale string
- Sign and publish via NDK

---

## 2. State Management

### ✅ Market Type Additions Are Correct

The plan correctly identifies adding `resolutionEventId: string` — canonical link to the kind:984 event. The existing `status`, `resolutionOutcome`, and `resolvedAt` fields already exist.

### ⚠️ Important: Position `settled` Flag Not Updated

The `Position` type has a `settled?: boolean` field, but `_executeResolution()` does NOT set `position.settled = true` after payout. The TX log (per-position IDs) provides a mitigation, but explicit `position.settled = true` tracking would be clearer defense-in-depth.

### ⚠️ Important: `outcomePrice` Has No Validation

`resolveMarket(market, outcome, outcomePrice)` accepts any number for `outcomePrice`. For YES/NO binary markets, only 0.0 and 1.0 are valid. The plan assumes `outcomePrice = 1.0` but provides no runtime validation. A misconfiguration could halve all payouts.

---

## 3. Nostr Integration (Kind 984)

### ✅ Non-Replaceable Design Is Correct

Kind 984 is correctly specified as non-replaceable (immutable). Resolution is a one-time, irreversible event — non-replaceable ensures all clients converge on the same resolution.

### ✅ Tag Schema Matches Nostr Spec

The plan's tag schema matches `nostr-kinds.md` exactly.

### ⚠️ Important: NIP-09 Deletion Not Addressed

If a market creator publishes a kind:5 (deletion) event for their market, kind:984 and kind:30079 events remain on relays as orphaned events. The plan should add handling: when a market is deleted, resolution/payout events should be locally flagged as orphaned.

### ⚠️ Important: `getResolutionEvent()` Needs Persistence Path

The plan proposes `getResolutionEvent(marketId)` for non-creator clients, but there's no local persistence path for kind:984 events. **Recommendation:** Add a `cachedResolutionEvents` Map backed by localStorage.

---

## 4. Service Layer Organization

### ✅ Responsibilities Are Clean

| Service | Responsibility | Verdict |
|---------|---------------|---------|
| `nostrService.ts` | Nostr event pub/sub, kind:30079 payout events | ✅ Correct |
| `marketService.ts` | Market CRUD, fetch by slug, kind:982 subscription | ✅ Correct |
| `resolutionService.ts` | Resolution pipeline, payout computation, vault interaction | ✅ Correct |
| `vaultStore.ts` | Vault wallet operations | ✅ Correct |

---

## 5. Cashu Integration (Vault & Payouts)

### 🔴 BLOCKING: Vault Race Condition (Non-Atomic Check-Then-Send)

**The most critical issue.** The vault pre-check pattern has a TOCTOU race:

```typescript
// Step A: Check balance (snapshot)
const vaultBalance = await getVaultBalance()
if (vaultBalance < totalObligation) { return error }

// [GAP] — other code could deplete vault between A and B

// Step B: Send tokens
for (const winner of winners) {
  token = await sendPayoutTokens(winner.netSats, recipientId)
}
```

**Severity:** HIGH — could result in partial payout failures and vault overdraft.  
**Recommendation:** Implement per-market reserve tracking in `vaultStore` with `reserveForMarket(marketId, sats)` / `releaseReserve(marketId, sats)`, or use atomic send-with-verification.

### 🔴 BLOCKING: Queue Lacks Deduplication

`enqueueResolution()` has no per-market deduplication. Rapid double-click queues the same market twice — both jobs pass the `status === 'resolved'` check.  
**Recommendation:** Track pending market IDs in a `Set<string>` in `resolutionQueue.ts`.

### 🔴 BLOCKING: Partial Payout State Undefined

After `{ success: false, error: { kind: 'payout_partial' } }`, the plan doesn't specify market status.  
**Recommendation:** Market remains 'active' until ALL payouts succeed. Retry flow detects pending TX entries and resumes.

### ⚠️ Important: Per-Market Reserve Accounting Doesn't Exist

The INDEX says "Vault: per-market reserve accounting." **This is not accurate.** The actual `vaultStore.ts` has no per-market tracking — just global `getVaultBalance()`. The pre-check uses global balance, not per-market reserves.

### ✅ Payout Math Is Correct

```
grossSats = quantity * outcomePrice  // outcomePrice = 1.0 for winning side, 0.0 for losing
rakeSats = floor(grossSats * 0.02)
netSats = grossSats - rakeSats
```

The `entryPrice` field is intentionally unused (`_entryPrice` in `calculatePayout`). Each winning share pays at face value regardless of purchase price — correct for binary prediction markets.

---

## 6. Product Alignment

### ✅ Creator-Only Resolution — Correct

UI shows "Resolve Market" button only for `market.creatorPubkey === currentUserPubkey`. Service-layer adds pubkey check as the first guard.

### ✅ No Automatic Expiration — Correct

Markets remain active indefinitely until manually resolved.

### ✅ Resolution State Visibility — Correct

Resolved markets show banner, no resolution button. Non-creators see resolution once published.

### ⚠️ Important: Void/Cancel Outcome Not Addressed

Only YES/NO handled. A third outcome "VOID" (refund all positions) is needed for edge cases. Requires different payout math: `netSats = costBasis * (1 - RAKE_FRACTION)`.

---

## Summary

### 🔴 BLOCKING (Must Fix Before Implementation)

| # | Issue | Description |
|---|-------|-------------|
| 1 | **Vault race condition** | TOCTOU gap between `getVaultBalance()` check and `sendPayoutTokens()` loop. No per-market reservation. |
| 2 | **Queue lacks deduplication** | No per-market deduplication in `enqueueResolution()`. Double-click queues same market twice. |
| 3 | **Partial payout state undefined** | After `payout_partial` error, plan doesn't specify market status. |

### 🟡 IMPORTANT (Should Fix)

| # | Issue | Description |
|---|-------|-------------|
| 4 | **No void/cancel outcome** | Only YES/NO supported. Market voiding needs a third outcome type. |
| 5 | **No NIP-09 deletion handling** | Kind:5 deletion could orphan resolution/payout events. |
| 6 | **Per-market reserves don't exist** | vaultStore has no per-market reserve tracking (INDEX claim is inaccurate). |
| 7 | **`outcomePrice` has no validation** | Should validate 0.0 or 1.0 for binary markets. |
| 8 | **`getResolutionEvent()` needs persistence** | Non-creator clients need local cache for kind:984 events. |

### 🟢 MINOR (Nice to Have)

| # | Issue | Description |
|---|-------|-------------|
| 9 | **TX log is localStorage only** | Cleared by browser wipe. Future: relay-persisted audit trail (kind:985). |
| 10 | **Position settled flag not updated** | TX log provides mitigation. |
| 11 | **Resolution rationale not required** | Should be prompted in UI before publishing. |

---

## Overall Verdict

**✅ Proceed with modifications.** The plan is well-structured and the bridge pattern is correct. All three blocking issues are solvable before implementation. The most critical is the vault race condition — implement per-market reserve tracking or atomic check-then-send before wiring kind:984 into the resolution pipeline.