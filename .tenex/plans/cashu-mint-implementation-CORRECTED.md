# Cashu Mint Implementation Plan — Phase 1 (Foundation) — CORRECTED

**Plan ID:** cashu-mint-implementation-corrected  
**Author:** tenex-planner (original), mint-engineer (corrections)  
**Status:** ✅ CORRECTED — All 7 blocking NUT protocol issues fixed  
**Target:** Hono.js + TypeScript + @cashu/cashu-ts on Vercel at `cascade-mint.f7z.io`  
**Phase:** 1 / 4 (Foundation — core Hono + TypeScript mint, no Lightning, no LMSR, no hardening)

---

## CHANGE SUMMARY FROM ORIGINAL

This corrected version fixes all 7 blocking NUT protocol issues identified in the architecture review:

| # | Issue | Original | Fixed |
|---|-------|----------|-------|
| B1 | NUT-04 Quote Response | `paid: boolean` | `state: "UNPAID"\|"PENDING"\|"PAID"` |
| B2 | NUT-01 BlindedMessage | Missing `id` field | Added `id: keyset_id` |
| B3 | NUT-01 Field Names | `blind` / `blind_signature` | `B_` / `C_` (per NUT-00 spec) |
| B4 | NUT-03 Swap Input | `inputs: [{proofs, unit}]` | `inputs: Array[Proof]` (flat) |
| B5 | NUT-03 Swap Output | Missing `id`, has `unit` | `id: keyset_id`, no `unit` |
| B6 | NUT-03 Response | `blind_signature` | `C_` per spec |
| B7 | NUT-07 Check | `/check` endpoint, `spendable: bool` | `/checkstate`, `state: enum` |

