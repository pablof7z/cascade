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

// Per-user keys prevent data leakage between authenticated sessions
// Anonymous mode uses a single shared key
function getLegacyKey(pubkey: string | null): string {
  return pubkey
    ? `cascade-bookmarks-legacy-${pubkey}`
    : 'cascade-bookmarks-legacy-anon'
}

function getMigrationFlagKey(pubkey: string | null): string {
  return pubkey
    ? `cascade-bookmarks-migrated-${pubkey}`
    : 'cascade-bookmarks-migrated-anon'
}

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
  pubkey: string | null // Cache is user-scoped; null = anonymous
  marketEventIds: string[] // The authoritative list
  source: 'none' | 'legacy' | 'nostr' | 'merged'
  nostrEventId: string | null // If fetched from Nostr, the event ID
  migrationPending: boolean // True if legacy exists but Nostr publish pending
}

// ---------------------------------------------------------------------------
// Module State
// ---------------------------------------------------------------------------

const _cache: BookmarkCache = {
  pubkey: null,
  marketEventIds: [],
  source: 'none',
  nostrEventId: null,
  migrationPending: false,
}

const _listeners: Set<() => void> = new Set()

// ---------------------------------------------------------------------------
// Observer Pattern
// ---------------------------------------------------------------------------

/**
 * Notify all listeners that the cache has changed.
 */
function notifyCacheListeners(): void {
  for (const listener of _listeners) {
    listener()
  }
}

/**
 * Subscribe to bookmark changes.
 * Returns unsubscribe function.
 */
export function onBookmarksChanged(listener: () => void): () => void {
  _listeners.add(listener)
  return () => {
    _listeners.delete(listener)
  }
}

/**
 * Clear the in-memory cache.
 * Called on logout to prevent cross-user data leakage.
 */
export function clearCache(): void {
  _cache.pubkey = null
  _cache.marketEventIds = []
  _cache.source = 'none'
  _cache.nostrEventId = null
  _cache.migrationPending = false
  notifyCacheListeners()
}

// ---------------------------------------------------------------------------
// Legacy Storage Helpers
// ---------------------------------------------------------------------------

