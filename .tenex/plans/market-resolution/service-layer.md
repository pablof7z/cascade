# Service Layer — Resolution Pipeline

## File Changes

### `src/lib/services/nostrService.ts`
- **Action**: modify
- **What**:
  - Add `RESOLUTION_EVENT_KIND` import
  - Add `publishResolutionEvent(market, outcome, content)` — Builds and publishes kind:984 with `d` tag set to `market.slug`, `e` tag, `resolution`, `resolved_at`, `oracle`, indexed `p` tag, and `c` tag. Uses `ndkInstance.publish()`.
  - Add `fetchResolutionEvent(marketEventId, marketSlug)` — Queries `{ kinds: [984], '#e': [marketEventId], '#d': [marketSlug] }`. If multiple events returned, selects the one with latest `created_at` per NIP-01 replaceable semantics.
  - Add `subscribeToResolutionEvents(marketEventIds)` — Subscribes to kind:984 for a set of market event IDs. Returns NDK subscription handle.
  - Add `checkMarketDeletion(marketEventId)` — Queries `{ kinds: [5], '#e': [marketEventId] }` to check for NIP-09 deletion events. Returns `true` if market has been deleted.
- **Why**: Encapsulates all Nostr I/O for resolution events. Replaceable event semantics ensure latest resolution wins.

### `src/lib/services/marketService.ts`
- **Action**: modify
- **What**:
  - Add `parseResolutionEvent(ndkEvent): ResolutionEvent` — Extracts tags into typed `ResolutionEvent`. Validates: author matches market creator, outcome is `YES`/`NO`/`VOID`, `e` tag present, `d` tag present.
  - Add `enrichMarketWithResolution(market, resolutionEvent)` — Sets `market.resolution`, `market.resolvedAt`, `market.resolutionEventId` from parsed event.
  - Integrate into market subscription — When a kind:984 event arrives for a subscribed market, parse and enrich the market object, trigger re-render.
- **Why**: Market objects need resolution state for UI display and payout triggering.

### `src/lib/services/resolutionService.ts`
- **Action**: modify (major rewrite)
- **What**: Full resolution pipeline with queue, dedup, multi-tab locking, partial-failure recovery, and vault safety checks. See detailed implementation below.
- **Why**: This is the core orchestration file for the entire resolution flow.

### `src/lib/types/market.ts`
- **Action**: modify
- **What**: Add to `Market` type: `resolution?: 'YES' | 'NO' | 'VOID'`, `resolvedAt?: number`, `resolutionEventId?: string`. Add `ResolutionEvent` type (per nostr-event-design.md). Add `PayoutTxEntry` type. Add `ResolutionResult` type.
- **Why**: Type definitions for the entire resolution pipeline.

---

## Resolution Service — Detailed Implementation

### Public API

```typescript
// Entry point: creator resolves a market
resolveMarket(market: Market, outcome: 'YES' | 'NO' | 'VOID', outcomePrice: number, content?: string): Promise<ResolutionResult>

// Event handler: process incoming kind:984 from relay
handleResolutionEvent(ndkEvent: NDKEvent): Promise<void>

// Query: get cached or fetch resolution event
getResolutionEvent(marketEventId: string, marketSlug: string): Promise<ResolutionEvent | null>
```

### `resolveMarket()` Flow

1. **Validate `outcomePrice`** — For binary markets: must be `0.0` or `1.0`. Throw `Error('Invalid outcomePrice: must be 0.0 or 1.0 for binary market')` for any other value.
2. **Check NIP-09 deletion** — Call `checkMarketDeletion(market.eventId)`. If deleted, return `{ success: false, error: { kind: 'market_deleted', message: 'Cannot resolve a deleted market' } }`.
3. **Publish kind:984** — Call `publishResolutionEvent(market, outcome, content)`.
4. **Enqueue resolution** — Pass to `enqueueResolution(market, outcome, outcomePrice)`.

### Resolution Queue (`resolutionQueue.ts`)

**New file**: `src/lib/services/resolutionQueue.ts`

#### Deduplication (B2)

```typescript
// Module-level state
const pendingMarketIds = new Set<string>();
const queue: ResolutionJob[] = [];
let processing = false;

function enqueueResolution(market, outcome, outcomePrice): boolean {
  // Dedup check: reject if already queued or processing
  if (pendingMarketIds.has(market.slug)) {
    console.warn(`Resolution already pending for ${market.slug}, skipping`);
    return false;
  }

  pendingMarketIds.add(market.slug);
  queue.push({ market, outcome, outcomePrice });

  if (!processing) processNext();
  return true;
}

// After resolution completes (success or error):
pendingMarketIds.delete(market.slug);
```

#### Multi-Tab Lock (B4)

```typescript
function acquireResolutionLock(marketSlug: string): string | null {
  const lockKey = `cascade-resolution-lock:${marketSlug}`;
  const existing = localStorage.getItem(lockKey);

  // Check for stale lock (> 5 minutes old = probably crashed tab)
  if (existing) {
    const lockTime = parseInt(existing.split('-')[0], 10);
    if (Date.now() - lockTime < 5 * 60 * 1000) {
      return null; // Lock is fresh, another tab is active
    }
    // Stale lock — take over
  }

  const lockValue = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(lockKey, lockValue);

  // Verify we won the race (another tab may have written between read and write)
  if (localStorage.getItem(lockKey) !== lockValue) {
    return null;
  }

  return lockValue;
}

function releaseResolutionLock(marketSlug: string, lockValue: string): void {
  const lockKey = `cascade-resolution-lock:${marketSlug}`;
  if (localStorage.getItem(lockKey) === lockValue) {
    localStorage.removeItem(lockKey);
  }
}
```

