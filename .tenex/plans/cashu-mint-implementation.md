# Cashu Mint Implementation Plan — Phase 1 (Foundation)

**Plan ID:** cashu-mint-implementation  
**Author:** tenex-planner  
**Status:** ✅ FINALIZED — Ready for Execution  
**Target:** Hono.js + TypeScript + @cashu/cashu-ts on Vercel at `cascade-mint.f7z.io`  
**Phase:** 1 / 4 (Foundation — core Hono + TypeScript mint, no Lightning, no LMSR, no hardening)

---

## 1. Executive Summary

This plan defines Phase 1 of the Cashu Mint for Cascade Prediction Markets. Phase 1 establishes the foundation: a Hono.js + TypeScript mint on Vercel that generates deterministic keysets per market, maintains proof state in Turso, and implements NUT-00/02/03 endpoints with full error handling, relay health checks, and database migration support.

**Key Changes from Initial Draft:**
- **✅ 2 Product Decisions Finalized** (Sections 2.4.1 & 2.4.2):
  - Keyset ID: `market_id:${marketId}:${marketHash}` (hash-based, first 7 chars of SHA256)
  - Fee Rate: `CASHU_FEE_RATE` env var, default 1% (configurable per environment)
- **NUT-03 Swap Logic Specified** — multi-keyset routing algorithm with fee distribution
- **Deterministic Keyset Generation** — BIP-32 path scheme (m/46'/0'/0'/{marketId}')
- **Complete Error Handling** — HTTP status codes (400, 401, 404, 422, 500) with error codes
- **Relay Health Checks** — MarketService waits for `relay.connected === true` before polling
- **Database Migrations** — version tracking, rollback procedures, per-migration state management
- **@cashu/cashu-ts 0.15.0** — pinned version with compatibility matrix for test harness
- **Mock Quote Flow Specified** — exact sequence with 0-sat test path
- **Frontend Integration Examples** — code paths from walletStore.ts → NDK wallet → kind 7375 events
- **Test Harness Mapping** — Python endpoint → TypeScript endpoint correlation table

---

## 2. Context

### 2.1 Cascade Architecture

Cascade's prediction markets are peer-to-peer outcome betting platforms on Nostr. Markets are represented as Nostr `kind 30000` events with market metadata. Each market has:
- **Creator pubkey** — the market author who funds the initial LMSR reserve
- **Market slug** — unique identifier (e.g., `bitcoin-price-2026-q1`)
- **Outcome tokens** — two units (LONG/short) that represent YES/NO positions
- **No resolution** — markets do not resolve; tokens represent perpetual probability estimates

### 2.2 Mint Architecture

The Cascade mint is **market-specific**, not general-purpose:
- **1 keyset per market** — identified by market slug
- **2 units per keyset** — `long` (YES outcome) and `short` (NO outcome)
- **No keyset rotation** — for Phase 1, assume static keysets (migration deferred)
- **Pure bearer tokens** — no escrow accounts, no balances, no accounts. Ownership = cryptographic proof.
- **Nostr relay** = source of truth for market events (kind 30000)
- **Turso SQLite** = edge storage for mint state (proofs, keysets, reserve logs)

### 2.3 Keyset Model (Non-Negotiable)

```
Market: bitcoin-price-2026-q1
├─ Keyset ID: [DECISION PENDING - see 2.4.1]
├─ Unit: long
│  └─ Public Key: 02abc...
│  └─ Amount Unit: sat
├─ Unit: short
│  └─ Public Key: 02def...
│  └─ Amount Unit: sat
├─ Reserve: 100,000,000 (10,000 sats, funded by market creator)
├─ Total LONG shares minted: 0 (initially)
└─ Total SHORT shares minted: 0 (initially)
```

**Key constraints:**
- NO `keyset-cancel` — markets never cancel
- NO `mint-primary` — all tokens are market-specific
- NO `keyset-deprecated` — for Phase 1, assume static keysets
- Single keyset per market, 2 units, persisted to Turso + Nostr (kind 30001)

### 2.4 Phase 1 Scope & Dependencies

**Deliverables:**
1. Hono.js project scaffolding
2. Mint service layer with @cashu/cashu-ts 0.15.0
3. Deterministic keyset derivation (BIP-32 path)
4. Proof storage and validation with double-spend protection
5. Complete NUT-00/02/03 endpoints with error handling
6. Nostr event persistence and relay health checks
7. Database migration system with version tracking
8. Comprehensive unit tests with LMSR test vectors
9. Integration with test harness

**Test harness dependency:** `.tenex/plans/cashu-mint-test-harness.md` defines the validation suite. This implementation must pass all Phase 1 tests (LMSR math validation deferred to Phase 3).

---

## 2.4.1 ✅ DECIDED: Keyset ID Format

**Decision:** **Option 1 (Hash-based)** — Keyset ID = `market_id:${marketId}:${marketHash}`
- Example: `market_id:bitcoin-price-2026-q1:a7f3b2c`
- `marketHash` = first 7 chars of SHA256(marketId)
- Balances uniqueness, readability, and debuggability
- Deterministic, collision-resistant, human-readable

**Implementation (TypeScript):**
```typescript
import crypto from 'crypto';

function generateKeysetId(marketId: string): string {
  const hash = crypto.createHash('sha256').update(marketId).digest('hex');
  const marketHash = hash.slice(0, 7);
  return `market_id:${marketId}:${marketHash}`;
}
```

**Why this approach:**
- Keyset ID is globally unique (market ID + hash prevent collisions)
- Readable in logs (humans can trace back to market ID)
- Deterministic (same market ID always produces same keyset ID)
- Suitable for NIP-87 mint discovery (keyset published in Nostr events)
   - Example: `market_id:bitcoin-price-2026-q1`
   - Pros: Simpler, shorter
   - Cons: Name collisions possible if market slugs clash

