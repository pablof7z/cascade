# Position Persistence Migration to Nostr NIP-33

## Context

**Current State:**
- Positions stored in localStorage under key `'cascade-positions'` (file: `src/positionStore.ts`, lines 21-48)
- Position type: `{ id, marketId, marketTitle, direction, quantity, entryPrice, costBasis, timestamp }`
- **Identity Model (Critical for Nostr design):**
  - **Logical key:** `(marketId, direction)` — uniquely identifies a position for a user
  - **d-tag encodes logical key:** `cascade:position:{{marketId}}:{{direction}}`
  - **Position.id:** Derived identifier (currently timestamp-based or random uuid). NOT used as logical key in Nostr.
  - **Why:** Kind 30078 replaceable events use d-tag as identity, not event id. When user adds to existing position, we fetch event by d-tag, merge, and publish updated event (replaces old). Position.id is metadata only.
- Functions exported: `loadPositions()`, `savePositions()`, `addPosition()`, `getPositionsForMarket()`, `removePosition()`
- Used by: `src/Portfolio.tsx` (lines 51, 54), `src/MarketDetail.tsx` (line 15)
- When adding to existing market+direction position, weighted-averages entry price (lines 66-72)

**Why This Change:**
Positions currently disappear on browser reload for anonymous users and cannot sync across devices. Storing positions on Nostr (kind 30078, NIP-78 application-specific data) allows:
1. **Persistence**: Positions survive browser reload when user is logged in (has NIP-07 signer)
2. **Cross-device sync**: User can view positions from any device
3. **Graceful degradation**: Anonymous users silently fall back to localStorage; no breaking changes
4. **Pattern alignment**: Reuses existing Nostr infrastructure (NDK, market service patterns)

**Existing Patterns to Follow:**
- Market service (`src/services/marketService.ts`) uses:
  - Discriminated union result types (`ParseResult`, `ValidationResult`) for error handling
  - Kind 30000 with d-tag format: `['d', 'market:{{marketId}}']`
  - Replaceable events for per-entity state
  - `serializeToEvent()`, `parseEvent()`, `validateEvent()`, `publish()` pattern
- NostrService (`src/services/nostrService.ts`) provides transport primitives: `publishEvent()`, `fetchEvents()`, `subscribeToEvents()`
- NostrContext wraps service for React consumption (file: `src/context/NostrContext.tsx`)

## Approach

### Architecture Overview

A **three-layer model** where:

1. **Position Service** (`src/services/positionService.ts` — pure domain logic + transport primitives, no React)
   - **Pure functions**: serialization/deserialization, validation, weighted-average merge logic (testable without side effects)
   - **Transport primitives** (side effects, but deterministic interfaces): `publishPosition()`, `fetchPositions()`, `subscribeToPositions()` 
   - Error handling via ParseResult, ValidationResult discriminated unions (forces exhaustive pattern matching at call sites)
   - **Does not depend on React hooks or localStorage**; receives NDK and pubkey as parameters

2. **Position Store Adapter** (`src/positionStore.ts` — refactored)
   - Thin dispatch layer that routes to positionService (when user logged in) or localStorage (fallback)
   - **Preserves all public function signatures** so components need minimal changes
   - Handles first-login migration (localStorage → Nostr)
   - Gracefully handles offline/signer unavailable scenarios

3. **usePositions Hook** (`src/hooks/usePositions.ts` — new, React-only)
   - `usePositions(marketId?: string)` — returns positions for a market or all user positions
   - Subscribes to live Nostr updates when user logged in
   - Falls back to in-memory state when using localStorage
   - Automatic cleanup on unmount

### Design Rationale

**Why separate positionService from the hook?**
- positionService is pure and testable without React
- Enables low-level testing of serialization, validation, Nostr transport
- Allows future uses (e.g., CLI tools, other clients)

**Why keep positionStore?**
- Existing components call `addPosition()`, `loadPositions()`, etc.
- Refactoring to hooks everywhere would require sweeping changes to Portfolio.tsx, MarketDetail.tsx
- Adapter pattern lets us swap backing storage (localStorage ↔ Nostr) without touching consumers

**Why graceful fallback instead of error?**
- Anonymous users (no NIP-07 signer) benefit from localStorage
- Offline scenarios degrade gracefully (in-memory state, write on reconnect)
- Aligns with Nostr-optional design philosophy (read-only mode in nostrService)

