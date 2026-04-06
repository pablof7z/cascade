/**
 * Cascade Mint - Cashu Mint for Cascade Prediction Markets
 * Phase 1 - Foundation
 * 
 * Hono.js + TypeScript mint running on Vercel
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Database
import { initDatabase } from './database/index.js';
import { runMigrations } from './database/migrator.js';

// Routes
import infoRoute from './routes/info.js';
import mintRoute from './routes/mint.js';
import swapRoute from './routes/swap.js';

// Services
import { getMintService } from './services/MintService.js';
import { getProofService } from './services/ProofService.js';

// Types
import type { ApiError } from './types/index.js';

// Environment
import { validateConfig, NODE_ENV } from './config.js';

// Types for Cloudflare Workers
interface Env {
  DB: D1Database;
  MASTER_SEED?: string;
  CASHU_FEE_RATE?: string;
  NOSTR_RELAYS?: string;
  NOSTR_PUBKEY?: string;
}

/**
 * Create and configure Hono app
 */
function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // Middleware
  app.use('*', logger());
  app.use('*', cors());
  app.use('*', async (c, next) => {
    try {
      await next();
    } catch (error) {
      console.error('Unhandled error:', error);
      c.status(500);
      return c.json({
        detail: error instanceof Error ? error.message : 'Internal server error',
        code: 'internal_error',
        type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
      });
    }
  });

  // Health check
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

  // API routes
  app.route('/v1/info', infoRoute);
  app.route('/v1/mint', mintRoute);
  app.route('/v1/swap', swapRoute);

  // 404 handler
  app.notFound((c) => {
    const err: ApiError = {
      detail: 'Not found',
      code: 'not_found',
      type: 'https://github.com/cashubtc/nuts/blob/main/NUT-00.md',
    };
    return c.json(err, 404);
  });

  return app;
}

/**
 * Initialize services and run migrations
 */
async function initialize(env: Env) {
  // Validate configuration
  const configValidation = validateConfig();
  if (!configValidation.valid && NODE_ENV === 'production') {
    throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
  }

  // Initialize database
  if (env.DB) {
    initDatabase(env.DB);

    // Run migrations
    try {
      // Load migration files
      const migrationFiles = [
        {
          name: '001-initial-schema.sql',
          upSql: `
-- Keysets table
CREATE TABLE IF NOT EXISTS keysets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL UNIQUE,
  market_hash TEXT NOT NULL,
  long_pubkey TEXT NOT NULL,
  short_pubkey TEXT NOT NULL,
  long_privkey TEXT NOT NULL,
  short_privkey TEXT NOT NULL,
  reserve_sat INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  nostr_event_id TEXT
);

-- Quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sat',
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  request TEXT,
  keyset_id TEXT NOT NULL REFERENCES keysets(id)
);

-- Proofs table
CREATE TABLE IF NOT EXISTS proofs (
  id TEXT PRIMARY KEY,
  keyset_id TEXT NOT NULL REFERENCES keysets(id),
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sat',
  secret TEXT NOT NULL,
  C TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'unspent',
  quote_id TEXT REFERENCES quotes(id),
  created_at INTEGER NOT NULL,
  spent_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_proofs_state ON proofs(state);
CREATE INDEX IF NOT EXISTS idx_proofs_keyset ON proofs(keyset_id);
CREATE INDEX IF NOT EXISTS idx_proofs_spent ON proofs(spent_at);

-- Spent proofs log
CREATE TABLE IF NOT EXISTS spent_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proof_id TEXT NOT NULL UNIQUE REFERENCES proofs(id),
  swap_txid TEXT,
  spent_at INTEGER NOT NULL,
  spent_by_pubkey TEXT
);

-- Migrations table
CREATE TABLE IF NOT EXISTS migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER NOT NULL,
  rollback_sql TEXT
);
          `,
          downSql: `
DROP TABLE IF EXISTS spent_proofs;
DROP TABLE IF EXISTS proofs;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS keysets;
DROP TABLE IF EXISTS migrations;
          `,
        },
      ];

      await runMigrations(migrationFiles);
      console.log('✅ Database migrations complete');
    } catch (error) {
      console.error('❌ Migration failed:', error);
      throw error;
    }

    // Run crash recovery
    try {
      const proofService = getProofService();
      const recovered = await proofService.recoverStaleProofs();
      if (recovered > 0) {
        console.log(`✅ Recovered ${recovered} stale proofs`);
      }
    } catch (error) {
      console.error('Recovery check failed:', error);
    }

    // Clean up expired quotes
    try {
      const mintService = getMintService();
      const cleaned = await mintService.cleanupExpiredQuotes();
      if (cleaned > 0) {
        console.log(`✅ Cleaned up ${cleaned} expired quotes`);
      }
    } catch (error) {
      console.error('Quote cleanup failed:', error);
    }
  }
}

// Export for Vercel/Cloudflare Workers
export default {
  fetch: async (request: Request, env: Env) => {
    try {
      // Initialize on first request
      if (!globalThis.__mintInitialized) {
        await initialize(env);
        globalThis.__mintInitialized = true;
      }

      const app = createApp();
      return app.fetch(request, env);
    } catch (error) {
      console.error('Request error:', error);
      return new Response(
        JSON.stringify({
          detail: error instanceof Error ? error.message : 'Internal server error',
          code: 'internal_error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};

// Type augmentation for global
declare global {
  var __mintInitialized: boolean | undefined;
}
