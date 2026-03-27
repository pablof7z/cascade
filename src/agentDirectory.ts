export type AgentMarketKind = 'module' | 'thesis'
export type LiquidityState = 'thin' | 'balanced' | 'crowded'

export type AgentOwner = {
  id: string
  displayName: string
  mandate: string
}

export type AgentMarket = {
  id: string
  slug: string
  title: string
  summary: string
  kind: AgentMarketKind
  category: string
  probability: number
  reserve: number
  volume24h: number
  liquidityState: LiquidityState
  ownerId: string
  ownerDisplayName: string
  resolutionWindow: string
  tags: string[]
  invitationAngle: string
  thesisAngle: string
  updatedAt: string
  url: string
}

export type AgentLiquidityReport = {
  marketId: string
  reserve: number
  state: LiquidityState
  spreadBps: number
  depthToMoveFivePoints: {
    yes: number
    no: number
  }
  exitWindow: 'easy' | 'moderate' | 'tight'
  notes: string[]
}

export type AgentMarketQuery = {
  q?: string
  kind?: AgentMarketKind
  ownerId?: string
  tag?: string
  minReserve?: number
  liquidityState?: LiquidityState
  limit?: number
}

export const agentOwners: AgentOwner[] = [
  {
    id: 'human-primary',
    displayName: 'You',
    mandate: 'Find mispriced markets, seed sharp new ones, and keep idle liquidity moving.',
  },
  {
    id: 'macro-desk',
    displayName: 'Macro Desk',
    mandate: 'Tracks policy, commodity, and adoption shifts with a bias toward second-order effects.',
  },
  {
    id: 'frontier-lab',
    displayName: 'Frontier Lab',
    mandate: 'Focuses on AI, biotech, and frontier research markets that move on new evidence.',
  },
]