Plus corrections to:
- MINT_SEED validation (Important #2)
- Quote payment verification logic (Important #4)
- Quote expiry configuration (Important #3)
- Database schema constraints (DB2-DB3)
- @cashu/cashu-ts library imports (secp256k1 instead of ED25519)

---

## 1. Executive Summary

This plan defines Phase 1 of the Cascade Cashu mint — a **pure standalone Cashu NUT API service** deployed on Vercel. The mint implements NUT-01, NUT-02, NUT-03, NUT-04, NUT-05, NUT-06, and NUT-07 protocols with URL-segmented routing for market-specific keysets.

**Critical Architecture:**
- **Nostr relays are NOT involved** in mint operations. Relays are used by the Cascade frontend to fetch market metadata (kind 30000).
- **Market context is communicated via URL routing**, not Nostr relay queries.
- **Turso SQLite stores only mint state** — proofs, keysets, per-keyset shares/reserve.
- **NIP-60 wallet config** references `https://cascade-mint.f7z.io/{marketId}` as the mint endpoint for each market.

**Key Decisions:**
1. **URL Segmentation**: All market operations route through `/{marketId}/v1/*`
2. **Single Keyset Per Market**: Each market has one keyset with `long` and `short` denominations
3. **No Nostr Relay Code**: Market metadata is not fetched by the mint; it's passed as API parameters from the frontend
4. **Hono.js Routing**: Native support for dynamic path parameters

---

## 2. Architecture Overview

### 2.1 System Boundaries

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FRONTEND (Cascade SvelteKit App)                  │
│  - Fetches kind 30000 (market metadata) from Nostr relays           │
│  - Displays market info (slug, creator, description, etc.)          │
│  - Calls mint API with marketId in URL path                         │
│  - Stores NIP-60 wallet config with mint URL per market             │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ HTTP (calls mint API)
                         │ GET/POST /{marketId}/v1/mint, /{marketId}/v1/keys, etc.
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                    MINT SERVICE (cascade-mint.f7z.io)                │
│  - Pure Cashu NUT implementation (NUT-01/02/03/04/05/06/07)         │
│  - No Nostr relay connections                                       │
│  - Routes: /{marketId}/v1/mint, /{marketId}/v1/keys, etc.          │
│  - Turso SQLite: proofs, keysets, per-market state                  │
└────────────────────────┬────────────────────────────────────────────┘
                         │
                         │ SQL queries (Turso edge DB)
                         │
┌────────────────────────▼────────────────────────────────────────────┐
│                      TURSO SQLite (Edge DB)                          │
│  - proofs: (hash, keyset_id, amount, used)                          │
│  - keysets: (id, market_id, long_shares, short_shares, reserve)          │
│  - keys: (keyset_id, secret, public)                                │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 URL-Segmented Routing

All endpoints follow this pattern:
```
https://cascade-mint.f7z.io/{marketId}/v1/{endpoint}
```

**Routes:**
```
GET  /{marketId}/v1/info                      → Mint information (NUT-06)
POST /{marketId}/v1/mint/quote/bolt11         → Request mint quote (NUT-04)
GET  /{marketId}/v1/mint/quote/bolt11/{id}    → Check mint quote status (NUT-04)
POST /{marketId}/v1/mint/bolt11               → Mint tokens from quote (NUT-04)
GET  /{marketId}/v1/keys                      → All keys for market's keyset (NUT-01)
GET  /{marketId}/v1/keys/{keyset_id}          → Specific keyset keys (NUT-01)
GET  /{marketId}/v1/keysets                   → List keysets (NUT-02)
POST /{marketId}/v1/swap                      → Swap proofs (NUT-03)
POST /{marketId}/v1/checkstate                → Check proof spendability (NUT-07)
POST /{marketId}/v1/melt/quote/bolt11         → Melt quote (NUT-05, Phase 2)
POST /{marketId}/v1/melt/bolt11               → Melt tokens (NUT-05, Phase 2)
```

**Why URL segmentation:**
1. `marketId` is always in the route → mint always knows which keyset to use
2. `/v1/keys` returns only that market's keyset (no multi-keyset confusion)
3. NIP-60 wallet stores `https://cascade-mint.f7z.io/{marketId}` per market
4. Hono.js handles this natively: `app.post('/:marketId/v1/mint/quote/bolt11', ...)`

### 2.3 Keyset Model

**One keyset per market:**
- ID: `keyset-{marketId}` (deterministic from market slug)
- Units: Market outcomes (traded as `long`/`short` denominations, but NOT in API fields — unit is implicit via keyset_id)
- Stored in Turso: `keysets(id, market_id, long_shares, short_shares, reserve, created_at)`

**Example:**
```
Market: "bitcoin-price-dec-2025" (marketId)
Keyset ID: "keyset-bitcoin-price-dec-2025"
Units: { "long": 100 shares, "short": 50 shares }
Reserve: 150 sats
```

### 2.4 Keyset Generation (Phase 1)

At mint startup, for each existing market:
1. **Get market ID** from the frontend (passed as initialization parameter or read from a markets config)
2. **Generate keyset**: Deterministic BIP-32 derivation using market slug
   - Path: `m/46'/0'/0'/{marketIdHash}'` (per BIP-32, marketIdHash = first 4 bytes of SHA256(marketId))
   - Uses **secp256k1** (NOT ED25519) for ECDSA key generation — correct for Cashu protocol
3. **Store keyset** in Turso: `(id, market_id, public_keys, long_shares, short_shares, reserve)`

**No Nostr fetching** — the frontend or an admin configuration provides the list of market IDs to seed the mint.

---

## 3. Database Schema

### 3.1 Turso SQLite Tables

```sql
CREATE TABLE IF NOT EXISTS keysets (
  id TEXT PRIMARY KEY,                    -- "keyset-{marketId}"
  market_id TEXT NOT NULL UNIQUE,         -- Market identifier
  long_shares INTEGER NOT NULL DEFAULT 0, -- Total long share units
  short_shares INTEGER NOT NULL DEFAULT 0,-- Total short share units
  reserve INTEGER NOT NULL DEFAULT 0,     -- Reserve sats
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS keys (
  keyset_id TEXT NOT NULL,
  secret TEXT NOT NULL,
  public TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (keyset_id) REFERENCES keysets(id),
  UNIQUE(keyset_id, secret)
);

CREATE TABLE IF NOT EXISTS proofs (
  hash TEXT PRIMARY KEY,
  keyset_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL CHECK (unit IN ('long', 'short')),  -- ✅ Constrained
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (keyset_id) REFERENCES keysets(id)
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  keyset_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('UNPAID', 'PENDING', 'PAID')),  -- ✅ State enum
  expiry TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (keyset_id) REFERENCES keysets(id)
);

CREATE INDEX IF NOT EXISTS idx_proofs_keyset_used ON proofs(keyset_id, used);
CREATE INDEX IF NOT EXISTS idx_quotes_keyset_state ON quotes(keyset_id, state);
```

---

## 4. API Specification (CORRECTED)

### 4.1 GET `/{marketId}/v1/info`

**Response (NUT-06):**
```json
{
  "name": "Cascade Mint",
  "pubkey": "hex-encoded-mint-pubkey",
  "version": "0.1.0",
  "description": "Cashu mint for Cascade prediction markets",
  "contact": [{"method": "email", "info": "support@cascade.io"}],
  "nuts": {
    "4": {"methods": [{"method": "bolt11", "unit": "sat"}], "disabled": false},
    "5": {"methods": [{"method": "bolt11", "unit": "sat"}], "disabled": false},
    "7": {"supported": true}
  },
  "motd": "Welcome to Cascade Cashu Mint"
}
```

### 4.2 POST `/{marketId}/v1/mint/quote/bolt11` — ✅ CORRECTED

**Request (NUT-04):**
```json
{
  "amount": 1000,
  "unit": "sat"
}
```

**Response (NUT-04 MintQuoteBolt11Response):**
```json
{
  "quote": "quote_abc123",
  "request": "lnbc1000n1...",
  "state": "UNPAID",
  "expiry": 1712329600
}
```

**✅ FIXED**: `state: "UNPAID"|"PENDING"|"PAID"` instead of `paid: boolean`

### 4.3 POST `/{marketId}/v1/mint/bolt11` — ✅ CORRECTED

**Request (NUT-04 PostMintBolt11Request):**
```json
{
  "quote": "quote_abc123",
  "outputs": [
    {
      "amount": 500,
      "id": "keyset-bitcoin-price-dec-2025",
      "B_": "02634a2c..."
    },
    {
      "amount": 500,
      "id": "keyset-bitcoin-price-dec-2025",
      "B_": "026a9c7f..."
    }
  ]
}
```

**Response (NUT-04 PostMintBolt11Response):**
```json
{
  "signatures": [
    {
      "amount": 500,
      "id": "keyset-bitcoin-price-dec-2025",
      "C_": "02bc9097..."
    },
    {
      "amount": 500,
      "id": "keyset-bitcoin-price-dec-2025",
      "C_": "03abc1234..."
    }
  ]
}
```

**✅ FIXED**:
- `blind` → `B_` (NUT-00 BlindedMessage field name)
- `blind_signature` → `C_` (NUT-00 BlindSignature field name)
- Added required `id` field (keyset_id) to each output and signature
- Removed `unit` field (unit is implicit in keyset_id)

### 4.4 GET `/{marketId}/v1/keysets`

**Response (NUT-02):**
```json
{
  "keysets": [
    {
      "id": "keyset-bitcoin-price-dec-2025",
      "unit": "sat",
      "input_fee_ppk": 0
    }
  ]
}
```

### 4.5 GET `/{marketId}/v1/keys`

**Response (NUT-01):**
```json
{
  "keysets": [
    {
      "id": "keyset-bitcoin-price-dec-2025",
      "unit": "sat",
      "keys": {
        "1": "pubkey_hex_1",
        "2": "pubkey_hex_2",
        "4": "pubkey_hex_4",
        "8": "pubkey_hex_8"
      }
    }
  ]
}
```

### 4.6 POST `/{marketId}/v1/swap` — ✅ CORRECTED

**Request (NUT-03 PostSwapRequest):**
```json
{
  "inputs": [
    {
      "amount": 500,
      "id": "keyset-bitcoin-price-dec-2025",
      "secret": "secret_value",
      "C": "02abc..."
    }
  ],
  "outputs": [
    {
      "amount": 100,
      "id": "keyset-bitcoin-price-dec-2025",
      "B_": "02abc..."
    },
    {
      "amount": 400,
      "id": "keyset-bitcoin-price-dec-2025",
      "B_": "03def..."
    }
  ]
}
```

**Response (NUT-03 PostSwapResponse):**
```json
{
  "signatures": [
    {
      "amount": 100,
      "id": "keyset-bitcoin-price-dec-2025",
      "C_": "02xyz..."
    },
    {
      "amount": 400,
      "id": "keyset-bitcoin-price-dec-2025",
      "C_": "03uvw..."
    }
  ]
}
```

**✅ FIXED**:
- `inputs` is flat array of Proof objects (`{amount, id, secret, C}`) — NOT wrapped in `{proofs, unit}`
- `outputs` use `id` (keyset_id) and `B_` — NOT `unit` and `blind`
- Response uses `C_` — NOT `blind_signature`

### 4.7 POST `/{marketId}/v1/checkstate` — ✅ CORRECTED

**Request (NUT-07 PostCheckStateRequest):**
```json
{
  "Ys": [
    "02abc123...",
    "03def456..."
  ]
}
```

**Response (NUT-07 PostCheckStateResponse):**
```json
{
  "states": [
    {
      "Y": "02abc123...",
      "state": "UNSPENT",
      "witness": null
    },
    {
      "Y": "03def456...",
      "state": "SPENT",
      "witness": null
    }
  ]
}
```

**✅ FIXED**:
- Endpoint renamed from `/check` → `/checkstate` (NUT-07 spec)
- Request uses `Ys` array (Y = hash_to_curve(secret)) — NOT `proofs` array
- Response uses `states: [{Y, state, witness}]` — NOT `spendable: bool[]`
- State values: `"UNSPENT" | "PENDING" | "SPENT"` — NOT boolean

---

## 5. Deliverables

### 5.1 New Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Hono app setup, route registration |
| `src/routes/mint.ts` | `/{marketId}/v1/mint/*` endpoints (NUT-04) |
| `src/routes/keys.ts` | `/{marketId}/v1/keys/*` endpoints (NUT-01) |
| `src/routes/keysets.ts` | `/{marketId}/v1/keysets` endpoint (NUT-02) |
| `src/routes/swap.ts` | `/{marketId}/v1/swap` endpoint (NUT-03) |
| `src/routes/checkstate.ts` | `/{marketId}/v1/checkstate` endpoint (NUT-07) |
| `src/routes/info.ts` | `/{marketId}/v1/info` endpoint (NUT-06) |
| `src/services/keysetService.ts` | Keyset generation, BIP-32 derivation (secp256k1) |
| `src/services/proofService.ts` | Proof validation, spending logic |
| `src/services/dbService.ts` | Turso SQLite queries (proofs, keysets, quotes) |
| `src/utils/crypto.ts` | secp256k1 signing, blinding/unblinding |
| `src/types/cashu.ts` | TypeScript types for NUT protocols |
| `turso/migrations/001_init.sql` | Database schema |
| `vercel.json` | Vercel deployment config |
| `.env.example` | Environment variables template |

### 5.2 File Modifications

None — Phase 1 is a greenfield Hono project.

---

## 6. Implementation Details

### 6.1 src/index.ts

```typescript
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import mintRoutes from './routes/mint';
import keysRoutes from './routes/keys';
import keysetsRoutes from './routes/keysets';
import swapRoutes from './routes/swap';
import checkstateRoutes from './routes/checkstate';
import infoRoutes from './routes/info';

const app = new Hono();

// CORS for browser-based NIP-60 wallets
app.use(
  cors({
    origin: ['https://cascade-markets.vercel.app', 'http://localhost:5173'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  })
);

// Global middleware: extract and validate marketId from route
app.use('/:marketId/*', async (c, next) => {
  const marketId = c.req.param('marketId');

  // ✅ Validate marketId format (lowercase alphanumeric + hyphens)
  if (!marketId || !/^[a-z0-9-]+$/.test(marketId)) {
    return c.json({ error: 'Invalid marketId' }, 400);
  }

  c.set('marketId', marketId);
  await next();
});

// Register routes
app.route('/:marketId/v1', mintRoutes);
app.route('/:marketId/v1', keysRoutes);
app.route('/:marketId/v1', keysetsRoutes);
app.route('/:marketId/v1', swapRoutes);
app.route('/:marketId/v1', checkstateRoutes);
app.route('/:marketId/v1', infoRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

### 6.2 src/routes/info.ts (NUT-06)

```typescript
import { Hono } from 'hono';

const router = new Hono();

router.get('/info', (c) => {
  const response = {
    name: 'Cascade Mint',
    pubkey: process.env.MINT_PUBKEY || 'hex-pubkey',
    version: '0.1.0',
    description: 'Cashu mint for Cascade prediction markets',
    contact: [{ method: 'email', info: 'support@cascade.io' }],
    nuts: {
      '4': { methods: [{ method: 'bolt11', unit: 'sat' }], disabled: false },
      '5': { methods: [{ method: 'bolt11', unit: 'sat' }], disabled: false },
      '7': { supported: true },
    },
    motd: 'Welcome to Cascade Cashu Mint',
  };
  return c.json(response);
});

export default router;
```

### 6.3 src/services/keysetService.ts — ✅ CORRECTED (secp256k1)

```typescript
import crypto from 'crypto';
import { HDKey } from '@scure/bip32';
import * as secp256k1 from '@noble/secp256k1';

export interface Keyset {
  id: string;
  marketId: string;
  publicKeys: Record<string, string>; // amount -> pubkey hex
  longShares: number;
  shortShares: number;
  reserve: number;
}

/**
 * Deterministic keyset generation from marketId
 * Uses BIP-32 derivation: m/46'/0'/0'/{marketIdHash}'
 *
 * NOTE: This is a custom (non-standard) BIP-32 path for Cashu mint keysets.
 * It is NOT compatible with standard BIP-32 wallets or hardware wallets.
 * Used only internally by the Cascade mint server.
 *
 * ✅ Uses secp256k1 (ECDSA) — correct for Cashu protocol
 * ❌ Does NOT use ED25519 — that's for Nostr/EdDSA
 */
export function generateKeyset(marketId: string): Keyset {
  // ✅ Validate MINT_SEED
  const mintSeed = process.env.MINT_SEED;
  if (!mintSeed) {
    throw new Error('MINT_SEED environment variable is required');
  }

  const seedBuffer = Buffer.from(mintSeed, 'hex');
  if (seedBuffer.length !== 32) {
    throw new Error('MINT_SEED must be 32 bytes (64 hex characters)');
  }

  // Hash marketId to get derivation index
  const marketIdHash = crypto
    .createHash('sha256')
    .update(marketId)
    .digest()
    .readUInt32BE(0);

  // BIP-32 derivation path using secp256k1
  const path = `m/46'/0'/0'/${marketIdHash}'`;
  const hdKey = HDKey.fromMasterSeed(seedBuffer);
  const derived = hdKey.derive(path);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key from BIP-32 path');
  }

  // Generate keys for standard Cashu amounts (powers of 2)
  const amounts = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
  const publicKeys: Record<string, string> = {};

  amounts.forEach((amount) => {
    const secret = crypto
      .createHmac('sha256', derived.privateKey!)
      .update(Buffer.from([amount]))
      .digest();

    // secp256k1 public key derivation — correct for Cashu
    const pubkeyBytes = secp256k1.getPublicKey(secret, true); // compressed
    const pubkeyHex = Buffer.from(pubkeyBytes).toString('hex');
    publicKeys[amount.toString()] = pubkeyHex;
  });

  return {
    id: `keyset-${marketId}`,
    marketId,
    publicKeys,
    longShares: 0,
    shortShares: 0,
    reserve: 0,
  };
}
```

### 6.4 src/routes/mint.ts — ✅ CORRECTED (NUT-04)

```typescript
import { Hono } from 'hono';
import * as dbService from '../services/dbService';
import * as cryptoUtils from '../utils/crypto';

const router = new Hono();

// NUT-04: POST /v1/mint/quote/bolt11
router.post('/mint/quote/bolt11', async (c) => {
  const marketId = c.get('marketId');
  const { amount, unit } = await c.req.json();

  if (!amount || !unit) {
    return c.json({ error: 'Missing amount or unit' }, 400);
  }

  const keyset = await dbService.getKeyset(`keyset-${marketId}`);
  if (!keyset) {
    return c.json({ error: 'Keyset not found for market' }, 404);
  }

  const quoteId = cryptoUtils.randomId();
  const quoteExpirySeconds = parseInt(process.env.QUOTE_EXPIRY_SECONDS || '3600');
  const expiry = Math.floor(Date.now() / 1000) + quoteExpirySeconds;

  // Phase 1: No Lightning. Return mock quote.
  // Phase 2: Generate actual Lightning invoice via LND/CLN
  await dbService.saveQuote(quoteId, keyset.id, amount, expiry);

  // ✅ FIXED: Use state enum, not paid boolean
  return c.json({
    quote: quoteId,
    request: 'lnbc...', // Phase 2: actual bolt11 invoice
    state: 'UNPAID',    // ✅ NUT-04 state enum
    expiry,
  });
});

// NUT-04: GET /v1/mint/quote/bolt11/{quote_id}
router.get('/mint/quote/bolt11/:quoteId', async (c) => {
  const quoteId = c.req.param('quoteId');
  const quoteRecord = await dbService.getQuote(quoteId);

  if (!quoteRecord) {
    return c.json({ error: 'Quote not found' }, 404);
  }

  return c.json({
    quote: quoteRecord.id,
    request: 'lnbc...', // Phase 2: stored bolt11
    state: quoteRecord.state,
    expiry: quoteRecord.expiry,
  });
});

// NUT-04: POST /v1/mint/bolt11
router.post('/mint/bolt11', async (c) => {
  const marketId = c.get('marketId');
  const { quote, outputs } = await c.req.json();

  // ✅ ADDED: Quote validation
  const quoteRecord = await dbService.getQuote(quote);
  if (!quoteRecord) {
    return c.json({ error: 'Quote not found' }, 404);
  }

  // ✅ ADDED: Quote payment verification
  if (quoteRecord.state !== 'PAID') {
    return c.json({ error: 'Quote not yet paid' }, 402);
  }

  // ✅ ADDED: Quote expiry check
  if (Math.floor(Date.now() / 1000) > quoteRecord.expiry) {
    return c.json({ error: 'Quote expired' }, 400);
  }

  if (!outputs || outputs.length === 0) {
    return c.json({ error: 'Missing outputs' }, 400);
  }

  const keyset = await dbService.getKeyset(`keyset-${marketId}`);
  if (!keyset) {
    return c.json({ error: 'Keyset not found' }, 404);
  }

  // ✅ CORRECTED: Build signatures with NUT-00 field names
  // Each output: { amount: int, id: hex_str, B_: hex_str }
  // Each signature: { amount: int, id: hex_str, C_: hex_str }
  const signatures = outputs.map((output: any) => {
    if (!output.id || !output.B_ || output.amount == null) {
      throw new Error('Invalid output: missing id, B_, or amount');
    }

    return {
      amount: output.amount,
      id: output.id,
      C_: cryptoUtils.blindSign(output.B_, keyset.secret), // ✅ C_ not blind_signature
    };
  });

  return c.json({ signatures });
});

export default router;
```

### 6.5 src/routes/swap.ts — ✅ CORRECTED (NUT-03)

```typescript
import { Hono } from 'hono';
import * as dbService from '../services/dbService';
import * as cryptoUtils from '../utils/crypto';

const router = new Hono();

// NUT-03: POST /v1/swap
router.post('/swap', async (c) => {
  const marketId = c.get('marketId');
  const { inputs, outputs } = await c.req.json();

  // ✅ FIXED: inputs is flat Array[Proof], not wrapped
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return c.json({ error: 'Missing or invalid inputs' }, 400);
  }

  if (!Array.isArray(outputs) || outputs.length === 0) {
    return c.json({ error: 'Missing or invalid outputs' }, 400);
  }

  const keyset = await dbService.getKeyset(`keyset-${marketId}`);
  if (!keyset) {
    return c.json({ error: 'Keyset not found' }, 404);
  }

  // NUT-03: Validate input proofs are unspent
  // Each input Proof: { amount: int, id: hex_str, secret: str, C: hex_str }
  for (const input of inputs) {
    if (!input.secret || !input.C || input.amount == null) {
      return c.json({ error: 'Invalid proof: missing secret, C, or amount' }, 400);
    }

    const Y = cryptoUtils.hashToCurve(input.secret);
    const isSpent = await dbService.checkProofSpent(Y);
    if (isSpent) {
      return c.json({ error: `Proof already spent` }, 400);
    }
  }

  // Mark inputs as spent
  for (const input of inputs) {
    const Y = cryptoUtils.hashToCurve(input.secret);
    await dbService.markProofSpent(Y);
  }

  // ✅ FIXED: outputs is Array[BlindedMessage] with {amount, id, B_}
  const signatures = outputs.map((output: any) => {
    if (!output.id || !output.B_ || output.amount == null) {
      throw new Error('Invalid output: missing id, B_, or amount');
    }

    return {
      amount: output.amount,
      id: output.id,
      C_: cryptoUtils.blindSign(output.B_, keyset.secret), // ✅ C_
    };
  });

  return c.json({ signatures });
});

export default router;
```

### 6.6 src/routes/checkstate.ts — ✅ CORRECTED (NUT-07)

```typescript
import { Hono } from 'hono';
import * as dbService from '../services/dbService';

const router = new Hono();

// ✅ FIXED: Endpoint renamed from /check → /checkstate
// NUT-07: POST /v1/checkstate
router.post('/checkstate', async (c) => {
  const { Ys } = await c.req.json();

  if (!Array.isArray(Ys)) {
    return c.json({ error: 'Ys must be an array of hex strings' }, 400);
  }

  // ✅ FIXED: Response structure per NUT-07
  // Instead of: { spendable: [true, false] }
  // Use: { states: [{ Y, state, witness }, ...] }
  const states = await Promise.all(
    Ys.map(async (Y: string) => {
      const isSpent = await dbService.checkProofSpent(Y);
      return {
        Y,
        state: isSpent ? 'SPENT' : 'UNSPENT', // ✅ State enum, not boolean
        witness: null,
      };
    })
  );

  return c.json({ states });
});

export default router;
```

### 6.7 src/routes/keys.ts (NUT-01)

```typescript
import { Hono } from 'hono';
import * as dbService from '../services/dbService';

const router = new Hono();

// NUT-01: GET /v1/keys
router.get('/keys', async (c) => {
  const marketId = c.get('marketId');
  const keyset = await dbService.getKeyset(`keyset-${marketId}`);

  if (!keyset) {
    return c.json({ error: 'Keyset not found' }, 404);
  }

  return c.json({
    keysets: [
      {
        id: keyset.id,
        unit: 'sat',
        keys: keyset.publicKeys,
      },
    ],
  });
});

// NUT-01: GET /v1/keys/{keyset_id}
router.get('/keys/:keysetId', async (c) => {
  const keysetId = c.req.param('keysetId');
  const keyset = await dbService.getKeyset(keysetId);

  if (!keyset) {
    return c.json({ error: 'Keyset not found' }, 404);
  }

  return c.json({
    id: keyset.id,
    unit: 'sat',
    keys: keyset.publicKeys,
  });
});

export default router;
```

### 6.8 src/routes/keysets.ts (NUT-02)

```typescript
import { Hono } from 'hono';
import * as dbService from '../services/dbService';

const router = new Hono();

// NUT-02: GET /v1/keysets
router.get('/keysets', async (c) => {
  const marketId = c.get('marketId');
  const keyset = await dbService.getKeyset(`keyset-${marketId}`);

  if (!keyset) {
    return c.json({ error: 'Keyset not found' }, 404);
  }

  return c.json({
    keysets: [
      {
        id: keyset.id,
        unit: 'sat',
        input_fee_ppk: 0, // NUT-02: fee per thousand for input proofs
      },
    ],
  });
});

export default router;
```

### 6.9 src/services/dbService.ts — ✅ CORRECTED

```typescript
import { createClient } from '@libsql/client';

const db = createClient({
  url: process.env.TURSO_CONNECTION_URL || '',
  authToken: process.env.TURSO_AUTH_TOKEN || '',
});

export async function getKeyset(keysetId: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM keysets WHERE id = ?',
    args: [keysetId],
  });
  return result.rows[0];
}

