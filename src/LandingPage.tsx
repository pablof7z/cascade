import { useMemo, useState, useEffect } from 'react'
import type { FormEvent, Dispatch } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import { trackHomepageEngagement } from './analytics'
import { fetchMarketPosts, resolveAuthorName } from './services/nostrService'
// lightweight-charts used by market detail pages

/**
 * Format a timestamp as a relative time string (e.g., "2m ago", "4h ago").
 */
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(months / 12)
  return `${years}y ago`
}

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
    author: 'npub1qj8pkkgumwklthdys5ry5s9fd5njs69c70y2l3h8gveqyvlky9tsg3k8vd',
    preview: 'The goalposts keep moving. We had "AI can\'t play Go" until 2016. Now we have "AI can\'t reason" while o1 solves IMO problems. Define AGI or this resolves never.',
    replyCount: 14,
    stance: 'LONG',
    timestamp: '2h ago',
  },
  {
    id: 'd2',
    marketTitle: 'The Great Decoupling',
    author: 'npub1w0r4jhjtsr6dv25tj4me22nl4dqqkw26u4gytz9y3s3j45v8e4s3k8vd',
    preview: 'Productivity-wage decoupling started in 1973, not with AI. The thesis conflates correlation with causation. Real wages track total compensation when you include benefits.',
    replyCount: 8,
    stance: 'SHORT',
    timestamp: '4h ago',
  },
  {
    id: 'd3',
    marketTitle: 'Space economy exceeds $1T by 2040',
    author: 'npub1z8f6hyvrglwu8y5m24x6xkj6nw9syy2s9y83t3t7qd03h8u8e4s3k8vd',
    preview: 'Starship changes everything. Launch costs dropping 100x means the entire satellite industry reprices. $1T is conservative if Starlink alone hits $100B ARR.',
    replyCount: 21,
    stance: 'LONG',
    timestamp: '6h ago',
  },
  {
    id: 'd4',
    marketTitle: 'Lab-grown meat exceeds 10% market share by 2028',
    author: 'npub1q9nxjw2xv0k5y85ns3nw5k6u0y66nkllqeyq9y6qf5v5s8u8e4s3k8vd',
    preview: 'Cost parity is a myth. Current cultivated meat runs $50/kg at scale. Traditional beef is $4/kg. That\'s not a gap you close in 4 years.',
    replyCount: 6,
    stance: 'SHORT',
    timestamp: '8h ago',
  },
  {
    id: 'd5',
    marketTitle: 'Fusion power plant goes online',
    author: 'npub1gxn4dp93nc5k0cjvjljr4nvc3wqs5jya3lqtu98vf6p8m8u8e4s3k8vd',
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

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function getRelatedDiscussions(discussions: SampleDiscussion[], title: string, limit = 2) {
  const normalizedTitle = normalizeText(title)

  return discussions.filter((discussion) => {
    const normalizedMarketTitle = normalizeText(discussion.marketTitle)
    return normalizedTitle.includes(normalizedMarketTitle) || normalizedMarketTitle.includes(normalizedTitle)
  }).slice(0, limit)
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
function PulseDot({ color = 'emerald' }: { color?: 'emerald' | 'rose' }) {
  const colorClasses = {
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
  }
  return (
    <span className="relative flex h-2 w-2">
      <span className={`animate-ping absolute inline-flex h-full w-full ${colorClasses[color]} opacity-75`} />
      <span className={`relative inline-flex h-2 w-2 ${colorClasses[color]}`} />
    </span>
  )
}


type Props = {
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
  isLoadingMarkets?: boolean
}

export default function LandingPage({ markets, dispatch, isLoadingMarkets: _isLoadingMarkets }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [initialSide, setInitialSide] = useState<Side>('LONG')
  const [initialSats, setInitialSats] = useState('150')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // State for real discussions from Nostr
  const [discussions, setDiscussions] = useState<SampleDiscussion[]>([])
  const [discussionsLoading, setDiscussionsLoading] = useState(false)

  // Filter archived markets — only show active/resolved
  const entries = Object.values(markets).filter(e => e.market.status !== 'archived')

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

  // Fetch real discussions from Nostr for hot debate markets
  useEffect(() => {
    if (!hotDebates || hotDebates.length === 0) return

    let cancelled = false
    setDiscussionsLoading(true)

    async function loadDiscussions() {
      try {
        const allDiscussions: SampleDiscussion[] = []

        // Fetch discussions for each hot debate market (limit to 5 for performance)
        const marketsToFetch = hotDebates.slice(0, 5)

        for (const entry of marketsToFetch) {
          const marketEventId = entry.market.eventId
          if (!marketEventId) continue

          try {
            const events = await fetchMarketPosts(marketEventId, 20)

            for (const event of events) {
              // Get root posts only (not replies)
              const tags = event.tags
              const hasReplyMarker = tags.some(
                tag => tag[0] === 'e' && tag[3] === 'reply'
              )
              if (hasReplyMarker) continue

              // Count replies to this post
              const replyCount = events.filter(
                e => e.tags.some(
                  tag => tag[0] === 'e' && tag[1] === event.id && tag[3] === 'reply'
                )
              ).length

              // Resolve author name
              const authorInfo = await resolveAuthorName(event.pubkey)
              const author = authorInfo.name ?? authorInfo.npub.slice(0, 16)

              // Extract stance from tags
              const stanceTag = tags.find(tag => tag[0] === 'stance')
              const stance = stanceTag?.[1] === 'bull' ? 'LONG' :
                            stanceTag?.[1] === 'bear' ? 'SHORT' : null

              // Extract preview from content
              const content = event.content || ''
              const preview = content.length > 150 ? content.slice(0, 150) + '...' : content

              if (!cancelled) {
                allDiscussions.push({
                  id: event.id ?? `temp-${allDiscussions.length}`,
                  marketTitle: entry.market.title,
                  author,
                  preview,
                  replyCount,
                  stance: stance ?? 'LONG',
                  timestamp: formatTimeAgo((event.created_at ?? 0) * 1000),
                })
              }
            }
          } catch (err) {
            console.warn('Failed to fetch discussions for market:', entry.market.title, err)
          }
        }

        if (!cancelled) {
          // Sort by most recent (alphabetically for now since timestamps are strings)
          allDiscussions.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
          setDiscussions(allDiscussions)
        }
      } catch (err) {
        console.warn('Failed to load discussions:', err)
      } finally {
        if (!cancelled) {
          setDiscussionsLoading(false)
        }
      }
    }

    loadDiscussions()

    return () => {
      cancelled = true
    }
  }, [hotDebates])

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
      creatorPubkey: 'you',
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
      creatorPubkey: 'system',
    })
    setShowCreateModal(false)
  }

  function navigateToMarket(entry: MarketEntry) {
    navigate(`/market/${entry.market.slug}`)
  }

  function navigateFromHomepage(source: 'featured_thesis' | 'most_disputed_market' | 'latest_market', entry: MarketEntry) {
    trackHomepageEngagement(source, 'market', entry.market.slug)
    navigateToMarket(entry)
  }

  function openHomepageDiscussion(
    source: 'most_disputed_discussion' | 'latest_discussion',
    discussion: SampleDiscussion,
  ) {
    const matchingEntry = Object.values(markets).find((entry) => entry.market.title === discussion.marketTitle)
    const spec = sampleMarketBank.find((market) => market.title === discussion.marketTitle)

    if (matchingEntry) {
      trackHomepageEngagement(source, 'discussion', matchingEntry.market.slug)
      navigate(`/market/${matchingEntry.market.slug}/discuss`)
      return
    }

    if (!spec) {
      return
    }

    const marketId = `discussion-${discussion.id}`
    trackHomepageEngagement(source, 'discussion', marketId)
    dispatch({
      type: 'CREATE_MARKET',
      id: marketId,
      title: spec.title,
      description: spec.description,
      seedWithUser: false,
      creatorPubkey: 'system',
    })
    setTimeout(() => navigate(`/market/${marketId}/discuss`), 0)
  }

  const featuredThesis = sampleTheses[0]
  const featuredProbability = 0.67

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

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO — Provocative statement + Featured Market
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative min-h-[80vh] flex flex-col">
        <div className="absolute inset-0 bg-neutral-950" />

        <div className="relative z-10 flex-1 flex items-center">
          <div className="max-w-7xl mx-auto w-full px-6 py-16">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
              <div className="space-y-8">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
                  The Market Thinks You're Wrong
                </h1>
                <p className="text-xl md:text-2xl text-neutral-400 max-w-lg leading-relaxed">
                  Prove it. Take a position.
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-4">
                  <Link
                    to="/join"
                    onClick={() => trackHomepageEngagement('hero_primary_cta', 'join')}
                    className="px-8 py-4 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 transition-colors text-lg"
                  >
                    Start Trading
                  </Link>
                  <Link
                    to="/join"
                    onClick={() => {
                      trackHomepageEngagement('hero_agent_cta', 'join')
                      setTimeout(() => document.querySelector<HTMLButtonElement>('[data-agent-btn]')?.click(), 100)
                    }}
                    className="text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
                  >
                    For agents →
                  </Link>
                </div>
              </div>

              {/* Right — Featured thesis as raw typography, not a card */}
              <div className="space-y-6">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-[0.2em]">
                  Featured Thesis
                </span>
                <h2
                  className="text-3xl md:text-4xl font-bold text-white leading-snug cursor-pointer hover:text-emerald-400 transition-colors"
                  onClick={() => {
                    const existingEntry = Object.values(markets).find(
                      e => e.market.title === featuredThesis.title
                    )
                    if (existingEntry) {
                      navigateFromHomepage('featured_thesis', existingEntry)
                    } else {
                      const slug = `${featuredThesis.type}-${featuredThesis.title
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, '')
                        .trim()
                        .replace(/\s+/g, '-')
                        .replace(/-+/g, '-')}`
                      trackHomepageEngagement('featured_thesis', 'market', slug)
                      dispatch({
                        type: 'CREATE_MARKET',
                        id: slug,
                        title: featuredThesis.title,
                        description: featuredThesis.description,
                        seedWithUser: false,
                        creatorPubkey: 'system',
                      })
                    }
                  }}
                >
                  {featuredThesis.title}
                </h2>
                <div className="flex items-baseline gap-4">
                  <span className="text-6xl font-black text-emerald-500 tabular-nums">
                    {Math.round(featuredProbability * 100)}¢
                  </span>
                  <span className="text-lg text-emerald-500/70">YES</span>
                  <span className="text-sm text-emerald-500">+12% today</span>
                  <Sparkline data={[45, 48, 52, 55, 58, 62, 67]} positive={true} size="large" />
                </div>
                <div className="flex gap-8 text-sm text-neutral-500">
                  <span>$24.5K vol</span>
                  <span>312 traders</span>
                  <span>89 comments</span>
                  <span className="flex items-center gap-1.5"><PulseDot color="emerald" /> 47 active</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          LIVE TRADES TICKER
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="border-y border-neutral-800/50 bg-neutral-950">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0">
            <PulseDot color="emerald" />
            <span className="text-xs text-neutral-500 uppercase tracking-wider font-medium">Live</span>
          </div>
          <div className="overflow-hidden text-sm text-neutral-400" />
        </div>
      </div>

      {/* Markets appear as they stream in from Nostr */}

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: TRENDING MARKETS — Sidebar layout
          Dominant featured item left, compact ranked list right
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16">
        <div className="flex items-baseline gap-4 mb-10">
          <h2 className="text-3xl font-black text-white tracking-tight">Trending</h2>
          <span className="text-sm text-neutral-600">Most volume · 24h</span>
        </div>

        <div className="grid lg:grid-cols-12 gap-0">
          {/* Left — Dominant market */}
          <div className="lg:col-span-5 lg:pr-12 lg:border-r border-neutral-800/50 pb-8 lg:pb-0">
            {(() => {
              if (useTrending && useTrending[0]) {
                const entry = useTrending[0]
                const metrics = deriveMarketMetrics(entry.market)
                return (
                  <div
                    className="cursor-pointer group"
                    onClick={() => navigateToMarket(entry)}
                  >
                    <span className="text-xs text-emerald-500 uppercase tracking-[0.15em] font-medium">#1 by volume</span>
                    <h3 className="text-2xl md:text-3xl font-bold text-white mt-2 mb-4 group-hover:text-emerald-400 transition-colors leading-snug">
                      {entry.market.title}
                    </h3>
                    <div className="flex items-baseline gap-3 mb-3">
                      <span className="text-5xl font-black text-emerald-500 tabular-nums">
                        {Math.round(metrics.longPositionShare * 100)}¢
                      </span>
                      <Sparkline
                        data={[35, 38, 42, 40, 45, Math.round(metrics.longPositionShare * 100)]}
                        positive={metrics.longPositionShare > 0.4}
                        size="large"
                      />
                    </div>
                    <div className="flex gap-6 text-sm text-neutral-500">
                      <span>{formatCurrency(entry.market.reserve)} vol</span>
                      <span>{entry.market.quotes.length} trades</span>
                    </div>
                  </div>
                )
              }
              // Fallback sample
              const item = trendingSample[0]
              return (
                <div className="cursor-pointer group">
                  <span className="text-xs text-emerald-500 uppercase tracking-[0.15em] font-medium">#1 by volume</span>
                  <h3 className="text-2xl md:text-3xl font-bold text-white mt-2 mb-4 group-hover:text-emerald-400 transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <div className="flex items-baseline gap-3 mb-3">
                    <span className="text-5xl font-black text-emerald-500 tabular-nums">
                      {Math.round(item.prob * 100)}¢
                    </span>
                    <span className={`text-sm ${item.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {item.change >= 0 ? '+' : ''}{Math.round(item.change * 100)}%
                    </span>
                    <Sparkline data={[30, 32, 35, 38, 40, 42]} positive={item.change >= 0} size="large" />
                  </div>
                  <div className="flex gap-6 text-sm text-neutral-500">
                    <span>{item.volume} vol</span>
                    <span>{item.trades} trades</span>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Right — Compact ranked list */}
          <div className="lg:col-span-7 lg:pl-12">
            <div className="space-y-0">
              {(useTrending ? useTrending.slice(1) : trendingSample.slice(1)).map((item, i) => {
                const isReal = useTrending && 'market' in item
                const entry = item as MarketEntry
                const sample = item as typeof trendingSample[0]
                const marketTitle = isReal ? entry.market.title : sample.title
                const prob = isReal ? deriveMarketMetrics(entry.market).longPositionShare : sample.prob
                const change = isReal ? 0.05 : sample.change
                const vol = isReal ? formatCurrency(entry.market.reserve) : sample.volume

                return (
                  <div
                    key={marketTitle}
                    className="flex items-center gap-4 py-3 border-b border-neutral-800/30 last:border-0 cursor-pointer hover:bg-neutral-900/30 -mx-2 px-2 transition-colors"
                    onClick={() => isReal ? navigateToMarket(entry) : undefined}
                  >
                    <span className="text-2xl font-black text-neutral-700 w-8 tabular-nums">{i + 2}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-white truncate block">{marketTitle}</span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <Sparkline
                        data={[30 + i * 3, 32 + i * 2, 35 + i, 38, 40 - i, Math.round(prob * 100)]}
                        positive={change >= 0}
                      />
                      <span className="text-sm font-mono font-bold text-white w-12 text-right tabular-nums">
                        {Math.round(prob * 100)}¢
                      </span>
                      <span className={`text-xs font-mono w-12 text-right tabular-nums ${change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {change >= 0 ? '▲' : '▼'}{Math.abs(Math.round(change * 100))}%
                      </span>
                      <span className="text-xs text-neutral-600 w-16 text-right hidden sm:block">{vol}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: UNDER-THE-RADAR MARKETS — Bloomberg data-table style
          Rows with columns, alternating shading, monospace numbers
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-900/40 border-y border-neutral-800/30">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-baseline justify-between mb-8">
            <div className="flex items-baseline gap-4">
              <h2 className="text-3xl font-black text-white tracking-tight">Low Volume</h2>
              <span className="text-sm text-neutral-600">Smaller markets with lower volume and less attention.</span>
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
              <div className="col-span-2 text-right font-mono font-bold text-neutral-200 tabular-nums">
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
          SECTION 3: MARKETS IN DISPUTE — split view with market moves and discussion context
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end mb-10 border-b border-neutral-800/40 pb-6">
          <div className="flex items-baseline gap-4">
            <h2 className="text-3xl font-black text-white tracking-tight">Most Disputed</h2>
            <span className="text-sm text-neutral-600">Markets where the odds are close and opinion is split.</span>
          </div>
          <p className="text-sm text-neutral-500 leading-relaxed lg:text-right">
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:gap-12">
          {(() => {
            if (!useHotDebates) return null

            const debates = useHotDebates.map(entry => {
                  const metrics = deriveMarketMetrics(entry.market)
                  const yes = Math.round(metrics.longPositionShare * 100)
                  const discussionContext = getRelatedDiscussions(discussions, entry.market.title)
                  return {
                    title: entry.market.title,
                    yes,
                    traders: entry.market.quotes.length,
                    comments: Math.floor(entry.market.quotes.length * 1.5),
                    spread: Math.abs(yes - 50),
                    volume: formatCurrency(entry.market.reserve * 0.3),
                    marketCap: formatCurrency(entry.market.reserve),
                    chart: [
                      Math.max(1, yes - 9),
                      Math.max(1, yes - 5),
                      Math.max(1, yes - 2),
                      Math.min(99, yes + 3),
                      Math.max(1, yes - 1),
                      yes,
                    ],
                    discussionContext,
                    entry,
                  }
                })

            return (
              <>
                <div>
                  <div className="grid grid-cols-[minmax(0,1.4fr)_88px_76px_72px_88px] gap-3 pb-3 text-[10px] uppercase tracking-[0.18em] text-neutral-600 border-b border-neutral-800/40">
                    <div>Market</div>
                    <div className="text-right">Trend</div>
                    <div className="text-right">Yes</div>
                    <div className="text-right">Spread</div>
                    <div className="text-right hidden sm:block">Volume</div>
                  </div>

                  {debates.map((debate) => {
                    const no = 100 - debate.yes

                    return (
                      <button
                        key={debate.title}
                        type="button"
                        className="grid w-full grid-cols-[minmax(0,1.4fr)_88px_76px_72px_88px] gap-3 py-4 text-left border-b border-neutral-800/20 last:border-0 hover:bg-neutral-900/30 transition-colors"
                        onClick={() => navigateFromHomepage('most_disputed_market', debate.entry)}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] uppercase tracking-[0.18em] text-neutral-600">
                              {debate.comments} posts
                            </span>
                            {debate.spread <= 5 && (
                              <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-500">
                                Tight spread
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-white leading-snug">
                            {debate.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 text-xs text-neutral-500">
                            <span>{debate.traders} traders</span>
                            <span>{debate.marketCap} market cap</span>
                            <span className="text-neutral-400">NO {no}%</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-end">
                          <Sparkline data={debate.chart} positive={debate.yes >= no} />
                        </div>

                        <div className="text-right font-mono text-sm font-bold text-white tabular-nums">
                          {debate.yes}%
                        </div>

                        <div className="text-right font-mono text-xs text-neutral-500 tabular-nums pt-0.5">
                          {debate.spread}pt
                        </div>

                        <div className="text-right font-mono text-xs text-neutral-500 tabular-nums pt-0.5 hidden sm:block">
                          {debate.volume}
                        </div>
                      </button>
                    )
                  })}
                </div>

                <aside className="border-t border-neutral-800/30 pt-6 lg:border-t-0 lg:border-l lg:border-neutral-800/30 lg:pt-0 lg:pl-8">
                  <div className="flex items-center gap-2 mb-5">
                    <PulseDot color="emerald" />
                    <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400">
                      Recent Discussion
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {debates.map((debate) => (
                      <div key={`${debate.title}-discussion`} className="border-b border-neutral-800/20 pb-5 last:border-0 last:pb-0">
                        <button
                          type="button"
                          className="text-left w-full"
                          onClick={() => navigateFromHomepage('most_disputed_market', debate.entry)}
                        >
                          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-600 mb-2">
                            {debate.spread}pt spread
                          </div>
                          <div className="text-sm font-semibold text-white leading-snug mb-3">
                            {debate.title}
                          </div>
                        </button>

                        <div className="space-y-3">
                          {discussionsLoading ? (
                            <div className="text-sm text-neutral-500 leading-relaxed">
                              Loading discussions...
                            </div>
                          ) : debate.discussionContext.length > 0 ? debate.discussionContext.map((discussion) => (
                            <button
                              key={discussion.id}
                              type="button"
                              className="block w-full text-left"
                              onClick={() => openHomepageDiscussion('most_disputed_discussion', discussion)}
                            >
                              <div className="text-sm text-neutral-300 leading-relaxed">
                                {discussion.preview}
                              </div>
                              <div className="mt-1 text-[11px] text-neutral-600">
                                @{discussion.author} · {discussion.timestamp} · {discussion.replyCount} replies
                              </div>
                            </button>
                          )) : (
                            <div className="text-sm text-neutral-500 leading-relaxed">
                              No discussion yet.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </aside>
              </>
            )
          })()}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: NEW THIS WEEK — Asymmetric magazine layout
          3-column grid, varied density, full-bleed gradient background
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-neutral-950" />

        <div className="relative z-10 max-w-7xl mx-auto px-6 py-16">
          <div className="flex items-baseline gap-4 mb-12">
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
              <div className="grid lg:grid-cols-3 gap-10 lg:gap-12">
                {/* Column 1 — Featured large item + smaller item below */}
                <div className="space-y-8">
                  {featured && (
                    <div
                      className="cursor-pointer group"
                      onClick={() =>
                        featured.entry ? navigateFromHomepage('latest_market', featured.entry) : undefined
                      }
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
                      className="pt-8 border-t border-neutral-800/30 cursor-pointer group"
                      onClick={() =>
                        subFeatured.entry ? navigateFromHomepage('latest_market', subFeatured.entry) : undefined
                      }
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
                      className="py-5 border-b border-neutral-800/20 last:border-0 cursor-pointer group"
                      onClick={() => item.entry ? navigateFromHomepage('latest_market', item.entry) : undefined}
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
                      onClick={() => item.entry ? navigateFromHomepage('latest_market', item.entry) : undefined}
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
          LATEST DISCUSSIONS — Discussion feed (text-only, Reddit-style)
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="bg-neutral-900/20 border-t border-neutral-800/30">
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_260px] md:items-end mb-8 border-b border-neutral-800/30 pb-5">
            <div className="flex items-center gap-3">
              <PulseDot color="emerald" />
              <h2 className="text-3xl font-black text-white tracking-tight">Latest Discussions</h2>
            </div>
            <p className="text-sm text-neutral-500 leading-relaxed md:text-right">
              Recent posts and replies across the markets.
            </p>
          </div>

          <div className="max-w-4xl space-y-0">
            {discussionsLoading ? (
              <div className="text-sm text-neutral-600 py-4">Syncing discussions...</div>
            ) : (
              (discussions.length > 0 ? discussions : sampleDiscussions).map(discussion => {
              const matchingEntry = Object.values(markets).find(
                e => e.market.title === discussion.marketTitle
              )
              const spec = sampleMarketBank.find(s => s.title === discussion.marketTitle)

              const handleClick = () => {
                if (matchingEntry || spec) {
                  openHomepageDiscussion('latest_discussion', discussion)
                }
              }

              return (
                <button
                  key={discussion.id}
                  type="button"
                  onClick={handleClick}
                  className="block w-full text-left py-4 hover:bg-neutral-800/20 -mx-2 px-2 transition-colors cursor-pointer border-b border-neutral-800/20 last:border-0"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-600 mb-2">
                        {discussion.marketTitle}
                      </div>
                      <div className="text-sm text-white leading-relaxed">{discussion.preview}</div>
                    </div>
                    <div className="hidden sm:block text-right shrink-0">
                      <div className="text-xs text-neutral-400">@{discussion.author}</div>
                      <div className="text-[11px] text-neutral-600 mt-1">{discussion.timestamp}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-neutral-600 mt-2">
                    <span>@{discussion.author}</span>
                    <span className="sm:hidden">·</span>
                    <span className="sm:hidden">{discussion.timestamp}</span>
                    <span>·</span>
                    <span>{discussion.replyCount} replies</span>
                    {discussion.replyCount > 15 && <span>active</span>}
                  </div>
                </button>
              )
            }))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DIFFERENTIATOR — Why Contrarian Markets is different
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-6 py-20 border-t border-neutral-800/30">
        <div className="grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
              Not another
              <span className="block text-neutral-600">prediction market.</span>
            </h2>
            <p className="text-lg text-neutral-400 leading-relaxed">
              Traditional markets resolve to YES or NO. Contrarian trades on evolving truth —
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
              <div className="text-4xl font-bold text-neutral-400">◆</div>
              <h3 className="text-lg font-semibold text-white">Modular theses</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">
                Stack predictions. Your thesis on AI depends on AGI timing and labor economics.
              </p>
            </div>
          </div>
        </div>
      </section>

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
              className="px-8 py-4 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 transition-colors text-lg"
            >
              Create market
            </button>
            <Link
              to="/builder"
              className="px-8 py-4 border border-neutral-700 text-white font-medium hover:border-neutral-500 transition-colors text-lg"
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
            className="w-full max-w-lg p-6 bg-neutral-900 border border-neutral-800 shadow-2xl"
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
                  className="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-600 transition-all"
                />
              </label>
              <label className="block">
                <span className="text-sm text-neutral-400">Description</span>
                <textarea
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Define the resolution criteria clearly."
                  className="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-600 transition-all resize-y min-h-[88px]"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm text-neutral-400">Side</span>
                  <select
                    value={initialSide}
                    onChange={event => setInitialSide(event.target.value as Side)}
                    className="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white focus:outline-none focus:border-emerald-600 transition-all"
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
                    className="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white focus:outline-none focus:border-emerald-600 transition-all"
                  />
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 px-4 py-3 bg-white text-neutral-950 font-medium hover:bg-neutral-100"
                  type="submit"
                >
                  Create market
                </button>
                <button
                  className="px-4 py-3 border border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:text-white"
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
