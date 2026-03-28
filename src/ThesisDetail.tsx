import { useParams, Link } from 'react-router-dom'
import { deriveMarketMetrics, type Side } from './market'
import type { MarketEntry } from './storage'
import type { Action } from './App'
import type { Dispatch } from 'react'
import { useState } from 'react'
import Discussion from './Discussion'

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

interface SupportingModule {
  id: string
  title: string
  probability: number
  impact: number
  direction: 'supports' | 'opposes'
}

const mockSupportingModules: SupportingModule[] = [
  {
    id: 'mod-1',
    title: 'AGI achieved by 2030',
    probability: 0.35,
    impact: 15,
    direction: 'supports',
  },
  {
    id: 'mod-2',
    title: 'US implements UBI pilot program',
    probability: 0.42,
    impact: 8,
    direction: 'supports',
  },
  {
    id: 'mod-3',
    title: 'Major tech company announces mass layoffs due to AI',
    probability: 0.68,
    impact: 12,
    direction: 'supports',
  },
  {
    id: 'mod-4',
    title: 'Real wages grow 2%+ annually through 2030',
    probability: 0.55,
    impact: -20,
    direction: 'opposes',
  },
]

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
      <Link to="/" className="text-sm text-neutral-500 hover:text-white mb-6 inline-block">
        ← Back to markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <header>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              {market.title}
            </h1>
            {market.description && (
              <p className="text-neutral-400">{market.description}</p>
            )}
          </header>

          {/* Probability display */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-sm text-neutral-500">Probability</span>
              <span className="text-2xl font-bold text-white">
                {formatPercent(metrics.longPositionShare)}
              </span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-green-500 rounded-full"
                style={{ width: `${metrics.longPositionShare * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-500">{formatPercent(metrics.longPositionShare)}</span>
              <span className="text-red-500">{formatPercent(metrics.shortPositionShare)}</span>
            </div>
          </div>

          {/* Related Modules */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-4">Related modules</h2>

            <div className="space-y-3">
              {mockSupportingModules.map((mod) => (
                <div
                  key={mod.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h3 className="font-medium text-white">{mod.title}</h3>
                    <span
                      className={`text-sm ${
                        mod.direction === 'supports' ? 'text-green-500' : 'text-red-500'
                      }`}
                    >
                      {mod.direction === 'supports' ? '↑' : '↓'} {mod.impact > 0 ? '+' : ''}{mod.impact}%
                    </span>
                  </div>
                  <div className="flex gap-6 text-sm text-neutral-500">
                    <span>{formatPercent(mod.probability)}</span>
                  </div>
                  <div className="h-1 bg-neutral-800 rounded-full overflow-hidden mt-3">
                    <div
                      className={`h-full rounded-full ${
                        mod.direction === 'supports' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${mod.probability * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Discussion */}
          <section className="pt-6 border-t border-neutral-800">
            <Discussion
              marketTitle={market.title}
              marketKind="thesis"
              consensus={metrics.longPositionShare}
              reserve={market.reserve}
              tradeCount={market.quotes.length}
            />
          </section>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Bet Panel */}
          <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4">Trade</h3>

            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setBetSide('LONG')}
                className={`py-3 rounded-lg font-medium ${
                  betSide === 'LONG'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setBetSide('SHORT')}
                className={`py-3 rounded-lg font-medium ${
                  betSide === 'SHORT'
                    ? 'bg-red-600 text-white'
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
            <div className="bg-neutral-800 rounded-lg p-4 mb-5 space-y-2">
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
              className={`w-full py-4 rounded-lg font-medium text-lg ${
                betSide === 'LONG'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              Buy {betSide === 'LONG' ? 'YES' : 'NO'}
            </button>
          </div>

          {/* Market Stats */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
            <h3 className="font-semibold text-white mb-4">Stats</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Reserve</span>
                <span className="text-white">{formatCurrency(market.reserve)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Trades</span>
                <span className="text-white">{market.quotes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Modules</span>
                <span className="text-white">{mockSupportingModules.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
