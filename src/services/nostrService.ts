/**
 * Nostr Service — Pure Module (no React hooks)
 *
 * Handles NDK initialization and core Nostr operations.
 * Relay URLs are injected by NostrContextProvider at startup.
 *
 * Event structure for market discussion posts (NIP-22, kind 1111):
 *   kind: 1111 (NIP-22 comment)
 *   tags: [["e", "<kind-982-event-id>", "<relay>", "root"], ["k", "982"], ["p", "<market-creator-pubkey>"], ["stance", ...], ["type", ...]]
 *   content: "Post text"
 *
 * The "e" tag with "root" marker references the kind 982 market event (non-replaceable).
 * The "k" tag indicates the kind of the referenced root event (982 for markets).
 * Replies use NIP-10: ["e", rootId, relay, "root"], ["e", parentId, relay, "reply"], ["k", "1111"]
 *
 * Reactions (NIP-25) use kind 7 events:
 *   tags: [["e", eventId], ["p", authorPubkey]]
 *   content: "+"
 */

import NDK, {
  NDKEvent,
  NDKKind,
  NDKNip07Signer,
  type NDKFilter,
  type NDKSubscription,
} from '@nostr-dev-kit/ndk'
import type { Market } from '../market'

let _ndk: NDK | null = null
let _pubkey: string | null = null
let _ready = false

/**
 * Initialize the Nostr service with relay URLs.
 * Called once at app startup by NostrContextProvider.
 * Re-initialization (e.g., when testnet mode toggles) replaces the existing instance.
 */
export async function initNostrService(relayUrls: string[]): Promise<void> {
  _ready = false
  _pubkey = null

  // Detect NIP-07 signer (browser extension)
  let signer: NDKNip07Signer | undefined
  if (typeof window !== 'undefined' && (window as Window & { nostr?: unknown }).nostr) {
    try {
      signer = new NDKNip07Signer()
    } catch {
      // NIP-07 unavailable or failed — proceed read-only
    }
  }

  _ndk = new NDK({
    explicitRelayUrls: relayUrls,
    signer,
  })

  try {
    await _ndk.connect()
  } catch {
    // Connection errors are non-fatal; NDK will retry
  }

  // Attempt to get pubkey from signer
  if (signer) {
    try {
      const user = await signer.user()
      _pubkey = user.pubkey ?? null
    } catch {
      // Signer unavailable — read-only mode
      _pubkey = null
    }
  }

  _ready = true
}

/** Returns the active NDK instance, or null if not yet initialized. */
export function getNDK(): NDK | null {
  return _ndk
}

/** Returns the authenticated user's hex pubkey, or null in read-only mode. */
export function getPubkey(): string | null {
  return _pubkey
}

/** Returns true once initNostrService has completed. */
export function isReady(): boolean {
  return _ready
}

/**
 * Publish a Nostr event.
 * @param content - Event content text
 * @param tags    - Array of tag arrays (e.g. [["m", "market-id"]])
 * @param kind    - Event kind (default: 1 for text notes; use 7 for NIP-25 reactions)
 */
export async function publishEvent(
  content: string,
  tags: string[][],
  kind: number = 1
): Promise<NDKEvent> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  if (!_ndk.signer) throw new Error('No signer available — cannot publish in read-only mode')

  const event = new NDKEvent(_ndk)
  event.kind = kind
  event.content = content
  event.tags = tags

  await event.publish()
  return event
}

/**
 * Fetch events matching the given filter.
 * Returns a Set of NDKEvents.
 */
export async function fetchEvents(filter: NDKFilter): Promise<Set<NDKEvent>> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  return _ndk.fetchEvents(filter)
}

/**
 * Subscribe to live events matching the given filter.
 * Calls callback for each new event received.
 * Returns the NDKSubscription so the caller can stop() it on cleanup.
 */
export function subscribeToEvents(
  filter: NDKFilter,
  callback: (event: NDKEvent) => void
): NDKSubscription {
  if (!_ndk) throw new Error('Nostr service not initialized')

  const sub = _ndk.subscribe(filter, { closeOnEose: false })
  sub.on('event', callback)
  return sub
}

/**
 * Publish a new top-level market discussion post (NIP-22 kind 1111).
 * Tags: ["e", marketEventId, relay, "root"], ["k", "982"], ["p", marketCreatorPubkey], ["stance", stance], ["type", type]
 */
