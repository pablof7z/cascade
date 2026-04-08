export const STARTING_BANKROLL = 1000
const DEFAULT_SENSITIVITY = 0.0001
const MAX_LEDGER_ITEMS = 16
const MAX_EVENTS = 20

// Legacy actor constants for backward compatibility with crowd simulation
export const ACTORS = ['you', 'alice', 'bob', 'carol'] as const
export const CROWD_ACTORS = ['alice', 'bob', 'carol'] as const

export type ActorId = (typeof ACTORS)[number]
export type CrowdActorId = (typeof CROWD_ACTORS)[number]
export type Side = 'LONG' | 'SHORT'
export type TradeKind = 'BUY' | 'REDEEM'
export type MarketKind = 'module' | 'thesis'
export type ThesisSignalOutcome = 'YES' | 'NO'
export type SyntheticActivity =
  | 'BUY_LONG'
  | 'BUY_SHORT'
  | 'REDEEM_LONG'
  | 'REDEEM_SHORT'
export type MarketBias = 'NEUTRAL' | 'LONGS_FAVORED' | 'SHORTS_FAVORED'

// Legacy labels for backward compatibility
export const ACTOR_LABELS: Record<ActorId, string> = {
  you: 'You',
  alice: 'Alice',
  bob: 'Bob',
  carol: 'Carol',
}

// Simulated crowd pubkeys for backward compatibility
export const CROWD_PUBKEYS = {
  alice: 'sim_alice_00000000000000000000000000000000000000000000000000000001',
  bob: 'sim_bob_0000000000000000000000000000000000000000000000000000000002',
  carol: 'sim_carol_000000000000000000000000000000000000000000000000000003',
} as const

// Get display name for a pubkey (returns short form if unknown)
export function getActorDisplayName(pubkey: string): string {
  // Check if it's a legacy actor
  if (pubkey === 'you') return 'You'
  if (pubkey === CROWD_PUBKEYS.alice) return 'Alice'
  if (pubkey === CROWD_PUBKEYS.bob) return 'Bob'
  if (pubkey === CROWD_PUBKEYS.carol) return 'Carol'
  // For real pubkeys, async resolution is done in UI — return Anonymous as sync fallback
  return 'Anonymous'
}

export type ParticipantAccount = {
  cash: number
  long: number
  short: number
}

// ParticipantBook uses pubkey strings as keys (any pubkey, not just legacy ActorId)
export type ParticipantBook = Record<string, ParticipantAccount>

export type CashuQuote = {
  id: string
  kind: 'mint' | 'melt'
  actor: ActorId
  side: Side
  sats: number
  tokens: number
  createdAt: string
  status: 'PAID'
}

export type Proof = {
  id: string
  actor: ActorId
  side: Side
  quoteId: string
  mintedSats: number
  tokens: number
  remainingTokens: number
  createdAt: string
}

export type SpentProof = {
  id: string
  actor: ActorId
  side: Side
  sourceProofId: string
  tokens: number
  payoutSats: number
  createdAt: string
}

export type Receipt = {
  id: string
  kind: 'mint' | 'redeem'
  actor: ActorId
  side: Side
  sats: number
  tokens: number
  reserveBefore: number
  reserveAfter: number
  createdAt: string
}

export type MarketEvent = {
  id: string
  label: string
  detail: string
  createdAt: string
}

export type LastTrade = {
  id: string
  kind: 'BUY' | 'REDEEM'
  actor: ActorId
  side: Side
  sats: number
  tokens: number
  startPrice: number
  endPrice: number
  avgPrice: number
  reserveBefore: number
  reserveAfter: number
  pnlDelta: number
}

export type ThesisSignal = {
  moduleMarketId?: string
  moduleTitle: string
  expectedOutcome: ThesisSignalOutcome
  note: string
}

export type ThesisDefinition = {
  statement: string
  argument: string
  signals: ThesisSignal[]
}

