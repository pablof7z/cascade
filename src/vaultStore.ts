/**
 * Platform vault store.
 *
 * Wraps walletStore functions to provide vault-specific semantics.
 * The vault is the platform wallet that holds funds on behalf of traders
 * until market resolution.
 *
 * The vault pubkey is derived from the underlying wallet and cached in
 * localStorage so it survives page refreshes without a Nostr round-trip.
 */

import { loadOrCreateWallet, getWalletBalance, sendTokens, getNDK } from './walletStore'

const VAULT_PUBKEY_STORAGE_KEY = 'cascade-vault-pubkey'

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _vaultPubkey: string | null = null

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize or load the vault wallet.
 * - Loads from cache if already initialized.
 * - Derives and stores vault pubkey in localStorage.
 * Returns true when the vault is ready, false on failure.
 */
export async function loadOrCreateVault(): Promise<boolean> {
  const wallet = await loadOrCreateWallet()
  if (!wallet) {
    return false
  }

  // Derive pubkey from NDK signer
  const ndk = await getNDK()
  if (ndk) {
    try {
      const user = await ndk.signer?.user()
      if (user?.pubkey) {
        _vaultPubkey = user.pubkey
        try {
          localStorage.setItem(VAULT_PUBKEY_STORAGE_KEY, _vaultPubkey)
        } catch {
          // quota exceeded — non-fatal
        }
      }
    } catch (err) {
      // Pubkey derivation failed — vault will use unknown pubkey
    }
  }

  console.info('[vaultStore] Vault initialized', _vaultPubkey ? `(pubkey: ${_vaultPubkey.slice(0, 8)}…)` : '(pubkey unknown)')
  return true
}

/**
 * Return the current vault balance in sats.
 * Returns 0 if the vault is not initialized.
 */
export async function getVaultBalance(): Promise<number> {
  return getWalletBalance()
}

/**
 * Send tokens from the vault to a recipient.
 * @param amount  Amount in sats to send.
 * @param recipientPubkey  Destination pubkey (for memo/routing).
 * @returns The Cashu token string on success, null on failure.
 */
export async function sendPayoutTokens(amount: number, recipientPubkey: string): Promise<string | null> {
  const memo = `Cascade payout → ${recipientPubkey.slice(0, 8)}…`
  const token = await sendTokens(amount, memo)
  if (!token) {
    console.error('[vaultStore] sendPayoutTokens failed', { amount, recipientPubkey })
  }
  return token
}

/**
 * Return the vault pubkey (hex).
 * Prefers in-memory value; falls back to localStorage cache.
 * Returns null if vault has never been initialized.
 */
export function getVaultPubkey(): string | null {
  if (_vaultPubkey) return _vaultPubkey
  try {
    return localStorage.getItem(VAULT_PUBKEY_STORAGE_KEY)
  } catch {
    return null
  }
}
