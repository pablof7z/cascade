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

import { getPositionsForMarket } from '../positionStore'
import { enqueueResolution, setResolutionRunner } from '../resolutionQueue'
import type { ResolutionJob } from '../resolutionQueue'
import type { Market } from '../market'
import type { Position } from '../positionStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Platform rake as a fraction of gross payout (2%). */
// Now handled by redemptionService — kept for reference
// const RAKE_FRACTION = 0.02

/** Transaction log storage key - kept for getPendingPayoutLogs() API */
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
// Core resolution logic
// ---------------------------------------------------------------------------

/**
 * Resolve a market: update status and publish resolution event.
 *
 * Payouts are now handled by user-initiated redemption via redemptionService.
 * This keeps resolution as a lightweight state transition.
 */
async function _executeResolution(job: ResolutionJob): Promise<ResolutionResult> {
  const { market, outcome, outcomePrice } = job

  // Resolution is now a simple state update + event publish.
  // User-initiated redemption (via redemptionService) handles payouts.
  console.info('[withdrawalService] Market resolved:', market.slug, { outcome, outcomePrice })

  // Future: could add resolution event publishing here if needed.
  // For now, market status update is handled by the caller (marketStore).

  return { success: true, payoutsDistributed: 0 }
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
      console.error('[withdrawalService] Resolution failed for market:', job.market.slug, (result as { success: false; error: ResolutionError }).error)
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
