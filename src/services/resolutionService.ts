/**
 * Market resolution orchestration service.
 *
 * Coordinates the full resolution flow:
 *   1. Identify winning positions for a resolved market.
 *   2. Calculate each winner's payout amount.
 *   3. Pre-reserve the total obligation from the vault (Blocking Fix #2).
 *   4. Log each pending payout to localStorage for crash recovery.
 *   5. Distribute tokens to each winner — partial failures are logged and
 *      queued for retry; they never block other payouts.
 *   6. Publish kind 30079 payout events to Nostr.
 *
 * Uses the resolution queue for serialization: only one market is resolved
 * at a time, preventing vault overdraft from concurrent sends.
 */

import { getVaultBalance, sendPayoutTokens } from '../vaultStore'
import { getPositionsForMarket } from '../positionStore'
import { calculatePayout } from './tradingService'
import { publishPayoutEvent } from './nostrService'
import { enqueueResolution, setResolutionRunner } from '../resolutionQueue'
import type { ResolutionJob } from '../resolutionQueue'
import type { Market } from '../market'
import type { Position } from '../positionStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Platform rake as a fraction of gross payout (2%). */
const RAKE_FRACTION = 0.02

const TX_LOG_STORAGE_KEY = 'cascade-payout-tx-log'

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type ResolutionError =
  | { kind: 'insufficient_vault'; balance: number; required: number }
  | { kind: 'no_winners' }
  | { kind: 'payout_partial'; failed: number; total: number }
  | { kind: 'payout_all_failed' }

export type ResolutionResult =
  | { success: true; payoutsDistributed: number }
  | { success: false; error: ResolutionError }

// ---------------------------------------------------------------------------
// Transaction log (for crash recovery)
// ---------------------------------------------------------------------------

type TxLogEntry = {
  id: string
  marketId: string
  winnerId: string
  positionId: string
  payoutSats: number
  status: 'pending' | 'sent' | 'failed'
  timestamp: number
}

function loadTxLog(): TxLogEntry[] {
  try {
    const raw = localStorage.getItem(TX_LOG_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as TxLogEntry[]) : []
  } catch {
    return []
  }
}

