/**
 * Trade entry orchestration service.
 *
 * Handles the full trade lifecycle:
 *   1. Balance check
 *   2. Cascade trade (POST /v1/cascade/trade) — spends ecash, receives signed tokens
 *   3. Position recording
 *
 * Real-money mode is controlled by the `useRealMoney` parameter passed to
 * `executeTrade`. When omitted it falls back to the VITE_USE_REAL_MONEY build-
 * time env var. When that is also absent/falsy, demo mode is used (position
 * recorded only, no wallet interaction).
 */

import { getWalletBalance } from '../walletStore'
import { addPosition } from '../positionStore'
import { priceLong, priceShort, previewTrade } from '../market'
import type { Market, Side } from '../market'
import { discoverMintForMarket } from './mintDiscoveryService'
import { trackQuote, type Quote } from './quoteService'

// ---------------------------------------------------------------------------
// Feature flag fallback (used when caller does not supply useRealMoney)
// ---------------------------------------------------------------------------

const ENV_USE_REAL_MONEY = import.meta.env.VITE_USE_REAL_MONEY === 'true'

// ---------------------------------------------------------------------------
// Trade fee (1% rake to mint)
// ---------------------------------------------------------------------------

const TRADE_FEE_PERCENT = 0.01  // 1% fee

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type TradeError =
  | { kind: 'insufficient_balance'; balance: number; required: number }
  | { kind: 'wallet_unavailable' }
  | { kind: 'send_failed'; reason: string }
  | { kind: 'invalid_amount' }
  | { kind: 'mint_unavailable' }
  | { kind: 'trade_failed'; reason: string }

export type TradeResult =
  | { success: true; token: string | null; fee: number; quote: Quote | null }
  | { success: false; error: TradeError }

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a trade.
 *
 * In real-money mode: discovers mint, calls POST /v1/cascade/trade, records position.
 * In demo mode: records position only (no wallet interaction).
 *
 * @param market        The market being traded.
 * @param side          'LONG' (YES) or 'SHORT' (NO).
 * @param amount        Amount in sats to spend.
 * @param useRealMoney  Whether to debit the Cashu wallet. Defaults to the
 *                      VITE_USE_REAL_MONEY env var (false when unset).
 * @returns TradeResult — success with optional token, or failure with typed error.
 */
export async function executeTrade(
  market: Market,
  side: Side,
  amount: number,
  useRealMoney: boolean = ENV_USE_REAL_MONEY,
): Promise<TradeResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, error: { kind: 'invalid_amount' } }
  }

  if (useRealMoney) {
    // 1. Discover the mint for this market
    const mintInfo = await discoverMintForMarket(market)
    if (!mintInfo) {
      return { success: false, error: { kind: 'mint_unavailable' } }
    }

    // 2. Balance check
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

    // 3. Call the cascade trade endpoint
    const tradeResult = await executeCascadeTrade(market, side, amount, mintInfo.url)

    if (!tradeResult.success) {
      return { success: false, error: tradeResult.error }
    }

    // 4. Record position with ecash token for redemption/settlement
    _recordPosition(market, side, amount, tradeResult.token || undefined)

    // 5. Track the quote for real-time updates
    if (tradeResult.quote) {
      trackQuote(tradeResult.quote)
    }

    return {
      success: true,
      token: tradeResult.token,
      fee: tradeResult.fee,
      quote: tradeResult.quote,
    }
  }

  // Demo mode: record position only
  _recordPosition(market, side, amount, undefined)
  return { success: true, token: null, fee: 0, quote: null }
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

/**
 * Map response status to valid QuoteStatus.
 */
function mapQuoteStatus(status: string): Quote['status'] {
  switch (status) {
    case 'pending':
      return 'pending'
    case 'processing':
    case 'paid':
      return 'paid'
    case 'complete':
    case 'completed':
      return 'completed'
    case 'expired':
      return 'expired'
    case 'cancelled':
      return 'cancelled'
    case 'failed':
    case 'error':
      return 'failed'
    default:
      return 'pending'
  }
}

/**
 * Execute a cascade trade via the mint's custom trade endpoint.
 */
async function executeCascadeTrade(
  market: Market,
  side: Side,
  amount: number,
  mintUrl: string
): Promise<{ success: true; token: string | null; fee: number; quote: Quote | null } | { success: false; error: { kind: 'trade_failed'; reason: string } }> {
  try {
    // Calculate fee (1%)
    const fee = Math.ceil(amount * TRADE_FEE_PERCENT)

    // Call the cascade trade endpoint
    // The backend mint will handle proof spending internally
    const response = await fetch(`${mintUrl}/v1/cascade/trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        market_slug: market.slug,
        side: side === 'LONG' ? 'yes' : 'no',
        amount_sats: amount,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return {
        success: false,
        error: {
          kind: 'trade_failed',
          reason: errorData.error || `Trade failed with status ${response.status}`
        }
      }
    }

    const data = await response.json() as CascadeTradeResponse

    // Create a quote object for tracking (matching Quote type from quoteService)
    const quote: Quote = {
      id: data.quote_id || `trade_${Date.now()}`,
      marketSlug: market.slug,
      side,
      amount,
      fee: data.fee || fee,
      status: mapQuoteStatus(data.status),
      invoice: data.invoice || null,
      paymentHash: data.payment_hash || null,
      createdAt: Math.floor(Date.now() / 1000),
      expiresAt: data.expires_at || null,
      completedAt: data.completed_at || null,
      error: data.error || null,
    }

    return {
      success: true,
      token: data.token || null,
      fee: data.fee || fee,
      quote,
    }
  } catch (error) {
    return {
      success: false,
      error: {
        kind: 'trade_failed',
        reason: error instanceof Error ? error.message : 'Unknown trade error'
      }
    }
  }
}

interface CascadeTradeResponse {
  quote_id: string
  status: string
  token?: string
  invoice?: string
  payment_hash?: string
  expires_at?: number
  completed_at?: number
  fee?: number
  error?: string
}

function _recordPosition(market: Market, side: Side, amount: number, token?: string): void {
  const price = side === 'LONG'
    ? priceLong(market.qLong, market.qShort, market.b)
    : priceShort(market.qLong, market.qShort, market.b)

  const preview = previewTrade(market, 'you', 'BUY', side, amount)
  const tokens = preview ? preview.tokens : amount / price
  const direction = side === 'LONG' ? 'yes' : 'no'

  addPosition(market.slug, market.title, direction, tokens, price, token)
}