3. **Numeric with market hash** — Keyset ID = `${marketHash64}`
   - Example: `a7f3b2c9e8d4f2a1` (64-bit hash)
   - Pros: Compact, opaque
   - Cons: Less readable, harder to debug

**Recommended default:** Option 1 (hash-based) balances uniqueness, debuggability, and determinism.

**Decision impact:** Affects keyset lookup in Turso, kind 30001 event publication, and test harness compatibility.

**Decision Required:** Confirm with human-replica which format to use. Implementation will use the chosen format in:
- `MintService.getKeysetId(marketId: string): string`
- `KeysetService.deriveKeyset(marketId: string): Keyset`
- Database schema keyset lookup by ID

---

## 2.4.2 ✅ DECIDED: Fee Rate

**Decision:** **Option 3 (Configurable, default 1%)** — `CASHU_FEE_RATE` environment variable defaulting to `1`
- Matches deployment strategy document (1% default)
- Flexible for testing and future adjustments
- Easy to override per environment (testnet, staging, production)

**Implementation (TypeScript):**
```typescript
// src/config/index.ts
export const CASHU_FEE_RATE = parseInt(process.env.CASHU_FEE_RATE || '1', 10);

// In NUT-03 swap logic:
const feeAmount = Math.ceil((swapAmount * CASHU_FEE_RATE) / 100);
const outputAmount = swapAmount - feeAmount;
```

**Environment Setup:**
```bash
# .env.local (default for Phase 1)
CASHU_FEE_RATE=1

# .env.staging (for testing)
CASHU_FEE_RATE=1

# .env.production (per business decision)
CASHU_FEE_RATE=1
```

**Why this approach:**
- Strategy doc says 1% is correct (test harness was using 2% as a placeholder)
- Configurable allows A/B testing without code changes
- Matches Cascade's competitive positioning (1% is industry-standard for prediction markets)

**Impact on implementation:**
- All NUT-03 swap operations use this rate
- Proof generation costs factored into fee calculation
- Test harness validates with CASHU_FEE_RATE=1 by default

---

## 3. Architecture Overview

### 3.1 System Diagram

```
┌─────────────────────┐
│  Cascade Frontend   │
│  (Svelte/SvelteKit) │
└────────┬────────────┘
         │ POST /v1/mint/quote
         │ POST /v1/mint/bolts (mock)
         ↓
┌──────────────────────────────┐
│    Cascade Mint (Hono.js)    │
├──────────────────────────────┤
│  MintService                 │
│  ├─ KeysetService            │
│  ├─ ProofService             │
│  └─ SwapService (NUT-03)     │
├──────────────────────────────┤
│  NostrService                │
│  ├─ Relay health check       │
│  └─ MarketService (kind 30k) │
├──────────────────────────────┤
│  Database Layer (Turso)      │
│  ├─ keysets table            │
│  ├─ proofs table             │
│  ├─ quotes table             │
│  └─ migrations table         │
└──────────────────────────────┘
         ↓
    Turso Edge DB
         +
   Nostr Relays (NIP-65)
```

### 3.2 Data Flow: Quote → Mint

**Mock Quote Flow (Testing):**

```
1. User calls POST /v1/mint/quote?amount=0&unit=sat
2. Mint returns:
   {
     quote: "quote-uuid",
     amount: 0,           // 0 sats for test quotes
     unit: "sat",
     paid: true,          // Always true for amount=0
     expiry: Math.floor(Date.now() / 1000) + 300
   }
3. User skips payment (amount is 0)
4. User calls POST /v1/mint/bolts with quote ID
5. Mint generates proofs, returns encrypted token
6. Frontend stores token in Nostr kind 7375 event
```

**Production Quote Flow (with NIP-79 Lightning):**

```
1. User calls POST /v1/mint/quote?amount=1000&unit=sat
2. Mint invokes NIP-79 zapper endpoint:
   - Creates lightning invoice via zapper service
3. Mint returns:
   {
     quote: "quote-uuid",
     amount: 1000,
     unit: "sat",
     request: "lnbc10u1p...",
     paid: false,
     expiry: Math.floor(Date.now() / 1000) + 600
   }
4. User scans invoice, pays via wallet
5. Zapper callback notifies mint: quote paid
6. User calls POST /v1/mint/bolts with quote ID
7. Mint verifies quote.paid, generates proofs
8. Proofs stored in kind 7375
```

### 3.3 Startup Sequence with Relay Health Check

```
1. App initialization in main.ts
2. Initialize Hono app
3. Initialize Turso database
4. Initialize Nostr context (ndk instance)
5. Initialize MarketService
   ↓
6. MarketService.start()
   ├─ Establish relay connections
   ├─ **Wait for relay.connected === true (blocking)**
   ├─ Fetch all kind 30000 markets
   ├─ Subscribe to market updates
   └─ Start 60s polling cycle
7. Initialize MintService
   ├─ Load keysets from Turso
   ├─ Verify deterministic key generation
   └─ Ready for minting
8. HTTP server listens on port 3000
```

**Health check implementation:**

```typescript
// In marketService.ts
async start(): Promise<void> {
  // Connect to relays
  await this.ndk.connect();
  
  // BLOCKING: Wait for at least one relay to be ready
  const maxRetries = 30; // 30s timeout
  let attempts = 0;
  while (!this.ndk.relays.some(r => r.connected)) {
    if (++attempts > maxRetries) {
      throw new Error("No Nostr relays connected after 30s");
    }
    await sleep(1000);
  }
  
  // Now safe to fetch and poll
  await this.fetchMarkets();
  this.startPolling();
}
```

---

## 4. Core Services

### 4.1 MintService

**Responsibilities:**
- Generate deterministic keysets per market
- Manage proofs in Turso database
- Implement quote lifecycle (creation → expiry)
- Enforce double-spend prevention (NUT-07 atomicity)

**Key Methods:**

