import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { fetchAllMarketsTransport } from './services/nostrService'
import { parseMarketEvent } from './services/marketService'

type ActivityFilter = 'All' | 'Trades' | 'New Markets' | 'Resolutions'

interface ActivityItem {
  id: string
  timestamp: number
  actor: string
  action: string
  marketId: string
  marketName: string
  marketType: string
}

const filters: ActivityFilter[] = ['All', 'New Markets', 'Trades', 'Resolutions']

function formatTimestamp(ts: number): string {
  const now = Date.now()
  const diff = now - ts * 1000
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return 'just now'
  if (diff < hour) return `${Math.floor(diff / minute)}m ago`
  if (diff < day) return `${Math.floor(diff / hour)}h ago`
  return `${Math.floor(diff / day)}d ago`
}

function abbreviatePubkey(pubkey: string): string {
  if (pubkey.length <= 12) return pubkey
  return `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`
}

export default function Activity() {
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const events = await fetchAllMarketsTransport(50)
        if (cancelled) return

        const activityItems: ActivityItem[] = []
        for (const event of events) {
          const result = parseMarketEvent(event)
          if (!result.ok) continue
          const market = result.market
          if (market.status === 'archived') continue

          activityItems.push({
            id: market.id,
            timestamp: event.created_at ?? market.createdAt ?? 0,
            actor: abbreviatePubkey(event.pubkey ?? market.creatorPubkey ?? ''),
            action: `created ${market.kind ?? 'market'}`,
            marketId: market.id,
            marketName: market.title,
            marketType: market.kind ?? 'module',
          })
        }

        activityItems.sort((a, b) => b.timestamp - a.timestamp)
        setItems(activityItems)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load activity')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  const showEmptyState = activeFilter === 'Trades' || activeFilter === 'Resolutions'
  const emptyStateMessage =
    activeFilter === 'Trades' ? 'No trade activity yet' : 'No resolutions yet'

  const filteredItems =
    showEmptyState || loading || error ? [] : items

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Activity</h1>
        <p className="text-neutral-400 mt-1">Recent activity across all markets</p>
      </div>

      {/* Filter tabs */}
      <nav className="flex gap-1 border-b border-neutral-800 mb-6">
        {filters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`px-4 py-3 text-sm font-medium transition-colors ${
              activeFilter === filter
                ? '-mb-px border-b-2 border-white text-white'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
            onClick={() => setActiveFilter(filter)}
          >
            {filter}
          </button>
        ))}
      </nav>

      {/* Activity feed */}
      {loading && (
        <p className="text-neutral-500 text-sm py-8 text-center">Loading activity…</p>
      )}

      {!loading && error && (
        <p className="text-neutral-500 text-sm py-8 text-center">{error}</p>
      )}

      {!loading && !error && showEmptyState && (
        <p className="text-neutral-500 text-sm py-8 text-center">{emptyStateMessage}</p>
      )}

      {!loading && !error && !showEmptyState && filteredItems.length === 0 && (
        <p className="text-neutral-500 text-sm py-8 text-center">No activity found</p>
      )}

      {!loading && !error && !showEmptyState && filteredItems.length > 0 && (
        <div className="divide-y divide-neutral-800">
          {filteredItems.map((item) => (
            <div key={item.id} className="flex items-start gap-4 py-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-white text-sm font-medium">{item.actor}</span>
                  <span className="text-xs text-neutral-500">{formatTimestamp(item.timestamp)}</span>
                </div>
                <div className="text-neutral-300 text-sm mb-1">{item.action}</div>
                <Link
                  to={`/market/${item.marketId}`}
                  className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                >
                  {item.marketName}
                </Link>
              </div>
              <span className="text-xs text-neutral-600 uppercase tracking-wide shrink-0">
                {item.marketType}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
