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
    category: 'AI & Compute',
    type: 'module',
  },
  {
    title: 'First Mars landing with crew by 2035',
    description:
      'Will humans set foot on Mars before January 1, 2035? Requires successful landing and survival for at least 24 hours.',
    category: 'Space & Frontier',
    type: 'module',
  },
  {
    title: 'Lab-grown meat exceeds 10% market share by 2028',
    description:
      'Will cultivated meat products capture over 10% of global meat sales by volume before 2028?',
    category: 'Biotech & Health',
    type: 'module',
  },
  {
    title: 'US implements UBI pilot program',
    description:
      'Will the US federal government launch a universal basic income pilot of 10,000+ participants before 2030?',
    category: 'Governance & Society',
    type: 'module',
  },
  {
    title: 'Fusion power plant goes online',
    description:
      'Will a fusion reactor deliver net-positive energy to a commercial grid before 2035?',
    category: 'Energy & Climate',
    type: 'module',
  },
  {
    title: 'Brain-computer interface reaches 1M users',
    description:
      'Will any single BCI product (invasive or non-invasive) have 1 million active users before 2032?',
    category: 'Biotech & Health',
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
]

const sampleTheses: SampleMarketSpec[] = [
  {
    title: 'The Great Decoupling — AI productivity gains don\'t translate to wage growth',
    description:
      'Despite AI driving significant productivity increases, median real wages in developed economies remain flat or decline through 2035.',
    category: 'AI & Compute',
    type: 'thesis',
    supportingModules: ['AGI achieved by 2030', 'US implements UBI pilot program'],
  },
  {
    title: 'Space economy exceeds $1T by 2040',
    description:
      'The total value of space-related economic activity — including launch services, satellites, manufacturing, tourism, and resource extraction — surpasses $1 trillion annually.',
    category: 'Space & Frontier',
    type: 'thesis',
    supportingModules: ['First Mars landing with crew by 2035'],
  },
  {
    title: 'Biological longevity escape velocity achieved',
    description:
      'Life expectancy gains exceed one year per year for some demographic by 2045, driven by rejuvenation therapies rather than disease prevention alone.',
    category: 'Biotech & Health',
    type: 'thesis',
    supportingModules: ['Brain-computer interface reaches 1M users', 'Lab-grown meat exceeds 10% market share by 2028'],
  },
  {
    title: 'Climate migration reshapes global politics',
    description:
      'By 2040, climate-driven migration creates at least one new nation-state or triggers the collapse of an existing government.',
    category: 'Energy & Climate',
    type: 'thesis',
    supportingModules: ['Fusion power plant goes online'],
  },
]

const sampleMarketBank = [...sampleModules, ...sampleTheses]

const categories = [
  'All',
  'AI & Compute',
  'Space & Frontier',
  'Biotech & Health',
  'Energy & Climate',
  'Governance & Society',
]

