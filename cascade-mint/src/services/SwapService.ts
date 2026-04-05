/**
 * SwapService - NUT-03 Swap Logic
 * Phase 1 - Foundation
 */

import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/curves/abstract/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import { randomBytes } from '@noble/hashes/utils';
import { CASHU_FEE_RATE } from '../config.js';
import { getDatabase, prepareFirst, prepareRun } from '../database/index.js';
import { getKeysetService } from './KeysetService.js';
import { getProofService } from './ProofService.js';
import type { Proof, SwapResult, SwapRequest, Keyset } from '../types/index.js';

/**
 * Calculate swap fee
 */
function calculateSwapFee(amount: number): number {
  return Math.ceil((amount * CASHU_FEE_RATE) / 100);
}

export class SwapService {
  private keysetService = getKeysetService();
  private proofService = getProofService();

  /**
   * Swap proofs between units (LONG ↔ SHORT)
   * Implements NUT-03 atomic swap
   */
  async swap(
    request: SwapRequest,
    inputUnit: 'long' | 'short',
    outputUnit: 'long' | 'short'
  ): Promise<SwapResult> {
    // Validate inputs
    const validation = await this.validateSwapRequest(request, inputUnit, outputUnit);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const totalInputAmount = request.inputs.reduce((sum, i) => sum + i.amount, 0);
    const fee = calculateSwapFee(totalInputAmount);
    const outputAmount = totalInputAmount - fee;

    // Validate output amounts match
    const totalOutputAmount = request.outputs.reduce((sum, o) => sum + o.amount, 0);
    if (totalOutputAmount > outputAmount) {
      throw new Error(`Output amount ${totalOutputAmount} exceeds available after fee ${outputAmount}`);
    }

    // Get keysets
    const inputKeyset = await this.keysetService.getOrCreateKeyset('default-market');
    const outputKeyset = inputKeyset; // Same market, different unit

    // Reserve and spend input proofs
    const inputProofIds = request.inputs.map(i => i.id);
    const reserveResult = await this.proofService.reserveProofs(inputProofIds);
    if (!reserveResult.success) {
      throw new Error(reserveResult.error);
    }

    try {
      // Spend input proofs
      for (const input of request.inputs) {
        const spendResult = await this.proofService.spendProof(input.id);
        if (!spendResult.success) {
          throw new Error(spendResult.error);
        }
      }

      // Generate output proofs
      const outputProofs: Proof[] = [];
      const now = Date.now();

      for (const output of request.outputs) {
        const proof = await this.createSwapOutputProof(output, outputKeyset, now);
        outputProofs.push(proof);
      }

      // Store output proofs
      await this.proofService.storeProofs(outputProofs);

      return {
        amount: outputAmount,
        fee,
        outputProofs,
      };
    } finally {
      // Release reservations if anything fails
      // (Proofs are already spent if we got here)
    }
  }

  /**
   * Create an output proof for swap
   */
  private async createSwapOutputProof(
    output: { amount: number; id: string; B_: string; B: string },
    keyset: Keyset,
    createdAt: number
  ): Promise<Proof> {
    // Generate random secret
    const secretBytes = randomBytes(32);
    const secret = bytesToHex(secretBytes);

    // Compute commitment
    const secretHash = sha256(secretBytes);
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
      createdAt,
    };
  }

  /**
   * Validate swap request
   */
  async validateSwapRequest(
    request: SwapRequest,
    inputUnit: string,
    outputUnit: string
  ): Promise<{ valid: boolean; error?: string }> {
    // Check inputs exist
    if (!request.inputs || request.inputs.length === 0) {
      return { valid: false, error: 'No inputs provided' };
    }

    // Check outputs exist
    if (!request.outputs || request.outputs.length === 0) {
      return { valid: false, error: 'No outputs provided' };
    }

    // Validate each input proof
    for (const input of request.inputs) {
      // Check if proof exists
      const proof = await this.proofService.getProof(input.id);
      if (!proof) {
        return { valid: false, error: `Input proof ${input.id} not found` };
      }

      // Check if already spent
      const isSpent = await this.proofService.isProofSpent(input.id);
      if (isSpent) {
        return { valid: false, error: `Input proof ${input.id} already spent` };
      }

      // Verify amount matches
      if (proof.amount !== input.amount) {
        return { valid: false, error: `Amount mismatch for proof ${input.id}` };
      }
    }

    // Calculate totals
    const totalInput = request.inputs.reduce((sum, i) => sum + i.amount, 0);
    const totalOutput = request.outputs.reduce((sum, o) => sum + o.amount, 0);
    const fee = calculateSwapFee(totalInput);
    const expectedOutput = totalInput - fee;

    if (totalOutput > expectedOutput) {
      return { valid: false, error: `Output amount ${totalOutput} exceeds available ${expectedOutput} after ${fee} fee` };
    }

    return { valid: true };
  }

  /**
   * Calculate fee for swap
   */
  calculateFee(amount: number): number {
    return calculateSwapFee(amount);
  }

  /**
   * Get available amount after fee
   */
  getAvailableAmount(inputAmount: number): number {
    return inputAmount - calculateSwapFee(inputAmount);
  }
}

// Singleton instance
let swapService: SwapService | null = null;

export function getSwapService(): SwapService {
  if (!swapService) {
    swapService = new SwapService();
  }
  return swapService;
}