function loadLegacyBookmarks(pubkey: string | null): LegacyBookmarkData | null {
  try {
    const raw = localStorage.getItem(getLegacyKey(pubkey))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return {
      marketIds: Array.isArray(parsed.marketIds) ? parsed.marketIds : [],
      counts:
        parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Pending Publish Helpers
// ---------------------------------------------------------------------------

function getPendingPublishes(): PendingBookmarkPublish[] {
  try {
    const raw = localStorage.getItem('cascade-bookmarks-pending')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function savePendingPublishes(pending: PendingBookmarkPublish[]): void {
  try {
    localStorage.setItem('cascade-bookmarks-pending', JSON.stringify(pending))
  } catch {
    // quota exceeded — silently ignore
  }
}

function addPendingPublish(pubkey: string, marketEventIds: string[]): void {
  const pending = getPendingPublishes()
  const index = pending.findIndex((p) => p.pubkey === pubkey)
  const entry: PendingBookmarkPublish = {
    pubkey,
    marketEventIds,
    createdAt: Math.floor(Date.now() / 1000),
    retries: 0,
  }
  if (index >= 0) {
    pending[index] = entry
  } else {
    pending.push(entry)
  }
  savePendingPublishes(pending)
}

function removePendingPublish(pubkey: string): void {
  const pending = getPendingPublishes().filter((p) => p.pubkey !== pubkey)
  savePendingPublishes(pending)
}

function incrementPendingRetries(pubkey: string): void {
  const pending = getPendingPublishes()
  const entry = pending.find((p) => p.pubkey === pubkey)
  if (entry) {
    entry.retries++
    savePendingPublishes(pending)
  }
}

function getMigrationFlag(pubkey: string | null): boolean {
  return localStorage.getItem(getMigrationFlagKey(pubkey)) === 'true'
}

function setMigrationFlag(pubkey: string | null, migrated: boolean): void {
  if (migrated) {
    localStorage.setItem(getMigrationFlagKey(pubkey), 'true')
  } else {
    localStorage.removeItem(getMigrationFlagKey(pubkey))
  }
}

// ---------------------------------------------------------------------------
// Initialization with Merge Logic
// ---------------------------------------------------------------------------

/**
 * Initialize bookmark state for a user.
 * Loads from legacy storage and/or Nostr, then merges.
 * Must be called when:
 * - App mounts (for anonymous users)
 * - User signs in (for authenticated users)
 * - User logs out (with null pubkey)
 *
 * Merge strategy: Nostr wins. If no Nostr event, use legacy. If neither, empty.
 */
export async function initializeBookmarks(
  pubkey: string | null,
  ndk: NDK | null,
): Promise<void> {
  // Capture the pubkey before any async work — used to detect user switches.
  const initiatingPubkey = pubkey
  _cache.pubkey = pubkey

  // Update cache key to new user (if changed)
  // Load legacy data
  const legacy = loadLegacyBookmarks(pubkey)
  const legacyIds = legacy?.marketIds ?? []

  // Load from Nostr if authenticated
  let nostrList: BookmarksList | null = null

  if (pubkey && ndk) {
    try {
      const events = await ndk.fetchEvents({
        kinds: [10003],
        authors: [pubkey],
      })

      if (events && events.size > 0) {
        // Sort by created_at DESC, take most recent
        const sorted = Array.from(events).sort(
          (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
        )
        const result = parseBookmarkEvent(sorted[0])
        if (result.ok) {
          nostrList = result.list
        }
      }
    } catch (err) {
      console.warn('Failed to fetch bookmarks from Nostr:', err)
      // Fall back to legacy data
    }
  }

  // Merge logic: Nostr wins
  if (nostrList) {
    // Guard: if user switched during fetch, discard stale data
    if (_cache.pubkey !== initiatingPubkey) return
    _cache.marketEventIds = extractMarketEventIds(nostrList)
    _cache.source = 'nostr'
    _cache.nostrEventId = nostrList.eventId
    _cache.migrationPending = false

    // Mark as migrated so we don't queue another publish
    setMigrationFlag(pubkey, true)
  } else if (legacyIds.length > 0) {
    // Guard: if user switched during fetch, discard stale data
    if (_cache.pubkey !== initiatingPubkey) return
    _cache.marketEventIds = legacyIds
    _cache.source = 'legacy'
    _cache.nostrEventId = null

    // Queue migration publish if authenticated
    if (pubkey && ndk && !getMigrationFlag(pubkey)) {
      _cache.migrationPending = true
      addPendingPublish(pubkey, legacyIds)
    } else {
      _cache.migrationPending = false
    }
  } else {
    // Guard: if user switched during fetch, discard stale data
    if (_cache.pubkey !== initiatingPubkey) return
    _cache.marketEventIds = []
    _cache.nostrEventId = null
    _cache.migrationPending = false
    _cache.source = 'none'
  }

  // Process pending publishes AFTER merge logic (retry or publish if online)
  // Pass nostrCreatedAt so stale pending entries (older than the Nostr event) are skipped.
  // Guard: if user switched during fetch, skip processing stale pending entries.
  if (_cache.pubkey !== initiatingPubkey) return
  const nostrCreatedAt = nostrList?.createdAt
  if (pubkey) {
    await processPendingPublishes(pubkey, ndk, nostrCreatedAt)
  }

  notifyCacheListeners()
}

/**
 * Process pending publishes: retry failed publishes or publish queued bookmarks.
 * Internal helper, called during init.
 */
async function processPendingPublishes(
  pubkey: string,
  ndk: NDK | null,
  nostrCreatedAt?: number,
): Promise<void> {
  const pending = getPendingPublishes()
  const entry = pending.find((p) => p.pubkey === pubkey)

  if (!entry) return

  // Guard: only process pending if it is newer than the existing Nostr event.
  // This prevents stale local state from overwriting newer remote data.
  if (nostrCreatedAt !== undefined && entry.createdAt <= nostrCreatedAt) {
    console.info('Bookmark publish: pending is stale, skipping')
    removePendingPublish(pubkey)
    return
  }

  // Max 3 retries per entry
  if (entry.retries >= 3) {
    console.warn('Bookmark publish: max retries exceeded, giving up')
    removePendingPublish(pubkey)
    return
  }

  // If ndk is null, we can't publish — just keep the entry for later
  if (!ndk) return

  try {
    await publishBookmarksEvent(pubkey, entry.marketEventIds, ndk)
    removePendingPublish(pubkey)
    setMigrationFlag(pubkey, true)
    _cache.migrationPending = false
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
  _pubkey: string,
  marketEventIds: string[],
  ndk: NDK,
): Promise<NDKEvent> {
  if (!ndk.signer) {
    throw new Error(
      'No signer available — cannot publish bookmarks in read-only mode',
    )
  }

  const { content, tags } = serializeBookmarksToEvent(marketEventIds)

  // Publish via nostrService (which throws on failure)
  return publishEvent(content, tags, 10003)
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
    // Capture the createdAt of our pending entry before the async publish fires.
    // This prevents race conditions: if another add/remove fires before our publish
    // succeeds, we won't accidentally remove the newer pending entry.
    const pendingEntry = getPendingPublishes().find((p) => p.pubkey === pubkey)
    const ourCreatedAt = pendingEntry?.createdAt
    publishBookmarksEvent(pubkey, _cache.marketEventIds, ndk)
      .then(() => {
        const current = getPendingPublishes().find((p) => p.pubkey === pubkey)
        if (current && current.createdAt === ourCreatedAt) {
          removePendingPublish(pubkey)
        }
      })
      .catch((err) => {
        console.warn('Background bookmark publish failed:', err)
        // Keep entry in pending for retry
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
    // Capture the createdAt of our pending entry before the async publish fires.
    // This prevents race conditions: if another add/remove fires before our publish
    // succeeds, we won't accidentally remove the newer pending entry.
    const pendingEntry = getPendingPublishes().find((p) => p.pubkey === pubkey)
    const ourCreatedAt = pendingEntry?.createdAt
    publishBookmarksEvent(pubkey, _cache.marketEventIds, ndk)
      .then(() => {
        const current = getPendingPublishes().find((p) => p.pubkey === pubkey)
        if (current && current.createdAt === ourCreatedAt) {
          removePendingPublish(pubkey)
        }
      })
      .catch((err) => {
        console.warn('Background bookmark publish failed:', err)
        // Keep entry in pending for retry
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

    const sorted = Array.from(events).sort(
      (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
    )
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
