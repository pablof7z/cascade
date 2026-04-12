/**
 * redemptionService.ts — Atomic market redemption payouts
 *
 * Implements user-initiated redemption of resolved market positions.
 * Three-layer defense against double-pay:
 *   1. Local: position.settled flag
 *   2. Nostr: kind:30079 event idempotency
 *   3. Cashu: mint proof consumption via /v1/swap (NUT-03)
 */

import type NDK from '@nostr-dev-kit/ndk'
import type { NDKEvent } from '@nostr-dev-kit/ndk'
import type { Market } from '../market'
import type { Position } from '../positionStore'
import { priceLong, priceShort, computeOutcomePrice } from '../market'
import { publishPayoutEvent, fetchPayoutEvent, PAYOUT_EVENT_KIND } from './nostrService'
import { sendPayoutTokens } from '../vaultStore'
import { markPositionSettled } from '../positionStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RedemptionErrorCode =
  | 'market_not_resolved'
  | 'outcome_mismatch'
  | 'already_redeemed'
  | 'insufficient_depth'
  | 'zero_payout'
  | 'token_send_failed'
  | 'position_not_found'
  | 'unknown_error'

export type RedemptionPayout = {
  fillPrice: number
  grossSats: number
  rakeSats: number
  netSats: number
}

export type RedemptionError = {
  code: RedemptionErrorCode
  message: string
}

export type RedemptionResult =
  | { success: true; payout: RedemptionPayout; token: string; eventId: string }
  | { success: false; error: RedemptionError }

// Pending payout events for recovery on app load
const PENDING_PAYOUT_EVENTS_KEY = 'cascade:pendingPayoutEvents'

type PendingPayoutEvent = {
  marketSlug: string
  positionId: string
  params: Parameters<typeof publishPayoutEvent>[0]
  retries: number
}

// ---------------------------------------------------------------------------
// Payout computation
// ---------------------------------------------------------------------------

/**
 * Compute the payout for a position based on LMSR fill price.
 * Uses the market's resolution outcome to determine which price to use.
 */
export function computeRedemptionPayout(market: Market, position: Position): RedemptionPayout {
  const fillPrice =
    market.resolutionOutcome === 'YES'
      ? priceLong(market.qLong, market.qShort, market.b)
      : priceShort(market.qLong, market.qShort, market.b)

  const grossSats = Math.floor(position.quantity * fillPrice)
  const rakeSats = Math.floor(grossSats * 0.02)
  const netSats = grossSats - rakeSats

  return { fillPrice, grossSats, rakeSats, netSats }
}

// ---------------------------------------------------------------------------
// Idempotency check
// ---------------------------------------------------------------------------

/**
 * Check if a position has already been redeemed by querying kind:30079.
 */
export async function hasBeenRedeemed(
  marketSlug: string,
  positionId: string,
  ndk: NDK
): Promise<boolean> {
  const existingEvent = await fetchPayoutEvent(marketSlug, positionId)
  return existingEvent !== null
}

// ---------------------------------------------------------------------------
// Pending event recovery
// ---------------------------------------------------------------------------

