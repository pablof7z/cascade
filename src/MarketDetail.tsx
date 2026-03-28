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
        className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-6"
      >
        ← Back to Markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left column - Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Title */}
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-3">
              {market.title}
            </h1>
            {market.description && (
              <p className="text-neutral-400">{market.description}</p>
            )}
          </div>

          {/* Price display */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div className="text-sm text-neutral-400 mb-1">YES Price</div>
              <div className="text-3xl font-bold text-green-400">
                {(yesPrice * 100).toFixed(1)}¢
              </div>
            </div>
            <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-xl">
              <div className="text-sm text-neutral-400 mb-1">NO Price</div>
              <div className="text-3xl font-bold text-red-400">
                {(noPrice * 100).toFixed(1)}¢
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="text-sm font-medium text-neutral-400 mb-4">Price History</h3>
            <div className="h-64">
              <PriceChart data={entry.history} />
            </div>
          </div>

          <Discussion
            marketTitle={market.title}
            marketKind="module"
            consensus={yesPrice}
            reserve={market.reserve}
            tradeCount={market.quotes.length}
          />

          {/* Market stats */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Market Stats</h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div className="text-sm text-neutral-400 mb-1">Liquidity (b)</div>
                <div className="text-lg font-medium text-white">{market.b.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400 mb-1">YES Pool (qLong)</div>
                <div className="text-lg font-medium text-white">{market.qLong.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-400 mb-1">NO Pool (qShort)</div>
                <div className="text-lg font-medium text-white">{market.qShort.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Trade panel */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 bg-neutral-900 border border-neutral-800 rounded-xl p-6">
            <h3 className="font-semibold text-white mb-4">Place Your Bet</h3>

            {/* Side selector */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <button
                onClick={() => setSelectedSide('LONG')}
                className={`py-3 rounded-lg font-medium ${
                  selectedSide === 'LONG'
                    ? 'bg-green-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                YES {(yesPrice * 100).toFixed(0)}¢
              </button>
              <button
                onClick={() => setSelectedSide('SHORT')}
                className={`py-3 rounded-lg font-medium ${
                  selectedSide === 'SHORT'
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                NO {(noPrice * 100).toFixed(0)}¢
              </button>
            </div>

            {/* Amount input */}
            <div className="mb-5">
              <label className="block text-sm text-neutral-400 mb-2">Amount (sats)</label>
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
              <div className="bg-neutral-800 rounded-lg p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Cost</span>
                  <span className="text-white">{formatCurrency(preview.sats)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Tokens</span>
                  <span className="text-white">{preview.tokens.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Avg Price</span>
                  <span className="text-white">{(preview.avgPrice * 100).toFixed(1)}¢</span>
                </div>
              </div>
            )}

            {/* Trade button */}
            <button
              onClick={() => handleTrade(selectedSide)}
              className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                selectedSide === 'LONG'
                  ? 'bg-green-600 hover:bg-green-500 text-white'
                  : 'bg-red-600 hover:bg-red-500 text-white'
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
