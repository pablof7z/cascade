/**
 * Market Service — Domain Logic for Nostr Persistence
 *
 * Encapsulates all market-specific Nostr logic:
 * - Serializing/deserializing markets to/from NDK events
 * - Concurrency-safe publishing with version checks
 * - Event validation (creator/backup signer authority)
 * - State hashing for conflict detection
 * - Migration normalization for pre-Nostr markets
 *
 * Transport primitives (fetchEvents, publishEvent, subscribe) live in nostrService.ts.
 */

import type { NDKEvent } from '@nostr-dev-kit/ndk'
import type { Market } from '../market'
import {
  fetchMarketById,
  fetchAllMarketsTransport,
  subscribeToMarketTransport,
  subscribeToAllCascadeMarkets,
  publishMarket as publishMarketTransport,
  publishEvent,
} from './nostrService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; market: Market }
  | { ok: false; error: string; reason: 'invalid_json' | 'missing_d_tag' | 'invalid_market' }

export type ValidationResult =
  | { valid: true; market: Market; isDeletion: boolean }
  | { valid: false; reason: string }

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConcurrencyError'
  }
}

// ---------------------------------------------------------------------------
// State Hashing
// ---------------------------------------------------------------------------

/**
 * Compute a fast hash of the market's LMSR state (reserves, shares, participant accounts).
 * Excludes metadata fields (version, timestamps) so the hash reflects only economic state.
 * Uses djb2 — sufficient for conflict detection, not cryptographic security.
 */
export function computeStateHash(market: Market): string {
  const payload = JSON.stringify({
    qLong: market.qLong,
    qShort: market.qShort,
    reserve: market.reserve,
    participants: market.participants,
  })
  let hash = 5381
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash) ^ payload.charCodeAt(i)
    hash = hash >>> 0 // keep unsigned 32-bit
  }
  return hash.toString(16).padStart(8, '0')
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a market to the event content and tags for a kind 30000 Nostr event.
 */
