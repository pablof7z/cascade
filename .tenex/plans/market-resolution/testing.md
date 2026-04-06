# Testing — Resolution Feature

## Test Files

### `src/lib/services/__tests__/resolutionEvent.test.ts`
- **Action**: create
- **Tests** (22 total):

**Parsing & Validation**
1. Parse valid kind:984 event with all tags → returns `ResolutionEvent` with correct fields
2. Parse event with missing `e` tag → throws validation error
3. Parse event with missing `d` tag → throws validation error
4. Parse event with invalid outcome (not YES/NO/VOID) → throws validation error
5. Parse event where `pubkey` ≠ market creator → throws "author mismatch" error
6. Parse event with VOID outcome → returns `ResolutionEvent` with outcome 'VOID'
7. Parse event with `p` tag → extracts oracle pubkey correctly
8. `created_at` parsed as integer, not string

**Replaceability (B5)**
9. Two events with same `d` tag, different `created_at` → latest wins
10. Older event for same `d` tag → ignored when newer exists
11. Events with different `d` tags → treated as separate (different markets)
12. Same `d` tag, different authors → only market creator's accepted

**NIP-09 Deletion (I9)**
13. Market with NIP-09 deletion event → resolution rejected with "deleted market" error
14. Market without deletion event → resolution accepted normally

**Discovery Filters**
15. Filter by `#e` + `#d` returns correct event
16. Filter by `#p` returns events by resolver
17. Filter by `#c` returns Cascade events only

**Caching (I12)**
18. `getResolutionEvent` returns cached event when present in localStorage
19. `getResolutionEvent` queries relay when cache miss, then caches result
20. Cache update on receiving newer replaceable event

**Edge Cases**
21. Event with empty content → valid (content is optional)
22. Event with `resolved_at` tag → parsed for record-keeping but not used for ordering

---

### `src/lib/services/__tests__/resolutionBridge.test.ts`
- **Action**: create
- **Tests** (16 total):

**Outcome Price Validation (I11)**
1. `outcomePrice = 1.0` → accepted for YES resolution
2. `outcomePrice = 0.0` → accepted for NO resolution
3. `outcomePrice = 0.5` → throws "Invalid outcomePrice" error
4. `outcomePrice = -1.0` → throws error
5. `outcomePrice = 2.0` → throws error

**Integration**
6. `resolveMarket()` calls `publishResolutionEvent` with correct `d` tag (market slug)
7. `resolveMarket()` enqueues resolution via `enqueueResolution`
8. `handleResolutionEvent()` parses and enriches market object
9. `handleResolutionEvent()` triggers re-render via market store update

**NIP-09 Check (I9)**
10. `resolveMarket()` with deleted market → returns `{ success: false, error: { kind: 'market_deleted' } }`

**Recipient Validation (I7)**
11. Position with `ownerPubkey` → included in payout list
12. Position without `ownerPubkey` → throws error (no UUID fallback)
13. Position with empty string `ownerPubkey` → throws error

**VOID Outcome (I8)**
14. VOID outcome → all positions included in payout list (both YES and NO holders)
15. VOID payout = `costBasis * (1 - RAKE_FRACTION)` for each position
16. VOID with no positions → success, empty payout list

---

### `src/lib/services/__tests__/payoutCalculation.test.ts`
- **Action**: create
- **Tests** (16 total):

**Winner Determination**
1. YES resolution → YES positions get payout, NO positions get 0
2. NO resolution → NO positions get payout, YES positions get 0
3. VOID resolution → all positions get costBasis refund minus rake (I8)

**LMSR Math**
4. Single winner: `netSats = shares * outcomePrice - costBasis * RAKE_FRACTION`
5. Multiple winners: each calculated independently
6. Rake deducted: `RAKE_FRACTION = 0.02` → 2% of costBasis deducted

**Edge Cases**
7. Zero shares position → payout = 0
8. `Math.floor` applied → sub-sat amounts rounded down
9. Negative net payout (rake > gross) → clamped to 0
10. Empty positions array → total expenditure = 0
11. Single position with large shares → correct payout
12. VOID payout ignores shares, uses only costBasis (I8)

**Total Expenditure**
13. Sum of all winner payouts matches `calculateTotalExpenditure` return
14. Pre-check: total expenditure > vault balance → returns insufficient error
15. Pre-check: total expenditure ≤ vault balance → proceeds

**Build Payout List**
16. `buildPayoutList` filters out zero-payout positions, includes only winners with netSats > 0