```typescript
interface MintService {
  // Get or create keyset for market
  getKeyset(marketId: string): Promise<Keyset>;
  
  // Deterministic keyset derivation (BIP-32)
  deriveKeyset(marketId: string): Keyset;
  
  // Generate unique keyset ID
  getKeysetId(marketId: string): string;
  
  // Create mint quote (0-sat for test, normal for production)
  createQuote(amount: number, unit: string): Promise<MintQuote>;
  
  // Fetch quote status
  getQuote(quoteId: string): Promise<MintQuote | null>;
  
  // Mark quote as paid (called by webhook or payment verification)
  markQuotePaid(quoteId: string): Promise<void>;
  
  // Generate proofs from quote (includes fee deduction)
  generateProofs(
    quoteId: string, 
    amount: number, 
    unit: string
  ): Promise<Proof[]>;
}
```

### 4.2 KeysetService

**Responsibilities:**
- Deterministic key generation using BIP-32 paths
- Keyset derivation per market
- Public key publication to Nostr (kind 30001)

**BIP-32 Path Scheme:**

```
Master seed: Cascade Mint Private Key (stored in env)
Keyset path: m/46'/0'/0'/{marketIdHash}'

Example for market "bitcoin-price-2026-q1":
├─ marketIdHash = SHA256("bitcoin-price-2026-q1")[:8] = "a7f3b2c9"
├─ Path: m/46'/0'/0'/2818955209' (uint32 of hash prefix)
├─ Derive LONG unit key: path/0
├─ Derive SHORT unit key: path/1
```

**Key Methods:**

```typescript
interface KeysetService {
  // Deterministic keyset generation from BIP-32 path
  deriveKeyset(marketId: string): {
    keysetId: string;       // market_id:{marketId}:{hash}
    longPublicKey: string;  // 02abc...
    shortPublicKey: string; // 02def...
  };
  
  // Publish keyset to Nostr (kind 30001)
  publishKeyset(keyset: Keyset): Promise<string>; // event ID
  
  // Fetch keyset from Nostr by market ID
  fetchKeysetFromNostr(marketId: string): Promise<Keyset | null>;
  
  // Cache keysets in Turso for fast lookup
  cacheKeyset(keyset: Keyset): Promise<void>;
}
```

### 4.3 ProofService

**Responsibilities:**
- Store proofs in Turso with state tracking
- Validate proof authenticity (BIP-340 signatures)
- Prevent double-spend via atomic transactions

**Double-Spend Race Condition Handling (NUT-07):**

```
Race condition: Two simultaneous swap requests for same proof

Solution (Database-level atomicity):
1. When processing ProofRequest:
   a. BEGIN TRANSACTION
   b. SELECT proof WHERE id = ? FOR UPDATE (locks row)
   c. IF proof.state != 'available' THEN ABORT with 400 error
   d. UPDATE proof SET state = 'spent', updated_at = NOW()
   e. INSERT INTO spent_proofs (proof_id, tx_id) VALUES
   f. COMMIT

2. Test harness validation:
   - Send two identical swap requests concurrently
   - One must succeed (state changed to 'spent')
   - One must fail with 400 error: "proof already spent"
   - No proof duplication in response
```

**Key Methods:**

```typescript
interface ProofService {
  // Store generated proofs
  storeProofs(proofs: Proof[], quoteId: string): Promise<void>;
  
  // Validate proof (signature, amount, keyset)
  validateProof(proof: Proof): Promise<{ valid: boolean; error?: string }>;
  
  // Atomic spend operation (prevents double-spend)
  spendProof(proofId: string): Promise<{ success: boolean; error?: string }>;
  
  // Check if proof is spent
  isProofSpent(proofId: string): Promise<boolean>;
  
  // Get unspent proofs for user session
  getUnspentProofs(sessionId: string): Promise<Proof[]>;
}
```

### 4.4 SwapService (NUT-03)

**Responsibilities:**
- Implement NUT-03 proof swap
- Calculate fees (1% default or configured)
- Route swap across multiple keysets if needed

**Multi-Keyset Fee Routing (NUT-03 Swap Logic):**

```
Input: User has 1000 sats LONG proofs, wants to swap to SHORT

Problem: LONG and SHORT proofs are from different keysets
- LONG keyset has pubkey A
- SHORT keyset has pubkey B
- User cannot directly swap A ↔ B (different signing keys)

Solution: Atomic swap via mint intermediary
1. User sends LONG proofs to mint
2. Mint verifies LONG proofs valid (signed with LONG keyset pubkey)
3. Mint calculates fee = amount * CASHU_FEE_RATE / 100
   - fee = 1000 * 1 / 100 = 10 sats
4. Mint creates SHORT proofs for (1000 - 10) = 990 sats
5. SHORT proofs signed with SHORT keyset pubkey
6. Return SHORT proofs to user

Multi-keyset routing (swap between unrelated markets):
- User has LONG proofs from market A
- User wants SHORT proofs from market B
- Same logic applies per fee policy

Implementation:
```

```typescript
interface SwapService {
  // Swap proofs between units (LONG ↔ SHORT)
  swap(
    inputProofs: Proof[],
    inputUnit: string,
    outputUnit: string
  ): Promise<{
    amount: number;
    fee: number;
    outputProofs: Proof[];
  }>;
  
  // Calculate fee for swap
  calculateSwapFee(amount: number): number;
  
  // Validate swap request (amount, proofs, units)
  validateSwapRequest(req: SwapRequest): Promise<{ valid: boolean; error?: string }>;
}
```

---

## 5. API Implementation

### 5.1 NUT-00: Mint Info

**Endpoint:** `GET /v1/info`

**Response:**

```json
{
  "name": "Cascade Markets Mint",
  "pubkey": "02abc...",
  "version": "0.15.0",
  "description": "Ecash mint for outcome tokens on Nostr prediction markets",
  "nuts": {
    "0": {
      "methods": ["GET"],
      "unit": "sat"
    },
    "2": {
      "methods": ["POST"],
      "unit": "sat"
    },
    "3": {
      "methods": ["POST"],
      "unit": "sat"
    }
  },
  "motd": "Phase 1: 0-sat test mints enabled"
}
```

