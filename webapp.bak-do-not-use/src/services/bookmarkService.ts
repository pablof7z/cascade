/**
 * Bookmark Service — Domain Logic for NIP-33 Kind 10003 (Replaceable User Metadata)
 *
 * Encapsulates serialization/deserialization of bookmarks to/from Nostr kind 10003 events.
 * Kind 10003 is NIP-33 replaceable (not NIP-51 parameterized). No localStorage, no async operations — pure functions only.
 */

import type NDK from '@nostr-dev-kit/ndk'
import type { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk'

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
 * Serialize a list of market event IDs to NIP-33 kind 10003 event format.
 * Returns { content, tags } ready for NDKEvent.
 *
 * Kind 10003 (NIP-33 replaceable): Replaced by pubkey alone (no d-tag).
 * Each bookmark is an 'e' tag pointing to a market event ID.
 * Content MUST be empty string per NIP-33 spec.
 */
export function serializeBookmarksToEvent(marketEventIds: string[]): {
  content: string
  tags: string[][]
} {
  const tags: string[][] = marketEventIds.map((eventId) => ['e', eventId])
  return {
    content: '', // NIP-33 spec requires empty string for kind 10003
    tags,
  }
}

// ---------------------------------------------------------------------------
// Deserialization: NIP-33 kind 10003 event → BookmarksList
// ---------------------------------------------------------------------------

export type ParseResult =
  | { ok: true; list: BookmarksList }
  | {
      ok: false
      error: string
      reason: 'invalid_kind' | 'missing_pubkey' | 'invalid_tags'
    }

/**
 * Parse a NIP-33 kind 10003 event into a BookmarksList.
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
        kinds: [982 as NDKKind],
        '#d': [slug],
      })

      if (events && events.size > 0) {
        // Sort by created_at DESC, take most recent (kind 982 events are non-replaceable)
        const sorted = Array.from(events).sort(
          (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0),
        )
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