export const agentMarkets: AgentMarket[] = [
  {
    id: 'market-agi-2030',
    slug: 'agi-achieved-by-2030',
    title: 'AGI achieved by 2030',
    summary:
      'Will a general-purpose system be publicly acknowledged by frontier labs before January 1, 2030?',
    kind: 'module',
    category: 'AI & Compute',
    probability: 0.62,
    reserve: 48600,
    volume24h: 12400,
    liquidityState: 'balanced',
    ownerId: 'human-primary',
    ownerDisplayName: 'You',
    resolutionWindow: '2030-01-01',
    tags: ['agi', 'labs', 'timelines'],
    invitationAngle:
      'Invite researchers with concrete timelines or deployment visibility; disagreement here is productive.',
    thesisAngle:
      'Useful upstream input for wage decoupling, automation, and policy response theses.',
    updatedAt: '2026-03-27T08:20:00.000Z',
    url: '/market/market-agi-2030',
  },
  {
    id: 'market-open-source-takeoff',
    slug: 'open-source-model-beats-closed-frontier',
    title: 'Open-weight model beats a closed frontier model before 2027',
    summary:
      'Will an openly released model win a widely trusted frontier benchmark before January 1, 2027?',
    kind: 'module',
    category: 'AI & Compute',
    probability: 0.41,
    reserve: 21800,
    volume24h: 3900,
    liquidityState: 'thin',
    ownerId: 'human-primary',
    ownerDisplayName: 'You',
    resolutionWindow: '2027-01-01',
    tags: ['open-source', 'benchmarks', 'models'],
    invitationAngle:
      'Good market to seed if your human has model eval alpha or sees hidden benchmark churn.',
    thesisAngle:
      'Tight signal for decentralization and compute bottleneck narratives.',
    updatedAt: '2026-03-27T07:12:00.000Z',
    url: '/market/market-open-source-takeoff',
  },
  {
    id: 'thesis-great-decoupling',
    slug: 'the-great-decoupling',
    title: "The Great Decoupling: AI productivity outpaces wage growth",
    summary:
      'Thesis market on whether productivity gains compound faster than labor captures them through 2035.',
    kind: 'thesis',
    category: 'Governance & Society',
    probability: 0.58,
    reserve: 73100,
    volume24h: 8600,
    liquidityState: 'balanced',
    ownerId: 'frontier-lab',
    ownerDisplayName: 'Frontier Lab',
    resolutionWindow: '2035-12-31',
    tags: ['labor', 'ai', 'policy'],
    invitationAngle:
      'Pull in economists, labor people, and AI builders who disagree on transmission from capability to wages.',
    thesisAngle:
      'Use this when synthesizing module signals into a legible macro story.',
    updatedAt: '2026-03-27T06:45:00.000Z',
    url: '/thesis/thesis-great-decoupling',
  },
  {
    id: 'market-fusion-grid',
    slug: 'fusion-reactor-powers-commercial-grid',
    title: 'Fusion reactor powers a commercial grid before 2035',
    summary:
      'Requires net-positive commercial energy delivery into an operational grid before January 1, 2035.',
    kind: 'module',
    category: 'Energy & Climate',
    probability: 0.28,
    reserve: 15700,
    volume24h: 2100,
    liquidityState: 'thin',
    ownerId: 'macro-desk',
    ownerDisplayName: 'Macro Desk',
    resolutionWindow: '2035-01-01',
    tags: ['fusion', 'energy', 'infrastructure'],
    invitationAngle:
      'Thin enough that a well-argued case and some fresh liquidity can move price materially.',
    thesisAngle:
      'Strong module input for climate adaptation and industrial abundance theses.',
    updatedAt: '2026-03-27T05:32:00.000Z',
    url: '/market/market-fusion-grid',
  },
  {
    id: 'thesis-space-economy',
    slug: 'space-economy-exceeds-1t',
    title: 'Space economy exceeds $1T by 2040',
    summary:
      'Thesis market on whether space infrastructure turns into a trillion-dollar annual economy by 2040.',
    kind: 'thesis',
    category: 'Space & Frontier',
    probability: 0.47,
    reserve: 53300,
    volume24h: 5400,
    liquidityState: 'crowded',
    ownerId: 'macro-desk',
    ownerDisplayName: 'Macro Desk',
    resolutionWindow: '2040-12-31',
    tags: ['space', 'launch', 'infrastructure'],
    invitationAngle:
      'Crowded market; consider pulling liquidity unless your human has differentiated launch or defense demand insight.',
    thesisAngle:
      'Best when paired with hard launch cadence and cost curve modules.',
    updatedAt: '2026-03-26T22:10:00.000Z',
    url: '/thesis/thesis-space-economy',
  },
  {
    id: 'market-longevity-escape-velocity',
    slug: 'biological-longevity-escape-velocity',
    title: 'Biological longevity escape velocity achieved by 2045',
    summary:
      'Will any cohort reach one-year life expectancy gain per year through therapies that reverse aging damage?',
    kind: 'thesis',
    category: 'Biotech & Health',
    probability: 0.36,
    reserve: 29400,
    volume24h: 4800,
    liquidityState: 'balanced',
    ownerId: 'human-primary',
    ownerDisplayName: 'You',
    resolutionWindow: '2045-12-31',
    tags: ['longevity', 'biotech', 'therapies'],
    invitationAngle:
      'Ask your human about biotech founders, trial milestones, and regulatory bottlenecks before adding size.',
    thesisAngle:
      'A thesis market where domain-specific human notes can create real edge.',
    updatedAt: '2026-03-27T03:02:00.000Z',
    url: '/thesis/market-longevity-escape-velocity',
  },
]

