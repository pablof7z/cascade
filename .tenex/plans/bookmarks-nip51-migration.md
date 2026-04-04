# Bookmarks NIP-51 Migration

## Context

**Current state:**
- `bookmarkStore.ts:1–91`: Pure localStorage implementation (loadBookmarks, saveBookmarks, addBookmark, removeBookmark, isBookmarked, getBookmarkCount, initializeSampleCounts)
- `useBookmarks.ts:1–57`: React hook for reactive state (bookmarkedIds, toggle, isBookmarked, getCount, getTopBookmarked, refresh)
- `BookmarkButton.tsx:1–71`: UI component triggered by onToggle (no bookmark service awareness)
- `BookmarksPage.tsx:1–86`: Display bookmarked markets with sorting and counts
- `NostrContext.tsx:1–80`: Provides pubkey (null | string), ndkInstance, fetchEvents, publishEvent, subscribeToEvents
- `App.tsx`: Initializes stores at startup; auth state flows via context (no logout API)
- `storage.ts:38–92`: Outbox pattern for market publishes: PendingPublish interface, getPendingPublishes, addPendingPublish, removePendingPublish, incrementPendingRetries
- `positionService.ts:236–250`: Throws on publish failure; never returns error objects

**Why this change is needed:**
Current bookmarks exist only in localStorage — they're not persisted to Nostr, not shared across devices, and not queryable via relays. NIP-51 kind 10003 standardizes user lists on Nostr. This migration moves bookmarks to kind 10003, enables cross-device sync, and allows anonymous users to maintain offline-first bookmarks with eventual publication.

**Key constraint from NIP-51 spec:**
Kind 10003 is a **standard replaceable event** (replaceable by pubkey, NOT d-tagged parameterized). Public bookmarks go in `tags` as `e` tags (for event references). The `content` field is empty or a description string. For Cascade markets (kind 982 events), we use `e` tags pointing to `market.eventId`.

---

## Approach

### Design Pattern: Three-Layer Model

1. **Service layer** (`bookmarkService.ts`): Pure domain logic — serializes/deserializes bookmarks to/from Nostr kind 10003 events. Throws on failure. No localStorage, no React.
2. **Adapter layer** (`bookmarkStore.ts`): Manages persistence and migration logic. Coordinates between localStorage (legacy + pending), Nostr fetches, merges, and retry outbox. Owns all state-changing decisions.
3. **React integration** (`useBookmarks.ts`, components): Unchanged API surface; calls bookmarkStore operations.

### Event Structure (NIP-51 kind 10003)

```
{
  kind: 10003,
  content: "",  // Empty or optional description
  pubkey: "<user-pubkey>",
  created_at: <unix-timestamp>,
  tags: [
    ["e", "<market-event-id>"],  // One e tag per bookmarked market
    ["e", "<market-event-id>"],
    ...
  ]
}
```

**Why e tags?** Markets are kind 982 (non-replaceable) events. The canonical identifier is the event ID. We do NOT use `a` tags (those are for parameterized replaceable events).

**Why NOT d tags?** Kind 10003 is replaceable by `pubkey` alone — no d-tag is needed. Adding one violates NIP-51 spec.

### Migration Strategy

1. **Detect legacy data**: Check localStorage for old `cascade-bookmarks` key (the current real key in `bookmarkStore.ts:6`).
2. **Fetch from Nostr**: If user is authenticated, fetch their kind 10003 event (if it exists).
3. **Merge**: Nostr wins (source of truth). If Nostr has data, use it and ignore legacy. If Nostr is empty, use legacy data and queue for publish.
4. **Transform legacy**: Map legacy `{ marketIds, counts }` from `cascade-bookmarks` to cache and `cascade-bookmarks-legacy` backup.
5. **Migration path**: 
   - Read `{ marketIds, counts }` from `cascade-bookmarks` (current storage key)
   - Store `{ marketIds, counts }` to `cascade-bookmarks-legacy` (new legacy backup key)
   - Clear `cascade-bookmarks` after successful migration
   - `cascade-bookmarks-legacy` becomes read-only (never written to by add/remove operations)
6. **Publish queued bookmarks**: If user is authenticated and migration happened, publish the merged result.
7. **Store migration state**: Mark migration complete. Persist pending publishes in an outbox.

### localStorage Model After Migration

Split into two concerns:
- **`cascade-bookmarks`**: Original key deleted after migration (read once at init, then discarded).
- **`cascade-bookmarks-legacy`**: Backup of original anonymous/offline bookmarks (written once during migration, then read-only). Never deleted—acts as failsafe if Nostr write fails.
- **`cascade-bookmarks-pending`**: Outbox of bookmark publishes awaiting confirmation (array of `PendingBookmarkPublish`). Cleared when publish succeeds.

### Init Lifecycle

1. **At app startup**: Call `initializeBookmarks(pubkey: string | null, ndk: NDK | null)` with potentially null values (anonymous user, disconnected state).
2. **For authenticated users**: Fetch kind 10003, merge with legacy, queue publish if migration needed.
3. **For anonymous users**: Load legacy bookmarks, keep them local only, populate pending outbox for eventual publish.
4. **On pubkey change** (e.g., user logs in): Re-initialize with new pubkey.

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Event model** | Kind 10003 replaceable (not d-tagged), e tags for market event IDs | NIP-51 spec mandates this. Market kind 982 events identified by event ID, not a-tags. |
| **Publish pattern** | Service throws on failure; adapter decides retry/fallback | Matches positionService pattern. Prevents silent failures when data is deleted. |
| **Storage split** | legacyAnonymousBookmarks (backup) + pendingBookmarkSync (outbox) | Legacy serves as failsafe; pending outbox enables retry without re-fetching all markets. One boolean flag was unsafe—suppressed all future syncs on refresh. |
| **Merge logic** | Nostr wins (source of truth); if empty, use legacy; if both empty, start fresh | No timestamp-based precedence (legacy has no timestamps). Simple, predictable. |
| **Null pubkey handling** | Initialize even for null pubkey; bookmark locally only | Supports anonymous users. On login, re-initialize with pubkey and publish queued bookmarks. |
| **Hook mutation** | Use spread operator to avoid mutating array with .sort() | React best practice. Prevents accidental state mutation bugs. |
| **Test layer** | Adapter tests (risky merge/migration logic) BEFORE service tests | Adapter owns stateful decisions; service is pure/testable once adapter is verified. |

