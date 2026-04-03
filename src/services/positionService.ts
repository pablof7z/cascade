/**
 * Position Service — Domain Logic for Nostr Persistence
 *
 * Encapsulates all position-specific Nostr logic:
 * - Serializing/deserializing positions to/from NDK events (kind 30078, NIP-78)
 * - Event validation (owner-only events; no concurrency checks needed)
 * - Weighted-average merge logic when adding to existing positions
 * - Fetch, publish, and subscribe transport primitives
 *
 * This module is pure: no React hooks, no localStorage, no nostrService singleton.
 * NDK and pubkey are injected by callers (positionStore, usePositions).
 */

import NDK, { NDKEvent, type NDKFilter, type NDKSubscription } from '@nostr-dev-kit/ndk'
import type { Position, PositionDirection } from '../positionStore'

// ---------------------------------------------------------------------------
// Event kind constant
// ---------------------------------------------------------------------------

/** NIP-78 application-specific data kind */
export const POSITION_EVENT_KIND = 30078

// ---------------------------------------------------------------------------
// Result types (discriminated unions, mirrors marketService pattern)
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; position: Position }
  | { ok: false; error: string; reason: 'invalid_json' | 'missing_d_tag' | 'invalid_position' }

export type ValidationResult =
  | { valid: true; position: Position }
  | { valid: false; reason: string }

// ---------------------------------------------------------------------------
// d-tag helpers
// ---------------------------------------------------------------------------

/** Build the d-tag value for a position: cascade:position:<marketId>:<direction> */
function buildDTag(marketId: string, direction: PositionDirection): string {
  return `cascade:position:${marketId}:${direction}`
}

