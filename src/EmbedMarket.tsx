import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { load, type MarketEntry } from './storage'
import { priceLong } from './market'

type Theme = 'dark' | 'light'

function ProbabilityBar({ probability, theme }: { probability: number; theme: Theme }) {
  const percentage = Math.round(probability * 100)
  const isDark = theme === 'dark'
  
  return (
    <div className="w-full">
      <div className={`h-2 rounded-full overflow-hidden ${isDark ? 'bg-neutral-700' : 'bg-neutral-200'}`}>
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex justify-between mt-1.5 text-xs">
        <span className={`font-medium ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
          YES {percentage}%
        </span>
        <span className={`font-medium ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>
          NO {100 - percentage}%
        </span>
      </div>
    </div>
  )
}

function CascadeLogo({ theme }: { theme: Theme }) {
  const isDark = theme === 'dark'
  return (
    <svg width="16" height="16" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="16" cy="16" r="14" stroke={isDark ? '#10b981' : '#059669'} strokeWidth="2" fill="none" />
      <path d="M10 16L14 20L22 12" stroke={isDark ? '#10b981' : '#059669'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function EmbedMarket() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const theme: Theme = searchParams.get('theme') === 'light' ? 'light' : 'dark'
  
  const [entry, setEntry] = useState<MarketEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)

  // Load market data
  useEffect(() => {
    const markets = load()
    if (markets && id && markets[id]) {
      setEntry(markets[id])
      setLastUpdate(new Date())
    }
    setLoading(false)
  }, [id])

  // Simulate live updates (poll every 5 seconds)
  // In production, this would use Nostr subscription
  useEffect(() => {
    if (!id) return

    const interval = setInterval(() => {
      const markets = load()
      if (markets && markets[id]) {
        setEntry(markets[id])
        setLastUpdate(new Date())
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [id])

  const isDark = theme === 'dark'
  const baseUrl = window.location.origin

  // Widget container styles
  const containerClasses = isDark
    ? 'bg-neutral-900 border-neutral-700 text-white'
    : 'bg-white border-neutral-200 text-neutral-900'

  if (loading) {
    return (
      <div className={`w-full h-full min-h-[150px] flex items-center justify-center ${containerClasses} border rounded-xl`}>
        <div className={`animate-pulse ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
          Loading...
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className={`w-full h-full min-h-[150px] flex items-center justify-center ${containerClasses} border rounded-xl`}>
        <div className={isDark ? 'text-neutral-500' : 'text-neutral-400'}>
          Market not found
        </div>
      </div>
    )
  }

  const { market } = entry
  const probability = priceLong(market.qLong, market.qShort, market.b)

  return (
    <div className={`w-full max-w-[400px] min-w-[280px] ${containerClasses} border rounded-xl overflow-hidden`}>
      {/* Main content */}
      <div className="p-4">
        {/* Title */}
        <h2 className={`text-sm font-semibold leading-tight line-clamp-2 mb-3 ${isDark ? 'text-white' : 'text-neutral-900'}`}>
          {market.title}
        </h2>

        {/* Probability display */}
        <div className="mb-3">
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-3xl font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
              {Math.round(probability * 100)}%
            </span>
            <span className={`text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
              chance
            </span>
          </div>
          <ProbabilityBar probability={probability} theme={theme} />
        </div>

        {/* Live indicator */}
        {lastUpdate && (
          <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Live
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 py-2.5 flex items-center justify-between ${isDark ? 'bg-neutral-800/50 border-t border-neutral-800' : 'bg-neutral-50 border-t border-neutral-100'}`}>
        <a
          href={`${baseUrl}/market/${market.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`text-xs font-medium transition-colors ${isDark ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-600 hover:text-emerald-500'}`}
        >
          View on Cascade →
        </a>
        <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-neutral-500' : 'text-neutral-400'}`}>
          <CascadeLogo theme={theme} />
          <span>Powered by Cascade</span>
        </div>
      </div>
    </div>
  )
}
