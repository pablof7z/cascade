import NDK, { NDKPrivateKeySigner, NDKKind } from '@nostr-dev-kit/ndk'
import { NDKCashuWallet, NDKCashuDeposit } from '@nostr-dev-kit/wallet'
import { getEncodedToken } from '@cashu/cashu-ts'
import { loadStoredKeys } from './nostrKeys'
import { MINT_URL, getMintUrl, setMintUrl as setConfiguredMintUrl } from './lib/config/mint'

// Re-export NDKCashuDeposit for use by other services
export type { NDKCashuDeposit } from '@nostr-dev-kit/wallet'

const WALLET_RELAYS = ['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol']

// Current mint URL - initialized from config, can be overridden per-market
let currentMintUrl: string = MINT_URL
let walletInstance: NDKCashuWallet | null = null
let ndkInstance: NDK | null = null

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
  setConfiguredMintUrl(url)
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

/**
 * Send tokens locked to a specific pubkey using NUT-11 P2PK.
 * Only the recipient can unblind and spend these tokens.
 *
 * @param amount  Amount in sats to send.
 * @param recipientPubkey  Hex pubkey that can only unblind/spend the resulting tokens.
 * @param memo    Optional memo to include in the token.
 * @returns Encoded Cashu token string on success, null on failure.
 */
export async function sendP2PKTokens(amount: number, recipientPubkey: string, memo?: string): Promise<string | null> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) return null

  try {
    // Get the underlying CashuWallet for the current mint
    const cashuWallet = await wallet.getCashuWallet(currentMintUrl)
    
    // Get proofs we have from the NDK wallet's state
    const proofsWeHave = await wallet.state.getProofs({ mint: currentMintUrl })
    
    if (!proofsWeHave || proofsWeHave.length === 0) {
      console.error('[sendP2PKTokens] No proofs available for mint:', currentMintUrl)
      return null
    }

    // Send with NUT-11 P2PK lock — only recipientPubkey can unblind
    const result = await cashuWallet.send(amount, proofsWeHave, {
      pubkey: recipientPubkey,
      proofsWeHave,
    })

    if (!result || result.send.length === 0) {
      console.error('[sendP2PKTokens] Token creation returned no proofs')
      return null
    }

    // Update wallet state with the change proofs (what we keep)
    await wallet.state.update({
      store: result.keep ?? [],
      destroy: result.send,
      mint: currentMintUrl,
    })

    // Encode the P2PK-locked token
    const token = getEncodedToken({
      mint: currentMintUrl,
      proofs: result.send,
      memo,
    })

    return token
  } catch (e) {
    console.error('Send P2PK error:', e)
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

/**
 * Check if the wallet has been loaded and is ready for use.
 */
export function isWalletReady(): boolean {
  return walletInstance !== null
}
