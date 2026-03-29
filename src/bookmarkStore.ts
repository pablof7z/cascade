/**
 * Bookmark storage using localStorage with future Nostr kind 30001 compatibility.
 * Stores market IDs that the user has bookmarked.
 */

const STORAGE_KEY = 'cascade-bookmarks'

export type BookmarkData = {
  marketIds: string[]
  // Track aggregate bookmark counts (would come from relay in production)
  counts: Record<string, number>
}

function getDefaultData(): BookmarkData {
  return { marketIds: [], counts: {} }
}

export function loadBookmarks(): BookmarkData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return getDefaultData()
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return getDefaultData()
    return {
      marketIds: Array.isArray(parsed.marketIds) ? parsed.marketIds : [],
      counts: parsed.counts && typeof parsed.counts === 'object' ? parsed.counts : {},
    }
  } catch {
    return getDefaultData()
  }
}

export function saveBookmarks(data: BookmarkData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // quota exceeded — silently ignore
  }
}

export function addBookmark(marketId: string): BookmarkData {
  const data = loadBookmarks()
  if (!data.marketIds.includes(marketId)) {
    data.marketIds.push(marketId)
    // Simulate incrementing global count
    data.counts[marketId] = (data.counts[marketId] || 0) + 1
  }
  saveBookmarks(data)
  return data
}

export function removeBookmark(marketId: string): BookmarkData {
  const data = loadBookmarks()
  data.marketIds = data.marketIds.filter(id => id !== marketId)
  // Note: In production with Nostr, count would be aggregate from all users
  // Here we just decrement to simulate, but floor at 0
  if (data.counts[marketId]) {
    data.counts[marketId] = Math.max(0, data.counts[marketId] - 1)
  }
  saveBookmarks(data)
  return data
}

export function isBookmarked(marketId: string): boolean {
  const data = loadBookmarks()
  return data.marketIds.includes(marketId)
}

export function getBookmarkCount(marketId: string): number {
  const data = loadBookmarks()
  return data.counts[marketId] || 0
}

// Initialize with some sample counts for demo purposes
export function initializeSampleCounts(marketIds: string[]): void {
  const data = loadBookmarks()
  let hasNewCounts = false
  
  for (const id of marketIds) {
    if (data.counts[id] === undefined) {
      // Random count between 5-50 for demo
      data.counts[id] = Math.floor(Math.random() * 45) + 5
      hasNewCounts = true
    }
  }
  
  if (hasNewCounts) {
    saveBookmarks(data)
  }
}
