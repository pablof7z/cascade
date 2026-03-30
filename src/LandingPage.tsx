import { useMemo, useState, useEffect } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AgentFeatureSection from './components/AgentFeatureSection'
import { deriveMarketMetrics, type Side } from './market'
import { getThesisDefinition } from './marketCatalog'
import MockProfileLink from './components/MockProfileLink'
import type { MarketEntry } from './storage'
import type { Action } from './App'
// lightweight-charts used by market detail pages

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
    marketTitle: 'The Great Decoupling — AI productivity gains don\'t translate to wage growth',
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
const sampleFieldCount = new Set(sampleMarketBank.map(spec => spec.category)).size
const sampleHomepageStats = {
  markets: sampleMarketBank.length,
  fields: sampleFieldCount,
  theses: sampleTheses.length,
  discussions: sampleDiscussions.length,
}
const sampleFeaturedThesis = {
  thesis: sampleTheses[0],
  probability: 0.67,
  dailyMoveLabel: '+12% today',
  sparkline: [45, 48, 52, 55, 58, 62, 67],
  volume: '$24.5K',
  openInterest: '312 traders',
  discussion: '89 comments',
}

// Sample recent trades
const sampleTrades = [
  { market: 'AGI by 2030', side: 'YES', amount: 500, user: 'reasoning_agent', timeAgo: '2m' },
  { market: 'Fusion power plant', side: 'NO', amount: 250, user: 'energy_bear', timeAgo: '5m' },
  { market: 'Mars landing 2035', side: 'YES', amount: 1000, user: 'space_bull', timeAgo: '8m' },
  { market: 'Lab-grown meat', side: 'NO', amount: 150, user: 'biotech_skeptic', timeAgo: '12m' },
  { market: 'UBI pilot program', side: 'YES', amount: 300, user: 'policy_watcher', timeAgo: '15m' },
  { market: 'BCI reaches 1M users', side: 'YES', amount: 200, user: 'neuro_optimist', timeAgo: '18m' },
]

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
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

function matchesSearchQuery(query: string, values: Array<string | undefined | null>) {
  if (!query) return true
  return values.some((value) => value?.toLowerCase().includes(query))
}

function matchesMarketEntrySearch(entry: MarketEntry, query: string) {
  const spec = getSampleSpec(entry.market.title)
  return matchesSearchQuery(query, [
    entry.market.title,
    entry.market.description,
    spec?.category,
    spec?.description,
    ...(spec?.supportingModules ?? []),
  ])
}

function matchesSampleSpecSearch(spec: SampleMarketSpec, query: string) {
  return matchesSearchQuery(query, [
    spec.title,
    spec.description,
    spec.category,
    ...(spec.supportingModules ?? []),
  ])
}