---

### `src/lib/services/__tests__/resolutionQueue.test.ts`
- **Action**: create
- **Tests** (18 total):

**Deduplication (B2)**
1. Enqueue same market twice → second enqueue returns `false`, only one processes
2. Dedup set cleared after resolution completes successfully
3. Dedup set cleared after resolution completes with error
4. Concurrent enqueue of same market → only first accepted
5. Different markets enqueued → both accepted and processed sequentially

**Multi-Tab Lock (B4)**
6. `acquireResolutionLock` → returns lock value on success
7. Lock already held by another tab → returns `null`
8. Lock released on successful completion
9. Lock released on error completion
10. Stale lock (> 5 minutes) → new acquisition succeeds (takes over)
11. Fresh lock (< 5 minutes) → new acquisition fails
12. Race condition: two tabs acquire simultaneously → verify-after-write catches conflict

**Send Loop (B1/I5)**
13. Vault re-check at iteration 15 → vault sufficient → continues
14. Vault re-check at iteration 15 → vault insufficient → aborts with partial error
15. All sends succeed → market marked 'resolved'
16. Some sends fail → market stays 'active'

**Token Verification (I6)**
17. Self-verify via `wallet.receiveToken()` called after each send
18. Verification failure → TX entry marked 'failed'

---

### `src/lib/services/__tests__/payoutRecovery.test.ts`
- **Action**: create
- **Tests** (10 total):

**Partial Failure Recovery (B3)**
1. Load TX log with mix of 'sent' and 'failed' → retry skips 'sent', retries 'failed'
2. Load TX log with 'pending' entries → processes them normally
3. Load TX log with 'sending' entries (crashed tab) → treats as 'failed', retries
4. All entries become 'sent' after retry → market transitions to 'resolved'
5. Some entries still 'failed' after retry → market stays 'active'
6. TX log persisted to localStorage after each status change
7. TX log includes `resolutionEventId` for audit trail

**Position Settlement (M4)**
8. After all payouts sent → positions marked as settled (defense-in-depth)
9. Settled positions skipped on subsequent retry attempts
10. Settlement flag persisted in position data

---

### `src/lib/components/__tests__/ResolveMarketModal.test.ts`
- **Action**: create
- **Tests** (22 total):

**Rendering**
1. Modal renders with market title echo
2. Three outcome buttons displayed: YES, NO, VOID (I8)
3. Resolution note textarea with hint text visible (M6)
4. Confirm button disabled when no outcome selected
5. Confirm button enabled when outcome selected

**Outcome Selection**
6. Click YES → button shows emerald active state
7. Click NO → button shows rose active state
8. Click VOID → button shows neutral active state (I8)
9. Switching outcome → previous deselected, new selected
10. VOID confirmation text mentions "refund all positions" (I8)

**Two-Step Confirmation**
11. First click → shows confirmation warning + Cancel/Confirm buttons
12. Cancel during confirmation → returns to outcome selection
13. Confirm → calls `resolveMarket` with correct args
14. VOID confirm → calls `resolveMarket` with outcome 'VOID', outcomePrice 0.0

**Error States**
15. Multi-tab lock error → shows "Another tab" message with close-tabs hint
16. Insufficient vault error → shows vault balance message
17. Deleted market error → shows "deleted market" message (I9)
18. Partial failure error → shows error, resets confirming state for retry
19. Generic error → shows error message

**Loading State**
20. During submission → shows "Resolving..." disabled button

**Success**
21. Successful resolution → modal closes
22. Market object updates via subscription → banner appears (no manual refresh)

---

### `src/routes/m/[slug]/__tests__/resolution-display.test.ts`
- **Action**: create
- **Tests** (15 total):

**Resolution Banner**
1. No resolution → banner hidden
2. YES resolution → banner shows "YES" in emerald-400
3. NO resolution → banner shows "NO" in rose-400
4. VOID resolution → banner shows "VOID" in neutral-400, refund explanation visible (I8)
5. Resolved timestamp displayed

**Creator Button**
6. Creator + active market + authenticated → "Resolve Market" button visible
7. Non-creator → button hidden
8. Already resolved → button hidden
9. Not authenticated → button hidden

**Trading Disabled**
10. Resolved market → trading controls disabled
11. Active market → trading controls enabled

**Payout Display**
12. Winner position → shows "+X sats" in emerald
13. Loser position → shows "No payout" in neutral-500
14. VOID position → shows "Refunded" in neutral-400 (I8)
15. Payout amount matches `calculatePayout()` output

