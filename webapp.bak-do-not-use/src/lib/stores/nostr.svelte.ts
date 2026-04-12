/**
 * Nostr Store — Svelte 5 $state reactive store for Nostr connection
 *
 * Provides reactive state for Nostr connection (pubkey, isReady) using Svelte 5 runes.
 */

import { initNostrService, getPubkey, isReady as serviceIsReady } from '../../services/nostrService'
import { clearCache } from '../../bookmarkStore'
import { isTestnet, toggle as toggleTestnet, setTestnet } from './testnet.svelte'

const KEYS_STORAGE_KEY = 'cascade-nostr-keys'

// Relay URLs per network
const TESTNET_RELAYS = ['wss://relay.nostr.band', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']
const MAINNET_RELAYS = ['wss://nostr.wine', 'wss://nos.lol', 'wss://relay.primal.net', 'wss://relay.damus.io']

// Reactive state
let pubkeyValue = $state<string | null>(null)
let readyValue = $state(false)

// -----------------------------------------------------------------------------
// State getters
// -----------------------------------------------------------------------------

export function getCurrentPubkey(): string | null {
  return pubkeyValue
}

export function isConnected(): boolean {
  return readyValue
}

// -----------------------------------------------------------------------------
// Service initialization
// -----------------------------------------------------------------------------

async function initService(testnet: boolean): Promise<void> {
  readyValue = false
  const relayUrls = testnet ? TESTNET_RELAYS : MAINNET_RELAYS
  await initNostrService(relayUrls)
  pubkeyValue = getPubkey()
  readyValue = serviceIsReady()
}

/**
 * Initialize the Nostr store.
 * Call this once at app startup.
 */
export async function initNostrStore(): Promise<void> {
  const testnet = isTestnet()
  await initService(testnet)
}

// -----------------------------------------------------------------------------
// Connection management
// -----------------------------------------------------------------------------

/**
 * Reconnect to Nostr relays.
 * Uses current testnet/mainnet setting.
 */
export async function reconnect(): Promise<void> {
  const testnet = isTestnet()
  await initService(testnet)
}

/**
 * Disconnect from Nostr.
 * Clears stored keys and resets state.
 */
export function disconnect(): void {
  localStorage.removeItem(KEYS_STORAGE_KEY)
  clearCache()
  pubkeyValue = null
  readyValue = false
}

// -----------------------------------------------------------------------------
// Legacy export for backward compatibility
// -----------------------------------------------------------------------------

export const nostrStore = {
  subscribe: (callback: (value: { pubkey: string | null; isReady: boolean }) => void) => {
    console.warn('nostrStore.subscribe is deprecated - use $state imports instead')
    callback({ pubkey: pubkeyValue, isReady: readyValue })
    return () => {}
  },
  get: () => ({ pubkey: pubkeyValue, isReady: readyValue }),
}