import { useEffect, useRef, useState } from 'react'
import type { Dispatch } from 'react'
import { Link } from 'react-router-dom'
import type { MarketEntry } from './storage'
import type { ActorId, Side } from './market'
import { ACTOR_LABELS, deriveMarketMetrics, priceLong, priceShort, previewTrade } from './market'
import { getThesisDefinition } from './marketCatalog'
import PriceChart from './PriceChart'
import EmbedModal from './components/EmbedModal'
import BookmarkButton from './components/BookmarkButton'
import { useBookmarks } from './useBookmarks'
import MarketTabsShell, { type MarketTabKey } from './MarketTabsShell'
import { MarketDiscussionPanel, type DiscussionThread } from './DiscussPage'
import { trackDiscussionInteraction, trackMarketView, trackTradePlaced } from './analytics'
import { getPositionsForMarket, type Position } from './positionStore'
import { useNostr } from './context/NostrContext'
import { useTestnet } from './testnetConfig'
import { subscribeToMarketUpdates } from './services/marketService'
import { executeTrade } from './services/tradingService'
import type { Action } from './App'

const TRADE_DEBOUNCE_MS = 2000

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
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<TradeAction | Action>
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

function formatTimestamp(value: string | number) {
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
      label: 'Strong YES consensus',
      detail:
        'Most capital is positioned long. Price moves require new information or a catalyst for reversal.',
      accent: 'text-emerald-400',
    }
  }

  if (probability <= 0.35) {
    return {
      label: 'Strong NO consensus',
      detail:
        'Most capital is positioned short. A reversal requires new evidence, not sentiment.',
      accent: 'text-rose-400',
    }
  }

  return {
    label: 'No clear consensus',
    detail:
      'Neither side dominates. The next material update is likely to move the price.',
    accent: 'text-neutral-400',
  }
}

function getTradeFrame(probability: number) {
  if (probability >= 0.65) {
    return [
      'YES is crowded. New buyers need a catalyst beyond what is priced.',
      'NO offers value if you expect a reversion.',
      'Check the discussion for counter-arguments before sizing.',
    ]
  }

  if (probability <= 0.35) {
    return [
      'NO is crowded. Further downside requires new evidence.',
      'YES requires a specific catalyst to break consensus.',
      'Look for new evidence, not sentiment.',
    ]
  }

  return [
    'Neither side dominates. Edge comes from timing and evidence.',
    'YES if you expect the next update to favor the thesis.',
    'NO if you think the upside is overstated.',
  ]
}

function getThreadScore(thread: DiscussionThread) {
  return thread.upvotes - thread.downvotes
}

