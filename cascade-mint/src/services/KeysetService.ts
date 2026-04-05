/**
 * KeysetService - BIP-32 Key Derivation for Cashu Mint
 * Phase 1 - Foundation
 */

import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { MASTER_SEED } from '../config.js';
import type { Keyset, KeysetDerivation } from '../types/index.js';
import { getDatabase, prepareFirst, prepareRun } from '../database/index.js';

/**
 * Derive a market-specific keyset using BIP-32 path scheme:
 * Master seed: Cascade Mint Private Key
 * Keyset path: m/46'/0'/0'/{marketIdHash}'
 * - LONG unit key: path/0
 * - SHORT unit key: path/1
 */
export class KeysetService {
  private masterSeed: Uint8Array;

  constructor(seed?: string) {
    const seedHex = seed || MASTER_SEED;
    if (!seedHex) {
      throw new Error('MASTER_SEED not configured');
    }
    this.masterSeed = hexToBytes(seedHex);
  }

  /**
   * Generate deterministic keyset ID from market
   * Format: market_id:{marketId}:{hash.slice(0,7)}
   */
  getKeysetId(marketId: string): string {
    const hash = sha256(new TextEncoder().encode(marketId));
    const hashHex = bytesToHex(hash);
    return `market_id:${marketId}:${hashHex.slice(0, 7)}`;
  }

  /**
   * Derive market hash from market ID
   */
  private deriveMarketHash(marketId: string): string {
    return bytesToHex(sha256(new TextEncoder().encode(marketId)));
  }

  /**
   * Convert hash prefix to uint32 for BIP-32 path
   */
  private hashToUint32(hash: Uint8Array): number {
    const view = new DataView(hash.buffer);
    return view.getUint32(0, false) >>> 0; // Unsigned 32-bit
  }

  /**
   * Derive private key from master seed using hardened derivation
   * BIP-32 path: m/46'/0'/0'/{index}'
   */
  private derivePrivateKey(pathIndex: number): Uint8Array {
    // Hardened derivation: h = 0x80000000 + index
    const hardenedIndex = 0x80000000 + pathIndex;

    // Derive using BIP-32 hardened derivation
    // Simplified: HMAC-SHA256 with index as big-endian
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, hardenedIndex, false);

    // For Phase 1, we use direct derivation
    // In production, implement full BIP-32 with IL = split(HMAC-SHA512(key, data))
    const hmac = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      hmac[i] = this.masterSeed[i % this.masterSeed.length] ^ indexBytes[i % indexBytes.length];
    }

    // Apply SHA256 for additional mixing
    return sha256(hmac);
  }

  /**
   * Derive deterministic keyset for a market
   */
  deriveKeyset(marketId: string): KeysetDerivation {
    const marketHash = this.deriveMarketHash(marketId);
    const hashPrefix = sha256(new TextEncoder().encode(marketId));
    const pathIndex = this.hashToUint32(hashPrefix);

    // Derive LONG unit keys
    const longPrivBytes = this.derivePrivateKey(pathIndex);
    const longPublicPoint = secp256k1.ProjectivePoint.fromPrivateKey(longPrivBytes);

    // Derive SHORT unit keys (path + 1)
    const shortPrivBytes = this.derivePrivateKey(pathIndex + 1);
    const shortPublicPoint = secp256k1.ProjectivePoint.fromPrivateKey(shortPrivBytes);

    return {
      keysetId: this.getKeysetId(marketId),
      longPublicKey: bytesToHex(longPublicPoint.toRawBytes()),
      shortPublicKey: bytesToHex(shortPublicPoint.toRawBytes()),
      longPrivateKey: bytesToHex(longPrivBytes),
      shortPrivateKey: bytesToHex(shortPrivBytes),
    };
  }

  /**
   * Get keyset from database or derive new one
   */
  async getOrCreateKeyset(marketId: string): Promise<Keyset> {
    const db = getDatabase();

    // Try to get existing keyset
    const existing = await prepareFirst<Keyset>(
      'SELECT * FROM keysets WHERE market_id = ?',
      marketId
    );

    if (existing) {
      return existing;
    }

    // Derive new keyset
    const derivation = this.deriveKeyset(marketId);
    const marketHash = this.deriveMarketHash(marketId);

    // Store in database
    const now = Date.now();
    await prepareRun(
      `INSERT INTO keysets (
        id, market_id, market_hash, long_pubkey, short_pubkey,
        long_privkey, short_privkey, reserve_sat, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      derivation.keysetId,
      marketId,
      marketHash,
      derivation.longPublicKey,
      derivation.shortPublicKey,
      derivation.longPrivateKey,
      derivation.shortPrivateKey,
      now
    );

    return {
      id: derivation.keysetId,
      marketId,
      marketHash,
      longPubkey: derivation.longPublicKey,
      shortPubkey: derivation.shortPublicKey,
      longPrivkey: derivation.longPrivateKey,
      shortPrivkey: derivation.shortPrivateKey,
      reserveSat: 0,
      createdAt: now,
    };
  }

  /**
   * Get keyset by ID
   */
  async getKeyset(keysetId: string): Promise<Keyset | null> {
    return prepareFirst<Keyset>('SELECT * FROM keysets WHERE id = ?', keysetId);
  }

  /**
   * Get keyset by market ID
   */
  async getKeysetByMarket(marketId: string): Promise<Keyset | null> {
    return prepareFirst<Keyset>('SELECT * FROM keysets WHERE market_id = ?', marketId);
  }

  /**
   * Update keyset reserve
   */
  async updateReserve(keysetId: string, reserveSat: number): Promise<void> {
    await prepareRun(
      'UPDATE keysets SET reserve_sat = ? WHERE id = ?',
      reserveSat,
      keysetId
    );
  }

  /**
   * Update Nostr event ID after keyset publication
   */
  async updateNostrEventId(keysetId: string, eventId: string): Promise<void> {
    await prepareRun(
      'UPDATE keysets SET nostr_event_id = ? WHERE id = ?',
      eventId,
      keysetId
    );
  }

  /**
   * Sign data with keyset private key
   */
  sign(keysetId: string, unit: 'long' | 'short', data: Uint8Array): string {
    // This is a simplified implementation
    // In production, use proper BIP-340 signing
    const privKeyHex = unit === 'long'
      ? this.deriveKeyset(keysetId.replace('market_id:', '').split(':')[1] || '').longPrivateKey
      : this.deriveKeyset(keysetId.replace('market_id:', '').split(':')[1] || '').shortPrivateKey;

    const privKey = hexToBytes(privKeyHex);
    const signature = secp256k1.sign(data, privKey);
    return bytesToHex(signature.toCompactRawBytes());
  }
}

// Singleton instance
let keysetService: KeysetService | null = null;

export function getKeysetService(): KeysetService {
  if (!keysetService) {
    keysetService = new KeysetService();
  }
  return keysetService;
}