function getPendingPayoutEvents(): PendingPayoutEvent[] {
  if (typeof localStorage === 'undefined') return []
  try {
    const stored = localStorage.getItem(PENDING_PAYOUT_EVENTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function savePendingPayoutEvent(event: PendingPayoutEvent): void {
  if (typeof localStorage === 'undefined') return
  const pending = getPendingPayoutEvents()
  const existing = pending.findIndex(
    (p) => p.marketSlug === event.marketSlug && p.positionId === event.positionId
  )
  if (existing >= 0) {
    pending[existing] = event
  } else {
    pending.push(event)
  }
  localStorage.setItem(PENDING_PAYOUT_EVENTS_KEY, JSON.stringify(pending))
}

function removePendingPayoutEvent(marketSlug: string, positionId: string): void {
  if (typeof localStorage === 'undefined') return
  const pending = getPendingPayoutEvents().filter(
    (p) => !(p.marketSlug === marketSlug && p.positionId === positionId)
  )
  localStorage.setItem(PENDING_PAYOUT_EVENTS_KEY, JSON.stringify(pending))
}

/**
 * Recover any pending payout events that failed to publish.
 * Call this on app initialization.
 */
export async function recoverPendingPayoutEvents(ndk: NDK): Promise<void> {
  const pending = getPendingPayoutEvents()
  if (pending.length === 0) return

  console.log(`[redemptionService] Recovering ${pending.length} pending payout events`)

  for (const event of pending) {
    if (event.retries >= 3) {
      console.warn(
        `[redemptionService] Dropping pending payout event after 3 retries:`,
        event.marketSlug,
        event.positionId
      )
      removePendingPayoutEvent(event.marketSlug, event.positionId)
      continue
    }

    try {
      await publishPayoutEvent(event.params)
      removePendingPayoutEvent(event.marketSlug, event.positionId)
      console.log(`[redemptionService] Recovered payout event:`, event.marketSlug, event.positionId)
    } catch (err) {
      console.error(`[redemptionService] Failed to recover payout event:`, err)
      savePendingPayoutEvent({ ...event, retries: event.retries + 1 })
    }
  }
}

// ---------------------------------------------------------------------------
// Main redemption flow
// ---------------------------------------------------------------------------

/**
 * Redeem a resolved market position.
 *
 * Step-by-step atomic flow:
 * 1. VALIDATE: market.status === 'resolved', outcome matches direction, not settled
 * 2. IDEMPOTENCY: Query kind:30079 with d-tag filter
 * 3. COMPUTE: fillPrice, grossSats, rakeSats, netSats
 * 4. SEND TOKENS: Call sendPayoutTokens(netSats, pubkey)
 * 5. PUBLISH: kind:30079 event (with retry on failure)
 * 6. UPDATE STATE: markPositionSettled(positionId)
 */
export async function redeemPosition(
  market: Market,
  position: Position,
  ndk: NDK
): Promise<RedemptionResult> {
  try {
    // ---- STEP 1: VALIDATE ----

    // Check market is resolved
    if (market.status !== 'resolved') {
      return {
        success: false,
        error: { code: 'market_not_resolved', message: 'This market hasn\'t been resolved yet.' },
      }
    }

    // Check position direction matches market outcome
    const directionOutcome = position.direction.toUpperCase() as 'YES' | 'NO'
    if (directionOutcome !== market.resolutionOutcome) {
      return {
        success: false,
        error: { code: 'outcome_mismatch', message: 'Your position doesn\'t match the market outcome.' },
      }
    }

    // Check position not already settled
    if (position.settled) {
      return {
        success: false,
        error: { code: 'already_redeemed', message: 'This position has already been redeemed.' },
      }
    }

    // ---- STEP 2: IDEMPOTENCY CHECK ----

    const alreadyRedeemed = await hasBeenRedeemed(market.slug, position.id, ndk)
    if (alreadyRedeemed) {
      return {
        success: false,
        error: { code: 'already_redeemed', message: 'This position has already been redeemed.' },
      }
    }

    // ---- STEP 3: COMPUTE PAYOUT ----

    const payout = computeRedemptionPayout(market, position)

    // Check for zero payout
    if (payout.netSats <= 0) {
      return {
        success: false,
        error: { code: 'zero_payout', message: 'No payout available for this position.' },
      }
    }

    // Check reserve depth
    if (payout.netSats > market.reserve) {
      return {
        success: false,
        error: { code: 'insufficient_depth', message: 'This market doesn\'t have enough liquidity for this redemption right now.' },
      }
    }

    // ---- STEP 4: SEND TOKENS ----
    // CRITICAL: recipientPubkey is the position owner's pubkey
    const recipientPubkey = position.ownerPubkey
    const token = await sendPayoutTokens(payout.netSats, recipientPubkey)
    if (!token) {
      return {
        success: false,
        error: { code: 'token_send_failed', message: 'Failed to send tokens. Please try again.' },
      }
    }

    // ---- STEP 5: PUBLISH PAYOUT EVENT ----
    // If this fails, user has tokens (good) but idempotency record is missing.
    // Cashu proof consumption prevents double-pay. Save to localStorage for recovery.

    const payoutEventParams = {
      marketSlug: market.slug,
      marketTitle: market.title,
      redeemerId: position.ownerPubkey,
      positionId: position.id,
      direction: position.direction.toLowerCase() as 'yes' | 'no',
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      fillPrice: payout.fillPrice,
      grossSats: payout.grossSats,
      rakeSats: payout.rakeSats,
      netSats: payout.netSats,
      outcome: market.resolutionOutcome,
      redeemedAt: Date.now(),
    }

    let eventId: string
    try {
      const event = await publishPayoutEvent(payoutEventParams)
      eventId = event.id ?? 'unknown'
    } catch (publishErr) {
      // Retry up to 3 times with exponential backoff
      let published = false
      for (let attempt = 0; attempt < 3; attempt++) {
        const delay = Math.pow(2, attempt) * 1000 // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay))
        try {
          const event = await publishPayoutEvent(payoutEventParams)
          eventId = event.id ?? 'unknown'
          published = true
          break
        } catch {
          // continue to next retry
        }
      }

      if (!published) {
        // Save for recovery — user has tokens, idempotency record will be added later
        savePendingPayoutEvent({
          marketSlug: market.slug,
          positionId: position.id,
          params: payoutEventParams,
          retries: 0,
        })
        console.error('[redemptionService] Failed to publish payout event after 3 retries, saved for recovery')
        // Note: We still consider this a partial success since user has tokens.
        // The event will be published on next app load via recoverPendingPayoutEvents().
        eventId = 'pending_recovery'
      }
    }

    // ---- STEP 6: UPDATE STATE ----

    markPositionSettled(position.id)

    return {
      success: true,
      payout,
      token,
      eventId,
    }
  } catch (err) {
    console.error('[redemptionService] Unexpected error:', err)
    return {
      success: false,
      error: { code: 'unknown_error', message: 'An unexpected error occurred. Please try again.' },
    }
  }
}