export async function publishMarketPost(
  title: string,
  content: string,
  stance: 'bull' | 'bear' | 'neutral',
  type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
  marketEventId: string,
  marketCreatorPubkey: string,
): Promise<NDKEvent> {
  const fullContent = title ? `${title}\n\n${content}` : content
  const tags: string[][] = [
    ['e', marketEventId, '', 'root'],
    ['k', '982'],
    ['p', marketCreatorPubkey],
    ['stance', stance],
    ['type', type],
    ['subject', title],
  ]
  return publishEvent(fullContent, tags, 1111)
}

/**
 * Publish a reply to an existing market discussion post (NIP-22 kind 1111).
 * Tags: ["e", rootEventId, "", "root"], ["e", parentEventId, "", "reply"], ["k", "1111"], ["p", parentAuthorPubkey]
 */
export async function publishMarketReply(
  content: string,
  parentEventId: string,
  rootEventId: string,
  parentAuthorPubkey: string,
): Promise<NDKEvent> {
  const tags: string[][] = [
    ['e', rootEventId, '', 'root'],
    ['e', parentEventId, '', 'reply'],
    ['k', '1111'],
    ['p', parentAuthorPubkey],
  ]
  return publishEvent(content, tags, 1111)
}

/**
 * Fetch existing posts for a market (kind 1111 events referencing the market's kind 982 event via e-tag).
 */
export async function fetchMarketPosts(
  marketEventId: string,
  limit = 100
): Promise<NDKEvent[]> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  const filter: NDKFilter = { kinds: [1111], '#e': [marketEventId], limit }
  const eventsSet = await _ndk.fetchEvents(filter)
  return Array.from(eventsSet)
}

/**
 * Subscribe to new posts for a market in real-time (kind 1111 events referencing market via e-tag).
 * Returns the NDKSubscription so the caller can stop() it on cleanup.
 */
export function subscribeToMarketPosts(
  marketEventId: string,
  callback: (event: NDKEvent) => void
): NDKSubscription {
  if (!_ndk) throw new Error('Nostr service not initialized')
  const filter: NDKFilter = { kinds: [1111], '#e': [marketEventId] }
  const sub = _ndk.subscribe(filter, { closeOnEose: false })
  sub.on('event', callback)
  return sub
}

/**
 * Parse discussion-relevant tags from a Nostr event.
 */
export function parseEventTags(event: NDKEvent): {
  stance?: 'bull' | 'bear' | 'neutral'
  type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
  replyTo?: string
  rootId?: string
  isRoot?: boolean
} {
  const result: {
    stance?: 'bull' | 'bear' | 'neutral'
    type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    replyTo?: string
    rootId?: string
    isRoot?: boolean
  } = {}

  for (const tag of event.tags) {
    const [name, value] = tag
    if (name === 'stance' && (value === 'bull' || value === 'bear' || value === 'neutral')) {
      result.stance = value
    } else if (
      name === 'type' &&
      (value === 'argument' || value === 'evidence' || value === 'rebuttal' || value === 'analysis')
    ) {
      result.type = value
    } else if (name === 'e') {
      // NIP-10: marker 'reply' or 'root' in tag[3]; fallback: last e-tag = replyTo
      const marker = tag[3]
      if (marker === 'root') {
        result.rootId = value
      } else if (marker === 'reply') {
        result.replyTo = value
      } else {
        // No marker — treat as reply-to (direct parent)
        result.replyTo = value
      }
    }
  }

  // isRoot: true when there is no replyTo and no rootId (i.e. a direct child of the market event)
  result.isRoot = !result.replyTo && !result.rootId

  return result
}

/**
 * Publish a NIP-25 reaction (kind 7) to a specific event.
 * content: "+" for upvote, "-" for downvote
 */
export async function publishReaction(
  eventId: string,
  eventAuthorPubkey: string,
  marketId: string,
  content: '+' | '-',
): Promise<NDKEvent> {
  const tags: string[][] = [
    ['e', eventId],
    ['p', eventAuthorPubkey],
    ['m', marketId],
  ]
  return publishEvent(content, tags, 7)
}

/**
 * Fetch all reactions (kind 7) for a set of event IDs.
 * Returns a map of eventId → { upvotes: number, downvotes: number }
 */
