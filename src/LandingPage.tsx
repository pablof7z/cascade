import { useMemo, useState } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import ReserveChart from './ReserveChart'

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

function buildAggregateReserve(entries: MarketEntry[]): { time: number; value: number }[] {
  if (entries.length === 0) return []

  const events: { time: number; marketIdx: number; reserve: number }[] = []
  for (let i = 0; i < entries.length; i++) {
    for (const point of entries[i].history) {
      events.push({ time: point.time, marketIdx: i, reserve: point.reserve })
    }
  }
  events.sort((a, b) => a.time - b.time)

  const lastReserve = new Array<number>(entries.length).fill(0)
  const result: { time: number; value: number }[] = []

  for (const event of events) {
    lastReserve[event.marketIdx] = event.reserve
    const total = lastReserve.reduce((sum, v) => sum + v, 0)
    if (result.length > 0 && result[result.length - 1].time === event.time) {
      result[result.length - 1].value = total
    } else {
      result.push({ time: event.time, value: total })
    }
  }

  return result
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
  const aggregateReserve = useMemo(() => buildAggregateReserve(entries), [entries])

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
        <span className="text-sm text-gray-400">Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Will AGI emerge before 2030?"
          className="mt-1 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500"
        />
      </label>
      <label className="block">
        <span className="text-sm text-gray-400">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Define the resolution criteria clearly. What evidence would settle this question?"
          className="mt-1 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-gray-500 resize-y min-h-[88px]"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-gray-400">Initial side</span>
          <select
            value={initialSide}
            onChange={(event) => setInitialSide(event.target.value as Side)}
            className="mt-1 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gray-500"
          >
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Initial sats</span>
          <input
            value={initialSats}
            onChange={(event) => setInitialSats(event.target.value)}
            inputMode="decimal"
            className="mt-1 w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gray-500"
          />
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          className="flex-1 px-4 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          type="submit"
        >
          Create + seed market
        </button>
        <button
          className="px-4 py-3 border border-gray-600 text-gray-300 font-medium rounded-lg hover:border-gray-500 hover:text-white transition-colors"
          type="button"
          onClick={handleLoadSampleMarket}
        >
          Random market
        </button>
      </div>
    </form>
  )

  // Empty state
  if (entries.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-6 py-24">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-gray-500 mb-4">
            Prediction markets for long-term thinkers
          </p>
          <h1 className="text-3xl font-bold text-white mb-4">
            Map the future. Trade your beliefs.
          </h1>
          <p className="text-gray-400 mb-2">
            Create markets on the questions that matter in decades, not days.
            AI timelines, space colonization, climate trajectories, civilizational risks.
          </p>
          <p className="text-sm text-gray-500">
            Alice, Bob, and Carol start with cash only: zero LONG, zero SHORT,
            no hidden allocations.
          </p>
        </div>
        {createForm}
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Hero */}
      <section className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500 mb-2">
              Prediction markets for long-term thinkers
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Map the future. Trade your beliefs.
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              onClick={() => setShowCreateModal(true)}
            >
              New market
            </button>
            <Link
              to="/builder"
              className="px-4 py-2 border border-gray-600 text-gray-300 font-medium rounded-lg hover:border-gray-500 hover:text-white transition-colors"
            >
              Build thesis
            </Link>
          </div>
        </div>

        {/* Type filter tabs */}
        <div className="flex gap-1 mb-4">
          {typeFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTypeFilter === filter
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              }`}
              onClick={() => setActiveTypeFilter(filter)}
            >
              {filter}
              {filter === 'Modules' && (
                <span className="ml-1 text-gray-500">({moduleCount})</span>
              )}
              {filter === 'Theses' && (
                <span className="ml-1 text-gray-500">({thesisCount})</span>
              )}
            </button>
          ))}
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                activeCategory === cat
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-8 py-4 border-y border-gray-800">
          <div>
            <div className="text-2xl font-bold text-white">{entries.length}</div>
            <div className="text-xs uppercase tracking-wider text-gray-500">Active markets</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalReserve)}</div>
            <div className="text-xs uppercase tracking-wider text-gray-500">Total reserve</div>
          </div>
        </div>

        {/* Reserve chart */}
        {aggregateReserve.length >= 2 && (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Total reserve</p>
            <div className="h-36 rounded-lg overflow-hidden">
              <ReserveChart data={aggregateReserve} height={140} />
            </div>
          </div>
        )}
      </section>

      {/* Market cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredEntries.map(({ market }) => {
          const metrics = deriveMarketMetrics(market)
          const tradeCount = market.quotes.length
          const spec = getSampleSpec(market.title)
          const isThesis = spec?.type === 'thesis'
          const supportingModules = spec?.supportingModules || []
          const detailPath = isThesis ? `/thesis/${market.id}` : `/market/${market.id}`

          return (
            <article
              key={market.id}
              className="p-5 bg-gray-900 border border-gray-800 rounded-xl cursor-pointer hover:border-gray-700 transition-colors"
              onClick={() => navigate(detailPath)}
            >
              {/* Badge */}
              <div className="mb-3">
                {isThesis ? (
                  <span className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
                    Thesis
                  </span>
                ) : spec ? (
                  <span className="px-2 py-1 text-xs font-medium bg-gray-700/50 text-gray-300 rounded">
                    Module
                  </span>
                ) : null}
              </div>

              <h2 className="text-base font-semibold text-white mb-2 line-clamp-2">
                {market.title}
              </h2>

              {market.description && (
                <p className="text-sm text-gray-400 mb-3 line-clamp-2">
                  {market.description}
                </p>
              )}

              {/* Supporting modules for theses */}
              {isThesis && supportingModules.length > 0 && (
                <div className="mb-3">
                  <span className="text-xs text-gray-500">
                    Based on {supportingModules.length} modules
                  </span>
                </div>
              )}

              {/* Probability bar */}
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${metrics.longPositionShare * 100}%` }}
                />
              </div>

              {/* Odds */}
              <div className="flex justify-between text-sm font-medium mb-3">
                <span className="text-green-400">YES {formatPercent(metrics.longPositionShare)}</span>
                <span className="text-red-400">NO {formatPercent(metrics.shortPositionShare)}</span>
              </div>

              {/* Meta */}
              <div className="flex gap-4 text-xs text-gray-500">
                <span>Reserve {formatCurrency(market.reserve)}</span>
                <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
              </div>
            </article>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg p-6 bg-gray-900 border border-gray-700 rounded-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">New market</h2>
              <button
                type="button"
                className="px-3 py-1 text-sm text-gray-400 hover:text-white"
                onClick={() => setShowCreateModal(false)}
              >
                Close
              </button>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Alice, Bob, and Carol start with cash only. You seed the opening position.
            </p>
            {createForm}
          </div>
        </div>
      )}
    </div>
  )
}
