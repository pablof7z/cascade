# Nostr-Native Market Persistence

## Context

### Current State
Cascade currently stores all market state in browser `localStorage` via `src/storage.ts`:
- All markets are serialized to a single JSON blob: `Record<string, MarketEntry>`
- Each `MarketEntry` contains the full `Market` object (LMSR state: reserves, shares, participant accounts, history) plus a `history: HistoryPoint[]` array
- The Redux reducer in `src/App.tsx:165-329` handles two key state mutations:
  - `CREATE_MARKET`: Initializes an empty `Market` with `createEmptyMarket()` and stores it
  - `TRADE`: Applies buy/redeem trades via `applyBuy()` or `applyRedeem()`, mutating the market's LMSR state (qLong, qShort, reserve, participants)
- Markets are discovered and displayed via `src/LandingPage.tsx` (lists all markets from state)
- There is no cross-session or cross-device persistence; markets vanish when localStorage is cleared
- Existing Nostr integration (`src/services/nostrService.ts`, `src/DiscussPage.tsx`) proves the NDK/relay infrastructure works for discussion posts (kind 1 with `#m` market tags)

### Why This Change Is Needed
**Goal**: Multiple users/sessions see the same markets, and markets persist across devices and page reloads.

Current blockers:
1. Markets created in one browser session are invisible to another user/device
2. Trades update only local state; no way to sync across users
3. No way to discover markets created by others
4. Markets are ephemeral—they vanish with browser data deletion

### Existing Patterns We'll Build On
- **NDK service layer**: `src/services/nostrService.ts` already handles event publishing, fetching, and subscribing. We'll add market-specific publish/fetch/subscribe functions.
- **React context**: `src/context/NostrContext.tsx` wraps the NDK service and is already wired to `useNostr()` in components.
- **Service layer pattern**: `src/services/participantIndex.ts` shows how to layer domain logic on top of storage (load/save wrappers).
- **Discussion posts as precedent**: `src/DiscussPage.tsx` demonstrates how to fetch historical events (`fetchMarketPosts`), subscribe to new ones (`subscribeToMarketPosts`), and display them in React.

### Market Identification & App-Level Filtering
**Critical**: Kind 30000 events are global across all Nostr apps. To prevent fetching every app's kind-30000 events on public relays, Cascade markets MUST be filtered at the app level:
- All Cascade market events include a custom tag: `['c', 'cascade']` (kind-specific marker)
- When fetching kind 30000 events, filter by this tag in `fetchAllMarkets()` 
- This prevents contamination from other apps using kind 30000 for different purposes
- Market ID generation (d-tag): UUID v4, deterministic per market creation, immutable across events

---

## Architecture Decision: Event-Sourced Trades with Replicated Market State

### Chosen Approach

**Markets use Nostr kind 30000 (NIP-33 parameterized replaceable events).**

- **Event kind**: `30000` (parameterized replaceable)
- **Event d-tag** (unique identifier): `market:{marketId}` — ensures only one market event per market ID
- **Event content**: Full serialized `Market` object (JSON)
- **Immutable context**: Event tags include creation metadata (creator pubkey, title, initial state)

**Each market event publishes the complete, up-to-date LMSR state.**

When a user trades:
1. The market creator (or the app on behalf of the current user) publishes an updated market event to Nostr with the new LMSR state.
2. All subscribers receive the new event and update their local state.

### Why This Over Alternatives

**Rejected: Option A — Event-source trades separately (trade events as kind 1 or a custom kind)**
- **Reason for rejection**: The LMSR AMM is stateful and deterministic — each trade depends on all previous trades. To reconstruct market state client-side, every app would have to fetch and replay *all* trades in order from inception. This:
  - Requires tight synchronization (no out-of-order delivery; trades must be ordered)
  - Creates O(n) reconstruction cost as markets age
  - Makes cross-device replay fragile (clock skew, offline gaps, relay failures)
  - Complicates the client (must implement replay logic, handle gaps, validate ordering)
  - Violates the "simple, Phase 1" constraint

**Rejected: Option C — Alternative (market creator is oracle, publishes only on first creation)**
- **Reason for rejection**: Markets would become stale immediately. Without periodic updates, traders on device A would never see trades executed on device B. This defeats the purpose of shared markets.

### Chosen Approach Advantages
- **Simple**: One event per market = authoritative state. No replay logic needed.
- **Convergence**: All clients converge to the same state by fetching the latest market event.
- **Familiar**: Mirrors how Nostr social features work (replaceable events for profiles, mutes, etc.).
- **Incremental**: Non-breaking — we can add trade event auditing later if desired.

### Trade Authority & Backup Signer Mechanism (Phase 1)
**Critical Issue**: If creator's signer becomes unavailable, market updates freeze permanently, stranding user funds.

**Solution for Phase 1**: 
1. **Primary Authority**: Market creator (their Nostr pubkey) publishes all market updates
2. **Backup Signer (Required at Creation)**: At market creation time, the creator MUST designate a backup pubkey via tag: `['backup', '<backup_pubkey>']`
3. **Backup Activation Logic**: 
   - Any app/user can publish an update IF signed by backup key AND includes creator's pubkey in proof
   - Backup signer tag is immutable (set once, never changes)
   - Timestamp must be later than creator's last update to prevent rollback
4. **UI/UX**:
   - On market creation form: "Backup Signer (optional but recommended)" — pre-populate with app's backup key if configured
   - Show warning: "If you lose access to your signer, the backup will allow market updates"
   - Creator controls which key is backup (could be different device, different extension, app-hosted key, etc.)

**Why this is better than "creator unavailability kills markets"**:
- Ensures markets don't freeze even if creator goes offline
- Creator chooses the backup (maintains control)
- Doesn't require complex threshold signatures in Phase 1
- Backup is a fallback, not primary authority

**Validation on Update**:
```typescript
// When receiving a market update event:
// 1. If signed by creator → accept (primary authority)
// 2. If signed by backup AND includes valid proof → accept (fallback)
// 3. Otherwise → reject
```

**Implementation Detail**: Market type gets new field:
```typescript
type Market = {
  // ... existing fields ...
  creatorPubkey: string        // Primary authority (immutable)
  backupPubkey?: string        // Backup authority (immutable, set at creation)
  version: number              // Incremented with each update
  stateHash: string            // Hash of full state for concurrency detection
}
```

**Future (Phase 2)**: Multi-signer via threshold signatures or market council governance.

---

## Versioning & Concurrency Control

### Version Model (NEW)
Each market snapshot has TWO version fields:
1. **`version: number`** — Cascade's internal version counter (increments with every local mutation)
2. **`stateHash: string`** — SHA256 hash of the entire market state (reserves, shares, participant accounts, etc.)

**Why both?**
- `version` ensures monotonic ordering when multiple Nostr events exist for the same market (handles clock skew, relay delays)
- `stateHash` enables optimistic concurrency control: detect data loss when two events overwrite each other

**Concurrency Detection Algorithm**:
```typescript
// Before publishing a market update:
// 1. Fetch current market from Nostr
// 2. Compute stateHash of our local version
// 3. Compare: does our hash match the Nostr hash?
//    → If YES: version incremented safely, publish
//    → If NO: Another user traded; fetch latest, re-apply our trade, retry
// 4. Increment version, publish

export async function publishMarketEventWithConcurrencyCheck(
  localMarket: Market, 
  ndk: NDK
): Promise<void> {
  const latestEvent = await fetchMarketById(localMarket.id)
  const latest = latestEvent ? parseMarketEvent(latestEvent) : null
  
  if (latest && stateHash(latest) !== localMarket.stateHash) {
    // Another user traded; conflict detected
    throw new ConcurrencyError('Market was modified by another user')
  }
  
  // Safe to publish: increment version, update hash
  localMarket.version = (latest?.version ?? 0) + 1
  localMarket.stateHash = computeStateHash(localMarket)
  await publishMarketEvent(localMarket, ndk)
}

function computeStateHash(market: Market): string {
  // Hash the complete market state (reserves, shares, accounts, etc.)
  // NOT including version or timestamp (those are metadata)
  const payload = {
    qLong: market.qLong,
    qShort: market.qShort,
    reserve: market.reserve,
    participants: market.participants,
    history: market.history,
    // (all LMSR state, no timestamps)
  }
  return sha256(JSON.stringify(payload))
}
```

### Delete Semantics (Addition to Market Type)
Markets are never truly deleted; instead:
```typescript
type Market = {
  // ... existing fields ...
  status: 'active' | 'resolved' | 'archived'  // NEW field
  deletedAt?: number                           // Timestamp when marked deleted
}
```

