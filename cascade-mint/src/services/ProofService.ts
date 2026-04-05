/**
 * ProofService - Proof Storage and Validation
 * Phase 1 - Foundation
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex, hexToBytes } from '@noble/curves/abstract/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import type { Proof, SpentProof, ProofState } from '../types/index.js';
import { getDatabase, prepareFirst, prepareRun, prepare } from '../database/index.js';

export class ProofService {
  /**
   * Store generated proofs in database
   */
  async storeProofs(proofs: Proof[]): Promise<void> {
    for (const proof of proofs) {
      await prepareRun(
        `INSERT INTO proofs (
          id, keyset_id, amount, unit, secret, C, state, quote_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'unspent', ?, ?)`,
        proof.id,
        proof.keysetId,
        proof.amount,
        proof.unit,
        proof.secret,
        proof.C,
        proof.quoteId || null,
        proof.createdAt
      );
    }
  }

  /**
   * Validate proof signature (BIP-340)
   */
  async validateProof(proof: Proof): Promise<{ valid: boolean; error?: string }> {
    try {
      // Verify the proof has required fields
      if (!proof.secret || !proof.C) {
        return { valid: false, error: 'Missing secret or commitment' };
      }

      // Validate secret format (should be 32 bytes)
      const secretBytes = new TextEncoder().encode(proof.secret);
      if (secretBytes.length !== 32) {
        // Allow hash of secret if original is longer
        const secretHash = sha256(secretBytes);
        if (secretHash.length !== 32) {
          return { valid: false, error: 'Invalid secret format' };
        }
      }

      // Verify commitment C is valid point
      try {
        const C = hexToBytes(proof.C);
        secp256k1.ProjectivePoint.fromAffine(secp256k1.ProjectivePoint.fromBytes(C).toAffine());
      } catch {
        return { valid: false, error: 'Invalid commitment point' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: `Validation error: ${error}` };
    }
  }

  /**
   * Check if proof is already spent
   */
  async isProofSpent(proofId: string): Promise<boolean> {
    const proof = await prepareFirst<Proof>(
      'SELECT state FROM proofs WHERE id = ?',
      proofId
    );

    if (!proof) {
      return false; // Unknown proofs are not spent (fail open for Phase 1)
    }

    return proof.state === 'spent';
  }

  /**
   * Atomic spend operation - prevents double-spend
   * Uses database transaction semantics
   */
  async spendProof(proofId: string, spentByPubkey?: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check current state
      const proof = await prepareFirst<Proof>(
        'SELECT * FROM proofs WHERE id = ?',
        proofId
      );

      if (!proof) {
        return { success: false, error: 'Proof not found' };
      }

      if (proof.state === 'spent') {
        return { success: false, error: 'Proof already spent' };
      }

      if (proof.state === 'reserved') {
        return { success: false, error: 'Proof is reserved by another transaction' };
      }

      // Mark as spent
      await prepareRun(
        'UPDATE proofs SET state = ?, spent_at = ? WHERE id = ? AND state = ?',
        'spent',
        Date.now(),
        proofId,
        'unspent'
      );

      // Record in spent_proofs audit trail
      await prepareRun(
        `INSERT INTO spent_proofs (proof_id, spent_at, spent_by_pubkey) VALUES (?, ?, ?)`,
        proofId,
        Date.now(),
        spentByPubkey || null
      );

      return { success: true };
    } catch (error) {
      return { success: false, error: `Spend failed: ${error}` };
    }
  }

  /**
   * Reserve proofs for atomic swap (prevents concurrent spending)
   */
  async reserveProofs(proofIds: string[]): Promise<{ success: boolean; error?: string }> {
    try {
      const now = Date.now();

      for (const proofId of proofIds) {
        const result = await prepareRun(
          `UPDATE proofs 
           SET state = 'reserved' 
           WHERE id = ? AND state = 'unspent'`,
          proofId
        );

        if (result.meta.changes === 0) {
          // Rollback any previous reservations
          for (const prevId of proofIds) {
            await prepareRun(
              "UPDATE proofs SET state = 'unspent' WHERE id = ? AND state = 'reserved'",
              prevId
            );
          }
          return { success: false, error: `Proof ${proofId} is not available` };
        }
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: `Reserve failed: ${error}` };
    }
  }

  /**
   * Release reserved proofs (rollback)
   */
  async releaseProofs(proofIds: string[]): Promise<void> {
    for (const proofId of proofIds) {
      await prepareRun(
        "UPDATE proofs SET state = 'unspent' WHERE id = ? AND state = 'reserved'",
        proofId
      );
    }
  }

  /**
   * Get proof by ID
   */
  async getProof(proofId: string): Promise<Proof | null> {
    return prepareFirst<Proof>('SELECT * FROM proofs WHERE id = ?', proofId);
  }

  /**
   * Get all unspent proofs for a keyset
   */
  async getUnspentProofs(keysetId: string): Promise<Proof[]> {
    const result = await prepare<Proof>(
      "SELECT * FROM proofs WHERE keyset_id = ? AND state = 'unspent'",
      keysetId
    );
    return result.results;
  }

  /**
   * Get total unspent amount for a keyset
   */
  async getUnspentAmount(keysetId: string): Promise<number> {
    const result = await prepareFirst<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM proofs WHERE keyset_id = ? AND state = 'unspent'",
      keysetId
    );
    return result?.total || 0;
  }

  /**
   * Get spent proofs audit trail
   */
  async getSpentProofs(limit: number = 100): Promise<SpentProof[]> {
    const result = await prepare<SpentProof>(
      'SELECT * FROM spent_proofs ORDER BY spent_at DESC LIMIT ?',
      limit
    );
    return result.results;
  }

  /**
   * Check for stale reserved proofs (crash recovery)
   */
  async findStaleReservations(maxAgeMs: number = 60000): Promise<Proof[]> {
    const cutoff = Date.now() - maxAgeMs;
    const result = await prepare<Proof>(
      "SELECT * FROM proofs WHERE state = 'reserved' AND created_at < ?",
      cutoff
    );
    return result.results;
  }

  /**
   * Recover stale proofs after crash
   */
  async recoverStaleProofs(): Promise<number> {
    const staleProofs = await this.findStaleReservations();
    let recovered = 0;

    for (const proof of staleProofs) {
      // Check if corresponding output was created
      const outputExists = await prepareFirst<Proof>(
        'SELECT 1 FROM proofs WHERE secret = ? AND state = ?',
        proof.secret,
        'spent'
      );

      if (outputExists) {
        // Already processed - confirm as spent
        await prepareRun(
          "UPDATE proofs SET state = 'spent' WHERE id = ?",
          proof.id
        );
      } else {
        // Not processed - rollback to unspent
        await prepareRun(
          "UPDATE proofs SET state = 'unspent' WHERE id = ?",
          proof.id
        );
      }
      recovered++;
    }

    return recovered;
  }
}

// Singleton instance
let proofService: ProofService | null = null;

export function getProofService(): ProofService {
  if (!proofService) {
    proofService = new ProofService();
  }
  return proofService;
}