### 5.2 NUT-02: Mint Request & Quote

**Endpoint:** `POST /v1/mint/quote`

**Query Parameters:**

```
?amount=1000          // Sats (0 for test quote)
&unit=sat             // Always "sat" in Phase 1
```

**Response:**

```json
{
  "quote": "quote-550e8400-e29b-41d4-a716-446655440000",
  "amount": 1000,
  "unit": "sat",
  "request": "lnbc10u1p31pgg5...",
  "paid": false,
  "expiry": 1744214400
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `amount_invalid` | Amount must be positive integer |
| 400 | `unit_unsupported` | Unit must be "sat" |
| 422 | `quote_expired` | Previous quote expired, create new |
| 500 | `internal_error` | Failed to create quote |

**0-Sat Test Quote Flow:**

```
Request: POST /v1/mint/quote?amount=0&unit=sat
Response:
{
  "quote": "test-...",
  "amount": 0,
  "unit": "sat",
  "request": null,     // No invoice
  "paid": true,        // Immediately paid (test)
  "expiry": ...        // 5 min from now
}
```

### 5.3 NUT-02: Mint Bolts

**Endpoint:** `POST /v1/mint/bolts`

**Request:**

```json
{
  "quote": "quote-550e8400-e29b-41d4-a716-446655440000",
  "outputs": [
    {
      "amount": 500,
      "id": "...",
      "B_": "02...",
      "B": "02..."
    }
  ]
}
```

**Response:**

```json
{
  "signatures": [
    {
      "amount": 500,
      "id": "...",
      "C_": "02...",
      "C": "02...",
      "dleq": {...}
    }
  ]
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `quote_invalid` | Quote ID not found |
| 400 | `quote_unpaid` | Quote not paid or expired |
| 400 | `amount_mismatch` | Output amount exceeds quote |
| 422 | `keyset_not_found` | Market keyset unavailable |
| 500 | `proof_generation_failed` | Failed to generate signatures |

### 5.4 NUT-03: Swap

**Endpoint:** `POST /v1/swap`

**Request:**

```json
{
  "inputs": [
    {
      "amount": 500,
      "id": "...",
      "secret": "...",
      "C": "02..."
    }
  ],
  "outputs": [
    {
      "amount": 490,
      "id": "...",
      "B_": "02...",
      "B": "02..."
    }
  ]
}
```

**Response:**

```json
{
  "signatures": [
    {
      "amount": 490,
      "id": "...",
      "C_": "02...",
      "C": "02...",
      "dleq": {...}
    }
  ]
}
```

**Error Responses:**

| Status | Code | Message |
|--------|------|---------|
| 400 | `proof_invalid` | Proof signature invalid |
| 400 | `proof_spent` | Proof already spent (double-spend) |
| 400 | `amount_mismatch` | Output amount exceeds input |
| 401 | `keyset_mismatch` | Proofs from wrong keyset |
| 422 | `swap_unit_invalid` | Cannot swap between incompatible units |
| 500 | `internal_error` | Database transaction failed |

### 5.5 Global Error Handling

All endpoints must return consistent error schema:

```json
{
  "detail": "Descriptive error message",
  "code": "error_code",
  "type": "https://github.com/cashubtc/nuts/blob/main/NUT-00.md"
}
```

**HTTP Status Codes:**

- **400 Bad Request** — Invalid input (amount, format, proof validation)
- **401 Unauthorized** — Keyset mismatch, signature invalid
- **404 Not Found** — Quote/keyset not found
- **422 Unprocessable Entity** — Business logic violation (expired, already spent, unit mismatch)
- **500 Internal Server Error** — Database/service failure

---

## 6. Database Schema & Turso Integration

### 6.1 Schema

```sql
-- Keysets table
CREATE TABLE keysets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL UNIQUE,
  market_hash TEXT NOT NULL,
  long_pubkey TEXT NOT NULL,
  short_pubkey TEXT NOT NULL,
  long_privkey TEXT NOT NULL ENCRYPTED,
  short_privkey TEXT NOT NULL ENCRYPTED,
  reserve_sat INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  nostr_event_id TEXT
);

-- Quotes table
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  amount INTEGER NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sat',
  paid BOOLEAN NOT NULL DEFAULT 0,
  paid_at INTEGER,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  request TEXT,
  keyset_id TEXT NOT NULL REFERENCES keysets(id)
);

-- Proofs table (immutable log)
CREATE TABLE proofs (
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

CREATE INDEX idx_proofs_state ON proofs(state);
CREATE INDEX idx_proofs_keyset ON proofs(keyset_id);
CREATE INDEX idx_proofs_spent ON proofs(spent_at);

-- Spent proofs log (for audit trail)
CREATE TABLE spent_proofs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proof_id TEXT NOT NULL UNIQUE REFERENCES proofs(id),
  swap_txid TEXT,
  spent_at INTEGER NOT NULL,
  spent_by_pubkey TEXT
);

-- Database migrations table (version tracking)
CREATE TABLE migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  executed_at INTEGER NOT NULL,
  rollback_sql TEXT
);
```

### 6.2 Database Migrations System

**Migration Files Location:** `src/migrations/` directory

**File Naming:** `{timestamp}-{description}.sql`

**Example Migration:** `migrations/1744214400000-initial-schema.sql`

```sql
-- migrations/1744214400000-initial-schema.sql
-- UP: Create initial tables
CREATE TABLE keysets (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL UNIQUE,
  ...
);

CREATE TABLE quotes (...);
CREATE TABLE proofs (...);
CREATE TABLE spent_proofs (...);
CREATE TABLE migrations (...);

-- DOWN: Rollback
DROP TABLE IF EXISTS spent_proofs;
DROP TABLE IF EXISTS proofs;
DROP TABLE IF EXISTS quotes;
DROP TABLE IF EXISTS keysets;
DROP TABLE IF EXISTS migrations;
```

**Migration Runner:**

```typescript
// src/database/migrator.ts
export async function runMigrations(db: D1Database): Promise<void> {
  // Create migrations table if not exists
  await db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at INTEGER NOT NULL,
      rollback_sql TEXT
    );
  `);

  // Load migration files from src/migrations/
  const migrationFiles = await glob('src/migrations/*.sql');
  
  for (const file of migrationFiles.sort()) {
    const name = basename(file);
    
    // Check if already executed
    const existing = await db.prepare(
      'SELECT 1 FROM migrations WHERE name = ?'
    ).bind(name).first();
    
    if (existing) continue;
    
    // Read migration file
    const content = await readFile(file, 'utf-8');
    const [upSql, downSql] = content.split('-- DOWN:');
    
    try {
      // Execute UP migration
      await db.exec(upSql);
      
      // Record migration
      await db.prepare(
        'INSERT INTO migrations (name, executed_at, rollback_sql) VALUES (?, ?, ?)'
      ).bind(name, Date.now(), downSql.trim()).run();
      
      console.log(`✓ Executed migration: ${name}`);
    } catch (error) {
      console.error(`✗ Failed migration: ${name}`, error);
      throw error;
    }
  }
}

