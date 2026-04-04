import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  initializeBookmarks,
  addBookmark,
  removeBookmark,
  getBookmarks,
  isBookmarked,
  getBookmarkCount,
  refreshBookmarks,
  onBookmarksChanged,
  clearCache,
} from '../bookmarkStore'

// Mock NDK and nostrService
vi.mock('../services/nostrService', () => ({
  publishEvent: vi.fn(),
}))

vi.mock('../services/bookmarkService', () => ({
  parseBookmarkEvent: vi.fn(),
  serializeBookmarksToEvent: vi.fn(),
  extractMarketEventIds: vi.fn(),
}))

describe('bookmarkStore', () => {
  beforeEach(() => {
    // Clear localStorage
    localStorage.clear()
    vi.clearAllMocks()
    // Clear cache
    clearCache()
  })

  afterEach(() => {
    localStorage.clear()
    clearCache()
  })

  // --------- Initialization Tests ---------

  describe('initializeBookmarks', () => {
    it('initializes to empty for anonymous user with no data', async () => {
      await initializeBookmarks(null, null)
      expect(getBookmarks()).toEqual([])
    })

    it('initializes with legacy data when no Nostr event exists', async () => {
      // Pre-populate legacy storage (using new key format)
      localStorage.setItem(
        'cascade-bookmarks-legacy-anon',
        JSON.stringify({
          marketIds: ['event1', 'event2'],
          counts: {},
        }),
      )

      const mockNdk = { fetchEvents: vi.fn().mockResolvedValue(new Set()) }
      await initializeBookmarks(null, mockNdk as any)

      expect(getBookmarks()).toEqual(['event1', 'event2'])
    })

    it('initializes with legacy data for authenticated user when no Nostr event', async () => {
      // Pre-populate legacy storage for authenticated user (using new key format)
      localStorage.setItem(
        'cascade-bookmarks-legacy-pubkey123',
        JSON.stringify({
          marketIds: ['legacy-event1'],
          counts: {},
        }),
      )

      const mockNdk = { fetchEvents: vi.fn().mockResolvedValue(new Set()) }
      await initializeBookmarks('pubkey123', mockNdk as any)

      expect(getBookmarks()).toEqual(['legacy-event1'])
    })
  })

  // --------- Add/Remove Bookmark Tests ---------

  describe('addBookmark', () => {
    it('adds bookmark to cache for anonymous user', () => {
      addBookmark('event1', null, null)
      expect(getBookmarks()).toContain('event1')
      expect(isBookmarked('event1')).toBe(true)
    })

    it('does not add duplicate bookmarks', () => {
      addBookmark('event1', null, null)
      addBookmark('event1', null, null)
      expect(getBookmarks().filter((id) => id === 'event1')).toHaveLength(1)
    })
  })

  describe('removeBookmark', () => {
    it('removes bookmark from cache', () => {
      addBookmark('event1', null, null)
      removeBookmark('event1', null, null)
      expect(getBookmarks()).not.toContain('event1')
      expect(isBookmarked('event1')).toBe(false)
    })
  })

  // --------- Observer Pattern Tests ---------

  describe('onBookmarksChanged', () => {
    it('calls observer listeners when bookmarks change', () => {
      const listener = vi.fn()
      const unsubscribe = onBookmarksChanged(listener)

      addBookmark('event1', null, null)
      expect(listener).toHaveBeenCalled()

      unsubscribe()
      listener.mockClear()
      addBookmark('event2', null, null)
      expect(listener).not.toHaveBeenCalled()
    })

    it('returns unsubscribe function', () => {
      const listener = vi.fn()
      const unsubscribe = onBookmarksChanged(listener)

      expect(typeof unsubscribe).toBe('function')

      unsubscribe()
      addBookmark('event1', null, null)
      expect(listener).not.toHaveBeenCalled()
    })
  })

  // --------- Count Tests ---------

  describe('getBookmarkCount', () => {
    it('returns correct bookmark count', () => {
      addBookmark('event1', null, null)
      addBookmark('event2', null, null)
      expect(getBookmarkCount()).toBe(2)
    })

    it('returns 0 when no bookmarks', () => {
      expect(getBookmarkCount()).toBe(0)
    })
  })

  // --------- Refresh Tests ---------

  describe('refreshBookmarks', () => {
    it('does nothing on refresh for anonymous user', async () => {
      addBookmark('event1', null, null)
      await refreshBookmarks(null, null)
      expect(getBookmarks()).toEqual(['event1']) // Unchanged
    })

    it('does nothing on refresh when ndk is null', async () => {
      addBookmark('event1', null, null)
      await refreshBookmarks('pubkey123', null)
      expect(getBookmarks()).toEqual(['event1']) // Unchanged
    })
  })

  // --------- Edge Cases ---------

  describe('edge cases', () => {
    it('handles malformed legacy storage', async () => {
      localStorage.setItem('cascade-bookmarks-legacy-anon', 'invalid json')

      const mockNdk = { fetchEvents: vi.fn().mockResolvedValue(new Set()) }
      await initializeBookmarks(null, mockNdk as any)

      // Should not throw and should fall back to empty
      expect(getBookmarks()).toEqual([])
    })

    it('handles Nostr fetch error gracefully', async () => {
      localStorage.setItem(
        'cascade-bookmarks-legacy-anon',
        JSON.stringify({
          marketIds: ['legacy1'],
          counts: {},
        }),
      )

      const mockNdk = {
        fetchEvents: vi.fn().mockRejectedValue(new Error('Network error')),
      }

      // Should not throw; falls back to legacy
      await expect(
        initializeBookmarks(null, mockNdk as any),
      ).resolves.not.toThrow()
      expect(getBookmarks()).toEqual(['legacy1'])
    })

    it('clearCache resets state', () => {
      addBookmark('event1', null, null)
      clearCache()
      expect(getBookmarks()).toEqual([])
      expect(getBookmarkCount()).toBe(0)
    })
  })
})