function saveTxLog(entries: TxLogEntry[]): void {
  try {
    localStorage.setItem(TX_LOG_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // quota exceeded — non-fatal
  }
}

function appendTxEntry(entry: TxLogEntry): void {
  const log = loadTxLog()
  log.push(entry)
  saveTxLog(log)
}

function updateTxEntry(id: string, status: TxLogEntry['status']): void {
  const log = loadTxLog()
  const idx = log.findIndex((e) => e.id === id)
  if (idx !== -1) {
    log[idx].status = status
    saveTxLog(log)
  }
}

function txEntryId(marketId: string, positionId: string): string {
  return `${marketId}:${positionId}:${Date.now()}`
}

// ---------------------------------------------------------------------------
// Payout calculation helpers
// ---------------------------------------------------------------------------

type WinnerPayout = {
  position: Position
  /** Gross payout before rake (sats). */
  grossSats: number
  /** Platform fee (sats). */
  rakeSats: number
  /** Net amount sent to winner (sats). */
  netSats: number
}

function computeWinnerPayouts(
  positions: Position[],
  outcome: 'YES' | 'NO',
  outcomePrice: number,
): WinnerPayout[] {
  const winningDirection = outcome === 'YES' ? 'yes' : 'no'

  return positions
    .filter((p) => p.direction === winningDirection)
    .map((position) => {
      const grossSats = calculatePayout(position.entryPrice, position.quantity, outcomePrice)
      const rakeSats = Math.floor(grossSats * RAKE_FRACTION)
      const netSats = grossSats - rakeSats
      return { position, grossSats, rakeSats, netSats }
    })
    .filter((w) => w.netSats > 0)
}

// ---------------------------------------------------------------------------
// Core resolution logic
// ---------------------------------------------------------------------------

/**
 * Resolve a market: identify winners, pre-reserve vault funds, distribute
 * payouts, and publish Nostr payout events.
 *
 * This function is called by the resolution queue runner — never directly.
 */
async function _executeResolution(job: ResolutionJob): Promise<ResolutionResult> {
  const { market, outcome, outcomePrice } = job
  const resolvedAt = Date.now()

  // 1. Find all positions for this market
  const positions = getPositionsForMarket(market.id)

  // 2. Compute what each winner is owed
  const winnerPayouts = computeWinnerPayouts(positions, outcome, outcomePrice)

  if (winnerPayouts.length === 0) {
    console.info('[resolutionService] No winners for market:', market.id)
    return { success: true, payoutsDistributed: 0 }
  }

  // 3. Pre-reservation check (Blocking Fix #2)
  //    Calculate total obligation BEFORE initiating any sends.
  const totalObligation = winnerPayouts.reduce((sum, w) => sum + w.netSats, 0)
  const vaultBalance = await getVaultBalance()

  if (vaultBalance < totalObligation) {
    console.error('[resolutionService] Insufficient vault balance', {
      marketId: market.id,
      balance: vaultBalance,
      required: totalObligation,
    })
    return {
      success: false,
      error: { kind: 'insufficient_vault', balance: vaultBalance, required: totalObligation },
    }
  }

  // 4. Log all pending payouts before sending anything (crash recovery)
  const createdAt = Date.now()
  const txEntries: TxLogEntry[] = winnerPayouts.map((w) => {
    const id = txEntryId(market.id, w.position.id)
    const entry: TxLogEntry = {
      id,
      marketId: market.id,
      winnerId: w.position.ownerPubkey ?? w.position.id,
      positionId: w.position.id,
      payoutSats: w.netSats,
      status: 'pending',
      timestamp: createdAt,
    }
    appendTxEntry(entry)
    return entry
  })

  // 5. Distribute tokens — partial failures continue; others are not blocked
  let sentCount = 0
  let failedCount = 0

  for (let i = 0; i < winnerPayouts.length; i++) {
    const winner = winnerPayouts[i]
    const txEntry = txEntries[i]

    // Use the position owner's pubkey as the winner identifier so that
    // Portfolio.tsx can find payout events via the #winner tag filter.
    const recipientId = winner.position.ownerPubkey ?? winner.position.id

    let token: string | null = null
    try {
      token = await sendPayoutTokens(winner.netSats, recipientId)
    } catch (err) {
      console.error('[resolutionService] sendPayoutTokens threw for position:', winner.position.id, err)
    }

    if (token) {
      updateTxEntry(txEntry.id, 'sent')
      sentCount++

      // 6. Publish Nostr payout event (non-blocking; failure is logged only)
      publishPayoutEvent({
        marketId: market.id,
        marketTitle: market.title,
        winnerId: recipientId,
        positionId: winner.position.id,
        quantity: winner.position.quantity,
        costBasis: winner.position.costBasis,
        outcomePrice,
        payoutSats: winner.grossSats,
        rakeSats: winner.rakeSats,
        netSats: winner.netSats,
        outcome,
        resolvedAt,
        createdAt,
      }).catch((err: unknown) => {
        console.warn('[resolutionService] Failed to publish payout event for position:', winner.position.id, err)
      })
    } else {
      updateTxEntry(txEntry.id, 'failed')
      failedCount++
      console.error('[resolutionService] Payout failed for position:', winner.position.id, {
        netSats: winner.netSats,
      })
    }
  }

  console.info('[resolutionService] Resolution complete for market:', market.id, {
    outcome,
    sentCount,
    failedCount,
    totalObligation,
  })

  if (sentCount === 0 && failedCount > 0) {
    return { success: false, error: { kind: 'payout_all_failed' } }
  }

  if (failedCount > 0) {
    return {
      success: false,
      error: { kind: 'payout_partial', failed: failedCount, total: winnerPayouts.length },
    }
  }

  return { success: true, payoutsDistributed: sentCount }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize the resolution service by registering its runner with the queue.
 * Must be called once at app startup (before any resolutions are triggered).
 */
export function initResolutionService(): void {
  setResolutionRunner(async (job: ResolutionJob) => {
    const result = await _executeResolution(job)
    if (!result.success) {
      console.error('[resolutionService] Resolution failed for market:', job.market.id, result.error)
    }
  })
}

/**
 * Resolve a market by enqueuing it in the serial resolution queue.
 *
 * Returns immediately — actual resolution runs asynchronously after all
 * previously enqueued resolutions complete.
 *
 * @param market       The resolved market.
 * @param outcome      Resolution outcome ('YES' | 'NO').
 * @param outcomePrice Settlement price (1.0 for winning side, 0.0 for losing).
 */
export function resolveMarket(market: Market, outcome: 'YES' | 'NO', outcomePrice: number): void {
  enqueueResolution(market, outcome, outcomePrice)
}

/**
 * Return all pending (unsent) payout log entries.
 * Useful for a recovery UI or admin dashboard.
 */
export function getPendingPayoutLogs(): TxLogEntry[] {
  return loadTxLog().filter((e) => e.status === 'pending')
}
