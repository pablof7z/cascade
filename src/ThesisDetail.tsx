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
          className="inline-block px-4 py-2 border border-gray-600 text-gray-300 rounded-lg hover:border-gray-500 hover:text-white transition-colors"
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
      {/* Breadcrumb */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/" className="text-sm text-gray-400 hover:text-white">
          ← All Markets
        </Link>
        <span className="px-2 py-1 text-xs font-medium bg-purple-500/20 text-purple-400 rounded">
          Thesis
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <header>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              {market.title}
            </h1>
            {market.description && (
              <p className="text-gray-400">{market.description}</p>
            )}
          </header>

          {/* Probability display */}
          <div className="p-5 bg-gray-900 border border-gray-800 rounded-xl">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-sm text-gray-400">Current Probability</span>
              <span className="text-2xl font-bold text-white">
                {formatPercent(metrics.longPositionShare)}
              </span>
            </div>
            <div className="h-3 bg-gray-800 rounded-full overflow-hidden mb-3">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full"
                style={{ width: `${metrics.longPositionShare * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-400">LONG {formatPercent(metrics.longPositionShare)}</span>
              <span className="text-red-400">SHORT {formatPercent(metrics.shortPositionShare)}</span>
            </div>
          </div>

          {/* Related Modules */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-2">Related Modules</h2>
            <p className="text-sm text-gray-400 mb-4">
              Linked context for this thesis
            </p>

            <div className="grid gap-4">
              {mockSupportingModules.map((mod) => (
                <div
                  key={mod.id}
                  className="p-4 bg-gray-900 border border-gray-800 rounded-xl"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded text-sm font-bold ${
                        mod.direction === 'supports'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}
                    >
                      {mod.direction === 'supports' ? '↑' : '↓'}
                    </span>
                    <h3 className="font-medium text-white">{mod.title}</h3>
                  </div>
                  <div className="flex gap-6 text-sm mb-3">
                    <div>
                      <span className="text-gray-500">Module Prob.</span>
                      <span className="ml-2 text-white">{formatPercent(mod.probability)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Impact</span>
                      <span
                        className={`ml-2 ${
                          mod.direction === 'supports' ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        If YES → Thesis {mod.impact > 0 ? '+' : ''}{mod.impact}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
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
          <section className="pt-6 border-t border-gray-800">
            <Discussion />
          </section>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Bet Panel */}
          <div className="sticky top-24 bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Place a Bet</h3>

            {/* Side toggle */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                type="button"
                onClick={() => setBetSide('LONG')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  betSide === 'LONG'
                    ? 'bg-green-600 text-white ring-2 ring-green-500 ring-offset-2 ring-offset-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                LONG
              </button>
              <button
                type="button"
                onClick={() => setBetSide('SHORT')}
                className={`py-3 rounded-lg font-medium transition-all ${
                  betSide === 'SHORT'
                    ? 'bg-red-600 text-white ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                SHORT
              </button>
            </div>

            {/* Amount */}
            <label className="block mb-5">
              <span className="text-sm text-gray-400 mb-2 block">Amount</span>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="100"
                  className="w-full pl-8 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-gray-500"
                />
              </div>
            </label>

            {/* Preview */}
            <div className="bg-gray-800 rounded-lg p-4 mb-5 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Potential return</span>
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
                <span className="text-gray-400">Current odds</span>
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
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
              }`}
            >
              Place Bet
            </button>
          </div>

          {/* Market Stats */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Market Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-400">Total Reserve</span>
                <span className="text-white font-medium">{formatCurrency(market.reserve)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Trades</span>
                <span className="text-white font-medium">{market.quotes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Related Modules</span>
                <span className="text-white font-medium">{mockSupportingModules.length}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
