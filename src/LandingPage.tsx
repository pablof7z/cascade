import { useMemo, useState } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Discussion from './Discussion'
import { deriveMarketMetrics, type Side, type ThesisSignal } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import {
  categories,
  getSampleSpec,
  getThesisDefinition,
  inferMarketType,
  sampleMarketBank,
  sampleTheses,
} from './marketCatalog'
import OnboardingSplit from './OnboardingSplit'
import ReserveChart from './ReserveChart'

const typeFilters = ['All', 'Modules', 'Theses'] as const
type TypeFilter = typeof typeFilters[number]

type ArenaLead = {
  entry: MarketEntry
  route: string
  kind: 'module' | 'thesis'
  title: string
  summary: string
  consensus: number
  reserve: number
  tradeCount: number
  replies: number
  movePct: number
  signalCount: number
  downstreamCount: number
  primaryHook: string
  longCase: string
  shortCase: string
  thesisSignals: ThesisSignal[]
  score: number
}

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

function firstSentence(text: string) {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const match = clean.match(/^.*?[.!?](?:\s|$)/)
  return match ? match[0].trim() : clean
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
    const total = lastReserve.reduce((sum, value) => sum + value, 0)
    if (result.length > 0 && result[result.length - 1].time === event.time) {
      result[result.length - 1].value = total
    } else {
      result.push({ time: event.time, value: total })
    }
  }

  return result
}

