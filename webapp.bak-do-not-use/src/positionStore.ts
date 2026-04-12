/**
 * Position persistence adapter layer.
 *
 * Routes position operations to Nostr (kind 30078, NIP-78) when user is
 * logged in, or falls back silently to localStorage for anonymous users.
 *
 * All public function signatures are preserved for backward compatibility
 * with Portfolio.tsx, MarketDetail.tsx, and any other consumers.
 *
 * Call `initializePositions(pubkey, ndk)` once at app startup (from App.tsx)
 * to wire up Nostr persistence. Until then, all operations use localStorage.
 */

import type NDK from '@nostr-dev-kit/ndk'
import type { NDKSubscription } from '@nostr-dev-kit/ndk'
import {
  fetchPositions,
  publishPosition,
  publishPositionRemoval,
  computeWeightedAveragePosition,
  subscribeToPositions,
} from './services/positionService'

// ---------------------------------------------------------------------------
// Types (exported — public API, unchanged)
// ---------------------------------------------------------------------------

export type PositionDirection = 'yes' | 'no'

export type Position = {
  id: string
  marketId: string
  marketTitle: string
  direction: PositionDirection
  quantity: number
  entryPrice: number
  costBasis: number
  timestamp: number
  /** Nostr pubkey of the position owner. Set when logged in; undefined for anonymous positions. */
  ownerPubkey?: string
  /** ecash token received when opening position - needed for redemption/settlement */
  positionProof?: string
  /** Whether position has been redeemed/claimed */
  settled?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'cascade-positions'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

/** In-memory cache — always in sync regardless of backing storage */
let _positionsCache: Position[] = []

/** True when user is logged in and Nostr transport is active */
let _usingNostr = false

/** True after first-login migration from localStorage has completed */
let _migrationDone = false

/** Live Nostr subscription handle — stopped and replaced on each init */
let _subscription: NDKSubscription | null = null

/** NDK instance for async operations (addPosition, removePosition) */
let _ndk: NDK | null = null

/** Current user's pubkey — set in initializePositions, used to stamp ownerPubkey on new positions */
let _currentPubkey: string | null = null

// ---------------------------------------------------------------------------
// Cache change event emitter (lightweight, no external deps)
// ---------------------------------------------------------------------------

type CacheListener = () => void
const _cacheListeners: Set<CacheListener> = new Set()

/** Subscribe to cache changes. Returns unsubscribe function. */
export function onPositionsChanged(listener: CacheListener): () => void {
  _cacheListeners.add(listener)
  return () => _cacheListeners.delete(listener)
}

/** Notify all subscribers that the cache has changed. */
function notifyCacheListeners(): void {
  for (const listener of _cacheListeners) {
    listener()
  }
}

// ---------------------------------------------------------------------------
// localStorage helpers (internal)
// ---------------------------------------------------------------------------

function loadFromLocalStorage(): Position[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed as Position[]
  } catch {
    return []
  }
}

