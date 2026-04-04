import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type NDK from '@nostr-dev-kit/ndk'
import type { NDKEvent, NDKFilter, NDKSubscription } from '@nostr-dev-kit/ndk'
import { useTestnet } from '../testnetConfig'
import {
  initNostrService,
  getNDK,
  getPubkey,
  isReady as serviceIsReady,
  publishEvent as servicePublishEvent,
  fetchEvents as serviceFetchEvents,
  subscribeToEvents as serviceSubscribeToEvents,
} from '../services/nostrService'
import { clearCache } from '../bookmarkStore'

const KEYS_STORAGE_KEY = 'cascade-nostr-keys'

// Relay URLs per network
const TESTNET_RELAYS = ['wss://relay.damus.io']
const MAINNET_RELAYS = ['wss://relay.damus.io', 'wss://nostr.wine']

interface NostrContextValue {
  pubkey: string | null
  ndkInstance: NDK | null
  isReady: boolean
  reconnect: () => Promise<void>
  disconnect: () => void
  publishEvent: (content: string, tags: string[][], kind?: number) => Promise<NDKEvent>
  fetchEvents: (filter: NDKFilter) => Promise<Set<NDKEvent>>
  subscribeToEvents: (filter: NDKFilter, callback: (event: NDKEvent) => void) => NDKSubscription
}

const NostrContext = createContext<NostrContextValue | null>(null)

export function NostrContextProvider({ children }: { children: ReactNode }) {
  const { isTestnet } = useTestnet()
  const [ready, setReady] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)

  const initService = async (testnet: boolean) => {
    setReady(false)
    const relayUrls = testnet ? TESTNET_RELAYS : MAINNET_RELAYS
    await initNostrService(relayUrls)
    setPubkey(getPubkey())
    setReady(serviceIsReady())
  }

  useEffect(() => {
    initService(isTestnet)
  }, [isTestnet])

  const reconnect = async () => {
    await initService(isTestnet)
  }

  const disconnect = () => {
    // Remove stored keys from localStorage
    localStorage.removeItem(KEYS_STORAGE_KEY)
    // Clear bookmark cache to prevent cross-user data leakage
    clearCache()
    // Reset context state
    setPubkey(null)
    setReady(false)
  }

  const value: NostrContextValue = {
    pubkey,
    ndkInstance: ready ? getNDK() : null,
    isReady: ready,
    reconnect,
    disconnect,
    publishEvent: servicePublishEvent,
    fetchEvents: serviceFetchEvents,
    subscribeToEvents: serviceSubscribeToEvents,
  }

  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>
}

export function useNostr(): NostrContextValue {
  const ctx = useContext(NostrContext)
  if (!ctx) {
    throw new Error('useNostr must be used within NostrContextProvider')
  }
  return ctx
}

export { NostrContext }
