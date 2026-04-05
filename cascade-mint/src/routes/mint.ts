/**
 * Mint Routes - NUT-02 Mint Request & Quote
 * Phase 1 - Foundation
 */

import { Hono } from 'hono';
import type { StatusCode } from 'hono/utils/http-status';
import { getMintService } from '../services/MintService.js';
import { getKeysetService } from '../services/KeysetService.js';
import type { MintQuoteResponse, MintBoltRequest, MintBoltResponse, ApiError } from '../types/index.js';

const mint = new Hono();

/**
 * POST /v1/mint/quote
 * Create a mint quote (NUT-02)
 * 
 * For Phase 1: 0-sat quotes are immediately paid
 */
mint.post('/quote', async (c) => {
  try {
    const mintService = getMintService();
    
    // Parse request
    const body = await c.req.json<{ amount: number; unit?: string }>();
    const { amount, unit = 'sat' } = body;

    // Validate amount
    if (typeof amount !== 'number' || amount < 0 || !Number.isInteger(amount)) {
      const error: ApiError = {
        detail: 'Amount must be a non-negative integer',
        code: 'amount_invalid',
        type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
      };
      return c.json(error, 400);
    }

    // Create quote
    const quote = await mintService.createQuote(amount, unit);

    const response: MintQuoteResponse = {
      quote: quote.id,
      amount: quote.amount,
      unit: quote.unit,
      request: quote.request,
      paid: quote.paid,
      expiry: Math.floor(quote.expiresAt / 1000),
    };

    return c.json(response);
  } catch (error) {
    console.error('Mint quote error:', error);
    const err: ApiError = {
      detail: error instanceof Error ? error.message : 'Failed to create quote',
      code: 'internal_error',
      type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
    };
    return c.json(err, 500);
  }
});

/**
 * POST /v1/mint/bolts
 * Mint proofs with quote (NUT-02)
 */
mint.post('/bolts', async (c) => {
  try {
    const mintService = getMintService();
    
    // Parse request
    const body = await c.req.json<MintBoltRequest>();
    const { quote, outputs } = body;

    // Validate inputs
    if (!quote || typeof quote !== 'string') {
      const error: ApiError = {
        detail: 'Quote ID is required',
        code: 'quote_invalid',
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

    // Generate proofs
    const proofs = await mintService.generateProofs(quote, outputs);

    const response: MintBoltResponse = {
      signatures: proofs.map((proof) => ({
        amount: proof.amount,
        id: proof.id,
        C_: proof.C, // Blinded signature
        C: proof.C,  // Unblinded signature
      })),
    };

    return c.json(response);
  } catch (error) {
    console.error('Mint bolts error:', error);
    
    // Determine error type
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    let status: StatusCode = 500;
    let code = 'internal_error';

    if (errorMessage.includes('not found')) {
      status = 400;
      code = 'quote_invalid';
    } else if (errorMessage.includes('not paid')) {
      status = 400;
      code = 'quote_unpaid';
    } else if (errorMessage.includes('expired')) {
      status = 422;
      code = 'quote_expired';
    } else if (errorMessage.includes('exceeds')) {
      status = 400;
      code = 'amount_mismatch';
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
 * GET /v1/mint/quote/:quoteId
 * Get quote status
 */
mint.get('/quote/:quoteId', async (c) => {
  try {
    const mintService = getMintService();
    const quoteId = c.req.param('quoteId');

    const quote = await mintService.getQuote(quoteId);

    if (!quote) {
      const error: ApiError = {
        detail: 'Quote not found',
        code: 'quote_invalid',
        type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
      };
      return c.json(error, 404);
    }

    const response: MintQuoteResponse = {
      quote: quote.id,
      amount: quote.amount,
      unit: quote.unit,
      request: quote.request,
      paid: quote.paid,
      expiry: Math.floor(quote.expiresAt / 1000),
    };

    return c.json(response);
  } catch (error) {
    console.error('Get quote error:', error);
    const err: ApiError = {
      detail: 'Failed to get quote',
      code: 'internal_error',
      type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
    };
    return c.json(err, 500);
  }
});

export default mint;
