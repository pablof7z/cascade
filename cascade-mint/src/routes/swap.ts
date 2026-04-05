/**
 * Swap Route - NUT-03 Proof Swap
 * Phase 1 - Foundation
 */

import { Hono } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { getSwapService } from '../services/SwapService.js';
import { getProofService } from '../services/ProofService.js';
import type { SwapRequest, SwapResponse, ApiError } from '../types/index.js';

const swap = new Hono();

/**
 * POST /v1/swap
 * Swap proofs between units (NUT-03)
 */
swap.post('/', async (c) => {
  try {
    const swapService = getSwapService();
    const proofService = getProofService();
    
    // Parse request
    const body = await c.req.json<SwapRequest>();
    const { inputs, outputs } = body;

    // Validate inputs
    if (!inputs || !Array.isArray(inputs) || inputs.length === 0) {
      const error: ApiError = {
        detail: 'Inputs array is required',
        code: 'proof_invalid',
        type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
      };
      return c.json(error, 400);
    }

    if (!outputs || !Array.isArray(outputs) || outputs.length === 0) {
      const error: ApiError = {
        detail: 'Outputs array is required',
        code: 'output_invalid',
        type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
      };
      return c.json(error, 400);
    }

    // Validate each input
    for (const input of inputs) {
      if (typeof input.amount !== 'number' || input.amount <= 0) {
        const error: ApiError = {
          detail: 'Input amount must be positive integer',
          code: 'amount_invalid',
          type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
        };
        return c.json(error, 400);
      }

      if (!input.id || !input.secret || !input.C) {
        const error: ApiError = {
          detail: 'Input proof must have id, secret, and C',
          code: 'proof_invalid',
          type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
        };
        return c.json(error, 400);
      }
    }

    // Validate each output
    for (const output of outputs) {
      if (typeof output.amount !== 'number' || output.amount <= 0) {
        const error: ApiError = {
          detail: 'Output amount must be positive integer',
          code: 'amount_invalid',
          type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
        };
        return c.json(error, 400);
      }
    }

    // Perform swap
    const result = await swapService.swap(body, 'long', 'short');

    const response: SwapResponse = {
      signatures: result.outputProofs.map((proof) => ({
        amount: proof.amount,
        id: proof.id,
        C_: proof.C,
        C: proof.C,
      })),
    };

    return c.json(response);
  } catch (error) {
    console.error('Swap error:', error);
    
    // Determine error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let status: StatusCode = 500;
    let code = 'internal_error';

    if (errorMessage.includes('not found')) {
      status = 400;
      code = 'proof_invalid';
    } else if (errorMessage.includes('already spent')) {
      status = 400;
      code = 'proof_spent';
    } else if (errorMessage.includes('exceeds')) {
      status = 400;
      code = 'amount_mismatch';
    } else if (errorMessage.includes('not available')) {
      status = 400;
      code = 'proof_invalid';
    }

    const err: ApiError = {
      detail: errorMessage,
      code,
      type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
    };
    c.status(status);
    return c.json(err);
  }
});

/**
 * GET /v1/swap/fee?amount={amount}
 * Calculate swap fee
 */
swap.get('/fee', async (c) => {
  try {
    const swapService = getSwapService();
    const amount = parseInt(c.req.query('amount') || '0', 10);

    if (isNaN(amount) || amount <= 0) {
      const error: ApiError = {
        detail: 'Amount must be a positive integer',
        code: 'amount_invalid',
        type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
      };
      return c.json(error, 400);
    }

    const fee = swapService.calculateFee(amount);
    const available = swapService.getAvailableAmount(amount);

    return c.json({
      amount,
      fee,
      available,
    });
  } catch (error) {
    console.error('Fee calculation error:', error);
    const err: ApiError = {
      detail: 'Failed to calculate fee',
      code: 'internal_error',
      type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
    };
    return c.json(err, 500);
  }
});

export default swap;
