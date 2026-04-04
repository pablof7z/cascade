import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { fetchAllMarketsTransport, getNDK, fetchAllPayoutEvents } from './services/nostrService'
import { fetchAllPositions } from './services/positionService'
import { parseMarketEvent } from './services/marketService'

type ActivityFilter = 'All' | 'New Markets' | 'Trades' | 'Resolutions'

interface ActivityItem {
  id: string
  timestamp: number
  actor: string
  action: string
  marketId: string
  marketName: string
  marketType: string
}

interface TradeItem {
  id: string
  marketId: string
  marketTitle: string
  direction: 'yes' | 'no'
  traderPubkey: string
  traderName: string
  timestamp: number
}

interface ResolutionItem {
  id: string
  marketId: string
  marketTitle: string
  outcome: 'YES' | 'NO'
  winnerPubkey: string
  winnerName: string
  netSats: number
  timestamp: number
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

// Cache for pubkey -> name lookups
const nameCache = new Map<string, string>()

export default function Activity() {
  const [activeFilter, setActiveFilter] = useState<ActivityFilter>('All')
  const [items, setItems] = useState<ActivityItem[]>([])
  const [trades, setTrades] = useState<TradeItem[]>([])
  const [resolutions, setResolutions] = useState<ResolutionItem[]>([])
  const [marketsMap, setMarketsMap] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch user name from kind 0 event
  const getUserName = useCallback(async (pubkey: string): Promise<string> => {
    if (nameCache.has(pubkey)) {
      return nameCache.get(pubkey)!
    }

    const ndk = getNDK()
    if (!ndk) return abbreviatePubkey(pubkey)

    try {
      const { fetchKind0Metadata } = await import('./services/nostrService')
      const metadata = await fetchKind0Metadata(ndk, pubkey)
      const name = metadata?.name || abbreviatePubkey(pubkey)
      nameCache.set(pubkey, name)
      return name
    } catch {
      return abbreviatePubkey(pubkey)
    }
  }, [])

  // Fetch markets map for title lookups
  useEffect(() => {
    let cancelled = false

    async function loadMarkets() {
      const ndk = getNDK()
      if (!ndk) return

      try {
        const events = await fetchAllMarketsTransport(500)
        if (cancelled) return

        const map = new Map<string, string>()
        for (const event of events) {
          const result = parseMarketEvent(event)
          if (result.ok && result.market) {
            map.set(result.market.slug, result.market.title)
          }
        }
        if (!cancelled) {
          setMarketsMap(map)
        }
      } catch (err) {
        console.warn('[Activity] Failed to load markets for title lookups:', err)
      }
    }

    loadMarkets()
    return () => {
      cancelled = true
    }
  }, [])

  // Load new markets activity
  useEffect(() => {
    let cancelled = false

    async function loadNewMarkets() {
      const ndk = getNDK()
      if (!ndk) return

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
            id: market.slug,
            timestamp: event.created_at ?? market.createdAt ?? 0,
            actor: abbreviatePubkey(event.pubkey ?? market.creatorPubkey ?? ''),
            action: `created ${market.kind ?? 'market'}`,
            marketId: market.slug,
            marketName: market.title,
            marketType: market.kind ?? 'module',
          })
        }

        activityItems.sort((a, b) => b.timestamp - a.timestamp)
        if (!cancelled) setItems(activityItems)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load activity')
        }
      }
    }

    loadNewMarkets()
    return () => {
      cancelled = true
    }
  }, [])

  // Load trades activity
  useEffect(() => {
    let cancelled = false

    async function loadTrades() {
      const ndk = getNDK()
      if (!ndk) return

      try {
        const positions = await fetchAllPositions(ndk)
        if (cancelled) return

        const tradeItems: TradeItem[] = []
        for (const position of positions) {
          const marketTitle = marketsMap.get(position.marketId) || position.marketId
          const ownerPubkey = position.ownerPubkey || ''

          tradeItems.push({
            id: `${position.marketId}-${position.direction}-${position.timestamp}`,
            marketId: position.marketId,
            marketTitle,
            direction: position.direction,
            traderPubkey: ownerPubkey,
            traderName: await getUserName(ownerPubkey),
            timestamp: position.timestamp,
          })
        }

        if (!cancelled) {
          setTrades(tradeItems.sort((a, b) => b.timestamp - a.timestamp))
        }
      } catch (err) {
        console.warn('[Activity] Failed to load trades:', err)
      }
    }

    loadTrades()
    return () => {
      cancelled = true
    }
  }, [marketsMap, getUserName])

  // Load resolutions activity
  useEffect(() => {
    let cancelled = false

    async function loadResolutions() {
      const ndk = getNDK()
      if (!ndk) return

      try {
        const events = await fetchAllPayoutEvents()
        if (cancelled) return

        const resolutionItems: ResolutionItem[] = []
        for (const event of events) {
          const marketTag = event.getMatchingTags('market')[0]?.[1]
          const marketTitleTag = event.getMatchingTags('market-title')[0]?.[1]
          const winnerTag = event.getMatchingTags('winner')[0]?.[1]
          const outcomeTag = event.getMatchingTags('outcome')[0]?.[1]
          const netSatsTag = event.getMatchingTags('net-sats')[0]?.[1]
          const resolvedAtTag = event.getMatchingTags('resolved-at')[0]?.[1]

          if (!marketTag) continue

          resolutionItems.push({
            id: event.id,
            marketId: marketTag,
            marketTitle: marketTitleTag || marketTag,
            outcome: (outcomeTag as 'YES' | 'NO') || 'YES',
            winnerPubkey: winnerTag || event.pubkey || '',
            winnerName: await getUserName(winnerTag || event.pubkey || ''),
            netSats: netSatsTag ? parseInt(netSatsTag, 10) : 0,
            timestamp: resolvedAtTag ? parseInt(resolvedAtTag, 10) : event.created_at ?? 0,
          })
        }

        if (!cancelled) {
          setResolutions(resolutionItems.sort((a, b) => b.timestamp - a.timestamp))
        }
      } catch (err) {
        console.warn('[Activity] Failed to load resolutions:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadResolutions()
    return () => {
      cancelled = true
    }
  }, [getUserName])

  const filteredItems =
    loading || error ? [] : items

  const showEmptyState = activeFilter === 'Trades' || activeFilter === 'Resolutions'
  const emptyStateMessage =
    activeFilter === 'Trades' ? 'No trade activity yet' : 'No resolutions yet'

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

      {/* Loading state */}
      {loading && (
        <p className="text-neutral-500 text-sm py-8 text-center">Loading activity…</p>
      )}

      {/* Error state */}
      {!loading && error && (
        <p className="text-neutral-500 text-sm py-8 text-center">{error}</p>
      )}

      {/* Empty states for Trades/Resolutions */}
      {!loading && !error && showEmptyState && (
        <p className="text-neutral-500 text-sm py-8 text-center">{emptyStateMessage}</p>
      )}

      {/* New Markets tab */}
      {!loading && !error && activeFilter === 'New Markets' && (
        <>
          {filteredItems.length === 0 ? (
            <p className="text-neutral-500 text-sm py-8 text-center">No markets found</p>
          ) : (
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
        </>
      )}

      {/* Trades tab */}
      {!loading && !error && activeFilter === 'Trades' && (
        <>
          {trades.length === 0 ? (
            <p className="text-neutral-500 text-sm py-8 text-center">No trade activity yet</p>
          ) : (
            <div className="divide-y divide-neutral-800">
              {trades.map((trade) => (
                <div key={trade.id} className="flex items-start gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium">{trade.traderName}</span>
                      <span className="text-xs text-neutral-500">{formatTimestamp(trade.timestamp)}</span>
                    </div>
                    <div className="text-neutral-300 text-sm mb-2">
                      Opened{' '}
                      <span className={trade.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>
                        {trade.direction.toUpperCase()}
                      </span>{' '}
                      position
                    </div>
                    <Link
                      to={`/market/${trade.marketId}`}
                      className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                    >
                      {trade.marketTitle}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Resolutions tab */}
      {!loading && !error && activeFilter === 'Resolutions' && (
        <>
          {resolutions.length === 0 ? (
            <p className="text-neutral-500 text-sm py-8 text-center">No resolutions yet</p>
          ) : (
            <div className="divide-y divide-neutral-800">
              {resolutions.map((resolution) => (
                <div key={resolution.id} className="flex items-start gap-4 py-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white text-sm font-medium">{resolution.marketTitle}</span>
                      <span className="text-xs text-neutral-500">{formatTimestamp(resolution.timestamp)}</span>
                    </div>
                    <div className="text-neutral-300 text-sm mb-1">
                      Resolved{' '}
                      <span className={resolution.outcome === 'YES' ? 'text-emerald-400' : 'text-rose-400'}>
                        {resolution.outcome}
                      </span>
                    </div>
                    <div className="text-neutral-400 text-sm">
                      <span className="text-white">{resolution.winnerName}</span>
                      {' won '}
                      <span className="text-emerald-400 font-mono">{resolution.netSats.toLocaleString()} sats</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* All tab */}
      {!loading && !error && activeFilter === 'All' && (
        <>
          {filteredItems.length === 0 && trades.length === 0 && resolutions.length === 0 ? (
            <p className="text-neutral-500 text-sm py-8 text-center">No activity found</p>
          ) : (
            <div className="divide-y divide-neutral-800">
              {/* Combine and sort all activities */}
              {(() => {
                type UnionItem = { timestamp: number; _type: 'market' | 'trade' | 'resolution' }
                const marketItems: (ActivityItem & UnionItem)[] = items.map(i => ({ ...i, _type: 'market' }))
                const tradeItems: (TradeItem & UnionItem)[] = trades.map(t => ({ ...t, _type: 'trade' }))
                const resolutionItems: (ResolutionItem & UnionItem)[] = resolutions.map(r => ({ ...r, _type: 'resolution' }))

                return [...marketItems, ...tradeItems, ...resolutionItems]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .slice(0, 50)
                  .map((item) => {
                    if (item._type === 'trade') {
                      const trade = item as TradeItem & UnionItem
                      return (
                        <div key={`trade-${trade.id}`} className="flex items-start gap-4 py-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white text-sm font-medium">{trade.traderName}</span>
                              <span className="text-xs text-neutral-500">{formatTimestamp(trade.timestamp)}</span>
                            </div>
                            <div className="text-neutral-300 text-sm mb-1">
                              Opened{' '}
                              <span className={trade.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>
                                {trade.direction.toUpperCase()}
                              </span>{' '}
                              position
                            </div>
                            <Link
                              to={`/market/${trade.marketId}`}
                              className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                            >
                              {trade.marketTitle}
                            </Link>
                          </div>
                        </div>
                      )
                    }
                    if (item._type === 'resolution') {
                      const res = item as ResolutionItem & UnionItem
                      return (
                        <div key={`resolution-${res.id}`} className="flex items-start gap-4 py-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white text-sm font-medium">{res.marketTitle}</span>
                              <span className="text-xs text-neutral-500">{formatTimestamp(res.timestamp)}</span>
                            </div>
                            <div className="text-neutral-300 text-sm mb-1">
                              Resolved{' '}
                              <span className={res.outcome === 'YES' ? 'text-emerald-400' : 'text-rose-400'}>
                                {res.outcome}
                              </span>
                            </div>
                            <div className="text-neutral-400 text-sm">
                              <span className="text-white">{res.winnerName}</span>
                              {' won '}
                              <span className="text-emerald-400 font-mono">{res.netSats.toLocaleString()} sats</span>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    // Market activity
                    const marketItem = item as ActivityItem & UnionItem
                    return (
                      <div key={`market-${marketItem.id}`} className="flex items-start gap-4 py-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-white text-sm font-medium">{marketItem.actor}</span>
                            <span className="text-xs text-neutral-500">{formatTimestamp(marketItem.timestamp)}</span>
                          </div>
                          <div className="text-neutral-300 text-sm mb-1">{marketItem.action}</div>
                          <Link
                            to={`/market/${marketItem.marketId}`}
                            className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                          >
                            {marketItem.marketName}
                          </Link>
                        </div>
                        <span className="text-xs text-neutral-600 uppercase tracking-wide shrink-0">
                          {marketItem.marketType}
                        </span>
                      </div>
                    )
                  })
              })()}
            </div>
          )}
        </>
      )}
    </div>
  )
}