function buildArenaLead(entry: MarketEntry): ArenaLead {
  const { market } = entry
  const kind = inferMarketType(market)
  const thesis = getThesisDefinition(market)
  const metrics = deriveMarketMetrics(market)
  const thesisSignals = thesis?.signals ?? []
  const downstreamCount = sampleTheses.filter((candidate) =>
    candidate.thesis?.signals.some((signal) => signal.moduleTitle === market.title),
  ).length
  const summary =
    kind === 'thesis'
      ? thesis?.argument ?? market.description
      : `${market.description} This matters only if it can force repricing upstream.`

  const longCase =
    kind === 'thesis'
      ? firstSentence(thesis?.argument ?? market.description) ||
        `${market.title} works if the second-order effects keep compounding.`
      : `${market.title} is a real hinge, not a side quest, and should transmit into bigger theses.`

  const shortCase =
    kind === 'thesis'
      ? 'The short side is attacking narrative compression: too many assumptions, too little timing discipline, not enough falsifiers.'
      : 'The short side is attacking false proxies: activity in this module does not automatically justify thesis repricing.'

  const primaryHook =
    kind === 'thesis'
      ? thesisSignals[0]
        ? `Pressure point: ${thesisSignals[0].moduleTitle}`
        : 'Pressure point: this thesis still needs sharper attack surfaces'
      : downstreamCount > 0
        ? `${downstreamCount} thesis thread${downstreamCount === 1 ? '' : 's'} downstream`
        : 'No downstream thesis thread linked yet'

  const replies = Math.max(
    kind === 'thesis' ? 12 : 7,
    market.quotes.length * 2 + thesisSignals.length * 3 + downstreamCount * 2,
  )
  const movePct = Math.max(1, Math.round(Math.abs(metrics.longOdds - 0.5) * 28 + market.quotes.length * 0.6))
  const score =
    market.reserve +
    market.quotes.length * 160 +
    (kind === 'thesis' ? 220 : 120) +
    thesisSignals.length * 70 +
    downstreamCount * 50

  return {
    entry,
    route: kind === 'thesis' ? `/thesis/${market.id}` : `/market/${market.id}`,
    kind,
    title: market.title,
    summary,
    consensus: metrics.longOdds,
    reserve: market.reserve,
    tradeCount: market.quotes.length,
    replies,
    movePct,
    signalCount: thesisSignals.length,
    downstreamCount,
    primaryHook,
    longCase,
    shortCase,
    thesisSignals,
    score,
  }
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
      filtered = filtered.filter((entry) => inferMarketType(entry.market) === 'module')
    } else if (activeTypeFilter === 'Theses') {
      filtered = filtered.filter((entry) => inferMarketType(entry.market) === 'thesis')
    }

    if (activeCategory !== 'All') {
      filtered = filtered.filter((entry) => {
        const spec = getSampleSpec(entry.market.title)
        return spec?.category === activeCategory
      })
    }

    return filtered
  }, [activeCategory, activeTypeFilter, entries])

  const totalReserve = entries.reduce((sum, entry) => sum + entry.market.reserve, 0)
  const aggregateReserve = useMemo(() => buildAggregateReserve(entries), [entries])
  const moduleCount = entries.filter((entry) => inferMarketType(entry.market) === 'module').length
  const thesisCount = entries.filter((entry) => inferMarketType(entry.market) === 'thesis').length

  const arenaLeads = useMemo(
    () => entries.map((entry) => buildArenaLead(entry)).sort((left, right) => right.score - left.score),
    [entries],
  )

  const featuredArena = useMemo(
    () => arenaLeads.find((lead) => lead.kind === 'thesis') ?? arenaLeads[0] ?? null,
    [arenaLeads],
  )

  const liveArenaBoard = useMemo(() => {
    if (!featuredArena) return arenaLeads.slice(0, 4)
    return arenaLeads.filter((lead) => lead.route !== featuredArena.route).slice(0, 4)
  }, [arenaLeads, featuredArena])

  const featuredSignalArena = useMemo(
    () => arenaLeads.find((lead) => lead.kind === 'module') ?? null,
    [arenaLeads],
  )

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
      kind: spec.type,
      thesis: spec.thesis,
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
          className="mt-1 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500"
        />
      </label>
      <label className="block">
        <span className="text-sm text-neutral-400">Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          placeholder="Define the resolution criteria clearly. What evidence would settle this question?"
          className="mt-1 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 resize-y min-h-[88px]"
        />
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm text-neutral-400">Initial side</span>
          <select
            value={initialSide}
            onChange={(event) => setInitialSide(event.target.value as Side)}
            className="mt-1 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
          >
            <option value="LONG">LONG</option>
            <option value="SHORT">SHORT</option>
          </select>
        </label>
        <label className="block">
          <span className="text-sm text-neutral-400">Initial sats</span>
          <input
            value={initialSats}
            onChange={(event) => setInitialSats(event.target.value)}
            inputMode="decimal"
            className="mt-1 w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
          />
        </label>
      </div>
      <div className="flex gap-3 pt-2">
        <button
          className="flex-1 px-4 py-3 bg-white text-neutral-900 font-semibold rounded-lg hover:bg-neutral-100 transition-colors"
          type="submit"
        >
          Create + seed market
        </button>
        <button
          className="px-4 py-3 border border-neutral-600 text-neutral-300 font-medium rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
          type="button"
          onClick={handleLoadSampleMarket}
        >
          Random market
        </button>
      </div>
    </form>
  )

  if (entries.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="text-center mb-8">
          <p className="text-xs uppercase tracking-widest text-neutral-500 mb-4">
            Prediction markets for long-term thinkers
          </p>
          <h1 className="text-3xl font-bold text-white mb-4">
            Map the future. Trade your beliefs.
          </h1>
          <p className="text-neutral-400 mb-2">
            Create markets on the questions that matter in decades, not days.
            AI timelines, space colonization, climate trajectories, civilizational risks.
          </p>
          <p className="text-sm text-neutral-500">
            Alice, Bob, and Carol start with cash only: zero LONG, zero SHORT,
            no hidden allocations.
          </p>
        </div>
        <OnboardingSplit className="mb-8" />
        {createForm}
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <section className="mb-10">
        <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500 mb-3">
              Prediction markets for long-term thinkers
            </p>
            <h1 className="text-4xl sm:text-5xl font-semibold text-white leading-tight mb-4">
              Truth should be discovered in public argument.
            </h1>
            <p className="text-lg text-neutral-300 leading-8 max-w-3xl">
              The chart is the score, not the product. The homepage should open on live theses,
              counter-theses, and signal fights that can actually move capital.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="px-4 py-2 bg-white text-neutral-900 font-semibold rounded-lg hover:bg-neutral-100 transition-colors"
              onClick={() => setShowCreateModal(true)}
            >
              New market
            </button>
            <Link
              to="/builder"
              className="px-4 py-2 border border-neutral-600 text-neutral-300 font-medium rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
            >
              Build thesis
            </Link>
            {featuredSignalArena ? (
              <Link
                to={featuredSignalArena.route}
                className="px-4 py-2 border border-neutral-600 text-neutral-300 font-medium rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
              >
                Open signal arena
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_340px]">
          <div className="rounded-[28px] border border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.12),_transparent_38%),linear-gradient(180deg,_rgba(23,23,23,0.94),_rgba(10,10,10,0.98))] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500 mb-3">Front Page Arena</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
              Debate leads. Markets follow.
            </h2>
            <p className="text-neutral-300 leading-7 max-w-3xl">
              Put the richest disagreement where people land: one thesis arena in full view,
              then a board of live signal fights underneath it. The market directory can live below.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 lg:grid-cols-1 gap-3">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Live arenas</div>
              <div className="text-2xl font-semibold text-white">{entries.length}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Thesis boards</div>
              <div className="text-2xl font-semibold text-white">{thesisCount}</div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/80 p-4">
              <div className="text-xs uppercase tracking-wider text-neutral-500 mb-1">Reserve in play</div>
              <div className="text-2xl font-semibold text-white">{formatCurrency(totalReserve)}</div>
            </div>
          </div>
        </div>

        <OnboardingSplit className="mt-6" />
      </section>

      {featuredArena ? (
        <section className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500 mb-2">Featured Debate</p>
              <h2 className="text-2xl font-semibold text-white mb-2">{featuredArena.title}</h2>
              <p className="text-neutral-400 leading-7">
                {featuredArena.primaryHook}. Start the homepage with the argument that is most
                likely to attract persuasion, rebuttal, and repricing.
              </p>
            </div>
            <Link
              to={featuredArena.route}
              className="px-4 py-2 border border-neutral-600 text-neutral-300 font-medium rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
            >
              Open thread
            </Link>
          </div>

          <Discussion
            marketTitle={featuredArena.title}
            marketKind={featuredArena.kind}
            consensus={featuredArena.consensus}
            reserve={featuredArena.reserve}
            tradeCount={featuredArena.tradeCount}
            thesisSignals={featuredArena.thesisSignals}
          />
        </section>
      ) : null}

      {liveArenaBoard.length > 0 ? (
        <section className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-5">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.24em] text-neutral-500 mb-2">Live Arena Board</p>
              <h2 className="text-2xl font-semibold text-white mb-2">
                Arguments moving markets right now
              </h2>
              <p className="text-neutral-400 leading-7">
                These debates should be obvious from the homepage without forcing people to drill
                into a card grid first.
              </p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            {liveArenaBoard.map((arena) => (
              <article
                key={arena.entry.market.id}
                className="rounded-[24px] border border-neutral-800 bg-neutral-900/80 p-5 cursor-pointer hover:border-neutral-700 transition-colors"
                onClick={() => navigate(arena.route)}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                        arena.kind === 'thesis'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-sky-500/15 text-sky-300'
                      }`}
                    >
                      {arena.kind === 'thesis' ? 'Thesis arena' : 'Signal arena'}
                    </span>
                    <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-neutral-800 text-neutral-300 border border-neutral-700">
                      {arena.primaryHook}
                    </span>
                  </div>
                  <div className="text-sm text-neutral-400">
                    {arena.replies} replies · moved {arena.movePct}%
                  </div>
                </div>

                <h3 className="text-xl font-semibold text-white mb-2">{arena.title}</h3>
                <p className="text-neutral-400 leading-7 mb-4 line-clamp-3">{arena.summary}</p>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-300 mb-2">
                      {arena.kind === 'thesis' ? 'Long case' : 'YES case'}
                    </div>
                    <p className="text-sm text-neutral-200 leading-6">{arena.longCase}</p>
                  </div>
                  <div className="rounded-2xl border border-rose-500/15 bg-rose-500/5 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-rose-300 mb-2">
                      {arena.kind === 'thesis' ? 'Short case' : 'NO case'}
                    </div>
                    <p className="text-sm text-neutral-200 leading-6">{arena.shortCase}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-neutral-400">
                  <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                    Consensus {formatPercent(arena.consensus)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                    Reserve {formatCurrency(arena.reserve)}
                  </span>
                  <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                    {arena.tradeCount} trade{arena.tradeCount === 1 ? '' : 's'}
                  </span>
                  {arena.kind === 'thesis' ? (
                    <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                      {arena.signalCount} signal market{arena.signalCount === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-neutral-800 text-neutral-200 border border-neutral-700">
                      {arena.downstreamCount} downstream thesis{arena.downstreamCount === 1 ? '' : 'es'}
                    </span>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8 pt-2">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-neutral-500 mb-2">Market Directory</p>
            <h2 className="text-2xl font-semibold text-white mb-2">
              Browse the markets underneath the debate
            </h2>
            <p className="text-neutral-400 leading-7 max-w-3xl">
              The arena leads the product now. This directory is the book underneath it.
            </p>
          </div>
        </div>

        <div className="flex gap-1 mb-4">
          {typeFilters.map((filter) => (
            <button
              key={filter}
              type="button"
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTypeFilter === filter
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:text-white hover:bg-neutral-800/50'
              }`}
              onClick={() => setActiveTypeFilter(filter)}
            >
              {filter}
              {filter === 'Modules' ? <span className="ml-1 text-neutral-500">({moduleCount})</span> : null}
              {filter === 'Theses' ? <span className="ml-1 text-neutral-500">({thesisCount})</span> : null}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                activeCategory === category
                  ? 'bg-neutral-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-8 py-4 border-y border-neutral-800">
          <div>
            <div className="text-2xl font-bold text-white">{entries.length}</div>
            <div className="text-xs uppercase tracking-wider text-neutral-500">Active markets</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white">{formatCurrency(totalReserve)}</div>
            <div className="text-xs uppercase tracking-wider text-neutral-500">Total reserve</div>
          </div>
        </div>

        {aggregateReserve.length >= 2 ? (
          <div className="mt-6">
            <p className="text-xs uppercase tracking-wider text-neutral-500 mb-2">Total reserve</p>
            <div className="h-36 rounded-lg overflow-hidden">
              <ReserveChart data={aggregateReserve} height={140} />
            </div>
          </div>
        ) : null}
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEntries.map(({ market }) => {
          const metrics = deriveMarketMetrics(market)
          const tradeCount = market.quotes.length
          const isThesis = inferMarketType(market) === 'thesis'
          const thesis = getThesisDefinition(market)
          const supportingModules = thesis?.signals ?? []
          const detailPath = isThesis ? `/thesis/${market.id}` : `/market/${market.id}`

          return (
            <article
              key={market.id}
              className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl cursor-pointer hover:border-neutral-700 transition-colors"
              onClick={() => navigate(detailPath)}
            >
              <div className="mb-3">
                {isThesis ? (
                  <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
                    Thesis
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs font-medium bg-neutral-700/50 text-neutral-300 rounded">
                    Module
                  </span>
                )}
              </div>

              <h2 className="text-base font-semibold text-white mb-2 line-clamp-2">{market.title}</h2>

              {market.description ? (
                <p className="text-sm text-neutral-400 mb-3 line-clamp-2">{market.description}</p>
              ) : null}

              {isThesis && supportingModules.length > 0 ? (
                <div className="mb-3">
                  <span className="text-xs text-neutral-500">
                    Uses {supportingModules.length} signal market{supportingModules.length === 1 ? '' : 's'}
                  </span>
                </div>
              ) : null}

              <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-green-500 rounded-full"
                  style={{ width: `${metrics.longOdds * 100}%` }}
                />
              </div>

              <div className="flex justify-between text-sm font-medium mb-3">
                <span className="text-green-400">YES {formatPercent(metrics.longOdds)}</span>
                <span className="text-red-400">NO {formatPercent(metrics.shortOdds)}</span>
              </div>

              <div className="flex gap-4 text-xs text-neutral-500">
                <span>Reserve {formatCurrency(market.reserve)}</span>
                <span>{tradeCount} trade{tradeCount !== 1 ? 's' : ''}</span>
              </div>
            </article>
          )
        })}
      </div>

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCreateModal(false)}
        >
          <div
            className="w-full max-w-lg p-6 bg-neutral-900 border border-neutral-700 rounded-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">New market</h2>
              <button
                type="button"
                className="px-3 py-1 text-sm text-neutral-400 hover:text-white"
                onClick={() => setShowCreateModal(false)}
              >
                Close
              </button>
            </div>
            <p className="text-sm text-neutral-400 mb-4">
              Alice, Bob, and Carol start with cash only. You seed the opening position.
            </p>
            {createForm}
          </div>
        </div>
      ) : null}
    </div>
  )
}
