/**
 * Serial resolution queue.
 *
 * Ensures market resolutions are processed one at a time to prevent
 * vault overdraft from concurrent payout attempts. Uses a FIFO Promise
 * chain to serialize all resolution jobs.
 */

import type { Market } from './market'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolutionJob = {
  market: Market
  outcome: 'YES' | 'NO'
  outcomePrice: number
}

type JobRunner = (job: ResolutionJob) => Promise<void>

// ---------------------------------------------------------------------------
// Internal queue state
// ---------------------------------------------------------------------------

/** Tail of the current promise chain — new jobs are appended here */
let _tail: Promise<void> = Promise.resolve()

/** Active job runner — registered via setResolutionRunner() */
let _runner: JobRunner | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register the function that executes a resolution job.
 * Must be called before any jobs are enqueued.
 */
export function setResolutionRunner(runner: JobRunner): void {
  _runner = runner
}

/**
 * Enqueue a market resolution.
 * Runs after all previously enqueued resolutions complete.
 * Errors in individual jobs are logged but do not block the queue.
 *
 * @param market       The resolved market.
 * @param outcome      Resolution outcome ('YES' | 'NO').
 * @param outcomePrice Settled price for payout math.
 */
export function enqueueResolution(market: Market, outcome: 'YES' | 'NO', outcomePrice: number): void {
  const job: ResolutionJob = { market, outcome, outcomePrice }

  _tail = _tail.then(async () => {
    if (!_runner) {
      console.warn('[resolutionQueue] No runner registered — skipping job for market:', market.slug)
      return
    }
    try {
      await _runner(job)
    } catch (err) {
      console.error('[resolutionQueue] Resolution job failed for market:', market.slug, err)
      // Swallow error — queue continues processing subsequent jobs
    }
  })
}