export async function saveQuote(
  id: string,
  keysetId: string,
  amount: number,
  expiry: number
) {
  await db.execute({
    sql: 'INSERT INTO quotes (id, keyset_id, amount, state, expiry) VALUES (?, ?, ?, ?, ?)',
    args: [id, keysetId, amount, 'UNPAID', expiry],
  });
}

export async function getQuote(quoteId: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM quotes WHERE id = ?',
    args: [quoteId],
  });
  return result.rows[0];
}

export async function saveProof(
  hash: string,
  keysetId: string,
  amount: number,
  unit: string
) {
  if (unit !== 'long' && unit !== 'short') {
    throw new Error('Invalid unit: must be "long" or "short"');
  }

  await db.execute({
    sql: 'INSERT INTO proofs (hash, keyset_id, amount, unit, used) VALUES (?, ?, ?, ?, FALSE)',
    args: [hash, keysetId, amount, unit],
  });
}

export async function markProofSpent(Y: string) {
  await db.execute({
    sql: 'UPDATE proofs SET used = TRUE WHERE hash = ?',
    args: [Y],
  });
}

export async function checkProofSpent(Y: string): Promise<boolean> {
  const result = await db.execute({
    sql: 'SELECT used FROM proofs WHERE hash = ?',
    args: [Y],
  });
  return result.rows.length > 0 && result.rows[0]?.used === true;
}
```

---

## 7. Deployment Configuration

### 7.1 vercel.json

```json
{
  "buildCommand": "npm run build",
  "env": {
    "TURSO_CONNECTION_URL": "@turso_connection_url",
    "TURSO_AUTH_TOKEN": "@turso_auth_token",
    "MINT_PUBKEY": "@mint_pubkey",
    "MINT_SEED": "@mint_seed",
    "QUOTE_EXPIRY_SECONDS": "@quote_expiry_seconds"
  }
}
```

### 7.2 package.json

```json
{
  "name": "cascade-mint",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "hono": "^4.0.0",
    "@cashu/cashu-ts": "^0.15.0",
    "@libsql/client": "^0.5.0",
    "@scure/bip32": "^1.3.0",
    "@noble/secp256k1": "^1.7.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "tsx": "^4.0.0"
  }
}
```

### 7.3 .env.example

```
TURSO_CONNECTION_URL=libsql://...
TURSO_AUTH_TOKEN=...
MINT_PUBKEY=...
MINT_SEED=...   # 32 bytes, hex-encoded (64 characters)
QUOTE_EXPIRY_SECONDS=3600
```

---

## 8. Initialization Flow

**On first deployment:**

1. **Admin / env vars provide market list** (or reads from a configuration endpoint)
2. **For each market:**
   - Generate keyset via `keysetService.generateKeyset(marketId)`
   - Insert into Turso: `INSERT INTO keysets(id, market_id, long_shares, short_shares, reserve)`
3. **Mint is ready** to accept API calls to `/{marketId}/v1/*`

**No Nostr relay code is involved.**

---

## 9. Testing Strategy

### 9.1 Unit Tests

- **keysetService.test.ts**: Deterministic keyset generation, BIP-32 derivation with secp256k1
- **crypto.test.ts**: Hash-to-curve, blind signing, signature verification

### 9.2 Integration Tests

- **mint.test.ts**: Quote → Mint flow with NUT-04 field names
- **swap.test.ts**: Proof swap with NUT-03 structure, double-spend detection
- **checkstate.test.ts**: Proof state checks with NUT-07 response format
- **multi-market.test.ts**: Multiple markets, isolated keysets

### 9.3 NUT Compliance Tests

Critical: **Every test must verify NUT-compliant field names**:
- Outputs use `B_` not `blind`
- Signatures use `C_` not `blind_signature`
- Outputs include `id` (keyset_id)
- Quote responses use `state` enum not `paid` boolean
- Check endpoint is `/checkstate` not `/check`
- Check response is `{states: [{Y, state, witness}]}` not `{spendable: bool[]}`

### 9.4 Test Scenarios

1. **Mint a proof** → Quote → Pay → Mint with correct NUT-04 fields
2. **Spend a proof** → Swap with correct NUT-03 fields
3. **Attempt double-spend** → Reject (proof already used)
4. **Swap proofs** → Validate output amounts and keyset routing
5. **Multiple markets** → Each has its own keyset, isolated state
6. **Check state transitions** → UNSPENT → PENDING → SPENT
7. **Expired quote** → Reject minting attempt
8. **Unpaid quote** → Reject minting attempt

---

## 10. Notes & Constraints

### 10.1 Phase 1 Scope

- ✅ Hono.js + TypeScript
- ✅ NUT-01/02/03/04/06/07 (keys, keysets, swap, mint, info, checkstate)
- ✅ Turso SQLite for state
- ✅ URL-segmented routing for market keysets
- ✅ Corrected NUT protocol field names and structures
- ✅ secp256k1 crypto (correct for Cashu)
- ❌ Lightning (Phase 2)
- ❌ LMSR math (Phase 2, handled by frontend)
- ❌ NUT-05 melt (Phase 2)
- ❌ NUT-12 DLEQ proofs (Phase 2, nice-to-have)
- ❌ Hardening (audit, rate limits, etc. — Phase 4)

### 10.2 Architecture Principles

1. **No Nostr relay code** — Mint is a pure Cashu API server
2. **Market context via URL** — Not fetched from Nostr
3. **Turso stores mint state only** — Proofs, keysets, quotes
4. **Deterministic keysets** — BIP-32 derivation from marketId ensures consistency
5. **One keyset per market** — `long` and `short` denominations
6. **NUT-compliant field names** — `B_`, `C_`, `state`, `id` (per NUT-00)

### 10.3 Known Limitations

- Phase 1 has no Lightning support (melt is a placeholder)
- No DLEQ proofs (NUT-12) — add in Phase 2
- No rate limiting or DDoS protection — Phase 4
- No audit logging — Phase 4
- No concurrent double-spend race condition handling — Phase 4

---

## 11. Success Criteria

✅ Mint accepts requests to `/{marketId}/v1/mint/quote/bolt11`  
✅ Mint returns `state: "UNPAID"` (not `paid: false`) in quote response  
✅ Mint returns signed proofs with `C_` and `id` fields (NUT-04)  
✅ Swap endpoint accepts flat Proof array and outputs with `B_` and `id` (NUT-03)  
✅ Checkstate endpoint at `/checkstate` returns `{states: [{Y, state, witness}]}` (NUT-07)  
✅ Multiple markets have isolated keysets  
✅ No Nostr relay code in the codebase  
✅ Turso database stores and retrieves state correctly  
✅ MINT_SEED validation prevents deployment errors  
✅ Quote payment verification prevents token minting without payment  

---

## 12. References

- **@cashu/cashu-ts**: https://github.com/cashubtc/cashu-ts
- **NUT Specifications**: https://github.com/cashubtc/nuts
- **Hono.js**: https://hono.dev
- **Turso**: https://turso.tech
- **BIP-32**: https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **@noble/secp256k1**: https://github.com/noble/secp256k1
- **@scure/bip32**: https://github.com/paulmillr/scure-bip32
- **Architecture Review**: `$AGENT_HOME/projects/cascade-8f3k2m/docs/+cashu-mint-architecture-review.md`

---

**End of file.** Corrected plan ready for execution-coordinator handoff.

**All 7 blocking NUT protocol issues resolved. All important issues addressed.**
