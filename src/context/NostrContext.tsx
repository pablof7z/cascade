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

// Relay URLs per network
const TESTNET_RELAYS = ['wss://relay.damus.io']
const MAINNET_RELAYS = ['wss://relay.damus.io', 'wss://nostr.wine']

interface NostrContextValue {
  pubkey: string | null
  ndkInstance: NDK | null
  isReady: boolean
  publishEvent: (content: string, tags: string[][], kind?: number) => Promise<NDKEvent>
  fetchEvents: (filter: NDKFilter) => Promise<Set<NDKEvent>>
  subscribeToEvents: (filter: NDKFilter, callback: (event: NDKEvent) => void) => NDKSubscription
}

const NostrContext = createContext<NostrContextValue | null>(null)

export function NostrContextProvider({ children }: { children: ReactNode }) {
  const { isTestnet } = useTestnet()
  const [ready, setReady] = useState(false)
  const [pubkey, setPubkey] = useState<string | null>(null)

  useEffect(() => {
    setReady(false)
    const relayUrls = isTestnet ? TESTNET_RELAYS : MAINNET_RELAYS

    initNostrService(relayUrls).then(() => {
      setPubkey(getPubkey())
      setReady(serviceIsReady())
    })
  }, [isTestnet])

  const value: NostrContextValue = {
    pubkey,
    ndkInstance: ready ? getNDK() : null,
    isReady: ready,
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
