import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPositions, type Position } from './positionStore'
import { load as loadMarkets } from './storage'
import { priceLong, priceShort } from './market'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function formatCurrency(value: number) {
  return `$${currencyFormatter.format(value)}`
}

function formatPercent(value: number) {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

type EnrichedPosition = Position & {
  currentPrice: number
  marketValue: number
  pnl: number
  pnlPercent: number
}

function enrichPositions(positions: Position[]): EnrichedPosition[] {
  const markets = loadMarkets()
  return positions.map((pos) => {
    const entry = markets?.[pos.marketId]
    let currentPrice = pos.entryPrice // fallback if market not found
    if (entry) {
      const m = entry.market
      currentPrice =
        pos.direction === 'yes'
          ? priceLong(m.qLong, m.qShort, m.b)
          : priceShort(m.qLong, m.qShort, m.b)
    }
    const marketValue = pos.quantity * currentPrice
    const pnl = marketValue - pos.costBasis
    const pnlPercent = pos.costBasis > 0 ? (pnl / pos.costBasis) * 100 : 0
    return { ...pos, currentPrice, marketValue, pnl, pnlPercent }
  })
}

export default function Portfolio() {
  const [positions, setPositions] = useState<EnrichedPosition[]>([])

  useEffect(() => {
    setPositions(enrichPositions(loadPositions()))

    // Re-enrich when tab regains focus (prices may have changed)
    const onFocus = () => setPositions(enrichPositions(loadPositions()))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const totalInvested = positions.reduce((s, p) => s + p.costBasis, 0)
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0)
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const winners = positions.filter((p) => p.pnl > 0).length
  const winRate = positions.length > 0 ? (winners / positions.length) * 100 : 0

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        <p className="text-neutral-400 mt-1">Track your positions and performance</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Total Invested</span>
          <span className="block text-xl font-bold text-white mt-1">{formatCurrency(totalInvested)}</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Current Value</span>
          <span className="block text-xl font-bold text-white mt-1">{formatCurrency(totalValue)}</span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Total P&L</span>
          <span className={`block text-xl font-bold mt-1 ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {formatCurrency(totalPnl)} ({formatPercent(totalPnlPercent)})
          </span>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 p-4">
          <span className="text-xs text-neutral-500 uppercase tracking-wider">Positions / Win Rate</span>
          <span className="block text-xl font-bold text-white mt-1">
            {positions.length} <span className="text-sm text-neutral-400">/ {winRate.toFixed(0)}%</span>
          </span>
        </div>
      </div>

      {/* Position cards */}
      {positions.length === 0 ? (
        <div className="text-center py-16 bg-neutral-900 border border-neutral-800">
          <p className="text-neutral-400 text-lg mb-2">No positions yet</p>
          <p className="text-neutral-500 text-sm mb-4">
            Place your first trade on any market to see it here.
          </p>
          <Link
            to="/"
            className="inline-block border border-neutral-700 text-neutral-300 text-sm font-medium px-4 py-1.5 hover:text-white hover:border-neutral-500 transition-colors"
          >
            Browse Markets
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {positions.map((position) => (
            <Link
              key={position.id}
              to={`/market/${encodeURIComponent(position.marketId)}`}
              className="block bg-neutral-900 border border-neutral-800 p-4 hover:border-neutral-600 transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 text-xs font-medium ${
                    position.direction === 'yes'
                      ? 'text-emerald-400 border border-emerald-800/60'
                      : 'text-rose-400 border border-rose-800/60'
                  }`}
                >
                  {position.direction === 'yes' ? 'YES' : 'NO'}
                </span>
                <span className="text-xs text-neutral-500">
                  {new Date(position.timestamp).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-white font-medium mb-3">{position.marketTitle}</h3>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <span className="text-xs text-neutral-500 block">Shares</span>
                  <span className="text-sm text-white">{position.quantity.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block">Avg Price</span>
                  <span className="text-sm text-white">{(position.entryPrice * 100).toFixed(0)}¢</span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block">Current</span>
                  <span className="text-sm text-white">{(position.currentPrice * 100).toFixed(0)}¢</span>
                </div>
                <div>
                  <span className="text-xs text-neutral-500 block">P&L</span>
                  <span className={`text-sm ${position.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(position.pnl)} ({formatPercent(position.pnlPercent)})
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
