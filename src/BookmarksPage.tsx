import { Link } from 'react-router-dom'
import { useBookmarks } from './useBookmarks'
import BookmarkButton from './components/BookmarkButton'

/**
 * My Bookmarks page - displays all markets the user has bookmarked.
 */
export default function BookmarksPage() {
  const { bookmarkedIds, toggle, getCount } = useBookmarks()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Bookmarks</h1>
        <p className="text-neutral-400 mt-1">
          Markets you've saved for later
        </p>
      </div>

      {bookmarkedIds.length === 0 ? (
        <div className="text-center py-16 border-b border-neutral-800/40">
          <svg
            className="w-12 h-12 mx-auto text-neutral-600 mb-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          <h2 className="text-lg font-medium text-white mb-2">No bookmarks yet</h2>
          <p className="text-neutral-500 mb-6 max-w-sm mx-auto">
            Bookmark markets you want to track. Click the bookmark icon on any market card.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-white text-neutral-950 font-medium rounded-lg hover:bg-neutral-100 transition-colors"
          >
            Browse Markets
          </Link>
        </div>
      ) : (
        <div>
          {bookmarkedIds.map((marketId) => (
            <div
              key={marketId}
              className="flex items-center justify-between py-3 px-1 border-b border-neutral-800/40 hover:bg-neutral-900/30 transition-colors"
            >
              <Link
                to={`/market/${marketId}`}
                className="flex-1 min-w-0 text-white font-medium hover:text-neutral-300 transition-colors truncate"
              >
                {marketId}
              </Link>
              <div className="flex items-center gap-3 ml-4">
                <span className="text-xs text-neutral-500">
                  {getCount(marketId)} bookmarks
                </span>
                <BookmarkButton
                  isBookmarked={true}
                  count={getCount(marketId)}
                  onToggle={() => toggle(marketId)}
                  showCount={false}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
