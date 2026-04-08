/**
 * Mint Configuration
 *
 * Centralized mint URL and relay configuration for Cascade markets.
 * All mint-related configuration should be imported from this file.
 */

import { isTestnet } from '../stores/testnet.svelte'

// Environment variable for custom mint URL
const ENV_MINT_URL = import.meta.env.VITE_CASCADE_MINT_URL

// Default mint URLs
const DEFAULT_MAINNET_MINT = 'https://mint.cascade.market'
const DEFAULT_TESTNET_MINT = 'https://mint.cascade.market' // Same for now, testnet toggle changes behavior

// Mint relays (for NDK subscriptions to mint-related events)
export const MINT_RELAYS = [
  'wss://nostr.wine',
  'wss://nos.lol',
  'wss://relay.primal.net',
]

// -----------------------------------------------------------------------------
// Mint URL getter — respects testnet toggle
// -----------------------------------------------------------------------------

/**
 * Get the current mint URL based on network mode.
 * Returns the configured URL or falls back to the default.
 */
export function getMintUrl(): string {
  // Respect runtime override set via setMintUrl()
  if (currentMintUrl && currentMintUrl !== (ENV_MINT_URL || DEFAULT_MAINNET_MINT)) {
    return currentMintUrl
  }
  if (ENV_MINT_URL) {
    return ENV_MINT_URL
  }
  return DEFAULT_MAINNET_MINT
}

/**
 * Check if running in testnet mode.
 */
export function isTestnetMode(): boolean {
  return isTestnet()
}

// -----------------------------------------------------------------------------
// Reactive mint URL (for Svelte 5 $state consumers)
// -----------------------------------------------------------------------------

// Module-level state that can be observed
let currentMintUrl = getMintUrl()

export function getCurrentMintUrl(): string {
  return currentMintUrl
}

export function setMintUrl(url: string): void {
  currentMintUrl = url
}

// -----------------------------------------------------------------------------
// Export the default for direct imports
// -----------------------------------------------------------------------------

/**
 * The default mint URL for the application.
 * Use getMintUrl() for dynamic fetching based on network mode.
 */
export const MINT_URL = ENV_MINT_URL || DEFAULT_MAINNET_MINT

// Convenience export for default testnet mint
export const TESTNET_MINT_URL = DEFAULT_TESTNET_MINT