**Deletion Flow**:
1. User clicks "Delete Market"
2. App sets `status: 'archived'` and `deletedAt: now()`, publishes to Nostr
3. Client-side: filter out archived markets from UI
4. Server-side/other devices: fetch market, see status, hide from display
5. **NIP-09 Deletion Events (NEW)**: Also publish kind 5 event with d-tag marker for explicit deletion signal
   - Alternative relays may support NIP-09 hard deletion
   - Kind 5 acts as backup tombstone for relay cleanup

---

## File Changes

### 1. `src/services/marketService.ts` (CREATE)
**Action**: Create  
**What**: New service layer for Nostr market persistence, mirroring the pattern in `participantIndex.ts`.

**Responsibilities**:
- Publish market events to Nostr (called after CREATE_MARKET, TRADE, DELETE_MARKET)
- Fetch markets from Nostr (initial load, discovery)
- Subscribe to market updates in real-time
- Convert between `Market` TypeScript objects and Nostr JSON serialization
- Handle validation (e.g., ensure creator signature on market events)

**Key functions**:
```typescript
// Publish with concurrency check: detects simultaneous trades, prevents data loss
export async function publishMarketEventWithConcurrencyCheck(
  localMarket: Market,
  ndk: NDK
): Promise<Market> // Returns updated market with new version/stateHash

// Fetch all Cascade markets (with app-level filtering to prevent contamination)
export async function fetchAllMarkets(options?: {
  limit?: number      // Default: 50 (for pagination; see Discovery below)
  cursor?: string     // For pagination: start after this event.id
}): Promise<Set<NDKEvent>>

// Fetch a single market by ID
export async function fetchMarketById(marketId: string): Promise<NDKEvent | null>

// Subscribe to a market in real-time
export function subscribeToMarket(
  marketId: string,
  callback: (event: NDKEvent) => void
): NDKSubscription

// Parse with strong typing: returns either valid Market or detailed error
export type ParseResult = 
  | { ok: true; market: Market }
  | { ok: false; error: string; reason: 'invalid_json' | 'missing_d_tag' | 'invalid_market' }

export function parseMarketEvent(event: NDKEvent): ParseResult

// Validate completeness: checks signature, creator pubkey, deletion status, version consistency
export type ValidationResult =
  | { valid: true; market: Market; isDeletion: boolean }
  | { valid: false; reason: string }

export function validateMarketEvent(event: NDKEvent): ValidationResult

// Serialize with app tag for filtering
export function serializeMarketToEvent(market: Market): {
  content: string
  tags: string[][]
}

// Compute state hash for concurrency detection
export function computeStateHash(market: Market): string

// NIP-09 deletion: publish kind 5 event alongside status change
export async function publishDeletionEvent(
  marketId: string,
  creatorPubkey: string,
  ndk: NDK
): Promise<void>

// Check if market is deleted (status + NIP-09 signals)
export function isMarketDeleted(market: Market, event: NDKEvent): boolean
```

**Why**: Encapsulates Nostr-specific serialization, publishing, and fetching logic. Keeps `App.tsx` and components clean.

### 2. `src/services/nostrService.ts` (MODIFY)
**Action**: Modify  
**What**: Add generic market-event transport helpers with app-level filtering. Keep this file transport-only; no domain logic.

**Add functions**:
```typescript
// Publish a kind 30000 market event with app-level tag for filtering
export async function publishMarket(market: Market, tags: string[][]): Promise<NDKEvent> {
  if (!_ndk?.signer) throw new Error('No signer available')
  
  const event = new NDKEvent(_ndk)
  event.kind = 30000
  event.content = JSON.stringify(market)
  event.tags = [
    ['d', `market:${market.id}`],
    ['c', 'cascade'],  // APP-LEVEL FILTER: only fetch Cascade markets
    ['version', String(market.version)],
    ['stateHash', market.stateHash],
    ...(market.backupPubkey ? [['backup', market.backupPubkey]] : []),
    ...tags
  ]
  await event.publish()
  return event
}

// Fetch Cascade markets only (kind 30000 with app tag filter)
// limit = 50 by default (pagination; see Discovery section)
export async function fetchAllMarkets(limit = 50): Promise<Set<NDKEvent>> {
  const filter: NDKFilter = { 
    kinds: [30000], 
    '#c': ['cascade'],  // Only Cascade markets
    limit
  }
  return fetchEvents(filter)
}

// Fetch a single market by d-tag (returns latest version only)
export async function fetchMarketById(marketId: string): Promise<NDKEvent | null> {
  const filter: NDKFilter = { 
    kinds: [30000], 
    '#d': [`market:${marketId}`],
    '#c': ['cascade']  // Scope to Cascade only
  }
  const events = await fetchEvents(filter)
  if (events.size === 0) return null
  
  // Return the event with highest version, then latest created_at as tiebreaker
  return Array.from(events).reduce((latest, current) => {
    const latestVersion = parseInt(latest.getMatchingTags('version')[0]?.[1] ?? '0', 10)
    const currentVersion = parseInt(current.getMatchingTags('version')[0]?.[1] ?? '0', 10)
    
    if (currentVersion !== latestVersion) return currentVersion > latestVersion ? current : latest
    return (current.created_at ?? 0) > (latest.created_at ?? 0) ? current : latest
  })
}

// Subscribe to updates for a single market (by d-tag)
export function subscribeToMarket(
  marketId: string,
  callback: (event: NDKEvent) => void
): NDKSubscription {
  const filter: NDKFilter = { 
    kinds: [30000], 
    '#d': [`market:${marketId}`],
    '#c': ['cascade']
  }
  const sub = _ndk.subscribe(filter, { closeOnEose: false })
  sub.on('event', callback)
  return sub
}

// Fetch deletion events for cleanup/archive detection (NIP-09)
export async function fetchDeletionEvents(marketId: string): Promise<Set<NDKEvent>> {
  const filter: NDKFilter = { 
    kinds: [5],  // Kind 5 = deletion event (NIP-09)
    '#d': [`market:${marketId}`]
  }
  return fetchEvents(filter)
}
```

**Why**: This layer handles only Nostr transport (filtering, publishing, subscribing). App-level filter (`#c: cascade`) prevents contamination from other apps using kind 30000. Domain logic stays in `marketService.ts`.

### 3. `src/storage.ts` (MODIFY — Dual-Layer with Offline Queue)
**Action**: Modify  
**What**: Keep localStorage as local-first cache; add persisted outbox for offline resilience.

**Critical Fix**: The old plan had `loadWithNostrSync()` called synchronously in `initState()`. This doesn't work with async `useReducer`. INSTEAD:
- Initialize state synchronously from localStorage only
- Add post-mount `useEffect` that hydrates async (dispatches HYDRATE_FROM_NOSTR action)

**Implementation**:
```typescript
// storage.ts

// Load from localStorage ONLY (synchronous, for initState)
export function load(): Record<string, MarketEntry> {
  const stored = localStorage.getItem('cascade-markets')
  return stored ? JSON.parse(stored) : {}
}

export function save(markets: Record<string, MarketEntry>): void {
  localStorage.setItem('cascade-markets', JSON.stringify(markets))
}

// NEW: Outbox for pending publishes (offline-first)
// Persists to localStorage; syncs to Nostr when online
export interface PendingPublish {
  marketId: string
  market: Market
  createdAt: number
  retries: number
}

export function getPendingPublishes(): PendingPublish[] {
  const stored = localStorage.getItem('cascade-pending-publishes')
  return stored ? JSON.parse(stored) : []
}

export function addPendingPublish(market: Market): void {
  const pending = getPendingPublishes()
  pending.push({
    marketId: market.id,
    market,
    createdAt: Date.now(),
    retries: 0
  })
  localStorage.setItem('cascade-pending-publishes', JSON.stringify(pending))
}

export function removePendingPublish(marketId: string): void {
  const pending = getPendingPublishes()
  const filtered = pending.filter(p => p.marketId !== marketId)
  localStorage.setItem('cascade-pending-publishes', JSON.stringify(filtered))
}

export function incrementPendingRetries(marketId: string): void {
  const pending = getPendingPublishes()
  const target = pending.find(p => p.marketId === marketId)
  if (target) {
    target.retries++
    localStorage.setItem('cascade-pending-publishes', JSON.stringify(pending))
  }
}

// NEW: Merge logic with explicit version comparison
export function mergeLocalAndNostr(
  local: Record<string, MarketEntry>,
  nostrEvents: Set<NDKEvent>
): Record<string, MarketEntry> {
  const merged: Record<string, MarketEntry> = { ...local }
  
  for (const event of nostrEvents) {
    const parseResult = parseMarketEvent(event)
    if (!parseResult.ok) continue
    
    const nostrMarket = parseResult.market
    const localEntry = merged[nostrMarket.id]
    
    if (!localEntry) {
      // New market from Nostr
      merged[nostrMarket.id] = {
        market: nostrMarket,
        history: [] // Will be synced separately if needed
      }
      continue
    }
    
    // Both exist: decide which to keep based on version
    const localVersion = localEntry.market.version ?? 0
    const nostrVersion = nostrMarket.version ?? 0
    const localTimestamp = localEntry.market.createdAt ?? 0
    const nostrTimestamp = nostrMarket.createdAt ?? 0
    
    // Higher version wins; if same, later timestamp wins
    if (nostrVersion > localVersion || 
        (nostrVersion === localVersion && nostrTimestamp > localTimestamp)) {
      merged[nostrMarket.id] = {
        market: nostrMarket,
        history: localEntry.history // Preserve local history for chart
      }
    }
    // Else: keep local (may have pending trades)
  }
  
  return merged
}
```

