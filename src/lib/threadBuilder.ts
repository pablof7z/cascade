import type { NDKEvent } from '@nostr-dev-kit/ndk'
import type { DiscussionThread, Reply } from '../DiscussPage'
import { parseEventTags, resolveAuthorName } from '../services/nostrService'

/**
 * Extract a title from post content.
 * Uses the first line if ≤80 chars, otherwise truncates with ellipsis.
 */
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0]
  if (firstLine.length <= 80) return firstLine
  return firstLine.slice(0, 80) + '...'
}

/**
 * Build the reply chain for a given parent event ID.
 * Synchronous — uses pubkey prefix as author name (no async profile fetch for replies).
 */
function buildReplies(
  parentEventId: string,
  allEvents: Map<string, NDKEvent>,
): Reply[] {
  const replies: Reply[] = []

  for (const [eventId, event] of allEvents) {
    const tags = parseEventTags(event)
    if (tags.replyTo === parentEventId || tags.rootId === parentEventId) {
      replies.push({
        id: eventId,
        author: event.pubkey.slice(0, 16),
        pubkey: event.pubkey,
        isAgent: false,
        content: event.content,
        timestamp: (event.created_at ?? 0) * 1000,
        upvotes: 0,
        downvotes: 0,
        replies: buildReplies(eventId, allEvents),
      })
    }
  }

  return replies
}

/**
 * Convert a single root Nostr event into a DiscussionThread.
 */
export async function convertEventToThread(
  event: NDKEvent,
  allEvents: Map<string, NDKEvent>,
): Promise<DiscussionThread> {
  const tags = parseEventTags(event)
  const author = await resolveAuthorName(event.pubkey)
  const id = event.id ?? ''

  return {
    id,
    author: author.name ?? author.npub.slice(0, 16),
    pubkey: event.pubkey,
    isAgent: false,
    type: (tags.type ?? 'argument') as DiscussionThread['type'],
    stance: (tags.stance ?? 'neutral') as DiscussionThread['stance'],
    title: extractTitle(event.content),
    content: event.content,
    timestamp: (event.created_at ?? 0) * 1000,
    upvotes: 0,
    downvotes: 0,
    replies: buildReplies(id, allEvents),
  }
}

/**
 * Convert a single event to a DiscussionThread without reply context.
 * Used when a new live event arrives and we don't yet have all events for context.
 */
export async function convertSingleEventToThread(
  event: NDKEvent,
): Promise<DiscussionThread> {
  return convertEventToThread(event, new Map())
}

/**
 * Build the full thread hierarchy from a flat list of events.
 * Root events are direct replies to the market event (rootId === marketEventId, no replyTo).
 */
export async function buildThreadHierarchy(
  rawEvents: NDKEvent[],
  marketEventId: string,
): Promise<DiscussionThread[]> {
  const allEventsMap = new Map(rawEvents.map((e) => [e.id ?? '', e]))

  const rootEvents = rawEvents.filter((event) => {
    const tags = parseEventTags(event)
    // A post is a root of the market thread if its rootId IS the market event
    return tags.rootId === marketEventId || tags.isRoot
  })

  return Promise.all(
    rootEvents.map((event) => convertEventToThread(event, allEventsMap)),
  )
}
