/**
 * MintService - Core Mint Logic
 * Phase 1 - Foundation
 */

import { randomBytes } from '@noble/hashes/utils';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { CASHU_FEE_RATE, MINT_CONFIG } from '../config.js';
import { getDatabase, prepareFirst, prepareRun, prepare } from '../database/index.js';
import { getKeysetService } from './KeysetService.js';
import { getProofService } from './ProofService.js';
import type { MintQuote, Proof, Keyset } from '../types/index.js';

/**
 * Generate a unique quote ID
 */
function generateQuoteId(): string {
  const bytes = randomBytes(16);
  return `quote-${bytesToHex(bytes)}`;
}

/**
 * Calculate minting fee
 */
function calculateFee(amount: number): number {
  return Math.ceil((amount * CASHU_FEE_RATE) / 100);
}

export class MintService {
  private keysetService = getKeysetService();
  private proofService = getProofService();

  /**
   * Create a new mint quote (NUT-02)
   * For Phase 1: 0-sat quotes are immediately marked as paid
   */
  async createQuote(amount: number, unit: string = 'sat'): Promise<MintQuote> {
    // Validate unit
    if (!MINT_CONFIG.supportedUnits.includes(unit)) {
      throw new Error(`Unsupported unit: ${unit}`);
    }

    const db = getDatabase();
    const quoteId = generateQuoteId();
    const now = Date.now();
    const expiresAt = now + (MINT_CONFIG.quoteExpirySeconds * 1000);

    // For 0-sat test quotes, immediately mark as paid
    const paid = amount === 0;

    // Get or create default keyset (uses placeholder market ID for Phase 1)
    const keyset = await this.keysetService.getOrCreateKeyset('default-market');

    // Create quote record
    await prepareRun(
      `INSERT INTO quotes (id, amount, unit, paid, paid_at, created_at, expires_at, keyset_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      quoteId,
      amount,
      unit,
      paid ? 1 : 0,
      paid ? now : null,
      now,
      expiresAt,
      keyset.id
    );

    return {
      id: quoteId,
      amount,
      unit,
      paid,
      paidAt: paid ? now : undefined,
      createdAt: now,
      expiresAt,
      request: amount > 0 ? 'lnbc...' : undefined, // Would be Lightning invoice in production
      keysetId: keyset.id,
    };
  }

  /**
   * Get quote by ID
   */
  async getQuote(quoteId: string): Promise<MintQuote | null> {
    const row = await prepareFirst<{
      id: string;
      amount: number;
      unit: string;
      paid: number;
      paid_at: number | null;
      created_at: number;
      expires_at: number;
      request: string | null;
      keyset_id: string;
    }>('SELECT * FROM quotes WHERE id = ?', quoteId);

    if (!row) return null;

    return {
      id: row.id,
      amount: row.amount,
      unit: row.unit,
      paid: row.paid === 1,
      paidAt: row.paid_at || undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      request: row.request || undefined,
      keysetId: row.keyset_id,
    };
  }

  /**
   * Check if quote is valid for minting
   */
  async validateQuoteForMint(quoteId: string): Promise<{ valid: boolean; error?: string; quote?: MintQuote }> {
    const quote = await this.getQuote(quoteId);

    if (!quote) {
      return { valid: false, error: 'Quote not found' };
    }

    if (!quote.paid) {
      return { valid: false, error: 'Quote not paid' };
    }

    if (quote.expiresAt < Date.now()) {
      return { valid: false, error: 'Quote expired' };
    }

    return { valid: true, quote };
  }

  /**
   * Mark quote as paid (called by payment webhook)
   */
  async markQuotePaid(quoteId: string): Promise<void> {
    await prepareRun(
      'UPDATE quotes SET paid = 1, paid_at = ? WHERE id = ?',
      Date.now(),
      quoteId
    );
  }

  /**
   * Generate proofs for a paid quote
   * Implements NUT-02 minting with fee deduction
   */
  async generateProofs(
    quoteId: string,
    outputs: Array<{ amount: number; id: string; B_: string; B: string }>
  ): Promise<Proof[]> {
    // Validate quote
    const validation = await this.validateQuoteForMint(quoteId);
    if (!validation.valid || !validation.quote) {
      throw new Error(validation.error || 'Invalid quote');
    }

    const quote = validation.quote;
    const totalOutputAmount = outputs.reduce((sum, o) => sum + o.amount, 0);

    // Check output amount doesn't exceed quote amount (after fees)
    const fee = calculateFee(quote.amount);
    const availableAmount = quote.amount - fee;

    if (totalOutputAmount > availableAmount) {
      throw new Error(`Output amount ${totalOutputAmount} exceeds available ${availableAmount} (after ${fee} fee)`);
    }

    // Get keyset
    const keyset = await this.keysetService.getKeyset(quote.keysetId);
    if (!keyset) {
      throw new Error('Keyset not found');
    }

    // Generate proofs for each output
    const proofs: Proof[] = [];
    const now = Date.now();

    for (const output of outputs) {
      // Generate proof with commitment
      const proof = await this.createProof(output, keyset, quote.id, now);
      proofs.push(proof);
    }

    // Store proofs
    await this.proofService.storeProofs(proofs);

    return proofs;
  }

  /**
   * Create a single proof
   */
  private async createProof(
    output: { amount: number; id: string; B_: string; B: string },
    keyset: Keyset,
    quoteId: string,
    createdAt: number
  ): Promise<Proof> {
    // Generate random secret for the proof
    const secretBytes = randomBytes(32);
    const secret = bytesToHex(secretBytes);

    // Compute commitment C = H(secret) * G
    // For Cashu, the commitment is aPedersen commit with the secret as blinding factor
    const secretHash = sha256(secretBytes);
    
    // Create commitment point using secp256k1
    const commitmentPoint = secp256k1.ProjectivePoint.fromPrivateKey(secretHash);
    const C = bytesToHex(commitmentPoint.toRawBytes());

    return {
      id: output.id,
      keysetId: keyset.id,
      amount: output.amount,
      unit: 'sat',
      secret,
      C,
      state: 'unspent',
      quoteId,
      createdAt,
    };
  }

  /**
   * Get keyset info for mint
   */
  async getKeysetForMint(): Promise<Keyset> {
    return this.keysetService.getOrCreateKeyset('default-market');
  }

  /**
   * Get all active quotes
   */
  async getActiveQuotes(): Promise<MintQuote[]> {
    const result = await prepare<{
      id: string;
      amount: number;
      unit: string;
      paid: number;
      paid_at: number | null;
      created_at: number;
      expires_at: number;
      request: string | null;
      keyset_id: string;
    }>(
      'SELECT * FROM quotes WHERE paid = 0 AND expires_at > ? ORDER BY created_at DESC',
      Date.now()
    );

    return result.results.map(row => ({
      id: row.id,
      amount: row.amount,
      unit: row.unit,
      paid: false,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      keysetId: row.keyset_id,
    }));
  }

  /**
   * Clean up expired quotes
   */
  async cleanupExpiredQuotes(): Promise<number> {
    const result = await prepareRun(
      'DELETE FROM quotes WHERE expires_at < ? AND paid = 0',
      Date.now()
    );
    return result.meta.changes;
  }
}

// Import sha256 for proof creation
import { sha256 } from '@noble/hashes/sha256';
import { secp256k1 } from '@noble/curves/secp256k1';

// Singleton instance
let mintService: MintService | null = null;

export function getMintService(): MintService {
  if (!mintService) {
    mintService = new MintService();
  }
  return mintService;
}