export type Market = {
  eventId: string               // Nostr event ID — canonical identifier, used for routing/linking
  slug: string                  // d-tag value — human-readable SEO slug
  title: string
  description: string
  mint: string                  // Cashu mint URL
  image?: string                // Optional banner image URL
  kind?: MarketKind
  thesis?: ThesisDefinition
  b: number
  qLong: number
  qShort: number
  reserve: number
  participants: ParticipantBook
  quotes: CashuQuote[]
  proofs: Proof[]
  spentProofs: SpentProof[]
  receipts: Receipt[]
  events: MarketEvent[]
  lastTrade?: LastTrade
  creatorPubkey: string
  createdAt: number
  status: 'active' | 'resolved' | 'archived'  // Market lifecycle status
  deletedAt?: number            // When the market was archived
  resolutionOutcome?: 'YES' | 'NO'  // Set when status === 'resolved'
  resolvedAt?: number               // Unix timestamp of resolution
  endDate?: string              // ISO date string (YYYY-MM-DD) for time-bounded markets
}

export type ExecutionPreview = {
  sats: number
  tokens: number
  avgPrice: number
  startPrice: number
  endPrice: number
  reserveAfter: number
}

export type ExecutionResult = {
  market: Market
  detail: string
}

export type ActorMetrics = {
  cash: number
  long: number
  short: number
  liquidationValue: number
  totalValue: number
}

type CrowdFundingReason = 'LONG_CHASERS' | 'SHORT_CHASERS'

const CROWD_PROFILES = {
  alice: {
    takeProfit: 1.08,
    stopLoss: 0.95,
    aggression: 1.2,
    contrarian: 0.08,
  },
  bob: {
    takeProfit: 1.05,
    stopLoss: 0.97,
    aggression: 0.95,
    contrarian: 0.18,
  },
  carol: {
    takeProfit: 1.12,
    stopLoss: 0.93,
    aggression: 0.75,
    contrarian: 0.46,
  },
} satisfies Record<
  CrowdActorId,
  {
    takeProfit: number
    stopLoss: number
    aggression: number
    contrarian: number
  }
>

