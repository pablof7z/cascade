import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { MarketEntry } from './storage'
import { useBookmarks } from './useBookmarks'


type LeaderboardTab = 'Top Predictors' | 'Top Creators' | 'Most Accurate' | 'Most Bookmarked'

interface BookmarkedEntry {
  rank: number
  marketId: string
  displayName: string
  descriptor: string
  bookmarks: number
  yesPercent: number
}

const leaderboardTabs: LeaderboardTab[] = ['Top Predictors', 'Top Creators', 'Most Accurate', 'Most Bookmarked']

interface LeaderboardProps {
  markets?: Record<string, MarketEntry>
}

export default function Leaderboard({ markets = {} }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('Top Predictors')

  const marketIds = useMemo(() => Object.keys(markets), [markets])
  const { getTopBookmarked } = useBookmarks(marketIds)

  const bookmarkedEntries = useMemo((): BookmarkedEntry[] => {
    if (activeTab !== 'Most Bookmarked') return []
    return getTopBookmarked(10).map((item, i) => {
      const market = markets[item.marketId]?.market
      return {
        rank: i + 1,
        marketId: item.marketId,
        displayName: market?.title ?? item.marketId.slice(0, 12) + '…',
        descriptor: market?.description?.slice(0, 60) || 'Prediction market',
        bookmarks: item.count,
        yesPercent: market ? Math.round((market.qLong / (market.qLong + market.qShort)) * 100) : 0,
      }
    })
  }, [activeTab, getTopBookmarked, markets])

  const emptyStateText: Record<Exclude<LeaderboardTab, 'Most Bookmarked'>, { sub: string }> = {
    'Top Predictors': { sub: 'Rankings will appear when traders have positions.' },
    'Top Creators': { sub: 'Rankings will appear when markets have trading volume.' },
    'Most Accurate': { sub: 'Rankings will appear when markets have resolved.' },
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
        <p className="text-neutral-400 mt-1">Top performers on Cascade</p>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-neutral-800 mb-6">
        {leaderboardTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab
                ? '-mb-px border-b-2 border-white text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {/* Empty states for mock tabs */}
      {activeTab !== 'Most Bookmarked' && (
        <div className="py-16 text-center">
          <p className="text-neutral-400 text-sm">No trading data yet.</p>
          <p className="text-neutral-600 text-xs mt-1">{emptyStateText[activeTab].sub}</p>
        </div>
      )}

      {/* Most Bookmarked tab */}
      {activeTab === 'Most Bookmarked' && (
        <>
          {bookmarkedEntries.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-neutral-400 text-sm">No bookmarked markets yet.</p>
              <p className="text-neutral-600 text-xs mt-1">Bookmark markets to see them ranked here.</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-800">
              {bookmarkedEntries.map((entry) => {
                const content = (
                  <>
                    <span className="text-sm font-mono text-neutral-500 w-6 shrink-0">{entry.rank}</span>
                    <div className="flex-1 min-w-0">
                      <span className="block text-white font-medium truncate">{entry.displayName}</span>
                      <span className="text-xs text-neutral-500 truncate block">{entry.descriptor}</span>
                    </div>
                    <div className="flex gap-6 shrink-0">
                      <div className="text-right">
                        <span className="block text-white font-mono font-medium">{entry.bookmarks}</span>
                        <span className="text-xs text-neutral-500">Bookmarks</span>
                      </div>
                      <div className="text-right">
                        <span className="block text-white font-mono font-medium">{entry.yesPercent}%</span>
                        <span className="text-xs text-neutral-500">Yes %</span>
                      </div>
                    </div>
                  </>
                )

                return (
                  <Link
                    key={entry.marketId}
                    to={`/market/${entry.marketId}`}
                    className="flex items-center gap-4 py-4 hover:bg-neutral-900 transition-colors"
                  >
                    {content}
                  </Link>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