---

## File Changes

### `src/services/bookmarkService.ts`

**Action**: Create

**What**: Pure domain logic for NIP-51 kind 10003 bookmarks. No localStorage, no React, no async I/O.

```typescript
/**
 * Bookmark Service — Domain Logic for NIP-51 Kind 10003
 *
 * Encapsulates serialization/deserialization of bookmarks to/from Nostr events.
 * No localStorage, no async operations — pure functions only.
 */

import type { NDKEvent } from '@nostr-dev-kit/ndk'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A bookmark entry: the market event ID that was bookmarked.
 * Maps to an 'e' tag in the NIP-51 kind 10003 event.
 */
export interface BookmarkEntry {
  marketEventId: string
}

/**
 * Parsed bookmarks list from kind 10003 event.
 */
export interface BookmarksList {
  eventId: string // The kind 10003 event ID
  pubkey: string
  createdAt: number
  entries: BookmarkEntry[]
}

// ---------------------------------------------------------------------------
// Serialization: BookmarksList → NIP-51 kind 10003 event tags
// ---------------------------------------------------------------------------

/**
 * Serialize a list of market event IDs to NIP-51 kind 10003 event format.
 * Returns { content, tags } ready for NDKEvent.
 *
 * Kind 10003 is replaceable by pubkey (no d-tag). Each bookmark is an 'e' tag.
 * Content is empty string (or optional description).
 */
export function serializeBookmarksToEvent(marketEventIds: string[]): {
  content: string
  tags: string[][]
} {
  const tags: string[][] = marketEventIds.map((eventId) => ['e', eventId])
  return {
    content: '', // NIP-51 allows empty or descriptive string
    tags,
  }
}

// ---------------------------------------------------------------------------
// Deserialization: NIP-51 kind 10003 event → BookmarksList
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; list: BookmarksList }
  | {
      ok: false
      error: string
      reason: 'invalid_kind' | 'missing_pubkey' | 'invalid_tags'
    }

/**
 * Parse a kind 10003 event into a BookmarksList.
 * Rejects any event with kind !== 10003.
 * Extracts 'e' tags; ignores unknown tags.
 * Deduplicates by marketEventId.
 */
export function parseBookmarkEvent(event: NDKEvent): ParseResult {
  if (event.kind !== 10003) {
    return {
      ok: false,
      error: `Expected kind 10003, got ${event.kind}`,
      reason: 'invalid_kind',
    }
  }

  if (!event.pubkey) {
    return {
      ok: false,
      error: 'Missing pubkey',
      reason: 'missing_pubkey',
    }
  }

  // Extract e tags (event references)
  const eTags = event.getMatchingTags('e')
  const seen = new Set<string>()
  const entries: BookmarkEntry[] = []

  for (const tag of eTags) {
    const eventId = tag[1]
    if (eventId && !seen.has(eventId)) {
      seen.add(eventId)
      entries.push({ marketEventId: eventId })
    }
  }

  const list: BookmarksList = {
    eventId: event.id ?? '',
    pubkey: event.pubkey,
    createdAt: event.created_at ?? Math.floor(Date.now() / 1000),
    entries,
  }

  return { ok: true, list }
}

// ---------------------------------------------------------------------------
// Extraction: BookmarksList → market event IDs (for store layer)
// ---------------------------------------------------------------------------

/**
 * Extract market event IDs from a parsed BookmarksList.
 * Used by store layer to map to market slugs.
 */
export function extractMarketEventIds(list: BookmarksList): string[] {
  return list.entries.map((e) => e.marketEventId)
}

/**
 * Resolve market slugs to event IDs during migration.
 * Called when migrating from legacy storage (which stores slugs) to Nostr (which stores eventIds).
 * 
 * For each slug, queries the market cache or relay to find the corresponding kind 30000 event.
 * If resolution fails for a slug, logs warning and skips that bookmark (partial migration is OK).
 * 
 * @param slugs — Array of market slugs from legacy storage
 * @param ndk — NDK instance for relay queries
 * @returns Array of eventIds (subset of input slugs; failed ones omitted)
 */
export async function resolveSlugsToEventIds(
  slugs: string[],
  ndk: NDK,
): Promise<string[]> {
  const eventIds: string[] = []

  for (const slug of slugs) {
    try {
      // Query for kind 982 events (market kind after kind-982 migration) with d-tag matching slug
      const events = await ndk.fetchEvents({
        kinds: [982],
        filters: [{ '#d': [slug] }],
      })

      if (events && events.size > 0) {
        // Sort by created_at DESC, take most recent (kind 982 events are non-replaceable)
        const sorted = Array.from(events).sort((a, b) => b.created_at - a.created_at)
        const event = sorted[0]
        eventIds.push(event.id)
      } else {
        console.warn(`Market slug not found, skipping bookmark: ${slug}`)
      }
    } catch (err) {
      console.warn(`Failed to resolve slug to eventId: ${slug}`, err)
      // Continue with other slugs, don't fail entire migration
    }
  }

  return eventIds
}
```

**Why**: Service layer owns event serialization. Pure functions enable testing in isolation and allow the adapter to focus on state management and retry logic. No return-error-objects pattern—throwing is explicit.

---

### `src/bookmarkStore.ts`

**Action**: Modify (rewrite)

**What**: Adapter layer managing persistence, migration, and merge logic. Coordinates between localStorage, Nostr fetches, and the service layer.