---

## Integration Test

### `src/lib/services/__tests__/resolution-integration.test.ts`
- **Action**: create
- **What**: End-to-end resolution flow test

```typescript
describe('Market Resolution Integration', () => {
  it('full YES resolution: publish → queue → dedup → lock → payout → resolve', async () => {
    // Setup: market with 3 YES positions, 2 NO positions, vault funded
    // Act: resolveMarket(market, 'YES', 1.0, 'Market resolved YES')
    // Assert:
    //   - kind:984 published with d tag = marketSlug
    //   - Queue processes exactly once (dedup)
    //   - Multi-tab lock acquired and released
    //   - 3 YES winners receive payouts
    //   - 2 NO losers receive nothing
    //   - TX log has 3 'sent' entries
    //   - Market status = 'resolved'
    //   - Positions marked as settled
  });

  it('full VOID resolution: all positions refunded at cost basis', async () => {
    // Setup: market with mixed YES/NO positions
    // Act: resolveMarket(market, 'VOID', 0.0, 'Event cancelled')
    // Assert:
    //   - All positions receive costBasis * (1 - RAKE_FRACTION)
    //   - TX log has entries for ALL positions
    //   - Market status = 'resolved'
  });

  it('partial failure → retry → complete', async () => {
    // Setup: 5 winners, mock wallet to fail on 3rd send
    // Act: resolveMarket → fails partially
    // Assert: market stays 'active', TX log has 2 'sent' + 1 'failed' + 2 'pending'
    // Act: retry resolveMarket
    // Assert: skips 2 'sent', retries from 3rd, all complete, market = 'resolved'
  });

  it('double-click deduplication', async () => {
    // Act: call resolveMarket twice in rapid succession
    // Assert: second call returns false (dedup), only one payout execution runs
  });

  it('multi-tab lock prevents concurrent resolution', async () => {
    // Setup: simulate lock held by another tab in localStorage
    // Act: resolveMarket
    // Assert: returns error "Another tab is currently resolving this market"
  });

  it('NIP-09 deleted market rejected', async () => {
    // Setup: market has NIP-09 deletion event
    // Act: resolveMarket
    // Assert: returns { success: false, error: { kind: 'market_deleted' } }
  });

  it('replaceable kind:984 — newer event supersedes older', async () => {
    // Setup: two kind:984 events, same d-tag, different created_at
    // Act: fetchResolutionEvent
    // Assert: returns event with latest created_at
  });
});
```

## Edge Case Scenarios

| Scenario | Expected Behavior | Test Coverage |
|---|---|---|
| Relay delay — resolution event arrives late | Market updates when event eventually received via subscription | Integration test |
| Double-submit (rapid click) | Second enqueue rejected by dedup Set | resolutionQueue dedup tests |
| Creator changes mind (new kind:984) | Latest replaceable event supersedes previous | resolutionEvent replaceability tests |
| Multiple relays — events arrive in different order | Client accepts latest `created_at` per replaceable semantics | resolutionEvent conflict resolution tests |
| Tab crash during payout | TX log entries in 'sending' state treated as 'failed' on retry | payoutRecovery tests |
| Vault depleted mid-loop | Re-check every 15 iterations catches depletion, aborts gracefully | resolutionQueue send loop tests |
| Market deleted before resolution | NIP-09 check rejects resolution attempt | resolutionBridge NIP-09 tests |

## Execution Order

1. **Create `resolutionEvent.test.ts`** — 22 tests for parsing, validation, replaceability, NIP-09, caching. Verify: all pass.
2. **Create `resolutionBridge.test.ts`** — 16 tests for outcomePrice validation, NIP-09, recipient validation, VOID. Verify: all pass.
3. **Create `payoutCalculation.test.ts`** — 16 tests for winner determination, LMSR math, edge cases. Verify: all pass.
4. **Create `resolutionQueue.test.ts`** — 18 tests for dedup, multi-tab lock, send loop, token verification. Verify: all pass.
5. **Create `payoutRecovery.test.ts`** — 10 tests for partial failure recovery, position settlement. Verify: all pass.
6. **Create `ResolveMarketModal.test.ts`** — 22 tests for modal rendering, VOID outcome, errors. Verify: all pass.
7. **Create `resolution-display.test.ts`** — 15 tests for banner, creator button, payout display. Verify: all pass.
8. **Create `resolution-integration.test.ts`** — 7 integration tests for end-to-end flows. Verify: all pass.
