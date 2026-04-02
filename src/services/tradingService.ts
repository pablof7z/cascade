/**
 * Trade entry orchestration service.
 *
 * Handles the full trade lifecycle:
 *   1. Balance check
 *   2. Wallet debit (when real-money mode is active)
 *   3. Position recording
 *
 * Controlled by the VITE_USE_REAL_MONEY feature flag.
 * When the flag is absent or falsy, trades record positions only (demo mode).
 */

import { getWalletBalance, sendTokens } from '../walletStore'
import { addPosition } from '../positionStore'
import { priceLong, priceShort, previewTrade } from '../market'
import type { Market, Side } from '../market'

// ---------------------------------------------------------------------------
// Feature flag
// ---------------------------------------------------------------------------

const USE_REAL_MONEY = import.meta.env.VITE_USE_REAL_MONEY === 'true'

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type TradeError =
  | { kind: 'insufficient_balance'; balance: number; required: number }
  | { kind: 'wallet_unavailable' }
  | { kind: 'send_failed'; reason: string }
  | { kind: 'invalid_amount' }

export type TradeResult =
  | { success: true; token: string | null }
  | { success: false; error: TradeError }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a trade.
 *
 * In real-money mode: checks balance, debits wallet, then records position.
 * In demo mode: records position only (no wallet interaction).
 *
 * @param market  The market being traded.
 * @param side    'LONG' (YES) or 'SHORT' (NO).
 * @param amount  Amount in sats to spend.
 * @returns TradeResult — success with optional token, or failure with typed error.
 */
export async function executeTrade(
  market: Market,
  side: Side,
  amount: number,
): Promise<TradeResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: { kind: 'invalid_amount' } }
  }

  if (USE_REAL_MONEY) {
    // 1. Balance check
    let balance: number
    try {
      balance = await getWalletBalance()
    } catch {
      return { success: false, error: { kind: 'wallet_unavailable' } }
    }

    if (balance < amount) {
      return {
        success: false,
        error: { kind: 'insufficient_balance', balance, required: amount },
      }
    }

    // 2. Debit wallet
    let token: string | null
    try {
      const memo = `Cascade trade: ${market.title} — ${side === 'LONG' ? 'YES' : 'NO'} ${amount} sats`
      token = await sendTokens(amount, memo)
    } catch {
      return { success: false, error: { kind: 'send_failed', reason: 'Wallet send threw an error' } }
    }

    if (!token) {
      return { success: false, error: { kind: 'send_failed', reason: 'Wallet returned no token' } }
    }

    // 3. Record position
    _recordPosition(market, side, amount)

    return { success: true, token }
  }

  // Demo mode: record position only
  _recordPosition(market, side, amount)
  return { success: true, token: null }
}

/**
 * Calculate payout for a winning position after market resolution.
 *
 * @param entryPrice  Price paid per share at trade time.
 * @param quantity    Number of shares held.
 * @param outcomePrice  Final settlement price (1.0 for winners, 0.0 for losers).
 * @returns Payout in sats.
 */
export function calculatePayout(
  _entryPrice: number,
  quantity: number,
  outcomePrice: number,
): number {
  // Each winning share pays out at $1; losing shares pay $0.
  // outcomePrice is 1.0 for the winning side, 0.0 for the losing side.
  const grossPayout = quantity * outcomePrice
  return Math.floor(grossPayout)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function _recordPosition(market: Market, side: Side, amount: number): void {
  const price = side === 'LONG'
    ? priceLong(market.qLong, market.qShort, market.b)
    : priceShort(market.qLong, market.qShort, market.b)

  const preview = previewTrade(market, 'you', 'BUY', side, amount)
  const tokens = preview ? preview.tokens : amount / price
  const direction = side === 'LONG' ? 'yes' : 'no'

  addPosition(market.id, market.title, direction, tokens, price)
}
