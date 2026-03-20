import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import type { Dispatch } from 'react'
import type { MarketEntry } from './storage'
import type { Side } from './market'
import { priceLong, priceShort, previewTrade } from './market'

// Match the exact Action type from App.tsx
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

export default function MarketDetail({ entry, dispatch }: Props) {
  useParams<{ id: string }>() // URL param handled by router
  const [amount, setAmount] = useState(100)
  const [selectedSide, setSelectedSide] = useState<Side>('LONG')

  const market = entry.market

  // Price calculations
  const yesPrice = priceLong(market.qLong, market.qShort, market.b)
  const noPrice = priceShort(market.qLong, market.qShort, market.b)

  // Preview the trade (5 args: market, actor, kind, side, amount)
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
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="border-b border-gray-800 px-6 py-4">
        <Link to="/" className="text-gray-400 hover:text-white text-sm">
          ← Back to Markets
        </Link>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left column - Chart and info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title */}
            <div>
              <h1 className="text-3xl font-bold mb-2">{market.title}</h1>
              <p className="text-gray-400">{market.description}</p>
            </div>

            {/* Price display */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">YES Price</div>
                <div className="text-2xl font-bold text-green-400">
                  {(yesPrice * 100).toFixed(1)}%
                </div>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-1">NO Price</div>
                <div className="text-2xl font-bold text-red-400">
                  {(noPrice * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Chart placeholder */}
            <div className="bg-gray-800 rounded-lg p-6 h-64 flex items-center justify-center">
              <span className="text-gray-500">Price History Chart</span>
            </div>

            {/* Market stats */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">Market Stats</h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-gray-400">Liquidity (b)</div>
                  <div className="font-medium">{market.b.toFixed(0)}</div>
                </div>
                <div>
                  <div className="text-gray-400">YES Pool (qLong)</div>
                  <div className="font-medium">{market.qLong.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-gray-400">NO Pool (qShort)</div>
                  <div className="font-medium">{market.qShort.toFixed(2)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column - Trade panel */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg p-6 sticky top-6">
              <h3 className="font-semibold mb-4">Place Your Bet</h3>

              {/* Side selector */}
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  onClick={() => setSelectedSide('LONG')}
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    selectedSide === 'LONG'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  YES {(yesPrice * 100).toFixed(0)}¢
                </button>
                <button
                  onClick={() => setSelectedSide('SHORT')}
                  className={`py-3 rounded-lg font-medium transition-colors ${
                    selectedSide === 'SHORT'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  NO {(noPrice * 100).toFixed(0)}¢
                </button>
              </div>

              {/* Amount input */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">Amount (sats)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500"
                  min="1"
                />
              </div>

              {/* Preview */}
              {preview && (
                <div className="bg-gray-700 rounded-lg p-4 mb-4 text-sm">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Cost</span>
                    <span>{preview.sats.toFixed(2)} sats</span>
                  </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Tokens</span>
                    <span>{preview.tokens.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Price</span>
                    <span>{(preview.avgPrice * 100).toFixed(1)}¢</span>
                  </div>
                </div>
              )}

              {/* Trade button */}
              <button
                onClick={() => handleTrade(selectedSide)}
                className={`w-full py-4 rounded-lg font-bold text-lg transition-colors ${
                  selectedSide === 'LONG'
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                Buy {selectedSide === 'LONG' ? 'YES' : 'NO'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
