import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadPositions, type Position } from './positionStore'
import { load as loadMarkets } from './storage'
import { priceLong, priceShort } from './market'
import { fetchPayoutEvents, getPubkey } from './services/nostrService'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import { redeemPosition, canRedeemPosition, getRedemptionQuote } from './services/settlementService'

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

// ---------------------------------------------------------------------------
// Payout history helpers
// ---------------------------------------------------------------------------

type PayoutRecord = {
  marketId: string
  marketTitle: string
  outcome: 'YES' | 'NO'
  payoutSats: number
  rakeSats: number
  netSats: number
  resolvedAt: number
}

function parsePayoutEvent(event: NDKEvent): PayoutRecord | null {
  try {
    const tag = (name: string) => event.tags.find((t) => t[0] === name)?.[1] ?? ''
    const marketId = tag('market')
    const marketTitle = tag('market-title')
    const outcome = tag('outcome') as 'YES' | 'NO'
    const payoutSats = parseInt(tag('payout-sats'), 10)
    const rakeSats = parseInt(tag('rake-sats'), 10)
    const netSats = parseInt(tag('net-sats'), 10)
    const resolvedAt = parseInt(tag('resolved-at'), 10)

    if (!marketId || !outcome || isNaN(payoutSats)) return null
    return { marketId, marketTitle, outcome, payoutSats, rakeSats, netSats, resolvedAt }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Portfolio() {
  const [positions, setPositions] = useState<EnrichedPosition[]>([])
  const [payouts, setPayouts] = useState<PayoutRecord[]>([])
  const [payoutsLoading, setPayoutsLoading] = useState(false)
  // Settlement state (Phase 7)
  const [redeemingPosition, setRedeemingPosition] = useState<Position | null>(null)
  const [redemptionAmount, setRedemptionAmount] = useState<number | null>(null)
  const [redemptionLoading, setRedemptionLoading] = useState(false)
  const [redemptionMessage, setRedemptionMessage] = useState<string | null>(null)

  useEffect(() => {
    setPositions(enrichPositions(loadPositions()))

    // Re-enrich when tab regains focus (prices may have changed)
    const onFocus = () => setPositions(enrichPositions(loadPositions()))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  useEffect(() => {
    const pubkey = getPubkey()
    if (!pubkey) return

    setPayoutsLoading(true)
    fetchPayoutEvents(pubkey)
      .then((events) => {
        const records = events
          .map(parsePayoutEvent)
          .filter((r): r is PayoutRecord => r !== null)
          .sort((a, b) => b.resolvedAt - a.resolvedAt)
        setPayouts(records)
      })
      .catch((err: unknown) => {
        console.warn('[Portfolio] Failed to fetch payout events:', err)
      })
      .finally(() => setPayoutsLoading(false))
  }, [])

  const totalInvested = positions.reduce((s, p) => s + p.costBasis, 0)
  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalPnl = positions.reduce((s, p) => s + p.pnl, 0)
  const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0
  const winners = positions.filter((p) => p.pnl > 0).length
  const winRate = positions.length > 0 ? (winners / positions.length) * 100 : 0

  // Phase 7: Settlement handlers
  const handleRedeem = async (position: Position) => {
    if (!canRedeemPosition(position)) {
      setRedemptionMessage('This position cannot be redeemed.')
      return
    }
    setRedeemingPosition(position)
    setRedemptionLoading(true)
    setRedemptionMessage(null)
    try {
      const quote = await getRedemptionQuote(position)
      setRedemptionAmount(quote.amount)
    } catch {
      setRedemptionMessage('Failed to get redemption quote. Please try again.')
      setRedemptionAmount(null)
    } finally {
      setRedemptionLoading(false)
    }
  }

  const confirmRedeem = async () => {
    if (!redeemingPosition) return
    setRedemptionLoading(true)
    setRedemptionMessage(null)
    try {
      const result = await redeemPosition(redeemingPosition)
      if (result.success) {
        setRedemptionMessage(`Redeemed! Received ${redemptionAmount} sats.`)
        setRedeemingPosition(null)
        setRedemptionAmount(null)
        // Refresh positions
        setPositions(enrichPositions(loadPositions()))
      } else {
        setRedemptionMessage(result.message || 'Redemption failed.')
      }
    } catch {
      setRedemptionMessage('Redemption failed. Please try again.')
    } finally {
      setRedemptionLoading(false)
    }
  }

  const cancelRedeem = () => {
    setRedeemingPosition(null)
    setRedemptionAmount(null)
    setRedemptionMessage(null)
  }

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

      {/* Payout history */}
      {(payoutsLoading || payouts.length > 0) && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-3">Closed Positions</h2>
          {payoutsLoading ? (
            <p className="text-neutral-500 text-sm py-4">Loading payout history…</p>
          ) : (
            <div className="divide-y divide-neutral-800 border border-neutral-800">
              {payouts.map((payout, idx) => (
                <div key={`${payout.marketId}-${payout.resolvedAt}-${idx}`} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`px-2 py-0.5 text-xs font-medium ${
                        payout.outcome === 'YES'
                          ? 'text-emerald-400 border border-emerald-800/60'
                          : 'text-rose-400 border border-rose-800/60'
                      }`}
                    >
                      {payout.outcome}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {new Date(payout.resolvedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-white font-medium text-sm mb-2">{payout.marketTitle}</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-xs text-neutral-500 block">Payout</span>
                      <span className="text-sm text-white font-mono">{payout.payoutSats} sats</span>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-500 block">Rake</span>
                      <span className="text-sm text-neutral-400 font-mono">−{payout.rakeSats} sats</span>
                    </div>
                    <div>
                      <span className="text-xs text-neutral-500 block">Net</span>
                      <span className="text-sm text-emerald-400 font-mono">{payout.netSats} sats</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Phase 7: Redemption confirmation */}
      {redeemingPosition && (
        <div className="bg-neutral-900 border border-emerald-700/60 p-4 mb-4">
          <h3 className="text-white font-medium mb-3">Confirm Redemption</h3>
          <div className="text-sm text-neutral-400 mb-4">
            <p className="mb-1">
              <span className="text-neutral-500">Position:</span>{' '}
              <span className="text-white">{redeemingPosition.marketTitle}</span>
            </p>
            <p className="mb-1">
              <span className="text-neutral-500">Direction:</span>{' '}
              <span className={redeemingPosition.direction === 'yes' ? 'text-emerald-400' : 'text-rose-400'}>
                {redeemingPosition.direction === 'yes' ? 'YES' : 'NO'}
              </span>
            </p>
            <p className="mb-1">
              <span className="text-neutral-500">Shares:</span>{' '}
              <span className="text-white">{redeemingPosition.quantity.toFixed(1)}</span>
            </p>
            <p className="text-lg text-emerald-400 font-medium mt-3">
              You will receive:{' '}
              {redemptionLoading ? (
                <span className="text-neutral-400">Calculating...</span>
              ) : (
                <>
                  {redemptionAmount !== null ? (
                    `${redemptionAmount} sats`
                  ) : (
                    <span className="text-rose-400">Failed to get quote</span>
                  )}
                </>
              )}
            </p>
          </div>
          {redemptionMessage && (
            <p className={`text-sm mb-3 ${redemptionMessage.includes('Redeemed') ? 'text-emerald-400' : 'text-rose-400'}`}>
              {redemptionMessage}
            </p>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={confirmRedeem}
              disabled={redemptionLoading || redemptionAmount === null}
              className="flex-1 bg-emerald-700 text-white text-sm font-medium px-4 py-2 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {redemptionLoading ? 'Processing...' : 'Confirm'}
            </button>
            <button
              type="button"
              onClick={cancelRedeem}
              className="flex-1 border border-neutral-700 text-neutral-300 text-sm font-medium px-4 py-2 hover:border-neutral-500 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

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
              {/* Phase 7: Redeem button */}
              {canRedeemPosition(position) && !position.settled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleRedeem(position)
                  }}
                  className="mt-3 w-full border border-emerald-700 text-emerald-400 text-xs font-medium px-3 py-1.5 hover:bg-emerald-900/20 transition-colors"
                >
                  Redeem
                </button>
              )}
              {position.settled && (
                <span className="mt-3 block w-full text-center border border-neutral-700 text-neutral-500 text-xs font-medium px-3 py-1.5">
                  Settled
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
