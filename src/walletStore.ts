import NDK, { NDKPrivateKeySigner, NDKKind } from '@nostr-dev-kit/ndk'
import { NDKCashuWallet, NDKCashuDeposit } from '@nostr-dev-kit/wallet'
import { loadStoredKeys } from './nostrKeys'

// Re-export NDKCashuDeposit for use by other services
export type { NDKCashuDeposit } from '@nostr-dev-kit/wallet'

const WALLET_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol']

// Current mint URL - configurable per market
let currentMintUrl: string = import.meta.env.VITE_CASCADE_MINT_URL || import.meta.env.VITE_CASHU_MINT_URL || 'https://mint.minibits.cash/Bitcoin'

let ndkInstance: NDK | null = null
let walletInstance: NDKCashuWallet | null = null

/**
 * Get the current mint URL being used by the wallet.
 */
export function getCurrentMintUrl(): string {
  return currentMintUrl
}

/**
 * Set the mint URL for the wallet.
 * This will reinitialize the wallet with the new mint on next access.
 *
 * @param url The mint URL to use
 */
export function setMintUrl(url: string): void {
  currentMintUrl = url
  // Reinitialize wallet with new mint
  walletInstance = null
  ndkInstance = null
}

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
    // Create new wallet with current mint URL
    walletInstance = await NDKCashuWallet.create(ndk, [currentMintUrl], WALLET_RELAYS)
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

export async function createDeposit(amount: number, mintUrl?: string): Promise<NDKCashuDeposit | null> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) return null

  const targetMint = mintUrl || currentMintUrl

  try {
    const deposit = wallet.deposit(amount, targetMint)
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
