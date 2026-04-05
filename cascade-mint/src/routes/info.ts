/**
 * Info Route - NUT-00 Mint Info
 * Phase 1 - Foundation
 */

import { Hono } from 'hono';
import { getKeysetService } from '../services/KeysetService.js';
import { MINT_CONFIG } from '../config.js';
import type { MintInfo, ApiError } from '../types/index.js';

const info = new Hono();

/**
 * GET /v1/info
 * Returns mint information following NUT-00 spec
 */
info.get('/', async (c) => {
  try {
    const keysetService = getKeysetService();
    
    // Get default keyset for pubkey
    const keyset = await keysetService.getOrCreateKeyset('default-market');
    
    const mintInfo: MintInfo = {
      name: MINT_CONFIG.name,
      pubkey: keyset.longPubkey, // Use long key for mint pubkey
      version: '4.0.0',
      description: MINT_CONFIG.description,
      nuts: {
        '0': {
          methods: ['GET'],
          unit: 'sat',
        },
        '2': {
          methods: ['POST'],
          unit: 'sat',
        },
        '3': {
          methods: ['POST'],
          unit: 'sat',
        },
      },
      motd: MINT_CONFIG.motd,
    };

    return c.json(mintInfo);
  } catch (error) {
    console.error('Mint info error:', error);
    const err: ApiError = {
      detail: 'Failed to get mint info',
      code: 'internal_error',
      type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
    };
    return c.json(err, 500);
  }
});

export default info;
