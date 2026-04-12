import { describe, it, expect } from 'vitest'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import {
  serializeBookmarksToEvent,
  parseBookmarkEvent,
  extractMarketEventIds,
} from '../services/bookmarkService'

describe('bookmarkService', () => {
  // -------------------------------------------------------------------------
  // Serialization Tests
  // -------------------------------------------------------------------------

  describe('serializeBookmarksToEvent', () => {
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

    it('serializes single bookmark', () => {
      const { content, tags } = serializeBookmarksToEvent(['single-event-id'])
      expect(content).toBe('')
      expect(tags).toEqual([['e', 'single-event-id']])
    })

    it('content is always empty per NIP-33 spec', () => {
      const { content } = serializeBookmarksToEvent([
        'event1',
        'event2',
        'event3',
      ])
      expect(content).toBe('')
    })
  })

  // -------------------------------------------------------------------------
  // Deserialization Tests
  // -------------------------------------------------------------------------

  describe('parseBookmarkEvent', () => {
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

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.list.entries).toEqual([
          { marketEventId: 'market1' },
          { marketEventId: 'market2' },
        ])
        expect(result.list.pubkey).toBe('npub123')
        expect(result.list.eventId).toBe('event-id')
        expect(result.list.createdAt).toBe(1000000)
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

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toBe('invalid_kind')
        expect(result.error).toContain('Expected kind 10003, got 30001')
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

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
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

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
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

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.list.entries).toEqual([{ marketEventId: 'market1' }])
      }
    })

    it('handles empty e tags', () => {
      const event = {
        kind: 10003,
        pubkey: 'npub123',
        id: 'event-id',
        created_at: 1000000,
        getMatchingTags: () => [],
      }

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.list.entries).toEqual([])
      }
    })

    it('handles event with undefined created_at', () => {
      const event = {
        kind: 10003,
        pubkey: 'npub123',
        id: 'event-id',
        created_at: undefined,
        getMatchingTags: (tag: string) =>
          tag === 'e' ? [['e', 'market1']] : [],
      }

      const result = parseBookmarkEvent(event as unknown as NDKEvent)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.list.createdAt).toBeGreaterThan(0)
      }
    })
  })

  // -------------------------------------------------------------------------
  // Extraction Tests
  // -------------------------------------------------------------------------

  describe('extractMarketEventIds', () => {
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

    it('extracts single market event ID', () => {
      const list = {
        eventId: 'event-id',
        pubkey: 'npub123',
        createdAt: 1000000,
        entries: [{ marketEventId: 'only-market' }],
      }

      const ids = extractMarketEventIds(list)
      expect(ids).toEqual(['only-market'])
    })
  })
})