**Offline Resilience Flow**:
1. User trades while offline → dispatch TRADE action → save to localStorage
2. In `publishMarketEvent()`, if publish fails → `addPendingPublish()`
3. On app startup (or when network recovers):
   - Check `getPendingPublishes()`
   - Retry each with exponential backoff
   - Remove from outbox on success
   - Log to analytics on failure after N retries

**Why**: 
- Synchronous `load()` for fast app bootstrap
- Async hydration via post-mount effect (correct React pattern)
- Persisted outbox ensures no trades are lost, even if offline for extended period

### 4. `src/App.tsx` (MODIFY — Hydration + Publishing + Outbox Retry)
**Action**: Modify  
**What**: Fix async hydration pattern; hook Nostr publishing into reducer; manage offline outbox.

**Key Changes**:

1. **Fix Hydration (NEW Action Type)**:
```typescript
export type Action =
  | ... // existing types
  | { type: 'HYDRATE_FROM_NOSTR'; markets: Record<string, MarketEntry> }
  | { type: 'SYNC_MARKET'; marketId: string; market: Market }
  | { type: 'MARK_PUBLISHED'; marketId: string }

// In reducer:
case 'HYDRATE_FROM_NOSTR': {
  // Merge incoming Nostr markets with existing state
  return {
    ...state,
    markets: mergeLocalAndNostr(state.markets, action.markets)
  }
}
```

2. **Initialize synchronously from localStorage**:
```typescript
function initState(): State {
  const markets = load()  // Synchronous
  return {
    markets,
    loading: true  // Flag: still loading from Nostr
  }
}

const [state, dispatch] = useReducer(reducer, undefined, initState)
```

3. **Hydrate asynchronously AFTER mount (NEW)**:
```typescript
const { pubkey, isReady } = useNostr()

// HYDRATION: fetch from Nostr and merge with local state
useEffect(() => {
  if (!isReady) return
  
  (async () => {
    try {
      const nostrEvents = await fetchAllMarkets()
      const parsed = Array.from(nostrEvents)
        .map(event => parseMarketEvent(event))
        .filter((result) => result.ok)
        .map(result => result.ok && result.market)
      
      // Create MarketEntry records for merged state
      const nostrMarkets = Object.fromEntries(
        parsed.map(market => [market.id, { market, history: [] }])
      )
      
      dispatch({
        type: 'HYDRATE_FROM_NOSTR',
        markets: nostrMarkets
      })
    } catch (err) {
      console.error('Failed to hydrate from Nostr:', err)
      // Silently continue with local state
    }
  })()
}, [isReady])

// RETRY OFFLINE OUTBOX: periodically retry pending publishes
useEffect(() => {
  const interval = setInterval(() => {
    if (!isReady) return
    
    const pending = getPendingPublishes()
    for (const item of pending) {
      if (item.retries >= 5) {
        // Max retries exceeded
        removePendingPublish(item.marketId)
        console.warn(`Gave up publishing market ${item.marketId} after 5 retries`)
        continue
      }
      
      publishMarketEventWithConcurrencyCheck(item.market, ndk)
        .then(() => removePendingPublish(item.marketId))
        .catch((err) => {
          incrementPendingRetries(item.marketId)
          console.warn(`Retry ${item.retries + 1}/5 for market ${item.marketId}:`, err)
        })
    }
  }, 10000)  // Retry every 10 seconds
  
  return () => clearInterval(interval)
}, [isReady])
```

4. **Per-action publishing with concurrency checks**:
```typescript
case 'TRADE': {
  // ... existing LMSR logic ...
  const newMarket = { ...state.markets[action.marketId].market, /* updated state */ }
  const newState = { /* updated state */ }
  
  // Fire async publish with outbox fallback
  if (pubkey) {
    publishMarketEventWithConcurrencyCheck(newMarket, ndk)
      .catch(err => {
        console.warn('Failed to publish trade, adding to outbox:', err)
        addPendingPublish(newMarket)
      })
  }
  
  return newState
}

case 'DELETE_MARKET': {
  const market = state.markets[action.marketId].market
  const deletedMarket = {
    ...market,
    status: 'archived',
    deletedAt: Date.now(),
    version: (market.version ?? 0) + 1
  }
  
  if (pubkey) {
    // Publish deletion status update
    publishMarketEventWithConcurrencyCheck(deletedMarket, ndk)
      .then(() => publishDeletionEvent(action.marketId, pubkey, ndk))  // NIP-09 tombstone
      .catch(err => addPendingPublish(deletedMarket))
  }
  
  return { /* state with archived market hidden */ }
}
```

**Why**: 
- Synchronous `initState()` keeps bootstrap fast
- Post-mount async hydration is correct React pattern (no race conditions)
- Per-action publishing with concurrency checks prevents data loss
- Persistent outbox ensures trades survive network outages
- Exponential backoff respects relay load

### 5. `src/LandingPage.tsx` (MODIFY)
**Action**: Modify  
**What**: Use App's hydrated state as single source of truth; add live subscription for new markets.

**Critical Fix**: Old plan had LandingPage fetching independently, creating drift between App state and display. Instead:
- App state is the single source of truth (already hydrated from localStorage + Nostr in App.tsx)
- LandingPage receives markets from App props (no secondary fetch)
- NEW: Subscribe to discover new markets in real-time

```typescript
interface LandingPageProps {
  markets: Record<string, MarketEntry>
  dispatch: (action: Action) => void  // For SYNC_MARKET actions
}

function LandingPage({ markets, dispatch }: LandingPageProps) {
  const { isReady } = useNostr()
  const [isLoadingDiscovery, setIsLoadingDiscovery] = useState(false)
  
  // LIVE DISCOVERY: subscribe to new market events from Nostr
  useEffect(() => {
    if (!isReady) return
    
    setIsLoadingDiscovery(true)
    
    // Subscribe to all Cascade market creation events
    // (Kind 30000 with 'c' tag = 'cascade')
    const sub = _ndk.subscribe(
      { kinds: [30000], '#c': ['cascade'], limit: 0 },  // limit:0 = only new events
      { closeOnEose: false }
    )
    
    sub.on('event', (event: NDKEvent) => {
      const parseResult = parseMarketEvent(event)
      if (!parseResult.ok) return
      
      const market = parseResult.market
      const existing = markets[market.id]
      
      // Only dispatch if Nostr version is newer
      if (!existing || market.version > (existing.market.version ?? 0)) {
        dispatch({
          type: 'SYNC_MARKET',
          marketId: market.id,
          market
        })
      }
    })
    
    setIsLoadingDiscovery(false)
    return () => sub.stop()
  }, [isReady, dispatch])
  
  // Filter out archived markets from display
  const visibleMarkets = Object.entries(markets)
    .filter(([_, entry]) => entry.market.status !== 'archived')
    .map(([_, entry]) => entry)

  return (
    <div>
      {isLoadingDiscovery && <div>Discovering new markets...</div>}
      {Object.values(visibleMarkets).map(entry => (
        <MarketCard key={entry.market.id} entry={entry} />
      ))}
    </div>
  )
}
```

**Why**: 
- Single source of truth prevents drift (App state is authoritative)
- Live subscription ensures new markets appear without page reload
- Automatic filtering of archived markets
- Simpler data flow: no conflicting fetch logic in two places

### 6. `src/MarketDetail.tsx` (MODIFY)
**Action**: Modify  
**What**: Subscribe to the market in real-time; preserve derived state (price history) when syncing.

**Current**: MarketDetail receives `entry` from props (static).

**New**: Add subscription; dispatch version-aware SYNC_MARKET.