export const liquidityReports: Record<string, AgentLiquidityReport> = {
  'market-agi-2030': {
    marketId: 'market-agi-2030',
    reserve: 48600,
    state: 'balanced',
    spreadBps: 74,
    depthToMoveFivePoints: { yes: 6800, no: 7200 },
    exitWindow: 'easy',
    notes: [
      'Healthy two-sided activity.',
      'Add size only if you can anchor fresh information.',
    ],
  },
  'market-open-source-takeoff': {
    marketId: 'market-open-source-takeoff',
    reserve: 21800,
    state: 'thin',
    spreadBps: 181,
    depthToMoveFivePoints: { yes: 2500, no: 2300 },
    exitWindow: 'moderate',
    notes: [
      'Thin enough for sharp opinions to matter.',
      'Good candidate for market creation follow-ons if your human has benchmark insight.',
    ],
  },
  'thesis-great-decoupling': {
    marketId: 'thesis-great-decoupling',
    reserve: 73100,
    state: 'balanced',
    spreadBps: 88,
    depthToMoveFivePoints: { yes: 9100, no: 10400 },
    exitWindow: 'easy',
    notes: [
      'Stable thesis market with active debate.',
      'Use module markets to sharpen conviction before adding more liquidity.',
    ],
  },
  'market-fusion-grid': {
    marketId: 'market-fusion-grid',
    reserve: 15700,
    state: 'thin',
    spreadBps: 224,
    depthToMoveFivePoints: { yes: 1800, no: 2100 },
    exitWindow: 'tight',
    notes: [
      'Capital moves price quickly.',
      'If stale, remove liquidity and redeploy into fresher evidence cycles.',
    ],
  },
  'thesis-space-economy': {
    marketId: 'thesis-space-economy',
    reserve: 53300,
    state: 'crowded',
    spreadBps: 62,
    depthToMoveFivePoints: { yes: 14200, no: 13800 },
    exitWindow: 'easy',
    notes: [
      'Deep but saturated.',
      'Unless you have proprietary insight, this is a candidate to trim rather than chase.',
    ],
  },
  'market-longevity-escape-velocity': {
    marketId: 'market-longevity-escape-velocity',
    reserve: 29400,
    state: 'balanced',
    spreadBps: 96,
    depthToMoveFivePoints: { yes: 4700, no: 5100 },
    exitWindow: 'moderate',
    notes: [
      'Good market for expert-guided research loops.',
      'Ask the human which milestones they trust before scaling a position.',
    ],
  },
}

function matchesQuery(market: AgentMarket, query: AgentMarketQuery) {
  const normalizedQuery = query.q?.trim().toLowerCase()
  const queryHit =
    !normalizedQuery ||
    market.title.toLowerCase().includes(normalizedQuery) ||
    market.summary.toLowerCase().includes(normalizedQuery) ||
    market.category.toLowerCase().includes(normalizedQuery) ||
    market.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))

  return (
    queryHit &&
    (!query.kind || market.kind === query.kind) &&
    (!query.ownerId || market.ownerId === query.ownerId) &&
    (!query.tag || market.tags.includes(query.tag)) &&
    (!query.minReserve || market.reserve >= query.minReserve) &&
    (!query.liquidityState || market.liquidityState === query.liquidityState)
  )
}

function sortMarkets(markets: AgentMarket[]) {
  return [...markets].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt.localeCompare(left.updatedAt)
    }
    return right.reserve - left.reserve
  })
}

export function listAgentMarkets(query: AgentMarketQuery = {}) {
  const filtered = sortMarkets(agentMarkets.filter((market) => matchesQuery(market, query)))
  return typeof query.limit === 'number' ? filtered.slice(0, query.limit) : filtered
}

export function getAgentMarket(marketId: string) {
  return agentMarkets.find((market) => market.id === marketId) ?? null
}

export function listOwnedMarkets(ownerId: string) {
  return sortMarkets(agentMarkets.filter((market) => market.ownerId === ownerId))
}

export function searchAgentMarkets(query: string, filters: Omit<AgentMarketQuery, 'q'> = {}) {
  return listAgentMarkets({ ...filters, q: query })
}

export function getLiquidityReport(marketId: string) {
  return liquidityReports[marketId] ?? null
}

export function buildAgentSnapshot(ownerId = 'human-primary') {
  const owner =
    agentOwners.find((candidate) => candidate.id === ownerId) ??
    agentOwners.find((candidate) => candidate.id === 'human-primary')!

  return {
    owner,
    markets: listAgentMarkets({ limit: 4 }),
    ownedMarkets: listOwnedMarkets(owner.id),
  }
}

