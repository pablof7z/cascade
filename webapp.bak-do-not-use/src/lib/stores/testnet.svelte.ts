/**
 * Testnet Store — Svelte 5 $state reactive store for network mode
 *
 * Provides reactive testnet/mainnet toggle using Svelte 5 runes.
 */

let testnetValue = $state(false)

export const TESTNET_LABELS = {
  label: 'Testnet',
  description: 'Paper trading mode with test sats'
} as const

export function isTestnet(): boolean {
  return testnetValue
}

export function toggle(): void {
  testnetValue = !testnetValue
}

export function setTestnet(value: boolean): void {
  testnetValue = value
}

// Legacy export for backward compatibility
export const isTestnetStore = {
  subscribe: (callback: (value: boolean) => void) => {
    console.warn('isTestnet.subscribe is deprecated - use isTestnet() instead')
    callback(testnetValue)
    return () => {}
  },
  get: () => testnetValue,
}