**Why kind 30078 + NIP-78?**
- Kind 30078: Application-specific data (NIP-78 standard)
- Replaceable events: Each position (marketId+direction combo) = one event
- d-tag format: `cascade:position:{{marketId}}:{{direction}}` (scoped to app, market, direction)
- When user adds quantity to existing position → publish updated event with new quantity + weighted-average price
- Old events auto-replaced on relays; no manual deletion needed

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Event kind for positions** | Kind 30078 (NIP-78) + d-tag | Replaceable, scoped to position identity (marketId+direction). Auto-replaces old events on relays. |
| **d-tag format** | `cascade:position:{{marketId}}:{{direction}}` | Scopes to app + market + direction. Relays do NOT support wildcards in tag filters (only exact matches). To efficiently fetch all user positions: use `{ kinds: [30078], authors: [pubkey], '#c': ['cascade'] }` (add fixed app tag) OR fetch exact d-tags client-side and filter. Chosen approach: add `['c', 'cascade']` tag to all position events for efficient relay queries. |
| **Merge strategy for averaging** | In-place weighted-average in positionService | When `addPosition()` called on existing market+direction, fetch latest Nostr event, compute new average, publish updated event. Local cache updated immediately; Nostr consistent eventually. |
| **Serialization format** | JSON in event.content | Mirrors market service pattern. Content = JSON-stringified position data; tags carry metadata (d-tag, version). |
| **Concurrency for positions** | No explicit version check (unlike markets) | Positions are user-exclusive (no multi-signer). Last-write-wins on relay. Version field optional for future use. |
| **Migration on first login** | Detect localStorage, push to Nostr, clear localStorage | On init, if user has pubkey and localStorage has positions, serialize + publish each, then clear localStorage. Keeps old positions as backup if publish fails. |
| **Hook subscription pattern** | Subscribe on mount, unsubscribe on unmount | Matches market discussion subscription pattern. Filter: `{ kinds: [30078], authors: [pubkey], '#d': ['cascade:position:*'] }`. Callback updates React state. |
| **Fallback for no signer** | Silent localStorage only, no warning | Anonymous users seamlessly use localStorage. No UI friction. Components see same Position type. |
| **Error handling result types** | Discriminated unions (ok/err, valid/invalid) | Matches market service pattern. Enables exhaustive pattern matching; avoids exceptions for normal failures (parse, validate). |

---

## File Changes

### `src/services/positionService.ts` (create)

**Action:** Create

**What:**
New pure module for position Nostr domain logic. Does not import React, hooks, localStorage, or nostrService directly (receives NDK/pubkey as parameters).

**Type Management (Critical: Avoid Circular Dependencies):**
- **Position, PositionDirection types MUST be defined in a neutral location** to prevent circular imports:
  - Create: `src/positions/types.ts` (or reuse existing `src/types.ts` if positions section exists)
  - Both `positionService.ts` AND `positionStore.ts` import types from this file
  - DO NOT have positionService import from positionStore (or vice versa)
  - This enables clean separation: service is pure, store is adapter

**Structure:**
1. **Result Types** (lines 1–40)
   - `type ParseResult = { ok: true; position: Position } | { ok: false; error: string; reason: 'invalid_json' | 'missing_d_tag' | 'invalid_position' }`
   - `type ValidationResult = { valid: true; position: Position } | { valid: false; reason: string }`

2. **Serialization** (lines 42–65)
   - `serializePositionToEvent(position: Position): { content: string; tags: string[][] }`
     - Tags: 
       - `['d', 'cascade:position:{{marketId}}:{{direction}}']` (identity)
       - `['c', 'cascade']` (app tag, enables efficient relay filtering without wildcards)
       - `['v', '1']` (version, for future schema changes)
     - Content: `JSON.stringify(position)` with all fields: `{ id, marketId, marketTitle, direction, quantity, entryPrice, costBasis, timestamp }`

3. **Parsing** (lines 67–95)
   - `parsePositionEvent(event: NDKEvent): ParseResult`
     - Validates d-tag format: `cascade:position:*:*`
     - Parses JSON content
     - Returns discriminated union (ok/error)

4. **Validation** (lines 97–130)
   - `validatePositionEvent(event: NDKEvent): ValidationResult`
     - Checks pubkey present
     - Checks d-tag and content validity
     - Returns `{ valid: true; position }` or `{ valid: false; reason }`

5. **Weighted Average Logic** (lines 132–155)
   - `computeWeightedAveragePosition(existing: Position, newQty: number, newPrice: number): Position`
     - Takes existing position, new quantity, new entry price
     - Computes: `newAvgPrice = (existing.price * existing.qty + newPrice * newQty) / (existing.qty + newQty)`
     - Returns updated position with new quantity, average price, cost basis, timestamp
     - **Does not publish** — caller decides when to persist

6. **Nostr Transport** (lines 157–215)
   - `publishPosition(ndk: NDK, pubkey: string, position: Position): Promise<NDKEvent>`
     - Serialize position to event
     - Publish via `ndk.publish(event, { kind: 30078, ...tags })`
     - Returns published event or throws
   
   - `fetchPositions(ndk: NDK, pubkey: string): Promise<Position[]>`
     - Query: `{ kinds: [30078], authors: [pubkey], '#c': ['cascade'] }` (uses app tag for efficient relay filtering; no wildcard)
     - Parse all events, return valid positions only
     - Sort by timestamp desc (most recent first)
     - Filter client-side: only return events with d-tag matching `cascade:position:*:*` pattern
   
   - `subscribeToPositions(ndk: NDK, pubkey: string, callback: (positions: Position[]) => void): NDKSubscription`
     - Subscribe to filter: `{ kinds: [30078], authors: [pubkey], '#c': ['cascade'] }`
     - On each event: parse, validate (d-tag must match `cascade:position:*:*`), call callback with updated position list
     - Caller responsible for cleanup (subscription.stop())
     - Maintains in-memory cache of all user positions; callback called with full position array on any change

