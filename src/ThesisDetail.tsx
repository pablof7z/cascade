import { useParams, Link } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import { getThesisDefinition } from './marketCatalog'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import type { Dispatch } from 'react'
import { useState } from 'react'
import Discussion from './Discussion'
import MarkdownContent from './components/MarkdownContent'

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

type Props = {
  thesisId?: string
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

export default function ThesisDetail({ markets, dispatch }: Props) {
  const { id } = useParams<{ id: string }>()
  const [betSide, setBetSide] = useState<Side>('LONG')
  const [betAmount, setBetAmount] = useState('100')

  const entry = id ? markets[id] : undefined

  if (!entry) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Thesis not found</h2>
        <Link
          to="/"
          className="inline-block px-4 py-2 border border-neutral-700 text-neutral-300 rounded-lg hover:border-neutral-600 hover:text-white"
        >
          Back to markets
        </Link>
      </div>
    )
  }

  const { market } = entry
  const metrics = deriveMarketMetrics(market)
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

  const handlePlaceBet = () => {
    const amount = Number(betAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    dispatch({
      type: 'TRADE',
      marketId: market.id,
      side: betSide,
      amount: amount,
      actor: 'you',
      kind: 'BUY',
    })
    setBetAmount('100')
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Back link */}
      <Link to="/" className="text-sm text-neutral-500 hover:text-white mb-8 inline-block">
        ← Back to markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12">
        {/* Main content */}
        <div className="space-y-10">
          {/* Header with dominant probability */}
          <header>
            <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
              Thesis market
            </div>
            <h1 className="text-2xl font-semibold text-white mb-2">
              {thesis?.statement ?? market.title}
            </h1>
            <p className="text-neutral-500 text-sm">
              Build the case, attach signal markets, and trade the argument in public.
            </p>

            {/* Dominant probability - typography does the work */}
            <div className="mt-8">
              <div className="text-6xl font-bold text-white tracking-tight">
                {formatPercent(metrics.longPositionShare)}
              </div>
              <div className="mt-3 h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${metrics.longPositionShare * 100}%` }}
                />
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-emerald-400">{formatPercent(metrics.longPositionShare)} YES</span>
                <span className="text-rose-400">{formatPercent(metrics.shortPositionShare)} NO</span>
              </div>
            </div>
          </header>

          <section>
            <div className="text-xs text-neutral-600 uppercase tracking-wider mb-4">Thesis</div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-6">
              <MarkdownContent
                content={thesis?.argument ?? market.description}
                className="text-base leading-7 text-neutral-300"
              />
            </div>
          </section>

          {/* Related Modules - flat list, no cards */}
          <section>
            <div className="text-xs text-neutral-600 uppercase tracking-wider mb-4">Related Modules</div>

            {relatedSignals.length > 0 ? (
              <div className="divide-y divide-neutral-800">
                {relatedSignals.map((signal, index) => (
                  <div key={`${signal.moduleTitle}-${index}`} className="py-4 first:pt-0 last:pb-0">
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
                          <h3 className="text-white font-medium">{signal.moduleTitle}</h3>
                        )}
                        <div className="mt-1 text-sm text-neutral-500">
                          {signal.note || 'No rationale added for this signal yet.'}
                        </div>
                        {signal.probability !== undefined ? (
                          <div className="mt-2 text-xs text-neutral-500">
                            Live YES {formatPercent(signal.probability)}
                          </div>
                        ) : (
                          <div className="mt-2 text-xs text-neutral-600">Mock-only signal link</div>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          signal.expectedOutcome === 'YES'
                            ? 'bg-emerald-500/10 text-emerald-300'
                            : 'bg-rose-500/10 text-rose-300'
                        }`}
                      >
                        Expect {signal.expectedOutcome}
                      </span>
                    </div>
                    {signal.probability !== undefined ? (
                      <div className="mt-3 h-1 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500/60"
                          style={{ width: `${signal.probability * 100}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-neutral-800 p-5 text-sm text-neutral-500">
                No signal markets attached yet. Launch from the thesis builder to connect this argument to specific modules.
              </div>
            )}
          </section>

          {/* Stats - inline, no card */}
          <div className="flex gap-8 text-sm border-t border-neutral-800 pt-6">
            <div>
              <div className="text-neutral-600 mb-1">Reserve</div>
              <div className="text-white">{formatCurrency(market.reserve)}</div>
            </div>
            <div>
              <div className="text-neutral-600 mb-1">Trades</div>
              <div className="text-white">{market.quotes.length}</div>
            </div>
            <div>
              <div className="text-neutral-600 mb-1">Modules</div>
              <div className="text-white">{relatedSignals.length}</div>
            </div>
          </div>

          {/* Discussion */}
          <Discussion
            marketTitle={market.title}
            marketKind="thesis"
            consensus={metrics.longPositionShare}
            reserve={market.reserve}
            tradeCount={market.quotes.length}
            thesisSignals={thesis?.signals}
          />
        </div>

        {/* Sidebar - Trade Panel (THE ONLY CARD) */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-5">Trade</h3>

            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setBetSide('LONG')}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  betSide === 'LONG'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setBetSide('SHORT')}
                className={`py-3 rounded-lg font-medium transition-colors ${
                  betSide === 'SHORT'
                    ? 'bg-rose-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                NO
              </button>
            </div>

            {/* Amount */}
            <label className="block mb-5">
              <span className="text-sm text-neutral-500 mb-2 block">Amount</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="100"
                  className="w-full pl-8 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                />
              </div>
            </label>

            {/* Preview */}
            <div className="bg-neutral-800/50 rounded-lg p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Return</span>
                <span className="text-white">
                  {formatCurrency(
                    Number(betAmount) *
                      (betSide === 'LONG'
                        ? 1 / metrics.longPositionShare
                        : 1 / metrics.shortPositionShare)
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-500">Odds</span>
                <span className="text-white">
                  {betSide === 'LONG'
                    ? formatPercent(metrics.longPositionShare)
                    : formatPercent(metrics.shortPositionShare)}
                </span>
              </div>
            </div>

            {/* Submit */}
            <button
              type="button"
              onClick={handlePlaceBet}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                betSide === 'LONG'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              Buy {betSide === 'LONG' ? 'YES' : 'NO'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
