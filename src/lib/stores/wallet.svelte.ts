/**
 * Wallet Store — Svelte 5 $state reactive store for Cashu wallet state
 *
 * Provides reactive balance, error, and refresh state using Svelte 5 runes.
 * No subscriber pattern - consumers use $state directly.
 *
 * Usage in Svelte 5 components:
 *   import { balance, isRefreshing, refreshBalance } from '$lib/stores/wallet.svelte'
 *   $effect(() => { refreshBalance() })
 */

import { loadOrCreateWallet, getWalletBalance } from '../../walletStore'

// Module-level reactive state (Svelte 5)
let balanceValue = $state(0)
let errorValue = $state<string | null>(null)
let isRefreshingValue = $state(false)

// -----------------------------------------------------------------------------
// Exported reactive getters
// -----------------------------------------------------------------------------

export function getBalance(): number {
  return balanceValue
}

export function hasError(): boolean {
  return errorValue !== null
}

export function isRefreshing(): boolean {
  return isRefreshingValue
}

// -----------------------------------------------------------------------------
// Balance refresh
// -----------------------------------------------------------------------------

/**
 * Refresh the wallet balance from the underlying wallet.
 */
export async function refreshBalance(): Promise<void> {
  if (isRefreshingValue) return

  isRefreshingValue = true
  errorValue = null

  try {
    const wallet = await loadOrCreateWallet()
    if (wallet) {
      balanceValue = await getWalletBalance()
      errorValue = null
    }
  } catch (err) {
    console.error('Wallet balance refresh failed:', err)
    errorValue = err instanceof Error ? err.message : 'Failed to refresh balance'
  } finally {
    isRefreshingValue = false
  }
}

/**
 * Force refresh the balance (e.g., after a transaction).
 */
export async function forceRefreshBalance(): Promise<void> {
  await refreshBalance()
}

// -----------------------------------------------------------------------------
// Lifecycle
// -----------------------------------------------------------------------------

let initialized = false

export async function initWalletStore(): Promise<void> {
  if (initialized) return
  initialized = true
  await refreshBalance()
}

export function destroyWalletStore(): void {
  // No-op: removed polling, state preserved for when user reconnects
  console.debug('[walletStore] destroyWalletStore called - polling removed')
}

// -----------------------------------------------------------------------------
// Legacy export for backward compatibility with existing code
// -----------------------------------------------------------------------------

export const walletStore = {
  subscribe: (_callback: (value: { balance: number; error: string | null; isRefreshing: boolean }) => void) => {
    // Deprecated: returns no-op unsubscribe
    console.warn('walletStore.subscribe is deprecated - use $state imports instead')
    return () => {}
  },
  get: () => ({ balance: balanceValue, error: errorValue, isRefreshing: isRefreshingValue }),
}