7. **Helper: Parse Position Key From d-tag** (lines 217–225)
   - `parsePositionKeyFromDTag(dTag: string): { marketId: string; direction: PositionDirection } | null`
     - Parse `cascade:position:{{marketId}}:{{direction}}` into components (the logical key, NOT the position ID)
     - Return null if format invalid
     - Used internally to extract position identity during parsing and subscription updates

**Why:**
- Pure module enables offline testing (mock NDK)
- Follows market service pattern for consistency
- Discriminated unions force exhaustive error handling at call sites
- Serialization/parsing/validation separated for clarity and reuse

---

### `src/positionStore.ts` (refactored)

**Action:** Modify

**What:**
Refactor to adapter pattern: dispatch to positionService when user has pubkey, fallback to localStorage.

**Current exports preserved:**
- `type Position` (unchanged)
- `type PositionDirection` (unchanged)
- `function loadPositions(): Position[]`
- `function savePositions(positions: Position[]): void`
- `function addPosition(marketId, marketTitle, direction, quantity, entryPrice): Position`
- `function getPositionsForMarket(marketId): Position[]`
- `function removePosition(positionId): void`

**Internal state additions:**
- `_positionsCache: Position[]` — in-memory cache for all positions (source of truth)
- `_usingNostr: boolean` — flag: true if user logged in, false if localStorage fallback
- `_migrationDone: boolean` — flag: true if first-login migration completed
- `_subscription: NDKSubscription | null` — live Nostr subscription handle (managed by positionStore ONLY)
- **CRITICAL: positionStore is the single source of truth for subscriptions.** The `usePositions` hook reads from positionStore's cache; it does NOT create its own subscription. This prevents race conditions and duplicate subscriptions. (See section below.)

**Key functions (new internal logic):**

- `initializePositions(pubkey: string | null, ndk: NDK | null): Promise<void>` (new, called from App.tsx on NostrContext ready)
  - **Signer detection with retry logic:**
    - Attempt to verify signer availability (e.g., check window.nostr exists, NIP-07 permission)
    - If signer unavailable: retry up to 3 times with 2-second backoff (handles slow extension loads)
    - If all retries fail: log warning once, set `_usingNostr = false`, fall back to localStorage
  - If pubkey exists AND signer ready:
    - Fetch positions from Nostr using positionService.fetchPositions()
    - If fetch succeeds: set `_usingNostr = true`, cache positions, check for localStorage migration
    - If fetch fails (offline): log warning, fall back to localStorage, `_usingNostr = false`
    - **Subscribe to live updates (positionService.subscribeToPositions())** — this is the ONLY subscription created for positions
    - Store subscription handle in `_subscription` for cleanup on logout
  - If no pubkey: `_usingNostr = false`, load localStorage
  - **Cleanup on logout:** If pubkey becomes null, call `_subscription?.stop()` and clear cache