// Rollback support
export async function rollbackLatest(db: D1Database): Promise<void> {
  const latest = await db.prepare(
    'SELECT name, rollback_sql FROM migrations ORDER BY id DESC LIMIT 1'
  ).first<{ name: string; rollback_sql: string }>();
  
  if (!latest) {
    console.log('No migrations to rollback');
    return;
  }
  
  try {
    await db.exec(latest.rollback_sql);
    await db.prepare('DELETE FROM migrations WHERE name = ?').bind(latest.name).run();
    console.log(`✓ Rolled back: ${latest.name}`);
  } catch (error) {
    console.error(`✗ Rollback failed: ${latest.name}`, error);
    throw error;
  }
}
```

### 6.3 Crash Recovery & Consistency

**Scenario:** Service crashes mid-swap, leaving proofs in inconsistent state.

**Recovery Protocol:**

```
1. On startup, check for incomplete transactions:
   - SELECT * FROM proofs WHERE state = 'reserved' AND created_at < NOW() - 60s
   
2. For each stale reserved proof:
   - If corresponding swap output not in proofs table:
     → Rollback: SET state = 'unspent' (allow retry)
   - If swap output exists:
     → Confirm: SET state = 'spent' (already processed)
   
3. Verify Nostr state matches Turso:
   - Fetch all kind 30001 (keyset) events from relay
   - Compare against Turso keysets table
   - If mismatch: Log alert, prioritize Turso as source of truth
   
4. Sync reserve from Nostr:
   - Kind 30000 market events contain reserve_sat
   - On recovery, reset keyset.reserve_sat from Nostr
   - Prevents double-spending of reserve
```

**Implementation in MintService.ts:**

```typescript
async recover(): Promise<void> {
  const staleReserves = await this.db.prepare(
    'SELECT * FROM proofs WHERE state = ? AND created_at < ?'
  ).bind('reserved', Date.now() - 60000).all();
  
  for (const proof of staleReserves) {
    const spent = await this.db.prepare(
      'SELECT 1 FROM proofs WHERE secret = ? AND state = ?'
    ).bind(proof.secret, 'spent').first();
    
    if (spent) {
      await this.db.prepare('UPDATE proofs SET state = ? WHERE id = ?')
        .bind('spent', proof.id).run();
    } else {
      await this.db.prepare('UPDATE proofs SET state = ? WHERE id = ?')
        .bind('unspent', proof.id).run();
    }
  }
}
```

---

## 7. Nostr Integration

### 7.1 Market Service with Relay Health Check

**Key Methods:**

```typescript
interface MarketService {
  // Start polling with BLOCKING relay health check
  start(): Promise<void>;
  
  // Fetch all markets from Nostr (kind 30000)
  fetchMarkets(): Promise<Market[]>;
  
  // Subscribe to market updates
  subscribeMarkets(): void;
  
  // Check relay connectivity
  isRelayHealthy(): boolean;
}
```

**Implementation (with health check):**

```typescript
// src/nostr/marketService.ts
export class MarketService {
  async start(): Promise<void> {
    // Connect to relays
    console.log('Connecting to Nostr relays...');
    await this.ndk.connect();
    
    // BLOCKING: Wait for relay connectivity
    console.log('Waiting for relay connections...');
    const maxRetries = 30; // 30 seconds timeout
    let connected = false;
    
    for (let i = 0; i < maxRetries; i++) {
      const healthyRelays = Array.from(this.ndk.relays.values())
        .filter(r => r.connected);
      
      if (healthyRelays.length > 0) {
        console.log(`✓ Connected to ${healthyRelays.length} relay(s)`);
        connected = true;
        break;
      }
      
      console.log(`Waiting for relays... (${i + 1}/${maxRetries})`);
      await sleep(1000);
    }
    
    if (!connected) {
      throw new Error(
        'Failed to connect to Nostr relays within 30s. ' +
        'Check NIP-65 relay list in wallet settings.'
      );
    }
    
    // Now safe to fetch and poll
    console.log('Fetching markets from Nostr...');
    await this.fetchMarkets();
    
    console.log('Starting market polling (60s interval)...');
    this.startPolling();
  }
  
  private startPolling(): void {
    this.pollingInterval = setInterval(async () => {
      try {
        const newMarkets = await this.fetchMarkets();
        console.log(`Synced ${newMarkets.length} markets`);
      } catch (error) {
        console.error('Market sync error:', error);
        // Continue polling despite error
      }
    }, 60000); // 60 seconds
  }
  
