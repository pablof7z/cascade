import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

/**
 * Testnet / Paper Trading Mode Configuration
 * 
 * Cascade supports both testnet (paper trading) and mainnet modes.
 * - Env var VITE_TESTNET_DEFAULT sets the default (defaults to true)
 * - User can toggle via UI, stored in localStorage
 */

const STORAGE_KEY = 'cascade_testnet_mode'

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

export function TestnetProvider({ children }: { children: ReactNode }) {
  const [isTestnet, setIsTestnet] = useState(() => {
    if (typeof window === 'undefined') return ENV_DEFAULT
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === 'true'
    return ENV_DEFAULT
  })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(isTestnet))
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