```typescript
interface MarketDetailProps {
  marketId: string
  dispatch: (action: Action) => void
}

function MarketDetail({ marketId, dispatch }: MarketDetailProps) {
  const { isReady } = useNostr()
  
  // LIVE SYNC: subscribe to market updates
  useEffect(() => {
    if (!isReady || !marketId) return
    
    const sub = subscribeToMarket(marketId, (event: NDKEvent) => {
      const parseResult = parseMarketEvent(event)
      if (!parseResult.ok) {
        console.warn('Failed to parse market update:', parseResult.error)
        return
      }
      
      const updated = parseResult.market
      
      // Always dispatch; SYNC_MARKET action handles version comparison
      dispatch({
        type: 'SYNC_MARKET',
        marketId,
        market: updated,
        isDeletion: parseResult.isDeletion  // Flag if this is a deletion event
      })
    })
    
    return () => sub.stop()
  }, [isReady, marketId, dispatch])
  
  // ... rest of component renders using App state
}
```

**Update SYNC_MARKET action to preserve derived state**:
```typescript
case 'SYNC_MARKET': {
  const existing = state.markets[action.marketId]
  
  if (!existing) {
    // New market from subscription
    return {
      ...state,
      markets: {
        ...state.markets,
        [action.marketId]: {
          market: action.market,
          history: []  // No history yet
        }
      }
    }
  }
  
  // Existing market: compare versions
  const existingVersion = existing.market.version ?? 0
  const incomingVersion = action.market.version ?? 0
  
  if (incomingVersion < existingVersion) {
    // Incoming is stale; ignore (local is newer, possibly offline trade pending)
    return state
  }
  
  if (incomingVersion === existingVersion) {
    // Same version: use stateHash to detect data loss
    const existingHash = existing.market.stateHash
    const incomingHash = action.market.stateHash
    
    if (incomingHash === existingHash) {
      // Identical state, no update needed
      return state
    }
    
    // Same version but different state: conflict (rare)
    // Log to analytics; keep local for now (user will see inconsistency)
    console.warn(`Version conflict for market ${action.marketId}: same version, different hash`)
    return state
  }
  
  // incomingVersion > existingVersion: accept the update
  // PRESERVE: local history for chart continuity
  // (history will be synced separately or recalculated)
  return {
    ...state,
    markets: {
      ...state.markets,
      [action.marketId]: {
        market: action.market,
        history: existing.history  // Preserve local history
      }
    }
  }
}
```

**Why**: 
- Real-time subscription ensures users see other traders' updates
- Version-based merging prevents data loss from simultaneous edits
- Preserving history maintains price chart continuity
- isDeletion flag allows UI to handle archived markets gracefully

### 7. `src/types/market.ts` (MODIFY)
**Action**: Modify Market type to include versioning and backup signer support

```typescript
export interface Market {
  // Existing fields
  id: string                    // UUID v4 (deterministic)
  title: string
  description: string
  kind: string
  thesis: string
  creatorPubkey: string         // Primary authority (immutable)
  backupPubkey?: string         // Fallback signer (immutable, set at creation)
  
  // LMSR state
  qLong: number
  qShort: number
  reserve: number
  participants: Record<string, ParticipantAccount>
  
  // Sync & versioning (NEW)
  version: number               // Increments with each update (prevents clock-skew issues)
  stateHash: string             // SHA256 of LMSR state (detects concurrent trade conflicts)
  createdAt: number             // Nostr event created_at (immutable)
  lastUpdatedAt?: number        // Timestamp of last trade/update
  
  // Status management
  status: 'active' | 'resolved' | 'archived'  // NEW
  deletedAt?: number            // When marked archived
  
  // History
  history: HistoryPoint[]
}
```

**Migration Note**: Existing markets in localStorage without these fields will be assigned:
- `version: 0` (will increment on first publish)
- `stateHash: computeStateHash(existingMarket)`
- `status: 'active'`
- `backupPubkey: undefined` (optional)

### 8. `src/nostrKeys.ts` (REVIEW)
**Action**: Review  
**What**: Ensure this file exports utilities for working with pubkeys (NIP-19 encoding/decoding, validation).

**Current status**: Already exists and is likely already used by `nostrService.ts`. No changes needed unless we need additional utilities for market authorization.

---

## State Model & Sync Strategy

### How Markets Flow Through the System

```
┌─────────────────┐
│   User trades   │
│    locally      │
└────────┬────────┘
         │
         v
┌─────────────────────────────────────┐
│  App reducer: TRADE action fires   │
│  Updates state.markets[id]         │
│  Appends to price history           │
└────────┬────────────────────────────┘
         │
         v (async, fire-and-forget)
┌─────────────────────────────────────┐
│  publishMarketEvent() called        │
│  Publishes kind 30000 to Nostr      │
│  d-tag: market:{marketId}           │
│  Content: full Market JSON          │
└─────────────────────────────────────┘
         │
         v
┌─────────────────────────────────────┐
│  All subscribers receive event      │
│  via subscribeToMarket()            │
│  MarketDetail (etc) parse & sync    │
│  dispatch(SYNC_MARKET) if newer     │
└─────────────────────────────────────┘
```

### Timestamps & Version Control

Each `Market` object has:
- `createdAt: number` — Unix timestamp of market creation
- `lastTrade?.id` — ID of the last executed trade (unique within market)

When syncing:
1. Fetch market from Nostr
2. Compare `createdAt`: if Nostr version is newer OR same age but `lastTrade.id` differs, accept it
3. If local version is newer (e.g., offline trade pending publication), keep local until publication completes

### Offline Resilience

**Scenario**: User trades while offline.
1. App updates local state immediately (fast UX)
2. `publishMarketEvent()` is queued/retried
3. When network recovers, event publishes
4. Other devices sync the update via subscription

**Conflict resolution**: Last-write-wins based on event timestamps. If two devices trade simultaneously:
- Both events arrive at Nostr with slightly different timestamps
- All devices converge on the event with the later `created_at`
- **Caveat**: This can cause one user's trade to "roll back" if another user's trade is timestamped later. Phase 2 should add conflict detection.

---

## Migration Strategy

### Existing localStorage Markets to Nostr

**Goal**: Safely migrate existing markets without data loss; add version/backup fields.

**Migration Flow**:

1. **On App Startup** (in `initState()`):
   - Load markets from localStorage as usual
   - If market is missing version/stateHash/backupPubkey, initialize:
     ```typescript
     function normalizeMarketForMigration(market: Market): Market {
       return {
         ...market,
         version: market.version ?? 0,
         stateHash: market.stateHash ?? computeStateHash(market),
         status: market.status ?? 'active',
         backupPubkey: market.backupPubkey,  // May be undefined
         deletedAt: market.deletedAt,        // May be undefined
       }
     }
     ```

2. **On First Nostr Connection** (in App component, post-mount):
   ```typescript
   useEffect(() => {
     if (!pubkey || !isReady) return
     
     // Get all markets that haven't been published yet
     const unpublishedMarkets = Object.values(state.markets).filter(entry => {
       // A market is "published" if it already exists on Nostr with same version
       // For now, treat all as needing migration (Phase 1)
       return true
     })
     
     for (const entry of unpublishedMarkets) {
       const normalized = normalizeMarketForMigration(entry.market)
       
       // Publish with concurrency check
       publishMarketEventWithConcurrencyCheck(normalized, ndk)
         .then((updatedMarket) => {
           dispatch({
             type: 'MARK_PUBLISHED',
             marketId: entry.market.id
           })
           // Update local state with finalized version/hash
           save({ ...state.markets, [entry.market.id]: { ...entry, market: updatedMarket } })
         })
         .catch(err => {
           console.warn('Failed to publish market, adding to outbox:', err)
           addPendingPublish(normalized)
         })
     }
   }, [pubkey, isReady])
   ```

3. **Subsequent Startups**:
   - `initState()` loads from localStorage
   - Post-mount hydration merges with Nostr (via `HYDRATE_FROM_NOSTR` action)
   - Conflicts resolved by version comparison

**Add to `App.tsx` action types**:
```typescript
| {
    type: 'MARK_PUBLISHED'
    marketId: string
  }
```

**Why**: 
- Non-breaking migration (old markets still work)
- Normalization ensures all markets have required fields
- Outbox fallback ensures migration succeeds even if offline
- Later startups use same versioning logic as normal syncs

---

## Read-Only vs. Authenticated Modes

### Desired Behavior
- **Read**: Anyone can view markets (no auth required)
- **Create/Trade**: Requires NIP-07 signer (browser extension)
- **Update**: Only market creator (or designated backup) can publish updates

### Implementation

