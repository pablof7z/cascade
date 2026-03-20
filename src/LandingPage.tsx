import { useMemo, useState } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import ReserveChart from './ReserveChart'

type SampleMarketSpec = {
  title: string
  description: string
}

const sampleMarketBank: SampleMarketSpec[] = [
  {
    title: 'Will fusion hit grid parity by 2035?',
    description:
      'A toy market on whether fusion reaches commercially meaningful power economics before 2035.',
  },
  {
    title: 'Will a new reserve currency bloc emerge before 2040?',
    description:
      'A macro market on whether the current reserve stack fractures into a durable alternative bloc.',
  },
  {
    title: 'Will US housing become structurally cheaper by 2030?',
    description:
      'A supply-and-rates market disguised as a social stability argument.',
  },
  {
    title: 'Will a practical anti-aging therapy reach rich-country clinics by 2038?',
    description:
      'Focuses on real clinical deployment, not just another optimistic paper cycle.',
  },
  {
    title: 'Will fully synthetic food undercut premium animal protein by 2033?',
    description:
      'A price compression market on whether lab-grown alternatives escape prototype jail.',
  },
  {
    title: 'Will an open-source humanoid robot stack go mainstream by 2032?',
    description:
      'Tracks whether low-cost humanoid systems become deployable rather than staying lab theater.',
  },
]

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

type Props = {
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

export default function LandingPage({ markets, dispatch }: Props) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [initialSide, setInitialSide] = useState<Side>('LONG')
  const [initialSats, setInitialSats] = useState('150')
  const [showCreateModal, setShowCreateModal] = useState(false)

  const entries = Object.values(markets)

  const totalReserve = entries.reduce((sum, e) => sum + e.market.reserve, 0)
  const totalTrades = entries.reduce((sum, e) => sum + e.market.quotes.length, 0)
  const aggregateReserve = useMemo(() => buildAggregateReserve(entries), [entries])

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
          placeholder="Will a new energy breakthrough ship by 2032?"
        />
      </label>
      <label>
        <span>Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Describe the scenario so anyone looking at the order flow knows what this market is trying to say."
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
            <p className="label">Prediction market sandbox</p>
          </div>
          <div className="create-panel">
            <h1>Create the market</h1>
            <p className="hero-copy">
              Start from zero. Define the question, pick the opening side, and seed
              the first position yourself.
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
            <p className="label">Prediction market sandbox</p>
            <h1 className="landing-headline">Your markets</h1>
          </div>
          <button
            type="button"
            className="primary-button"
            onClick={() => setShowCreateModal(true)}
          >
            New market
          </button>
        </div>

        <div className="landing-stats">
          <div className="landing-stat">
            <span className="landing-stat-value">{entries.length}</span>
            <span className="landing-stat-label">Market{entries.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-value">{formatCurrency(totalReserve)}</span>
            <span className="landing-stat-label">Total reserve</span>
          </div>
          <div className="landing-stat">
            <span className="landing-stat-value">{totalTrades}</span>
            <span className="landing-stat-label">Trade{totalTrades !== 1 ? 's' : ''}</span>
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
        {entries.map(({ market }) => {
          const metrics = deriveMarketMetrics(market)
          const tradeCount = market.quotes.length
          return (
            <article
              key={market.id}
              className="market-card"
              onClick={() =>
                dispatch({ type: 'NAVIGATE', view: { screen: 'detail', marketId: market.id } })
              }
            >
              <h2 className="market-card-title">{market.title}</h2>
              {market.description ? (
                <p className="market-card-desc">{market.description}</p>
              ) : null}
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
