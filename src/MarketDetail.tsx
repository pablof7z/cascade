import { useEffect, useMemo, useState } from 'react'
import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import type { MarketEntry } from './storage'
import type { ActorId, Side } from './market'
import { ACTOR_LABELS, deriveMarketMetrics, priceLong, priceShort, previewTrade } from './market'
import { getSampleSpec } from './marketCatalog'
import PriceChart from './PriceChart'
import EmbedModal from './components/EmbedModal'
import BookmarkButton from './components/BookmarkButton'
import { useBookmarks } from './useBookmarks'
import MarketTabsShell, { type MarketTabKey } from './MarketTabsShell'
import { MarketDiscussionPanel, generateMockThreads, type DiscussionThread } from './DiscussPage'
import { trackMarketView, trackTradePlaced } from './analytics'
import { addPosition, getPositionsForMarket, type Position } from './positionStore'

type TradeAction = {
  type: 'TRADE'
  marketId: string
  actor: 'you' | 'alice' | 'bob' | 'carol'
  kind: 'BUY' | 'REDEEM'
  side: Side
  amount: number
}

interface Props {
  entry: MarketEntry
  dispatch: Dispatch<TradeAction>
  activeTab: MarketTabKey
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const compactCurrencyFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

const compactNumberFormatter = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatCompactCurrency(value: number) {
  return `$${compactCurrencyFormatter.format(value)}`
}

function formatCompactNumber(value: number) {
  return compactNumberFormatter.format(value)
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`
}

function formatTimestamp(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatSignedCents(value: number) {
  const cents = value * 100
  return `${cents >= 0 ? '+' : ''}${cents.toFixed(1)}¢`
}

type ReplyNode = {
  replies: ReplyNode[]
}

function countReplies(replies: ReplyNode[]): number {
  return replies.reduce((count, reply) => count + 1 + countReplies(reply.replies), 0)
}

function getTiltCopy(probability: number) {
  if (probability >= 0.65) {
    return {
      label: 'YES consensus is setting the pace',
      detail:
        'Long conviction already owns the narrative. New YES buyers need a sharper catalyst than what is currently priced, and NO buyers are looking for a clean break in the thesis.',
      accent: 'text-emerald-400',
    }
  }

  if (probability <= 0.35) {
    return {
      label: 'NO consensus is controlling the tape',
      detail:
        'The market is leaning against the thesis. YES buyers need genuinely new information, not just better rhetoric, to reverse the current positioning.',
      accent: 'text-rose-400',
    }
  }

  return {
    label: 'Price is balanced and still vulnerable',
    detail:
      'Neither side has locked the market. When the crowd is split, the next concrete update or strong rebuttal can reprice the contract quickly.',
    accent: 'text-amber-300',
  }
}

function getTradeFrame(probability: number) {
  if (probability >= 0.65) {
    return [
      'Buy YES only if you think the current upside is still underpriced after the recent move.',
      'Buy NO if you believe optimism has outrun evidence and the market needs to mean-revert.',
      'Use discussion to find the strongest rebuttal before adding to the crowded side.',
    ]
  }

  if (probability <= 0.35) {
    return [
      'Buy NO if you think the market still has more downside to price in.',
      'Buy YES if you have a specific catalyst that breaks the current bearish consensus.',
      'Watch for fresh evidence rather than vague sentiment because the tape is already skeptical.',
    ]
  }

  return [
    'This is a two-sided market, so edge comes from timing and evidence, not momentum alone.',
    'Buy YES if you think the next hard update will push conviction above the midpoint.',
    'Buy NO if you think the current debate is still overstating the upside case.',
  ]
}

function getThreadScore(thread: DiscussionThread) {
  return thread.upvotes - thread.downvotes
}

export default function MarketDetail({ entry, dispatch, activeTab }: Props) {
  const [amount, setAmount] = useState(100)
  const [selectedSide, setSelectedSide] = useState<Side>('LONG')
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])

  const market = entry.market

  useEffect(() => {
    trackMarketView(market.id)
  }, [market.id])

  // Load existing positions for this market on mount and after trades
  useEffect(() => {
    setPositions(getPositionsForMarket(market.id))
  }, [market.id, market.lastTrade?.id])

  const spec = getSampleSpec(market.title)
  const { isBookmarked, toggle, getCount } = useBookmarks([market.id])

  const yesPrice = priceLong(market.qLong, market.qShort, market.b)
  const noPrice = priceShort(market.qLong, market.qShort, market.b)
  const { longCapital, shortCapital, longPositionShare } = deriveMarketMetrics(market)

  const preview = previewTrade(market, 'you', 'BUY', selectedSide, amount)
  const openingPrice = entry.history[0]?.priceLong ?? yesPrice
  const priceMove = yesPrice - openingPrice
  const totalVolume = market.receipts.reduce((sum, receipt) => sum + receipt.sats, 0)
  const recentEvents = market.events.slice(0, 6)
  const recentReceipts = market.receipts.slice(0, 6)
  const participantRows = (Object.entries(market.participants) as Array<
    [ActorId, { cash: number; long: number; short: number }]
  >)
    .map(([actor, account]) => ({
      actor,
      cash: account.cash,
      long: account.long,
      short: account.short,
      grossExposure: account.long + account.short,
    }))
    .sort((left, right) => right.grossExposure - left.grossExposure)

  const discussionThreads = useMemo(() => generateMockThreads(market.title), [market.title])
  const rankedThreads = useMemo(
    () => [...discussionThreads].sort((left, right) => getThreadScore(right) - getThreadScore(left)),
    [discussionThreads],
  )

  const topParticipants = participantRows.slice(0, 3)
  const bullThreads = rankedThreads.filter((thread) => thread.stance === 'bull')
  const bearThreads = rankedThreads.filter((thread) => thread.stance === 'bear')
  const topBullThread = bullThreads[0]
  const topBearThread = bearThreads[0]
  const latestThread = rankedThreads[0]
  const totalReplies = rankedThreads.reduce((sum, thread) => sum + countReplies(thread.replies), 0)
  const activeParticipants = participantRows.filter((row) => row.grossExposure > 0).length
  const averageTicketSize = market.receipts.length > 0 ? totalVolume / market.receipts.length : 0
  const lastReceipt = recentReceipts[0]
  const tilt = getTiltCopy(yesPrice)
  const tradeFrame = getTradeFrame(yesPrice)

  const catalystCards = [
    {
      eyebrow: 'Crowding',
      title:
        longCapital >= shortCapital
          ? `${formatPercent(longCapital)} of committed capital is leaning YES`
          : `${formatPercent(shortCapital)} of committed capital is leaning NO`,
      detail:
        longCapital >= shortCapital
          ? 'The crowd is carrying more upside exposure than downside insurance.'
          : 'Downside protection is absorbing more capital than the upside case.',
    },
    {
      eyebrow: 'Flow',
      title: lastReceipt
        ? `${ACTOR_LABELS[lastReceipt.actor]} last traded ${lastReceipt.side === 'LONG' ? 'YES' : 'NO'}`
        : 'Waiting on the next decisive fill',
      detail: lastReceipt
        ? `${formatCurrency(lastReceipt.sats)} notional moved through the pool at ${formatTimestamp(lastReceipt.createdAt)}.`
        : 'The activity tab will start filling once new receipts settle.',
    },
    {
      eyebrow: 'Debate',
      title: latestThread ? latestThread.title : 'No live debate yet',
      detail: latestThread
        ? `${latestThread.author} is currently setting the discussion agenda with ${formatCompactNumber(
            getThreadScore(latestThread),
          )} net votes.`
        : 'Open discussion to seed the first evidence-backed thread.',
    },
  ]

  const handleTrade = (side: Side) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }

    dispatch({
      type: 'TRADE',
      marketId: market.id,
      actor: 'you',
      kind: 'BUY',
      side,
      amount,
    })

    // Persist position to localStorage
    const direction = side === 'LONG' ? 'yes' : 'no'
    const price = side === 'LONG' ? yesPrice : noPrice
    const tokens = preview ? preview.tokens : amount / price
    addPosition(market.id, market.title, direction, tokens, price)
    setPositions(getPositionsForMarket(market.id))

    trackTradePlaced(market.id, side, amount)
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6">
      <MarketTabsShell
        marketId={market.id}
        marketTitle={market.title}
        marketDescription={market.description}
        probability={yesPrice}
        reserve={market.reserve}
        tradeCount={market.quotes.length}
        activeTab={activeTab}
        headerAction={
          <>
            <BookmarkButton
              isBookmarked={isBookmarked(market.id)}
              count={getCount(market.id)}
              onToggle={() => toggle(market.id)}
              size="md"
              showCount
            />
            <button
              onClick={() => setShowEmbedModal(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 3L2 8L5.5 13M10.5 3L14 8L10.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Embed
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {activeTab === 'overview' ? (
            <>
              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.95fr)]">
                <article className="overflow-hidden rounded-[28px] border border-neutral-800 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.2),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_28%),linear-gradient(180deg,_rgba(24,24,27,1),_rgba(10,10,10,1))] p-6 sm:p-7">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-2xl">
                      <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-neutral-500">
                        <span>{market.kind === 'thesis' ? 'Thesis market' : 'Module market'}</span>
                        {spec?.category ? <span>• {spec.category}</span> : null}
                      </div>
                      <h2 className={`mt-4 text-2xl font-semibold tracking-tight ${tilt.accent}`}>
                        {tilt.label}
                      </h2>
                      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300 sm:text-base">
                        {tilt.detail}
                      </p>
                    </div>

                    <div className="grid min-w-[220px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">YES</div>
                        <div className="mt-2 text-3xl font-semibold text-emerald-400">
                          {(yesPrice * 100).toFixed(0)}¢
                        </div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">NO</div>
                        <div className="mt-2 text-3xl font-semibold text-rose-400">
                          {(noPrice * 100).toFixed(0)}¢
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-5 py-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Move since open</div>
                      <div
                        className={`mt-2 text-2xl font-semibold ${
                          priceMove >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {formatSignedCents(priceMove)}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-5 py-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Active risk carriers</div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {activeParticipants > 0 ? activeParticipants : participantRows.length}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-950/60 px-5 py-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Average ticket</div>
                      <div className="mt-2 text-2xl font-semibold text-white">
                        {averageTicketSize > 0 ? formatCompactCurrency(averageTicketSize) : '$0'}
                      </div>
                    </div>
                  </div>
                </article>

                <div className="grid gap-4">
                  <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                    <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">Trade frame</div>
                    <h3 className="mt-3 text-lg font-semibold text-white">
                      What has to be true for this trade to work
                    </h3>
                    <ul className="mt-4 space-y-3">
                      {tradeFrame.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-relaxed text-neutral-400">
                          <span className="mt-1 h-2 w-2 rounded-full bg-neutral-500" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>

                  <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">Debate pulse</div>
                        <h3 className="mt-3 text-lg font-semibold text-white">
                          Discussion is a first-class signal here
                        </h3>
                      </div>
                      <Link
                        to={`/market/${market.id}/discussion`}
                        className="rounded-full border border-white/10 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white hover:text-neutral-950"
                      >
                        Open discussion
                      </Link>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Threads</div>
                        <div className="mt-2 text-2xl font-semibold text-white">{discussionThreads.length}</div>
                      </div>
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Replies</div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {formatCompactNumber(totalReplies)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Bull / Bear</div>
                        <div className="mt-2 text-2xl font-semibold text-white">
                          {bullThreads.length}/{bearThreads.length}
                        </div>
                      </div>
                    </div>
                  </article>
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)]">
                <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                  <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">Positioning map</div>
                  <h3 className="mt-3 text-lg font-semibold text-white">
                    Price, capital, and share balance
                  </h3>
                  <div className="mt-5 space-y-5">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">Implied probability</span>
                        <span className="font-medium text-white">{formatPercent(yesPrice)} YES</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-neutral-900">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${yesPrice * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">Committed capital</span>
                        <span className="font-medium text-white">{formatPercent(longCapital)} YES</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-neutral-900">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${longCapital * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">Outstanding shares</span>
                        <span className="font-medium text-white">{formatPercent(longPositionShare)} YES</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-neutral-900">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${longPositionShare * 100}%` }} />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">YES capital</div>
                        <div className="mt-2 text-xl font-semibold text-emerald-400">
                          {formatPercent(longCapital)}
                        </div>
                      </div>
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">NO capital</div>
                        <div className="mt-2 text-xl font-semibold text-rose-400">
                          {formatPercent(shortCapital)}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>

                <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                  <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">What moves price now</div>
                  <h3 className="mt-3 text-xl font-semibold text-white">Three live pressure points</h3>
                  <div className="mt-5 space-y-3">
                    {catalystCards.map((card) => (
                      <div
                        key={card.eyebrow}
                        className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4"
                      >
                        <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-600">
                          {card.eyebrow}
                        </div>
                        <div className="mt-2 font-medium text-white">{card.title}</div>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">{card.detail}</p>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                  <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">Who is carrying risk</div>
                  <h3 className="mt-3 text-xl font-semibold text-white">Largest positioned accounts</h3>
                  <div className="mt-5 space-y-3">
                    {topParticipants.map((row) => (
                      <div
                        key={row.actor}
                        className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{ACTOR_LABELS[row.actor]}</div>
                          <div className="text-sm text-neutral-500">{formatCurrency(row.cash)} cash</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Long</div>
                            <div className="mt-1 text-emerald-400">{row.long.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Short</div>
                            <div className="mt-1 text-rose-400">{row.short.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Gross</div>
                            <div className="mt-1 text-white">{row.grossExposure.toFixed(3)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">Price snapshot</div>
                      <h3 className="mt-3 text-xl font-semibold text-white">
                        Trendline plus reserve context
                      </h3>
                    </div>
                    <div className="rounded-full border border-neutral-800 bg-neutral-900/80 px-4 py-2 text-sm text-neutral-400">
                      Reserve {formatCurrency(market.reserve)}
                    </div>
                  </div>
                  <div className="mt-5 h-72 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-4">
                    <PriceChart data={entry.history} />
                  </div>
                </article>

                <article className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.24em] text-neutral-600">Top arguments right now</div>
                      <h3 className="mt-3 text-xl font-semibold text-white">
                        The strongest case on each side
                      </h3>
                    </div>
                    <Link
                      to={`/market/${market.id}/discussion`}
                      className="text-sm font-medium text-white transition-colors hover:text-neutral-300"
                    >
                      See all threads
                    </Link>
                  </div>

                  <div className="mt-5 space-y-3">
                    {topBullThread ? (
                      <Link
                        to={`/market/${market.id}/discussion/${topBullThread.id}`}
                        className="block rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4 transition-colors hover:border-emerald-400/40"
                      >
                        <div className="text-[11px] uppercase tracking-[0.2em] text-emerald-400">Bull case</div>
                        <div className="mt-2 font-medium text-white">{topBullThread.title}</div>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          {topBullThread.content.slice(0, 150)}
                          {topBullThread.content.length > 150 ? '...' : ''}
                        </p>
                      </Link>
                    ) : null}

                    {topBearThread ? (
                      <Link
                        to={`/market/${market.id}/discussion/${topBearThread.id}`}
                        className="block rounded-2xl border border-rose-500/20 bg-rose-500/5 px-4 py-4 transition-colors hover:border-rose-400/40"
                      >
                        <div className="text-[11px] uppercase tracking-[0.2em] text-rose-400">Bear case</div>
                        <div className="mt-2 font-medium text-white">{topBearThread.title}</div>
                        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                          {topBearThread.content.slice(0, 150)}
                          {topBearThread.content.length > 150 ? '...' : ''}
                        </p>
                      </Link>
                    ) : null}

                    {!topBullThread && !topBearThread ? (
                      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4 text-sm text-neutral-500">
                        Discussion has not been seeded yet.
                      </div>
                    ) : null}
                  </div>
                </article>
              </section>
            </>
          ) : null}

          {activeTab === 'discussion' ? (
            <>
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Live threads</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{discussionThreads.length}</div>
                </div>
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Replies</div>
                  <div className="mt-2 text-3xl font-semibold text-white">{formatCompactNumber(totalReplies)}</div>
                </div>
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Bull threads</div>
                  <div className="mt-2 text-3xl font-semibold text-emerald-400">{bullThreads.length}</div>
                </div>
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Bear threads</div>
                  <div className="mt-2 text-3xl font-semibold text-rose-400">{bearThreads.length}</div>
                </div>
              </section>

              <MarketDiscussionPanel
                marketId={market.id}
                marketTitle={market.title}
                variant="discussion"
              />
            </>
          ) : null}

          {activeTab === 'charts' ? (
            <>
              <section className="grid gap-4 md:grid-cols-4">
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Current YES</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-400">
                    {(yesPrice * 100).toFixed(1)}¢
                  </div>
                </div>
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Current NO</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-400">
                    {(noPrice * 100).toFixed(1)}¢
                  </div>
                </div>
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Move vs open</div>
                  <div
                    className={`mt-2 text-2xl font-semibold ${
                      priceMove >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatSignedCents(priceMove)}
                  </div>
                </div>
                <div className="rounded-[24px] border border-neutral-800 bg-neutral-950 px-5 py-5">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Executed volume</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatCurrency(totalVolume)}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5">
                  <div className="mb-4 text-sm font-medium text-white">Price curve</div>
                  <div className="h-80 rounded-[24px] border border-neutral-800 bg-neutral-900/60 p-4">
                    <PriceChart data={entry.history} />
                  </div>
                </div>
                <div className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5">
                  <div className="text-sm font-medium text-white">Latest execution</div>
                  {market.lastTrade ? (
                    <div className="mt-4 space-y-4 text-sm text-neutral-400">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Trade</div>
                        <div className="mt-1 font-medium text-white">
                          {ACTOR_LABELS[market.lastTrade.actor]}{' '}
                          {market.lastTrade.kind === 'BUY' ? 'bought' : 'redeemed'}{' '}
                          {market.lastTrade.side}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Size</div>
                          <div className="mt-1 text-white">{formatCurrency(market.lastTrade.sats)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Tokens</div>
                          <div className="mt-1 text-white">{market.lastTrade.tokens.toFixed(3)}</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Start</div>
                          <div className="mt-1 text-white">{(market.lastTrade.startPrice * 100).toFixed(2)}¢</div>
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">End</div>
                          <div className="mt-1 text-white">{(market.lastTrade.endPrice * 100).toFixed(2)}¢</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-4 text-sm text-neutral-500">
                      No fills yet. The first trade will establish the live execution trail.
                    </p>
                  )}
                </div>
              </section>

              <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Recent fills</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Execution history is where price discovery becomes concrete.
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  {recentReceipts.length > 0 ? (
                    recentReceipts.map((receipt) => (
                      <div
                        key={receipt.id}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3"
                      >
                        <div>
                          <div className="font-medium text-white">
                            {ACTOR_LABELS[receipt.actor]} {receipt.kind === 'mint' ? 'bought' : 'redeemed'}{' '}
                            {receipt.side}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">{formatTimestamp(receipt.createdAt)}</div>
                        </div>
                        <div className="flex flex-wrap gap-6 text-sm">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Notional</div>
                            <div className="mt-1 text-white">{formatCurrency(receipt.sats)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Tokens</div>
                            <div className="mt-1 text-white">{receipt.tokens.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Reserve after</div>
                            <div className="mt-1 text-white">{formatCurrency(receipt.reserveAfter)}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No receipt history yet. Trading activity will populate this log.
                    </p>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === 'activity' ? (
            <>
              <section className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white">Recent market events</h2>
                  <p className="mt-1 text-sm text-neutral-400">
                    Follow what actually changed in the market before you mirror the crowd.
                  </p>
                </div>
                <div className="space-y-3">
                  {recentEvents.length > 0 ? (
                    recentEvents.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">{event.label}</div>
                            <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                              {event.detail}
                            </p>
                          </div>
                          <div className="text-xs text-neutral-500">{formatTimestamp(event.createdAt)}</div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-neutral-500">
                      No event stream yet. The activity tab will populate as soon as the market moves.
                    </p>
                  )}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-white">Receipt log</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Every mint and redeem is visible here with reserves before and after.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {recentReceipts.length > 0 ? (
                      recentReceipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="flex items-start justify-between gap-4 rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3"
                        >
                          <div>
                            <div className="font-medium text-white">
                              {ACTOR_LABELS[receipt.actor]} {receipt.kind}
                            </div>
                            <div className="mt-1 text-sm text-neutral-400">
                              {receipt.side} • {receipt.tokens.toFixed(3)} tokens
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <div className="text-white">{formatCurrency(receipt.sats)}</div>
                            <div className="mt-1 text-xs text-neutral-500">
                              {formatTimestamp(receipt.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-neutral-500">
                        No receipts yet. Trades will appear here as soon as they settle.
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-neutral-800 bg-neutral-950 p-5">
                  <div className="mb-4">
                    <h2 className="text-lg font-semibold text-white">Participant positioning</h2>
                    <p className="mt-1 text-sm text-neutral-400">
                      Exposure reveals who is actually carrying risk, not just posting about it.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {participantRows.map((row) => (
                      <div
                        key={row.actor}
                        className="rounded-2xl border border-neutral-800 bg-neutral-900/70 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{ACTOR_LABELS[row.actor]}</div>
                          <div className="text-sm text-neutral-500">Cash {formatCurrency(row.cash)}</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Long</div>
                            <div className="mt-1 text-emerald-400">{row.long.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Short</div>
                            <div className="mt-1 text-rose-400">{row.short.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Gross</div>
                            <div className="mt-1 text-white">{row.grossExposure.toFixed(3)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-[28px] border border-neutral-800 bg-neutral-950 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-neutral-600">Trade ticket</p>
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {selectedSide === 'LONG' ? 'Add YES exposure' : 'Add NO exposure'}
                </h3>
              </div>
              <div
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  selectedSide === 'LONG'
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                }`}
              >
                {selectedSide === 'LONG' ? 'YES' : 'NO'}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                onClick={() => setSelectedSide('LONG')}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  selectedSide === 'LONG'
                    ? 'border-emerald-500 bg-emerald-500/10 text-white'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Buy YES</div>
                <div className="mt-2 text-2xl font-semibold text-emerald-400">
                  {(yesPrice * 100).toFixed(0)}¢
                </div>
              </button>
              <button
                onClick={() => setSelectedSide('SHORT')}
                className={`rounded-2xl border px-4 py-4 text-left transition-colors ${
                  selectedSide === 'SHORT'
                    ? 'border-rose-500 bg-rose-500/10 text-white'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                }`}
              >
                <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Buy NO</div>
                <div className="mt-2 text-2xl font-semibold text-rose-400">
                  {(noPrice * 100).toFixed(0)}¢
                </div>
              </button>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <label className="text-neutral-500">Ticket size (sats)</label>
                <div className="text-neutral-600">Quick sizes</div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[25, 100, 250, 500].map((quickAmount) => (
                  <button
                    key={quickAmount}
                    onClick={() => setAmount(quickAmount)}
                    className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                      amount === quickAmount
                        ? 'border-white/20 bg-white text-neutral-950'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {quickAmount}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5">
              <input
                type="number"
                value={amount}
                onChange={(event) => {
                  const nextAmount = Number(event.target.value)
                  setAmount(Number.isFinite(nextAmount) ? nextAmount : 0)
                }}
                className="w-full rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-white focus:border-neutral-500 focus:outline-none"
                min="1"
              />
            </div>

            {preview ? (
              <div className="mt-5 space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Cost</span>
                  <span className="text-white">{formatCurrency(preview.sats)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Tokens</span>
                  <span className="text-white">{preview.tokens.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Average fill</span>
                  <span className="text-white">{(preview.avgPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Reserve after</span>
                  <span className="text-white">{formatCurrency(preview.reserveAfter)}</span>
                </div>
              </div>
            ) : null}

            <p className="mt-5 text-xs leading-relaxed text-neutral-500">
              Trades execute immediately against the LMSR reserve in this demo market. Use the tabs
              above to pressure-test the thesis before sizing up.
            </p>

            <button
              onClick={() => handleTrade(selectedSide)}
              className={`mt-4 w-full rounded-2xl py-4 text-lg font-bold text-white transition-colors ${
                selectedSide === 'LONG'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-rose-600 hover:bg-rose-500'
              }`}
            >
              Buy {selectedSide === 'LONG' ? 'YES' : 'NO'}
            </button>

            {/* Existing positions for this market */}
            {positions.length > 0 && (
              <div className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">
                  Your Positions
                </h4>
                <div className="space-y-3">
                  {positions.map((pos) => {
                    const currentPrice =
                      pos.direction === 'yes' ? yesPrice : noPrice
                    const marketValue = pos.quantity * currentPrice
                    const pnl = marketValue - pos.costBasis
                    const pnlPct =
                      pos.costBasis > 0 ? (pnl / pos.costBasis) * 100 : 0
                    return (
                      <div
                        key={pos.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              pos.direction === 'yes'
                                ? 'bg-emerald-500'
                                : 'bg-rose-500'
                            }`}
                          />
                          <span className="font-medium text-neutral-200">
                            {pos.direction === 'yes' ? 'YES' : 'NO'}
                          </span>
                          <span className="text-neutral-500">
                            {pos.quantity.toFixed(1)} shares @{' '}
                            {formatCurrency(pos.entryPrice)}
                          </span>
                        </div>
                        <span
                          className={`font-medium ${
                            pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {pnl >= 0 ? '+' : ''}
                          {formatCurrency(pnl)} ({pnlPct >= 0 ? '+' : ''}
                          {pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <EmbedModal
        marketId={market.id}
        marketTitle={market.title}
        isOpen={showEmbedModal}
        onClose={() => setShowEmbedModal(false)}
      />
    </div>
  )
}