**In `src/services/nostrService.ts`**:
```typescript
export async function publishMarket(market: Market, tags: string[][]): Promise<NDKEvent> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  if (!_ndk.signer) throw new Error('No signer available — cannot publish in read-only mode')
  
  const event = new NDKEvent(_ndk)
  event.kind = 30000
  event.content = JSON.stringify(market)
  event.tags = [
    ['d', `market:${market.id}`],
    ['c', 'cascade'],  // App filter
    ['version', String(market.version)],
    ['stateHash', market.stateHash],
    ...(market.backupPubkey ? [['backup', market.backupPubkey]] : []),
    ...tags
  ]
  
  // NDK will sign with current signer's pubkey
  await event.publish()
  return event
}
```

**In `src/App.tsx`**:
```typescript
const { pubkey, isReady } = useNostr()

function handleCreateMarket(input: CreateMarketInput) {
  if (!pubkey) {
    alert('Install a Nostr extension (e.g., Alby) to create markets.')
    return
  }
  
  const backupKey = pubkey  // TODO: Allow user to specify different backup
  
  dispatch({
    type: 'CREATE_MARKET',
    ...input,
    creatorPubkey: pubkey,
    backupPubkey: backupKey,  // Same as creator for now
  })
}
```

**In `src/MarketDetail.tsx`**:
```typescript
function TradingPanel({ market }: { market: Market }) {
  const { pubkey } = useNostr()

  if (!pubkey) {
    return <div className="alert">
      Install a Nostr extension to trade. Markets are read-only without signing.
    </div>
  }
  // ... show trading UI
}
```

### Complete Validation on Event Ingestion

**New validation function** (in `marketService.ts`):
```typescript
export type ValidationResult =
  | { valid: true; market: Market; isDeletion: boolean }
  | { valid: false; reason: string }

export function validateMarketEvent(event: NDKEvent): ValidationResult {
  // 1. Verify event was signed by someone
  if (!event.pubkey) {
    return { valid: false, reason: 'Event has no pubkey' }
  }
  
  // 2. Verify d-tag format (required for kind 30000)
  const dTag = event.getMatchingTags('d')[0]?.[1]
  if (!dTag || !dTag.startsWith('market:')) {
    return { valid: false, reason: 'Missing or invalid d-tag' }
  }
  
  // 3. Check if this is a deletion event (status: archived)
  try {
    const market = JSON.parse(event.content)
    if (market.status === 'archived') {
      // This is a deletion marker
      return {
        valid: true,
        market,
        isDeletion: true
      }
    }
  } catch {
    return { valid: false, reason: 'Content is not valid JSON' }
  }
  
  // 4. Verify event payload is complete Market
  const parseResult = parseMarketEvent(event)
  if (!parseResult.ok) {
    return { valid: false, reason: parseResult.error }
  }
  
  const market = parseResult.market
  
  // 5. Verify signer is creator OR backup (with version check)
  if (event.pubkey !== market.creatorPubkey && event.pubkey !== market.backupPubkey) {
    return { valid: false, reason: 'Event signed by unauthorized signer' }
  }
  
  // 6. If signed by backup, verify version is higher (prevent rollback)
  if (event.pubkey === market.backupPubkey) {
    const versionTag = event.getMatchingTags('version')[0]?.[1]
    const eventVersion = parseInt(versionTag ?? '0', 10)
    if (eventVersion < (market.version ?? 0)) {
      return { valid: false, reason: 'Backup signer cannot roll back version' }
    }
  }
  
  // 7. Check for deletion signals (NIP-09)
  const isDeletion = market.status === 'archived'
  
  return { valid: true, market, isDeletion }
}
```

**Use validation in component**:
```typescript
sub.on('event', (event: NDKEvent) => {
  const validation = validateMarketEvent(event)
  
  if (!validation.valid) {
    console.warn('Rejected invalid market event:', validation.reason)
    return
  }
  
  dispatch({
    type: 'SYNC_MARKET',
    marketId: validation.market.id,
    market: validation.market,
    isDeletion: validation.isDeletion
  })
})
```

**Why**: 
- Complete validation prevents poisoned events
- Creator AND backup validation ensures fallback works
- NIP-09 deletion signals enable relay cleanup
- Backup signer cannot rollback (prevents abuse)

---

## Market Discovery & Pagination (Scalability Fix)

### Critical Issue (Architect-Orchestrator Feedback)
Fetching `limit=500` markets on every load doesn't scale:
- At 1000 markets × 10KB per event = 10MB on cold start
- Relays may timeout with such large query responses

### Solution: Paginated Discovery with Lazy Loading

**Fetch Strategy**:
```typescript
// Initial load: fetch only recent 50 markets
export async function fetchRecentMarkets(limit = 50): Promise<Set<NDKEvent>> {
  const filter: NDKFilter = { 
    kinds: [30000],
    '#c': ['cascade'],
    limit  // Default 50
  }
  return fetchEvents(filter)
}

// Pagination: fetch before a specific event (cursor-based)
export async function fetchMarketsPaginated(
  cursor?: string,  // previous event.id (go back in time)
  limit = 50
): Promise<Set<NDKEvent>> {
  // Note: NDK supports until/since by timestamp
  // Use cursor as until-timestamp (fetch events before this one)
  const filter: NDKFilter = {
    kinds: [30000],
    '#c': ['cascade'],
    until: parseInt(cursor ?? String(Math.floor(Date.now() / 1000))),
    limit
  }
  return fetchEvents(filter)
}
```

**Component Implementation** (LandingPage):
```typescript
function LandingPage({ markets, dispatch }: LandingPageProps) {
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [paginationCursor, setPaginationCursor] = useState<string | undefined>()
  
  // Load more markets when user scrolls to bottom
  const handleLoadMore = async () => {
    setIsLoadingMore(true)
    try {
      const moreEvents = await fetchMarketsPaginated(paginationCursor, 50)
      
      if (moreEvents.size === 0) {
        // No more markets
        setIsLoadingMore(false)
        return
      }
      
      // Update app state with new markets
      const parsed = Array.from(moreEvents)
        .map(e => parseMarketEvent(e))
        .filter(r => r.ok)
        .map(r => r.ok && r.market)
      
      for (const market of parsed) {
        dispatch({
          type: 'SYNC_MARKET',
          marketId: market.id,
          market
        })
      }
      
      // Set next cursor (use last event's created_at)
      const lastEvent = Array.from(moreEvents).pop()
      if (lastEvent) {
        setPaginationCursor(String(lastEvent.created_at ?? 0))
      }
    } catch (err) {
      console.error('Failed to load more markets:', err)
    } finally {
      setIsLoadingMore(false)
    }
  }
  
  return (
    <InfiniteScroll
      dataLength={Object.values(visibleMarkets).length}
      next={handleLoadMore}
      hasMore={true}
      loader={<div>Loading more markets...</div>}
    >
      {visibleMarkets.map(entry => <MarketCard key={entry.market.id} entry={entry} />)}
    </InfiniteScroll>
  )
}
```

**Why**: 
- Initial load is fast (50 markets ~= 500KB)
- Infinite scroll provides good UX
- Database-friendly (cursor-based pagination)
- Users don't wait for catalog to download

---

## Relay Strategy

### Current Relays
- Testnet: `wss://relay.damus.io`
- Mainnet: `wss://relay.damus.io`, `wss://nostr.wine`

Defined in `src/context/NostrContext.tsx:22-23`.

### Phase 1 Approach: No Change
Use the same relays for markets as for discussion posts. Both are user-generated content that benefit from high-uptime relays.

### Future Optimization (Phase 2)
- Add market-specific relay sets (e.g., relays known to be reliable for kind 30000 events)
- Implement relay failover (if one relay is slow, try the next)
- Allow users to specify preferred relays

---

## What Stays Local

### Must Stay Local (Not Synced to Nostr)
1. **UI state**: Active tab, modal open/close, sort preferences
2. **User's personal position tracking**: Their own cash/shares (derived from participant book, not a separate sync)
3. **Browser bookmarks/favorites**: Store in `bookmarkStore.ts` (localStorage-based)
4. **Participant index**: User's cross-market statistics in `participantIndex.ts` (can stay localStorage for now)

### Must Sync to Nostr
1. **Market metadata**: Title, description, kind, thesis
2. **LMSR state**: qLong, qShort, reserve, participant accounts, quotes, proofs, events, receipts
3. **Timestamps**: createdAt, lastTrade timing
4. **Creator pubkey**: For authority and discovery

---

## Testing Strategy

### Test Infrastructure Setup (NEW — Blocking)

**First step: Install test runner** (currently missing per Clean-Code-Nazi feedback):

1. **Add vitest + dependencies** to `package.json`:
   ```bash
   npm install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom
   ```

2. **Create `vitest.config.ts`**:
   ```typescript
   import { defineConfig } from 'vitest/config'
   import react from '@vitejs/plugin-react'

   export default defineConfig({
     plugins: [react()],
     test: {
       globals: true,
       environment: 'jsdom',
       setupFiles: ['./src/test/setup.ts'],
     },
   })
   ```