function makeId(prefix: string) {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}-${suffix}`
}

function stamp() {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function trim<T>(items: T[], max: number) {
  return items.slice(0, max)
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function logSumExp(a: number, b: number) {
  const max = Math.max(a, b)
  return max + Math.log(Math.exp(a - max) + Math.exp(b - max))
}

function emptyParticipants(): ParticipantBook {
  return {
    you: { cash: STARTING_BANKROLL, long: 0, short: 0 },
    alice: { cash: STARTING_BANKROLL, long: 0, short: 0 },
    bob: { cash: STARTING_BANKROLL, long: 0, short: 0 },
    carol: { cash: STARTING_BANKROLL, long: 0, short: 0 },
  }
}

function actorName(actor: ActorId) {
  return ACTOR_LABELS[actor]
}

function shuffledCrowdActors() {
  const actors = [...CROWD_ACTORS]
  for (let index = actors.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1))
    ;[actors[index], actors[swapIndex]] = [actors[swapIndex], actors[index]]
  }
  return actors
}

export function priceLong(qLong: number, qShort: number, b: number) {
  const exponent = clamp(b * (qShort - qLong), -60, 60)
  return 1 / (1 + Math.exp(exponent))
}

export function priceShort(qLong: number, qShort: number, b: number) {
  return 1 - priceLong(qLong, qShort, b)
}

export function costFunction(qLong: number, qShort: number, b: number) {
  return logSumExp(b * qLong, b * qShort) / b
}

export function computeOutcomePrice(market: Market): number {
  if (market.resolutionOutcome === 'YES') {
    return priceLong(market.qLong, market.qShort, market.b)
  } else {
    return priceShort(market.qLong, market.qShort, market.b)
  }
}

export function deductFromReserve(market: Market, amount: number): Market {
  return {
    ...market,
    reserve: Math.max(0, market.reserve - amount)
  }
}

export function deriveMarketMetrics(market: Market) {
  const longOdds = priceLong(market.qLong, market.qShort, market.b)
  const shortOdds = 1 - longOdds
  const totalOutstandingShares = market.qLong + market.qShort
  const longPositionShare = totalOutstandingShares > 0 ? market.qLong / totalOutstandingShares : 0.5
  const shortPositionShare =
    totalOutstandingShares > 0 ? market.qShort / totalOutstandingShares : 0.5
  const longCommitted = market.proofs.reduce((sum, proof) => {
    if (proof.side !== 'LONG' || proof.tokens <= 0) {
      return sum
    }
    return sum + proof.mintedSats * (proof.remainingTokens / proof.tokens)
  }, 0)
  const shortCommitted = market.proofs.reduce((sum, proof) => {
    if (proof.side !== 'SHORT' || proof.tokens <= 0) {
      return sum
    }
    return sum + proof.mintedSats * (proof.remainingTokens / proof.tokens)
  }, 0)
  const totalCommitted = longCommitted + shortCommitted
  const longCapital = totalCommitted > 0 ? longCommitted / totalCommitted : 0.5
  const shortCapital = totalCommitted > 0 ? shortCommitted / totalCommitted : 0.5

  return {
    longOdds,
    shortOdds,
    longPositionShare,
    shortPositionShare,
    longCommitted,
    shortCommitted,
    longCapital,
    shortCapital,
  }
}

export function deriveActorMetrics(market: Market, actor: ActorId): ActorMetrics {
  const account = market.participants[actor]
  const liquidationValue =
    costFunction(market.qLong, market.qShort, market.b) -
    costFunction(
      Math.max(0, market.qLong - account.long),
      Math.max(0, market.qShort - account.short),
      market.b,
    )

  return {
    cash: account.cash,
    long: account.long,
    short: account.short,
    liquidationValue,
    totalValue: account.cash + liquidationValue,
  }
}

export function createEmptyMarket(input: {
  slug?: string
  title: string
  description: string
  mint?: string
  image?: string
  kind?: MarketKind
  thesis?: ThesisDefinition
  creatorPubkey: string
  endDate?: string
}) {
  const kind = input.kind ?? (input.thesis ? 'thesis' : 'module')
  return {
    eventId: '',
    slug: input.slug ?? makeId('market'),
    title: input.title,
    description: input.description,
    mint: input.mint ?? 'https://mint.contrarian.markets',
    ...(input.image ? { image: input.image } : {}),
    kind,
    thesis:
      kind === 'thesis'
        ? input.thesis ?? {
            statement: input.title,
            argument: input.description,
            signals: [],
          }
        : undefined,
    b: DEFAULT_SENSITIVITY,
    qLong: 0,
    qShort: 0,
    reserve: 0,
    participants: emptyParticipants(),
    quotes: [],
    proofs: [],
    spentProofs: [],
    receipts: [],
    events: [],
    creatorPubkey: input.creatorPubkey,
    createdAt: Date.now(),
    status: 'active',
    ...(input.endDate ? { endDate: input.endDate } : {}),
  } satisfies Market
}

function solveBuyTokens(market: Market, side: Side, sats: number) {
  const currentCost = costFunction(market.qLong, market.qShort, market.b)
  const startPrice =
    side === 'LONG'
      ? priceLong(market.qLong, market.qShort, market.b)
      : priceShort(market.qLong, market.qShort, market.b)

  const deltaCost = (tokens: number) => {
    const nextLong = market.qLong + (side === 'LONG' ? tokens : 0)
    const nextShort = market.qShort + (side === 'SHORT' ? tokens : 0)
    return costFunction(nextLong, nextShort, market.b) - currentCost
  }

  let low = 0
  let high = Math.max(1, sats / Math.max(startPrice, 0.01))
  while (deltaCost(high) < sats && high < 1_000_000) {
    high *= 2
  }

  for (let index = 0; index < 70; index += 1) {
    const middle = (low + high) / 2
    if (deltaCost(middle) < sats) {
      low = middle
    } else {
      high = middle
    }
  }

  const tokens = high
  const spent = deltaCost(tokens)
  const nextLong = market.qLong + (side === 'LONG' ? tokens : 0)
  const nextShort = market.qShort + (side === 'SHORT' ? tokens : 0)
  const endPrice =
    side === 'LONG'
      ? priceLong(nextLong, nextShort, market.b)
      : priceShort(nextLong, nextShort, market.b)

  return {
    sats: spent,
    tokens,
    avgPrice: spent / tokens,
    startPrice,
    endPrice,
    reserveAfter: market.reserve + spent,
  }
}

function solveRedeemValue(market: Market, side: Side, tokens: number) {
  const startPrice =
    side === 'LONG'
      ? priceLong(market.qLong, market.qShort, market.b)
      : priceShort(market.qLong, market.qShort, market.b)
  const currentCost = costFunction(market.qLong, market.qShort, market.b)
  const nextLong = market.qLong - (side === 'LONG' ? tokens : 0)
  const nextShort = market.qShort - (side === 'SHORT' ? tokens : 0)

  if (nextLong < -0.000001 || nextShort < -0.000001) {
    return null
  }

  const payout =
    currentCost - costFunction(Math.max(0, nextLong), Math.max(0, nextShort), market.b)
  const endPrice =
    side === 'LONG'
      ? priceLong(Math.max(0, nextLong), Math.max(0, nextShort), market.b)
      : priceShort(Math.max(0, nextLong), Math.max(0, nextShort), market.b)

  return {
    sats: payout,
    tokens,
    avgPrice: payout / tokens,
    startPrice,
    endPrice,
    reserveAfter: market.reserve - payout,
  }
}

export function previewTrade(
  market: Market,
  actor: ActorId,
  kind: TradeKind,
  side: Side,
  amount: number,
): ExecutionPreview | null {
  if (!(amount > 0)) {
    return null
  }

  const account = market.participants[actor]

  if (kind === 'BUY') {
    if (amount > account.cash) {
      return null
    }
    return solveBuyTokens(market, side, amount)
  }

  const owned = side === 'LONG' ? account.long : account.short
  if (amount > owned) {
    return null
  }

  return solveRedeemValue(market, side, amount)
}

function createSnark(kind: 'BUY' | 'REDEEM', side: Side, move: number) {
  if (kind === 'BUY' && side === 'LONG' && move > 0.03) {
    return 'pushed LONG conviction hard enough to matter.'
  }
  if (kind === 'BUY' && side === 'SHORT' && move > 0.03) {
    return 'fed the bearish side a fresh block of ammo.'
  }
  if (kind === 'REDEEM' && side === 'LONG') {
    return 'peeled exposure off LONG.'
  }
  if (kind === 'REDEEM' && side === 'SHORT') {
    return 'cashed out a chunk of SHORT.'
  }
  return 'moved size and the curve noticed.'
}

function prependLedger<T>(items: T[], entry: T, max = MAX_LEDGER_ITEMS) {
  return trim([entry, ...items], max)
}

function prependEvents(items: MarketEvent[], entry: MarketEvent) {
  return trim([entry, ...items], MAX_EVENTS)
}

function injectCrowdCash(
  market: Market,
  actor: CrowdActorId,
  sats: number,
  reason: CrowdFundingReason,
) {
  if (!(sats > 0)) {
    return market
  }

  const label =
    reason === 'LONG_CHASERS'
      ? `Fresh LONG flow reached ${actorName(actor)}`
      : `Fresh SHORT flow reached ${actorName(actor)}`
  const detail =
    reason === 'LONG_CHASERS'
      ? `${actorName(actor)} picked up ${sats.toFixed(2)} fresh sats from late LONG chasers who want into the move.`
      : `${actorName(actor)} picked up ${sats.toFixed(2)} fresh sats from late SHORT chasers leaning harder into the downside move.`

  return {
    ...market,
    participants: {
      ...market.participants,
      [actor]: {
        ...market.participants[actor],
        cash: market.participants[actor].cash + sats,
      },
    },
    events: prependEvents(market.events, {
      id: makeId('event'),
      label,
      detail,
      createdAt: stamp(),
    }),
  } satisfies Market
}

function applyProofSpend(
  proofs: Proof[],
  actor: ActorId,
  side: Side,
  tokens: number,
  payoutSats: number,
) {
  const nextProofs = proofs.map((proof) => ({ ...proof }))
  const records: SpentProof[] = []
  let remaining = tokens

  for (let index = nextProofs.length - 1; index >= 0 && remaining > 0.000001; index -= 1) {
    const proof = nextProofs[index]
    if (proof.actor !== actor || proof.side !== side || proof.remainingTokens <= 0.000001) {
      continue
    }
    const spent = Math.min(proof.remainingTokens, remaining)
    proof.remainingTokens -= spent
    remaining -= spent
    records.unshift({
      id: makeId('spent'),
      actor,
      side,
      sourceProofId: proof.id,
      tokens: spent,
      payoutSats: payoutSats * (spent / tokens),
      createdAt: stamp(),
    })
  }

  if (remaining > 0.00001) {
    return null
  }

  return {
    proofs: nextProofs,
    spentProofs: records,
  }
}

export function applyBuy(
  market: Market,
  side: Side,
  sats: number,
  actor: ActorId,
): ExecutionResult | null {
  const account = market.participants[actor]
  if (sats > account.cash || sats <= 0) {
    return null
  }

  const preview = solveBuyTokens(market, side, sats)
  if (!(preview.tokens > 0)) {
    return null
  }

  const quote = {
    id: makeId('quote'),
    kind: 'mint',
    actor,
    side,
    sats: preview.sats,
    tokens: preview.tokens,
    createdAt: stamp(),
    status: 'PAID',
  } satisfies CashuQuote

  const proof = {
    id: makeId('proof'),
    actor,
    side,
    quoteId: quote.id,
    mintedSats: preview.sats,
    tokens: preview.tokens,
    remainingTokens: preview.tokens,
    createdAt: stamp(),
  } satisfies Proof

  const receipt = {
    id: makeId('receipt'),
    kind: 'mint',
    actor,
    side,
    sats: preview.sats,
    tokens: preview.tokens,
    reserveBefore: market.reserve,
    reserveAfter: preview.reserveAfter,
    createdAt: stamp(),
  } satisfies Receipt

  const nextParticipants = {
    ...market.participants,
    [actor]: {
      ...account,
      cash: account.cash - preview.sats,
      long: account.long + (side === 'LONG' ? preview.tokens : 0),
      short: account.short + (side === 'SHORT' ? preview.tokens : 0),
    },
  }

  const nextMarket = {
    ...market,
    qLong: market.qLong + (side === 'LONG' ? preview.tokens : 0),
    qShort: market.qShort + (side === 'SHORT' ? preview.tokens : 0),
    reserve: preview.reserveAfter,
    participants: nextParticipants,
    quotes: prependLedger(market.quotes, quote),
    proofs: prependLedger(market.proofs, proof),
    receipts: prependLedger(market.receipts, receipt),
    events: prependEvents(market.events, {
      id: makeId('event'),
      label: `${actorName(actor)} bought ${preview.tokens.toFixed(3)} ${side}`,
      detail: `${actorName(actor)} paid ${preview.sats.toFixed(2)} sats at an average ${preview.avgPrice.toFixed(4)} fill and ${createSnark('BUY', side, preview.endPrice - preview.startPrice)}`,
      createdAt: stamp(),
    }),
    lastTrade: {
      id: makeId('trade'),
      kind: 'BUY',
      actor,
      side,
      sats: preview.sats,
      tokens: preview.tokens,
      startPrice: preview.startPrice,
      endPrice: preview.endPrice,
      avgPrice: preview.avgPrice,
      reserveBefore: market.reserve,
      reserveAfter: preview.reserveAfter,
      pnlDelta: 0,
    },
  } satisfies Market

  return {
    market: nextMarket,
    detail: actor !== 'you'
      ? `${actorName(actor)} minted ${preview.tokens.toFixed(3)} ${side} tokens and moved ${side} odds to ${(preview.endPrice * 100).toFixed(2)}%.`
      : `Average fill ${preview.avgPrice.toFixed(4)} sats per token. ${side} now sits at ${preview.endPrice.toFixed(4)} on the active side curve.`,
  }
}

export function applyRedeem(
  market: Market,
  side: Side,
  tokens: number,
  actor: ActorId,
): ExecutionResult | null {
  const account = market.participants[actor]
  const owned = side === 'LONG' ? account.long : account.short
  if (tokens > owned || tokens <= 0) {
    return null
  }

  const preview = solveRedeemValue(market, side, tokens)
  if (!preview) {
    return null
  }

  const proofSpend = applyProofSpend(market.proofs, actor, side, tokens, preview.sats)
  if (!proofSpend) {
    return null
  }

  const quote = {
    id: makeId('quote'),
    kind: 'melt',
    actor,
    side,
    sats: preview.sats,
    tokens,
    createdAt: stamp(),
    status: 'PAID',
  } satisfies CashuQuote

  const receipt = {
    id: makeId('receipt'),
    kind: 'redeem',
    actor,
    side,
    sats: preview.sats,
    tokens,
    reserveBefore: market.reserve,
    reserveAfter: preview.reserveAfter,
    createdAt: stamp(),
  } satisfies Receipt

  const nextParticipants = {
    ...market.participants,
    [actor]: {
      ...account,
      cash: account.cash + preview.sats,
      long: account.long - (side === 'LONG' ? tokens : 0),
      short: account.short - (side === 'SHORT' ? tokens : 0),
    },
  }

  const nextMarket = {
    ...market,
    qLong: market.qLong - (side === 'LONG' ? tokens : 0),
    qShort: market.qShort - (side === 'SHORT' ? tokens : 0),
    reserve: preview.reserveAfter,
    participants: nextParticipants,
    proofs: proofSpend.proofs,
    spentProofs: trim([...proofSpend.spentProofs, ...market.spentProofs], MAX_LEDGER_ITEMS),
    quotes: prependLedger(market.quotes, quote),
    receipts: prependLedger(market.receipts, receipt),
    events: prependEvents(market.events, {
      id: makeId('event'),
      label: `${actorName(actor)} redeemed ${tokens.toFixed(3)} ${side}`,
      detail: `${actorName(actor)} burned proofs for ${preview.sats.toFixed(2)} sats and ${createSnark('REDEEM', side, Math.abs(preview.endPrice - preview.startPrice))}`,
      createdAt: stamp(),
    }),
    lastTrade: {
      id: makeId('trade'),
      kind: 'REDEEM',
      actor,
      side,
      sats: preview.sats,
      tokens,
      startPrice: preview.startPrice,
      endPrice: preview.endPrice,
      avgPrice: preview.avgPrice,
      reserveBefore: market.reserve,
      reserveAfter: preview.reserveAfter,
      pnlDelta: 0,
    },
  } satisfies Market

  return {
    market: nextMarket,
    detail: actor !== 'you'
      ? `${actorName(actor)} burned ${tokens.toFixed(3)} ${side} tokens and pulled reserve to ${preview.reserveAfter.toFixed(2)} sats.`
      : `Burn confirmed. Reserve shrank to ${preview.reserveAfter.toFixed(2)} sats and the ${side} stack lost ${tokens.toFixed(3)} tokens.`,
  }
}

function crowdBuyBudget(
  market: Market,
  actor: CrowdActorId,
  aggression: number,
  tailwind: number,
  intensity = 1,
) {
  const cash = market.participants[actor].cash
  if (cash <= 12) {
    return 0
  }
  const reserveAnchor = market.reserve > 0 ? market.reserve * (0.05 + tailwind * 0.05) : 90
  const cashSlice =
    cash * randomBetween(0.08, 0.22 + tailwind * 0.06) * aggression * intensity
  const desired = Math.min(cash, Math.max(cashSlice, reserveAnchor))
  return clamp(desired, 18, cash)
}

function crowdRedeemTokens(
  holdings: number,
  minShare: number,
  maxShare: number,
  intensity = 1,
) {
  if (holdings <= 0.000001) {
    return 0
  }
  return clamp(holdings * randomBetween(minShare, maxShare) * intensity, 1, holdings)
}

export function simulateCrowdStep(
  market: Market,
  bias: MarketBias = 'NEUTRAL',
  realitySpeed = 1,
  realityCertainty = 0,
): ExecutionResult | null {
  const marketMetrics = deriveMarketMetrics(market)
  const speed = clamp(realitySpeed, 0.65, 1.7)
  const certainty = clamp(realityCertainty, 0, 1)

  for (const actor of shuffledCrowdActors()) {
    const profile = CROWD_PROFILES[actor]
    const account = market.participants[actor]
    const actorMetrics = deriveActorMetrics(market, actor)
    const walletRatio = actorMetrics.totalValue / STARTING_BANKROLL
    if (bias !== 'NEUTRAL') {
      const favoredSide: Side = bias === 'LONGS_FAVORED' ? 'LONG' : 'SHORT'
      const disfavoredSide: Side = favoredSide === 'LONG' ? 'SHORT' : 'LONG'
      const favoredOdds =
        favoredSide === 'LONG' ? marketMetrics.longOdds : marketMetrics.shortOdds
      const favoredCertainty =
        clamp((favoredOdds - 0.52) / 0.18, 0, 1) * 0.45 + certainty * 0.8
      const disfavoredExitTrigger = favoredOdds > 0.5 - (speed - 1) * 0.05
      const favoredHolding =
        favoredSide === 'LONG'
          ? market.participants[actor].long
          : market.participants[actor].short
      const disfavoredHolding =
        disfavoredSide === 'LONG'
          ? market.participants[actor].long
          : market.participants[actor].short

      if (account.cash < 140 && certainty > 0.28) {
        market = injectCrowdCash(
          market,
          actor,
          clamp(
            28 + certainty * 92 * profile.aggression * speed,
            0,
            180 + certainty * 120,
          ),
          favoredSide === 'LONG' ? 'LONG_CHASERS' : 'SHORT_CHASERS',
        )
      }

      if (
        disfavoredHolding > 1 &&
        (walletRatio < profile.stopLoss + 0.03 + certainty * 0.05 ||
          disfavoredExitTrigger ||
          certainty > 0.32)
      ) {
        const result = applyRedeem(
          market,
          disfavoredSide,
          crowdRedeemTokens(
            disfavoredHolding,
            0.24,
            0.58,
            0.95 + speed * 0.4 + certainty * 0.7,
          ),
          actor,
        )
        if (result) {
          return result
        }
      }

      if (
        favoredHolding > 1 &&
        walletRatio > profile.takeProfit - 0.03 &&
        favoredOdds > 0.54 &&
        favoredCertainty < 0.68 &&
        Math.random() < 0.62 - favoredCertainty * 0.38
      ) {
        const result = applyRedeem(
          market,
          favoredSide,
          crowdRedeemTokens(
            favoredHolding,
            0.12,
            0.34,
            Math.max(0.55, 1 - favoredCertainty * 0.58),
          ),
          actor,
        )
        if (result) {
          return result
        }
      }

      if (market.participants[actor].cash > 18) {
        if (
          actor === 'carol' &&
          favoredOdds > 0.76 &&
          certainty < 0.55 &&
          Math.random() < profile.contrarian / (1 + favoredCertainty * 1.6)
        ) {
          const result = applyBuy(
            market,
            disfavoredSide,
            crowdBuyBudget(
              market,
              actor,
              profile.aggression,
              0.2,
              Math.max(0.55, 1 - favoredCertainty * 0.45),
            ),
            actor,
          )
          if (result) {
            return result
          }
        }

        const result = applyBuy(
          market,
          favoredSide,
          crowdBuyBudget(
            market,
            actor,
            profile.aggression,
            1,
            speed * (1 + certainty * 0.9),
          ),
          actor,
        )
        if (result) {
          return result
        }
      }

      if (disfavoredHolding > 1) {
        const result = applyRedeem(
          market,
          disfavoredSide,
          crowdRedeemTokens(
            disfavoredHolding,
            0.12,
            0.24,
            0.9 + speed * 0.25 + certainty * 0.35,
          ),
          actor,
        )
        if (result) {
          return result
        }
      }

      continue
    }

    if (account.long > 1 && walletRatio > profile.takeProfit && marketMetrics.longOdds > 0.56) {
      const result = applyRedeem(
        market,
        'LONG',
        crowdRedeemTokens(account.long, 0.14, 0.28),
        actor,
      )
      if (result) {
        return result
      }
    }

    if (account.short > 1 && walletRatio > profile.takeProfit && marketMetrics.shortOdds > 0.56) {
      const result = applyRedeem(
        market,
        'SHORT',
        crowdRedeemTokens(account.short, 0.14, 0.28),
        actor,
      )
      if (result) {
        return result
      }
    }

    if (account.long > 1 && walletRatio < profile.stopLoss && marketMetrics.longOdds < 0.43) {
      const result = applyRedeem(
        market,
        'LONG',
        crowdRedeemTokens(account.long, 0.16, 0.34),
        actor,
      )
      if (result) {
        return result
      }
    }

    if (account.short > 1 && walletRatio < profile.stopLoss && marketMetrics.shortOdds < 0.43) {
      const result = applyRedeem(
        market,
        'SHORT',
        crowdRedeemTokens(account.short, 0.16, 0.34),
        actor,
      )
      if (result) {
        return result
      }
    }

    if (account.cash <= 18) {
      continue
    }

    let side: Side
    if (actor === 'alice') {
      side = marketMetrics.longOdds >= marketMetrics.shortOdds ? 'LONG' : 'SHORT'
    } else if (actor === 'bob') {
      side = marketMetrics.longOdds <= 0.47 ? 'LONG' : marketMetrics.shortOdds <= 0.47 ? 'SHORT' : Math.random() < 0.5 ? 'LONG' : 'SHORT'
    } else {
      side = marketMetrics.longOdds >= 0.58 ? 'SHORT' : marketMetrics.shortOdds >= 0.58 ? 'LONG' : Math.random() < 0.5 ? 'LONG' : 'SHORT'
    }

    const result = applyBuy(
      market,
      side,
      crowdBuyBudget(market, actor, profile.aggression, 0.35),
      actor,
    )
    if (result) {
      return result
    }
  }

  return null
}

function syntheticBuySize(market: Market, actor: CrowdActorId, side: Side) {
  const { longOdds, shortOdds } = deriveMarketMetrics(market)
  const sideOdds = side === 'LONG' ? longOdds : shortOdds
  const reserveBase = market.reserve > 0 ? market.reserve * 0.16 : 42
  const pressure = 1 + Math.abs(0.5 - sideOdds)
  const available = market.participants[actor].cash
  return clamp(Math.min(available, reserveBase * pressure), 12, Math.max(12, available))
}

function syntheticRedeemSize(market: Market, actor: CrowdActorId, side: Side) {
  const holdings =
    side === 'LONG'
      ? market.participants[actor].long
      : market.participants[actor].short
  if (holdings <= 0.000001) {
    return 0
  }
  return clamp(holdings * 0.35, 1, holdings)
}

export function applySyntheticActivity(
  market: Market,
  actor: CrowdActorId,
  activity: SyntheticActivity,
): ExecutionResult | null {
  switch (activity) {
    case 'BUY_LONG': {
      const sats = syntheticBuySize(market, actor, 'LONG')
      return sats > 0 ? applyBuy(market, 'LONG', sats, actor) : null
    }
    case 'BUY_SHORT': {
      const sats = syntheticBuySize(market, actor, 'SHORT')
      return sats > 0 ? applyBuy(market, 'SHORT', sats, actor) : null
    }
    case 'REDEEM_LONG': {
      const tokens = syntheticRedeemSize(market, actor, 'LONG')
      return tokens > 0 ? applyRedeem(market, 'LONG', tokens, actor) : null
    }
    case 'REDEEM_SHORT': {
      const tokens = syntheticRedeemSize(market, actor, 'SHORT')
      return tokens > 0 ? applyRedeem(market, 'SHORT', tokens, actor) : null
    }
    default:
      return null
  }
}
