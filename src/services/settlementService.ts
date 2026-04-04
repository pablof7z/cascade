/**
 * Settlement Service - Phase 7: Settlement & Withdrawal
 * Handles mid-market redemption and post-resolution claiming
 */

import type { Position } from '../positionStore'

// Backend mint URL - should come from environment/config
const MINT_URL = import.meta.env.VITE_CASCADE_MINT_URL || 'https://mint.cascade.market'

export interface RedemptionQuote {
  id: string
  amount: number // sats to receive
  fee: number // melt cost in sats
  expiry: number // Unix timestamp
}

export interface SettlementResult {
  success: boolean
  token?: string // new ecash token for the received sats
  settlementProof?: string
  message?: string
}

/**
 * Get mid-market redemption quote for a position
 * This returns the current value of the position minus fees
 */
export async function getRedemptionQuote(
  position: Position,
): Promise<RedemptionQuote> {
  // Mid-market price: average of long and short prices
  // For simplicity, we use the entry price as approximation
  // In production, this should fetch live prices from the market
  const currentPrice = position.entryPrice
  const positionValue = position.quantity * currentPrice

  // Mint melt fee (typically 0.1% - 1%)
  const meltFeeRate = 0.001
  const meltFee = Math.max(1, Math.floor(positionValue * meltFeeRate))

  // Net amount after fees
  const netAmount = positionValue - meltFee

  return {
    id: `redemption-${position.id}-${Date.now()}`,
    amount: netAmount,
    fee: meltFee,
    expiry: Date.now() + 5 * 60 * 1000, // 5 minutes
  }
}

/**
 * Redeem a position at mid-market price
 * Posts the ecash token to the mint and receives sats back
 */
export async function redeemPosition(
  position: Position,
  quantity?: number, // optional partial redemption
  mintUrl: string = MINT_URL
): Promise<SettlementResult> {
  if (!position.positionProof) {
    return {
      success: false,
      message: 'No proof token found for this position. Position may have been created with an older version.',
    }
  }

  const redeemQuantity = quantity ?? position.quantity

  try {
    // Step 1: Get a minting quote for the ecash we're burning
    // The mint will give us a quote for the sats to receive
    const quoteResponse = await fetch(`${mintUrl}/v1/cascade/quote-mint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: Math.floor(redeemQuantity * position.entryPrice),
        unit: 'sat',
      }),
    })

    if (!quoteResponse.ok) {
      return {
        success: false,
        message: `Failed to get mint quote: ${quoteResponse.statusText}`,
      }
    }

    const mintQuote = await quoteResponse.json()

    // Step 2: Send the ecash token (melt) with the mint quote
    const meltResponse = await fetch(`${mintUrl}/v1/melt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: position.positionProof,
        quote: mintQuote.quote,
      }),
    })

    if (!meltResponse.ok) {
      return {
        success: false,
        message: `Failed to melt ecash: ${meltResponse.statusText}`,
      }
    }

    const meltResult = await meltResponse.json()

    return {
      success: true,
      token: meltResult.token,
      settlementProof: meltResult.proof,
      message: `Redeemed ${redeemQuantity} shares for ${meltResult.amount} sats`,
    }
  } catch (error) {
    return {
      success: false,
      message: `Redemption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Claim payout after market resolution
 * Different from redemption - this is for resolved markets
 */
export async function claimPositionPayout(
  position: Position,
  resolutionOutcome: number, // 0-1 (0 = NO, 1 = YES)
  mintUrl: string = MINT_URL
): Promise<SettlementResult> {
  if (position.settled) {
    return {
      success: false,
      message: 'Position has already been settled',
    }
  }

  // Calculate payout based on outcome
  // If YES and direction is LONG, or NO and direction is SHORT: win
  // Winner receives 1.0 * quantity in sats
  // Loser receives 0
  const isWinner =
    (resolutionOutcome === 1 && position.direction === 'yes') ||
    (resolutionOutcome === 0 && position.direction === 'no')

  if (!isWinner) {
    return {
      success: false,
      message: 'Position did not win. No payout available.',
    }
  }

  if (!position.positionProof) {
    return {
      success: false,
      message: 'No proof token found for this position',
    }
  }

  try {
    // Claim the payout from the resolved market
    const claimResponse = await fetch(`${mintUrl}/v1/cascade/settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proof: position.positionProof,
        marketId: position.marketId,
        outcome: resolutionOutcome,
      }),
    })

    if (!claimResponse.ok) {
      return {
        success: false,
        message: `Failed to claim payout: ${claimResponse.statusText}`,
      }
    }

    const claimResult = await claimResponse.json()

    return {
      success: true,
      token: claimResult.token,
      settlementProof: claimResult.proof,
      message: `Claimed ${claimResult.amount} sats payout!`,
    }
  } catch (error) {
    return {
      success: false,
      message: `Claim failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Withdraw sats to Lightning invoice (NUT-05 melt)
 * This melts ecash tokens to receive sats via Lightning
 */
export async function withdrawToLightning(
  amount: number, // amount in sats
  invoice: string, // bolt11 invoice
  mintUrl: string = MINT_URL
): Promise<{ success: boolean; preimage?: string; message?: string }> {
  try {
    const response = await fetch(`${mintUrl}/v1/melt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice,
        amount,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }))
      return {
        success: false,
        message: error.message || `Melt failed: ${response.statusText}`,
      }
    }

    const result = await response.json()

    if (result.paid) {
      return {
        success: true,
        preimage: result.preimage,
        message: `Withdrew ${amount} sats successfully!`,
      }
    } else {
      return {
        success: false,
        message: 'Lightning payment not completed',
      }
    }
  } catch (error) {
    return {
      success: false,
      message: `Withdrawal failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/**
 * Get settlement status for a position
 */
export function isPositionSettled(position: Position): boolean {
  return position.settled === true
}

/**
 * Check if a position can be redeemed (pre-resolution)
 */
export function canRedeemPosition(position: Position): boolean {
  return !isPositionSettled(position) && !!position.positionProof
}

/**
 * Format settlement amount for display
 */
export function formatSettlementAmount(amount: number): string {
  if (amount >= 1000) {
    return `${(amount / 1000).toFixed(1)}k`
  }
  return amount.toString()
}