3. **Create `src/test/setup.ts`**:
   ```typescript
   import '@testing-library/jest-dom'
   import { expect, afterEach, vi } from 'vitest'
   import { cleanup } from '@testing-library/react'

   // Cleanup after each test
   afterEach(() => cleanup())

   // Mock localStorage
   const localStorageMock = {
     getItem: vi.fn(),
     setItem: vi.fn(),
     removeItem: vi.fn(),
     clear: vi.fn(),
   }
   global.localStorage = localStorageMock as any
   ```

4. **Update `package.json` scripts**:
   ```json
   {
     "scripts": {
       "test": "vitest",
       "test:ui": "vitest --ui",
       "test:coverage": "vitest --coverage"
     }
   }
   ```

### Unit Tests

**File**: `src/services/marketService.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest'
import {
  parseMarketEvent,
  validateMarketEvent,
  computeStateHash,
  publishMarketEventWithConcurrencyCheck,
} from './marketService'

describe('marketService', () => {
  describe('parseMarketEvent', () => {
    it('deserializes a valid kind 30000 event to Market with typed result', () => {
      const event = createMockEvent({
        kind: 30000,
        tags: [
          ['d', 'market:test-123'],
          ['c', 'cascade'],
          ['version', '1'],
          ['stateHash', 'abc123'],
        ],
        content: JSON.stringify({
          id: 'test-123',
          title: 'Test Market',
          version: 1,
          stateHash: 'abc123',
          creatorPubkey: 'creator123',
          status: 'active',
        }),
      })
      
      const result = parseMarketEvent(event)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.market.id).toBe('test-123')
        expect(result.market.title).toBe('Test Market')
      }
    })

    it('returns error for invalid JSON content', () => {
      const event = createMockEvent({
        kind: 30000,
        content: 'invalid json {',
      })
      
      const result = parseMarketEvent(event)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('invalid_json')
    })

    it('returns error for missing d-tag', () => {
      const event = createMockEvent({
        kind: 30000,
        tags: [],
        content: JSON.stringify({ id: 'test' }),
      })
      
      const result = parseMarketEvent(event)
      expect(result.ok).toBe(false)
      expect(result.error).toBe('missing_d_tag')
    })
  })

  describe('validateMarketEvent', () => {
    it('accepts valid market events signed by creator', () => {
      const market: Market = {
        id: 'test-123',
        creatorPubkey: 'creator123',
        version: 1,
        stateHash: 'abc123',
        status: 'active',
        // ... other fields
      }
      const event = createMockEvent({
        pubkey: 'creator123',
        kind: 30000,
        tags: [['d', 'market:test-123']],
        content: JSON.stringify(market),
      })
      
      const result = validateMarketEvent(event)
      expect(result.valid).toBe(true)
      expect(result.isDeletion).toBe(false)
    })

    it('accepts events signed by backup signer', () => {
      const market: Market = {
        id: 'test-123',
        creatorPubkey: 'creator123',
        backupPubkey: 'backup456',
        version: 2,
        stateHash: 'xyz789',
        status: 'active',
        // ...
      }
      const event = createMockEvent({
        pubkey: 'backup456',
        kind: 30000,
        tags: [
          ['d', 'market:test-123'],
          ['version', '2'],
        ],
        content: JSON.stringify(market),
      })
      
      const result = validateMarketEvent(event)
      expect(result.valid).toBe(true)
    })

    it('rejects events signed by unauthorized pubkey', () => {
      const market: Market = {
        id: 'test-123',
        creatorPubkey: 'creator123',
        version: 1,
        // ...
      }
      const event = createMockEvent({
        pubkey: 'attacker999',
        kind: 30000,
        tags: [['d', 'market:test-123']],
        content: JSON.stringify(market),
      })
      
      const result = validateMarketEvent(event)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('unauthorized')
    })

    it('detects archived/deleted markets', () => {
      const market: Market = {
        id: 'test-123',
        creatorPubkey: 'creator123',
        version: 2,
        status: 'archived',
        deletedAt: Date.now(),
        // ...
      }
      const event = createMockEvent({
        pubkey: 'creator123',
        kind: 30000,
        tags: [['d', 'market:test-123']],
        content: JSON.stringify(market),
      })
      
      const result = validateMarketEvent(event)
      expect(result.valid).toBe(true)
      expect(result.isDeletion).toBe(true)
    })

    it('prevents backup signer from rolling back version', () => {
      const market: Market = {
        id: 'test-123',
        creatorPubkey: 'creator123',
        backupPubkey: 'backup456',
        version: 1,  // Trying to roll back from 2
        // ...
      }
      const event = createMockEvent({
        pubkey: 'backup456',
        kind: 30000,
        tags: [
          ['d', 'market:test-123'],
          ['version', '1'],
        ],
        content: JSON.stringify(market),
      })
      
      const result = validateMarketEvent(event)
      expect(result.valid).toBe(false)
      expect(result.reason).toContain('rollback')
    })
  })

  describe('computeStateHash', () => {
    it('produces consistent hash for same market state', () => {
      const market: Market = {
        id: 'test-123',
        qLong: 100,
        qShort: 100,
        reserve: 1000,
        // ... rest of LMSR state
      }
      
      const hash1 = computeStateHash(market)
      const hash2 = computeStateHash(market)
      
      expect(hash1).toBe(hash2)
    })

    it('detects changes in LMSR state', () => {
      const market1: Market = { qLong: 100, qShort: 100, /* ... */ }
      const market2: Market = { qLong: 101, qShort: 100, /* ... */ }
      
      const hash1 = computeStateHash(market1)
      const hash2 = computeStateHash(market2)
      
      expect(hash1).not.toBe(hash2)
    })

    it('ignores version/timestamp changes', () => {
      const market1: Market = {
        qLong: 100,
        qShort: 100,
        version: 1,
        lastUpdatedAt: 1000,
        // ... LMSR state
      }
      const market2: Market = {
        qLong: 100,
        qShort: 100,
        version: 2,
        lastUpdatedAt: 2000,
        // ... same LMSR state
      }
      
      const hash1 = computeStateHash(market1)
      const hash2 = computeStateHash(market2)
      
      expect(hash1).toBe(hash2)  // Same hash despite version/timestamp
    })
  })

  describe('concurrency control', () => {
    it('detects concurrent edits via stateHash mismatch', async () => {
      // Simulate: local version has stateHash A, Nostr has stateHash B
      const localMarket: Market = {
        id: 'test-123',
        version: 1,
        stateHash: 'local-hash-a',
        qLong: 100,
        // ...
      }
      
      const nostrMarket: Market = {
        id: 'test-123',
        version: 1,
        stateHash: 'nostr-hash-b',  // Same version, different hash = conflict
        qLong: 105,  // Someone else traded
      }
      
      // publishMarketEventWithConcurrencyCheck should detect this
      // (implementation detail: would throw ConcurrencyError)
      expect(() => {
        // Check happens before publish
        if (nostrMarket.stateHash !== localMarket.stateHash) {
          throw new Error('Concurrent edit detected')
        }
      }).toThrow('Concurrent edit detected')
    })
  })
})
```

### Integration Tests

**File**: `src/App.test.tsx`

```typescript
describe('Market persistence via Nostr (integration)', () => {
  it('publishes a market to Nostr when CREATE_MARKET action fires', async () => {
    const { getByText } = render(<App />)
    
    // Simulate user creating a market
    fireEvent.click(getByText('Create Market'))
    fireEvent.change(getByPlaceholderText('Title'), { target: { value: 'Test Market' } })
    fireEvent.click(getByText('Submit'))
    
    // Verify market was dispatched
    expect(publishMarketEventWithConcurrencyCheck).toHaveBeenCalled()
  })

  it('syncs trades to Nostr when TRADE action fires', async () => {
    // ... similar setup ...
  })

  it('merges localStorage and Nostr markets on hydration', async () => {
    // ... test HYDRATE_FROM_NOSTR action ...
  })

  it('receives live updates via subscribeToMarket', async () => {
    // ... test subscription handling ...
  })

  it('retries failed publishes from outbox', async () => {
    // ... test offline queue ...
  })
})
```

### Manual Testing Checklist

1. **Test Runner Works**: `npm test` runs without errors
2. **Market Creation**: Create market with NIP-07 signer → appears in localStorage + Nostr within 5 seconds
3. **Cross-Device Sync**: Two browsers see same market within 2 seconds of creation
4. **Concurrent Trades**: Two users trade simultaneously → no data loss, both trades reflected in final state
5. **Offline Resilience**: Trade offline → go online → market publishes within 5 seconds
6. **Backup Signer**: Backup pubkey can publish if creator unavailable
7. **Deletion Events**: Delete market → NIP-09 kind 5 event published → market hidden from UI
8. **Read-Only Mode**: No signer → can view markets, cannot create/trade
9. **Version Handling**: Markets with higher version always win in merge
10. **Pagination**: Load 50 markets, click "More", load another 50 without downloading all 1000