/** Parse a d-tag value into marketId + direction. Returns null if format invalid. */
export function extractPositionIdFromDTag(
  dTag: string,
): { marketId: string; direction: PositionDirection } | null {
  // Expected format: cascade:position:<marketId>:<direction>
  if (!dTag.startsWith('cascade:position:')) return null
  const rest = dTag.slice('cascade:position:'.length)
  // direction is the last segment; everything before it is the marketId
  const lastColon = rest.lastIndexOf(':')
  if (lastColon === -1) return null
  const marketId = rest.slice(0, lastColon)
  const direction = rest.slice(lastColon + 1)
  if (!marketId) return null
  if (direction !== 'yes' && direction !== 'no') return null
  return { marketId, direction }
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

/**
 * Serialize a Position to event content and tags for a kind 30078 event.
 * Tags: d-tag for identity, v-tag for version.
 * Content: JSON-stringified position.
 */
export function serializePositionToEvent(position: Position): { content: string; tags: string[][] } {
  const tags: string[][] = [
    ['d', buildDTag(position.marketId, position.direction)],
    ['c', 'cascade'],
    ['v', '1'],
  ]
  return {
    content: JSON.stringify(position),
    tags,
  }
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a kind 30078 NDKEvent into a typed Position object.
 * Returns a discriminated union result (ok/error) — never throws.
 */
export function parsePositionEvent(event: NDKEvent): ParseResult {
  // Verify d-tag is present and has correct format
  const dTag = event.getMatchingTags('d')[0]?.[1]
  if (!dTag || !dTag.startsWith('cascade:position:')) {
    return { ok: false, error: 'Missing or invalid d-tag', reason: 'missing_d_tag' }
  }

  const idComponents = extractPositionIdFromDTag(dTag)
  if (!idComponents) {
    return { ok: false, error: 'Malformed d-tag format', reason: 'missing_d_tag' }
  }

  // Parse JSON content
  let raw: unknown
  try {
    raw = JSON.parse(event.content)
  } catch {
    return { ok: false, error: 'Content is not valid JSON', reason: 'invalid_json' }
  }

  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Content is not an object', reason: 'invalid_position' }
  }

  const obj = raw as Record<string, unknown>

  // Validate required position fields
  if (!obj.id || typeof obj.id !== 'string') {
    return { ok: false, error: 'Position missing id field', reason: 'invalid_position' }
  }
  if (!obj.marketId || typeof obj.marketId !== 'string') {
    return { ok: false, error: 'Position missing marketId field', reason: 'invalid_position' }
  }
  if (!obj.marketTitle || typeof obj.marketTitle !== 'string') {
    return { ok: false, error: 'Position missing marketTitle field', reason: 'invalid_position' }
  }
  if (obj.direction !== 'yes' && obj.direction !== 'no') {
    return { ok: false, error: 'Position has invalid direction', reason: 'invalid_position' }
  }
  if (typeof obj.quantity !== 'number') {
    return { ok: false, error: 'Position missing quantity field', reason: 'invalid_position' }
  }
  if (typeof obj.entryPrice !== 'number') {
    return { ok: false, error: 'Position missing entryPrice field', reason: 'invalid_position' }
  }
  if (typeof obj.costBasis !== 'number') {
    return { ok: false, error: 'Position missing costBasis field', reason: 'invalid_position' }
  }
  if (typeof obj.timestamp !== 'number') {
    return { ok: false, error: 'Position missing timestamp field', reason: 'invalid_position' }
  }

  const position = raw as Position
  // Stamp ownerPubkey from the Nostr event author — this is the canonical owner identity
  if (event.pubkey) {
    position.ownerPubkey = event.pubkey
  }
  return { ok: true, position }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate a kind 30078 event: checks pubkey, d-tag format, and content validity.
 * Positions are user-exclusive — only ownership check (pubkey present).
 */
export function validatePositionEvent(event: NDKEvent): ValidationResult {
  if (!event.pubkey) {
    return { valid: false, reason: 'Event has no pubkey' }
  }

  const dTag = event.getMatchingTags('d')[0]?.[1]
  if (!dTag || !dTag.startsWith('cascade:position:')) {
    return { valid: false, reason: 'Missing or invalid d-tag' }
  }

  const idComponents = extractPositionIdFromDTag(dTag)
  if (!idComponents) {
    return { valid: false, reason: 'Malformed d-tag format' }
  }

  let position: Position
  try {
    position = JSON.parse(event.content) as Position
  } catch {
    return { valid: false, reason: 'Content is not valid JSON' }
  }

  if (!position || typeof position !== 'object') {
    return { valid: false, reason: 'Content is not a valid position object' }
  }

  return { valid: true, position }
}

// ---------------------------------------------------------------------------
// Weighted-average merge logic
// ---------------------------------------------------------------------------

/**
 * Compute a weighted-average position when adding new quantity to an existing position.
 * Takes the existing position, new quantity, and new entry price.
 * Returns an updated position with new total quantity, averaged price, and cost basis.
 * Does not publish — caller decides when to persist.
 */
export function computeWeightedAveragePosition(
  existing: Position,
  newQty: number,
  newPrice: number,
): Position {
  if (newQty <= 0) return existing
  if (existing.quantity <= 0) {
    // Degenerate case: existing has zero quantity — treat as new position at new price
    return {
      ...existing,
      quantity: newQty,
      entryPrice: newPrice,
      costBasis: newPrice * newQty,
      timestamp: Date.now(),
    }
  }

  const totalQty = existing.quantity + newQty
  const avgPrice =
    (existing.entryPrice * existing.quantity + newPrice * newQty) / totalQty

  return {
    ...existing,
    quantity: totalQty,
    entryPrice: avgPrice,
    costBasis: avgPrice * totalQty,
    timestamp: Date.now(),
  }
}

// ---------------------------------------------------------------------------
// Nostr transport
// ---------------------------------------------------------------------------

/**
 * Publish a position to Nostr as a kind 30078 replaceable event.
 * Returns the published NDKEvent or throws on failure.
 */
export async function publishPosition(
  ndk: NDK,
  position: Position,
): Promise<NDKEvent> {
  if (!ndk.signer) throw new Error('No signer available — cannot publish position in read-only mode')

  const { content, tags } = serializePositionToEvent(position)
  const event = new NDKEvent(ndk)
  event.kind = POSITION_EVENT_KIND
  event.content = content
  event.tags = tags

  await event.publish()
  return event
}

/**
 * Publish a position removal marker to Nostr (quantity = 0).
 * Uses a replaceable event to signal the position is closed.
 * Returns the published NDKEvent or throws on failure.
 */
export async function publishPositionRemoval(
  ndk: NDK,
  position: Position,
): Promise<NDKEvent> {
  const removedPosition: Position = {
    ...position,
    quantity: 0,
    costBasis: 0,
    timestamp: Date.now(),
  }
  return publishPosition(ndk, removedPosition)
}

/**
 * Fetch all positions for a user from Nostr.
 * Filters by kind 30078, author pubkey, and cascade:position d-tag prefix.
 * Returns valid, non-zero-quantity positions sorted by timestamp descending.
 */
export async function fetchPositions(ndk: NDK, pubkey: string): Promise<Position[]> {
  const filter: NDKFilter = {
    kinds: [POSITION_EVENT_KIND],
    authors: [pubkey],
  }

  const eventsSet = await ndk.fetchEvents(filter)
  const positions: Position[] = []

  for (const event of eventsSet) {
    // Skip events that aren't position events
    const dTag = event.getMatchingTags('d')[0]?.[1]
    if (!dTag || !dTag.startsWith('cascade:position:')) continue

    const parseResult = parsePositionEvent(event)
    if (!parseResult.ok) {
      console.warn('[positionService] Failed to parse position event:', parseResult.error)
      continue
    }

    const validationResult = validatePositionEvent(event)
    if (!validationResult.valid) {
      console.warn('[positionService] Position event failed validation:', validationResult.reason)
      continue
    }

    // Skip removal markers (quantity = 0)
    if (parseResult.position.quantity <= 0) continue

    positions.push(parseResult.position)
  }

  // Sort by timestamp descending (most recent first)
  return positions.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Fetch all positions across the platform from Nostr.
 * Unlike fetchPositions which filters by author pubkey, this fetches
 * kind 30078 events from ALL authors (global trade activity).
 * Filters by cascade:position d-tag prefix and #c: cascade tag.
 * Returns valid, non-zero-quantity positions sorted by timestamp descending.
 */
export async function fetchAllPositions(ndk: NDK): Promise<Position[]> {
  const filter: NDKFilter = {
    kinds: [POSITION_EVENT_KIND],
    '#c': ['cascade'],
  }

  const eventsSet = await ndk.fetchEvents(filter)
  const positions: Position[] = []

  for (const event of eventsSet) {
    // Skip events that aren't position events
    const dTag = event.getMatchingTags('d')[0]?.[1]
    if (!dTag || !dTag.startsWith('cascade:position:')) continue

    const parseResult = parsePositionEvent(event)
    if (!parseResult.ok) {
      console.warn('[positionService] Failed to parse position event:', parseResult.error)
      continue
    }

    const validationResult = validatePositionEvent(event)
    if (!validationResult.valid) {
      console.warn('[positionService] Position event failed validation:', validationResult.reason)
      continue
    }

    // Skip removal markers (quantity = 0)
    if (parseResult.position.quantity <= 0) continue

    positions.push(parseResult.position)
  }

  // Sort by timestamp descending (most recent first)
  return positions.sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Subscribe to live position updates for a user.
 * Calls callback with the full updated position list on each new event.
 * Caller is responsible for cleanup (subscription.stop()).
 */
export function subscribeToPositions(
  ndk: NDK,
  pubkey: string,
  callback: (positions: Position[]) => void,
): NDKSubscription {
  const filter: NDKFilter = {
    kinds: [POSITION_EVENT_KIND],
    authors: [pubkey],
  }

  // Maintain a local map of positions keyed by marketId:direction
  const positionsMap = new Map<string, Position>()

  const sub = ndk.subscribe(filter, { closeOnEose: false })

  sub.on('event', (event: NDKEvent) => {
    const dTag = event.getMatchingTags('d')[0]?.[1]
    if (!dTag || !dTag.startsWith('cascade:position:')) return

    const parseResult = parsePositionEvent(event)
    if (!parseResult.ok) return

    const validationResult = validatePositionEvent(event)
    if (!validationResult.valid) return

    const position = parseResult.position
    const key = `${position.marketId}:${position.direction}`

    if (position.quantity <= 0) {
      // Removal marker — delete from map
      positionsMap.delete(key)
    } else {
      positionsMap.set(key, position)
    }

    // Emit updated list sorted by timestamp descending
    const sorted = Array.from(positionsMap.values()).sort((a, b) => b.timestamp - a.timestamp)
    callback(sorted)
  })

  return sub
}
