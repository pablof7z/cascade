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
  supportingModules?: string[] // For theses, list of module titles they're based on
}

// Modules — concrete, falsifiable predictions
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

// Theses — longer-form structural claims about the future
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
  'Existential Risk',
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

  // Collect all timestamped reserve events tagged by market index
  const events: { time: number; marketIdx: number; reserve: number }[] = []
  for (let i = 0; i < entries.length; i++) {
    for (const point of entries[i].history) {
      events.push({ time: point.time, marketIdx: i, reserve: point.reserve })
    }
  }
  events.sort((a, b) => a.time - b.time)

  // Walk events, tracking last known reserve per market
  const lastReserve = new Array<number>(entries.length).fill(0)
  const result: { time: number; value: number }[] = []

  for (const event of events) {
    lastReserve[event.marketIdx] = event.reserve
    const total = lastReserve.reduce((sum, v) => sum + v, 0)
    // Deduplicate same-second entries: overwrite last if same time
    if (result.length > 0 && result[result.length - 1].time === event.time) {
      result[result.length - 1].value = total
    } else {
      result.push({ time: event.time, value: total })
    }
  }

  return result
}

function computeAverageHorizon(): string {
  // Mock: average years until resolution across sample markets
  return '8.4 years'
}

// Helper to get sample spec for a market (mock - in real app this would be stored)
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

  // Filter entries by type
  const filteredEntries = useMemo(() => {
    let filtered = entries

    // Filter by type
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

    // Filter by category
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
    <form className="stacked-form" onSubmit={handleCreateMarket}>
      <label>
        <span>Title</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Will AGI emerge before 2030?"
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Define the resolution criteria clearly. What evidence would settle this question?"
        />
      </label>
      <div className="dual-row">
        <label>
          <span>Initial side</span>
          <select
            value={initialSide}
            onChange={(event) => setInitialSide(event.target.value as Side)}
          >
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label>
          <span>Initial sats</span>
          <input
            value={initialSats}
            onChange={(event) => setInitialSats(event.target.value)}
            inputMode="decimal"
          />
        </label>
      </div>
      <div className="seed-actions">
        <button className="primary-button" type="submit">
          Create + seed market
        </button>
        <button className="ghost-button" type="button" onClick={handleLoadSampleMarket}>
          Random market
        </button>
      </div>
    </form>
  )

  // Empty state — show the form directly (no modal needed)
  if (entries.length === 0) {
    return (
      <div className="shell shell-compact">
        <section className="create-shell">
          <div className="create-meta">
            <p className="label">Prediction markets for long-term thinkers</p>
          </div>
          <div className="create-panel">
            <h1>Map the future. Trade your beliefs.</h1>
            <p className="hero-copy">
              Create markets on the questions that matter in decades, not days.
              AI timelines, space colonization, climate trajectories, civilizational risks.
            </p>
            <p className="muted">
              Alice, Bob, and Carol start with cash only: zero LONG, zero SHORT,
              no hidden allocations.
            </p>
            {createForm}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="shell shell-landing">
      {/* Hero stats */}
      <section className="landing-hero">
        <div className="landing-hero-top">
          <div>
            <p className="label">Prediction markets for long-term thinkers</p>
            <h1 className="landing-headline">Map the future. Trade your beliefs.</h1>
          </div>
          <div className="hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowCreateModal(true)}
            >
              New market
            </button>
            <Link to="/builder" className="ghost-button">
              Build thesis
            </Link>
          </div>
        </div>

        {/* Type filter tabs (All | Modules | Theses) */}
        <div className="type-tabs">
          {typeFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`type-tab ${activeTypeFilter === filter ? 'active' : ''}`}
              onClick={() => setActiveTypeFilter(filter)}
            >
              {filter}
              {filter === 'Modules' && <span className="tab-count"> ({moduleCount})</span>}
              {filter === 'Theses' && <span className="tab-count"> ({thesisCount})</span>}
            </button>
          ))}
        </div>

        {/* Category tabs */}
        <div className="category-tabs">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`category-tab ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="landing-stats">
          <div className="landing-stat">
            <span className="landing-stat-value">{entries.length}</span>
            <span className="landing-stat-label">Active markets</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-value">{formatCurrency(totalReserve)}</span>
            <span className="landing-stat-label">Total reserve</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-value">{computeAverageHorizon()}</span>
            <span className="landing-stat-label">Avg. resolution horizon</span>
          </div>
        </div>

        {aggregateReserve.length >= 2 ? (
          <div className="landing-chart">
            <p className="label">Total reserve</p>
            <ReserveChart data={aggregateReserve} height={140} />
          </div>
        ) : null}
      </section>

      {/* Market cards */}
      <div className="market-grid">
        {filteredEntries.map(({ market }) => {
          const metrics = deriveMarketMetrics(market)
          const tradeCount = market.quotes.length
          const spec = getSampleSpec(market.title)
          const isThesis = spec?.type === 'thesis'
          const supportingModules = spec?.supportingModules || []

          // Determine route based on type
          const detailPath = isThesis ? `/thesis/${market.id}` : `/market/${market.id}`

          return (
            <article
              key={market.id}
              className={`market-card ${isThesis ? 'market-card-thesis' : 'market-card-module'}`}
              onClick={() => navigate(detailPath)}
            >
              {isThesis && <span className="card-type-badge thesis-badge">Thesis</span>}
              {!isThesis && spec && <span className="card-type-badge module-badge">Module</span>}
              
              <h2 className="market-card-title">{market.title}</h2>
              {market.description ? (
                <p className="market-card-desc">{market.description}</p>
              ) : null}

              {/* For theses, show supporting modules */}
              {isThesis && supportingModules.length > 0 && (
                <div className="thesis-modules">
                  <span className="thesis-modules-label">Based on {supportingModules.length} modules</span>
                  <ul className="thesis-modules-list">
                    {supportingModules.slice(0, 2).map((mod, i) => (
                      <li key={i} className="thesis-module-item">{mod}</li>
                    ))}
                    {supportingModules.length > 2 && (
                      <li className="thesis-module-item thesis-module-more">
                        +{supportingModules.length - 2} more
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="state-bar market-card-bar">
                <span
                  className="state-bar-long"
                  style={{ width: `${metrics.longPositionShare * 100}%` }}
                />
              </div>
              <div className="market-card-odds">
                <span>LONG {formatPercent(metrics.longPositionShare)}</span>
                <span>SHORT {formatPercent(metrics.shortPositionShare)}</span>
              </div>
              <div className="market-card-meta">
                <span>Reserve {formatCurrency(market.reserve)}</span>
                <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
              </div>
            </article>
          )
        })}
      </div>

      {/* Create modal */}
      {showCreateModal ? (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">New market</h2>
              <button
                type="button"
                className="ghost-button modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                Close
              </button>
            </div>
            <p className="muted">
              Alice, Bob, and Carol start with cash only. You seed the opening position.
            </p>
            {createForm}
          </div>
        </div>
      ) : null}
    </div>
  )
}
