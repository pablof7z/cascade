import { useEffect, useState, useCallback } from 'react'
import {
  getBookmarks,
  isBookmarked as checkIsBookmarked,
  addBookmark,
  removeBookmark,
  refreshBookmarks,
  onBookmarksChanged,
  initializeBookmarks,
} from './bookmarkStore'
import { useNostr } from './context/NostrContext'

/**
 * Bookmark ID semantics: Bookmarks currently store market slugs (e.g. "bitcoin-2025")
 * as the identifier, NOT 64-char hex eventIds. This works because the app's routing
 * and market lookups use slugs as keys. If real eventIds are ever stored in bookmarks
 * (e.g. from relay-sourced data), BookmarksPage must resolve them back to slugs before
 * rendering or routing — the current slug-based lookups will break with eventIds.
 */

export function useBookmarks(_marketIds?: string[]) {
  const { pubkey, ndkInstance: ndk } = useNostr()
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([])

  // Initialize on mount or when pubkey changes
  useEffect(() => {
    initializeBookmarks(pubkey, ndk)
  }, [pubkey, ndk])

  // Listen to bookmark changes
  useEffect(() => {
    const unsubscribe = onBookmarksChanged(() => {
      setBookmarkedIds(getBookmarks())
    })
    // Initial sync
    setBookmarkedIds(getBookmarks())
    return unsubscribe
  }, [])

  const toggle = useCallback(
    (marketId: string) => {
      if (checkIsBookmarked(marketId)) {
        removeBookmark(marketId, pubkey, ndk)
      } else {
        addBookmark(marketId, pubkey, ndk)
      }
    },
    [pubkey, ndk],
  )

  const getCount = useCallback(
    (marketId: string) => {
      // For now, return bookmark count (1 if bookmarked, 0 otherwise)
      // In future, this could aggregate global counts from Nostr relay
      return checkIsBookmarked(marketId) ? 1 : 0
    },
    [],
  )

  const getTopBookmarked = useCallback(
    (limit?: number) => {
      // Return bookmarked IDs as { marketId, count } objects
      // Shallow copy to avoid mutation
      const items = bookmarkedIds.map((id) => ({ marketId: id, count: 1 }))
      return limit ? items.slice(0, limit) : items
    },
    [bookmarkedIds],
  )

  return {
    bookmarkedIds,
    toggle,
    isBookmarked: (id: string) => checkIsBookmarked(id),
    getCount,
    getTopBookmarked,
    refresh: () => refreshBookmarks(pubkey, ndk),
  }
}