function saveToLocalStorage(positions: Position[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch {
    // quota exceeded — silently ignore
  }
}

// ---------------------------------------------------------------------------
// Unique ID generator
// ---------------------------------------------------------------------------

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

// ---------------------------------------------------------------------------
// Migration: localStorage → Nostr on first login
// ---------------------------------------------------------------------------

/**
 * If localStorage contains positions and the user just logged in,
 * publish each position to Nostr and clear localStorage on success.
 * On publish failure (offline), keeps localStorage as backup.
 */
async function migrateFromLocalStorageIfNeeded(pubkey: string, ndk: NDK): Promise<void> {
  if (_migrationDone) return

  const localPositions = loadFromLocalStorage()
  if (localPositions.length === 0) {
    _migrationDone = true
    return
  }

  console.info(`[positionStore] Migrating ${localPositions.length} positions from localStorage to Nostr`)

  let successCount = 0
  for (const position of localPositions) {
    try {
      await publishPosition(ndk, position)
      successCount++
    } catch (err) {
      console.warn('[positionStore] Migration publish failed for position:', position.id, err)
    }
  }

  if (successCount === localPositions.length) {
    // All published successfully — clear localStorage
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    console.info('[positionStore] Migration complete — localStorage cleared')
  } else {
    console.warn(
      `[positionStore] Migration partial: ${successCount}/${localPositions.length} published. localStorage kept as backup.`,
    )
  }

  _migrationDone = true
  void pubkey // pubkey is used implicitly via ndk signer
}

// ---------------------------------------------------------------------------
// Initialization (called from App.tsx when Nostr context is ready)
// ---------------------------------------------------------------------------

/**
 * Initialize position persistence.
 * - If user has pubkey: fetch from Nostr, subscribe to live updates, migrate localStorage if needed
 * - If no pubkey (anonymous): load from localStorage, no Nostr ops
 *
 * This is non-blocking — callers should catch and log errors for graceful fallback.
 */
export async function initializePositions(pubkey: string | null, ndk: NDK | null): Promise<void> {
  // Stop any existing subscription
  if (_subscription) {
    _subscription.stop()
    _subscription = null
  }

  if (!pubkey || !ndk) {
    // Anonymous user — use localStorage
    _usingNostr = false
    _ndk = null
    _currentPubkey = null
    _positionsCache = loadFromLocalStorage()
    notifyCacheListeners()
    return
  }

  _ndk = ndk
  _currentPubkey = pubkey

  try {
    // Fetch current positions from Nostr
    const nostrPositions = await fetchPositions(ndk, pubkey)
    _positionsCache = nostrPositions
    _usingNostr = true
    notifyCacheListeners()

    // Subscribe to live updates (single subscription authority — only here)
    _subscription = subscribeToPositions(ndk, pubkey, (positions) => {
      _positionsCache = positions
      notifyCacheListeners()
    })

    // Migrate any existing localStorage positions
    await migrateFromLocalStorageIfNeeded(pubkey, ndk)
  } catch (err) {
    console.warn('[positionStore] Nostr init failed, falling back to localStorage:', err)
    _usingNostr = false
    _ndk = null
    _positionsCache = loadFromLocalStorage()
    notifyCacheListeners()
  }
}

// ---------------------------------------------------------------------------
// Public API (signatures preserved)
// ---------------------------------------------------------------------------

/** Load all positions — returns in-memory cache (Nostr or localStorage) */
export function loadPositions(): Position[] {
  return _positionsCache
}

/**
 * Persist the full position list.
 * Routes to Nostr when logged in, otherwise localStorage.
 */
export function savePositions(positions: Position[]): void {
  _positionsCache = positions
  notifyCacheListeners()

  if (_usingNostr && _ndk) {
    // Publish each position to Nostr asynchronously — non-blocking
    for (const position of positions) {
      publishPosition(_ndk, position).catch((err: unknown) => {
        console.warn('[positionStore] Failed to publish position to Nostr:', err)
      })
    }
    return
  }

  // Fallback: persist to localStorage
  saveToLocalStorage(positions)
}

/**
 * Record a new trade.
 * If the user already holds a position on the same market+direction, average into it.
 * Otherwise creates a new row.
 * Publishes to Nostr or saves to localStorage based on auth state.
 */
export function addPosition(
  marketId: string,
  marketTitle: string,
  direction: PositionDirection,
  quantity: number,
  entryPrice: number,
  positionProof?: string,
): Position {
  const positions = loadPositions()

  const existing = positions.find(
    (p) => p.marketId === marketId && p.direction === direction,
  )

  if (existing) {
    // Use positionService weighted-average logic
    const updated = computeWeightedAveragePosition(existing, quantity, entryPrice)
    const updatedPositions = positions.map((p) => (p.id === existing.id ? updated : p))
    _positionsCache = updatedPositions
    notifyCacheListeners()

    if (_usingNostr && _ndk) {
      // Publish updated position to Nostr (replaces previous event via d-tag)
      publishPosition(_ndk, updated).catch((err: unknown) => {
        console.warn('[positionStore] Failed to publish updated position to Nostr:', err)
      })
    } else {
      saveToLocalStorage(updatedPositions)
    }

    return updated
  }

  const pos: Position = {
    id: uid(),
    marketId,
    marketTitle,
    direction,
    quantity,
    entryPrice,
    costBasis: entryPrice * quantity,
    timestamp: Date.now(),
    ..._currentPubkey ? { ownerPubkey: _currentPubkey } : {},
    ...(positionProof ? { positionProof } : {}),
  }

  const updatedPositions = [...positions, pos]
  _positionsCache = updatedPositions
  notifyCacheListeners()

  if (_usingNostr && _ndk) {
    publishPosition(_ndk, pos).catch((err: unknown) => {
      console.warn('[positionStore] Failed to publish new position to Nostr:', err)
    })
  } else {
    saveToLocalStorage(updatedPositions)
  }

  return pos
}

/** Get all positions for a specific market */
export function getPositionsForMarket(marketId: string): Position[] {
  return _positionsCache.filter((p) => p.marketId === marketId)
}

/** Remove a single position by id */
export function removePosition(positionId: string): void {
  const position = _positionsCache.find((p) => p.id === positionId)
  const updatedPositions = _positionsCache.filter((p) => p.id !== positionId)
  _positionsCache = updatedPositions
  notifyCacheListeners()

  if (_usingNostr && _ndk) {
    if (position) {
      // Publish removal marker (quantity=0) to Nostr
      publishPositionRemoval(_ndk, position).catch((err: unknown) => {
        console.warn('[positionStore] Failed to publish position removal to Nostr:', err)
      })
    }
    return
  }

  saveToLocalStorage(updatedPositions)
}

/** Mark a position as settled (payout completed) */
export function markPositionSettled(positionId: string): void {
  const position = _positionsCache.find((p) => p.id === positionId)
  if (!position) {
    console.warn('[positionStore] markPositionSettled: position not found', positionId)
    return
  }
  position.settled = true
  notifyCacheListeners()
  saveToLocalStorage(_positionsCache)
}

/** Get positions for a market that can be redeemed (matching outcome and not settled) */
export function getRedeemablePositions(marketSlug: string, outcome: 'YES' | 'NO'): Position[] {
  return _positionsCache.filter((p) => {
    const directionMatches = p.direction.toUpperCase() === outcome
    const notSettled = p.settled !== true
    const marketMatches = p.marketId === marketSlug
    return directionMatches && notSettled && marketMatches
  })
}
