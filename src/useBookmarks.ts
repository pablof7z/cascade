import { useState, useCallback, useEffect } from 'react'
import {
  loadBookmarks,
  addBookmark,
  removeBookmark,
  initializeSampleCounts,
  type BookmarkData,
} from './bookmarkStore'

/**
 * React hook for managing bookmarks with reactive state updates.
 */
export function useBookmarks(marketIds?: string[]) {
  const [data, setData] = useState<BookmarkData>(loadBookmarks)

  // Initialize sample counts for demo when marketIds are provided
  useEffect(() => {
    if (marketIds && marketIds.length > 0) {
      initializeSampleCounts(marketIds)
      setData(loadBookmarks())
    }
  }, [marketIds?.join(',')])

  const toggle = useCallback((marketId: string) => {
    const isCurrentlyBookmarked = data.marketIds.includes(marketId)
    const newData = isCurrentlyBookmarked
      ? removeBookmark(marketId)
      : addBookmark(marketId)
    setData(newData)
  }, [data.marketIds])

  const isBookmarked = useCallback((marketId: string) => {
    return data.marketIds.includes(marketId)
  }, [data.marketIds])

  const getCount = useCallback((marketId: string) => {
    return data.counts[marketId] || 0
  }, [data.counts])

  // Get markets sorted by bookmark count (descending)
  const getTopBookmarked = useCallback((limit?: number) => {
    const sorted = Object.entries(data.counts)
      .sort(([, a], [, b]) => b - a)
      .map(([id, count]) => ({ marketId: id, count }))
    return limit ? sorted.slice(0, limit) : sorted
  }, [data.counts])

  return {
    bookmarkedIds: data.marketIds,
    toggle,
    isBookmarked,
    getCount,
    getTopBookmarked,
    refresh: () => setData(loadBookmarks()),
  }
}