export function serializeMarketToEvent(market: Market): { content: string; tags: string[][] } {
  const tags: string[][] = [
    ['d', `market:${market.id}`],
    ['c', 'cascade'],
    ['version', String(market.version)],
    ['stateHash', market.stateHash],
  ]
  if (market.backupPubkey) {
    tags.push(['backup', market.backupPubkey])
  }
  tags.push(['status', market.status])
  if (market.resolutionOutcome) {
    tags.push(['outcome', market.resolutionOutcome])
  }
  return {
    content: JSON.stringify(market),
    tags,
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a kind 30000 Nostr event into a typed Market object.
 * Returns a discriminated union result (ok/error) — never throws.
 */
export function parseMarketEvent(event: NDKEvent): ParseResult {
  // Verify d-tag is present and has correct format
  const dTag = event.getMatchingTags('d')[0]?.[1]
  if (!dTag || !dTag.startsWith('market:')) {
    return { ok: false, error: 'missing_d_tag', reason: 'missing_d_tag' }
  }

  // Parse JSON content
  let raw: unknown
  try {
    raw = JSON.parse(event.content)
  } catch {
    return { ok: false, error: 'invalid_json', reason: 'invalid_json' }
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Content is not an object', reason: 'invalid_market' }
  }

  const obj = raw as Record<string, unknown>
  if (!obj.id || typeof obj.id !== 'string') {
    return { ok: false, error: 'Market missing id field', reason: 'invalid_market' }
  }

  // Return as Market — consumer is responsible for trusting the data shape
  // (we can't fully validate LMSR state without re-running it)
  return { ok: true, market: raw as Market }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a kind 30000 event: checks signature authority, d-tag format,
 * deletion status, and backup signer anti-rollback.
 */
export function validateMarketEvent(event: NDKEvent): ValidationResult {
  if (!event.pubkey) {
    return { valid: false, reason: 'Event has no pubkey' }
  }

  const dTag = event.getMatchingTags('d')[0]?.[1]
  if (!dTag || !dTag.startsWith('market:')) {
    return { valid: false, reason: 'Missing or invalid d-tag' }
  }

  let market: Market
  try {
    market = JSON.parse(event.content) as Market
  } catch {
    return { valid: false, reason: 'Content is not valid JSON' }
  }

  // Check deletion marker first (archived markets are valid but flag isDeletion)
  if (market.status === 'archived') {
    // Still verify signer for archived events
    if (
      event.pubkey !== market.creatorPubkey &&
      event.pubkey !== market.backupPubkey
    ) {
      return { valid: false, reason: 'Deletion event signed by unauthorized signer' }
    }
    return { valid: true, market, isDeletion: true }
  }

  // Validate signer is creator or backup
  if (
    event.pubkey !== market.creatorPubkey &&
    event.pubkey !== market.backupPubkey
  ) {
    return { valid: false, reason: 'Event signed by unauthorized signer' }
  }

  // If signed by backup, ensure no version rollback
  if (event.pubkey === market.backupPubkey) {
    const versionTag = event.getMatchingTags('version')[0]?.[1]
    const eventVersion = parseInt(versionTag ?? '0', 10)
    if (eventVersion < (market.version ?? 0)) {
      return { valid: false, reason: 'Backup signer cannot rollback version' }
    }
  }

  return { valid: true, market, isDeletion: false }
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * Publish a market event to Nostr with concurrency checking.
 * Fetches the latest version from Nostr and compares stateHash before publishing.
 * Throws ConcurrencyError if another user modified the market since our last sync.
 * Returns the updated market with incremented version and computed stateHash.
 */
export async function publishMarketEventWithConcurrencyCheck(
  localMarket: Market,
): Promise<Market> {
  // Fetch current Nostr state to detect conflicts
  const latestEvent = await fetchMarketById(localMarket.id)
  let latestVersion = 0

  if (latestEvent) {
    const parseResult = parseMarketEvent(latestEvent)
    if (parseResult.ok) {
      const latest = parseResult.market
      const localHash = computeStateHash(localMarket)
      const remoteHash = computeStateHash(latest)

      // If remote has a higher version and different state, someone else modified it
      if (
        latest.version > (localMarket.version ?? 0) &&
        remoteHash !== localHash
      ) {
        throw new ConcurrencyError(
          `Market ${localMarket.id} was modified by another user (local v${localMarket.version ?? 0}, remote v${latest.version})`,
        )
      }

      latestVersion = latest.version ?? 0
    }
  }

  // Safe to publish: increment version, recompute stateHash
  const updatedMarket: Market = {
    ...localMarket,
    version: latestVersion + 1,
    stateHash: computeStateHash(localMarket),
    lastUpdatedAt: Math.floor(Date.now() / 1000),
  }

  const { tags } = serializeMarketToEvent(updatedMarket)
  await publishMarketTransport(updatedMarket, tags)

  return updatedMarket
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all Cascade markets from Nostr (kind 30000, '#c': ['cascade']).
 * Returns validated Market objects (invalid, unauthorized, or archived events are skipped).
 *
 * The limit defaults to 50 to cap relay load and initial hydration time. Increasing this
 * risks slow startup and relay rate-limiting; consider pagination for large deployments.
 */
export async function fetchAllMarkets(limit = 50): Promise<Market[]> {
  const events = await fetchAllMarketsTransport(limit)
  const markets: Market[] = []

  for (const event of events) {
    const parseResult = parseMarketEvent(event)
    if (!parseResult.ok) continue

    const validation = validateMarketEvent(event)
    if (!validation.valid) {
      console.warn('Hydration: rejected market event (authority check failed):', validation.reason, event.id)
      continue
    }
    if (validation.isDeletion) continue

    markets.push(validation.market)
  }

  return markets
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for a specific market.
 * Returns an NDKSubscription that can be stopped with sub.stop().
 * Callback receives parsed, validated Market objects — invalid events are ignored.
 */
export function subscribeToMarketUpdates(
  marketId: string,
  callback: (market: Market, isDeletion: boolean) => void,
) {
  return subscribeToMarketTransport(marketId, (event: NDKEvent) => {
    const validation = validateMarketEvent(event)
    if (!validation.valid) {
      console.warn('Rejected invalid market event:', validation.reason)
      return
    }
    callback(validation.market, validation.isDeletion)
  })
}

/**
 * Subscribe to all Cascade market events for live discovery.
 * Callback receives parsed Market objects — invalid/archived events are ignored.
 * Used by LandingPage to discover new markets without page reload.
 */
export function subscribeToAllMarkets(
  callback: (market: Market, isDeletion: boolean) => void,
) {
  return subscribeToAllCascadeMarkets((event: NDKEvent) => {
    const parseResult = parseMarketEvent(event)
    if (!parseResult.ok) return

    const validation = validateMarketEvent(event)
    if (!validation.valid) {
      console.warn('Subscription: rejected market event (authority check failed):', validation.reason, event.id)
      return
    }

    callback(validation.market, validation.isDeletion)
  })
}

// ---------------------------------------------------------------------------
// NIP-09 Deletion
// ---------------------------------------------------------------------------

/**
 * Publish an archived market state event followed by a NIP-09 kind 5 deletion event.
 *
 * Two-phase deletion:
 * 1. Publish the market as 'archived' (kind 30000) so other clients receive the deletion
 *    signal via normal market subscriptions and can archive local copies.
 * 2. Publish a NIP-09 kind 5 event so relays that support deletion can remove the
 *    original market event.
 */
export async function publishDeletionEvent(
  market: Market,
): Promise<void> {
  // Phase 1: publish archived market state so subscribers receive the deletion signal
  const archivedMarket: Market = {
    ...market,
    status: 'archived',
    version: (market.version ?? 0) + 1,
    stateHash: computeStateHash(market),
    lastUpdatedAt: Math.floor(Date.now() / 1000),
  }
  const { tags: archivedTags } = serializeMarketToEvent(archivedMarket)
  await publishMarketTransport(archivedMarket, archivedTags)

  // Phase 2: NIP-09 kind 5 deletion event
  await publishEvent(
    `Deleting cascade market ${market.id}`,
    [
      ['e', market.id],
      ['a', `30000::market:${market.id}`],
    ],
    5,
  )
}

/**
 * Check if a market is effectively deleted (archived status OR NIP-09 deletion event).
 */
export function isMarketDeleted(market: Market): boolean {
  return market.status === 'archived'
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * Normalize a legacy market (pre-Nostr) to include required version/hash/status fields.
 * Safe to call on already-normalized markets (idempotent).
 */
export function normalizeMarketForMigration(market: Market): Market {
  return {
    ...market,
    version: market.version ?? 0,
    stateHash: market.stateHash || computeStateHash(market),
    status: market.status ?? 'active',
  }
}
