/**
 * Deposit Service — Lightning Invoice → Cashu Tokens
 *
 * Handles the flow of depositing sats into the Cascade wallet:
 * 1. Create a Lightning invoice via the mint
 * 2. Wait for the invoice to be paid (Lightning payment received)
 * 3. Mint receives the sats and mints Cashu tokens
 * 4. Tokens are sent to the wallet (ecash receipt)
 *
 * This service integrates with the existing walletStore but provides
 * a higher-level API for the deposit flow.
 */

import type { Market } from '../market'
import { createDeposit, type NDKCashuDeposit } from '../walletStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DepositStatus = 
  | 'idle'           // No deposit in progress
  | 'creating'       // Creating invoice
  | 'waiting'        // Invoice created, waiting for payment
  | 'paid'           // Invoice paid, minting tokens
  | 'completed'      // Tokens received in wallet
  | 'failed'         // Deposit failed

export type Deposit = {
  id: string              // Unique deposit ID
  amount: number          // Amount in sats
  mintUrl: string         // Mint URL used
  status: DepositStatus
  quoteId: string | null  // Quote ID from the mint
  createdAt: number       // Unix timestamp
  error: string | null    // Error message if failed
}

export type DepositCallbacks = {
  onStatusChange?: (deposit: Deposit, newStatus: DepositStatus) => void
  onInvoiceCreated?: (deposit: Deposit) => void
  onPaymentReceived?: (deposit: Deposit) => void
  onTokensReceived?: (deposit: Deposit, tokens: string) => void
  onError?: (deposit: Deposit, error: string) => void
}

// ---------------------------------------------------------------------------
// Active deposits tracking
// ---------------------------------------------------------------------------

const activeDeposits = new Map<string, Deposit>()
const ndkDepositMap = new Map<string, NDKCashuDeposit>()

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new deposit for a given market.
 *
 * @param market Optional market to deposit for (uses default mint if not provided)
 * @param amount Amount in sats to deposit
 * @param options Additional options
 * @param options.callbacks Callbacks for deposit events
 * @returns Deposit object or null if creation failed
 */
export async function createMarketDeposit(
  market: Market | null,
  amount: number,
  options: { callbacks?: DepositCallbacks } = {}
): Promise<Deposit | null> {
  const { callbacks = {} } = options

  // Determine mint URL
  const mintUrl = market?.mint || getDefaultMintUrl()

  // Generate unique deposit ID
  const depositId = generateDepositId()

  // Create initial deposit state
  const deposit: Deposit = {
    id: depositId,
    amount,
    mintUrl,
    status: 'creating',
    quoteId: null,
    createdAt: Math.floor(Date.now() / 1000),
    error: null,
  }

  // Store deposit
  activeDeposits.set(depositId, deposit)
  notifyStatusChange(deposit, callbacks)

  try {
    // Create invoice via wallet
    const ndkDeposit = await createDeposit(amount, mintUrl)
    
    if (!ndkDeposit) {
      throw new Error('Failed to create deposit')
    }

    // Store NDK deposit for later use
    ndkDepositMap.set(depositId, ndkDeposit)

    // Start monitoring for payment
    // The start() method returns the quote ID and starts monitoring
    const quoteId = await ndkDeposit.start()
    
    // Update deposit with quote ID
    deposit.quoteId = quoteId
    deposit.status = 'waiting'

    notifyStatusChange(deposit, callbacks)
    if (callbacks.onInvoiceCreated) {
      callbacks.onInvoiceCreated(deposit)
    }

    // Set up event listeners
    ndkDeposit.on('success', (token) => {
      const d = activeDeposits.get(depositId)
      if (d) {
        d.status = 'completed'
        notifyStatusChange(d, callbacks)
        
        if (callbacks.onTokensReceived) {
          callbacks.onTokensReceived(d, JSON.stringify(token))
        }
      }
    })

    ndkDeposit.on('error', (error) => {
      const d = activeDeposits.get(depositId)
      if (d) {
        d.status = 'failed'
        d.error = typeof error === 'string' ? error : 'Unknown error'
        notifyStatusChange(d, callbacks)
        
        if (callbacks.onError) {
          callbacks.onError(d, d.error)
        }
      }
    })

    // Also check periodically for finalized status (as backup to events)
    startStatusPolling(depositId, ndkDeposit, callbacks)

    return deposit
  } catch (error) {
    deposit.status = 'failed'
    deposit.error = error instanceof Error ? error.message : 'Unknown error'
    notifyStatusChange(deposit, callbacks)
    if (callbacks.onError) {
      callbacks.onError(deposit, deposit.error)
    }
    return deposit
  }
}