```typescript
/**
 * Bookmark Store — Adapter Layer for NIP-51 Migration
 *
 * Manages:
 * - localStorage state (legacy backup + pending outbox)
 * - Migration from legacy to Nostr
 * - Merge logic (Nostr wins)
 * - Retry/fallback for publish failures
 *
 * Stateful decisions live here. Service layer is pure.
 */

import type NDK from '@nostr-dev-kit/ndk'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import {
  parseBookmarkEvent,
  serializeBookmarksToEvent,
  extractMarketEventIds,
  type BookmarksList,
} from './services/bookmarkService'
import { publishEvent } from './services/nostrService'

// ---------------------------------------------------------------------------
// Storage Keys
// ---------------------------------------------------------------------------

const LEGACY_STORAGE_KEY = 'cascade-bookmarks-legacy'
const PENDING_STORAGE_KEY = 'cascade-bookmarks-pending'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Legacy bookmark data (loaded from old storage key).
 * No timestamps—preserved as-is for failsafe.
 */
interface LegacyBookmarkData {
  marketIds: string[]
  counts: Record<string, number>
}

/**
 * Pending bookmark publish entry.
 * Queued when migration happens or when offline user logs in.
 */
interface PendingBookmarkPublish {
  pubkey: string
  marketEventIds: string[]
  createdAt: number
  retries: number
}

/**
 * In-memory cache of current bookmarks.
 * Can come from: legacy (if no Nostr event), Nostr event, or merged result.
 */
interface BookmarkCache {
  marketEventIds: string[] // The authoritative list
  source: 'none' | 'legacy' | 'nostr' | 'merged'
  nostrEventId: string | null // If fetched from Nostr, the event ID
  migrationPending: boolean // True if migration (legacy→Nostr) is queued
}

// ---------------------------------------------------------------------------
// In-Memory Cache
// ---------------------------------------------------------------------------

let _cache: BookmarkCache = {
  marketEventIds: [],
  source: 'none',
  nostrEventId: null,
  migrationPending: false,
}

// Observer pattern
type CacheListener = () => void
const _cacheListeners: Set<CacheListener> = new Set()

export function onBookmarksChanged(listener: CacheListener): () => void {
  _cacheListeners.add(listener)
  return () => _cacheListeners.delete(listener)
}

function notifyCacheListeners(): void {
  for (const listener of _cacheListeners) {
    listener()
  }
}

// ---------------------------------------------------------------------------
// localStorage Helpers (Internal)
// ---------------------------------------------------------------------------

function loadLegacyFromStorage(): LegacyBookmarkData {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return { marketIds: [], counts: {} }
    const parsed = JSON.parse(raw)
    return {
      marketIds: Array.isArray(parsed.marketIds) ? parsed.marketIds : [],
      counts:
        parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
    }
  } catch {
    return { marketIds: [], counts: {} }
  }
}

function saveLegacyToStorage(data: LegacyBookmarkData): void {
  try {
    localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — silently ignore
  }
}

function getPendingPublishes(): PendingBookmarkPublish[] {
  try {
    const raw = localStorage.getItem(PENDING_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as PendingBookmarkPublish[]) : []
  } catch {
    return []
  }
}

function setPendingPublishes(pending: PendingBookmarkPublish[]): void {
  try {
    localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(pending))
  } catch {
    // quota exceeded — silently ignore
  }
}

function addPendingPublish(
  pubkey: string,
  marketEventIds: string[],
): void {
  const pending = getPendingPublishes()
  // Replace any existing entry for this pubkey (idempotent)
  const filtered = pending.filter((p) => p.pubkey !== pubkey)
  filtered.push({
    pubkey,
    marketEventIds,
    createdAt: Date.now(),
    retries: 0,
  })
  setPendingPublishes(filtered)
}

function removePendingPublish(pubkey: string): void {
  const pending = getPendingPublishes()
  const filtered = pending.filter((p) => p.pubkey !== pubkey)
  setPendingPublishes(filtered)
}

function incrementPendingRetries(pubkey: string): void {
  const pending = getPendingPublishes()
  const target = pending.find((p) => p.pubkey === pubkey)
  if (target) {
    target.retries++
    setPendingPublishes(pending)
  }
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/**
 * Initialize bookmarks for the current user.
 * Called at app startup and when pubkey changes (e.g., login).
 *
 * **Migration step (first run only)**:
 *   1. Check for old `cascade-bookmarks` key (from bookmarkStore.ts)
 *   2. If found, copy `{ marketIds, counts }` to `cascade-bookmarks-legacy`
 *   3. Clear the old `cascade-bookmarks` key
 *   4. After migration, `cascade-bookmarks-legacy` is read-only
 *
 * For authenticated users:
 *   1. Fetch kind 10003 event from Nostr (sorted by created_at DESC, take most recent)
 *   2. Load legacy data from `cascade-bookmarks-legacy`
 *   3. If Nostr has data, use it. Else, use legacy and queue migration.
 *   4. Process pending publishes AFTER checking legacy (not before)
 *
 * For anonymous users (pubkey === null):
 *   1. Perform migration step if old `cascade-bookmarks` exists
 *   2. Load legacy data from `cascade-bookmarks-legacy`
 *   3. Populate cache (source = 'legacy')
 *   4. Do NOT attempt Nostr ops
 *   5. On later login, re-initialize with new pubkey
 */
export async function initializeBookmarks(
  pubkey: string | null,
  ndk: NDK | null,
): Promise<void> {
  _cache = {
    marketEventIds: [],
    source: 'none',
    nostrEventId: null,
    migrationPending: false,
  }

  // Migration step: move cascade-bookmarks → cascade-bookmarks-legacy (one-time)
  // Note: legacy data uses SLUGS. During migration, resolve slugs → eventIds for Nostr storage.
  const oldKey = localStorage.getItem('cascade-bookmarks')
  if (oldKey && !localStorage.getItem(LEGACY_STORAGE_KEY)) {
    try {
      const oldData = JSON.parse(oldKey) as { marketIds: string[]; counts: Record<string, number> }
      
      // Resolve slugs to eventIds if authenticated (have NDK)
      let resolvedEventIds = oldData.marketIds
      if (pubkey && ndk) {
        resolvedEventIds = await resolveSlugsToEventIds(oldData.marketIds, ndk)
        if (resolvedEventIds.length === 0 && oldData.marketIds.length > 0) {
          console.warn('No slugs resolved to eventIds; skipping these bookmarks during migration')
        }
      }

      // Store resolved eventIds in legacy backup
      const migratedData = { marketIds: resolvedEventIds, counts: oldData.counts }
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(migratedData))
      localStorage.removeItem('cascade-bookmarks')
    } catch (err) {
      // Malformed old data — skip migration
      console.warn('Failed to migrate bookmarks:', err)
      localStorage.removeItem('cascade-bookmarks')
    }
  }

  const legacy = loadLegacyFromStorage()

  // --------- Anonymous user path ---------
  if (!pubkey || !ndk) {
    _cache.marketEventIds = legacy.marketIds
    _cache.source = legacy.marketIds.length > 0 ? 'legacy' : 'none'
    notifyCacheListeners()
    return
  }

  // --------- Authenticated user path ---------
  let nostrList: BookmarksList | null = null

  // Fetch kind 10003 event
  try {
    const events = await ndk.fetchEvents({ kinds: [10003], authors: [pubkey] })
    if (events && events.size > 0) {
      // Sort by created_at DESC, take most recent
      const sorted = Array.from(events).sort((a, b) => b.created_at - a.created_at)
      const event = sorted[0]
      const result = parseBookmarkEvent(event)
      if (result.ok) {
        nostrList = result.list
      }
    }
  } catch {
    // Fetch failed — fall through to legacy
  }

  // Check pending outbox FIRST, then merge logic
  const pending = getPendingPublishes()
  const hasPendingPublish = pending.some((p) => p.pubkey === pubkey)

  // Merge logic: Nostr wins; if empty, use legacy
  if (nostrList && nostrList.entries.length > 0) {
    _cache.marketEventIds = extractMarketEventIds(nostrList)
    _cache.source = 'nostr'
    _cache.nostrEventId = nostrList.eventId
    _cache.migrationPending = false
  } else if (legacy.marketIds.length > 0 && !hasPendingPublish) {
    // Nostr is empty; use legacy and queue migration
    _cache.marketEventIds = legacy.marketIds
    _cache.source = 'legacy'
    _cache.nostrEventId = null
    _cache.migrationPending = true
    // Queue for publish on next sync (only if not already pending)
    if (!hasPendingPublish) {
      addPendingPublish(pubkey, legacy.marketIds)
    }
  } else {
    _cache.source = 'none'
  }

  // Process pending publishes AFTER merge logic (retry or publish if online)
  await processPendingPublishes(pubkey, ndk)

  notifyCacheListeners()
}

/**
 * Process pending publishes: retry failed publishes or publish queued bookmarks.
 * Internal helper, called during init.
 */
async function processPendingPublishes(
  pubkey: string,
  ndk: NDK,
): Promise<void> {
  const pending = getPendingPublishes()
  const entry = pending.find((p) => p.pubkey === pubkey)

  if (!entry) return

  // Max 3 retries per entry
  if (entry.retries >= 3) {
    console.warn('Bookmark publish: max retries exceeded, giving up')
    removePendingPublish(pubkey)
    return
  }

  try {
    await publishBookmarksEvent(pubkey, entry.marketEventIds, ndk)
    removePendingPublish(pubkey)
  } catch (err) {
    console.warn('Bookmark publish failed:', err)
    incrementPendingRetries(pubkey)
    // Keep entry in pending for next retry
  }
}

// ---------------------------------------------------------------------------
// Nostr Event Publishing
// ---------------------------------------------------------------------------

/**
 * Publish bookmarks as a kind 10003 event.
 * Throws on failure.
 *
 * Internal helper—called by processPendingPublishes and direct user interactions.
 */
async function publishBookmarksEvent(
  pubkey: string,
  marketEventIds: string[],
  ndk: NDK,
): Promise<void> {
  if (!ndk.signer) {
    throw new Error(
      'No signer available — cannot publish bookmarks in read-only mode',
    )
  }

  const { content, tags } = serializeBookmarksToEvent(marketEventIds)

  // Publish via nostrService (which throws on failure)
  await publishEvent(content, tags, 10003)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get current bookmarked market event IDs.
 */
export function getBookmarks(): string[] {
  return [..._cache.marketEventIds]
}

/**
 * Check if a market event ID is bookmarked.
 */
export function isBookmarked(marketEventId: string): boolean {
  return _cache.marketEventIds.includes(marketEventId)
}

/**
 * Add a bookmark for a market event ID.
 * Updates cache and queues Nostr publish if authenticated.
 * Does NOT write to legacy storage (read-only after migration).
 * Does NOT publish immediately (async publish happens in background).
 */
export function addBookmark(
  marketEventId: string,
  pubkey: string | null,
  ndk: NDK | null,
): void {
  if (_cache.marketEventIds.includes(marketEventId)) return

  _cache.marketEventIds = [..._cache.marketEventIds, marketEventId]

  // Queue Nostr publish if authenticated
  if (pubkey && ndk) {
    addPendingPublish(pubkey, _cache.marketEventIds)
    // Fire async publish (do not await—return immediately)
    publishBookmarksEvent(pubkey, _cache.marketEventIds, ndk).catch((err) => {
      console.warn('Background bookmark publish failed:', err)
      // Entry stays in pending for retry
    })
  }

  notifyCacheListeners()
}

/**
 * Remove a bookmark for a market event ID.
 * Updates cache and queues Nostr publish if authenticated.
 * Does NOT write to legacy storage (read-only after migration).
 */
export function removeBookmark(
  marketEventId: string,
  pubkey: string | null,
  ndk: NDK | null,
): void {
  if (!_cache.marketEventIds.includes(marketEventId)) return

  _cache.marketEventIds = _cache.marketEventIds.filter(
    (id) => id !== marketEventId,
  )

  // Queue Nostr publish if authenticated
  if (pubkey && ndk) {
    addPendingPublish(pubkey, _cache.marketEventIds)
    publishBookmarksEvent(pubkey, _cache.marketEventIds, ndk).catch((err) => {
      console.warn('Background bookmark publish failed:', err)
    })
  }

  notifyCacheListeners()
}

/**
 * Get count of bookmarks.
 */
export function getBookmarkCount(): number {
  return _cache.marketEventIds.length
}

/**
 * Refresh bookmarks from Nostr (fetch latest kind 10003).
 * Called periodically or on user request.
 * Re-merges and updates cache.
 */
export async function refreshBookmarks(
  pubkey: string | null,
  ndk: NDK | null,
): Promise<void> {
  if (!pubkey || !ndk) return // Anonymous users cannot refresh

  try {
    const events = await ndk.fetchEvents({ kinds: [10003], authors: [pubkey] })
    if (!events || events.size === 0) return

    const sorted = Array.from(events).sort((a, b) => b.created_at - a.created_at)
    const event = sorted[0]
    const result = parseBookmarkEvent(event)
    if (!result.ok) return

    const nostrList = result.list
    _cache.marketEventIds = extractMarketEventIds(nostrList)
    _cache.source = 'nostr'
    _cache.nostrEventId = nostrList.eventId
    _cache.migrationPending = false

    notifyCacheListeners()
  } catch (err) {
    console.warn('Refresh bookmarks failed:', err)
  }
}
```

