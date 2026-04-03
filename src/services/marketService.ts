/**
 * Market Service — Domain Logic for Nostr Persistence
 *
 * Encapsulates all market-specific Nostr logic:
 * - Parsing kind 982 non-replaceable market events
 * - Publishing markets as kind 982 events
 * - Fetching and subscribing to markets
 *
 * Transport primitives (fetchEvents, publishEvent, subscribe) live in nostrService.ts.
 */

import type { NDKEvent } from '@nostr-dev-kit/ndk'
import { createEmptyMarket } from '../market'
import type { Market } from '../market'
import {
  fetchAllMarketsTransport,
  subscribeToMarketTransport,
  subscribeToAllCascadeMarkets,
  publishEvent,
} from './nostrService'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; market: Market }
  | { ok: false; error: string; reason: 'missing_d_tag' | 'invalid_market' | 'invalid_kind' }

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Parse a kind 982 non-replaceable event into a Market object.
 * Content is markdown. Title and description come from explicit tags.
 * Rejects any event with kind !== 982.
 * The canonical market identifier is event.id (Nostr event ID). The d-tag is a human-readable slug.
 */
export function parseMarketEvent(event: NDKEvent): ParseResult {
  if (event.kind !== 982) {
    return { ok: false, error: `Expected kind 982, got ${event.kind}`, reason: 'invalid_kind' }
  }

  const slug = event.getMatchingTags('d')[0]?.[1]
  if (!slug) {
    return { ok: false, error: 'Missing d-tag', reason: 'missing_d_tag' }
  }

  const title = event.getMatchingTags('title')[0]?.[1] ?? 'Untitled Market'
  const description = event.getMatchingTags('description')[0]?.[1] ?? ''
  const mint = event.getMatchingTags('mint')[0]?.[1] ?? 'https://mint.contrarian.markets'
  const image = event.getMatchingTags('image')[0]?.[1]

  const base = createEmptyMarket({
    slug,
    title,
    description,
    mint,
    ...(image ? { image } : {}),
    creatorPubkey: event.pubkey ?? '',
  })

  const market: Market = {
    ...base,
    eventId: event.id ?? '',
    createdAt: event.created_at ?? Math.floor(Date.now() / 1000),
  }

  return { ok: true, market }
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch all Cascade markets from Nostr (kind 982).
 * Returns parsed Market objects (invalid events are skipped).
 *
 * The limit defaults to 50 to cap relay load and initial hydration time.
 */
export async function fetchAllMarkets(limit = 50): Promise<Market[]> {
  const events = await fetchAllMarketsTransport(limit)
  const markets: Market[] = []

  for (const event of events) {
    const parseResult = parseMarketEvent(event)
    if (!parseResult.ok) {
      console.warn('Hydration: rejected market event:', parseResult.reason, event.id)
      continue
    }
    markets.push(parseResult.market)
  }

  return markets
}

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------

/**
 * Subscribe to real-time updates for a specific market by event ID.
 * Returns an NDKSubscription that can be stopped with sub.stop().
 * Callback receives parsed Market objects — invalid events are ignored.
 */
export function subscribeToMarketUpdates(
  eventId: string,
  callback: (market: Market, isDeletion: boolean) => void,
) {
  return subscribeToMarketTransport(eventId, (event: NDKEvent) => {
    const parseResult = parseMarketEvent(event)
    if (!parseResult.ok) {
      console.warn('Rejected invalid market event:', parseResult.reason)
      return
    }
    callback(parseResult.market, false)
  })
}

/**
 * Subscribe to all Cascade market events for live discovery.
 * Callback receives parsed Market objects — invalid events are ignored.
 */
export function subscribeToAllMarkets(
  callback: (market: Market, isDeletion: boolean) => void,
) {
  return subscribeToAllCascadeMarkets((event: NDKEvent) => {
    const parseResult = parseMarketEvent(event)
    if (!parseResult.ok) {
      console.warn('Subscription: rejected market event:', parseResult.reason, event.id)
      return
    }
    callback(parseResult.market, false)
  })
}

// ---------------------------------------------------------------------------
// NIP-09 Deletion
// ---------------------------------------------------------------------------

/**
 * Publish a NIP-09 kind 5 deletion event for a kind 982 market.
 * Note: Kind 982 events are immutable — deletion just signals relays to remove the event.
 */
export async function publishDeletionEvent(market: Market): Promise<void> {
  await publishEvent(
    `Deleting cascade market ${market.eventId}`,
    [['e', market.eventId]],
    5,
  )
}
