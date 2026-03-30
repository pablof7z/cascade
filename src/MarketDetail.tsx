import { useState } from 'react'
import type { Dispatch } from 'react'
import type { MarketEntry } from './storage'
import type { ActorId, Side } from './market'
import { ACTOR_LABELS, priceLong, priceShort, previewTrade } from './market'
import PriceChart from './PriceChart'
import EmbedModal from './components/EmbedModal'
import BookmarkButton from './components/BookmarkButton'
import { useBookmarks } from './useBookmarks'
import MarketTabsShell from './MarketTabsShell'
import { MarketDiscussionPanel } from './DiscussPage'

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
  activeTab: 'overview' | 'charts' | 'activity'
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleString([], {
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

export default function MarketDetail({ entry, dispatch, activeTab }: Props) {
  const [amount, setAmount] = useState(100)
  const [selectedSide, setSelectedSide] = useState<Side>('LONG')
  const [showEmbedModal, setShowEmbedModal] = useState(false)

  const market = entry.market
  const { isBookmarked, toggle, getCount } = useBookmarks([market.id])

  const yesPrice = priceLong(market.qLong, market.qShort, market.b)
  const noPrice = priceShort(market.qLong, market.qShort, market.b)

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

  const handleTrade = (side: Side) => {
    dispatch({
      type: 'TRADE',
      marketId: market.id,
      actor: 'you',
      kind: 'BUY',
      side,
      amount
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
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
              className="inline-flex items-center gap-2 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.5 3L2 8L5.5 13M10.5 3L14 8L10.5 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Embed
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-10">
          {activeTab === 'overview' ? (
            <>
              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-6">
                <div className="flex flex-wrap items-end gap-8">
                  <div>
                    <div className="text-5xl font-bold tracking-tight text-emerald-400">
                      {(yesPrice * 100).toFixed(0)}¢
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">YES</div>
                  </div>
                  <div>
                    <div className="text-5xl font-bold tracking-tight text-rose-400">
                      {(noPrice * 100).toFixed(0)}¢
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">NO</div>
                  </div>
                  <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">
                      Price move
                    </div>
                    <div
                      className={`mt-1 text-lg font-medium ${
                        priceMove >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatSignedCents(priceMove)}
                    </div>
                  </div>
                </div>
              </section>

              <section>
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-neutral-600">
                  Price history
                </div>
                <div className="h-64 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <PriceChart data={entry.history} />
                </div>
              </section>

              <MarketDiscussionPanel
                marketId={market.id}
                marketTitle={market.title}
                variant="overview"
              />
            </>
          ) : null}

          {activeTab === 'charts' ? (
            <>
              <section className="grid gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Current YES</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-400">
                    {(yesPrice * 100).toFixed(1)}¢
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Current NO</div>
                  <div className="mt-2 text-2xl font-semibold text-rose-400">
                    {(noPrice * 100).toFixed(1)}¢
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Move vs open</div>
                  <div
                    className={`mt-2 text-2xl font-semibold ${
                      priceMove >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatSignedCents(priceMove)}
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Executed volume</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {formatCurrency(totalVolume)}
                  </div>
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                  <div className="mb-4 text-sm font-medium text-white">Price curve</div>
                  <div className="h-80">
                    <PriceChart data={entry.history} />
                  </div>
                </div>
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
                  <div className="text-sm font-medium text-white">Latest execution</div>
                  {market.lastTrade ? (
                    <div className="mt-4 space-y-4 text-sm text-neutral-400">
                      <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-neutral-600">Trade</div>
                        <div className="mt-1 font-medium text-white">
                          {ACTOR_LABELS[market.lastTrade.actor]} {market.lastTrade.kind === 'BUY' ? 'bought' : 'redeemed'}{' '}
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

              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
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
                        className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3"
                      >
                        <div>
                          <div className="font-medium text-white">
                            {ACTOR_LABELS[receipt.actor]} {receipt.kind === 'mint' ? 'bought' : 'redeemed'}{' '}
                            {receipt.side}
                          </div>
                          <div className="mt-1 text-xs text-neutral-500">
                            {formatTimestamp(receipt.createdAt)}
                          </div>
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
              <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
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
                        className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-4"
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
                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
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
                          className="flex items-start justify-between gap-4 rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3"
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

                <div className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
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
                        className="rounded-xl border border-neutral-800 bg-neutral-950/80 px-4 py-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="font-medium text-white">{ACTOR_LABELS[row.actor]}</div>
                          <div className="text-sm text-neutral-500">
                            Cash {formatCurrency(row.cash)}
                          </div>
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
          <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-5">Place Your Bet</h3>

            {/* Side selector */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => setSelectedSide('LONG')}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  selectedSide === 'LONG'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                YES {(yesPrice * 100).toFixed(0)}¢
              </button>
              <button
                onClick={() => setSelectedSide('SHORT')}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  selectedSide === 'SHORT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                NO {(noPrice * 100).toFixed(0)}¢
              </button>
            </div>

            {/* Amount input */}
            <div className="mb-5">
              <label className="block text-sm text-neutral-500 mb-2">Amount (sats)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
                min="1"
              />
            </div>

            {/* Preview */}
            {preview && (
              <div className="bg-neutral-800/50 rounded-lg p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Cost</span>
                  <span className="text-white">{formatCurrency(preview.sats)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Tokens</span>
                  <span className="text-white">{preview.tokens.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Avg Price</span>
                  <span className="text-white">{(preview.avgPrice * 100).toFixed(1)}¢</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-500">Reserve After</span>
                  <span className="text-white">{formatCurrency(preview.reserveAfter)}</span>
                </div>
              </div>
            )}

            {/* Trade button */}
            <button
              onClick={() => handleTrade(selectedSide)}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                selectedSide === 'LONG'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              Buy {selectedSide === 'LONG' ? 'YES' : 'NO'}
            </button>
          </div>
        </div>
      </div>

      {/* Embed Modal */}
      <EmbedModal
        marketId={market.id}
        marketTitle={market.title}
        isOpen={showEmbedModal}
        onClose={() => setShowEmbedModal(false)}
      />
    </div>
  )
}
