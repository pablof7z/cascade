import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { Dispatch } from 'react'
import type { Action } from './App'
import Discussion from './Discussion'
import { deriveMarketMetrics, type Side } from './market'
import { getThesisDefinition, inferMarketType } from './marketCatalog'
import type { MarketEntry } from './storage'

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
  markets: Record<string, MarketEntry>
  dispatch: Dispatch<Action>
}

export default function ThesisDetail({ markets, dispatch }: Props) {
  const { id } = useParams<{ id: string }>()
  const [betSide, setBetSide] = useState<Side>('LONG')
  const [betAmount, setBetAmount] = useState('100')

  const entry = id ? markets[id] : undefined
  const market = entry?.market
  const thesis = market ? getThesisDefinition(market) : undefined
  const metrics = market ? deriveMarketMetrics(market) : null

  const signalCards = useMemo(() => {
    if (!thesis) {
      return []
    }

    const entries = Object.values(markets)

    return thesis.signals.map((signal) => {
      const linkedEntry =
        (signal.moduleMarketId ? markets[signal.moduleMarketId] : undefined) ??
        entries.find(
          (candidate) =>
            inferMarketType(candidate.market) === 'module' &&
            candidate.market.title === signal.moduleTitle,
        )

      const linkedMetrics = linkedEntry ? deriveMarketMetrics(linkedEntry.market) : null
      const liveLean =
        linkedMetrics?.longOdds !== undefined
          ? linkedMetrics.longOdds >= 0.5
            ? 'YES'
            : 'NO'
          : null

      return {
        signal,
        linkedEntry,
        linkedMetrics,
        liveLean,
        isContrarian: liveLean ? liveLean !== signal.expectedOutcome : false,
      }
    })
  }, [markets, thesis])

  if (!entry) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Thesis not found</h2>
        <Link
          to="/"
          className="inline-block px-4 py-2 border border-neutral-600 text-neutral-300 rounded-lg hover:border-neutral-500 hover:text-white transition-colors"
        >
          Back to markets
        </Link>
      </div>
    )
  }

  if (!market || !metrics) {
    return null
  }

  const handlePlaceBet = () => {
    const amount = Number(betAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    dispatch({
      type: 'TRADE',
      marketId: market.id,
      side: betSide,
      amount,
      actor: 'you',
      kind: 'BUY',
    })
    setBetAmount('100')
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-sm text-neutral-400 hover:text-white">
          Back to Markets
        </Link>
        <span className="px-2 py-1 text-xs font-medium bg-amber-500/20 text-amber-400 rounded">
          Thesis
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <header className="space-y-4">
            <div className="inline-flex px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-xs uppercase tracking-[0.18em] text-neutral-400">
              Open-ended thesis market
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                {thesis?.statement ?? market.title}
              </h1>
              <p className="text-neutral-400 max-w-3xl">
                LONG means the thesis eventually plays out. SHORT means reality breaks the
                story.
              </p>
            </div>
          </header>

          <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-sm text-neutral-400">Current thesis price</span>
              <span className="text-2xl font-bold text-white">
                {formatPercent(metrics.longOdds)}
              </span>
            </div>
            <div className="h-3 bg-neutral-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
                style={{ width: `${metrics.longOdds * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-emerald-400">
                LONG {formatPercent(metrics.longOdds)}
              </span>
              <span className="text-rose-400">
                SHORT {formatPercent(metrics.shortOdds)}
              </span>
            </div>
          </div>

          <section className="p-6 bg-neutral-900 border border-neutral-800 rounded-xl">
            <h2 className="text-lg font-semibold text-white mb-3">
              What this thesis is saying
            </h2>
            <p className="text-white text-lg mb-4">
              {thesis?.statement ?? market.title}
            </p>
            <div className="pt-4 border-t border-neutral-800">
              <h3 className="text-sm font-medium text-neutral-300 mb-2">
                Why the builder thinks this happens
              </h3>
              <p className="text-neutral-300 whitespace-pre-line">
                {thesis?.argument ?? market.description}
              </p>
            </div>
          </section>

          <Discussion
            marketTitle={market.title}
            marketKind="thesis"
            consensus={metrics.longOdds}
            reserve={market.reserve}
            tradeCount={market.quotes.length}
            thesisSignals={signalCards.map(({ signal }) => signal)}
          />

          <section>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Signal markets
                </h2>
                <p className="text-sm text-neutral-400">
                  These markets are directional proof, not formula inputs.
                </p>
              </div>
              <span className="text-sm text-neutral-500">
                {signalCards.length} attached
              </span>
            </div>

            {signalCards.length === 0 ? (
              <div className="p-5 bg-neutral-900 border border-dashed border-neutral-800 rounded-xl">
                <p className="text-sm text-neutral-300 mb-2">
                  No signal markets were attached to this thesis.
                </p>
                <p className="text-sm text-neutral-500">
                  The market stands on the thesis narrative alone for now.
                </p>
              </div>
            ) : (
              <div className="grid gap-4">
                {signalCards.map(({ signal, linkedEntry, linkedMetrics, liveLean, isContrarian }) => (
                  <div
                    key={`${signal.moduleMarketId ?? signal.moduleTitle}-${signal.expectedOutcome}`}
                    className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className="font-medium text-white">{signal.moduleTitle}</h3>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              signal.expectedOutcome === 'YES'
                                ? 'bg-emerald-500/15 text-emerald-300'
                                : 'bg-rose-500/15 text-rose-300'
                            }`}
                          >
                            Resolves {signal.expectedOutcome}
                          </span>
                        </div>
                        <p className="text-sm text-neutral-300">
                          {signal.note || 'No written rationale for this signal.'}
                        </p>
                      </div>

                      {linkedEntry ? (
                        <Link
                          to={`/market/${linkedEntry.market.id}`}
                          className="text-sm text-neutral-300 hover:text-white"
                        >
                          Open module {'->'}
                        </Link>
                      ) : (
                        <span className="text-sm text-neutral-500">
                          No live module linked
                        </span>
                      )}
                    </div>

                    {linkedEntry && linkedMetrics ? (
                      <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
                        <span className="px-2 py-1 rounded-full bg-neutral-800 text-neutral-300">
                          Current YES {formatPercent(linkedMetrics.longOdds)}
                        </span>
                        <span className="px-2 py-1 rounded-full bg-neutral-800 text-neutral-300">
                          Reserve {formatCurrency(linkedEntry.market.reserve)}
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full ${
                            isContrarian
                              ? 'bg-amber-500/15 text-amber-300'
                              : 'bg-neutral-800 text-neutral-300'
                          }`}
                        >
                          {isContrarian
                            ? `Current market leans ${liveLean}`
                            : `Current market also leans ${liveLean}`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-2">Place a Bet</h3>
            <p className="text-sm text-neutral-400 mb-5">
              LONG backs the thesis. SHORT backs the world breaking the thesis.
            </p>

            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setBetSide('LONG')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  betSide === 'LONG'
                    ? 'bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-2 ring-offset-neutral-900'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                LONG
              </button>
              <button
                type="button"
                onClick={() => setBetSide('SHORT')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  betSide === 'SHORT'
                    ? 'bg-rose-600 text-white ring-2 ring-rose-500 ring-offset-2 ring-offset-neutral-900'
                    : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                }`}
              >
                SHORT
              </button>
            </div>

            <label className="block mb-5">
              <span className="text-sm text-neutral-400 mb-2 block">Amount</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={betAmount}
                  onChange={(event) => setBetAmount(event.target.value)}
                  placeholder="100"
                  className="w-full pl-8 pr-4 py-3 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-500"
                />
              </div>
            </label>

            <div className="bg-neutral-800 rounded-lg p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Potential return</span>
                <span className="text-white">
                  {formatCurrency(
                    Number(betAmount) *
                      (betSide === 'LONG'
                        ? 1 / metrics.longOdds
                        : 1 / metrics.shortOdds),
                  )}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Current odds</span>
                <span className="text-white">
                  {betSide === 'LONG'
                    ? formatPercent(metrics.longOdds)
                    : formatPercent(metrics.shortOdds)}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handlePlaceBet}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                betSide === 'LONG'
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              Place Bet
            </button>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Thesis Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Reserve</span>
                <span className="text-white font-medium">{formatCurrency(market.reserve)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Total Trades</span>
                <span className="text-white font-medium">{market.quotes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Signal Markets</span>
                <span className="text-white font-medium">{signalCards.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-400">Live Links</span>
                <span className="text-white font-medium">
                  {signalCards.filter((card) => card.linkedEntry).length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
