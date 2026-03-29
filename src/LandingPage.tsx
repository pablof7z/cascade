import { useMemo, useState, useEffect, useRef } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import {
  createChart,
  AreaSeries,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from 'lightweight-charts'

type MarketType = 'module' | 'thesis'

type SampleMarketSpec = {
  title: string
  description: string
  category: string
  type: MarketType
  supportingModules?: string[]
}

const sampleModules: SampleMarketSpec[] = [
  {
    title: 'AGI achieved by 2030',
    description:
      'Will a system demonstrating general-purpose reasoning across arbitrary domains be publicly recognized by major AI labs before 2030?',
    category: 'AI',
    type: 'module',
  },
  {
    title: 'First Mars landing with crew by 2035',
    description:
      'Will humans set foot on Mars before January 1, 2035? Requires successful landing and survival for at least 24 hours.',
    category: 'Space',
    type: 'module',
  },
  {
    title: 'Lab-grown meat exceeds 10% market share by 2028',
    description:
      'Will cultivated meat products capture over 10% of global meat sales by volume before 2028?',
    category: 'Biotech',
    type: 'module',
  },
  {
    title: 'US implements UBI pilot program',
    description:
      'Will the US federal government launch a universal basic income pilot of 10,000+ participants before 2030?',
    category: 'Governance',
    type: 'module',
  },
  {
    title: 'Fusion power plant goes online',
    description:
      'Will a fusion reactor deliver net-positive energy to a commercial grid before 2035?',
    category: 'Energy',
    type: 'module',
  },
  {
    title: 'Brain-computer interface reaches 1M users',
    description:
      'Will any single BCI product (invasive or non-invasive) have 1 million active users before 2032?',
    category: 'Biotech',
    type: 'module',
  },
  {
    title: 'Arctic ice-free summer by 2030',
    description:
      'Will the Arctic experience an ice-free summer (less than 1 million km² extent) before 2030?',
    category: 'Climate',
    type: 'module',
  },
  {
    title: 'China GDP surpasses US',
    description:
      'Will China\'s nominal GDP exceed that of the United States before 2035?',
    category: 'Geopolitics',
    type: 'module',
  },
]

type SampleDiscussion = {
  id: string
  marketTitle: string
  author: string
  preview: string
  replyCount: number
  stance: 'LONG' | 'SHORT' | null
  timestamp: string
}

const sampleDiscussions: SampleDiscussion[] = [
  {
    id: 'd1',
    marketTitle: 'AGI achieved by 2030',
    author: 'reasoning_agent',
    preview: 'The goalposts keep moving. We had "AI can\'t play Go" until 2016. Now we have "AI can\'t reason" while o1 solves IMO problems. Define AGI or this resolves never.',
    replyCount: 14,
    stance: 'LONG',
    timestamp: '2h ago',
  },
  {
    id: 'd2',
    marketTitle: 'The Great Decoupling',
    author: 'macro_watcher',
    preview: 'Productivity-wage decoupling started in 1973, not with AI. The thesis conflates correlation with causation. Real wages track total compensation when you include benefits.',
    replyCount: 8,
    stance: 'SHORT',
    timestamp: '4h ago',
  },
  {
    id: 'd3',
    marketTitle: 'Space economy exceeds $1T by 2040',
    author: 'orbital_capital',
    preview: 'Starship changes everything. Launch costs dropping 100x means the entire satellite industry reprices. $1T is conservative if Starlink alone hits $100B ARR.',
    replyCount: 21,
    stance: 'LONG',
    timestamp: '6h ago',
  },
  {
    id: 'd4',
    marketTitle: 'Lab-grown meat exceeds 10% market share by 2028',
    author: 'biotech_skeptic',
    preview: 'Cost parity is a myth. Current cultivated meat runs $50/kg at scale. Traditional beef is $4/kg. That\'s not a gap you close in 4 years.',
    replyCount: 6,
    stance: 'SHORT',
    timestamp: '8h ago',
  },
  {
    id: 'd5',
    marketTitle: 'Fusion power plant goes online',
    author: 'energy_futures',
    preview: 'Commonwealth Fusion is targeting 2030. Their SPARC tokamak is on schedule. Helion claims 2028. The physics is solved — this is now an engineering problem.',
    replyCount: 11,
    stance: 'LONG',
    timestamp: '12h ago',
  },
]

const sampleTheses: SampleMarketSpec[] = [
  {
    title: 'The Great Decoupling — AI productivity gains don\'t translate to wage growth',
    description:
      'Despite AI driving significant productivity increases, median real wages in developed economies remain flat or decline through 2035.',
    category: 'AI',
    type: 'thesis',
    supportingModules: ['AGI achieved by 2030', 'US implements UBI pilot program'],
  },
  {
    title: 'Space economy exceeds $1T by 2040',
    description:
      'The total value of space-related economic activity — including launch services, satellites, manufacturing, tourism, and resource extraction — surpasses $1 trillion annually.',
    category: 'Space',
    type: 'thesis',
    supportingModules: ['First Mars landing with crew by 2035'],
  },
  {
    title: 'Biological longevity escape velocity achieved',
    description:
      'Life expectancy gains exceed one year per year for some demographic by 2045, driven by rejuvenation therapies rather than disease prevention alone.',
    category: 'Biotech',
    type: 'thesis',
    supportingModules: ['Brain-computer interface reaches 1M users', 'Lab-grown meat exceeds 10% market share by 2028'],
  },
  {
    title: 'Climate migration reshapes global politics',
    description:
      'By 2040, climate-driven migration creates at least one new nation-state or triggers the collapse of an existing government.',
    category: 'Climate',
    type: 'thesis',
    supportingModules: ['Fusion power plant goes online'],
  },
]

const sampleMarketBank = [...sampleModules, ...sampleTheses]

// Sample market movers data
// @ts-ignore
const sampleMovers = [
  { title: 'AGI achieved by 2030', probability: 0.42, change: 0.12, sparkline: [30, 32, 35, 38, 40, 42] },
  { title: 'Fusion power plant goes online', probability: 0.28, change: -0.08, sparkline: [36, 34, 32, 30, 29, 28] },
  { title: 'First Mars landing with crew by 2035', probability: 0.35, change: 0.05, sparkline: [30, 31, 32, 33, 34, 35] },
  { title: 'China GDP surpasses US', probability: 0.55, change: -0.04, sparkline: [59, 58, 57, 56, 55, 55] },
]

// Sample recent trades
const sampleTrades = [
  { market: 'AGI by 2030', side: 'YES', amount: 500, user: 'reasoning_agent', timeAgo: '2m' },
  { market: 'Fusion power plant', side: 'NO', amount: 250, user: 'energy_bear', timeAgo: '5m' },
  { market: 'Mars landing 2035', side: 'YES', amount: 1000, user: 'space_bull', timeAgo: '8m' },
  { market: 'Lab-grown meat', side: 'NO', amount: 150, user: 'biotech_skeptic', timeAgo: '12m' },
  { market: 'UBI pilot program', side: 'YES', amount: 300, user: 'policy_watcher', timeAgo: '15m' },
  { market: 'BCI reaches 1M users', side: 'YES', amount: 200, user: 'neuro_optimist', timeAgo: '18m' },
]



// Sample platform activity data for hero chart (last 7 days)
const platformActivityData = [
  { time: Date.now() / 1000 - 6 * 86400, value: 12400 },
  { time: Date.now() / 1000 - 5 * 86400, value: 15200 },
  { time: Date.now() / 1000 - 4 * 86400, value: 14100 },
  { time: Date.now() / 1000 - 3 * 86400, value: 18900 },
  { time: Date.now() / 1000 - 2 * 86400, value: 22300 },
  { time: Date.now() / 1000 - 1 * 86400, value: 19800 },
  { time: Date.now() / 1000, value: 24500 },
]

const categories = [
  'All',
  'AI',
  'Climate',
  'Geopolitics',
  'Biotech',
  'Space',
  'Energy',
  'Governance',
]

const typeFilters = ['All', 'Modules', 'Theses'] as const
type TypeFilter = (typeof typeFilters)[number]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number) {
  return `${currencyFormatter.format(value * 100)}%`
}