/**
 * Get the current status of a deposit.
 *
 * @param depositId The deposit ID to look up
 * @returns Deposit or null if not found
 */
export function getDeposit(depositId: string): Deposit | null {
  return activeDeposits.get(depositId) || null
}

/**
 * Get all active deposits.
 */
export function getAllDeposits(): Deposit[] {
  return Array.from(activeDeposits.values())
}

/**
 * Get all deposits for a specific mint URL.
 */
export function getDepositsByMint(mintUrl: string): Deposit[] {
  return Array.from(activeDeposits.values()).filter(d => d.mintUrl === mintUrl)
}

/**
 * Cancel a pending deposit.
 *
 * @param depositId The deposit ID to cancel
 */
export function cancelDeposit(depositId: string): void {
  ndkDepositMap.delete(depositId)
  activeDeposits.delete(depositId)
}

/**
 * Clear all completed/failed deposits from tracking.
 */
export function clearInactiveDeposits(): void {
  for (const [id, deposit] of activeDeposits) {
    if (deposit.status === 'completed' || deposit.status === 'failed') {
      ndkDepositMap.delete(id)
      activeDeposits.delete(id)
    }
  }
}

/**
 * Clear all deposits (including active ones).
 */
export function clearAllDeposits(): void {
  ndkDepositMap.clear()
  activeDeposits.clear()
}

/**
 * Format a deposit for display.
 *
 * @param deposit The deposit to format
 * @returns Human-readable string
 */
export function formatDepositStatus(deposit: Deposit): string {
  switch (deposit.status) {
    case 'idle':
      return 'Idle'
    case 'creating':
      return 'Creating invoice...'
    case 'waiting':
      return `Waiting for payment (${deposit.amount} sats)`
    case 'paid':
      return 'Payment received, minting tokens...'
    case 'completed':
      return `Completed (${deposit.amount} sats received)`
    case 'failed':
      return `Failed: ${deposit.error || 'Unknown error'}`
    default:
      return 'Unknown status'
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the default mint URL from environment or wallet store.
 */
function getDefaultMintUrl(): string {
  return import.meta.env.VITE_CASCADE_MINT_URL || 
         import.meta.env.VITE_CASHU_MINT_URL || 
         'https://mint.minibits.cash/Bitcoin'
}

/**
 * Generate a unique deposit ID.
 */
function generateDepositId(): string {
  return `deposit_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Start polling for deposit status updates (backup to events).
 */
function startStatusPolling(
  depositId: string,
  ndkDeposit: NDKCashuDeposit,
  callbacks: DepositCallbacks
): void {
  const pollInterval = setInterval(async () => {
    const deposit = activeDeposits.get(depositId)
    if (!deposit) {
      clearInterval(pollInterval)
      return
    }

    // Skip if already completed or failed
    if (deposit.status === 'completed' || deposit.status === 'failed') {
      clearInterval(pollInterval)
      return
    }

    try {
      // Check if deposit is finalized
      if (ndkDeposit.finalized) {
        deposit.status = 'completed'
        notifyStatusChange(deposit, callbacks)
        
        if (callbacks.onPaymentReceived) {
          callbacks.onPaymentReceived(deposit)
        }
        if (callbacks.onTokensReceived) {
          callbacks.onTokensReceived(deposit, '')
        }
        
        clearInterval(pollInterval)
      }
    } catch (error) {
      console.warn(`Error polling deposit ${depositId}:`, error)
    }
  }, 3000) // Poll every 3 seconds
}

/**
 * Notify callbacks of status change.
 */
function notifyStatusChange(deposit: Deposit, callbacks: DepositCallbacks): void {
  if (callbacks.onStatusChange) {
    callbacks.onStatusChange(deposit, deposit.status)
  }
}