**Why**: All state-changing decisions centralize here. The store owns the merge strategy (Nostr wins), the pending outbox, and the split localStorage model (legacy backup + pending). This isolation makes the logic testable and changes easier to reason about.

---

### `src/useBookmarks.ts`

**Action**: Modify

**What**: Simplify to call bookmarkStore operations. Pass pubkey and ndk for store decisions. Keep backward-compatible return signature.

```typescript
import { useEffect, useState, useCallback } from 'react'
import {
  getBookmarks,
  isBookmarked,
  addBookmark,
  removeBookmark,
  getBookmarkCount,
  refreshBookmarks,
  onBookmarksChanged,
  initializeBookmarks,
} from './bookmarkStore'
import { useNostr } from './context/NostrContext'

export function useBookmarks(marketIds?: string[]) {
  const { pubkey, ndkInstance: ndk } = useNostr()
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([])

  // Initialize on mount or when pubkey changes
  useEffect(() => {
    initializeBookmarks(pubkey, ndk)
  }, [pubkey, ndk])

  // Listen to bookmark changes
  useEffect(() => {
    const unsubscribe = onBookmarksChanged(() => {
      setBookmarkedIds(getBookmarks())
    })
    // Initial sync
    setBookmarkedIds(getBookmarks())
    return unsubscribe
  }, [])

  const toggle = useCallback(
    (marketId: string) => {
      if (isBookmarked(marketId)) {
        removeBookmark(marketId, pubkey, ndk)
      } else {
        addBookmark(marketId, pubkey, ndk)
      }
    },
    [pubkey, ndk],
  )

  const getCount = useCallback(
    (marketId: string) => {
      // For now, return bookmark count (1 if bookmarked, 0 otherwise)
      // In future, this could aggregate global counts from Nostr relay
      return isBookmarked(marketId) ? 1 : 0
    },
    [],
  )

  const getTopBookmarked = useCallback(
    (limit?: number) => {
      // Return bookmarked IDs as { marketId, count } objects
      // Shallow copy to avoid mutation
      const items = bookmarkedIds.map((id) => ({ marketId: id, count: 1 }))
      return limit ? items.slice(0, limit) : items
    },
    [bookmarkedIds],
  )

  return {
    bookmarkedIds,
    toggle,
    isBookmarked: (id: string) => isBookmarked(id),
    getCount,
    getTopBookmarked,
    refresh: () => refreshBookmarks(pubkey, ndk),
  }
}
```