function shuffle<T>(items: T[]) {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swapIndex]] = [next[swapIndex], next[index]]
  }
  return next
}

function getSampleSpec(title: string): SampleMarketSpec | undefined {
  return sampleMarketBank.find(spec => spec.title === title)
}

// Mini sparkline component
function Sparkline({ data, positive, size = 'default' }: { data: number[]; positive: boolean; size?: 'default' | 'large' }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const height = size === 'large' ? 40 : 20
  const width = size === 'large' ? 100 : 60
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 4) - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth={size === 'large' ? 2 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

// Probability bar component
function ProbabilityBar({ probability, size = 'default' }: { probability: number; size?: 'default' | 'large' | 'hero' }) {
  const height = size === 'hero' ? 'h-3' : size === 'large' ? 'h-2' : 'h-1'
  return (
    <div className={`w-full ${height} bg-neutral-800 rounded-full overflow-hidden`}>
      <div
        className={`${height} bg-emerald-500 rounded-full transition-all duration-500`}
        style={{ width: `${probability * 100}%` }}
      />
    </div>
  )
}

// Animated pulse dot
function PulseDot({ color = 'emerald' }: { color?: 'emerald' | 'amber' | 'rose' }) {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  }
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${colorClasses[color]} opacity-75`} />
      <span className={`relative inline-flex rounded-full h-2 w-2 ${colorClasses[color]}`} />
    </span>
  )
}

// Hero chart component using lightweight-charts
function HeroChart({ data }: { data: { time: number; value: number }[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 140,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.3)',
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: 'rgba(255, 255, 255, 0.03)' },
      },
      leftPriceScale: {
        visible: false,
      },
      rightPriceScale: {
        visible: true,
        borderVisible: false,
      },
      timeScale: {
        visible: true,
        borderVisible: false,
        timeVisible: false,
      },
      handleScroll: false,
      handleScale: false,
      crosshair: {
        vertLine: { visible: false },
        horzLine: { visible: false },
      },
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: 'rgba(16, 185, 129, 0.9)',
      topColor: 'rgba(16, 185, 129, 0.25)',
      bottomColor: 'rgba(16, 185, 129, 0.02)',
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (value: number) => `${(value / 1000).toFixed(1)}k`,
      },
    })

    chartRef.current = chart
    seriesRef.current = series

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width })
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!seriesRef.current || !chartRef.current) return
    if (data.length < 2) return

    const chartData = data.map((point) => ({
      time: point.time as UTCTimestamp,
      value: point.value,
    }))

    seriesRef.current.setData(chartData)
    chartRef.current.timeScale().fitContent()
  }, [data])

  return <div ref={containerRef} className="w-full" />
}

// Animated trades ticker
function TradesTicker({ trades }: { trades: typeof sampleTrades }) {
  const [visibleTrades, setVisibleTrades] = useState(trades.slice(0, 4))
  const [fadeIndex, setFadeIndex] = useState(-1)

  useEffect(() => {
    const interval = setInterval(() => {
      setFadeIndex(0)
      setTimeout(() => {
        setVisibleTrades(prev => {
          const remaining = prev.slice(1)
          const nextIndex = (trades.indexOf(prev[prev.length - 1]) + 1) % trades.length
          return [...remaining, trades[nextIndex]]
        })
        setFadeIndex(-1)
      }, 300)
    }, 3000)
    return () => clearInterval(interval)
  }, [trades])

  return (
    <div className="flex gap-6 overflow-hidden">
      {visibleTrades.map((trade, i) => (
        <div
          key={`${trade.user}-${trade.market}-${i}`}
          className={`text-sm whitespace-nowrap transition-all duration-300 ${
            i === fadeIndex ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'
          }`}
        >
          <span className="text-white">@{trade.user}</span>
          {' bought '}
          <span className={trade.side === 'YES' ? 'text-emerald-500' : 'text-rose-500'}>
            {trade.side}
          </span>
          {' on '}
          <span className="text-neutral-300">{trade.market}</span>
          <span className="text-neutral-500"> — {trade.timeAgo}</span>
        </div>
      ))}
    </div>
  )
}

type Props = {
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

export default function LandingPage({ markets, dispatch }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [initialSide, setInitialSide] = useState<Side>('LONG')
  const [initialSats, setInitialSats] = useState('150')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [activeTypeFilter, setActiveTypeFilter] = useState<TypeFilter>('All')

  const entries = Object.values(markets)

  const filteredEntries = useMemo(() => {
    let filtered = entries

    if (activeTypeFilter === 'Modules') {
      filtered = filtered.filter(e => {
        const spec = getSampleSpec(e.market.title)
        return !spec || spec.type === 'module'
      })
    } else if (activeTypeFilter === 'Theses') {
      filtered = filtered.filter(e => {
        const spec = getSampleSpec(e.market.title)
        return spec?.type === 'thesis'
      })
    }

    if (activeCategory !== 'All') {
      filtered = filtered.filter(e => {
        const spec = getSampleSpec(e.market.title)
        return spec?.category === activeCategory
      })
    }

    return filtered
  }, [entries, activeTypeFilter, activeCategory])

  const totalReserve = entries.reduce((sum, e) => sum + e.market.reserve, 0)

  const moduleCount = entries.filter(e => {
    const spec = getSampleSpec(e.market.title)
    return !spec || spec.type === 'module'
  }).length
  const thesisCount = entries.filter(e => {
    const spec = getSampleSpec(e.market.title)
    return spec?.type === 'thesis'
  }).length

  function handleCreateMarket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const initialSeed = Number(initialSats)
    if (!Number.isFinite(initialSeed)) return
    dispatch({
      type: 'CREATE_MARKET',
      title,
      description,
      initialSide,
      initialSats: initialSeed,
      seedWithUser: true,
    })
    setTitle('')
    setDescription('')
    setInitialSats('150')
    setInitialSide('LONG')
    setShowCreateModal(false)
  }

  function handleLoadSampleMarket() {
    const spec = shuffle(sampleMarketBank)[0]
    dispatch({
      type: 'CREATE_MARKET',
      title: spec.title,
      description: spec.description,
      seedWithUser: false,
    })
    setShowCreateModal(false)
  }

  const createForm = (
    <form className="space-y-4" onSubmit={handleCreateMarket}>
      <label className="block">
        <span className="text-sm text-neutral-400">Title</span>
        <input
          value={title}
          onChange={event => setTitle(event.target.value)}
          placeholder="Will AGI emerge before 2030?"
          className="mt-1 w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
        />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Description</span>
        <textarea
          value={description}
          onChange={event => setDescription(event.target.value)}
          rows={3}
          placeholder="Define the resolution criteria clearly."
          className="mt-1 w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600 resize-y min-h-[88px]"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-neutral-400">Side</span>
          <select
            value={initialSide}
            onChange={event => setInitialSide(event.target.value as Side)}
            className="mt-1 w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-600"
          >
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Sats</span>
          <input
            value={initialSats}
            onChange={event => setInitialSats(event.target.value)}
            inputMode="decimal"
            className="mt-1 w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white focus:outline-none focus:border-neutral-600"
          />
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          className="flex-1 px-4 py-3 bg-white text-neutral-950 font-medium rounded-lg hover:bg-neutral-100"
          type="submit"
        >
          Create market
        </button>
        <button
          className="px-4 py-3 border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-600 hover:text-white"
          type="button"
          onClick={handleLoadSampleMarket}
        >
          Random
        </button>
      </div>
    </form>
  )

  // Single unified landing page - works with or without markets
  const featuredThesis = sampleTheses[0]
  const featuredProbability = 0.67
  
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Provocative statement + Featured Market
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[85vh] flex flex-col">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/50 via-neutral-950 to-neutral-950" />
        
        {/* Hero content */}
        <div className="relative z-10 flex-1 flex items-center">
          <div className="max-w-7xl mx-auto w-full px-6 py-16">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              
              {/* Left — The Hook */}
              <div className="space-y-8">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
                  Trade on Ideas That Don't Expire
                </h1>
                
                <p className="text-xl md:text-2xl text-neutral-400 max-w-lg leading-relaxed">
                  Most prediction markets close. Cascade doesn't. Take positions on ongoing theses, change minds, move markets.
                </p>
                
                {/* CTA */}
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    to="/join"
                    className="px-8 py-4 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 transition-colors text-lg"
                  >
                    Start Trading
                  </Link>
                  <Link
                    to="/join"
                    onClick={() => setTimeout(() => document.querySelector<HTMLButtonElement>('[data-agent-btn]')?.click(), 100)}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
                  >
                    For agents →
                  </Link>
                </div>
              </div>

              {/* Right — Featured Thesis */}
              <div 
                className="relative group cursor-pointer"
                onClick={() => {
                  // Check if market already exists
                  const existingEntry = Object.values(markets).find(
                    e => e.market.title === featuredThesis.title
                  )
                  if (existingEntry) {
                    navigate(`/market/${existingEntry.market.id}`)
                  } else {
                    // Create with predictable ID so dispatch handler can navigate
                    const marketId = 'featured-great-decoupling'
                    dispatch({
                      type: 'CREATE_MARKET',
                      id: marketId,
                      title: featuredThesis.title,
                      description: featuredThesis.description,
                      seedWithUser: false,
                    })
                  }
                }}
              >
                <div className="absolute -inset-4 bg-gradient-to-r from-emerald-500/10 via-transparent to-emerald-500/5 rounded-2xl blur-xl group-hover:from-emerald-500/20 transition-all duration-500" />
                
                <article className="relative bg-neutral-900/80 backdrop-blur border border-neutral-800 rounded-2xl p-8 group-hover:border-neutral-700 transition-all duration-300">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                      {featuredThesis.category} · Thesis
                    </span>
                    <div className="flex items-center gap-2">
                      <PulseDot color="amber" />
                      <span className="text-xs text-amber-500">47 trading now</span>
                    </div>
                  </div>
                  
                  <h3 className="text-2xl md:text-3xl font-bold text-white mb-6 leading-tight">
                    {featuredThesis.title}
                  </h3>
                  
                  <div className="mb-6">
                    <ProbabilityBar probability={featuredProbability} size="hero" />
                    <div className="flex items-baseline justify-between mt-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-bold text-emerald-500">{Math.round(featuredProbability * 100)}%</span>
                        <span className="text-lg text-neutral-500">YES</span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-emerald-500">+12% today</span>
                        <Sparkline data={[45, 48, 52, 55, 58, 62, 67]} positive={true} size="large" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6 text-sm text-neutral-400 border-t border-neutral-800 pt-4">
                    <span>$24.5K volume</span>
                    <span>312 traders</span>
                    <span>89 comments</span>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          PLATFORM VOLUME — Visual energy with real chart
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-10">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wider">Platform Volume</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-semibold text-white">{formatCurrency(totalReserve)}</span>
                <span className="text-sm text-emerald-500">+23.7%</span>
              </div>
            </div>
            <span className="text-xs text-neutral-500">Last 7 days</span>
          </div>
          <HeroChart data={platformActivityData} />
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE TRADES TICKER — Real-time activity feed
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-6xl mx-auto px-6 py-3 border-b border-neutral-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <PulseDot color="emerald" />
            <span className="text-xs text-neutral-500 uppercase tracking-wider">Live</span>
          </div>
          <div className="overflow-hidden text-sm text-neutral-400">
            <TradesTicker trades={sampleTrades} />
          </div>
        </div>
      </section>

      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-4 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-bold text-white">Active Markets</h2>
        <div className="flex gap-3">
          <button
            type="button"
            className="px-4 py-2 bg-white text-neutral-950 font-medium rounded-lg hover:bg-neutral-100"
            onClick={() => setShowCreateModal(true)}
          >
            New market
          </button>
          <Link
            to="/builder"
            className="px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-600 hover:text-white"
          >
            Build thesis
          </Link>
        </div>
      </header>

      {/* Category Navigation */}
      <nav className="max-w-6xl mx-auto px-6 pb-6">
        <div className="flex flex-wrap gap-2">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                activeCategory === cat
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </nav>

      {/* Type Filters + Stats */}
      <div className="max-w-6xl mx-auto px-6 pb-6 flex flex-wrap items-center gap-6">
        <div className="flex gap-1">
          {typeFilters.map(filter => (
            <button
              key={filter}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg ${
                activeTypeFilter === filter
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-500 hover:text-white'
              }`}
              onClick={() => setActiveTypeFilter(filter)}
            >
              {filter}
              {filter === 'Modules' && ` (${moduleCount})`}
              {filter === 'Theses' && ` (${thesisCount})`}
            </button>
          ))}
        </div>
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-white font-medium">{entries.length}</span>
            <span className="text-neutral-500 ml-2">markets</span>
          </div>
          <div>
            <span className="text-white font-medium">{formatCurrency(totalReserve)}</span>
            <span className="text-neutral-500 ml-2">reserve</span>
          </div>
        </div>
      </div>

      {/* Market cards */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-xl font-bold text-white">Active Markets</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredEntries.map(({ market }) => {
            const metrics = deriveMarketMetrics(market)
            const tradeCount = market.quotes.length
            const spec = getSampleSpec(market.title)
            const isThesis = spec?.type === 'thesis'
            const detailPath = isThesis ? `/thesis/${market.id}` : `/market/${market.id}`

            return (
              <article
                key={market.id}
                className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 cursor-pointer hover:border-neutral-700 hover:bg-neutral-900/80 transition-all"
                onClick={() => navigate(detailPath)}
              >
                {spec?.category && (
                  <span className="text-xs text-neutral-500">{spec.category}</span>
                )}
                <h2 className="text-base font-medium text-white mt-1 mb-3 line-clamp-2">
                  {market.title}
                </h2>

                {/* Probability bar */}
                <ProbabilityBar probability={metrics.longPositionShare} size="large" />

                {/* Odds + Sparkline */}
                <div className="flex justify-between items-center text-sm mt-2 mb-3">
                  <div className="flex gap-4">
                    <span className="text-emerald-500">{formatPercent(metrics.longPositionShare)}</span>
                    <span className="text-rose-500">{formatPercent(metrics.shortPositionShare)}</span>
                  </div>
                  <Sparkline 
                    data={[35, 38, 42, 40, 45, Math.round(metrics.longPositionShare * 100)]} 
                    positive={metrics.longPositionShare > 0.4} 
                  />
                </div>

                {/* Meta */}
                <div className="flex gap-4 text-xs text-neutral-500">
                  <span>{formatCurrency(market.reserve)}</span>
                  <span>
                    {tradeCount} trade{tradeCount !== 1 ? 's' : ''}
                  </span>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: TRENDING MARKETS — Sidebar layout
          Big featured item left, compact ranked list right. NO cards.
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="text-3xl font-bold text-white tracking-tight">Trending</h2>
          <span className="text-sm text-neutral-500">by volume · 24h</span>
        </div>

        <div className="grid lg:grid-cols-5 gap-0">
          {/* Left — Dominant featured market (3 cols) */}
          {(() => {
            const featured = entries[0]
            if (!featured) return null
            const fm = deriveMarketMetrics(featured.market)
            const spec = getSampleSpec(featured.market.title)
            return (
              <div
                className="lg:col-span-3 lg:border-r lg:border-neutral-800 lg:pr-10 pb-8 lg:pb-0 cursor-pointer group"
                onClick={() => navigate(spec?.type === 'thesis' ? `/thesis/${featured.market.id}` : `/market/${featured.market.id}`)}
              >
                <span className="text-xs font-medium text-emerald-500 uppercase tracking-widest">
                  #1 Trending
                </span>
                <h3 className="text-4xl md:text-5xl font-bold text-white mt-3 mb-5 leading-[1.1] group-hover:text-emerald-400 transition-colors">
                  {featured.market.title}
                </h3>
                <p className="text-lg text-neutral-400 leading-relaxed mb-8 max-w-xl">
                  {featured.market.description}
                </p>
                <div className="flex items-end gap-12">
                  <div>
                    <span className="block text-6xl font-black text-white tabular-nums">
                      {Math.round(fm.longPositionShare * 100)}
                      <span className="text-2xl text-neutral-500 font-normal">%</span>
                    </span>
                    <span className="text-sm text-neutral-500 mt-1 block">YES probability</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-semibold text-white tabular-nums">{formatCurrency(featured.market.reserve)}</span>
                    <span className="text-sm text-neutral-500">volume</span>
                  </div>
                  <div>
                    <span className="block text-2xl font-semibold text-emerald-500 tabular-nums">+{(Math.random() * 15 + 3).toFixed(1)}%</span>
                    <span className="text-sm text-neutral-500">24h</span>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Right — Compact ranked list (2 cols) */}
          <div className="lg:col-span-2 lg:pl-10">
            {entries.slice(1, 7).map(({ market }, i) => {
              const m = deriveMarketMetrics(market)
              const spec = getSampleSpec(market.title)
              return (
                <div
                  key={market.id}
                  className="flex items-start gap-4 py-3 border-b border-neutral-800/40 last:border-0 cursor-pointer hover:bg-white/[0.02] -mx-3 px-3 transition-colors"
                  onClick={() => navigate(spec?.type === 'thesis' ? `/thesis/${market.id}` : `/market/${market.id}`)}
                >
                  <span className="text-2xl font-bold text-neutral-700 tabular-nums w-8 shrink-0 mt-0.5">
                    {i + 2}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{market.title}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
                      <span className="text-emerald-500 font-medium">{Math.round(m.longPositionShare * 100)}%</span>
                      <span>{formatCurrency(market.reserve)}</span>
                      <span className={Math.random() > 0.4 ? 'text-emerald-500' : 'text-rose-500'}>
                        {Math.random() > 0.4 ? '+' : ''}{(Math.random() * 12 - 3).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Sparkline
                    data={[35 + Math.random()*10, 38 + Math.random()*10, 42 + Math.random()*10, 40 + Math.random()*10, 45 + Math.random()*10, Math.round(m.longPositionShare * 100)]}
                    positive={m.longPositionShare > 0.45}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: PINK-SHEET MARKETS — HN/Reddit text-heavy list
          Pure typography. No wrappers. Numbers inline. Let the text breathe.
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-baseline gap-4 mb-2">
          <h2 className="text-3xl font-bold text-white tracking-tight">Pink Sheets</h2>
          <span className="text-sm text-amber-500/80 font-medium">low cap underdogs</span>
        </div>
        <p className="text-sm text-neutral-600 mb-8">Small markets. Early conviction. High upside if you're right.</p>

        <ol className="space-y-0">
          {[...entries]
            .sort((a, b) => a.market.reserve - b.market.reserve)
            .slice(0, 8)
            .map(({ market }, i) => {
              const m = deriveMarketMetrics(market)
              const spec = getSampleSpec(market.title)
              return (
                <li
                  key={market.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(spec?.type === 'thesis' ? `/thesis/${market.id}` : `/market/${market.id}`)}
                >
                  <div className="flex items-baseline gap-0 py-2.5 border-b border-neutral-800/30 hover:border-neutral-700 transition-colors">
                    {/* Rank number */}
                    <span className="text-neutral-700 text-sm font-mono w-8 shrink-0">{i + 1}.</span>

                    {/* Title — the hero element. Big, bold, scannable */}
                    <span className="text-white font-medium group-hover:text-amber-400 transition-colors flex-1 mr-4">
                      {market.title}
                    </span>

                    {/* Inline metrics — no wrappers, just text */}
                    <span className="text-emerald-500 text-sm font-mono tabular-nums mr-4">
                      {Math.round(m.longPositionShare * 100)}¢
                    </span>
                    <span className="text-neutral-600 text-xs font-mono tabular-nums mr-4 hidden sm:inline">
                      {formatCurrency(market.reserve)}
                    </span>
                    <span className="text-neutral-700 text-xs hidden md:inline">
                      {market.quotes.length} trade{market.quotes.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </li>
              )
            })}
        </ol>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: HOT DEBATES — Bloomberg terminal / sports-book table
          Rows with columns. Monospace. Dense data. Colored numbers.
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-900/40 border-y border-neutral-800/50 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-baseline justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Hot Debates</h2>
              <p className="text-sm text-neutral-500 mt-1">Markets near 50/50 — conviction is split</p>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-neutral-600">
              <PulseDot color="amber" />
              <span>prices update live</span>
            </div>
          </div>

          {/* Table header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-neutral-600 uppercase tracking-wider border-b border-neutral-700/50">
            <div className="col-span-5">Market</div>
            <div className="col-span-1 text-right">YES</div>
            <div className="col-span-1 text-right">NO</div>
            <div className="col-span-1 text-right">Spread</div>
            <div className="col-span-2 text-right">Volume</div>
            <div className="col-span-1 text-right">24h Δ</div>
            <div className="col-span-1 text-right">Chart</div>
          </div>

          {/* Table rows */}
          {[...entries]
            .map(e => ({ ...e, spread: Math.abs(deriveMarketMetrics(e.market).longPositionShare - 0.5) }))
            .sort((a, b) => a.spread - b.spread)
            .slice(0, 6)
            .map(({ market }) => {
              const m = deriveMarketMetrics(market)
              const spec = getSampleSpec(market.title)
              const change = (Math.random() * 8 - 4)
              const spread = Math.abs(m.longPositionShare - 0.5) * 200

              return (
                <div
                  key={market.id}
                  className="grid grid-cols-12 gap-4 items-center px-4 py-3 border-b border-neutral-800/30 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => navigate(spec?.type === 'thesis' ? `/thesis/${market.id}` : `/market/${market.id}`)}
                >
                  {/* Market name */}
                  <div className="col-span-12 md:col-span-5">
                    <span className="text-white text-sm font-medium">{market.title}</span>
                    {spec?.category && (
                      <span className="text-neutral-600 text-xs ml-2 hidden lg:inline">
                        {spec.category}
                      </span>
                    )}
                  </div>

                  {/* YES price */}
                  <div className="hidden md:block col-span-1 text-right">
                    <span className="text-emerald-500 font-mono text-sm tabular-nums font-medium">
                      {Math.round(m.longPositionShare * 100)}¢
                    </span>
                  </div>

                  {/* NO price */}
                  <div className="hidden md:block col-span-1 text-right">
                    <span className="text-rose-500 font-mono text-sm tabular-nums font-medium">
                      {Math.round(m.shortPositionShare * 100)}¢
                    </span>
                  </div>

                  {/* Spread */}
                  <div className="hidden md:block col-span-1 text-right">
                    <span className={`font-mono text-xs tabular-nums ${spread < 6 ? 'text-amber-500' : 'text-neutral-500'}`}>
                      {spread.toFixed(1)}
                    </span>
                  </div>

                  {/* Volume */}
                  <div className="hidden md:block col-span-2 text-right">
                    <span className="text-neutral-300 font-mono text-sm tabular-nums">
                      {formatCurrency(market.reserve)}
                    </span>
                  </div>

                  {/* 24h change */}
                  <div className="hidden md:block col-span-1 text-right">
                    <span className={`font-mono text-sm tabular-nums font-medium ${change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </div>

                  {/* Mini chart */}
                  <div className="hidden md:flex col-span-1 justify-end">
                    <Sparkline
                      data={[48 + Math.random()*4, 49 + Math.random()*4, 50 + Math.random()*4, 51 + Math.random()*4, 49 + Math.random()*4, Math.round(m.longPositionShare * 100)]}
                      positive={change > 0}
                    />
                  </div>

                  {/* Mobile-only inline stats */}
                  <div className="col-span-12 md:hidden flex items-center gap-4 text-xs -mt-1">
                    <span className="text-emerald-500 font-mono">{Math.round(m.longPositionShare * 100)}¢ YES</span>
                    <span className="text-rose-500 font-mono">{Math.round(m.shortPositionShare * 100)}¢ NO</span>
                    <span className="text-neutral-500">{formatCurrency(market.reserve)}</span>
                    <span className={change > 0 ? 'text-emerald-500' : 'text-rose-500'}>
                      {change > 0 ? '+' : ''}{change.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )
            })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: NEW THIS WEEK — Full-bleed asymmetric layout
          One massive item, then offset smaller items. Breaks the grid.
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6 mb-8">
          <h2 className="text-3xl font-bold text-white tracking-tight">New This Week</h2>
        </div>

        {/* Hero new market — full-width immersive treatment */}
        {(() => {
          const newest = entries.length > 2 ? entries[entries.length - 1] : entries[0]
          if (!newest) return null
          const nm = deriveMarketMetrics(newest.market)
          const spec = getSampleSpec(newest.market.title)
          return (
            <div
              className="relative bg-gradient-to-r from-indigo-950/30 via-neutral-950 to-neutral-950 cursor-pointer group"
              onClick={() => navigate(spec?.type === 'thesis' ? `/thesis/${newest.market.id}` : `/market/${newest.market.id}`)}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-neutral-950/80" />
              <div className="relative max-w-7xl mx-auto px-6 py-16 md:py-20">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-3 mb-5">
                    <span className="bg-indigo-500/20 text-indigo-400 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                      Just Listed
                    </span>
                    {spec?.category && (
                      <span className="text-neutral-600 text-xs">{spec.category}</span>
                    )}
                  </div>
                  <h3 className="text-3xl md:text-5xl font-bold text-white leading-[1.1] mb-5 group-hover:text-indigo-300 transition-colors">
                    {newest.market.title}
                  </h3>
                  <p className="text-lg text-neutral-400 leading-relaxed mb-8 max-w-2xl">
                    {newest.market.description}
                  </p>
                  <div className="flex items-center gap-8 text-sm">
                    <span className="text-white font-semibold text-lg">{Math.round(nm.longPositionShare * 100)}% YES</span>
                    <span className="text-neutral-400">{formatCurrency(newest.market.reserve)} vol</span>
                    <span className="text-indigo-400">→ Trade now</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* Asymmetric grid of other new markets — deliberately unequal sizing */}
        <div className="max-w-7xl mx-auto px-6 mt-10">
          <div className="grid md:grid-cols-3 gap-x-8 gap-y-6">
            {entries.slice(Math.max(0, entries.length - 4), entries.length - 1).reverse().map(({ market }, i) => {
              const m = deriveMarketMetrics(market)
              const spec = getSampleSpec(market.title)
              // First item gets extra visual weight
              const isFeature = i === 0
              return (
                <div
                  key={market.id}
                  className={`${isFeature ? 'md:col-span-2 md:row-span-2' : ''} cursor-pointer group py-4 ${!isFeature ? 'border-l-2 border-neutral-800 pl-6' : ''}`}
                  onClick={() => navigate(spec?.type === 'thesis' ? `/thesis/${market.id}` : `/market/${market.id}`)}
                >
                  {spec?.category && (
                    <span className="text-xs text-neutral-600 uppercase tracking-wider">{spec.category}</span>
                  )}
                  <h4 className={`font-semibold text-white mt-1 mb-2 group-hover:text-indigo-300 transition-colors ${isFeature ? 'text-2xl md:text-3xl leading-tight' : 'text-base'}`}>
                    {market.title}
                  </h4>
                  {isFeature && (
                    <p className="text-neutral-500 text-sm leading-relaxed mb-4 max-w-lg">
                      {market.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-emerald-500 font-mono tabular-nums">{Math.round(m.longPositionShare * 100)}%</span>
                    <span className="text-neutral-600">{formatCurrency(market.reserve)}</span>
                    {isFeature && <Sparkline data={[30, 35, 33, 40, 42, Math.round(m.longPositionShare * 100)]} positive={true} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Latest Discussions - Reddit-style flat list (below markets) */}
      <section className="max-w-6xl mx-auto px-6 pb-10">
        <div className="flex items-center gap-3 mb-4">
          <PulseDot color="emerald" />
          <h2 className="text-xl font-bold text-white">The Debate</h2>
        </div>
        
        <div className="divide-y divide-neutral-800/50">
          {sampleDiscussions.map(discussion => {
            // Find a market that matches the discussion's market title
            const matchingEntry = Object.values(markets).find(
              e => e.market.title === discussion.marketTitle
            )
            
            // Find the spec for this market to get description
            const spec = sampleMarketBank.find(s => s.title === discussion.marketTitle)
            
            const handleClick = () => {
              if (matchingEntry) {
                // Market exists - navigate to its discussion
                navigate(`/market/${matchingEntry.market.id}/discuss`)
              } else if (spec) {
                // Market doesn't exist - create it first, then navigate
                const marketId = `discussion-${discussion.id}`
                dispatch({
                  type: 'CREATE_MARKET',
                  id: marketId,
                  title: spec.title,
                  description: spec.description,
                  seedWithUser: false,
                })
                // Navigate after a tick to let state update
                setTimeout(() => navigate(`/market/${marketId}/discuss`), 0)
              }
            }
            
            return (
              <button
                key={discussion.id}
                type="button"
                onClick={handleClick}
                className="block w-full text-left py-2.5 hover:bg-neutral-900/50 -mx-2 px-2 transition-colors cursor-pointer"
              >
                {/* Preview text */}
                <div className="text-sm text-white truncate mb-1">{discussion.preview}</div>
                
                {/* Metadata: market title + author + time + replies */}
                <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <span>in</span>
                  <span className="text-neutral-400">"{discussion.marketTitle}"</span>
                  <span>•</span>
                  <span className="text-neutral-400">@{discussion.author}</span>
                  <span>•</span>
                  <span>{discussion.timestamp}</span>
                  <span>•</span>
                  <span>{discussion.replyCount} {discussion.replyCount === 1 ? 'reply' : 'replies'}</span>
                  {discussion.replyCount > 15 && <span>🔥</span>}
                </div>
              </button>
            )
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: TRENDING — Sidebar layout (dominant left + compact list right)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="text-3xl font-bold text-white tracking-tight">Trending</h2>
          <span className="text-sm text-neutral-600">by volume · 24h</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-0">
          {/* Dominant featured market — left side */}
          {trendingMarkets[0] && (
            <div className="lg:col-span-5 lg:border-r lg:border-neutral-800 lg:pr-10 pb-8 lg:pb-0">
              <span className="text-xs font-medium text-emerald-600 uppercase tracking-widest">{trendingMarkets[0].category}</span>
              <h3 className="text-2xl md:text-3xl font-bold text-white mt-2 mb-6 leading-snug">
                {trendingMarkets[0].title}
              </h3>
              <div className="flex items-end gap-6 mb-6">
                <span className="text-6xl font-black text-white tabular-nums">
                  {Math.round(trendingMarkets[0].probability * 100)}
                  <span className="text-2xl text-neutral-600 font-medium">%</span>
                </span>
                <div className="pb-2">
                  <Sparkline data={trendingMarkets[0].sparkline} positive={trendingMarkets[0].change > 0} size="large" />
                  <span className={`text-sm font-medium ${trendingMarkets[0].change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trendingMarkets[0].change > 0 ? '+' : ''}{(trendingMarkets[0].change * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              <div className="flex gap-8 text-sm">
                <div>
                  <span className="text-neutral-600 block text-xs uppercase tracking-wider">Volume</span>
                  <span className="text-white font-semibold">${(trendingMarkets[0].volume / 1000).toFixed(1)}K</span>
                </div>
                <div>
                  <span className="text-neutral-600 block text-xs uppercase tracking-wider">Trades</span>
                  <span className="text-white font-semibold">{trendingMarkets[0].trades24h}</span>
                </div>
              </div>
            </div>
          )}

          {/* Compact ranked list — right side */}
          <div className="lg:col-span-7 lg:pl-10">
            {trendingMarkets.slice(1).map((m, i) => (
              <div
                key={m.title}
                className={`flex items-center gap-4 py-4 ${i > 0 ? 'border-t border-neutral-800/40' : ''}`}
              >
                <span className="text-2xl font-black text-neutral-700 w-8 text-right tabular-nums">{i + 2}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{m.title}</div>
                  <span className="text-xs text-neutral-600">{m.category} · {m.trades24h} trades</span>
                </div>
                <Sparkline data={m.sparkline} positive={m.change > 0} />
                <div className="text-right shrink-0 w-20">
                  <div className="text-white font-semibold tabular-nums">{Math.round(m.probability * 100)}%</div>
                  <span className={`text-xs tabular-nums ${m.change > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {m.change > 0 ? '▲' : '▼'} {Math.abs(m.change * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: PINK-SHEET — Bloomberg terminal / data-table style
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-900/30 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-baseline gap-3 mb-1">
            <h2 className="text-3xl font-bold text-amber-500/90 tracking-tight">Pink Sheets</h2>
            <span className="text-xs text-amber-600/50 uppercase tracking-widest font-medium">low-cap underdogs</span>
          </div>
          <p className="text-sm text-neutral-600 mb-8">Early-stage markets. Thin liquidity. High conviction required.</p>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs text-neutral-600 uppercase tracking-wider font-medium border-b border-neutral-800">
            <div className="col-span-5">Market</div>
            <div className="col-span-2 text-right">Odds</div>
            <div className="col-span-2 text-right">Volume</div>
            <div className="col-span-2 text-right">Traders</div>
            <div className="col-span-1 text-right">Age</div>
          </div>

          {/* Table rows */}
          {pinkSheetMarkets.map((m, i) => (
            <div
              key={m.title}
              className={`grid grid-cols-12 gap-4 items-center px-4 py-3 text-sm cursor-pointer transition-colors hover:bg-white/[0.02] ${
                i < pinkSheetMarkets.length - 1 ? 'border-b border-neutral-800/30' : ''
              }`}
            >
              <div className="col-span-5 min-w-0">
                <span className="text-white truncate block">{m.title}</span>
                <span className="text-xs text-neutral-700">{m.category}</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-amber-500 font-mono font-medium tabular-nums">{(m.probability * 100).toFixed(0)}¢</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-neutral-400 font-mono tabular-nums">${m.volume}</span>
              </div>
              <div className="col-span-2 text-right">
                <span className="text-neutral-500 font-mono tabular-nums">{m.traders}</span>
              </div>
              <div className="col-span-1 text-right">
                <span className="text-neutral-600 text-xs">{m.created}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: HOT DEBATES — Text-heavy HN/Reddit style, typography-driven
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">Hot Debates</h2>
        <p className="text-neutral-600 mb-10">Markets near 50/50 — where conviction matters most.</p>

        <ol className="space-y-0">
          {hotDebates.map((d, i) => {
            const spread = Math.abs(d.yesOdds - d.noOdds)
            const barWidth = `${d.yesOdds * 100}%`
            return (
              <li key={d.title} className={`${i > 0 ? 'border-t border-neutral-800/30' : ''}`}>
                <div className="flex items-start gap-5 py-5 cursor-pointer group">
                  {/* Heat indicator — just a colored bar, no box */}
                  <div className="w-1 self-stretch rounded-full shrink-0" style={{
                    background: `linear-gradient(to bottom, hsl(${(1 - d.heat) * 40}, 80%, 50%), hsl(${(1 - d.heat) * 40}, 60%, 30%))`,
                    opacity: 0.5 + d.heat * 0.5,
                  }} />

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors leading-tight">
                      {d.title}
                    </h3>
                    <span className="text-sm text-neutral-500">{d.subtitle}</span>

                    {/* YES/NO tug-of-war bar — raw, no wrapper */}
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-emerald-500 text-sm font-semibold tabular-nums w-12">{Math.round(d.yesOdds * 100)}%</span>
                      <div className="flex-1 h-1.5 bg-rose-500/20 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500/70 rounded-full" style={{ width: barWidth }} />
                      </div>
                      <span className="text-rose-400 text-sm font-semibold tabular-nums w-12 text-right">{Math.round(d.noOdds * 100)}%</span>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-neutral-600">
                      <span>{d.comments} comments</span>
                      <span>spread: {(spread * 100).toFixed(0)}pts</span>
                      {d.heat > 0.9 && <span className="text-rose-500 font-medium">🔥 on fire</span>}
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: NEW THIS WEEK — Full-bleed asymmetric / magazine layout
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Subtle gradient background — NOT neutral-900 */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-neutral-950 to-neutral-950" />
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-emerald-500/[0.03] rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-baseline gap-4 mb-12">
            <h2 className="text-3xl font-bold text-white tracking-tight">New This Week</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-neutral-800 to-transparent" />
          </div>

          {/* Asymmetric 3-column masonry-like layout */}
          <div className="grid md:grid-cols-3 gap-x-12 gap-y-0">
            {/* Column 1 — featured large item */}
            <div className="md:col-span-1">
              {newThisWeek[0] && (
                <div className="pb-10 cursor-pointer group">
                  <span className="text-xs text-emerald-600 font-medium uppercase tracking-widest">{newThisWeek[0].category}</span>
                  <h3 className="text-xl font-bold text-white mt-2 mb-3 leading-snug group-hover:text-emerald-400 transition-colors">
                    {newThisWeek[0].title}
                  </h3>
                  <p className="text-sm text-neutral-500 leading-relaxed mb-4">{newThisWeek[0].description}</p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-3xl font-black text-white tabular-nums">{Math.round(newThisWeek[0].probability * 100)}%</span>
                    <span className="text-xs text-neutral-600">@{newThisWeek[0].author} · {newThisWeek[0].timeAgo}</span>
                  </div>
                </div>
              )}
              {newThisWeek[1] && (
                <div className="pt-8 border-t border-neutral-800/40 cursor-pointer group">
                  <span className="text-xs text-neutral-600 font-medium uppercase tracking-widest">{newThisWeek[1].category}</span>
                  <h3 className="text-base font-semibold text-white mt-1 mb-2 group-hover:text-emerald-400 transition-colors">
                    {newThisWeek[1].title}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-bold text-white tabular-nums">{Math.round(newThisWeek[1].probability * 100)}%</span>
                    <span className="text-xs text-neutral-600">@{newThisWeek[1].author} · {newThisWeek[1].timeAgo}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2 — stacked medium items */}
            <div className="md:col-span-1 md:border-l md:border-neutral-800/40 md:pl-12 mt-8 md:mt-0">
              {newThisWeek.slice(2, 4).map((m, i) => (
                <div key={m.title} className={`cursor-pointer group ${i > 0 ? 'mt-8 pt-8 border-t border-neutral-800/40' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-neutral-600 uppercase tracking-widest">{m.category}</span>
                    <span className="text-neutral-800">·</span>
                    <span className="text-xs text-neutral-700">{m.timeAgo}</span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 group-hover:text-emerald-400 transition-colors leading-snug">
                    {m.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed mb-3">{m.description}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white tabular-nums">{Math.round(m.probability * 100)}%</span>
                    <span className="text-xs text-neutral-600">by @{m.author}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Column 3 — compact list */}
            <div className="md:col-span-1 md:border-l md:border-neutral-800/40 md:pl-12 mt-8 md:mt-0">
              <span className="text-xs text-neutral-600 uppercase tracking-wider font-medium">Also new</span>
              {newThisWeek.slice(4).map((m) => (
                <div key={m.title} className="mt-5 cursor-pointer group">
                  <h3 className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors leading-snug">
                    {m.title}
                  </h3>
                  <div className="flex items-center gap-3 mt-1 text-xs text-neutral-600">
                    <span className="font-mono tabular-nums text-white">{Math.round(m.probability * 100)}%</span>
                    <span>{m.category}</span>
                    <span>@{m.author}</span>
                    <span>{m.timeAgo}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE DIFFERENTIATOR — Why Cascade is different
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-16 border-t border-neutral-900">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          {/* Left — Big statement */}
          <div className="lg:col-span-5">
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
              Not another
              <span className="block text-neutral-600">prediction market.</span>
            </h2>
            <p className="text-lg text-neutral-400 leading-relaxed">
              Traditional markets resolve to YES or NO. Cascade trades on evolving truth — 
              questions that compound, theses that grow, arguments that sharpen.
            </p>
          </div>
          
          {/* Right — Two differentiators */}
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="text-4xl font-bold text-emerald-500">∞</div>
              <h3 className="text-lg font-semibold text-white">Infinite games</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Markets that never close. Price tracks evolving probability as evidence accumulates.
              </p>
            </div>
            <div className="space-y-3">
              <div className="text-4xl font-bold text-amber-500">◆</div>
              <h3 className="text-lg font-semibold text-white">Modular theses</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Stack predictions. Your thesis on AI depends on AGI timing and labor economics.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          CTA — Start a market
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-neutral-800 p-12">
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
          
          <div className="relative grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Have a thesis?
              </h2>
              <p className="text-lg text-neutral-400 mb-6">
                Turn your conviction into a market. Let the crowd price your prediction.
              </p>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-6 py-3 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 transition-colors"
                >
                  Create market
                </button>
                <Link
                  to="/builder"
                  className="px-6 py-3 border border-neutral-700 text-white font-medium rounded-lg hover:border-neutral-500 transition-colors"
                >
                  Build thesis
                </Link>
              </div>
            </div>
            
            {/* Quick preview of form */}
            <div className="bg-neutral-950/50 rounded-xl p-6 border border-neutral-800">
              <div className="space-y-4 opacity-75">
                <div className="h-3 w-20 bg-neutral-800 rounded" />
                <div className="h-12 bg-neutral-800/50 rounded-lg border border-neutral-700" />
                <div className="h-3 w-24 bg-neutral-800 rounded" />
                <div className="h-20 bg-neutral-800/50 rounded-lg border border-neutral-700" />
                <div className="flex gap-3">
                  <div className="flex-1 h-10 bg-white/10 rounded-lg" />
                  <div className="w-24 h-10 bg-neutral-800 rounded-lg" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg p-6 bg-neutral-900 border border-neutral-800 rounded-lg"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-white">New market</h2>
              <button
                type="button"
                className="text-sm text-neutral-500 hover:text-white"
                onClick={() => setShowCreateModal(false)}
              >
                Close
              </button>
            </div>
            {createForm}
          </div>
        </div>
      )}
    </div>
  )
}