export async function fetchReactions(
  eventIds: string[],
): Promise<Map<string, { upvotes: number; downvotes: number }>> {
  const result = new Map<string, { upvotes: number; downvotes: number }>()
  if (!_ndk || eventIds.length === 0) return result

  const filter: NDKFilter = { kinds: [7], '#e': eventIds }
  const eventsSet = await _ndk.fetchEvents(filter)

  for (const event of eventsSet) {
    const eTag = event.tags.find((t) => t[0] === 'e')
    if (!eTag) continue
    const targetId = eTag[1]
    if (!result.has(targetId)) {
      result.set(targetId, { upvotes: 0, downvotes: 0 })
    }
    const counts = result.get(targetId)!
    if (event.content === '+') counts.upvotes++
    else if (event.content === '-') counts.downvotes++
  }

  return result
}

/**
 * Subscribe to new reactions (kind 7) for a set of event IDs in real-time.
 * Calls callback with (eventId, content) for each new reaction received.
 * Returns the NDKSubscription so the caller can stop() it on cleanup.
 */
export function subscribeToReactions(
  eventIds: string[],
  callback: (eventId: string, content: '+' | '-') => void,
): NDKSubscription {
  if (!_ndk) throw new Error('Nostr service not initialized')
  const filter: NDKFilter = { kinds: [7], '#e': eventIds }
  const sub = _ndk.subscribe(filter, { closeOnEose: false })
  sub.on('event', (event: NDKEvent) => {
    const eTag = event.tags.find((t) => t[0] === 'e')
    if (!eTag) return
    const targetId = eTag[1]
    if (event.content === '+' || event.content === '-') {
      callback(targetId, event.content)
    }
  })
  return sub
}

/**
 * Resolve a pubkey to a display name.
 * Returns npub as fallback if no profile is found.
 */
export async function resolveAuthorName(pubkey: string): Promise<{
  npub: string
  name?: string
}> {
  if (!_ndk) return { npub: pubkey }

  try {
    const user = _ndk.getUser({ pubkey })
    await user.fetchProfile()
    const name = user.profile?.name ?? user.profile?.displayName ?? undefined
    const npub = user.npub ?? pubkey
    return { npub, name }
  } catch {
    return { npub: pubkey }
  }
}

// ---------------------------------------------------------------------------
// Market Transport — kind 982 non-replaceable events
// Markets are immutable once published — no versioning, no JSON, no app-filter tag.
// Domain logic (parsing) lives in marketService.ts.
// ---------------------------------------------------------------------------

/**
 * Publish a kind 982 non-replaceable market event (immutable, final).
 * Content is markdown. Tags include d-tag (slug), title, description, mint, optional category and image.
 * Returns the published NDKEvent — callers should store event.id as the canonical market identifier.
 * Requires active NIP-07 signer (throws in read-only mode).
 */
export async function publishMarket(
  market: Market,
  markdown: string,
  options?: { imageUrl?: string; category?: string },
): Promise<NDKEvent> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  if (!_ndk.signer) throw new Error('No signer available — cannot publish in read-only mode')

  const event = new NDKEvent(_ndk)
  event.kind = 982 as NDKKind
  event.content = markdown

  const tags: string[][] = [
    ['d', market.slug],
    ['title', market.title],
    ['description', market.description],
    ['mint', market.mint],
  ]

  if (options?.category) {
    tags.push(['c', options.category])
  }
  if (options?.imageUrl) {
    tags.push(['image', options.imageUrl])
  }

  event.tags = tags
  await event.publish()
  return event
}

/**
 * Fetch all Cascade markets (kind 982).
 * Returns raw NDKEvents — caller (marketService) is responsible for parsing.
 */
export async function fetchAllMarketsTransport(limit = 50): Promise<Set<NDKEvent>> {
  const filter: NDKFilter = {
    kinds: [982 as NDKKind],
    limit,
  }
  return fetchEvents(filter)
}

/**
 * Fetch a single Cascade market by Nostr event ID.
 * Returns null if no matching market is found.
 */
export async function fetchMarketByEventId(eventId: string): Promise<NDKEvent | null> {
  const filter: NDKFilter = {
    kinds: [982 as NDKKind],
    ids: [eventId],
  }
  const events = await fetchEvents(filter)
  if (events.size === 0) return null
  return Array.from(events)[0]
}

/**
 * Subscribe to real-time updates for a single Cascade market (by event ID).
 * Returns the NDKSubscription so the caller can stop() it on cleanup.
 */
export function subscribeToMarketTransport(
  eventId: string,
  callback: (event: NDKEvent) => void,
): NDKSubscription {
  const filter: NDKFilter = {
    kinds: [982 as NDKKind],
    ids: [eventId],
  }
  return subscribeToEvents(filter, callback)
}

