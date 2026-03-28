import NDK, { NDKPrivateKeySigner, NDKKind } from '@nostr-dev-kit/ndk'
import { NDKCashuWallet, NDKCashuDeposit } from '@nostr-dev-kit/wallet'
import { loadStoredKeys } from './nostrKeys'

const DEFAULT_MINT = 'https://mint.minibits.cash/Bitcoin'
const WALLET_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol']

let ndkInstance: NDK | null = null
let walletInstance: NDKCashuWallet | null = null

export async function getNDK(): Promise<NDK | null> {
  if (ndkInstance) return ndkInstance

  const keys = loadStoredKeys()
  if (!keys) return null

  const signer = new NDKPrivateKeySigner(keys.nsec)
  ndkInstance = new NDK({
    explicitRelayUrls: WALLET_RELAYS,
    signer,
  })

  await ndkInstance.connect()
  return ndkInstance
}

export async function loadOrCreateWallet(): Promise<NDKCashuWallet | null> {
  if (walletInstance) return walletInstance

  const ndk = await getNDK()
  if (!ndk) return null

  const user = await ndk.signer?.user()
  if (!user) return null

  // Try to load existing wallet
  const walletEvent = await ndk.fetchEvent({
    kinds: [NDKKind.CashuWallet as number],
    authors: [user.pubkey],
  })

  if (walletEvent) {
    const loaded = await NDKCashuWallet.from(walletEvent)
    if (loaded) {
      walletInstance = loaded
      walletInstance.start()
    }
  } else {
    // Create new wallet
    walletInstance = await NDKCashuWallet.create(ndk, [DEFAULT_MINT], WALLET_RELAYS)
    walletInstance.start()
  }

  return walletInstance
}

export async function getWalletBalance(): Promise<number> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) return 0
  
  const balance = wallet.balance
  if (!balance) return 0
  
  return balance.amount || 0
}

export async function createDeposit(amount: number): Promise<NDKCashuDeposit | null> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) return null

  try {
    const deposit = wallet.deposit(amount, DEFAULT_MINT)
    await deposit.start()
    return deposit
  } catch (e) {
    console.error('Deposit error:', e)
    return null
  }
}

export async function sendTokens(amount: number, memo?: string): Promise<string | null> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) return null

  try {
    const token = await wallet.send(amount, memo)
    return token
  } catch (e) {
    console.error('Send error:', e)
    return null
  }
}

export async function receiveToken(tokenString: string): Promise<boolean> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) return false

  try {
    await wallet.receiveToken(tokenString)
    return true
  } catch (e) {
    console.error('Receive error:', e)
    return false
  }
}

export function getWallet(): NDKCashuWallet | null {
  return walletInstance
}
