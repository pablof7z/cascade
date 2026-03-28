import { useMemo, useState } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'

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
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const height = 20
  const width = 48
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * height
      return `${x},${y}`
    })
    .join(' ')

  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        points={points}
      />
    </svg>
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

  // Filter sample data by category
  const filteredTheses = useMemo(() => {
    if (activeCategory === 'All') return sampleTheses
    return sampleTheses.filter(t => t.category === activeCategory)
  }, [activeCategory])

  const filteredModules = useMemo(() => {
    if (activeCategory === 'All') return sampleModules
    return sampleModules.filter(m => m.category === activeCategory)
  }, [activeCategory])

  const filteredDiscussions = useMemo(() => {
    if (activeCategory === 'All') return sampleDiscussions
    // Match discussions to their market's category
    return sampleDiscussions.filter(d => {
      const spec = sampleMarketBank.find(s => s.title === d.marketTitle)
      return spec?.category === activeCategory
    })
  }, [activeCategory])

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

  // Empty state — show full landing page
  if (entries.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950">
        {/* Header */}
        <header className="max-w-6xl mx-auto px-6 pt-8 pb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">Cascade</h1>
        </header>

        {/* 1. Category Navigation */}
        <nav className="max-w-6xl mx-auto px-6 pb-8">
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

        {/* 2. Featured Theses */}
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Featured Theses
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {filteredTheses.slice(0, 4).map(thesis => (
              <article
                key={thesis.title}
                className="p-5 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition-colors"
                onClick={() => {
                  dispatch({
                    type: 'CREATE_MARKET',
                    title: thesis.title,
                    description: thesis.description,
                    seedWithUser: false,
                  })
                }}
              >
                <span className="text-xs text-neutral-500">{thesis.category}</span>
                <h3 className="text-base font-medium text-white mt-1 mb-3 line-clamp-2">
                  {thesis.title}
                </h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-semibold text-green-500">
                    {Math.floor(Math.random() * 30 + 35)}%
                  </span>
                  <span className="text-sm text-neutral-500">YES</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* 3. Latest Discussions — MOST PROMINENT */}
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <h2 className="text-lg font-semibold text-white mb-4">Latest Discussions</h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
            {filteredDiscussions.length > 0 ? (
              filteredDiscussions.map(discussion => (
                <article
                  key={discussion.id}
                  className="p-5 hover:bg-neutral-800/50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-white">
                          {discussion.author}
                        </span>
                        {discussion.stance && (
                          <span
                            className={`px-2 py-0.5 text-xs font-semibold rounded ${
                              discussion.stance === 'LONG'
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {discussion.stance}
                          </span>
                        )}
                        <span className="text-xs text-neutral-500">
                          {discussion.timestamp}
                        </span>
                      </div>
                      <p className="text-sm text-neutral-300 mb-2 line-clamp-2">
                        {discussion.preview}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-neutral-500">
                        <span className="text-neutral-400">{discussion.marketTitle}</span>
                        <span>{discussion.replyCount} replies</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-8 text-center text-neutral-500">
                No discussions in this category yet.
              </div>
            )}
          </div>
        </section>

        {/* 4. Active Modules */}
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Active Modules
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {filteredModules.slice(0, 8).map(mod => (
              <article
                key={mod.title}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition-colors"
                onClick={() => {
                  dispatch({
                    type: 'CREATE_MARKET',
                    title: mod.title,
                    description: mod.description,
                    seedWithUser: false,
                  })
                }}
              >
                <span className="text-xs text-neutral-500">{mod.category}</span>
                <h3 className="text-sm font-medium text-white mt-1 mb-2 line-clamp-2">
                  {mod.title}
                </h3>
                <span className="text-lg font-semibold text-white">
                  {Math.floor(Math.random() * 40 + 30)}%
                </span>
              </article>
            ))}
          </div>
        </section>

        {/* 5. Market Movers */}
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Market Movers — 24h
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {sampleMovers.map(mover => {
              const isPositive = mover.change >= 0
              return (
                <article
                  key={mover.title}
                  className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition-colors"
                >
                  <h3 className="text-sm font-medium text-white mb-3 line-clamp-1">
                    {mover.title}
                  </h3>
                  <div className="flex items-end justify-between">
                    <div>
                      <span className="text-xl font-semibold text-white">
                        {Math.round(mover.probability * 100)}%
                      </span>
                      <span
                        className={`ml-2 text-sm font-medium ${
                          isPositive ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {isPositive ? '+' : ''}
                        {Math.round(mover.change * 100)}%
                      </span>
                    </div>
                    <Sparkline data={mover.sparkline} positive={isPositive} />
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        {/* 6. Recent Trades Ticker */}
        <section className="max-w-6xl mx-auto px-6 pb-12">
          <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
            Recent Trades
          </h2>
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              {sampleTrades.map((trade, i) => (
                <span key={i} className="text-neutral-400">
                  <span className="text-white">@{trade.user}</span>
                  {' bought '}
                  <span className={trade.side === 'YES' ? 'text-green-500' : 'text-red-500'}>
                    {trade.side}
                  </span>
                  {' on '}
                  <span className="text-neutral-300">{trade.market}</span>
                  <span className="text-neutral-500"> — {trade.timeAgo} ago</span>
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-6xl mx-auto px-6 pb-24">
          <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-lg">
            <h2 className="text-xl font-semibold text-white mb-6">Start a market</h2>
            {createForm}
          </div>
        </section>
      </div>
    )
  }

  // Non-empty state — show markets with filters
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 pt-8 pb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Markets</h1>
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
      <section className="max-w-6xl mx-auto px-6 pb-12">
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
                className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 cursor-pointer hover:border-neutral-700 transition-colors"
                onClick={() => navigate(detailPath)}
              >
                {spec?.category && (
                  <span className="text-xs text-neutral-500">{spec.category}</span>
                )}
                <h2 className="text-base font-medium text-white mt-1 mb-2 line-clamp-2">
                  {market.title}
                </h2>

                {/* Probability bar */}
                <div className="h-1 bg-neutral-800 rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-green-500 rounded-full"
                    style={{ width: `${metrics.longPositionShare * 100}%` }}
                  />
                </div>

                {/* Odds */}
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-green-500">{formatPercent(metrics.longPositionShare)}</span>
                  <span className="text-red-500">{formatPercent(metrics.shortPositionShare)}</span>
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

      {/* Latest Discussions */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <h2 className="text-lg font-semibold text-white mb-4">Latest Discussions</h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
          {filteredDiscussions.slice(0, 5).map(discussion => (
            <article
              key={discussion.id}
              className="p-5 hover:bg-neutral-800/50 cursor-pointer transition-colors"
            >
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-sm font-medium text-white">{discussion.author}</span>
                    {discussion.stance && (
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded ${
                          discussion.stance === 'LONG'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {discussion.stance}
                      </span>
                    )}
                    <span className="text-xs text-neutral-500">{discussion.timestamp}</span>
                  </div>
                  <p className="text-sm text-neutral-300 mb-2 line-clamp-2">{discussion.preview}</p>
                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="text-neutral-400">{discussion.marketTitle}</span>
                    <span>{discussion.replyCount} replies</span>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Market Movers */}
      <section className="max-w-6xl mx-auto px-6 pb-12">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Market Movers — 24h
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sampleMovers.map(mover => {
            const isPositive = mover.change >= 0
            return (
              <article
                key={mover.title}
                className="p-4 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700 transition-colors"
              >
                <h3 className="text-sm font-medium text-white mb-3 line-clamp-1">
                  {mover.title}
                </h3>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-xl font-semibold text-white">
                      {Math.round(mover.probability * 100)}%
                    </span>
                    <span
                      className={`ml-2 text-sm font-medium ${
                        isPositive ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {isPositive ? '+' : ''}
                      {Math.round(mover.change * 100)}%
                    </span>
                  </div>
                  <Sparkline data={mover.sparkline} positive={isPositive} />
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {/* Recent Trades */}
      <section className="max-w-6xl mx-auto px-6 pb-24">
        <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
          Recent Trades
        </h2>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {sampleTrades.map((trade, i) => (
              <span key={i} className="text-neutral-400">
                <span className="text-white">@{trade.user}</span>
                {' bought '}
                <span className={trade.side === 'YES' ? 'text-green-500' : 'text-red-500'}>
                  {trade.side}
                </span>
                {' on '}
                <span className="text-neutral-300">{trade.market}</span>
                <span className="text-neutral-500"> — {trade.timeAgo} ago</span>
              </span>
            ))}
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