  async fetchMarkets(): Promise<Market[]> {
    // ... fetch kind 30000 events ...
  }
}
```

### 7.2 Keyset Publication (kind 30001)

**Event Structure:**

```json
{
  "kind": 30001,
  "tags": [
    ["d", "market_id:bitcoin-price-2026-q1:a7f3b2c"],
    ["market", "bitcoin-price-2026-q1"],
    ["long-pubkey", "02abc..."],
    ["short-pubkey", "02def..."],
    ["unit", "sat"],
    ["mint-name", "Cascade Markets Mint"],
    ["mint-pubkey", "02mint..."]
  ],
  "content": "Outcome token keysets for bitcoin-price-2026-q1 market",
  "created_at": 1744214400
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

**Test Files:** `src/__tests__/`

**Coverage:**

1. **KeysetService.test.ts** — BIP-32 derivation
   - Test deterministic key generation for multiple markets
   - Verify keyset ID format consistency
   - Test collision resistance

2. **ProofService.test.ts** — Proof validation & double-spend
   - Valid proof acceptance
   - Invalid signature rejection
   - Double-spend prevention with concurrent requests
   - Atomic transaction isolation

3. **SwapService.test.ts** — NUT-03 swap
   - Fee calculation (1% default)
   - Multi-keyset swap routing
   - Input/output amount validation

4. **MintService.test.ts** — Quote lifecycle
   - Quote creation (0-sat and normal)
   - Quote expiry
   - Payment marking
   - Proof generation

### 8.2 LMSR Test Vectors

**Reference Implementation:** [Cashu LMSR Library](https://github.com/cashubtc/cashu-ts/tree/main/src/index)

**Test Cases (deferred to Phase 3):**
- Reserve adequacy for outcome probabilities
- Proof generation under different price points
- Swap stability (no arbitrage exploitation)

**Phase 1 test vectors (deterministic keyset only):**

```typescript
// Test: Deterministic keyset generation
describe('KeysetService deterministic generation', () => {
  it('should derive same keyset for same market', () => {
    const keyset1 = keysetService.deriveKeyset('bitcoin-price-2026-q1');
    const keyset2 = keysetService.deriveKeyset('bitcoin-price-2026-q1');
    
    expect(keyset1.longPublicKey).toBe(keyset2.longPublicKey);
    expect(keyset1.shortPublicKey).toBe(keyset2.shortPublicKey);
  });
  
  it('should derive different keysets for different markets', () => {
    const keyset1 = keysetService.deriveKeyset('market-a');
    const keyset2 = keysetService.deriveKeyset('market-b');
    
    expect(keyset1.longPublicKey).not.toBe(keyset2.longPublicKey);
    expect(keyset1.shortPublicKey).not.toBe(keyset2.shortPublicKey);
  });
  
  it('should generate correct keyset ID format', () => {
    const keysetId = keysetService.getKeysetId('bitcoin-price-2026-q1');
    expect(keysetId).toMatch(/^market_id:.*:[a-f0-9]{7}$/);
  });
});
```

---

## 9. File Changes

### 9.1 New Files

| File | Purpose |
|------|---------|
| `src/hono/app.ts` | Hono application setup |
| `src/hono/routes/mint.ts` | Mint endpoints (NUT-00/02/03) |
| `src/hono/routes/info.ts` | Info endpoint |
| `src/hono/middleware/errors.ts` | Global error handling |
| `src/services/MintService.ts` | Mint logic |
| `src/services/KeysetService.ts` | BIP-32 keyset derivation |
| `src/services/ProofService.ts` | Proof validation & storage |
| `src/services/SwapService.ts` | NUT-03 swap |
| `src/nostr/marketService.ts` | Market polling & health check |
| `src/nostr/keysetPublisher.ts` | Kind 30001 publication |
| `src/database/migrator.ts` | Migration runner |
| `src/database/schema.ts` | Database types |
| `src/config/index.ts` | Configuration (fee rate, env vars) |
| `src/__tests__/KeysetService.test.ts` | Keyset tests |
| `src/__tests__/ProofService.test.ts` | Proof tests |
| `src/__tests__/SwapService.test.ts` | Swap tests |
| `src/__tests__/MintService.test.ts` | Mint tests |
| `migrations/1744214400000-initial-schema.sql` | Schema migration |
| `wrangler.toml` | Cloudflare Workers config |
| `.env.example` | Environment variables template |

### 9.2 Modified Files

| File | Changes |
|------|---------|
| `package.json` | Add @cashu/cashu-ts@0.15.0, hono, turso-http |
| `tsconfig.json` | Strict mode, appropriate resolveJsonModule |
| `.gitignore` | Add .env, .env.local, dist/ |

---

## 10. Execution Order

1. **Project Setup** — Initialize Hono + TypeScript + build tools
   - Verify: `npm run build` succeeds, no type errors

2. **Configuration** — Create .env template with fee rate, master seed
   - Verify: All required env vars documented in .env.example

3. **Database Schema** — Define Turso schema + migration runner
   - Verify: Migration files execute without errors, rollback works

4. **Services Layer** — Implement MintService, KeysetService, ProofService, SwapService
   - Verify: Unit tests pass for each service

5. **Nostr Integration** — MarketService with relay health checks, keyset publisher
   - Verify: Relay connection retry logic tested, kind 30001 events published

6. **API Endpoints** — Implement NUT-00/02/03 with error handling
   - Verify: Responses match spec, error codes correct

7. **Integration Testing** — Test against mock test harness
   - Verify: All Phase 1 tests pass

8. **Deployment** — Deploy to Vercel at cascade-mint.f7z.io
   - Verify: Health check endpoint responds, Turso connectivity confirmed

---

## 11. Verification

### 11.1 Build & Tests

```bash
# Install dependencies
npm install

# Type check
npx tsc --noEmit

# Unit tests
npm test

# Integration tests (against test harness)
npm run test:integration

# Build
npm run build

# Check bundle size
npm run analyze:bundle
```

### 11.2 Manual Verification

1. **Relay Health Check:**
   - Kill relay connection during startup
   - Verify app waits (doesn't crash)
   - Restart relay, verify app proceeds

2. **Quote Lifecycle:**
   - Create 0-sat test quote
   - Verify immediate `paid: true`
   - Create normal quote
   - Verify invoice returned
   - Mark quote paid, generate proofs

3. **Double-Spend Prevention:**
   - Send two identical swap requests concurrently
   - One succeeds, one fails with `proof_spent` error
   - Verify proof state atomically updated

4. **Migration Rollback:**
   - Run migrations
   - Execute `npm run db:rollback`
   - Verify tables dropped correctly
   - Re-run migrations, all pass

5. **Deterministic Keysets:**
   - Generate keyset for market X twice
   - Verify same public keys returned
   - Generate keyset for market Y
   - Verify different public keys

---

## 12. Dependencies

**Core:**
- `@cashu/cashu-ts@0.15.0` — Cashu protocol implementation
- `hono@4.x` — Web framework
- `typescript@5.x` — Type checking
- `@nostr-dev-kit/ndk@1.10.0` — Nostr relay client

**Database:**
- `turso-http@0.5.x` — Turso SQLite HTTP client
- `better-sqlite3@9.x` — Local SQLite (testing only)

**Crypto:**
- `noble/secp256k1@1.7.1` — ECDSA signatures
- `@scure/bip32@1.3.x` — BIP-32 key derivation

**Testing:**
- `vitest@1.x` — Test runner
- `@testing-library/node@^20` — Node testing utilities

**Version Compatibility Matrix (Test Harness):**

| Component | Version | Python Endpoint | TypeScript Endpoint |
|-----------|---------|-----------------|---------------------|
| @cashu/cashu-ts | 0.15.0 | POST /v1/mint/quote | POST /v1/mint/quote |
| cashu-ts | 0.15.0 | POST /v1/mint/bolts | POST /v1/mint/bolts |
| cashu-ts | 0.15.0 | POST /v1/swap | POST /v1/swap |
| cashu-ts | 0.15.0 | GET /v1/info | GET /v1/info |
| cashu-ts | 0.15.0 | Double-spend test | Race condition test |

---

## 13. Architecture Decisions (Why This Way)

### 13.1 Why Deterministic BIP-32 Keysets?

**Alternative:** Random key generation per market

**Chosen:** Deterministic BIP-32 derivation (m/46'/0'/0'/{marketIdHash}')

**Reasoning:**
- **Disaster recovery:** Mint can rebuild keysets from master seed even if database destroyed
- **Auditing:** External parties can verify keyset derivation is correct
- **Scaling:** No need to store private keys for millions of markets; derive on-demand

### 13.2 Why Turso for Proof Storage?

**Alternative:** Nostr-only (publish all proofs to relays)

**Chosen:** Turso SQLite with Nostr sync

**Reasoning:**
- **Performance:** Proof lookup is O(1) in indexed database (vs relay query cost)
- **Privacy:** Proof state not public on Nostr (no on-chain money flow)
- **Consistency:** Atomic transactions prevent double-spend race conditions

### 13.3 Why 0-Sat Test Quotes?

**Alternative:** Mock payment webhook for testing

**Chosen:** 0-sat quotes with immediate `paid: true`

**Reasoning:**
- **Simplicity:** No webhook infrastructure needed
- **Isolation:** Tests don't depend on external services
- **Clear intent:** 0-sat clearly indicates test mode

---

## 14. Known Limitations & Deferred Work

### Phase 1 Scope (Foundation)

**NOT Included:**
- Lightning network integration (NIP-79) — deferred to Phase 2
- LMSR pricing & reserve adequacy — deferred to Phase 3
- Keyset rotation & migration — deferred to Phase 4
- P2PK proofs for nutzaps — deferred to Phase 2
- Rate limiting & DOS protection — basic only
- Proof expiry & garbage collection — deferred
- Multi-network support (testnet/mainnet) — testnet only

**Basic Error Handling Only:**
- No circuit breakers for relay failures
- No retry logic for transient errors (manual retry required)
- Database timeout handling is basic

**Known Issues:**
- Relay disconnection mid-polling not gracefully handled (will error on next fetch)
- No monitoring/alerting infrastructure
- Crash recovery defers to manual intervention if edge cases found

---

## 15. Success Criteria for Phase 1

✅ **Execution Success:**
- [ ] All unit tests pass (KeysetService, ProofService, SwapService, MintService)
- [ ] Integration tests pass against test harness
- [ ] Type check: zero TypeScript errors
- [ ] Deployment: app live at cascade-mint.f7z.io with health check passing
- [ ] Relay health check: startup blocks until connected
- [ ] Database migrations: version tracking working, rollback functional

✅ **Functional Success:**
- [ ] POST /v1/info returns correct NUT-00 info
- [ ] POST /v1/mint/quote creates quote with correct amount, expiry, request format
- [ ] POST /v1/mint/bolts generates deterministic proofs matching keyset
- [ ] POST /v1/swap prevents double-spend with concurrent requests
- [ ] Double-spend race condition: one succeeds, one fails atomically
- [ ] Deterministic keysets: same market → same pubkeys, different markets → different pubkeys

✅ **Operational Success:**
- [ ] 0-sat test quotes work end-to-end
- [ ] Crash recovery restores consistent state
- [ ] Nostr keyset events (kind 30001) published correctly
- [ ] MarketService polls every 60s without relay disconnection

---

## 16. Integration with Cascade Frontend

### 16.1 Frontend Quote Flow

**Frontend code path:** `src/lib/stores/walletStore.ts` → Mint service → Kind 7375 storage

```typescript
// src/lib/stores/walletStore.ts
export const mintFromCascade = async (
  marketId: string, 
  amount: number
): Promise<string[]> => {
  // Step 1: Create quote at mint
  const quoteResp = await fetch(
    `https://cascade-mint.f7z.io/v1/mint/quote?amount=${amount}&unit=sat`
  );
  const { quote, request, paid } = await quoteResp.json();
  
  // Step 2: User pays invoice (if not paid already)
  if (!paid) {
    // User scans invoice, pays via wallet
    // Wait for quote.paid_at callback
  }
  
  // Step 3: Generate proofs at mint
  const boltsResp = await fetch(
    'https://cascade-mint.f7z.io/v1/mint/bolts',
    {
      method: 'POST',
      body: JSON.stringify({
        quote,
        outputs: generateBlindedMessages(amount)
      })
    }
  );
  const { signatures } = await boltsResp.json();
  
  // Step 4: Construct and store token
  const proofs = constructProofs(signatures);
  const token = encodeToken(proofs);
  
  // Step 5: Publish to Nostr (kind 7375)
  const ndk = getContext('ndk');
  const event = new NDKEvent(ndk, {
    kind: 7375,
    content: nip44encrypt(token, userPrivkey)
  });
  await event.publish();
  
  return proofs;
};
```

### 16.2 Swap Flow (Frontend)

```typescript
// Frontend: User swaps LONG ↔ SHORT
export const swapProofs = async (
  inputProofs: Proof[],
  fromUnit: 'long' | 'short',
  toUnit: 'long' | 'short'
): Promise<Proof[]> => {
  const swapResp = await fetch(
    'https://cascade-mint.f7z.io/v1/swap',
    {
      method: 'POST',
      body: JSON.stringify({
        inputs: inputProofs,
        outputs: generateBlindedMessages(totalAmount - fee)
      })
    }
  );
  
  const { signatures } = await swapResp.json();
  const outputProofs = constructProofs(signatures);
  
  // Update kind 7375 with new proofs
  await publishTokenToNostr(outputProofs);
  
  return outputProofs;
};
```

---

## 17. Test Harness Integration

### 17.1 Endpoint Mapping

**Test harness sends requests to mint endpoints. This table maps Python test → TypeScript implementation:**

| Python Test | Python Endpoint | TypeScript Endpoint | Validation |
|-------------|-----------------|---------------------|------------|
| test_info | GET /v1/info | GET /v1/info | Response contains name, pubkey, nuts |
| test_mint_quote | POST /v1/mint/quote | POST /v1/mint/quote | Quote ID, amount, expiry returned |
| test_mint_bolts | POST /v1/mint/bolts | POST /v1/mint/bolts | Signatures returned, count matches outputs |
| test_swap | POST /v1/swap | POST /v1/swap | Output proofs, fee deducted |
| test_double_spend | POST /v1/swap (concurrent) | POST /v1/swap (concurrent) | One succeeds, one fails with 400 |
| test_invalid_proof | POST /v1/swap | POST /v1/swap | Returns 400 proof_invalid |
| test_quote_expired | POST /v1/mint/bolts | POST /v1/mint/bolts | Returns 400 quote_expired |

### 17.2 Test Harness Validation Spec

```python
# test_harness.py validation assertions

def test_mint_implementation():
    # Test 1: Info endpoint
    resp = requests.get('http://localhost:3000/v1/info')
    assert resp.status_code == 200
    data = resp.json()
    assert data['name'] == 'Cascade Markets Mint'
    assert 'pubkey' in data
    assert 'nuts' in data
    
    # Test 2: Quote creation
    resp = requests.post(
        'http://localhost:3000/v1/mint/quote?amount=0&unit=sat'
    )
    assert resp.status_code == 200
    quote = resp.json()
    assert quote['amount'] == 0
    assert quote['paid'] == True  # 0-sat test quote
    
    # Test 3: Bolts generation
    resp = requests.post(
        'http://localhost:3000/v1/mint/bolts',
        json={
            'quote': quote['quote'],
            'outputs': [...]
        }
    )
    assert resp.status_code == 200
    assert 'signatures' in resp.json()
    
    # Test 4: Swap
    resp = requests.post(
        'http://localhost:3000/v1/swap',
        json={
            'inputs': proofs,
            'outputs': [...]
        }
    )
    assert resp.status_code == 200
    assert 'signatures' in resp.json()
    
    # Test 5: Double-spend (concurrent)
    responses = concurrent_requests(
        'POST /v1/swap',
        json=same_proof_twice,
        num_requests=2
    )
    assert sum(r.status_code == 200 for r in responses) == 1
    assert sum(r.status_code == 400 for r in responses) == 1
    assert responses[1].json()['code'] == 'proof_spent'
```

---

## 18. Future Phases (Reference)

### Phase 2: Lightning Integration
- NIP-79 zapper integration for real payments
- Invoice generation & payment webhook
- P2PK proofs for nutzap support
- Multi-keyset swaps across markets

### Phase 3: LMSR Pricing
- Algorithmic reserve adequacy
- Outcome probability calculations
- Swap impact on pricing
- Reserve rebalancing

### Phase 4: Hardening & Operations
- Keyset rotation & migration
- Proof expiry & garbage collection
- Rate limiting & DOS protection
- Monitoring & alerting
- Multi-network support (mainnet)

---

## 19. References

- **Cashu NUT Specs:** https://github.com/cashubtc/nuts
- **@cashu/cashu-ts:** https://github.com/cashubtc/cashu-ts (v0.15.0)
- **NIP-60 (Wallets):** https://github.com/nostr-protocol/nips/blob/master/60.md
- **NIP-87 (Mint Discovery):** https://github.com/nostr-protocol/nips/blob/master/87.md
- **BIP-32 (Key Derivation):** https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki
- **Turso Documentation:** https://docs.turso.tech/
- **Hono Documentation:** https://hono.dev/
- **Vercel Edge Functions:** https://vercel.com/docs/edge-functions