function matchesDiscussionSearch(discussion: SampleDiscussion, query: string) {
  return matchesSearchQuery(query, [
    discussion.marketTitle,
    discussion.author,
    discussion.preview,
    discussion.stance,
  ])
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
          <MockProfileLink
            handle={trade.user}
            className="text-white hover:text-white"
            compact
            showAvatar={false}
          />
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
  const [searchParams] = useSearchParams()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [initialSide, setInitialSide] = useState<Side>('LONG')
  const [initialSats, setInitialSats] = useState('150')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const searchQuery = searchParams.get('search')?.trim() ?? ''
  const normalizedSearchQuery = searchQuery.toLowerCase()
  const hasSearchQuery = normalizedSearchQuery.length > 0

  const entries = Object.values(markets)

  // Derive sorted lists for each section
  const trendingMarkets = useMemo(() => {
    return [...entries]
      .sort((a, b) => b.market.reserve - a.market.reserve)
      .slice(0, 6)
  }, [entries])

  const pinkSheetMarkets = useMemo(() => {
    return [...entries]
      .sort((a, b) => a.market.reserve - b.market.reserve)
      .slice(0, 8)
  }, [entries])

  const hotDebates = useMemo(() => {
    return [...entries]
      .map(e => ({
        entry: e,
        distance: Math.abs(deriveMarketMetrics(e.market).longPositionShare - 0.5),
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5)
      .map(x => x.entry)
  }, [entries])

  const newThisWeek = useMemo(() => {
    return [...entries]
      .sort((a, b) => {
        const aTime = a.market.quotes.length > 0 ? new Date(a.market.quotes[0].createdAt).getTime() : 0
        const bTime = b.market.quotes.length > 0 ? new Date(b.market.quotes[0].createdAt).getTime() : 0
        return bTime - aTime
      })
      .slice(0, 10)
  }, [entries])


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

  function buildCreateMarketAction(spec: SampleMarketSpec, id?: string): Action {
    return {
      type: 'CREATE_MARKET',
      id,
      title: spec.title,
      description: spec.description,
      seedWithUser: false,
      kind: spec.type,
      thesis:
        spec.type === 'thesis'
          ? getThesisDefinition({
              title: spec.title,
              description: spec.description,
              kind: 'thesis',
            })
          : undefined,
    }
  }

  function handleLoadSampleMarket() {
    const spec = shuffle(sampleMarketBank)[0]
    dispatch(buildCreateMarketAction(spec))
    setShowCreateModal(false)
  }

  function navigateToMarket(entry: MarketEntry) {
    const spec = getSampleSpec(entry.market.title)
    const isThesis = entry.market.kind === 'thesis' || spec?.type === 'thesis'
    navigate(isThesis ? `/thesis/${entry.market.id}` : `/market/${entry.market.id}`)
  }

  function navigateToSampleSpec(spec: SampleMarketSpec, contextId: string) {
    const marketId = `${contextId}-${spec.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
    dispatch(buildCreateMarketAction(spec, marketId))
    setTimeout(() => {
      navigate(spec.type === 'thesis' ? `/thesis/${marketId}` : `/market/${marketId}`)
    }, 0)
  }

  const featuredThesis = sampleFeaturedThesis.thesis

  // Sample data for sections when real markets are sparse
  const trendingSample = [
    { title: 'AGI achieved by 2030', prob: 0.42, change: +0.12, volume: '$18.2K', trades: 847 },
    { title: 'First Mars landing with crew by 2035', prob: 0.35, change: +0.05, volume: '$12.1K', trades: 523 },
    { title: 'China GDP surpasses US', prob: 0.55, change: -0.04, volume: '$9.8K', trades: 412 },
    { title: 'Fusion power plant goes online', prob: 0.28, change: -0.08, volume: '$7.4K', trades: 289 },
    { title: 'Lab-grown meat exceeds 10% market share by 2028', prob: 0.15, change: +0.03, volume: '$5.1K', trades: 194 },
  ]

  const pinkSheetSample = [
    { title: 'Arctic ice-free summer by 2030', prob: 0.18, change: +0.06, volume: '$340', mcap: '$1.2K', category: 'Climate' },
    { title: 'Brain-computer interface reaches 1M users', prob: 0.22, change: -0.02, volume: '$180', mcap: '$890', category: 'Biotech' },
    { title: 'US implements UBI pilot program', prob: 0.31, change: +0.11, volume: '$95', mcap: '$620', category: 'Governance' },
    { title: 'Climate migration reshapes global politics', prob: 0.44, change: +0.03, volume: '$72', mcap: '$410', category: 'Climate' },
    { title: 'Biological longevity escape velocity achieved', prob: 0.12, change: -0.01, volume: '$55', mcap: '$280', category: 'Biotech' },
    { title: 'Quantum supremacy in drug discovery', prob: 0.08, change: +0.02, volume: '$38', mcap: '$150', category: 'Tech' },
  ]

  const hotDebateSample = [
    { title: 'The Great Decoupling — AI productivity gains don\'t translate to wage growth', yes: 52, traders: 312, comments: 89 },
    { title: 'China GDP surpasses US', yes: 48, traders: 412, comments: 67 },
    { title: 'Climate migration reshapes global politics', yes: 51, traders: 189, comments: 43 },
    { title: 'Space economy exceeds $1T by 2040', yes: 47, traders: 256, comments: 55 },
  ]

  const newThisWeekSample = [
    { title: 'Quantum error correction milestone by 2027', category: 'Tech', prob: 0.33, timeAgo: '2h ago' },
    { title: 'EU passes comprehensive AI regulation', category: 'Governance', prob: 0.71, timeAgo: '5h ago' },
    { title: 'Neuralink receives FDA approval for general use', category: 'Biotech', prob: 0.19, timeAgo: '1d ago' },
    { title: 'Bitcoin ETF surpasses gold ETF AUM', category: 'Crypto', prob: 0.38, timeAgo: '1d ago' },
    { title: 'Commercial fusion announcement by 2028', category: 'Energy', prob: 0.24, timeAgo: '2d ago' },
    { title: 'Autonomous vehicle Level 5 commercially available', category: 'Tech', prob: 0.16, timeAgo: '3d ago' },
    { title: 'CRISPR therapy approved for Alzheimer\'s', category: 'Biotech', prob: 0.09, timeAgo: '4d ago' },
    { title: 'India becomes world\'s 3rd largest economy', category: 'Geopolitics', prob: 0.62, timeAgo: '5d ago' },
  ]

  // Use real data when available, fall back to sample
  const useTrending = trendingMarkets.length >= 3 ? trendingMarkets : null
  const usePinkSheet = pinkSheetMarkets.length >= 3 ? pinkSheetMarkets : null
  const useHotDebates = hotDebates.length >= 3 ? hotDebates : null
  const useNewThisWeek = newThisWeek.length >= 3 ? newThisWeek : null
  const searchMarketResults = hasSearchQuery
    ? [
        ...entries
          .filter((entry) => matchesMarketEntrySearch(entry, normalizedSearchQuery))
          .map((entry) => {
            const spec = getSampleSpec(entry.market.title)
            return {
              key: `entry-${entry.market.id}`,
              title: entry.market.title,
              description:
                entry.market.description ||
                spec?.description ||
                'Continuous market with active conviction on both sides.',
              meta: spec?.category || (entry.market.kind === 'thesis' ? 'Thesis' : 'Market'),
              onClick: () => navigateToMarket(entry),
            }
          }),
        ...sampleMarketBank
          .filter((spec) => matchesSampleSpecSearch(spec, normalizedSearchQuery))
          .filter((spec) => !entries.some((entry) => entry.market.title === spec.title))
          .map((spec) => ({
            key: `sample-${spec.title}`,
            title: spec.title,
            description: spec.description,
            meta: `${spec.category} · demo ${spec.type}`,
            onClick: () => navigateToSampleSpec(spec, 'search'),
          })),
      ]
    : []
  const searchDiscussionResults = hasSearchQuery
    ? sampleDiscussions.filter((discussion) =>
        matchesDiscussionSearch(discussion, normalizedSearchQuery),
      )
    : []
  const hasSearchResults =
    searchMarketResults.length > 0 || searchDiscussionResults.length > 0
  return (
    <div className="min-h-screen bg-neutral-950">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Provocative statement + Featured Market
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-b border-neutral-900/80">
        <div className="max-w-7xl mx-auto w-full px-6 py-10 lg:py-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,0.9fr)] lg:items-start">
            <div className="space-y-8">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600">
                <span className="text-amber-500">Demo market map</span>
                <span>Persistent thesis markets</span>
                <span>Evidence reprices conviction</span>
                <span>{sampleHomepageStats.fields} sample fields</span>
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_220px] xl:items-end">
                <div className="space-y-4">
                  <h1 className="text-4xl font-bold leading-[1.02] tracking-tight text-white md:text-5xl lg:text-6xl">
                    Trade on Ideas That Don&apos;t Expire
                  </h1>
                  <p className="max-w-2xl text-lg leading-relaxed text-neutral-400 md:text-xl">
                    Cascade runs continuous markets on live theses. Build conviction, revise as evidence changes, and stay in the field instead of waiting for a single closing date.
                  </p>
                </div>

                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-neutral-900 pt-4 text-sm xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">Demo markets</dt>
                    <dd className="mt-1 text-xl font-semibold text-white tabular-nums">{sampleHomepageStats.markets}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">Demo fields</dt>
                    <dd className="mt-1 text-xl font-semibold text-white tabular-nums">{sampleHomepageStats.fields}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">Demo theses</dt>
                    <dd className="mt-1 text-xl font-semibold text-white tabular-nums">{sampleHomepageStats.theses}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] uppercase tracking-[0.18em] text-neutral-600">Demo discussions</dt>
                    <dd className="mt-1 text-xl font-semibold text-white tabular-nums">{sampleHomepageStats.discussions}</dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/join"
                  className="rounded-lg bg-white px-6 py-3 text-base font-semibold text-neutral-950 transition-colors hover:bg-neutral-100"
                >
                  Start Trading
                </Link>
                <Link
                  to="/builder"
                  className="rounded-lg border border-neutral-700 px-5 py-3 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Open Thesis Builder
                </Link>
              </div>
            </div>

            {/* Right — Featured thesis as raw typography, not a card */}
            <div className="border-t border-neutral-900 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
              <div className="flex items-center justify-between gap-4 text-[11px] font-medium uppercase tracking-[0.18em]">
                <span className="text-amber-500">Featured Demo Thesis</span>
                <span className="text-neutral-600">Illustrative market snapshot</span>
              </div>
              <button
                type="button"
                className="group mt-3 w-full text-left"
                onClick={() => {
                  const existingEntry = Object.values(markets).find(
                    e => e.market.title === featuredThesis.title
                  )
                  if (existingEntry) {
                    navigateToMarket(existingEntry)
                  } else {
                    dispatch(buildCreateMarketAction(featuredThesis, 'featured-great-decoupling'))
                  }
                }}
              >
                <h2 className="text-3xl font-bold leading-snug text-white transition-colors group-hover:text-emerald-400 md:text-4xl">
                  {featuredThesis.title}
                </h2>
              </button>
              <p className="mt-4 max-w-xl text-sm leading-6 text-neutral-400">
                {featuredThesis.description}
              </p>
              <div className="mt-6 flex flex-wrap items-end gap-x-4 gap-y-3">
                <span className="text-5xl font-black tabular-nums text-emerald-500 md:text-6xl">
                  {Math.round(sampleFeaturedThesis.probability * 100)}¢
                </span>
                <span className="pb-1 text-base text-emerald-500/70 md:text-lg">YES</span>
                <span className="pb-1 text-sm text-emerald-500">{sampleFeaturedThesis.dailyMoveLabel}</span>
                <Sparkline data={sampleFeaturedThesis.sparkline} positive={true} size="large" />
              </div>
              <div className="mt-5 grid gap-3 border-t border-neutral-900 pt-4 text-sm sm:grid-cols-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Demo volume</span>
                  <span className="font-mono tabular-nums text-white">{sampleFeaturedThesis.volume}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Demo participation</span>
                  <span className="font-mono tabular-nums text-white">{sampleFeaturedThesis.openInterest}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Demo discussion</span>
                  <span className="font-mono tabular-nums text-white">{sampleFeaturedThesis.discussion}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-neutral-600">Linked modules</span>
                  <span className="flex items-center gap-1.5 font-mono tabular-nums text-white">
                    <PulseDot color="amber" />
                    {featuredThesis.supportingModules?.length ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {hasSearchQuery ? (
        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
            <div>
              <div className="flex items-center justify-between gap-4 border-b border-neutral-800 pb-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                    Search
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Results for &quot;{searchQuery}&quot;
                  </h2>
                </div>
                <Link
                  to="/"
                  className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 transition-colors hover:border-neutral-500 hover:text-white"
                >
                  Clear
                </Link>
              </div>

              {searchMarketResults.length > 0 ? (
                <div className="border-t border-neutral-800">
                  {searchMarketResults.map((result) => (
                    <button
                      key={result.key}
                      type="button"
                      onClick={result.onClick}
                      className="block w-full border-b border-neutral-800 py-4 text-left transition-colors hover:bg-neutral-900/40"
                    >
                      <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                        {result.meta}
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-white">{result.title}</h3>
                      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-400">
                        {result.description}
                      </p>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="border-t border-neutral-800 pt-4 text-sm text-neutral-500">
                  No markets match this query.
                </div>
              )}
            </div>

            <div>
              <div className="border-b border-neutral-800 pb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                  Discussions
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-white">Matching threads</h2>
              </div>

              {searchDiscussionResults.length > 0 ? (
                <div className="border-t border-neutral-800">
                  {searchDiscussionResults.map((discussion) => {
                    const matchingEntry = Object.values(markets).find(
                      (entry) => entry.market.title === discussion.marketTitle,
                    )
                    const spec = sampleMarketBank.find((item) => item.title === discussion.marketTitle)

                    const handleDiscussionClick = () => {
                      if (matchingEntry) {
                        const isThesis =
                          matchingEntry.market.kind === 'thesis' || spec?.type === 'thesis'
                        navigate(
                          isThesis
                            ? `/thesis/${matchingEntry.market.id}`
                            : `/market/${matchingEntry.market.id}/discuss`,
                        )
                        return
                      }

                      if (!spec) return
                      const marketId = `search-discussion-${discussion.id}`
                      dispatch(buildCreateMarketAction(spec, marketId))
                      setTimeout(() => {
                        navigate(
                          spec.type === 'thesis'
                            ? `/thesis/${marketId}`
                            : `/market/${marketId}/discuss`,
                        )
                      }, 0)
                    }

                    return (
                      <button
                        key={discussion.id}
                        type="button"
                        onClick={handleDiscussionClick}
                        className="block w-full border-b border-neutral-800 py-4 text-left transition-colors hover:bg-neutral-900/40"
                      >
                        <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500">
                          {discussion.marketTitle} · {discussion.author} · {discussion.replyCount} replies
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-300">
                          {discussion.preview}
                        </p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="border-t border-neutral-800 pt-4 text-sm text-neutral-500">
                  No discussions match this query.
                </div>
              )}
            </div>
          </div>

          {!hasSearchResults ? (
            <div className="mt-10 border-t border-neutral-800 pt-6">
              <p className="text-sm text-neutral-400">
                Nothing on the homepage matches &quot;{searchQuery}&quot; yet.
              </p>
            </div>
          ) : null}
        </section>
      ) : (
        <>
      {/* ═══════════════════════════════════════════════════════════════════
          LIVE TRADES TICKER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-y border-neutral-800/50 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <PulseDot color="emerald" />
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Live</span>
          </div>
          <div className="overflow-hidden text-sm text-neutral-400">
            <TradesTicker trades={sampleTrades} />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: FEATURED MARKETS — Lead market + compact tape
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
          <div>
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-neutral-900 pb-4">
              <div>
                <h2 className="text-2xl font-black tracking-tight text-white md:text-3xl">Featured Markets</h2>
                <p className="mt-1 max-w-xl text-sm text-neutral-500">
                  Highest-liquidity contracts and live debates across the active research fields.
                </p>
              </div>
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600">
                Ranked by volume
              </span>
            </div>

            {(() => {
              if (useTrending && useTrending[0]) {
                const entry = useTrending[0]
                const metrics = deriveMarketMetrics(entry.market)
                const spec = getSampleSpec(entry.market.title)

                return (
                  <div className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600">
                        <span className="text-neutral-700">01</span>
                        {spec?.category && <span>{spec.category}</span>}
                        <span className="text-emerald-500">Highest volume</span>
                      </div>
                      <button
                        type="button"
                        className="group w-full text-left"
                        onClick={() => navigateToMarket(entry)}
                      >
                        <h3 className="text-2xl font-bold leading-snug text-white transition-colors group-hover:text-emerald-400 md:text-3xl">
                          {entry.market.title}
                        </h3>
                      </button>
                      <p className="max-w-2xl text-sm leading-6 text-neutral-400">
                        {entry.market.description
                          || spec?.description
                          || 'Continuous market with active conviction on both sides.'}
                      </p>
                    </div>

                    <div className="border-t border-neutral-900 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                      <div className="flex items-end gap-3">
                        <span className="text-5xl font-black tabular-nums text-emerald-500">
                          {Math.round(metrics.longPositionShare * 100)}¢
                        </span>
                        <Sparkline
                          data={[35, 38, 42, 40, 45, Math.round(metrics.longPositionShare * 100)]}
                          positive={metrics.longPositionShare > 0.4}
                          size="large"
                        />
                      </div>
                      <dl className="mt-4 space-y-2 text-sm text-neutral-500">
                        <div className="flex items-center justify-between gap-4">
                          <dt>Volume</dt>
                          <dd className="font-mono tabular-nums text-white">{formatCurrency(entry.market.reserve)}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt>Trades</dt>
                          <dd className="font-mono tabular-nums text-white">{entry.market.quotes.length}</dd>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <dt>Direction</dt>
                          <dd className="font-mono tabular-nums text-white">
                            {metrics.longPositionShare >= 0.5 ? 'LONG bias' : 'SHORT bias'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                )
              }

              const item = trendingSample[0]
              const sampleSpec = getSampleSpec(item.title)
              const handleSampleLeadClick = sampleSpec
                ? () => navigateToSampleSpec(sampleSpec, 'featured-lead')
                : undefined

              return (
                <div className="grid gap-6 pt-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600">
                      <span className="text-neutral-700">01</span>
                      <span>Sample market</span>
                      <span className="text-emerald-500">Highest volume</span>
                    </div>
                    {handleSampleLeadClick ? (
                      <button
                        type="button"
                        className="group w-full text-left"
                        onClick={handleSampleLeadClick}
                        aria-label={`Open ${item.title} market`}
                      >
                        <h3 className="text-2xl font-bold leading-snug text-white transition-colors group-hover:text-emerald-400 group-focus-visible:text-emerald-400 md:text-3xl">
                          {item.title}
                        </h3>
                      </button>
                    ) : (
                      <h3 className="text-2xl font-bold leading-snug text-white md:text-3xl">
                        {item.title}
                      </h3>
                    )}
                    <p className="max-w-2xl text-sm leading-6 text-neutral-400">
                      {getSampleSpec(item.title)?.description
                        || 'A representative high-conviction market from the current thesis pipeline.'}
                    </p>
                  </div>

                  <div className="border-t border-neutral-900 pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                    <div className="flex items-end gap-3">
                      <span className="text-5xl font-black tabular-nums text-emerald-500">
                        {Math.round(item.prob * 100)}¢
                      </span>
                      <Sparkline data={[30, 32, 35, 38, 40, 42]} positive={item.change >= 0} size="large" />
                    </div>
                    <dl className="mt-4 space-y-2 text-sm text-neutral-500">
                      <div className="flex items-center justify-between gap-4">
                        <dt>Volume</dt>
                        <dd className="font-mono tabular-nums text-white">{item.volume}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt>Trades</dt>
                        <dd className="font-mono tabular-nums text-white">{item.trades}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt>Move</dt>
                        <dd className={`font-mono tabular-nums ${item.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {item.change >= 0 ? '+' : ''}{Math.round(item.change * 100)}%
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>
              )
            })()}
          </div>

          <div className="border-t border-neutral-900 pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
            <div className="hidden grid-cols-[32px_minmax(0,1fr)_64px_64px_80px] gap-3 pb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-neutral-600 sm:grid">
              <span>Rank</span>
              <span>Market</span>
              <span className="text-right">Last</span>
              <span className="text-right">24h</span>
              <span className="text-right">Volume</span>
            </div>

            <div className="space-y-0">
              {(useTrending ? useTrending.slice(1) : trendingSample.slice(1)).map((item, i) => {
                const isReal = Boolean(useTrending) && 'market' in item
                const entry = item as MarketEntry
                const sample = item as typeof trendingSample[0]
                const marketTitle = isReal ? entry.market.title : sample.title
                const prob = isReal ? deriveMarketMetrics(entry.market).longPositionShare : sample.prob
                const change = isReal ? 0.05 : sample.change
                const vol = isReal ? formatCurrency(entry.market.reserve) : sample.volume
                const spec = isReal ? getSampleSpec(entry.market.title) : getSampleSpec(sample.title)
                const handleFeaturedRowClick = isReal
                  ? () => navigateToMarket(entry)
                  : spec
                    ? () => navigateToSampleSpec(spec, `featured-rank-${i + 2}`)
                    : undefined

                return (
                  <button
                    key={marketTitle}
                    type="button"
                    className="group w-full border-t border-neutral-900/70 py-3 text-left transition-colors hover:bg-neutral-900/40 focus-visible:bg-neutral-900/40"
                    onClick={handleFeaturedRowClick}
                    disabled={!handleFeaturedRowClick}
                    aria-label={handleFeaturedRowClick ? `Open ${marketTitle} market` : undefined}
                  >
                    <div className="flex items-start gap-3 sm:hidden">
                      <span className="w-7 shrink-0 pt-0.5 text-sm font-mono text-neutral-700 tabular-nums">
                        {String(i + 2).padStart(2, '0')}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-snug text-white transition-colors group-hover:text-emerald-400 group-focus-visible:text-emerald-400">
                          {marketTitle}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
                          <span className="font-mono tabular-nums text-white">{Math.round(prob * 100)}¢</span>
                          <span className={change >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                            {change >= 0 ? '▲' : '▼'}{Math.abs(Math.round(change * 100))}%
                          </span>
                          <span>{vol}</span>
                          <span>{spec?.category || 'Open field'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="hidden grid-cols-[32px_minmax(0,1fr)_64px_64px_80px] gap-3 sm:grid sm:items-center">
                      <span className="text-sm font-mono text-neutral-700 tabular-nums">
                        {String(i + 2).padStart(2, '0')}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-white transition-colors group-hover:text-emerald-400 group-focus-visible:text-emerald-400">
                          {marketTitle}
                        </span>
                        <span className="mt-1 block text-[11px] uppercase tracking-[0.16em] text-neutral-600">
                          {spec?.category || 'Open field'}
                        </span>
                      </span>
                      <span className="text-right text-sm font-mono font-bold tabular-nums text-white">
                        {Math.round(prob * 100)}¢
                      </span>
                      <span className={`text-right text-xs font-mono tabular-nums ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {change >= 0 ? '▲' : '▼'}{Math.abs(Math.round(change * 100))}%
                      </span>
                      <span className="text-right text-xs tabular-nums text-neutral-500">{vol}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: PINK-SHEET MARKETS — Bloomberg data-table style
          Rows with columns, alternating shading, monospace numbers
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-900/40 border-y border-neutral-800/30">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-baseline justify-between mb-8">
            <div className="flex items-baseline gap-4">
              <h2 className="text-3xl font-black text-white tracking-tight">Under the Radar</h2>
              <span className="text-sm text-neutral-600">Low volume · Flying under the radar</span>
            </div>
            <span className="text-xs text-neutral-600 uppercase tracking-wider hidden sm:block">Updated live</span>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-12 gap-2 px-3 pb-2 text-xs text-neutral-600 uppercase tracking-wider font-medium border-b border-neutral-700/50">
            <div className="col-span-5 sm:col-span-4">Market</div>
            <div className="col-span-2 text-right">Price</div>
            <div className="col-span-2 text-right hidden sm:block">Chg</div>
            <div className="col-span-2 text-right hidden md:block">Vol</div>
            <div className="col-span-3 sm:col-span-2 text-right">Mkt Cap</div>
          </div>

          {/* Table rows */}
          {(usePinkSheet
            ? usePinkSheet.map(entry => {
                const metrics = deriveMarketMetrics(entry.market)
                return {
                  title: entry.market.title,
                  prob: metrics.longPositionShare,
                  change: 0.03,
                  volume: formatCurrency(entry.market.reserve * 0.3),
                  mcap: formatCurrency(entry.market.reserve),
                  category: getSampleSpec(entry.market.title)?.category || '',
                  entry,
                }
              })
            : pinkSheetSample.map(s => ({ ...s, entry: null as MarketEntry | null }))
          ).map((row, i) => (
            <div
              key={row.title}
              className={`grid grid-cols-12 gap-2 px-3 py-3 text-sm cursor-pointer transition-colors hover:bg-neutral-800/30 ${
                i % 2 === 0 ? 'bg-neutral-800/10' : ''
              }`}
              onClick={() => row.entry ? navigateToMarket(row.entry) : undefined}
            >
              <div className="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
                <span className="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0">{row.category}</span>
                <span className="text-white truncate font-medium">{row.title}</span>
              </div>
              <div className="col-span-2 text-right font-mono font-bold text-amber-400 tabular-nums">
                {Math.round(row.prob * 100)}¢
              </div>
              <div className={`col-span-2 text-right font-mono tabular-nums hidden sm:block ${
                row.change >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {row.change >= 0 ? '+' : ''}{(row.change * 100).toFixed(1)}%
              </div>
              <div className="col-span-2 text-right font-mono text-neutral-500 tabular-nums hidden md:block">
                {row.volume}
              </div>
              <div className="col-span-3 sm:col-span-2 text-right font-mono text-neutral-400 tabular-nums">
                {row.mcap}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: HOT DEBATES — HN/Reddit text-heavy + intelligence sidebar
          Main column: heat indicators, YES/NO progress bars, plain text
          Sidebar: position shifts, sharp takes, heat index, contrarian alerts
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="flex items-baseline gap-4 mb-12">
          <h2 className="text-3xl font-black text-white tracking-tight">Latest Discussions</h2>
          <span className="text-sm text-neutral-600">Near 50/50 · Markets in conflict</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-0">
          {/* ── Left: Debate listings ── */}
          <div className="lg:col-span-8 lg:pr-10">
          {(() => {
            const debates = useHotDebates
              ? useHotDebates.map(entry => {
                  const metrics = deriveMarketMetrics(entry.market)
                  return {
                    title: entry.market.title,
                    yes: Math.round(metrics.longPositionShare * 100),
                    traders: entry.market.quotes.length,
                    comments: Math.floor(entry.market.quotes.length * 1.5),
                    spread: Math.abs(Math.round(metrics.longPositionShare * 100) - 50),
                    entry,
                  }
                })
              : hotDebateSample.map(s => ({
                  ...s,
                  spread: Math.abs(s.yes - 50),
                  entry: null as MarketEntry | null,
                }))

            return debates.map((debate) => {
              // Heat intensity: closer to 50/50 = hotter
              const heat = Math.max(0, 1 - debate.spread / 25)
              const no = 100 - debate.yes

              return (
                <div
                  key={debate.title}
                  className="flex gap-5 py-6 border-b border-neutral-800/20 last:border-0 cursor-pointer group"
                  onClick={() => debate.entry ? navigateToMarket(debate.entry) : undefined}
                >
                  {/* Heat indicator — thin vertical bar */}
                  <div className="w-1 shrink-0 rounded-full overflow-hidden self-stretch">
                    <div
                      className="w-full h-full rounded-full"
                      style={{
                        backgroundColor: heat > 0.7 ? '#f59e0b' : heat > 0.4 ? '#78716c' : '#404040',
                        opacity: 0.45 + heat * 0.35,
                      }}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white leading-snug mb-3 group-hover:text-emerald-400 transition-colors">
                      {debate.title}
                    </h3>

                    {/* YES/NO progress bar */}
                    <div className="flex w-full h-2 overflow-hidden mb-2">
                      <div
                        className="bg-emerald-600 transition-all duration-500"
                        style={{ width: `${debate.yes}%` }}
                      />
                      <div
                        className="bg-rose-600 transition-all duration-500"
                        style={{ width: `${no}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="text-emerald-500 font-medium tabular-nums">YES {debate.yes}%</span>
                        <span className="text-rose-500 font-medium tabular-nums">NO {no}%</span>
                        {debate.spread <= 5 && (
                          <span className="text-amber-500 text-xs">🔥 Razor-thin</span>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-neutral-600">
                        <span>{debate.comments} comments</span>
                        <span>{debate.traders} traders</span>
                        <span>spread {debate.spread}pt</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })
          })()}
          </div>

          {/* ── Right: Intelligence sidebar ── */}
          <div className="lg:col-span-4 lg:pl-10 lg:border-l border-neutral-800/40 pt-8 lg:pt-0">

            {/* ─── Position Shifts ─── */}
            <div className="mb-8">
              <h4 className="text-[11px] uppercase tracking-[0.2em] text-amber-500/80 font-semibold mb-4">Position Shifts</h4>
              {[
                { user: 'macro_watcher', action: 'flipped to YES', market: 'Great Decoupling', size: '$2.1K', time: '14m' },
                { user: 'orbital_capital', action: 'doubled down NO', market: 'China GDP', size: '$4.8K', time: '31m' },
                { user: 'energy_futures', action: 'flipped to NO', market: 'Climate migration', size: '$890', time: '1h' },
                { user: 'reasoning_agent', action: 'new YES', market: 'Space economy', size: '$1.5K', time: '2h' },
              ].map((shift, i) => (
                <div key={i} className="py-2 border-b border-neutral-800/20 last:border-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <MockProfileLink
                      handle={shift.user}
                      className="truncate text-white hover:text-white"
                      compact
                      stopPropagation
                    />
                    <span className="text-[10px] text-neutral-600 tabular-nums shrink-0">{shift.time}</span>
                  </div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    <span className={shift.action.includes('YES') || shift.action.includes('doubled') ? 'text-emerald-500/70' : 'text-rose-500/70'}>
                      {shift.action}
                    </span>
                    {' '}{shift.market}
                    <span className="text-neutral-600"> · {shift.size}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Sharp Takes ─── */}
            <div className="mb-8">
              <h4 className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-4">Sharp Takes</h4>
              {[
                { quote: '"If fusion is an engineering problem, so was the Apollo program. Budget it accordingly."', author: 'energy_futures', stance: 'LONG' as const },
                { quote: '"China\'s demographics are a 50-year headwind. GDP comparisons ignore dependency ratios."', author: 'macro_watcher', stance: 'SHORT' as const },
                { quote: '"Climate migration isn\'t a future event. It\'s happening now in Bangladesh and the Sahel."', author: 'geo_realist', stance: 'LONG' as const },
              ].map((take, i) => (
                <div key={i} className="py-3 border-b border-neutral-800/20 last:border-0">
                  <p className="text-[13px] text-neutral-300 leading-snug italic">{take.quote}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                    <MockProfileLink
                      handle={take.author}
                      className="text-neutral-500"
                      compact
                      showAvatar={false}
                      stopPropagation
                    />
                    <span className={`font-medium ${take.stance === 'LONG' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {take.stance === 'LONG' ? '▲ YES' : '▼ NO'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Heat Index ─── */}
            <div className="mb-8">
              <h4 className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-3">Heat Index</h4>
              <div className="text-[10px] text-neutral-700 uppercase tracking-wider flex justify-between px-0.5 mb-2">
                <span>Market</span>
                <span>Spread · Vol/24h</span>
              </div>
              {[
                { title: 'Great Decoupling', spread: 2, vol: '$6.2K', heat: 0.92 },
                { title: 'China GDP', spread: 4, vol: '$4.1K', heat: 0.84 },
                { title: 'Climate migration', spread: 1, vol: '$2.8K', heat: 0.96 },
                { title: 'Space $1T', spread: 6, vol: '$3.5K', heat: 0.76 },
                { title: 'Arctic ice-free', spread: 8, vol: '$1.9K', heat: 0.68 },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        backgroundColor: item.heat > 0.9 ? '#f59e0b' : item.heat > 0.75 ? '#78716c' : '#525252',
                        boxShadow: item.heat > 0.9 ? '0 0 4px #f59e0b80' : 'none',
                      }}
                    />
                    <span className="text-neutral-300 truncate text-xs">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="font-mono text-neutral-500 tabular-nums">{item.spread}pt</span>
                    <span className="font-mono text-neutral-600 tabular-nums">{item.vol}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* ─── Contrarian Alert ─── */}
            <div>
              <h4 className="text-[11px] uppercase tracking-[0.2em] text-rose-500/70 font-semibold mb-3">⚡ Contrarian Alert</h4>
              <p className="text-xs text-neutral-500 mb-3">Where top traders diverge from the crowd</p>
              {[
                { market: 'China GDP surpasses US', crowd: 55, whales: 38, whaleSide: 'NO' },
                { market: 'Space economy $1T', crowd: 47, whales: 71, whaleSide: 'YES' },
              ].map((alert, i) => (
                <div key={i} className="py-2.5 border-b border-neutral-800/20 last:border-0">
                  <span className="text-xs text-white font-medium block mb-1.5">{alert.market}</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="text-neutral-600">Crowd YES {alert.crowd}%</span>
                    <span className="text-neutral-700">→</span>
                    <span className={alert.whaleSide === 'YES' ? 'text-emerald-500' : 'text-rose-500'}>
                      Top 10 traders: {alert.whaleSide} {alert.whaleSide === 'YES' ? alert.whales : 100 - alert.whales}%
                    </span>
                  </div>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: NEW THIS WEEK — Asymmetric magazine layout
          3-column grid, varied density, flat background
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="border-t border-neutral-900/70">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-baseline gap-4 mb-8">
            <h2 className="text-3xl font-black text-white tracking-tight">New This Week</h2>
            <span className="text-sm text-neutral-600">Recently created</span>
          </div>

          {(() => {
            const items = useNewThisWeek
              ? useNewThisWeek.map((entry, i) => {
                  const metrics = deriveMarketMetrics(entry.market)
                  const spec = getSampleSpec(entry.market.title)
                  return {
                    title: entry.market.title,
                    category: spec?.category || '',
                    prob: metrics.longPositionShare,
                    timeAgo: `${i + 1}d ago`,
                    description: entry.market.description || spec?.description || '',
                    entry,
                  }
                })
              : newThisWeekSample.map(s => ({
                  ...s,
                  description: sampleMarketBank.find(m => m.title === s.title)?.description || '',
                  entry: null as MarketEntry | null,
                }))

            // Split into 3 columns with different density
            const featured = items[0]
            const subFeatured = items[1]
            const mediumItems = items.slice(2, 5)
            const compactItems = items.slice(5)

            return (
              <div className="grid gap-8 lg:grid-cols-3 lg:gap-10">
                {/* Column 1 — Featured large item + smaller item below */}
                <div className="space-y-6">
                  {featured && (
                    <div
                      className="cursor-pointer group"
                      onClick={() => featured.entry ? navigateToMarket(featured.entry) : undefined}
                    >
                      <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-500/70 font-medium">
                        {featured.category} · {featured.timeAgo}
                      </span>
                      <h3 className="text-xl font-bold text-white mt-2 mb-3 leading-snug group-hover:text-emerald-400 transition-colors">
                        {featured.title}
                      </h3>
                      <p className="text-sm text-neutral-500 leading-relaxed mb-4 line-clamp-3">
                        {featured.description}
                      </p>
                      <span className="text-3xl font-black text-emerald-500 tabular-nums">
                        {Math.round(featured.prob * 100)}¢
                      </span>
                    </div>
                  )}

                  {subFeatured && (
                    <div
                      className="cursor-pointer border-t border-neutral-800/30 pt-6 group"
                      onClick={() => subFeatured.entry ? navigateToMarket(subFeatured.entry) : undefined}
                    >
                      <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-medium">
                        {subFeatured.category} · {subFeatured.timeAgo}
                      </span>
                      <h4 className="text-base font-semibold text-white mt-1 mb-2 leading-snug group-hover:text-emerald-400 transition-colors">
                        {subFeatured.title}
                      </h4>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold text-white tabular-nums">
                          {Math.round(subFeatured.prob * 100)}¢
                        </span>
                        <span className="text-xs text-neutral-600">{subFeatured.timeAgo}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 2 — Medium stacked items with descriptions */}
                <div className="space-y-0">
                  {mediumItems.map((item) => (
                    <div
                      key={item.title}
                      className="cursor-pointer border-b border-neutral-800/20 py-4 last:border-0 group"
                      onClick={() => item.entry ? navigateToMarket(item.entry) : undefined}
                    >
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h4 className="text-sm font-semibold text-white leading-snug group-hover:text-emerald-400 transition-colors">
                          {item.title}
                        </h4>
                        <span className="text-sm font-mono font-bold text-white tabular-nums shrink-0">
                          {Math.round(item.prob * 100)}¢
                        </span>
                      </div>
                      <p className="text-xs text-neutral-600 leading-relaxed line-clamp-2 mb-1">
                        {item.description}
                      </p>
                      <span className="text-[10px] text-neutral-700 uppercase tracking-wider">
                        {item.category} · {item.timeAgo}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Column 3 — Compact "Also new" list (titles + metadata only) */}
                <div>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-medium block mb-4">
                    Also new
                  </span>
                  {compactItems.map((item, i) => (
                    <div
                      key={item.title}
                      className="flex items-baseline gap-3 py-2 cursor-pointer group"
                      onClick={() => item.entry ? navigateToMarket(item.entry) : undefined}
                    >
                      <span className="text-xs font-mono text-neutral-700 tabular-nums w-4 text-right shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-neutral-300 group-hover:text-emerald-400 transition-colors leading-snug">
                          {item.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-mono text-neutral-500 tabular-nums">{Math.round(item.prob * 100)}¢</span>
                          <span className="text-[10px] text-neutral-700">{item.category}</span>
                          <span className="text-[10px] text-neutral-700">{item.timeAgo}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          THE DEBATE — Discussion feed (text-only, Reddit-style)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-900/20 border-t border-neutral-800/30">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-center gap-3 mb-8">
            <PulseDot color="emerald" />
            <h2 className="text-3xl font-black text-white tracking-tight">Latest Discussions</h2>
          </div>

          <div className="max-w-3xl space-y-0">
            {sampleDiscussions.map(discussion => {
              const matchingEntry = Object.values(markets).find(
                e => e.market.title === discussion.marketTitle
              )
              const spec = sampleMarketBank.find(s => s.title === discussion.marketTitle)

              const handleClick = () => {
                if (matchingEntry) {
                  const isThesis = matchingEntry.market.kind === 'thesis' || spec?.type === 'thesis'
                  navigate(isThesis ? `/thesis/${matchingEntry.market.id}` : `/market/${matchingEntry.market.id}/discuss`)
                } else if (spec) {
                  const marketId = `discussion-${discussion.id}`
                  dispatch(buildCreateMarketAction(spec, marketId))
                  if (spec.type !== 'thesis') {
                    setTimeout(() => navigate(`/market/${marketId}/discuss`), 0)
                  }
                }
              }

              return (
                <article
                  key={discussion.id}
                  className="py-3 border-b border-neutral-800/20 last:border-0"
                >
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                    <span>in</span>
                    <span className="text-neutral-400">"{discussion.marketTitle}"</span>
                    <span>·</span>
                    <MockProfileLink
                      handle={discussion.author}
                      className="text-neutral-400"
                      compact
                      showAvatar={false}
                      stopPropagation
                    />
                    <span>·</span>
                    <span>{discussion.timestamp}</span>
                    <span>·</span>
                    <span>{discussion.replyCount} replies</span>
                    {discussion.replyCount > 15 && <span>🔥</span>}
                  </div>
                  <button
                    type="button"
                    onClick={handleClick}
                    className="mt-1 block w-full cursor-pointer px-0 text-left transition-colors hover:text-white"
                  >
                    <div className="text-sm leading-relaxed text-white">{discussion.preview}</div>
                  </button>
                </article>
              )
            })}
          </div>
        </div>
      </section>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          DIFFERENTIATOR — Why Cascade is different
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-neutral-800/30">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
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
          Agent Feature Section — Trade with AI
      ═══════════════════════════════════════════════════════════════════ */}
      <AgentFeatureSection />

      {/* ═══════════════════════════════════════════════════════════════════
          CTA — Create a market
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Have a thesis?
          </h2>
          <p className="text-lg text-neutral-400 mb-8">
            Turn your conviction into a market. Let the crowd price your prediction.
          </p>
          <div className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-8 py-4 bg-white text-neutral-950 font-semibold rounded-lg hover:bg-neutral-100 transition-colors text-lg"
            >
              Create market
            </button>
            <Link
              to="/builder"
              className="px-8 py-4 border border-neutral-700 text-white font-medium rounded-lg hover:border-neutral-500 transition-colors text-lg"
            >
              Build thesis
            </Link>
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
          </div>
        </div>
      )}
    </div>
  )
}
