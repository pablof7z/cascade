/**
 * Wallet Store — Svelte-compatible reactive store for Cashu wallet state
 * 
 * @deprecated Use '$lib/stores/wallet.svelte' instead
 * This wrapper is kept for backward compatibility during migration.
 * Polling has been removed - use NDK subscriptions for balance updates.
 */

export {
  getBalance,
  hasError,
  isRefreshing,
  refreshBalance,
  forceRefreshBalance,
  initWalletStore,
  destroyWalletStore,
  walletStore,
} from './stores/wallet.svelte'