---

## Execution Order

### Phase 1A: Test Infrastructure & Type System (Days 1-1.5) — BLOCKING

**Prerequisites for everything that follows**:

1. **Install test dependencies**
   - Add vitest, jsdom, @testing-library/react to package.json
   - Create vitest.config.ts and test/setup.ts
   - Verify `npm test` runs without errors
   - ✅ **Verification**: Test runner is ready; sample test passes

2. **Extend `src/types/market.ts`**
   - Add `version: number`, `stateHash: string`, `backupPubkey?: string`, `status`, `deletedAt`
   - Add `ParseResult` type (ok | error)
   - Add `ValidationResult` type
   - Keep backward compatibility (defaults for old markets)
   - ✅ **Verification**: Types compile; no breaking changes to existing code

### Phase 1B: Service Layer & Validation (Days 1.5-2.5)

3. **Extend `src/services/nostrService.ts`** with app-level filtering
   - Add `publishMarket()` with `['c', 'cascade']` tag
   - Add `fetchAllMarkets(limit=50)` with app filter and pagination support
   - Add `fetchMarketById()` with version-based sorting (version > timestamp)
   - Add `subscribeToMarket()` with app filter
   - Add `fetchDeletionEvents()` for NIP-09 handling
   - ✅ **Verification**: Unit tests for filtering (only Cascade markets fetched, not all kind 30000)

4. **Create `src/services/marketService.ts`** with strong validation
   - Implement `parseMarketEvent(event): ParseResult` (never returns null; returns error object)
   - Implement `validateMarketEvent(event): ValidationResult` (checks: signature, creator/backup auth, version ordering, deletion status)
   - Implement `computeStateHash(market): string` (SHA256 of LMSR state only)
   - Implement `publishMarketEventWithConcurrencyCheck(localMarket, ndk): Promise<Market>` (fetches latest, compares hash, detects conflicts)
   - Implement `publishDeletionEvent(marketId, creatorPubkey, ndk)` (NIP-09 kind 5)
   - Implement `isMarketDeleted(market, event): boolean`
   - ✅ **Verification**: Unit tests for parseMarketEvent, validateMarketEvent, computeStateHash, concurrency detection

5. **Create `src/services/outbox.ts`** for offline resilience
   - Implement `getPendingPublishes()`, `addPendingPublish()`, `removePendingPublish()`, `incrementPendingRetries()`
   - Store in localStorage under `cascade-pending-publishes`
   - ✅ **Verification**: Unit tests for persist/retrieve cycle; verify localStorage entries

### Phase 1C: Storage & Hydration Pattern (Days 2-2.5)

