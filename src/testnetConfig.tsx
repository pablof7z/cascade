import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

/**
 * Testnet / Paper Trading Mode Configuration
 * 
 * Contrarian Markets supports both testnet (paper trading) and mainnet modes.
 * - Env var VITE_TESTNET_DEFAULT sets the default (defaults to true)
 * - User can toggle via UI, stored in localStorage
 */

const STORAGE_KEY = 'cascade_network'
const LEGACY_STORAGE_KEY = 'cascade_testnet_mode'
const TESTNET_STORAGE_VALUE = 'testnet'
const MAINNET_STORAGE_VALUE = 'mainnet'

// Default from env var, fallback to true (prototype phase)
const ENV_DEFAULT = import.meta.env.VITE_TESTNET_DEFAULT !== 'false'

export const TESTNET_LABELS = {
  label: 'Paper Trading',
  shortLabel: 'Testnet',
  description: 'All balances are simulated. No real money involved.',
  startingBalance: 10000,
  apiKeyPrefix: 'cascade_test_',
}

// Legacy export for any static checks
export const TESTNET_MODE = ENV_DEFAULT
export const TESTNET_CONFIG = {
  enabled: ENV_DEFAULT,
  ...TESTNET_LABELS,
}

// --- React Context for dynamic testnet state ---

interface TestnetContextValue {
  isTestnet: boolean
  toggle: () => void
  setTestnet: (value: boolean) => void
}

const TestnetContext = createContext<TestnetContextValue | null>(null)

function readStoredTestnetPreference(): boolean | null {
  if (typeof window === 'undefined') return null

  const storedNetwork = localStorage.getItem(STORAGE_KEY)
  if (storedNetwork === TESTNET_STORAGE_VALUE) return true
  if (storedNetwork === MAINNET_STORAGE_VALUE) return false

  const legacyStored = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacyStored === 'true') return true
  if (legacyStored === 'false') return false

  return null
}

function persistTestnetPreference(isTestnet: boolean) {
  localStorage.setItem(STORAGE_KEY, isTestnet ? TESTNET_STORAGE_VALUE : MAINNET_STORAGE_VALUE)
  localStorage.removeItem(LEGACY_STORAGE_KEY)
}

export function TestnetProvider({ children }: { children: ReactNode }) {
  const [isTestnet, setIsTestnet] = useState(() => {
    return readStoredTestnetPreference() ?? ENV_DEFAULT
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    persistTestnetPreference(isTestnet)
  }, [isTestnet])

  const toggle = () => setIsTestnet(prev => !prev)
  const setTestnet = (value: boolean) => setIsTestnet(value)

  return (
    <TestnetContext.Provider value={{ isTestnet, toggle, setTestnet }}>
      {children}
    </TestnetContext.Provider>
  )
}

export function useTestnet(): TestnetContextValue {
  const ctx = useContext(TestnetContext)
  if (!ctx) {
    throw new Error('useTestnet must be used within TestnetProvider')
  }
  return ctx
}