export default function MarketDetail({ entry, markets, dispatch, activeTab }: Props) {
  const [amount, setAmount] = useState(100)
  const [selectedSide, setSelectedSide] = useState<Side>('LONG')
  const [showEmbedModal, setShowEmbedModal] = useState(false)
  const [showResolveConfirm, setShowResolveConfirm] = useState(false)
  const [positions, setPositions] = useState<Position[]>([])
  const [tradeError, setTradeError] = useState<string | null>(null)
  const [tradeLoading, setTradeLoading] = useState(false)
  const lastTradeAtRef = useRef<number>(0)
  const { isReady, pubkey } = useNostr()
  const { isTestnet } = useTestnet()

  const market = entry.market
  const isCreator = !!pubkey && pubkey === market.creatorPubkey

  // Real-time Nostr subscription: stream state updates for this specific market
  useEffect(() => {
    if (!isReady || !market.id) return

    const sub = subscribeToMarketUpdates(market.id, (updatedMarket, isDeletion) => {
      dispatch({ type: 'SYNC_MARKET', marketId: market.id, market: updatedMarket, isDeletion })
    })

    return () => sub.stop()
  }, [isReady, market.id, dispatch])

  useEffect(() => {
    trackMarketView(market.id)
  }, [market.id])

  useEffect(() => {
    if (activeTab === 'discussion') {
      trackDiscussionInteraction(market.id, 'open_discussion')
    }
  }, [activeTab, market.id])

  // Load existing positions for this market on mount and after trades
  useEffect(() => {
    setPositions(getPositionsForMarket(market.id))
  }, [market.id, market.lastTrade?.id])

  const thesis = getThesisDefinition(market)
  const relatedSignals = (thesis?.signals ?? []).map((signal) => {
    const matchingEntry =
      (signal.moduleMarketId ? markets[signal.moduleMarketId] : undefined) ??
      Object.values(markets).find((candidate) => candidate.market.title === signal.moduleTitle)
    return {
      ...signal,
      routeId: matchingEntry?.market.id,
      probability: matchingEntry ? deriveMarketMetrics(matchingEntry.market).longPositionShare : undefined,
    }
  })
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

  const discussionThreads: DiscussionThread[] = []
  const rankedThreads: DiscussionThread[] = []

  const topParticipants = participantRows.slice(0, 3)
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
          ? 'Capital skews YES.'
          : 'Capital skews NO.',
    },
    {
      eyebrow: 'Flow',
      title: lastReceipt
        ? `${ACTOR_LABELS[lastReceipt.actor]} last traded ${lastReceipt.side === 'LONG' ? 'YES' : 'NO'}`
        : 'No recent trades',
      detail: lastReceipt
        ? `${formatCurrency(lastReceipt.sats)} notional moved through the pool at ${formatTimestamp(lastReceipt.createdAt)}.`
        : 'Activity will appear after the first trade.',
    },
    {
      eyebrow: 'Debate',
      title: latestThread ? latestThread.title : 'No live debate yet',
      detail: latestThread
        ? `${latestThread.author} is currently setting the discussion agenda with ${formatCompactNumber(
            getThreadScore(latestThread),
          )} net votes.`
        : 'Start a thread from the Discussion tab.',
    },
  ]

  const handleResolve = (outcome: 'YES' | 'NO') => {
    dispatch({ type: 'RESOLVE_MARKET', marketId: market.id, outcome, outcomePrice: 1.0 })
    setShowResolveConfirm(false)
  }

  const handleTrade = async (side: Side) => {
    if (!Number.isFinite(amount) || amount <= 0) {
      return
    }

    // 2-second debounce — prevent double-click duplicates
    const now = Date.now()
    if (now - lastTradeAtRef.current < TRADE_DEBOUNCE_MS) {
      return
    }
    lastTradeAtRef.current = now

    setTradeError(null)
    setTradeLoading(true)

    try {
      const result = await executeTrade(market, side, amount, !isTestnet)

      if (!result.success) {
        const { error } = result
        if (error.kind === 'insufficient_balance') {
          setTradeError(`Insufficient balance: you have ${error.balance} sats, need ${error.required}.`)
        } else if (error.kind === 'wallet_unavailable') {
          setTradeError('Wallet unavailable. Please reconnect your wallet.')
        } else if (error.kind === 'send_failed') {
          setTradeError(`Payment failed: ${error.reason}`)
        } else {
          setTradeError('Invalid trade amount.')
        }
        return
      }

      // Dispatch the market state update
      dispatch({
        type: 'TRADE',
        marketId: market.id,
        actor: 'you',
        kind: 'BUY',
        side,
        amount,
      })

      setPositions(getPositionsForMarket(market.id))
      trackTradePlaced(market.id, side, amount)
    } finally {
      setTradeLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-5 py-6 sm:px-6">
      <MarketTabsShell
        marketId={market.id}
        marketTitle={market.title}
        marketDescription={thesis?.argument ?? market.description}
        probability={yesPrice}
        reserve={market.reserve}
        tradeCount={market.quotes.length}
        activeTab={activeTab}
        headerAction={
          <>
            {market.status === 'resolved' && (
              <span
                className={`text-xs font-medium px-2 py-0.5 ${
                  market.resolutionOutcome === 'YES'
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-900/30 text-rose-400 border border-rose-800'
                }`}
              >
                RESOLVED {market.resolutionOutcome}
              </span>
            )}
            <BookmarkButton
              isBookmarked={isBookmarked(market.id)}
              count={getCount(market.id)}
              onToggle={() => toggle(market.id)}
              size="md"
              showCount
            />
            <button
              onClick={() => setShowEmbedModal(true)}
              className="inline-flex items-center gap-2 border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:border-neutral-500 hover:text-white"
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
              <section className="pt-5">
                <div className="grid gap-8 xl:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.75fr)]">
                  <article>
                    <h2 className={`text-3xl font-semibold tracking-tight ${tilt.accent}`}>
                      {tilt.label}
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-neutral-300 sm:text-[15px]">
                      {tilt.detail}
                    </p>
                    <div className="mt-6 grid gap-x-6 gap-y-3 py-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <div className="text-neutral-500">Move since open</div>
                        <div className={`mt-1 text-lg font-semibold ${priceMove >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatSignedCents(priceMove)}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-500">Active risk</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {activeParticipants > 0 ? activeParticipants : participantRows.length} accounts
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-500">Average size</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {averageTicketSize > 0 ? formatCompactCurrency(averageTicketSize) : '$0'}
                        </div>
                      </div>
                      <div>
                        <div className="text-neutral-500">Discussion</div>
                        <div className="mt-1 text-lg font-semibold text-white">
                          {discussionThreads.length} threads / {formatCompactNumber(totalReplies)} replies
                        </div>
                      </div>
                    </div>
                  </article>

                  <aside className="border-l border-neutral-800 pl-0 xl:pl-6">
                    <div className="grid grid-cols-2 gap-4 pb-4">
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Yes</div>
                        <div className="mt-2 text-4xl font-semibold text-emerald-400">
                          {(yesPrice * 100).toFixed(0)}¢
                        </div>
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">No</div>
                        <div className="mt-2 text-4xl font-semibold text-rose-400">
                          {(noPrice * 100).toFixed(0)}¢
                        </div>
                      </div>
                    </div>
                    <dl className="divide-y divide-neutral-800 text-sm">
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Reserve</dt>
                        <dd className="font-medium text-white">{formatCurrency(market.reserve)}</dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Executed volume</dt>
                        <dd className="font-medium text-white">{formatCurrency(totalVolume)}</dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Last trade</dt>
                        <dd className="font-medium text-white">
                          {lastReceipt ? `${ACTOR_LABELS[lastReceipt.actor]} ${lastReceipt.side === 'LONG' ? 'YES' : 'NO'}` : 'None'}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Shares leaning YES</dt>
                        <dd className="font-medium text-white">{formatPercent(longPositionShare)}</dd>
                      </div>
                    </dl>
                  </aside>
                </div>
              </section>

              <section className="grid gap-8 border-t border-neutral-800 pt-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
                <article>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white">Price and positioning</h3>
                    <div className="text-sm text-neutral-500">Reserve {formatCurrency(market.reserve)}</div>
                  </div>
                  <div className="mt-4 h-72 py-4">
                    <PriceChart data={entry.history} />
                  </div>
                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">Implied probability</span>
                        <span className="font-medium text-white">{formatPercent(yesPrice)} YES</span>
                      </div>
                      <div className="h-2 overflow-hidden bg-neutral-900">
                        <div className="h-full bg-emerald-500" style={{ width: `${yesPrice * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">Committed capital</span>
                        <span className="font-medium text-white">{formatPercent(longCapital)} YES</span>
                      </div>
                      <div className="h-2 overflow-hidden bg-neutral-900">
                        <div className="h-full bg-emerald-500" style={{ width: `${longCapital * 100}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-neutral-400">Outstanding shares</span>
                        <span className="font-medium text-white">{formatPercent(longPositionShare)} YES</span>
                      </div>
                      <div className="h-2 overflow-hidden bg-neutral-900">
                        <div className="h-full bg-emerald-500" style={{ width: `${longPositionShare * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </article>

                <article className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Trading considerations</h3>
                    <div className="mt-4 divide-y divide-neutral-800">
                      {tradeFrame.map((item) => (
                        <div key={item} className="py-3 text-sm leading-7 text-neutral-300">
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Market signals</h3>
                    <div className="mt-4 divide-y divide-neutral-800">
                      {catalystCards.map((card) => (
                        <div key={card.eyebrow} className="py-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{card.eyebrow}</div>
                          <div className="mt-2 font-medium text-white">{card.title}</div>
                          <p className="mt-2 text-sm leading-6 text-neutral-400">{card.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {relatedSignals.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-white">Connected signals</h3>
                      <p className="mt-2 text-sm text-neutral-500">Signal markets linked to this thesis.</p>
                      <div className="mt-4 divide-y divide-neutral-800">
                        {relatedSignals.map((signal, index) => (
                          <div key={`${signal.moduleTitle}-${index}`} className="py-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                {signal.routeId ? (
                                  <Link
                                    to={`/market/${signal.routeId}`}
                                    className="font-medium text-white transition-colors hover:text-emerald-300"
                                  >
                                    {signal.moduleTitle}
                                  </Link>
                                ) : (
                                  <div className="font-medium text-white">{signal.moduleTitle}</div>
                                )}
                                <div className="mt-1 text-sm text-neutral-500">
                                  {signal.note || 'No rationale added for this signal yet.'}
                                </div>
                                {signal.probability !== undefined && (
                                  <div className="mt-2 text-xs text-neutral-500">
                                    Live YES {formatPercent(signal.probability)}
                                  </div>
                                )}
                              </div>
                              <span
                                className={`px-3 py-1 text-xs font-medium ${
                                  signal.expectedOutcome === 'YES'
                                    ? 'bg-emerald-500/10 text-emerald-300'
                                    : 'bg-rose-500/10 text-rose-300'
                                }`}
                              >
                                Expect {signal.expectedOutcome}
                              </span>
                            </div>
                            {signal.probability !== undefined && (
                              <div className="mt-3 h-1 bg-neutral-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-emerald-500/60"
                                  style={{ width: `${signal.probability * 100}%` }}
                                />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              </section>

              <section className="grid gap-8 border-t border-neutral-800 pt-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                <article>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white">Largest positioned accounts</h3>
                    <div className="text-sm text-neutral-500">{participantRows.length} tracked</div>
                  </div>
                  <div className="mt-4 divide-y divide-neutral-800">
                    {topParticipants.map((row) => (
                      <div key={row.actor} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div>
                          <div className="font-medium text-white">{ACTOR_LABELS[row.actor]}</div>
                          <div className="mt-1 text-sm text-neutral-500">{formatCurrency(row.cash)} cash available</div>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-neutral-500">Long</div>
                            <div className="mt-1 text-emerald-400">{row.long.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-neutral-500">Short</div>
                            <div className="mt-1 text-rose-400">{row.short.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-neutral-500">Gross</div>
                            <div className="mt-1 text-white">{row.grossExposure.toFixed(3)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article>
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white">Recent fills</h3>
                    <Link
                      to={`/market/${market.id}/activity`}
                      className="text-sm font-medium text-white transition-colors hover:text-neutral-300"
                    >
                      Full activity
                    </Link>
                  </div>
                  <div className="mt-4 divide-y divide-neutral-800">
                    {recentReceipts.length > 0 ? (
                      recentReceipts.map((receipt) => (
                        <div key={receipt.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                          <div>
                            <div className="font-medium text-white">
                              {ACTOR_LABELS[receipt.actor]} {receipt.kind === 'mint' ? 'bought' : 'redeemed'}{' '}
                              {receipt.side}
                            </div>
                            <div className="mt-1 text-sm text-neutral-500">{formatTimestamp(receipt.createdAt)}</div>
                          </div>
                          <div className="grid grid-cols-3 gap-6 text-sm">
                            <div>
                              <div className="text-neutral-500">Notional</div>
                              <div className="mt-1 text-white">{formatCurrency(receipt.sats)}</div>
                            </div>
                            <div>
                              <div className="text-neutral-500">Tokens</div>
                              <div className="mt-1 text-white">{receipt.tokens.toFixed(3)}</div>
                            </div>
                            <div>
                              <div className="text-neutral-500">Reserve after</div>
                              <div className="mt-1 text-white">{formatCurrency(receipt.reserveAfter)}</div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-4 text-sm text-neutral-500">
                        No receipt history yet. Trading activity will populate this log.
                      </div>
                    )}
                  </div>
                </article>
              </section>

              <MarketDiscussionPanel marketId={market.id} marketTitle={market.title} variant="overview" marketEventId={market.nostrEventId} marketCreatorPubkey={market.creatorPubkey} />
            </>
          ) : null}

          {activeTab === 'discussion' ? (
            <>
              <MarketDiscussionPanel
                marketId={market.id}
                marketTitle={market.title}
                variant="discussion"
                marketEventId={market.nostrEventId}
                marketCreatorPubkey={market.creatorPubkey}
              />
            </>
          ) : null}

          {activeTab === 'charts' ? (
            <>
              <section className="grid gap-8 pt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <h3 className="text-lg font-semibold text-white">Price curve</h3>
                  <div className="mt-4 h-80 border border-neutral-800 bg-neutral-950/60 p-4">
                    <PriceChart data={entry.history} />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Latest execution</h3>
                  {market.lastTrade ? (
                    <dl className="mt-4 divide-y divide-neutral-800 text-sm">
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Trade</dt>
                        <dd className="font-medium text-white">
                          {ACTOR_LABELS[market.lastTrade.actor]}{' '}
                          {market.lastTrade.kind === 'BUY' ? 'bought' : 'redeemed'}{' '}
                          {market.lastTrade.side}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Size</dt>
                        <dd className="font-medium text-white">{formatCurrency(market.lastTrade.sats)}</dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Tokens</dt>
                        <dd className="font-medium text-white">{market.lastTrade.tokens.toFixed(3)}</dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">Start price</dt>
                        <dd className="font-medium text-white">{(market.lastTrade.startPrice * 100).toFixed(2)}¢</dd>
                      </div>
                      <div className="flex items-center justify-between py-3">
                        <dt className="text-neutral-500">End price</dt>
                        <dd className="font-medium text-white">{(market.lastTrade.endPrice * 100).toFixed(2)}¢</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-4 text-sm text-neutral-500">
                      No fills yet.
                    </p>
                  )}
                </div>
              </section>

              <section className="border-t border-neutral-800 pt-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold text-white">Recent fills</h3>
                </div>
                <div className="mt-4 divide-y divide-neutral-800">
                  {recentReceipts.length > 0 ? (
                    recentReceipts.map((receipt) => (
                      <div key={receipt.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                        <div>
                          <div className="font-medium text-white">
                            {ACTOR_LABELS[receipt.actor]} {receipt.kind === 'mint' ? 'bought' : 'redeemed'}{' '}
                            {receipt.side}
                          </div>
                          <div className="mt-1 text-sm text-neutral-500">{formatTimestamp(receipt.createdAt)}</div>
                        </div>
                        <div className="grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-neutral-500">Notional</div>
                            <div className="mt-1 text-white">{formatCurrency(receipt.sats)}</div>
                          </div>
                          <div>
                            <div className="text-neutral-500">Tokens</div>
                            <div className="mt-1 text-white">{receipt.tokens.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-neutral-500">Reserve after</div>
                            <div className="mt-1 text-white">{formatCurrency(receipt.reserveAfter)}</div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-sm text-neutral-500">
                      No receipt history yet.
                    </div>
                  )}
                </div>
              </section>
            </>
          ) : null}

          {activeTab === 'activity' ? (
            <>
              <section className="pt-6">
                <h3 className="text-lg font-semibold text-white">Events</h3>
                <div className="mt-4 divide-y divide-neutral-800">
                  {recentEvents.length > 0 ? (
                    recentEvents.map((event) => (
                      <div key={event.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
                        <div>
                          <div className="font-medium text-white">{event.label}</div>
                          <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                            {event.detail}
                          </p>
                        </div>
                        <div className="text-xs text-neutral-500">{formatTimestamp(event.createdAt)}</div>
                      </div>
                    ))
                  ) : (
                    <div className="py-4 text-sm text-neutral-500">
                      No events yet.
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-8 border-t border-neutral-800 pt-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div>
                  <h3 className="text-lg font-semibold text-white">Receipt log</h3>
                  <div className="mt-4 divide-y divide-neutral-800">
                    {recentReceipts.length > 0 ? (
                      recentReceipts.map((receipt) => (
                        <div key={receipt.id} className="flex items-start justify-between gap-4 py-4">
                          <div>
                            <div className="font-medium text-white">
                              {ACTOR_LABELS[receipt.actor]} {receipt.kind}
                            </div>
                            <div className="mt-1 text-sm text-neutral-400">
                              {receipt.side} · {receipt.tokens.toFixed(3)} tokens
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
                      <div className="py-4 text-sm text-neutral-500">
                        No receipts yet.
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white">Positioning</h3>
                  <div className="mt-4 divide-y divide-neutral-800">
                    {participantRows.map((row) => (
                      <div key={row.actor} className="py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{ACTOR_LABELS[row.actor]}</div>
                          <div className="text-sm text-neutral-500">{formatCurrency(row.cash)} cash</div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-6 text-sm">
                          <div>
                            <div className="text-neutral-500">Long</div>
                            <div className="mt-1 text-emerald-400">{row.long.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-neutral-500">Short</div>
                            <div className="mt-1 text-rose-400">{row.short.toFixed(3)}</div>
                          </div>
                          <div>
                            <div className="text-neutral-500">Gross</div>
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
          <div className="sticky top-24 border-l border-neutral-800 pl-5">
            {market.status === 'resolved' ? (
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2 py-0.5 ${
                      market.resolutionOutcome === 'YES'
                        ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                        : 'bg-rose-900/30 text-rose-400 border border-rose-800'
                    }`}
                  >
                    RESOLVED {market.resolutionOutcome}
                  </span>
                </div>
                <p className="mt-4 text-sm text-neutral-500">
                  This market has been resolved. Trading is closed.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {selectedSide === 'LONG' ? 'Add YES exposure' : 'Add NO exposure'}
                    </h3>
                    <p className="mt-2 text-sm text-neutral-500">
                      Trades execute instantly via LMSR pricing.
                    </p>
                  </div>
                  <div
                    className={`px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      selectedSide === 'LONG'
                        ? 'border border-emerald-500/30 text-emerald-400'
                        : 'border border-rose-500/30 text-rose-400'
                    }`}
                  >
                    {selectedSide === 'LONG' ? 'YES' : 'NO'}
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-neutral-800 bg-neutral-800">
                  <button
                    onClick={() => setSelectedSide('LONG')}
                    className={`px-4 py-4 text-left transition-colors ${
                      selectedSide === 'LONG'
                        ? 'bg-emerald-500/10 text-white'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Buy YES</div>
                    <div className="mt-2 text-2xl font-semibold text-emerald-400">
                      {(yesPrice * 100).toFixed(0)}¢
                    </div>
                  </button>
                  <button
                    onClick={() => setSelectedSide('SHORT')}
                    className={`px-4 py-4 text-left transition-colors ${
                      selectedSide === 'SHORT'
                        ? 'bg-rose-500/10 text-white'
                        : 'bg-neutral-950 text-neutral-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-500">Buy NO</div>
                    <div className="mt-2 text-2xl font-semibold text-rose-400">
                      {(noPrice * 100).toFixed(0)}¢
                    </div>
                  </button>
                </div>

                <div className="mt-5 border-t border-neutral-800 pt-5">
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <label className="text-neutral-500">Size (sats)</label>
                    <div className="text-neutral-600">Quick sizes</div>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[25, 100, 250, 500].map((quickAmount) => (
                      <button
                        key={quickAmount}
                        onClick={() => setAmount(quickAmount)}
                        className={`border px-3 py-2 text-sm transition-colors ${
                          amount === quickAmount
                            ? 'border-white/20 bg-white text-neutral-950'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-400 hover:text-white'
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
                    className="w-full border border-neutral-800 bg-neutral-950 px-4 py-3 text-white focus:border-neutral-500 focus:outline-none"
                    min="1"
                  />
                </div>

                {preview ? (
                  <div className="mt-5 divide-y divide-neutral-800">
                    <div className="flex justify-between py-3 text-sm">
                      <span className="text-neutral-500">Cost</span>
                      <span className="text-white">{formatCurrency(preview.sats)}</span>
                    </div>
                    <div className="flex justify-between py-3 text-sm">
                      <span className="text-neutral-500">Tokens</span>
                      <span className="text-white">{preview.tokens.toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between py-3 text-sm">
                      <span className="text-neutral-500">Average fill</span>
                      <span className="text-white">{(preview.avgPrice * 100).toFixed(1)}¢</span>
                    </div>
                    <div className="flex justify-between py-3 text-sm">
                      <span className="text-neutral-500">Reserve after</span>
                      <span className="text-white">{formatCurrency(preview.reserveAfter)}</span>
                    </div>
                  </div>
                ) : null}

                <p className="mt-5 text-xs leading-relaxed text-neutral-500">
                  Demo market. Trades execute immediately against the LMSR reserve.
                </p>

                {tradeError && (
                  <p className="mt-4 text-xs text-rose-400">
                    {tradeError}
                  </p>
                )}

                <button
                  onClick={() => { void handleTrade(selectedSide) }}
                  disabled={tradeLoading}
                  className={`mt-5 w-full py-4 text-lg font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedSide === 'LONG'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {tradeLoading ? 'Placing…' : `Buy ${selectedSide === 'LONG' ? 'YES' : 'NO'}`}
                </button>

                {/* Creator resolution — only shown to market creator */}
                {isCreator && (
                  <div className="border-t border-neutral-800 pt-4 mt-4">
                    <p className="text-xs text-neutral-500 uppercase tracking-wide mb-3">Resolve Market</p>
                    {!showResolveConfirm ? (
                      <button
                        type="button"
                        onClick={() => setShowResolveConfirm(true)}
                        className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
                      >
                        Resolve this market
                      </button>
                    ) : (
                      <div>
                        <p className="text-sm text-neutral-300 mb-3">Select the outcome:</p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleResolve('YES')}
                            className="px-4 py-2 text-sm font-medium border border-emerald-700 text-emerald-400 hover:bg-emerald-900/20 transition-colors"
                          >
                            YES
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolve('NO')}
                            className="px-4 py-2 text-sm font-medium border border-rose-700 text-rose-400 hover:bg-rose-900/20 transition-colors"
                          >
                            NO
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowResolveConfirm(false)}
                            className="px-4 py-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Existing positions for this market */}
                {positions.length > 0 && (
                  <div className="mt-6 border-t border-neutral-800 pt-5">
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
              </>
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
