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
import { getMintUrl } from '../lib/config/mint'
import { getBolt11ExpiresAt } from '@nostr-dev-kit/wallet'
import { classifyError, type WalletErrorCode } from '../lib/walletErrors'

// ---------------------------------------------------------------------------
// Typed errors
// ---------------------------------------------------------------------------

export class MintError extends Error {
  readonly kind = 'MintError' as const
  constructor(message: string) {
    super(message)
    this.name = 'MintError'
  }
}

export class ExpiredInvoiceError extends Error {
  readonly kind = 'ExpiredInvoiceError' as const
  constructor() {
    super('Invoice has expired before payment')
    this.name = 'ExpiredInvoiceError'
  }
}

export class NetworkError extends Error {
  readonly kind = 'NetworkError' as const
  constructor(message: string) {
    super(message)
    this.name = 'NetworkError'
  }
}

export type DepositError = MintError | ExpiredInvoiceError | NetworkError

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
  | 'expired'        // Invoice expired without payment
  | 'cancelled'      // Deposit cancelled by user

export type Deposit = {
  id: string              // Unique deposit ID
  amount: number          // Amount in sats
  mintUrl: string         // Mint URL used
  status: DepositStatus
  quoteId: string | null  // Quote ID from the mint
  invoice: string | null  // Bolt11 payment request
  expiry: number | null   // Unix timestamp when invoice expires
  createdAt: number       // Unix timestamp
  error: string | null    // Error message if failed
  errorKind: WalletErrorCode | null
}

export type DepositCallbacks = {
  onStatusChange?: (deposit: Deposit, newStatus: DepositStatus) => void
  onInvoiceCreated?: (deposit: Deposit) => void
  onPaymentReceived?: (deposit: Deposit) => void
  onTokensReceived?: (deposit: Deposit, tokens: string) => void
  onError?: (deposit: Deposit, error: string, errorKind: WalletErrorCode | null) => void
}

// ---------------------------------------------------------------------------
// Active deposits tracking
// ---------------------------------------------------------------------------

const activeDeposits = new Map<string, Deposit>()
const ndkDepositMap = new Map<string, NDKCashuDeposit>()
const pollingIntervals = new Map<string, ReturnType<typeof setInterval>>()

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
    invoice: null,
    expiry: null,
    createdAt: Math.floor(Date.now() / 1000),
    error: null,
    errorKind: null,
  }

  // Store deposit
  activeDeposits.set(depositId, deposit)
  notifyStatusChange(deposit, callbacks)

  try {
    // Create invoice via wallet
    const ndkDeposit = await createDeposit(amount, mintUrl)
    
    if (!ndkDeposit) {
      throw new MintError('Failed to create deposit — mint did not respond')
    }

    // Store NDK deposit for later use
    ndkDepositMap.set(depositId, ndkDeposit)

    // start() returns the bolt11 payment_request (invoice)
    const bolt11 = await ndkDeposit.start()

    // Populate invoice details
    deposit.invoice = bolt11
    deposit.quoteId = ndkDeposit.quoteId ?? null
    deposit.expiry = getBolt11ExpiresAt(bolt11) ?? null
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
        const walletError = classifyError(error)
        d.status = walletError.code === 'INVOICE_EXPIRED' ? 'expired' : 'failed'
        d.error = walletError.userMessage
        d.errorKind = walletError.code
        notifyStatusChange(d, callbacks)
        
        if (callbacks.onError) {
          callbacks.onError(d, d.error, walletError.code)
        }
      }
    })

    // Also check periodically for finalized status (as backup to events)
    startStatusPolling(depositId, ndkDeposit, callbacks)

    return deposit
  } catch (error) {
    const walletError = classifyError(error)
    deposit.status = walletError.code === 'INVOICE_EXPIRED' ? 'expired' : 'failed'
    deposit.error = walletError.userMessage
    deposit.errorKind = walletError.code
    notifyStatusChange(deposit, callbacks)
    if (callbacks.onError) {
      callbacks.onError(deposit, deposit.error, walletError.code)
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
export async function cancelDeposit(depositId: string): Promise<void> {
  const interval = pollingIntervals.get(depositId)
  if (interval !== undefined) {
    clearInterval(interval)
    pollingIntervals.delete(depositId)
  }

  const deposit = activeDeposits.get(depositId)
  if (deposit) {
    deposit.status = 'cancelled'
  }

  ndkDepositMap.delete(depositId)
  activeDeposits.delete(depositId)
}

/**
 * Clear all completed/failed deposits from tracking.
 */
export function clearInactiveDeposits(): void {
  for (const [id, deposit] of activeDeposits) {
    if (deposit.status === 'completed' || deposit.status === 'failed' || deposit.status === 'expired') {
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
    case 'expired':
      return 'Invoice expired'
    case 'failed':
      return `Failed: ${deposit.error || 'Unknown error'}`
    default:
      return 'Unknown status'
  }
}

/**
 * Get a user-friendly error message based on error kind.
 */
export function getDepositErrorMessage(deposit: Deposit): string {
  switch (deposit.errorKind) {
    case 'INVOICE_EXPIRED':
      return 'Invoice expired. Please create a new deposit.'
    case 'MINT_UNREACHABLE':
    case 'MINT_ERROR':
      return 'Mint service error. Please try again.'
    case 'MINT_TOKENS_FAILED':
      return 'Failed to mint tokens. Please try again.'
    case 'NETWORK_ERROR':
      return 'Network error. Please check your connection.'
    case 'INSUFFICIENT_BALANCE':
      return 'Insufficient balance.'
    case 'TOKEN_ALREADY_SPENT':
      return 'Token already spent.'
    default:
      return deposit.error || 'An unknown error occurred.'
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the default mint URL from environment or wallet store.
 */
function getDefaultMintUrl(): string {
  return getMintUrl()
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
      pollingIntervals.delete(depositId)
      return
    }

    // Skip if already completed, failed, or expired
    if (deposit.status === 'completed' || deposit.status === 'failed' || deposit.status === 'expired') {
      clearInterval(pollInterval)
      pollingIntervals.delete(depositId)
      return
    }

    // Check if invoice has expired
    if (deposit.expiry && Math.floor(Date.now() / 1000) > deposit.expiry) {
      deposit.status = 'expired'
      deposit.error = 'Invoice expired'
      deposit.errorKind = 'ExpiredInvoiceError'
      notifyStatusChange(deposit, callbacks)
      if (callbacks.onError) {
        callbacks.onError(deposit, deposit.error, 'ExpiredInvoiceError')
      }
      clearInterval(pollInterval)
      pollingIntervals.delete(depositId)
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
        pollingIntervals.delete(depositId)
      }
    } catch (error) {
      console.warn(`Error polling deposit ${depositId}:`, error)
    }
  }, 3000) // Poll every 3 seconds

  pollingIntervals.set(depositId, pollInterval)
}

/**
 * Notify callbacks of status change.
 */
function notifyStatusChange(deposit: Deposit, callbacks: DepositCallbacks): void {
  if (callbacks.onStatusChange) {
    callbacks.onStatusChange(deposit, deposit.status)
  }
}