/**
 * Subscribe to all new Cascade market events (kind 982).
 * Useful for LandingPage live discovery — set limit: 0 to get only new events.
 * Returns the NDKSubscription so the caller can stop() it on cleanup.
 */
export function subscribeToAllCascadeMarkets(
  callback: (event: NDKEvent) => void,
): NDKSubscription {
  const filter: NDKFilter = {
    kinds: [982 as NDKKind],
    limit: 0,
  }
  return subscribeToEvents(filter, callback)
}

/**
 * Fetch NIP-09 deletion events for a market (kind 5 with e-tag).
 */
export async function fetchDeletionEvents(eventId: string): Promise<Set<NDKEvent>> {
  const filter: NDKFilter = {
    kinds: [5],
    '#e': [eventId],
  }
  return fetchEvents(filter)
}

// ---------------------------------------------------------------------------
// Payout events — kind 30079 parameterized replaceable events
// One event per (marketId, winnerId) pair; d-tag namespaced under cascade:payout.
// ---------------------------------------------------------------------------

/** Event kind for Cascade payout records. */
export const PAYOUT_EVENT_KIND = 30079

export type PayoutEventParams = {
  marketId: string
  marketTitle: string
  winnerId: string
  positionId: string
  quantity: number
  costBasis: number
  outcomePrice: number
  payoutSats: number
  rakeSats: number
  netSats: number
  outcome: 'YES' | 'NO'
  resolvedAt: number
  createdAt: number
}

/**
 * Publish a kind 30079 payout record to Nostr.
 *
 * d-tag: `cascade:payout:<marketId>:<winnerId>:<timestamp>`
 *
 * All numeric fields are stored as string tags so they survive relay
 * round-trips without precision loss.
 */
export async function publishPayoutEvent(params: PayoutEventParams): Promise<NDKEvent> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  if (!_ndk.signer) throw new Error('No signer available — cannot publish in read-only mode')

  const dTag = `cascade:payout:${params.marketId}:${params.winnerId}:${params.createdAt}`

  const tags: string[][] = [
    ['d', dTag],
    ['c', 'cascade'],
    ['market', params.marketId],
    ['market-title', params.marketTitle],
    ['winner', params.winnerId],
    ['position', params.positionId],
    ['quantity', String(params.quantity)],
    ['cost-basis', String(params.costBasis)],
    ['outcome-price', String(params.outcomePrice)],
    ['payout-sats', String(params.payoutSats)],
    ['rake-sats', String(params.rakeSats)],
    ['net-sats', String(params.netSats)],
    ['outcome', params.outcome],
    ['resolved-at', String(params.resolvedAt)],
  ]

  const event = new NDKEvent(_ndk)
  event.kind = PAYOUT_EVENT_KIND
  event.content = JSON.stringify({
    marketTitle: params.marketTitle,
    outcome: params.outcome,
    payoutSats: params.payoutSats,
    rakeSats: params.rakeSats,
    netSats: params.netSats,
  })
  event.tags = tags

  await event.publish()
  return event
}

/**
 * Fetch payout events (kind 30079) for a specific winner pubkey.
 */
export async function fetchPayoutEvents(winnerId: string): Promise<NDKEvent[]> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  const filter: NDKFilter = {
    kinds: [PAYOUT_EVENT_KIND as NDKKind],
    '#winner': [winnerId],
    '#c': ['cascade'],
  }
  const eventsSet = await _ndk.fetchEvents(filter)
  return Array.from(eventsSet)
}

/**
 * Fetch kind 0 (metadata) event for a given pubkey.
 * Returns the metadata object or null if not found.
 */
export async function fetchKind0Metadata(
  ndk: NDK,
  pubkey: string
): Promise<{ name: string; about: string; picture: string; banner: string; website: string; nip05: string } | null> {
  try {
    const event = await ndk.fetchEvent({
      kinds: [0],
      authors: [pubkey],
    })

    if (!event) {
      return null
    }

    // Parse kind 0 content as JSON
    try {
      const metadata = JSON.parse(event.content)
      return {
        name: metadata.name || '',
        about: metadata.about || '',
        picture: metadata.picture || '',
        banner: metadata.banner || '',
        website: metadata.website || '',
        nip05: metadata.nip05 || '',
      }
    } catch {
      // Malformed JSON in kind 0 — return null
      return null
    }
  } catch (error) {
    console.error(`Error fetching kind 0 for ${pubkey}:`, error)
    return null
  }
}