- `migrateFromLocalStorageIfNeeded(pubkey: string, ndk: NDK): Promise<void>` (new, called during init)
  - Check if `localStorage.getItem('cascade-positions')` has data and not yet migrated (`_migrationDone = false`)
  - For each position in localStorage: publish to Nostr using positionService.publishPosition()
  - On success: set `_migrationDone = true` (don't clear localStorage yet)
  - On failure (network): skip clear, keep localStorage as backup
  - **IMPORTANT:** After successful migration, localStorage is kept as **write-through shadow copy** (see savePositions pattern above). This provides durability: if user loses Nostr connectivity, positions are not permanently lost. Nostr is primary; localStorage is read-only after migration and used only if fetch fails.
  - Log migration result for debugging

- `loadPositions(): Position[]` (refactored)
  - Return `_positionsCache` (always in-sync whether source is localStorage or Nostr)

- `savePositions(positions: Position[]): void` (refactored)
  - **Offline-first pattern:**
    - ALWAYS update localStorage immediately: `localStorage.setItem('cascade-positions', JSON.stringify(positions))` (synchronous, guaranteed)
    - If `_usingNostr`: fire async publish to Nostr in background (don't await)
      - For each changed position: `positionService.publishPosition(ndk, pubkey, position)` (fire-and-forget)
      - Log errors but don't throw (write succeeded locally; Nostr sync is eventual)
    - If localStorage fallback: skip Nostr publish entirely
  - Always update `_positionsCache`
  - **Rationale:** Prevents UX delays and data loss. User's local write completes immediately; Nostr syncs asynchronously. On reconnect, compare cache + localStorage with Nostr events and resolve conflicts.

- `addPosition(marketId, marketTitle, direction, quantity, entryPrice): Position` (refactored)
  - **Queue-based sequential updates per (market+direction) combo:**
    - Internal queue: `Map<string, Promise<Position>>` where key = `{{marketId}}:{{direction}}`
    - When addPosition called:
      1. Create task: compute weighted average (fetch latest from cache/Nostr if needed)
      2. Enqueue task for this market+direction combo
      3. Wait for previous task to complete (prevents concurrent writes)
      4. Execute: merge, update cache, savePositions(), return position
    - **Rationale:** Rapid clicks on same position (e.g., "BUY" button spammed) would cause read-modify-write race. Queue serializes updates per position, ensuring no trades are lost.
  - Load cache
  - Find existing position for market+direction
  - If exists: compute weighted average (use positionService.computeWeightedAveragePosition())
  - If new: create position with uid()
  - Update cache
  - Call savePositions() (which routes to Nostr or localStorage)
  - Return position (to caller immediately, even while savePositions() is async)

- `getPositionsForMarket(marketId): Position[]` (refactored)
  - Return `_positionsCache.filter(p => p.marketId === marketId)`

- `removePosition(positionId): void` (refactored)
  - If `_usingNostr`: publish deletion marker (e.g., quantity = 0, or delete via event)
  - If localStorage: filter and savePositions()
  - Update cache

**Why:**
- Signatures unchanged → components see no API break
- Dispatch logic hidden → components unaware of backing storage
- Cache ensures fast lookups (O(1) filtered)
- Async init hook called once at app startup

---

### `src/hooks/usePositions.ts` (create)

**Action:** Create

**What:**
React hook for positions with live Nostr subscriptions.

**API:**
```typescript
function usePositions(marketId?: string): {
  positions: Position[]
  loading: boolean
  error: Error | null
}
```

**Behavior:**
- If marketId provided: return only positions for that market
- If marketId omitted: return all positions
- **Reads from positionStore cache** (which is managed by positionStore, not by hook)
- Automatically updates when positionStore cache changes (live Nostr updates via positionStore's subscription)
- Falls back to localStorage cache (if no signer)
- Cleans up on unmount

**Internal:**
- Uses `useNostr()` to check pubkey and NDK
  - **GUARD:** If `useNostr()` returns null, throw error: `throw new Error('usePositions requires NostrContext provider')`
- Calls `positionStore.loadPositions()` to get initial state
- **Subscription pattern (CRITICAL):**
  - **Hook does NOT create its own subscription.** positionStore manages the ONLY subscription (created in initializePositions)
  - Hook observes positionStore cache changes via **MutationObserver on a custom event emitter**:
    - positionStore emits custom event `'positions-updated'` whenever cache changes
    - Hook listens to this event in useEffect
    - On event: `const updated = positionStore.loadPositions()`, call setState(updated)
  - Alternatively (if event emitter not available): Use useEffect with dependency on localStorage key (poll for changes via MutationObserver on window.localStorage)
- Filter by marketId in component (post-fetch, not on Nostr query)
- Error state populated if positionStore init fails

**Why:**
- Enables real-time position updates in Portfolio and other components
- Hooks pattern (usePositions) matches existing useBookmarks, useNostr patterns
- Optional marketId parameter supports both portfolio-wide and market-detail use cases

---

### `src/App.tsx` (modify)

**Action:** Modify (lines to be determined by code reading)

**What:**
Add initialization call to positionStore.initializePositions() when Nostr context becomes ready.

**Where:**
In main App component or a top-level useEffect that depends on `useNostr()`:

```typescript
import { initializePositions } from './positionStore'

export function App() {
  const nostr = useNostr()
  
  // Guard: ensure NostrContext is available
  if (!nostr) throw new Error('App must be wrapped in NostrProvider')
  
  const { pubkey, isReady, ndkInstance } = nostr

  useEffect(() => {
    if (isReady && ndkInstance) {
      // Initialize position persistence (Nostr or localStorage fallback)
      // This creates the positionStore subscription (ONLY ONE) and manages signer retry
      initializePositions(pubkey, ndkInstance).catch(err => {
        console.warn('Position init error, falling back to localStorage:', err)
      })
    }
  }, [pubkey, isReady, ndkInstance])
  
  return (/* ... */)
}
```

**Why:**
- Ensures positions are loaded and subscription started when app initializes
- Non-blocking (catch errors, fall back gracefully)
- Matches pattern used for market subscription setup

---

### `src/test/positionService.test.ts` (create)

**Action:** Create

**What:**
Unit and integration tests for position service. Structure:

1. **Serialization Tests** (5 tests)
   - `test('serializePositionToEvent creates correct d-tag and content')`
   - `test('d-tag format is cascade:position:{{marketId}}:{{direction}}')`
   - Content is valid JSON, contains all position fields

2. **Parsing Tests** (6 tests)
   - Valid event parses to Position
   - Missing d-tag returns error with reason 'missing_d_tag'
   - Invalid JSON returns 'invalid_json'
   - Malformed d-tag returns error
   - Valid but missing position fields returns 'invalid_position'
   - Multiple events parse correctly

3. **Validation Tests** (5 tests)
   - Valid event validates (valid: true)
   - Event without pubkey fails validation
   - Invalid d-tag fails validation
   - Non-JSON content fails validation
   - Event with all fields passes validation

4. **Weighted Average Tests** (4 tests)
   - New position: averaging into empty position returns new position unchanged
   - Existing position + new buy: weighted average price correct
   - Multiple buys: price converges as expected
   - Edge case: zero quantity inputs handled gracefully

5. **Extract Position ID Tests** (3 tests)
   - Valid d-tag extracts marketId + direction
   - Invalid format returns null
   - Multiple formats parsed correctly

6. **Nostr Transport Tests** (6 tests, mocked NDK)
   - `publishPosition` creates event with correct structure
   - `fetchPositions` filters by pubkey + kind
   - `subscribeToPositions` sets up filter correctly
   - Publish error propagates
   - Fetch with no events returns empty array
   - Subscribe callback called on event

7. **Integration: Migration Tests** (3 tests)
   - Migrating N positions from localStorage to Nostr succeeds
   - Migration with publish failure keeps localStorage intact
   - After successful migration, old localStorage cleared

**Test utilities and setup** (in `src/test/testHelpers.ts` or within test file):
- `createMockNDK()`: Returns mock NDK instance with stubs for `publish()`, `fetchEvents()`, `subscribe()`
- `createMockSubscription()`: Returns mock NDKSubscription with `.stop()` method, supports callback registration
- `createMockPosition(overrides)`: Factory function, returns valid Position with sample data + overrides
- `createMockEvent(position, pubkey)`: Serializes position to mock NDKEvent with correct tags + content
- `beforeEach(() => vi.clearAllMocks())`: Reset all Vitest mocks between tests (critical for isolation)
- `vi.useFakeTimers()`: For deterministic time in weighted-average tests (Vitest, not Jest)
- Helper: `expectPositionsEqual(a, b)`: Deep equality check ignoring timestamp variations

**Why:**
- 30+ tests ensure serialization/parsing/validation robustness
- Mocked NDK allows testing without relay
- Integration tests verify end-to-end migration flow
- All tests run synchronously (no real network)

---

### `src/test/storage.test.ts` (update, if needed)

**Action:** Modify (conditional)

**What:**
Add 3–5 tests for position store adapter:

- `test('loadPositions returns cache')`
- `test('addPosition routes to Nostr when pubkey present')`
- `test('addPosition routes to localStorage when no pubkey')`
- `test('removePosition clears cache')`

(These are high-level; low-level tests live in positionService.test.ts)

**Why:**
- Verify adapter dispatch logic
- Ensure no regression in component-facing API

---

### `src/Portfolio.tsx` (minimal changes)

**Action:** Modify (optional)

**What:**
Consider replacing manual `loadPositions()` call with `usePositions()` hook for live updates.

**Current (lines 50–57):**
```typescript
useEffect(() => {
  setPositions(enrichPositions(loadPositions()))
  const onFocus = () => setPositions(enrichPositions(loadPositions()))
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}, [])
```

**Proposed (optional):**
```typescript
const { positions: allPositions } = usePositions()

useEffect(() => {
  setPositions(enrichPositions(allPositions))
}, [allPositions])
```

**Why:**
- Cleaner: hook subscription replaces manual addEventListener
- Live updates: positions auto-refresh when Nostr events arrive
- Fallback: hook uses cache (localStorage or Nostr), works offline

**Scope Note:** This is optional. If hook not used, Portfolio continues working with cached loadPositions(). Either approach is valid.

---

### `src/MarketDetail.tsx` (no changes required, optional enhancement)

**Action:** No change (required); optional enhancement available

**What:**
Call site for `addPosition()` (line 15). Function signature unchanged, so no edits needed.

**Optional Enhancement (out of scope for MVP):**
MarketDetail COULD display the user's current position for this market by calling `usePositions(marketId)` hook:
```typescript
const { positions } = usePositions(marketId)
const userPosition = positions[0] // filtered to this market only
// Display: Current Qty, Entry Price, PnL within MarketDetail header
```
**Decision:** This enhancement is OPTIONAL and out of scope for MVP. Current implementation works fine without it. Document this option for future work. Criterion for MVP: `addPosition()` call is unmodified and works as-before.

**Why:**
- Adapter pattern hides Nostr routing from component
- Component calls `addPosition(marketId, title, direction, qty, price)` as before
- positionStore handles the rest
- Optional live position display would improve UX but requires hook integration (deferred)

---

## Execution Order

Numbered steps with verification for each. All steps assume codebase is on `main` branch, tests passing (64 tests currently).

### Phase 1: Core Service Implementation

1. **Create src/positions/types.ts (or src/types.ts) with shared types**
   - Move Position, PositionDirection types to this file
   - Export: `type Position`, `type PositionDirection`, `type ParseResult`, `type ValidationResult`
   - **Verify:** No circular imports; both positionService and positionStore can import from this file

2. **Create positionService.ts**
   - Import Position, PositionDirection from types file
   - Implement ParseResult, ValidationResult types (if not in shared types file)
   - Implement serializePositionToEvent (tags: d-tag, c-tag, v-tag; content: JSON)
   - Implement parsePositionEvent, validatePositionEvent
   - Implement computeWeightedAveragePosition
   - Implement publishPosition, fetchPositions, subscribeToPositions (filters use `#c: ['cascade']`)
   - Implement parsePositionKeyFromDTag helper (renamed from extractPositionIdFromDTag)
   - **Verify:** No syntax errors (`npm run type-check`); exports visible to other modules

2. **Create usePositions hook**
   - Implement usePositions(marketId?: string)
   - **CRITICAL:** Hook reads from positionStore._positionsCache ONLY. NO subscriptions created here (single subscription authority in positionStore).
   - Hook listens to positionStore cache updates (via event emitter, callback, or re-render trigger when positionStore mutates cache)
   - Optional implementation: Use `MutationObserver` on localStorage to trigger updates, OR use positionStore.on('positionsChanged') event, OR use React Context for cache refresh
   - If marketId provided, filter cache to that market only
   - Returns { positions, loading, error }
   - **Verify:** Hook can be imported and called; reading from cache works; no duplicate subscriptions

3. **Refactor positionStore.ts with queue-based sequential updates and single subscription authority**
   - Import Position, PositionDirection from neutral types file
   - Add internal state: `_positionsCache`, `_usingNostr`, `_migrationDone`, `_subscription`, `_operationQueue (Map<string, Promise>)`
   - **Queue per logical key (market+direction):** When addPosition or removePosition called, enqueue the operation on `"${marketId}:${direction}"` key. Wait for previous operation to complete before starting new one. This prevents race condition from rapid clicks.
   - Implement initializePositions(pubkey, ndk, signer?):
     - **Single subscription authority:** Only place subscriptions are created. Hook will read from cache only.
     - Signer retry logic: Attempt detection, retry up to 3 times with 2s backoff if fails. Log warning once, then silent fallback
     - Fetch from Nostr: `positionService.fetchPositions(ndk, pubkey, filter: { kinds: [30078], authors: [pubkey], '#c': ['cascade'] })`
     - Subscribe to Nostr: `positionService.subscribeToPositions(ndk, pubkey)` → update _positionsCache when events arrive
     - Call migrateFromLocalStorageIfNeeded if appropriate
   - Implement migrateFromLocalStorageIfNeeded(pubkey, ndk):
     - Check localStorage, fetch existing data, publish to Nostr, set _migrationDone = true
     - DO NOT clear localStorage; keep as write-through backup
   - Refactor loadPositions to return _positionsCache
   - Refactor addPosition(marketId, title, direction, qty, price) to:
     - Enqueue on key: `"${marketId}:${direction}"`
     - Fetch current position from Nostr (if exists)
     - Compute weighted average
     - Publish merged position via positionService
     - Update _positionsCache
     - Write to localStorage immediately (synchronous)
   - Refactor savePositions to write to both localStorage (sync) and Nostr (async fire-and-forget)
   - Refactor removePosition(id) to enqueue similarly, publish deletion marker
   - **Verify:** All exported functions have same signature; no broken imports in existing components

4. **Update App.tsx**
   - Add useNostr() hook call with explicit guard:
     ```typescript
     const nostr = useNostr()
     if (!nostr) throw new Error('NostrContext not available - App must be wrapped in NostrProvider')
     ```
   - Add useEffect that calls initializePositions(pubkey, nostr.ndk) when isReady and pubkey available:
     ```typescript
     useEffect(() => {
       if (!isReady || !pubkey) return
       try {
         positionStore.initializePositions(pubkey, nostr.ndk, signer)
       } catch (err) {
         console.error('Failed to initialize positions:', err)
         // App continues; positions fallback to localStorage
       }
     }, [isReady, pubkey, nostr.ndk, signer])
     ```
   - Handle errors gracefully (catch, log, fall back to localStorage)
   - **Verify:** App starts without errors; positions initialize when signer available; fallback to localStorage works

### Phase 2: Testing

5. **Create positionService.test.ts**
   - Implement all 30+ tests (serialization, parsing, validation, weighted average, transport, migration)
   - Run: `npm run test -- positionService.test.ts`
   - **Verify:** All tests pass

6. **Update storage.test.ts (if needed)**
   - Add 3–5 tests for adapter behavior
   - Run: `npm run test -- storage.test.ts`
   - **Verify:** All existing + new tests pass (now 67–69 tests)

7. **Run full test suite**
   - `npm run test`
   - **Verify:** All 67+ tests pass (no regressions in existing 64)

### Phase 3: Integration & UI Verification

8. **Manual integration test: Anonymous user flow**
   - Open app with no NIP-07 extension installed
   - Buy a position → position appears in Portfolio
   - Reload page → position persists (localStorage)
   - Check browser DevTools → localStorage has `cascade-positions` key
   - **Verify:** Positions survive reload; no Nostr calls attempted

9. **Manual integration test: Logged-in user flow**
   - Open app with NIP-07 extension (e.g., Alby, Nos2x)
   - Sign in → pubkey visible in app
   - Buy a position → position appears in Portfolio
   - Open DevTools Network tab → POST requests to relay for kind 30078 event (positionService.publishPosition)
   - Reload page → position reappears from Nostr (positionService.fetchPositions)
   - **Verify:** Position published to Nostr; persists across reload; no localStorage used

10. **Manual integration test: Migration on first login**
    - Clear browser data (localStorage, IndexedDB, cookies)
    - Open app as anonymous → add position (localStorage)
    - Install NIP-07 extension, unlock it
    - Refresh page → app detects pubkey + localStorage positions
    - Check Network tab → kind 30078 event published (migrateFromLocalStorageIfNeeded)
    - Reload again → position from Nostr, not localStorage
    - **Verify:** Old positions migrated; localStorage cleared after success

11. **Manual integration test: Weighted average on Nostr**
    - User logged in
    - Buy 100 shares at $0.50 (position 1)
    - Buy 100 shares at $0.60 (position 2, same market+direction)
    - Check Portfolio → quantity = 200, entryPrice ≈ $0.55
    - Check Network tab → single kind 30078 event published with updated position
    - **Verify:** Averaging correct; single Nostr event (not two)

12. **Manual integration test: Rapid trade queue (race condition prevention)**
    - User logged in
    - Rapidly click "BUY" button 5 times (same market+direction, within 100ms)
    - Wait for all writes to complete
    - Check Portfolio → single position with quantity = 500, correct weighted average price
    - Check localStorage → positions match Portfolio
    - Check Nostr Network tab → exactly one kind 30078 event published (queue serialized updates)
    - **Verify:** No data loss; queue prevented race condition

13. **Manual integration test: Signer unavailable → fallback retry**
    - Start app with NIP-07 extension installed but NOT unlocked
    - Try to add position → watch for retry messages in console (up to 3 retries, 2s backoff)
    - Position falls back to localStorage after timeout
    - Unlock extension → manually trigger re-initialization (F5 refresh)
    - Position migrates to Nostr
    - **Verify:** No permanent data loss; smooth signer availability detection

14. **Manual integration test: Offline persistence**
    - User logged in, connected to relay
    - Add position → published to Nostr successfully
    - Disconnect network (DevTools → offline)
    - Add another position → cache + localStorage updated, Nostr publish fails silently (logged)
    - Reconnect network
    - Wait 2-5 seconds for subscription to refetch
    - Both positions visible in Portfolio
    - **Verify:** Offline writes persisted; sync on reconnect

12. **Manual integration test: Cross-device sync (optional, if relay accessible)**
    - User logged in, adds position
    - Open same app in incognito window, sign in with same extension
    - Positions visible immediately from Nostr subscription
    - **Verify:** Live sync across tabs/windows/devices

### Phase 4: Cleanup & Docs

13. **Update project documentation** (tenex/docs/)
    - Add: "Position Persistence Architecture" section
    - Note: Kind 30078 events, d-tag format, caching strategy
    - Link to positionService.ts, usePositions.ts for developers

14. **Update AGENTS.md** (if applicable)
    - Note that position migrations are async and gracefully degrade

---

## Verification

### Automated Checks
```bash
# Type check (ensure no TypeScript errors)
npm run type-check

# Lint (catch style/logic issues)
npm run lint

# Unit tests (all positionService and storage tests)
npm run test

# Build (ensure no bundler errors)
npm run build
```

### Manual Checks
1. **Browser DevTools → Application → Local Storage**
   - Anonymous user: `cascade-positions` key present, JSON array
   - Logged-in user after first sync: `cascade-positions` key cleared (if migration successful)

2. **Browser DevTools → Application → IndexedDB (NDK cache, if used)**
   - Logged-in user: Kind 30078 events cached by NDK

3. **Browser DevTools → Network → WebSocket (Nostr relay)**
   - Logged-in user: REQ messages filtering for kind 30078 with user's pubkey
   - Kind 30078 EVENT messages received from relay (user's positions)

4. **Portfolio page**
   - All positions display with correct quantity, entry price, PnL
   - Positions persist across page reload
   - Weighted-average prices correct (e.g., 100 @ $0.50 + 100 @ $0.60 = 200 @ $0.55)

5. **React DevTools → Components → Providers**
   - NostrContext.pubkey populated (logged-in) or null (anonymous)
   - usePositions hook returns positions array

### Edge Cases to Test
- User has localStorage positions but no NIP-07 signer → fallback to localStorage only, no errors
- User logs in, network unavailable → fetch fails, fall back to empty cache (positions appear after reconnect via subscription)
- Rapid clicks on "BUY" button for same position (5x rapid clicks) → queue serializes updates, all 5 trades merge into single position with correct weighted average, no data loss
- Signer unavailable on first load (extension not loaded) → retry logic triggers, falls back to localStorage after 3 retries with 2s backoff, no permanent data loss
- Signer extension permission denied → retry logic times out, falls back to localStorage, app continues
- User publishes position, relay goes down before ACK → error logged, cache + localStorage both updated, Nostr out-of-sync (acceptable, resync on next successful publish)
- User removes position via removePosition() → cache cleared, Nostr event published with deletion marker (or quantity=0)
- User closes browser while offline (no Nostr sync) → localStorage has positions; on reopening, fetch from localStorage, retry Nostr on background
- Large number of positions (100+) → fetch all via `{ kinds: [30078], authors: [pubkey], '#c': ['cascade'] }` filter, client-side filtering for valid d-tags (relay doesn't support pagination in MVP)

---

## Scope Checklist

✅ **In Scope:**
- [ ] New `src/services/positionService.ts` with Nostr CRUD (pure domain logic + transport)
- [ ] New `src/positions/types.ts` (or `src/types.ts`) for shared Position, PositionDirection types (circular dependency prevention)
- [ ] New `src/hooks/usePositions.ts` hook (reads from positionStore cache, single subscription authority)
- [ ] Refactored `src/positionStore.ts` adapter with queue-based sequential updates
- [ ] First-login migration (localStorage → Nostr) with signer retry logic
- [ ] Kind 30078 (NIP-78) event persistence with app tag `['c', 'cascade']` for efficient relay filtering
- [ ] Weighted-average merge logic with sequential queue per (market+direction)
- [ ] ParseResult, ValidationResult discriminated unions
- [ ] Graceful fallback to localStorage (no signer)
- [ ] Offline-first pattern: localStorage write-through backup + async Nostr publish
- [ ] Offline write queue via localStorage durability (positions survive browser close)
- [ ] positionService unit tests (30+)
- [ ] positionStore adapter tests (3-5)
- [ ] App.tsx initialization with NostrContext guard
- [ ] Manual integration tests (8-12, listed in Execution Order)
- [ ] All existing 64 tests still passing (0 regressions)

❌ **Out of Scope:**
- [ ] Multi-user position sharing or collaboration (positions are user-exclusive)
- [ ] Position deletion via NIP-5 deletion events (use quantity=0 marker only)
- [ ] Pagination/infinite scroll for large position lists (MVP: fetch all)
- [ ] Backup signer / anti-rollback checks (unlike markets; positions are user-only)
- [ ] Real-time sync to other Cascade components (e.g., market reserve updates)
- [ ] Position history tracking (e.g., audit trail of all trades)
- [ ] Archival or soft-delete (remove position via removePosition() function only)

---

## Known Limitations

**Deferred in This Migration:**
1. **Position deletion via Nostr events**
   - Current approach: removePosition() removes from cache + publishes quantity=0 or deletion marker
   - Future: Implement NIP-5 deletion events for true deletion semantics (out of scope for MVP)

2. **Pagination for large position sets**
   - Current: fetchPositions queries all user's positions (NDK handles relay subscription limit)
   - If user has 1000+ positions, fetch may be slow or incomplete
   - Future: Implement pagination or lazy-load (out of scope; assume <100 positions in practice)

3. **Position history and audit trail**
   - Nostr stores only current position state (via kind 30078 replaceable event)
   - To track trade history, would need kind 1 event log or separate kind 30079
   - Current: Portfolio PnL is read-only snapshot; no ledger (future work)

4. **Offline write queue** — **MOVED TO IN-SCOPE**
   - Problem: If user adds position while offline, then closes browser before reconnecting, position is lost (if localStorage cleared)
   - Solution: Keep localStorage as write-through backup even after Nostr migration (see savePositions pattern)
      - Every position written to localStorage immediately (synchronous guarantee)
      - On reconnect/refocus: fetch from Nostr, compare with localStorage, resolve conflicts
      - localStorage acts as durable outbox; Nostr is primary
   - This provides correctness without explicit queue implementation
   - Current: savePositions() writes to both localStorage and Nostr (see offline pattern above)

5. **Cross-device real-time sync**
   - Positions subscribe to live updates, but tab 1 → tab 2 sync requires relay relay-around-trip
   - Current: Acceptable latency (1–2 sec)
   - Ultra-low-latency sync (e.g., SharedArrayBuffer, same-origin postMessage) not implemented (out of scope)

---

## Success Criteria

A successful implementation is defined by ALL of the following:

1. ✅ **Type Safety**: TypeScript compiles without errors (`npm run type-check` passes)

2. ✅ **Test Coverage**: All 30+ positionService tests pass; all 64 existing tests pass; 0 regressions

3. ✅ **Backward Compatibility**: Position type unchanged; all exported functions (loadPositions, addPosition, getPositionsForMarket, removePosition) have same signature and behavior; components need zero edits

4. ✅ **Nostr Persistence**: Logged-in user's positions persisted to kind 30078 events on Nostr; survive browser reload

5. ✅ **Graceful Degradation**: Anonymous user (no signer) silently uses localStorage; same UX; no errors logged

6. ✅ **Weighted Average**: When addPosition() called on existing market+direction, entry price correctly weighted-averaged; single Nostr event published (not multiple)

7. ✅ **First-Login Migration**: On first login, existing localStorage positions serialized + published to Nostr; localStorage cleared after success

8. ✅ **Live Subscription**: usePositions hook subscribes to live Nostr updates; Portfolio reflects new positions within 1–2 seconds of relay event

9. ✅ **Error Resilience**: Nostr errors (network, relay unavailable) logged but non-fatal; fallback to cache or localStorage; app continues

10. ✅ **Manual Acceptance**: All integration tests (steps 8–12) pass; DevTools inspection confirms correct localStorage/Nostr usage by user type

11. ✅ **Documentation**: positionService.ts and usePositions.ts documented with examples; Architecture section added to tenex/docs

12. ✅ **Code Quality**: positionService and positionStore follow existing patterns (discriminated unions, pure functions, error handling); no TODOs or FIXMEs left in implementation