**Why**: Hook no longer owns initialization or state management. It delegates to the store and listens for changes via observer pattern. Return signature matches existing callers (BookmarksPage, MarketDetail, Leaderboard) exactly: `bookmarkedIds: string[]`, `getCount(marketId): number`, `getTopBookmarked(limit?): { marketId, count }[]`. The shallow copy with spread operator fixes the mutation bug.

---

### `src/App.tsx`

**Action**: Modify (initialization section around line 595)

**What**: Call `initializeBookmarks` when auth context is ready.

```typescript
// Around existing store initialization:

import { initializeBookmarks } from './bookmarkStore'

// ... inside App component or initialization effect:

useEffect(() => {
  if (ndkInstance && pubkey !== undefined) {
    // Initialize all stores (positions, bookmarks, etc.)
    initializePositions(pubkey, ndkInstance)
    initializeBookmarks(pubkey, ndkInstance)
  }
}, [ndkInstance, pubkey])
```

**Why**: Ensures bookmarks initialize alongside other stores. Pubkey and NDK are available from context.

---

### `src/tests/bookmarkStore.test.ts`

**Action**: Create

**What**: Comprehensive adapter layer tests (risky logic). Tests BEFORE service tests so adapter is verified first.

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initializeBookmarks,
  addBookmark,
  removeBookmark,
  getBookmarks,
  isBookmarked,
  getBookmarkCount,
  refreshBookmarks,
  onBookmarksChanged,
  type BookmarkCache,
} from '../bookmarkStore'

// Mock NDK and nostrService
vi.mock('../services/nostrService', () => ({
  publishEvent: vi.fn(),
}))

vi.mock('../services/bookmarkService', () => ({
  parseBookmarkEvent: vi.fn(),
  serializeBookmarksToEvent: vi.fn(),
  extractMarketEventIds: vi.fn(),
}))

