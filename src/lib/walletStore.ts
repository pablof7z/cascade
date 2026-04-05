/**
 * Wallet Store — Svelte-compatible reactive store for Cashu wallet state
 *
 * Wraps the existing wallet logic from src/walletStore.ts and provides:
 * - Reactive balance state with polling
 * - isRefreshing flag to prevent race conditions
 * - Error handling with last-known balance preservation
 * - initWalletStore() / destroyWalletStore() lifecycle functions
 */

import { getWalletBalance, loadOrCreateWallet } from '../walletStore';

// Polling interval in milliseconds
const BALANCE_POLL_INTERVAL = 30000; // 30 seconds

// Module-level state
let balanceValue = 0;
let errorValue: string | null = null;
let isRefreshingValue = false;
let pollIntervalId: ReturnType<typeof setInterval> | null = null;

// Subscriber management
type Subscriber = (value: { balance: number; error: string | null; isRefreshing: boolean }) => void;
const subscribers = new Set<Subscriber>();

function getState() {
  return { balance: balanceValue, error: errorValue, isRefreshing: isRefreshingValue };
}

function notifySubscribers() {
  const state = getState();
  subscribers.forEach(cb => cb(state));
}

/**
 * Refresh the wallet balance from the underlying wallet.
 * Sets isRefreshing to prevent concurrent polling calls.
 */
async function refreshBalance(): Promise<void> {
  // Prevent concurrent refresh calls
  if (isRefreshingValue) {
    return;
  }

  isRefreshingValue = true;
  errorValue = null;
  notifySubscribers();

  try {
    const wallet = await loadOrCreateWallet();
    if (wallet) {
      balanceValue = await getWalletBalance();
      errorValue = null;
    } else {
      // No wallet - balance stays at last known value, no error
      errorValue = null;
    }
  } catch (err) {
    // Preserve last known balance on polling errors
    console.error('Wallet balance refresh failed:', err);
    errorValue = err instanceof Error ? err.message : 'Failed to refresh balance';
  } finally {
    isRefreshingValue = false;
    notifySubscribers();
  }
}

/**
 * Start polling for balance updates.
 */
function startPolling(): void {
  if (pollIntervalId !== null) {
    return; // Already polling
  }

  pollIntervalId = setInterval(() => {
    refreshBalance();
  }, BALANCE_POLL_INTERVAL);
}

/**
 * Stop polling for balance updates.
 */
function stopPolling(): void {
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

/**
 * Initialize the wallet store.
 * Loads the wallet and starts balance polling.
 */
export async function initWalletStore(): Promise<void> {
  await refreshBalance();
  startPolling();
}

/**
 * Destroy the wallet store.
 * Stops polling and clears error state.
 */
export function destroyWalletStore(): void {
  stopPolling();
  errorValue = null;
  // Don't reset balance - preserve last known value for when user reconnects
  notifySubscribers();
}

/**
 * Force refresh the balance (e.g., after a transaction).
 */
export async function forceRefreshBalance(): Promise<void> {
  await refreshBalance();
}

// Store with subscribe pattern (compatible with Svelte $effect)
export const walletStore = {
  subscribe: (callback: Subscriber) => {
    subscribers.add(callback);
    callback(getState()); // Call immediately with current state
    return () => {
      subscribers.delete(callback);
    };
  },
  get: () => getState(),
};

/**
 * Get current balance (one-time read, not reactive).
 */
export function getCurrentBalance(): number {
  return balanceValue;
}

/**
 * Check if there's an error state.
 */
export function hasError(): boolean {
  return errorValue !== null;
}
