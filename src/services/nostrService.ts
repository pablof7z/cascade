/**
 * Nostr Service — Pure Module (no React hooks)
 *
 * Handles NDK initialization and core Nostr operations.
 * Relay URLs are injected by NostrContextProvider at startup.
 *
 * Event structure for market discussion posts:
 *   kind: 1 (text note)
 *   tags: [["m", "market-uuid"], ["market", "market-uuid"]]
 *   content: "Post text"
 *
 * The "m" tag is the queryable market identifier (NDK filter: {'#m': [marketId]}).
 * The "market" tag is additional metadata for filtering/organization.
 *
 * Reactions (NIP-25) use kind 7 events:
 *   tags: [["e", eventId], ["p", authorPubkey], ["m", marketId]]
 *   content: "+"
 */

import NDK, {
  NDKEvent,
  NDKNip07Signer,
  type NDKFilter,
  type NDKSubscription,
} from '@nostr-dev-kit/ndk'

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
 * Publish a new top-level market discussion post.
 * Tags: ["m", marketId], ["stance", stance], ["type", type]
 */
export async function publishMarketPost(
  marketId: string,
  title: string,
  content: string,
  stance: 'bull' | 'bear' | 'neutral',
  type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
): Promise<NDKEvent> {
  const fullContent = title ? `${title}\n\n${content}` : content
  const tags: string[][] = [
    ['m', marketId],
    ['stance', stance],
    ['type', type],
    ['subject', title],
  ]
  return publishEvent(fullContent, tags, 1)
}

/**
 * Publish a reply to an existing market discussion post.
 * Tags: ["m", marketId], ["e", rootId, "", "root"], ["e", parentId, "", "reply"], ["p", parentAuthorPubkey]
 */
export async function publishMarketReply(
  marketId: string,
  content: string,
  parentEventId: string,
  rootEventId: string,
  parentAuthorPubkey: string,
): Promise<NDKEvent> {
  const tags: string[][] = [
    ['m', marketId],
    ['e', rootEventId, '', 'root'],
    ['e', parentEventId, '', 'reply'],
    ['p', parentAuthorPubkey],
  ]
  return publishEvent(content, tags, 1)
}

/**
 * Fetch existing posts for a market (kind 1 events with matching #m tag).
 */
export async function fetchMarketPosts(
  marketId: string,
  limit = 100
): Promise<NDKEvent[]> {
  if (!_ndk) throw new Error('Nostr service not initialized')
  const filter: NDKFilter = { kinds: [1], '#m': [marketId], limit }
  const eventsSet = await _ndk.fetchEvents(filter)
  return Array.from(eventsSet)
}

/**
 * Subscribe to new posts for a market in real-time.
 * Returns the NDKSubscription so the caller can stop() it on cleanup.
 */
export function subscribeToMarketPosts(
  marketId: string,
  callback: (event: NDKEvent) => void
): NDKSubscription {
  if (!_ndk) throw new Error('Nostr service not initialized')
  const filter: NDKFilter = { kinds: [1], '#m': [marketId] }
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
} {
  const result: {
    stance?: 'bull' | 'bear' | 'neutral'
    type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    replyTo?: string
    rootId?: string
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