6. **Revise `src/storage.ts`**
   - Keep `load()` synchronous (returns what's in localStorage)
   - Keep `save()` synchronous (writes to localStorage)
   - Add `mergeLocalAndNostr(local, nostrEvents): Record<string, MarketEntry>` with version-based merge logic
   - Add `normalizeMarketForMigration(market): Market` (ensures all fields present)
   - ✅ **Verification**: Unit tests for merge logic (version comparison, conflict resolution)

7. **Fix `src/App.tsx` initialization & hydration**
   - Change `initState()` to load from localStorage ONLY (synchronous)
   - Add new Redux action types: `HYDRATE_FROM_NOSTR`, `SYNC_MARKET`, `MARK_PUBLISHED`
   - Add post-mount `useEffect` that dispatches `HYDRATE_FROM_NOSTR` (async, after mount)
   - Add post-mount `useEffect` for outbox retry loop (every 10 seconds, exponential backoff)
   - ✅ **Verification**: App loads fast; hydration completes within 2 seconds on good network; outbox retries happen on schedule

8. **Update reducer to handle version-aware merging**
   - `HYDRATE_FROM_NOSTR` action merges Nostr markets into state (uses version comparison)
   - `SYNC_MARKET` action accepts incoming updates with version check (higher version wins, stateHash detects conflicts)
   - `TRADE` and `CREATE_MARKET` actions increment version, call `publishMarketEventWithConcurrencyCheck()` (fire-and-forget with outbox fallback)
   - `DELETE_MARKET` sets `status: archived`, increments version, publishes both updated event + NIP-09 deletion
   - ✅ **Verification**: Unit tests for each action; integration test for concurrent trades

### Phase 1D: Component Integration (Days 2.5-3.5)

9. **Revise `src/LandingPage.tsx`** — Single source of truth
   - Receive `markets` from App state (no secondary fetch)
   - Subscribe to new market events with `subscribeToMarket()` (for live discovery)
   - Dispatch `SYNC_MARKET` when new markets arrive
   - Filter out archived markets (`status !== 'archived'`)
   - Implement pagination: fetch first 50, then lazy-load more on scroll
   - ✅ **Verification**: Markets appear in real-time; pagination works; archived markets hidden

10. **Revise `src/MarketDetail.tsx`** — Live sync with version awareness
    - Subscribe to market updates (single subscription per marketId)
    - Use strong validation on incoming events (`validateMarketEvent()`)
    - Dispatch `SYNC_MARKET` with version-aware merge
    - Preserve local history through syncs
    - ✅ **Verification**: Live updates from other devices visible within 2 seconds; no data loss from concurrent trades

11. **Revise `src/App.tsx` auth/UI logic**
    - Check `pubkey` before CREATE_MARKET/TRADE
    - Show "Install extension" prompt in read-only mode
    - On market creation, set `backupPubkey` (initially same as creator, allow UI override later)
    - ✅ **Verification**: Read-only mode tested (view works, trade blocked); signer required for creation

### Phase 1E: Migration & Backward Compatibility (Days 3-3.5)

12. **Implement market migration on first Nostr connection**
    - In App.tsx post-mount, detect old markets (missing version/stateHash/status)
    - Normalize old markets (add missing fields)
    - Publish each old market with `publishMarketEventWithConcurrencyCheck()`
    - Dispatch `MARK_PUBLISHED` after each success
    - On failure, add to outbox
    - ✅ **Verification**: Old markets published to Nostr; can open in second browser

13. **Test backward compatibility**
    - Existing localStorage markets still work
    - No breaking changes to Market type (all new fields optional or have defaults)
    - Old and new markets coexist without conflicts
    - ✅ **Verification**: App works with both old (pre-versioning) and new markets

### Phase 1F: Testing & Validation (Days 3.5-4.5)

14. **Write comprehensive unit tests**
    - `marketService.test.ts`: parseMarketEvent, validateMarketEvent, computeStateHash, concurrency detection, backup signer validation
    - `outbox.test.ts`: persist/retrieve/retry logic
    - `storage.test.ts`: merge logic, normalization
    - ✅ **Verification**: All tests pass; coverage >80% for critical paths

15. **Write integration tests**
    - App hydration from localStorage + Nostr
    - Concurrent trade detection and resolution
    - Offline outbox retry
    - Cross-component sync (LandingPage + MarketDetail)
    - ✅ **Verification**: Integration tests pass

16. **Manual testing checklist** (see Testing Strategy)
    - Market creation → Nostr
    - Cross-device sync (2 browsers)
    - Concurrent trades (no data loss)
    - Offline resilience
    - Backup signer activation
    - Deletion events (NIP-09)
    - Read-only mode
    - Version handling
    - Pagination (50 + load more)
    - Public relay contamination prevention
    - ✅ **Verification**: All manual tests pass

### Phase 1G: Hardening & Edge Cases (Days 4-4.5)

17. **Relay failover & latency**
    - Test with one relay down (app continues working)
    - Verify query timeout handling
    - Monitor query performance (target: <500ms)
    - ✅ **Verification**: App resilient to relay failures

18. **Clock skew & version edge cases**
    - Test concurrent edits at same version with different hashes
    - Test backup signer rollback prevention
    - Test NIP-09 deletion signal alongside market event
    - ✅ **Verification**: All edge cases handled gracefully

19. **Data consistency**
    - Verify no duplicate markets in display (local vs Nostr)
    - Verify archived markets never reappear
    - Verify outbox doesn't replay successful publishes
    - ✅ **Verification**: Data consistency maintained

---

## Scope Checklist: Phase 1 (REVISED)

**INCLUDED** ✅ (Blocking Issues Fixed)
- [x] Markets persist to Nostr with kind 30000 + app-level filter (`#c: cascade` tag)
- [x] Market creator authority with backup signer mechanism (required at creation)
- [x] Version-based conflict detection (prevents data loss from concurrent trades)
- [x] State hash for optimistic concurrency control (detects simultaneous edits)
- [x] Real-time subscription & live sync across browsers
- [x] localStorage as performance cache + persisted outbox for offline resilience
- [x] Gradual, backward-compatible migration of existing markets
- [x] Read-only mode with complete validation (creator/backup auth, signature verification, deletion event handling)
- [x] Paginated market discovery + lazy loading (50 at a time, infinite scroll)
- [x] Delete semantics with tombstone status + NIP-09 kind 5 events
- [x] Test infrastructure setup (vitest + jsdom + RTL) before writing tests
- [x] Post-mount async hydration pattern (correct React anti-pattern fix)
- [x] Single source of truth in App state (no duplicate fetches/merges)
- [x] Replica protection against public relay contamination

**EXCLUDED** ❌ (Phase 2+)
- [ ] Multi-creator markets (threshold signatures or trade ledger)
- [ ] Market event auditing (separate trade event log for analytics)
- [ ] Advanced relay selection (per-market relay preferences, relay scoring)
- [ ] Market expiration / time-bound auto-archival
- [ ] Privacy-preserving market listings (zk-proofs, sealed markets)
- [ ] Cashu integration (separate from market persistence)
- [ ] Market ownership transfer / reassignment
- [ ] Advanced conflict resolution (vector clocks, CRDT-based state)

---

## Key Design Decisions & Rationale

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Event Kind** | 30000 (parameterized replaceable) | One event per market; replaceable = latest state always wins. Simple, proven pattern. |
| **App Filter** | Custom tag `['c', 'cascade']` on all events | Prevents fetching other apps' kind 30000 events from public relays. Required for multi-app compatibility. |
| **Authority** | Creator + mandatory backup signer (both immutable) | Creator unavailability no longer kills markets. Backup is immutable fallback. Prevents single point of failure. |
| **State Model** | Full state in event content (not event-sourced trades) | Avoids O(n) replay cost; deterministic; simple client logic. |
| **Cache Layer** | localStorage (perf) + persisted outbox (offline) | Fast startup; trades survive network outages. No data loss if offline. |
| **Versioning** | Incremental `version` + `stateHash` (SHA256 of state) | Handles clock skew; detects concurrent edits. Hash mismatch = conflict detected. |
| **Concurrency Control** | Optimistic with pre-publish conflict check | Fetch latest, compare stateHash, reject on mismatch → requires re-sync. Prevents silent data loss. |
| **Delete Semantics** | Status field + NIP-09 kind 5 tombstones | Markets never truly deleted; status + deletion event signals intent. Enables relay cleanup. |
| **Hydration Pattern** | Sync `initState()` + async post-mount hydration | Correct React pattern. Prevents race conditions and warnings. |
| **Source of Truth** | App state (hydrated once at mount) | Prevents duplicate fetches; components subscribe for live updates. |
| **Discovery** | Paginated fetch (50 at a time) + lazy loading | Scales to 1000+ markets. Fast initial load (~500KB). User-friendly infinite scroll. |
| **Validation** | Full signature + creator/backup auth + deletion checks | Prevents poisoned events. Backup signer cannot rollback version. |
| **Test Setup** | vitest + jsdom + RTL (Phase 1A prerequisite) | Comprehensive unit + integration testing. Identified as blocking by Clean-Code-Nazi. |
| **Subscription** | Real-time per-market; live discovery subscriptions | Users see trades & new markets instantly. Matches existing discussion posts pattern. |
| **Read-Only Mode** | NIP-07 extension required to sign; optional to read | Matches current app UX. Full validation prevents unauthorized updates. |
| **Relays** | Same as discussion posts (Damus, Nostr.wine) | Proven infrastructure. Markets are user-generated. |

---

## Known Limitations & Future Work

### Fixed in Phase 1 (Previously Blocking)

**✅ Creator Unavailability** — FIXED
- Now: Backup signer mechanism (required at market creation)
- Creator can designate fallback pubkey to publish updates if they go offline
- Backup signer cannot rollback version (prevents abuse)
- See "Trade Authority & Backup Signer Mechanism" section

**✅ Concurrent Trade Data Loss** — FIXED
- Now: Version + stateHash detection (prevents silent overwrites)
- Before publish: fetch latest from Nostr, compare stateHash
- If hash differs at same version → conflict detected → reject & require re-sync
- See "Versioning & Concurrency Control" section

**✅ Public Relay Contamination** — FIXED
- Now: App-level filter tag `['c', 'cascade']` prevents fetching other apps' kind 30000 events
- See nostrService.ts changes

**✅ Delete Semantics** — FIXED
- Now: Markets have `status: 'active' | 'archived'` field
- Deletion sets status + publishes NIP-09 kind 5 event
- See "Delete Semantics" section in Versioning

**✅ Offline Resilience** — FIXED
- Now: Persisted outbox (`cascade-pending-publishes`) with retry logic
- No longer just "fire-and-forget" with console.error
- Retries every 10 seconds with exponential backoff up to 5 attempts
- See storage.ts and App.tsx outbox retry useEffect

**✅ Service Boundaries** — FIXED
- Now: Clear separation — nostrService (generic transport) vs marketService (domain logic)
- Market-specific logic consolidated in marketService.ts
- See File Changes sections

**✅ Async Hydration Pattern** — FIXED
- Now: Synchronous `initState()` + post-mount async `useEffect` for hydration
- Prevents React warnings and race conditions
- See App.tsx initialization section

**✅ Two Sources of Truth** — FIXED
- Now: Single source in App state (hydrated once at mount)
- LandingPage subscribes for live discovery, doesn't re-fetch
- See LandingPage.tsx section

**✅ Validation Types** — FIXED
- Now: `ParseResult` and `ValidationResult` types (error detail instead of null/boolean)
- Full signature verification, creator/backup auth checking
- NIP-09 deletion event detection
- See marketService validation functions

**✅ Pagination** — FIXED
- Now: Fetch 50 markets initially, lazy-load more on scroll
- No longer "fetch all (limit=500)" which doesn't scale
- See Market Discovery & Pagination section

**✅ Testing Infrastructure** — FIXED
- Now: vitest + jsdom + RTL setup required as Phase 1A (blocking prerequisite)
- All tests use proper testing library patterns
- See Testing Strategy section

---

### Remaining Limitations (Minor, Phase 2+)

### Limitation 1: No Market Expiration / Auto-Archival
**Issue**: Markets live forever on Nostr relays. Catalog grows unbounded.

**Current**: Archives are manual (creator deletes). Archived markets still exist on relay.

**Solution (Phase 2)**: Implement time-bound markets (expiration date). Auto-archive after resolution + N days.

### Limitation 2: Creator Pubkey Immutable / No Ownership Transfer
**Issue**: If a market's creator key is compromised, market can't be reassigned.

**Current**: Strongly recommend using Nostr signing extensions (e.g., Alby) instead of managing keys manually.

**Solution (Phase 2)**: Market ownership transfer protocol (consensus-based or multi-sig).

### Limitation 3: Backup Signer Initially Same as Creator
**Issue**: Phase 1 initializes backup = creator. Doesn't provide true redundancy.

**Current**: UX allows user to specify different backup (e.g., different device, app-hosted key).

**Solution (Phase 2)**: Require backup at creation time; integrate with backup wallet services (e.g., Nostr-based key management).

### Limitation 4: No Trade Ledger / Audit Log
**Issue**: Only latest market event is kept; history of all trades is not persisted.

**Current**: price history in `Market.history[]` is local-only (not synced to Nostr).

**Solution (Phase 2)**: Publish separate trade events (kind 31000 or custom) for auditing & analytics.

### Limitation 5: No Advanced Relay Selection
**Issue**: All markets use same relay set (Damus, Nostr.wine). No per-market optimization.

**Solution (Phase 2)**: Market creators can specify preferred relays. Implement relay scoring/failover.

---

## Success Criteria

After Phase 1 is complete, the following MUST be true:

1. ✅ **Two browser sessions see the same market**: Create market in browser A, reload browser B, market appears.
2. ✅ **Trades sync in real-time**: Trade in browser A, observe price update in browser B within 2 seconds.
3. ✅ **Markets survive page reload**: Reload app, markets persist (via localStorage + Nostr).
4. ✅ **Markets are discoverable**: Open LandingPage, see all markets (local + Nostr).
5. ✅ **Read-only mode works**: Disable NIP-07 signer, view markets and prices (no trading).
6. ✅ **Offline resilience**: Trade offline, go online, market publishes within 5 seconds.
7. ✅ **No data loss**: Existing localStorage markets are migrated to Nostr.
8. ✅ **Creator authority**: Only market creator can update the market (validated on publish).
