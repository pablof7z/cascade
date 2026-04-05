/**
 * Environment Configuration
 * Cashu Mint Phase 1
 */

// Fee rate as percentage (default 1%)
export const CASHU_FEE_RATE = parseInt(process.env.CASHU_FEE_RATE || '1', 10);

// Master seed for BIP-32 derivation (hex-encoded)
export const MASTER_SEED = process.env.MASTER_SEED || '';

// Turso database URL
export const TURSO_URL = process.env.TURSO_URL || '';

// Turso auth token
export const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

// Nostr relays for market/keyset events
export const NOSTR_RELAYS = (process.env.NOSTR_RELAYS || 'wss://relay.damus.io,wss://relay.nostr.band').split(',');

// Nostr pubkey for this mint
export const NOSTR_PUBKEY = process.env.NOSTR_PUBKEY || '';

// NIP-46 delegator pubkey (optional)
export const DELEGATOR_PUBKEY = process.env.DELEGATOR_PUBKEY || '';

// NIP-46 delegator token (optional)
export const DELEGATOR_TOKEN = process.env.DELEGATOR_TOKEN || '';

// Environment
export const NODE_ENV = process.env.NODE_ENV || 'development';

// Mint configuration
export const MINT_CONFIG = {
  name: 'Cascade Markets Mint',
  version: '0.1.0',
  description: 'Ecash mint for outcome tokens on Nostr prediction markets',
  motd: 'Phase 1: 0-sat test mints enabled',
  supportedUnits: ['sat'],
  quoteExpirySeconds: 300, // 5 minutes
};

// Validate required environment variables
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!MASTER_SEED) {
    errors.push('MASTER_SEED is required');
  } else if (!/^[a-fA-F0-9]{64}$/.test(MASTER_SEED)) {
    errors.push('MASTER_SEED must be 64 hex characters');
  }

  if (!TURSO_URL && NODE_ENV !== 'development') {
    errors.push('TURSO_URL is required in production');
  }

  return { valid: errors.length === 0, errors };
}