#### `_executeResolution()` — Core Pipeline

```
1. Acquire multi-tab lock → abort if held by another tab
2. Vault pre-check: getVaultBalance() >= totalExpectedPayout → abort if insufficient
3. Build payout list via bridge function (see payout-logic.md)
4. Initialize TX log entries as 'pending' in localStorage
5. Sequential send loop with periodic vault re-check:
   for (let i = 0; i < payouts.length; i++) {
     // Vault re-check every 15 iterations
     if (i > 0 && i % 15 === 0) {
       const remaining = payouts.slice(i).reduce((sum, p) => sum + p.netSats, 0);
       if (getVaultBalance() < remaining) {
         → abort, return partial error, keep market 'active'
       }
     }

     // Skip already-sent entries (retry scenario)
     if (txLog[i].status === 'sent') continue;

     // Send payout
     txLog[i].status = 'sending';
     persistTxLog();
     try {
       const token = await sendPayoutTokens(payout.recipientPubkey, payout.netSats);
       // Self-verify token (I6: trust minimization)
       await wallet.receiveToken(token); // Verifies DLEQ/structure
       txLog[i] = { status: 'sent', token, timestamp: Date.now() };
     } catch (err) {
       txLog[i] = { status: 'failed', error: err.message, timestamp: Date.now() };
     }
     persistTxLog();
   }
6. Evaluate final state:
   - All 'sent' → market status = 'resolved', return success
   - Any 'failed' → market stays 'active', return partial error for retry
   - All 'failed' with unrecoverable errors → market status = 'resolved' (acknowledged failure)
7. Mark positions as settled (M4: defense-in-depth)
8. Release multi-tab lock
```

### Partial Failure State Machine (B3)

```
TX Entry States:
  pending → sending → sent     (happy path)
  pending → sending → failed   (error during send)

Market State:
  'active' ──[all payouts sent]──→ 'resolved'
  'active' ──[some failed, some sent]──→ 'active' (retry available)
  'active' ──[all unrecoverable]──→ 'resolved' (with error flag)

On Retry:
  1. Load TX log from localStorage
  2. Skip entries with status === 'sent'
  3. Retry entries with status === 'failed'
  4. Process entries with status === 'pending' (interrupted before attempt)
```

### Recipient Validation (I7)

```typescript
// In payout list construction:
if (!position.ownerPubkey) {
  throw new Error(`Position ${position.id} has no ownerPubkey — cannot deliver payout`);
}
// NO fallback to position.id (UUID). Cashu cannot deliver to a UUID.
```

### Resolution Event Cache (I12)

```typescript
// localStorage key: 'cascade-resolution-cache'
// Value: JSON map of marketEventId → ResolutionEvent

function getCachedResolution(marketEventId: string): ResolutionEvent | null {
  const cache = JSON.parse(localStorage.getItem('cascade-resolution-cache') || '{}');
  return cache[marketEventId] || null;
}

function cacheResolution(marketEventId: string, event: ResolutionEvent): void {
  const cache = JSON.parse(localStorage.getItem('cascade-resolution-cache') || '{}');
  cache[marketEventId] = event;
  localStorage.setItem('cascade-resolution-cache', JSON.stringify(cache));
}

// getResolutionEvent() checks cache first, then queries relay
```

### TX Log Structure

```typescript
interface PayoutTxEntry {
  index: number;
  recipientPubkey: string;
  positionId: string;
  netSats: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
  token?: string;        // Cashu token string if sent
  error?: string;        // Error message if failed
  timestamp?: number;    // When status last changed
  resolutionEventId: string; // Which kind:984 triggered this payout
}

// localStorage key: `cascade-tx-log:${marketSlug}`
```

### Phase 2 Notes

- **Kind:985 audit trail** (M5): Persist TX log entries as kind:985 Nostr events for relay-backed auditability.
- **Per-market reserve tracking** (I10): Add `reserveForMarket(marketId, sats)` / `releaseReserve(marketId, sats)` to vaultStore for precise per-market escrow accounting.
- **Cross-tab idempotency** (M8): TX log combined with multi-tab locks provides idempotency. TX log protects within-session, locks protect between tabs.

---

## Execution Order

1. **Add types** — Add `ResolutionEvent`, `PayoutTxEntry`, `ResolutionResult` to `market.ts`. Verify: `npx tsc --noEmit`.
2. **Add nostrService functions** — `publishResolutionEvent`, `fetchResolutionEvent`, `subscribeToResolutionEvents`, `checkMarketDeletion`. Verify: `npx tsc --noEmit`.
3. **Add marketService parsing** — `parseResolutionEvent`, `enrichMarketWithResolution`. Verify: `npx tsc --noEmit`.
4. **Create resolutionQueue.ts** — Queue, dedup set, multi-tab lock, `_executeResolution`. Verify: `npx tsc --noEmit`.
5. **Implement resolutionService.ts** — `resolveMarket` with outcomePrice validation, NIP-09 check, queue integration. Verify: `npx tsc --noEmit`.
6. **Add resolution event cache** — `getCachedResolution`, `cacheResolution`, integrate into `getResolutionEvent`. Verify: `npx tsc --noEmit`.
7. **Integrate into market subscription** — Wire kind:984 handler into existing market subscription flow in `marketService.ts`. Verify: `npx tsc --noEmit`.
8. **Wire `handleResolutionEvent`** — Connect incoming kind:984 events to `handleResolutionEvent` in `resolutionService.ts`. Verify: full type-check passes, manual test of event flow.