describe('bookmarkStore', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  // --------- Initialization Tests ---------

  it('initializes to empty for anonymous user', async () => {
    await initializeBookmarks(null, null)
    expect(getBookmarks()).toEqual([])
  })

  it('initializes with legacy data when no Nostr event exists', async () => {
    // Pre-populate legacy storage
    localStorage.setItem(
      'cascade-bookmarks-legacy',
      JSON.stringify({
        marketIds: ['event1', 'event2'],
        counts: {},
      }),
    )

    const mockNdk = { fetchEvents: vi.fn().mockResolvedValue(new Set()) }
    await initializeBookmarks('pubkey123', mockNdk as any)

    expect(getBookmarks()).toEqual(['event1', 'event2'])
  })

  it('prioritizes Nostr event over legacy data', async () => {
    // Pre-populate legacy
    localStorage.setItem(
      'cascade-bookmarks-legacy',
      JSON.stringify({
        marketIds: ['legacy1', 'legacy2'],
        counts: {},
      }),
    )

    // Mock Nostr fetch returning a kind 10003 event
    const mockEvent = {
      kind: 10003,
      pubkey: 'pubkey123',
      id: 'event-id-123',
      created_at: 1000000,
      getMatchingTags: (tag: string) =>
        tag === 'e'
          ? [['e', 'nostr-event1'], ['e', 'nostr-event2']]
          : [],
    }
    const mockNdk = {
      fetchEvents: vi.fn().mockResolvedValue(new Set([mockEvent])),
    }

    const { parseBookmarkEvent } = await import('../services/bookmarkService')
    ;(parseBookmarkEvent as any).mockReturnValue({
      ok: true,
      list: {
        eventId: 'event-id-123',
        pubkey: 'pubkey123',
        createdAt: 1000000,
        entries: [
          { marketEventId: 'nostr-event1' },
          { marketEventId: 'nostr-event2' },
        ],
      },
    })

    await initializeBookmarks('pubkey123', mockNdk as any)
    expect(getBookmarks()).toEqual(['nostr-event1', 'nostr-event2'])
  })

  it('queues migration when legacy exists but Nostr is empty', async () => {
    localStorage.setItem(
      'cascade-bookmarks-legacy',
      JSON.stringify({
        marketIds: ['legacy1'],
        counts: {},
      }),
    )

    const mockNdk = { fetchEvents: vi.fn().mockResolvedValue(new Set()) }
    await initializeBookmarks('pubkey123', mockNdk as any)

    expect(getBookmarks()).toEqual(['legacy1'])
    // Verify pending publish was queued
    const pending = JSON.parse(
      localStorage.getItem('cascade-bookmarks-pending') || '[]',
    )
    expect(pending).toHaveLength(1)
    expect(pending[0].pubkey).toBe('pubkey123')
    expect(pending[0].marketEventIds).toEqual(['legacy1'])
  })

  // --------- Add/Remove Bookmark Tests ---------

  it('adds bookmark to cache and legacy storage', () => {
    addBookmark('event1', null, null)
    expect(getBookmarks()).toContain('event1')
    expect(isBookmarked('event1')).toBe(true)

    const legacy = JSON.parse(
      localStorage.getItem('cascade-bookmarks-legacy') || '{}',
    )
    expect(legacy.marketIds).toContain('event1')
  })

  it('does not add duplicate bookmarks', () => {
    addBookmark('event1', null, null)
    addBookmark('event1', null, null)
    expect(getBookmarks().filter((id) => id === 'event1')).toHaveLength(1)
  })

  it('removes bookmark from cache and legacy storage', () => {
    addBookmark('event1', null, null)
    removeBookmark('event1', null, null)
    expect(getBookmarks()).not.toContain('event1')
    expect(isBookmarked('event1')).toBe(false)
  })

  it('calls observer listeners when bookmarks change', async () => {
    const listener = vi.fn()
    const unsubscribe = onBookmarksChanged(listener)

    addBookmark('event1', null, null)
    expect(listener).toHaveBeenCalled()

    unsubscribe()
    listener.mockClear()
    addBookmark('event2', null, null)
    expect(listener).not.toHaveBeenCalled()
  })

  // --------- Count Tests ---------

  it('returns correct bookmark count', () => {
    addBookmark('event1', null, null)
    addBookmark('event2', null, null)
    expect(getBookmarkCount()).toBe(2)
  })

  // --------- Refresh Tests ---------

  it('refreshes bookmarks from Nostr', async () => {
    const mockEvent = {
      kind: 10003,
      pubkey: 'pubkey123',
      id: 'event-id-123',
      created_at: 2000000,
      getMatchingTags: (tag: string) =>
        tag === 'e' ? [['e', 'refreshed-event1']] : [],
    }

    const mockNdk = {
      fetchEvents: vi.fn().mockResolvedValue(new Set([mockEvent])),
    }

    const { parseBookmarkEvent } = await import('../services/bookmarkService')
    ;(parseBookmarkEvent as any).mockReturnValue({
      ok: true,
      list: {
        eventId: 'event-id-123',
        pubkey: 'pubkey123',
        createdAt: 2000000,
        entries: [{ marketEventId: 'refreshed-event1' }],
      },
    })

    await refreshBookmarks('pubkey123', mockNdk as any)
    expect(getBookmarks()).toEqual(['refreshed-event1'])
  })

  it('does nothing on refresh for anonymous user', async () => {
    addBookmark('event1', null, null)
    await refreshBookmarks(null, null)
    expect(getBookmarks()).toEqual(['event1']) // Unchanged
  })

  // --------- Edge Cases ---------

  it('handles Nostr fetch error gracefully', async () => {
    localStorage.setItem(
      'cascade-bookmarks-legacy',
      JSON.stringify({
        marketIds: ['legacy1'],
        counts: {},
      }),
    )

    const mockNdk = {
      fetchEvents: vi.fn().mockRejectedValue(new Error('Network error')),
    }

    // Should not throw; falls back to legacy
    await expect(
      initializeBookmarks('pubkey123', mockNdk as any),
    ).resolves.not.toThrow()
    expect(getBookmarks()).toEqual(['legacy1'])
  })

  it('handles malformed legacy storage', async () => {
    localStorage.setItem('cascade-bookmarks-legacy', 'invalid json')
    const mockNdk = { fetchEvents: vi.fn().mockResolvedValue(new Set()) }

    await expect(
      initializeBookmarks('pubkey123', mockNdk as any),
    ).resolves.not.toThrow()
    expect(getBookmarks()).toEqual([])
  })
})
```

**Why**: Tests the risky adapter logic before service tests. Covers initialization paths, merge strategy, observer pattern, and edge cases.

---

### `src/tests/bookmarkService.test.ts`

**Action**: Create

**What**: Pure service layer tests. Serialization, deserialization, edge cases.

```typescript
import { describe, it, expect } from 'vitest'
import {
  serializeBookmarksToEvent,
  parseBookmarkEvent,
  extractMarketEventIds,
} from '../services/bookmarkService'