const typeFilters = ['All', 'Modules', 'Theses'] as const
type TypeFilter = typeof typeFilters[number]

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
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Will AGI emerge before 2030?"
          className="mt-1 w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
        />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
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
            onChange={(event) => setInitialSide(event.target.value as Side)}
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
            onChange={(event) => setInitialSats(event.target.value)}
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

  // Empty state — show what Cascade is
  if (entries.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950">
        {/* Hero */}
        <header className="max-w-4xl mx-auto px-6 pt-16 pb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            Cascade
          </h1>
          <p className="text-xl text-neutral-400 max-w-2xl">
            Prediction markets for questions that matter in decades, not days. 
            Trade on open-ended theses. Let discourse move the price.
          </p>
        </header>

        {/* Concept */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">Theses</h3>
              <p className="text-sm text-neutral-400">
                Open-ended questions with no hard resolution date. 
                The market scores the argument over time.
              </p>
            </div>
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">Modules</h3>
              <p className="text-sm text-neutral-400">
                Discrete, falsifiable claims that feed into larger theses. 
                Evidence battlegrounds.
              </p>
            </div>
            <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg">
              <h3 className="text-lg font-semibold text-white mb-2">Discussion</h3>
              <p className="text-sm text-neutral-400">
                Not a comment section. Structured debate where 
                conviction-backed arguments move prices.
              </p>
            </div>
          </div>
        </section>

        {/* Featured Theses */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-6">
            Featured Theses
          </h2>
          <div className="space-y-4">
            {sampleTheses.slice(0, 3).map((thesis) => (
              <article
                key={thesis.title}
                className="p-6 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700"
                onClick={() => {
                  dispatch({
                    type: 'CREATE_MARKET',
                    title: thesis.title,
                    description: thesis.description,
                    seedWithUser: false,
                  })
                }}
              >
                <h3 className="text-lg font-medium text-white mb-2">
                  {thesis.title}
                </h3>
                <p className="text-sm text-neutral-400 mb-4">
                  {thesis.description}
                </p>
                {thesis.supportingModules && (
                  <div className="flex flex-wrap gap-2">
                    {thesis.supportingModules.map((mod) => (
                      <span
                        key={mod}
                        className="px-2 py-1 text-xs text-neutral-500 border border-neutral-800 rounded"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {/* Active Modules */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-6">
            Active Modules
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {sampleModules.slice(0, 4).map((mod) => (
              <article
                key={mod.title}
                className="p-5 bg-neutral-900 border border-neutral-800 rounded-lg cursor-pointer hover:border-neutral-700"
                onClick={() => {
                  dispatch({
                    type: 'CREATE_MARKET',
                    title: mod.title,
                    description: mod.description,
                    seedWithUser: false,
                  })
                }}
              >
                <div className="text-xs text-neutral-500 mb-2">{mod.category}</div>
                <h3 className="text-base font-medium text-white mb-2">
                  {mod.title}
                </h3>
                <p className="text-sm text-neutral-400 line-clamp-2">
                  {mod.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* Latest Discussions */}
        <section className="max-w-4xl mx-auto px-6 pb-16">
          <h2 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-6">
            Latest Discussions
          </h2>
          <div className="space-y-3">
            {sampleDiscussions.map((discussion) => (
              <article
                key={discussion.id}
                className="p-5 bg-neutral-900 border border-neutral-800 rounded-lg hover:border-neutral-700 cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-white font-medium">{discussion.author}</span>
                    {discussion.stance && (
                      <span className={discussion.stance === 'LONG' ? 'text-green-500' : 'text-red-500'}>
                        {discussion.stance}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-neutral-500">{discussion.timestamp}</span>
                </div>
                <p className="text-sm text-neutral-300 mb-3">{discussion.preview}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral-500">{discussion.marketTitle}</span>
                  <span className="text-xs text-neutral-500">{discussion.replyCount} replies</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="max-w-4xl mx-auto px-6 pb-24">
          <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-lg">
            <h2 className="text-2xl font-semibold text-white mb-4">
              Start a market
            </h2>
            {createForm}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-6 mb-6">
        <div className="flex gap-1">
          {typeFilters.map((filter) => (
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
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg ${
                activeCategory === cat
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-500 hover:text-white'
              }`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-8 text-sm mb-8">
        <div>
          <span className="text-white font-medium">{entries.length}</span>
          <span className="text-neutral-500 ml-2">markets</span>
        </div>
        <div>
          <span className="text-white font-medium">{formatCurrency(totalReserve)}</span>
          <span className="text-neutral-500 ml-2">reserve</span>
        </div>
      </div>

      {/* Market cards */}
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
              className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 cursor-pointer hover:border-neutral-700"
              onClick={() => navigate(detailPath)}
            >
              <h2 className="text-base font-medium text-white mb-2 line-clamp-2">
                {market.title}
              </h2>

              {market.description && (
                <p className="text-sm text-neutral-500 mb-4 line-clamp-2">
                  {market.description}
                </p>
              )}

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
                <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
              </div>
            </article>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg p-6 bg-neutral-900 border border-neutral-800 rounded-lg"
            onClick={(e) => e.stopPropagation()}
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
