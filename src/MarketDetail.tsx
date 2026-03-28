import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Dispatch } from 'react'
import type { MarketEntry } from './storage'
import type { Side } from './market'
import { priceLong, priceShort, previewTrade } from './market'
import Discussion from './Discussion'
import PriceChart from './PriceChart'

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
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

export default function MarketDetail({ entry, dispatch }: Props) {
  const [amount, setAmount] = useState(100)
  const [selectedSide, setSelectedSide] = useState<Side>('LONG')

  const market = entry.market

  const yesPrice = priceLong(market.qLong, market.qShort, market.b)
  const noPrice = priceShort(market.qLong, market.qShort, market.b)

  const preview = previewTrade(market, 'you', 'BUY', selectedSide, amount)

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
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-white mb-8"
      >
        ← Back to Markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12">
        {/* Left column - Main content */}
        <div className="space-y-10">
          {/* Header with dominant probability */}
          <header>
            <h1 className="text-2xl font-semibold text-white mb-2">
              {market.title}
            </h1>
            {market.description && (
              <p className="text-neutral-500 text-sm">{market.description}</p>
            )}
            
            {/* Dominant price display - typography does the work */}
            <div className="mt-8 flex items-baseline gap-8">
              <div>
                <div className="text-5xl font-bold text-emerald-400 tracking-tight">
                  {(yesPrice * 100).toFixed(0)}¢
                </div>
                <div className="text-sm text-neutral-500 mt-1">YES</div>
              </div>
              <div>
                <div className="text-5xl font-bold text-rose-400 tracking-tight">
                  {(noPrice * 100).toFixed(0)}¢
                </div>
                <div className="text-sm text-neutral-500 mt-1">NO</div>
              </div>
            </div>
          </header>

          {/* Chart - no card wrapper, just the chart */}
          <div>
            <div className="text-xs text-neutral-600 uppercase tracking-wider mb-3">Price History</div>
            <div className="h-56">
              <PriceChart data={entry.history} />
            </div>
          </div>

          {/* Market stats - inline, no card */}
          <div className="flex gap-8 text-sm border-t border-neutral-800 pt-6">
            <div>
              <div className="text-neutral-600 mb-1">Liquidity</div>
              <div className="text-white">{market.b.toFixed(0)}</div>
            </div>
            <div>
              <div className="text-neutral-600 mb-1">YES Pool</div>
              <div className="text-white">{market.qLong.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-neutral-600 mb-1">NO Pool</div>
              <div className="text-white">{market.qShort.toFixed(2)}</div>
            </div>
          </div>

          {/* Discussion - full width below */}
          <Discussion
            marketTitle={market.title}
            marketKind="module"
            consensus={yesPrice}
            reserve={market.reserve}
            tradeCount={market.quotes.length}
          />
        </div>

        {/* Right column - Trade panel (THE ONLY CARD) */}
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
    </div>
  )
}