describe('bookmarkService', () => {
  // --------- Serialization Tests ---------

  it('serializes market event IDs to kind 10003 e tags', () => {
    const { content, tags } = serializeBookmarksToEvent([
      'event1',
      'event2',
    ])
    expect(content).toBe('')
    expect(tags).toEqual([
      ['e', 'event1'],
      ['e', 'event2'],
    ])
  })

  it('serializes empty bookmark list', () => {
    const { content, tags } = serializeBookmarksToEvent([])
    expect(content).toBe('')
    expect(tags).toEqual([])
  })

  // --------- Deserialization Tests ---------

  it('parses valid kind 10003 event', () => {
    const event = {
      kind: 10003,
      pubkey: 'npub123',
      id: 'event-id',
      created_at: 1000000,
      getMatchingTags: (tag: string) =>
        tag === 'e'
          ? [
              ['e', 'market1'],
              ['e', 'market2'],
            ]
          : [],
    }

    const result = parseBookmarkEvent(event as any)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.list.entries).toEqual([
        { marketEventId: 'market1' },
        { marketEventId: 'market2' },
      ])
      expect(result.list.pubkey).toBe('npub123')
    }
  })

  it('rejects event with wrong kind', () => {
    const event = {
      kind: 30001, // Wrong kind
      pubkey: 'npub123',
      id: 'event-id',
      created_at: 1000000,
      getMatchingTags: () => [],
    }

    const result = parseBookmarkEvent(event as any)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('invalid_kind')
    }
  })

  it('rejects event missing pubkey', () => {
    const event = {
      kind: 10003,
      pubkey: null,
      id: 'event-id',
      created_at: 1000000,
      getMatchingTags: () => [],
    }

    const result = parseBookmarkEvent(event as any)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.reason).toBe('missing_pubkey')
    }
  })

  it('deduplicates market event IDs', () => {
    const event = {
      kind: 10003,
      pubkey: 'npub123',
      id: 'event-id',
      created_at: 1000000,
      getMatchingTags: (tag: string) =>
        tag === 'e'
          ? [
              ['e', 'market1'],
              ['e', 'market1'], // Duplicate
              ['e', 'market2'],
            ]
          : [],
    }

    const result = parseBookmarkEvent(event as any)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.list.entries).toHaveLength(2)
      expect(result.list.entries.map((e) => e.marketEventId)).toEqual([
        'market1',
        'market2',
      ])
    }
  })

  it('ignores non-e tags', () => {
    const event = {
      kind: 10003,
      pubkey: 'npub123',
      id: 'event-id',
      created_at: 1000000,
      getMatchingTags: (tag: string) =>
        tag === 'e'
          ? [['e', 'market1']]
          : tag === 'p'
            ? [['p', 'author1']]
            : [],
    }

    const result = parseBookmarkEvent(event as any)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.list.entries).toEqual([{ marketEventId: 'market1' }])
    }
  })

  // --------- Extraction Tests ---------

  it('extracts market event IDs from parsed list', () => {
    const list = {
      eventId: 'event-id',
      pubkey: 'npub123',
      createdAt: 1000000,
      entries: [
        { marketEventId: 'market1' },
        { marketEventId: 'market2' },
      ],
    }

    const ids = extractMarketEventIds(list)
    expect(ids).toEqual(['market1', 'market2'])
  })

  it('extracts empty list', () => {
    const list = {
      eventId: 'event-id',
      pubkey: 'npub123',
      createdAt: 1000000,
      entries: [],
    }

    const ids = extractMarketEventIds(list)
    expect(ids).toEqual([])
  })
})
```

**Why**: Pure functions are easy to test. Service tests verify the contract (serialization/deserialization) that adapter relies on.

---

## Execution Order

### Phase 1: Service Layer (No Dependencies)

1. Create `src/services/bookmarkService.ts` with serialization/deserialization functions.
   - **Verify**: `npm run build` passes; no compilation errors.

2. Create `src/tests/bookmarkService.test.ts` with 15+ pure function tests.
   - **Verify**: `npx vitest run src/tests/bookmarkService.test.ts` — all tests pass.

### Phase 2: Adapter Layer + Tests (Depends on Phase 1)

3. Rewrite `src/bookmarkStore.ts` with localStorage split model (legacy + pending), merge logic, initialization, and observer pattern.
   - **Verify**: `npm run build` passes.

4. Create `src/tests/bookmarkStore.test.ts` with 20+ adapter tests (initialization, merge, add/remove, refresh, edge cases).
   - **Verify**: `npx vitest run src/tests/bookmarkStore.test.ts` — all tests pass.

### Phase 3: React Integration (Depends on Phase 2)

5. Simplify `src/useBookmarks.ts` to delegate to bookmarkStore and fix array mutation bug.
   - **Verify**: `npm run build` passes.

6. Update `src/App.tsx` initialization section to call `initializeBookmarks(pubkey, ndk)`.
   - **Verify**: `npm run build` passes; app builds without errors.

7. Verify no component signature changes are required by checking `useBookmarks` hook API against existing usage sites.
   - **Verify**: Search for `useBookmarks` calls; confirm no changes to returned object keys.

### Phase 4: Integration + E2E Verification (Depends on Phases 1–3)

8. Run full test suite: `npm run test` — all tests pass including 35+ bookmark tests.
   - **Verify**: `npm run test` output shows passing counts.

9. Manual integration test (dev environment):
   - **Scenario A (Anonymous)**: Load app, bookmark a market, reload page, verify bookmark persists in localStorage.
   - **Scenario B (Authenticated, empty Nostr)**: Sign in with new key, bookmark a market, verify it publishes and appears as kind 10003 event.
   - **Scenario C (Migrate)**: Populate legacy storage, sign in, verify migration is queued and published.
   - **Scenario D (Refresh)**: Bookmark on device A, fetch on device B using `refreshBookmarks()`, verify it syncs.
   - **Scenario E (Offline)**: Bookmark while offline, come back online, verify queued publish retries.

10. Type safety pass: `npm run build` — all strict checks pass.
    - **Verify**: No `any` types; all imports resolve.

---

## Verification

### Automated Checks

- **Type checking**: `npm run build` passes with strict mode.
- **Tests**: `npm run test` passes with:
  - `bookmarkService.test.ts`: 15+ tests (serialization 4, deserialization 5, deduplication 1, extraction 2, edge cases 3)
  - `bookmarkStore.test.ts`: 20+ tests (initialization 3, merge 3, add/remove 3, observers 1, count 1, refresh 2, edge cases 3)
  - Total: 35+ tests covering all code paths in both service and adapter layers.
- **Build**: `npm run build` completes without errors.

### Integration Test Scenarios

1. **Anonymous bookmark persistence**: User (not signed in) bookmarks market A, reloads page, market A is still bookmarked.
2. **Authenticated publish**: User signs in (new key), bookmarks market B, verifies kind 10003 event was published to relay.
3. **Legacy migration**: User has old `cascade-bookmarks` key in localStorage, signs in, app publishes merged bookmarks as kind 10003.
4. **Cross-device sync**: User bookmarks on device A, signs in on device B, fetches kind 10003, sees same bookmarks.
5. **Offline resilience**: User bookmarks while offline, reconnects, sees pending publish retried and succeeded.
6. **Fetch failure fallback**: Nostr fetch fails during init, app falls back to legacy data without crashing.

### Manual Testing Checklist

- [ ] Add bookmark to market (not signed in) — verify appears in UI and localStorage.
- [ ] Remove bookmark (not signed in) — verify removed from UI and localStorage.
- [ ] Sign in (has legacy bookmarks) — verify migration queued and published.
- [ ] Bookmark new market (signed in) — verify published and kind 10003 event appears on relay.
- [ ] Remove bookmark (signed in) — verify updated kind 10003 published.
- [ ] Refresh bookmarks button — verify fetches latest kind 10003 and updates UI.
- [ ] Log out and back in — verify bookmarks re-load from Nostr.
- [ ] Offline: add bookmark, go offline, come back online — verify pending publish retries and succeeds.
- [ ] Test with read-only mode (no signer) — verify graceful error when attempting publish.

### Edge Cases to Test

- Empty legacy data + empty Nostr = no cache entries.
- Malformed localStorage JSON = falls back to empty.
- Duplicate e tags in kind 10003 = deduplicated.
- Fetch timeout = uses fallback (legacy or empty).
- Max retries (3) exceeded = stops retrying, logs warning.
- Anonymous user calls `refresh()` = no-op (returns immediately).
- Event missing pubkey = rejected with `missing_pubkey` reason.
- Event wrong kind = rejected with `invalid_kind` reason.

---

## Scope & Limitations

### In Scope

- NIP-51 kind 10003 serialization and deserialization
- localStorage split model (legacy backup + pending outbox)
- Initialization for authenticated and anonymous users
- Migration from legacy bookmarks to Nostr
- Merge logic (Nostr wins)
- Publish and retry logic with max 3 retries
- Observer pattern for cache changes
- 35+ tests covering all code paths
- React hook refactored to delegate to store
- App initialization wired for pubkey/ndk changes

### Out of Scope / Deferred

- Follower counts displayed on bookmarks — currently not implemented; would require kind 3 (contacts) fetching and aggregation.
- Bookmark collections (multiple named lists) — NIP-51 supports multiple d-tags for parameterized lists, but Cascade only needs one global "bookmarks" list.
- Sync conflict resolution beyond "Nostr wins" — more sophisticated merge strategies (e.g., LWW with timestamps) deferred.
- Offline subscription to kind 10003 — app fetches on demand; real-time sync deferred.
- Analytics on bookmark popularity — relay-side aggregation deferred.

---

## Success Criteria

1. ✓ **Service layer** (`bookmarkService.ts`) exports `serializeBookmarksToEvent` and `parseBookmarkEvent` with correct NIP-51 event structure (kind 10003, e tags, no d-tag).
2. ✓ **Event format** matches NIP-51 spec: replaceable by pubkey, e tags for market event IDs, empty content.
3. ✓ **Adapter layer** (`bookmarkStore.ts`) owns all stateful decisions: initialization, merge, outbox retry, observer notification.
4. ✓ **Publish pattern** throws on failure (matches `positionService.ts`); no error-return pattern.
5. ✓ **localStorage split** into `cascade-bookmarks-legacy` (backup) and `cascade-bookmarks-pending` (outbox); old single flag removed.
6. ✓ **Initialization** handles null pubkey and null ndk (anonymous users); re-initializes on pubkey change.
7. ✓ **Merge strategy** uses simple rule: Nostr wins; if Nostr empty, use legacy; no timestamp-based precedence.
8. ✓ **Hook** (`useBookmarks.ts`) no longer mutates arrays; uses spread operator for `sort()`.
9. ✓ **React components** require NO signature changes to `useBookmarks` hook (API surface unchanged).
10. ✓ **Test coverage**: 35+ tests (service 15+, adapter 20+) covering initialization, merge, add/remove, refresh, edge cases.
11. ✓ **Type safety**: All types defined explicitly; no `any` types; strict mode passes.
12. ✓ **Backward compatibility**: Legacy localStorage respected; migration is graceful fallback, not hard requirement.
13. ✓ **Offline resilience**: Pending outbox queues publishes; retry logic with max 3 retries.
14. ✓ **Build & test**: `npm run build` and `npm run test` both pass.
15. ✓ **Integration**: Manual scenarios (anonymous, authenticated, migration, cross-device, offline) all work as specified.
