# Cascade Cashu Phase 2 Implementation Plan

**Status:** Ready for Implementation  
**Approach:** Modular phased integration of CDK Rust mint with existing LMSR platform  
**Key Decisions:** All confirmed in `/tenex/docs/cascade-mint-product-spec.md` (Section 0)

---

## Context

The Cascade prediction market platform has a working LMSR implementation (`src/market.ts`) and NDK Cashu wallet integration (`src/walletStore.ts`), but currently operates in **demo mode** — trades are recorded but not settled through a real Cashu mint.

**Current State:**
- LMSR math fully implemented: `priceLong()`, `priceShort()`, `costFunction()`, `solveBuyTokens()`, `solveRedeemValue()`
- NDKCashuWallet hardcoded to `https://mint.minibits.cash/Bitcoin` (generic mint, no LMSR awareness)
- `executeTrade()` in `tradingService.ts` is simulated — debits wallet but doesn't spend proofs or get outcome tokens
- Market state stored as kind 982 Nostr events with concurrency checking via `stateHash` + `version`
- Positions stored as kind 30078 events (one per position, serialized)

**The Challenge:**
Integrate a **custom Cashu mint** (CDK Rust) that:
1. Understands LMSR pricing and outcome tokens (not a generic Cashu mint)
2. Manages two keysets per market (one per outcome: LONG/SHORT)
3. Collects 1% fees (rake stays in mint as operational liquidity)
4. Publishes market state updates to Nostr (mint is state authority)
5. Validates proof spending and issues outcome-specific tokens

**Why This Architecture:**
- **Mint as state authority** (Option A from spec, Section 4.3): Mint computes state transitions, eliminating concurrency races. Nostr becomes the audit log, not the source of truth.
- **Pure bearer tokens**: Users hold ecash directly; no per-user escrow accounts in mint DB. Simpler, more portable.
- **Two keysets per market**: Ensures outcome tokens are distinguishable (different pubkeys per outcome). Users can send LONG tokens separately from SHORT tokens.

---

## Approach

This plan is **modular and sequenced** — each phase depends on the previous one. Phases 1–2 happen on the mint-engineer's side; Phases 3–7 are frontend/integration work.

### Phase Dependencies

```
Phase 1: Mint Infrastructure (mint-engineer)
   ↓
Phase 2: Mint Endpoints (mint-engineer)
   ↓
Phase 3: Frontend Mint Discovery & Configuration (frontend)
   ↓
Phase 4: Wallet Integration — Keyset Caching (frontend)
   ↓
Phase 5: Deposit Flow — Invoice → Tokens (frontend + mint)
   ↓
Phase 6: Trading Integration — Proof Spending + LMSR (frontend + mint)
   ↓
Phase 7: Settlement & Withdrawal (frontend + mint)
   ↓
Phase 8: State Synchronization & Concurrency (both)
   ↓
Phase 9: Testing Strategy
```

### Alternatives Considered & Rejected

1. **Nutshell fork** — Would require deep changes to support LMSR pricing and outcome keysets. Better to use CDK Rust which is designed for extensibility.
2. **cashu-ts (TypeScript)** — Possible, but Rust gives better performance for proof validation and DLEQ signing. Sticks with the mint-engineer's expertise.
3. **Global single keyset** — Proposed maintaining one keyset for all markets. Rejected because: (a) outcome tokens become indistinguishable, (b) harder to track which tokens are for which outcome, (c) defeats the purpose of atomic outcome settlement.
4. **Mint publishes state, keeps separate source of truth** — Considered having both mint DB and Nostr as independent sources. Rejected because it creates race conditions and audit complexity. Mint is authoritative; Nostr is the read replica.

---

## File Changes Summary

### Phase 1: Mint Infrastructure (mint-engineer only)

**Mint Repository Structure** (new, created by mint-engineer):

```
cascade-mint/
├── Cargo.toml                    (CDK Rust + dependencies)
├── src/
│   ├── main.rs                   (HTTP server, axum or actix)
│   ├── config.rs                 (Lightning node config, Nostr relays)
│   ├── keyset.rs                 (Keyset management per market)
│   ├── lmsr.rs                   (LMSR math — ported from frontend)
│   ├── trade.rs                  (POST /v1/cascade/trade logic)
│   ├── redeem.rs                 (POST /v1/cascade/redeem logic)
│   ├── settle.rs                 (POST /v1/cascade/settle logic)
│   ├── reserve.rs                (Reserve accounting, fee collection)
│   ├── nostr.rs                  (Event publishing, relay integration)
│   ├── proof.rs                  (Cashu proof validation, spending)
│   ├── state.rs                  (Market state cache + version tracking)
│   └── lightning.rs              (Lightning integration via LDK or lnd-rest)
├── tests/
│   ├── integration_tests.rs       (Trade flows, settlement)
│   └── lmsr_parity.rs            (Math parity with frontend)
└── docker-compose.yml            (regtest Bitcoin, Lightning, Nostr relay for local dev)
```

### Phase 2–7: Frontend Changes

**Modified Files:**

- `src/walletStore.ts` — Mint URL configuration, keyset fetching, multi-mint support
- `src/services/tradingService.ts` — Call custom `/v1/cascade/trade` endpoint instead of simulated execution
- `src/services/marketService.ts` — Handle mint-published state updates (stateHash validation)
- `src/services/positionService.ts` — Include mint position proofs in kind 30078 events
- `src/services/nostrService.ts` — Subscribe to mint-published market state (kind 982)
- `src/components/MarketDetail.tsx` — Display fee deduction, quote status, error handling

**New Files:**

- `src/services/mintDiscoveryService.ts` — Detect and load custom mint `/v1/info` endpoint
- `src/services/keysetService.ts` — Fetch, cache, and validate keysets from mint
- `src/services/depositService.ts` — Handle deposit flow (invoice → tokens)
- `src/services/quoteService.ts` — Subscribe to real-time quote status via NUT-17 WebSocket
- `src/lib/cashuProofs.ts` — Proof serialization/validation helpers

---

## Phase 1: Mint Infrastructure Setup

### Overview

Set up the CDK Rust mint with:
- HTTP API endpoints (standard NUT-00 through NUT-17, plus custom Cascade endpoints)
- Keyset management (two keysets per active market)
- Lightning backend integration
- Nostr integration (publish market updates)
- Reserve accounting and fee collection

### Files & Services

**New Mint Implementation** (mint-engineer responsibility):

| File | What | Why |
|------|------|-----|
| `config.rs` | Lightning node config (testnet vs mainnet), Nostr relays, mint operator privkey | Env-based setup (secrets in .env, not in git) |
| `keyset.rs` | Create/rotate keysets per market, track active keysets, publish to Nostr | Each market gets two keysets (one per outcome) |
| `lmsr.rs` | Port `priceLong`, `priceShort`, `costFunction`, `solveBuyTokens`, `solveRedeemValue` from frontend | Ensure identical math on mint side |
| `trade.rs` | Implement `POST /v1/cascade/trade` logic | Core integration point |
| `redeem.rs` | Implement `POST /v1/cascade/redeem` logic | Mid-market selling |
| `settle.rs` | Implement `POST /v1/cascade/settle` logic | Post-resolution payouts |
| `reserve.rs` | Track reserve per market, fee collection, LMSR solvency verification | Ensure no fractional reserve |
| `proof.rs` | Validate and spend Cashu proofs using CDK | Proof verification against keyset |
| `nostr.rs` | Publish kind 982 market state events, fetch kind 30000 market definitions | Two-way Nostr sync |
| `state.rs` | In-memory market state cache, version tracking, stateHash validation | Concurrency safety |
| `lightning.rs` | Interface to Lightning node (deposit invoices, withdrawal payments) | On-ramp/off-ramp for real sats |

### API Contracts

#### NUT-Compliant Endpoints (Standard Cashu)

All standard NUT-00 through NUT-17 endpoints. Key ones for Cascade:

**`GET /v1/info`**
```typescript
{
  name: "Cascade Markets",
  pubkey: string,                    // Mint's Nostr pubkey
  version: "0.15.0",
  description: "LMSR prediction market mint",
  contact: [{method: "nostr", info: "cascade mint npub"}],
  nuts: {
    "1": {},    // Mint public keys
    "2": {},    // Keysets (dynamic per market)
    "3": {},    // Swap
    "4": { methods: [{ method: "bolt11", unit: "sat", min_amount: 1 }] },  // Mint (Lightning)
    "5": { methods: [{ method: "bolt11", unit: "sat" }] },  // Melt (Lightning)
    "6": {},    // Mint info
    "7": {},    // Check state
    "12": {},   // DLEQ proofs
    "17": {}    // WebSocket subscriptions
  }
}
```

**`GET /v1/keysets`**
```typescript
[
  {
    id: string,                    // Keyset ID
    unit: "sat",
    active: boolean,
    keys: Record<string, string>   // Denomination → pubkey mappings
  }
]
```

#### Custom Cascade Endpoints

**`POST /v1/cascade/trade`**

*Request:*
```typescript
{
  market_id: string,               // Market event ID (from kind 982)
  side: "LONG" | "SHORT",          // Outcome being purchased
  inputs: Proof[],                 // Cashu proofs being spent
  outputs: BlindedMessage[]        // Blinded outputs for change
}
```

*Response (Success):*
```typescript
{
  trade: {
    market_id: string,
    side: "LONG" | "SHORT",
    sats_spent: number,            // After 1% fee deduction
    fee: number,                   // 1% of input amount
    shares_received: number,       // LMSR-calculated shares
    entry_price: number,           // Price at time of purchase (0–1)
    end_price: number              // Market price after trade
  },
  change: BlindSignature[],        // Signed ecash for change (if overpaid)
  position_proof: string           // Signed receipt for future redemption (see Phase 7)
}
```

*Response (Error):*
```typescript
{
  error: string,
  code: "insufficient_sats" | "invalid_proof" | "market_not_found" | "market_resolved" | "concurrent_trade"
}
```

**Error Cases:**
- `insufficient_sats` — Proofs don't cover the 1% fee or market pricing
- `invalid_proof` — Proof doesn't match any keyset, already spent, or signature fails
- `market_not_found` — Market ID doesn't exist on Nostr
- `market_resolved` — Market has been resolved; no new trades allowed
- `concurrent_trade` — Detected stateHash mismatch (another client modified state first)

**`POST /v1/cascade/redeem`** (Mid-market selling)

*Request:*
```typescript
{
  market_id: string,
  side: "LONG" | "SHORT",
  shares: number,                  // How many shares to sell
  position_proof: string,          // From original trade response
  outputs: BlindedMessage[]        // Blinded outputs to receive payout as ecash
}
```

*Response (Success):*
```typescript
{
  redemption: {
    gross_payout: number,          // LMSR-calculated (before fee)
    fee: number,                   // 1% of payout
    net_payout: number             // What user actually receives
    end_price: number              // Market price after redemption
  },
  signatures: BlindSignature[]     // Signed ecash for net_payout amount
}
```

**`POST /v1/cascade/settle`** (Post-resolution claiming)

*Request:*
```typescript
{
  market_id: string,
  position_proof: string,          // Position proof from original trade
  outputs: BlindedMessage[]        // Blinded outputs for settlement payout
}
```

*Response (Success):*
```typescript
{
  settlement: {
    market_id: string,
    resolution_outcome: "YES" | "NO",  // What the market resolved to
    user_side: "LONG" | "SHORT",
    shares_held: number,
    outcome_price: number,         // 1.0 if user won, 0.0 if lost
    gross_payout: number,          // shares_held * outcome_price
    fee: number,                   // 1% (if non-zero payout)
    net_payout: number
  },
  signatures: BlindSignature[]
}
```

**`GET /v1/cascade/quotes/:quote_id`** (NUT-17 WebSocket status)

Stream real-time quote status (invoice payment progress, melt payment progress). Uses standard Cashu format.

### Integration Points

- **Lightning node**: For `/v1/mint` (NUT-04) and `/v1/melt` (NUT-05). Mint requests invoice for deposit, pays invoice for withdrawal.
- **Nostr relays**: Publish kind 982 market state events, fetch kind 30000 market definitions (if used), subscribe to market updates.
- **Frontend**: Calls custom endpoints during trade, redeem, settle.

### Acceptance Criteria

1. ✅ Mint builds with `cargo build` and runs locally
2. ✅ `GET /v1/info` responds with correct NUTs and metadata
3. ✅ `GET /v1/keysets` returns active keysets for markets
4. ✅ Lightning integration: `POST /v1/mint` requests invoice from node, `POST /v1/melt` pays invoice
5. ✅ LMSR math parity: `solveBuyTokens` produces identical results as frontend (test with known market states)
6. ✅ `POST /v1/cascade/trade` spends proofs, applies 1% fee, calculates shares correctly
7. ✅ Market state updates publish to Nostr (kind 982) after every trade
8. ✅ Concurrent trade detection: stateHash validation rejects double-spends
9. ✅ Reserve audit: Total reserve = LMSR cost function value at all times
10. ✅ Fee collection: Treasury account accumulates 1% from all trades

### Dependencies

- **Bitcoin regtest node** (local or Docker)
- **Lightning testnet node** (regtest or testnet, via LDK, lnd, or similar)
- **Nostr relay** (for testing; can use public relay like nos.lol in production)
- **CDK Rust library** (latest version from cdk-rs GitHub)
- **serde, tokio, axum** (HTTP server framework)

---

## Phase 2: Mint Endpoints Integration

### Overview

Ensure mint can:
1. Accept market state definitions from Nostr (kind 30000)
2. Create keysets on-demand when a new market is created
3. Publish state updates back to Nostr
4. Handle concurrency conflicts gracefully

### Files & Services

**Mint-side changes:**

| File | What | Why |
|------|------|-----|
| `state.rs` (extend) | Fetch initial market state from Nostr (kind 30000), watch for updates, recompute reserve | Single source of truth (Nostr for definitions, mint for state) |
| `nostr.rs` (extend) | Publish kind 982 events after trade/redeem/settle, include stateHash + version | Audit log + concurrency token |
| `keyset.rs` (extend) | Create keysets on first trade for a market, rotate on demand | Lazy initialization |

**Key Design: Mint State Tracking**

The mint maintains an **in-memory cache** of market state:

```rust
struct MarketState {
  event_id: String,              // Nostr kind 982 event ID
  version: u64,                  // Incremented after each trade
  state_hash: String,            // SHA256(qLong, qShort, reserve, version)
  q_long: u64,
  q_short: u64,
  reserve: u64,                  // LMSR cost function value
  treasury: u64,                 // Accumulated 1% fees
  last_updated: u64,             // Unix timestamp
}
```

After every trade:
1. Mint computes new `qLong`, `qShort`, `reserve`
2. Increments `version`
3. Computes new `stateHash`
4. Publishes as kind 982 event to Nostr
5. Frontend fetches update via subscription

### Acceptance Criteria

1. ✅ Mint fetches market definitions from Nostr (kind 30000)
2. ✅ Mint publishes state updates as kind 982 events
3. ✅ stateHash validation prevents concurrent double-spends
4. ✅ Keysets created on first trade for a market
5. ✅ Multiple concurrent trades on same market serialize correctly (version prevents race)

### Dependencies

- Phase 1 complete

---

## Phase 3: Frontend Mint Discovery & Configuration

### Overview

The frontend needs to:
1. Discover which mint to use (currently hardcoded to minibits.cash)
2. Support custom mint URLs (from market definition tag, env var, or user override)
3. Configure wallet to use the correct mint

### Files & Services

**New: `src/services/mintDiscoveryService.ts`**

```typescript
export type MintInfo = {
  url: string
  pubkey: string                   // Mint's Nostr pubkey
  name: string
  supportsCascade: boolean         // Has /v1/cascade/* endpoints
}

// Discover mint from market definition
export async function discoverMintForMarket(market: Market): Promise<MintInfo | null>

// Get/cache mint info
export async function getMintInfo(mintUrl: string): Promise<MintInfo | null>

// Validate mint supports Cascade
export function isCascadeMint(info: MintInfo): boolean
```

**Logic:**

1. Market object (kind 982) includes `mint` tag: `["mint", "https://mint.example.com"]`
2. Frontend calls `/v1/info` on that mint
3. Check for `cascade` in custom nuts (or check for `POST /v1/cascade/trade` availability)
4. Cache info for session

**Fallback:** If market doesn't specify mint, use `VITE_CASCADE_MINT_URL` env var (set in `.env` for local dev, deployed via CI for production).

### Modified: `src/walletStore.ts`

```typescript
// OLD:
const DEFAULT_MINT = 'https://mint.minibits.cash/Bitcoin'

// NEW:
let currentMintUrl: string = import.meta.env.VITE_CASCADE_MINT_URL || 'https://mint.example.com'

export function setMintUrl(url: string): void {
  currentMintUrl = url
  // Reinitialize wallet with new mint
  walletInstance = null
  ndkInstance = null
}

export function getCurrentMintUrl(): string {
  return currentMintUrl
}

// When creating wallet:
walletInstance = await NDKCashuWallet.create(ndk, [currentMintUrl], WALLET_RELAYS)
```

### Modified: `src/components/MarketDetail.tsx`

Display current mint:

```tsx
<div className="text-xs text-neutral-500 mb-4">
  Mint: {mintInfo?.name || "Loading..."} 
  {!mintInfo?.supportsCascade && (
    <span className="text-rose-500 ml-2">⚠ Does not support Cascade trades</span>
  )}
</div>
```

### Acceptance Criteria

1. ✅ Frontend detects custom mint from market `mint` tag
2. ✅ `/v1/info` call succeeds (mint responds with 200)
3. ✅ Frontend identifies `supportsCascade: true` from mint info
4. ✅ Wallet initializes with correct mint URL
5. ✅ Graceful fallback if mint is unavailable (show error, disable trading)

### Dependencies

- Phase 1–2 complete (mint must be running and responding)

---

## Phase 4: Wallet Integration — Keyset Caching

### Overview

The Cashu wallet needs **keysets** to:
1. Validate proof signatures when receiving tokens
2. Encrypt outputs when creating new proofs

The frontend needs to:
1. Fetch keysets from the custom mint
2. Cache them (so validation doesn't require network every time)
3. Watch for keyset rotation (keysets can expire or be rotated by mint)

### Files & Services

**New: `src/services/keysetService.ts`**

```typescript
export type CachedKeyset = {
  id: string
  unit: "sat"
  keys: Record<string, string>    // denom → pubkey
  fetchedAt: number               // Timestamp (for TTL)
  active: boolean
}

// Fetch keysets from mint
export async function fetchKeysetsFromMint(mintUrl: string): Promise<CachedKeyset[]>

// Get cached keyset by ID (with TTL check, re-fetch if stale)
export async function getKeyset(keysetId: string, ttlMinutes: number = 60): Promise<CachedKeyset | null>

// Subscribe to keyset updates (watch for rotation)
export function subscribeToKeysetUpdates(
  mintUrl: string,
  callback: (keysets: CachedKeyset[]) => void
): () => void
```

**Storage:** Use `localStorage` with key `cascade:keysets:<mint_url>`:

```json
{
  "fetchedAt": 1701234567,
  "keysets": [
    {
      "id": "abc123",
      "unit": "sat",
      "keys": {"1": "03...", "2": "02...", ...},
      "active": true
    }
  ]
}
```

**Polling:** Every 5 minutes, check if keysets have changed (new rotation, expiry). If stale, re-fetch.

### Modified: `src/walletStore.ts`

Integrate keyset caching:

```typescript
export async function loadOrCreateWallet(): Promise<NDKCashuWallet | null> {
  // ... existing code ...
  
  // AFTER wallet creation, pre-populate keysets
  const keysets = await keysetService.fetchKeysetsFromMint(currentMintUrl)
  for (const keyset of keysets) {
    wallet.addKeyset(keyset.id, keyset.keys)  // Add to wallet's internal keyset cache
  }
  
  // Subscribe to updates
  keysetService.subscribeToKeysetUpdates(currentMintUrl, (updated) => {
    for (const keyset of updated) {
      wallet.addKeyset(keyset.id, keyset.keys)
    }
  })
  
  return walletInstance
}
```

### Acceptance Criteria

1. ✅ `fetchKeysetsFromMint()` retrieves keysets from mint `/v1/keysets`
2. ✅ Keysets cached in localStorage with TTL
3. ✅ Wallet initializes with cached keysets before any trade
4. ✅ Keyset rotation detected (polling detects new keysets)
5. ✅ Old keysets still valid (no sudden rejection of proofs during transition)

### Dependencies

- Phase 3 complete (mint discovery working)

---

## Phase 5: Deposit Flow — Invoice → Tokens

### Overview

User flow:
1. User opens WalletPage, clicks "Deposit"
2. Specifies amount in sats
3. System generates Lightning invoice via mint's `/v1/mint` (NUT-04)
4. User pays invoice (in their Lightning wallet)
5. Mint detects payment, mints ecash tokens
6. Frontend polls for completion, displays updated balance

### Files & Services

**New: `src/services/depositService.ts`**

```typescript
export type DepositQuote = {
  quote_id: string
  state: "UNPAID" | "PAID"        // Per NUT-04
  request: string                 // Lightning invoice (bolt11)
  amount: number                  // Sats to pay
  expiry: number                  // Unix timestamp
}

// Request a deposit quote
export async function requestDepositQuote(
  amount: number,
  mintUrl: string
): Promise<DepositQuote | null>

// Poll for quote status
export async function checkDepositStatus(
  quoteId: string,
  mintUrl: string
): Promise<"UNPAID" | "PAID" | "EXPIRED">

// Subscribe to quote status changes (NUT-17 WebSocket)
export function subscribeToDepositQuote(
  quoteId: string,
  mintUrl: string,
  callback: (status: "UNPAID" | "PAID" | "EXPIRED") => void
): () => void
```

**Logic:**

1. Frontend calls `POST /v1/mint` on mint (NUT-04 endpoint)
   ```typescript
   { amount: 1000, unit: "sat" }
   ```
2. Mint returns quote:
   ```typescript
   {
     quote_id: "abc123",
     state: "UNPAID",
     request: "lnbc10...",          // bolt11 invoice
     expiry: 1701234567
   }
   ```
3. Frontend displays invoice (as QR code or raw bolt11)
4. User scans in their Lightning wallet, pays
5. Frontend subscribes via NUT-17 WebSocket or polls `GET /v1/mint/<quote_id>` every 2 seconds
6. When status changes to "PAID", mint has issued ecash
7. Frontend calls `wallet.sync()` to fetch tokens from mint's database
8. Balance updates

**Error Handling:**
- Invoice expires → offer to create new one
- Payment fails → user can retry with same or new invoice
- Network timeout → graceful retry with exponential backoff

### Modified: `src/components/WalletPage.tsx`

Add deposit UI:

```tsx
export function WalletPage() {
  const [depositAmount, setDepositAmount] = useState<number>(100)
  const [quote, setQuote] = useState<DepositQuote | null>(null)
  const [status, setStatus] = useState<"UNPAID" | "PAID" | "EXPIRED" | null>(null)
  const [balance, setBalance] = useState<number>(0)

  async function handleDeposit() {
    const q = await depositService.requestDepositQuote(depositAmount, currentMintUrl)
    setQuote(q)
    
    // Subscribe to status
    const unsubscribe = depositService.subscribeToDepositQuote(
      q!.quote_id,
      currentMintUrl,
      async (s) => {
        setStatus(s)
        if (s === "PAID") {
          await wallet.sync()  // Refresh balance
          const newBalance = await getWalletBalance()
          setBalance(newBalance)
          setQuote(null)  // Clear form
        }
      }
    )
    
    return unsubscribe
  }

  return (
    <div>
      {!quote ? (
        <>
          <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(+e.target.value)} />
          <button onClick={handleDeposit}>Request Invoice</button>
        </>
      ) : (
        <>
          <QRCode value={quote.request} />
          <p>Status: {status}</p>
          {status === "EXPIRED" && <button onClick={handleDeposit}>Request New Invoice</button>}
        </>
      )}
      <p>Current Balance: {balance} sats</p>
    </div>
  )
}
```

### Acceptance Criteria

1. ✅ `POST /v1/mint` on mint returns valid bolt11 invoice
2. ✅ Frontend displays invoice to user (QR or raw)
3. ✅ Frontend polls for status or uses WebSocket (NUT-17)
4. ✅ When paid, `wallet.sync()` fetches tokens from mint
5. ✅ Balance updates in UI
6. ✅ Invoice expiry handled (can request new)

### Dependencies

- Phase 4 complete (keysets cached)
- Mint's Lightning integration working

---

## Phase 6: Trading Integration — Proof Spending + LMSR

### Overview

Core integration: User trades sats for outcome tokens.

User flow:
1. User views market detail, selects "Buy LONG" with amount (in sats)
2. Frontend calculates fee (1%), shows preview (shares received, new price)
3. User confirms
4. Frontend calls `POST /v1/cascade/trade`
5. Mint validates proofs, deducts 1% fee, calculates shares, spends proofs, signs outcome tokens
6. Frontend receives outcome tokens, stores position, publishes to Nostr

### Files & Services

**New: `src/lib/cashuProofs.ts`** — Proof helpers

```typescript
// Serialize proofs to send to mint
export function serializeProofs(proofs: Proof[]): string

// Deserialize outcome tokens from mint response
export function deserializeTokens(signatures: BlindSignature[]): Proof[]

// Calculate change amount
export function calculateChange(inputSats: number, feePercent: number): number
```

**Modified: `src/services/tradingService.ts`** — Real trade execution

```typescript
export async function executeTrade(
  market: Market,
  side: Side,
  amount: number,
  useRealMoney: boolean = ENV_USE_REAL_MONEY
): Promise<TradeResult> {
  if (!useRealMoney) {
    // Demo mode: record position only
    _recordPosition(market, side, amount)
    return { success: true, token: null }
  }

  // REAL mode: call mint
  const wallet = await loadOrCreateWallet()
  if (!wallet) return { success: false, error: { kind: "wallet_unavailable" } }

  // 1. Get proofs from wallet
  const balance = await getWalletBalance()
  if (balance < amount) {
    return {
      success: false,
      error: { kind: "insufficient_balance", balance, required: amount }
    }
  }

  // Select proofs to spend
  const proofs = wallet.selectProofs(amount)  // Choose proofs ≥ amount

  // 2. Blind change outputs (for overpayment)
  const changeAmount = proofs.reduce((sum, p) => sum + p.amount, 0) - amount
  const blindedChange = wallet.blindOutputs(changeAmount)

  // 3. Call mint trade endpoint
  try {
    const response = await fetch(`${getCurrentMintUrl()}/v1/cascade/trade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        market_id: market.eventId,
        side,
        inputs: proofs,
        outputs: blindedChange
      })
    })

    if (!response.ok) {
      const err = await response.json()
      return {
        success: false,
        error: { kind: "send_failed", reason: err.error || "Trade failed" }
      }
    }

    const tradeResponse = await response.json()

    // 4. Unblind outcome tokens
    const outcomeTokens = wallet.unblindOutputs(
      tradeResponse.change,
      blindedChange
    )

    // Merge outcome tokens with wallet (keyset specific to market/outcome)
    wallet.addTokens(outcomeTokens)

    // 5. Record position locally
    _recordPosition(market, side, amount, {
      fee: tradeResponse.trade.fee,
      shares: tradeResponse.trade.shares_received,
      entryPrice: tradeResponse.trade.entry_price,
      endPrice: tradeResponse.trade.end_price,
      positionProof: tradeResponse.position_proof
    })

    // 6. Publish position to Nostr (kind 30078)
    await publishPosition(market, side, {
      shares: tradeResponse.trade.shares_received,
      entryPrice: tradeResponse.trade.entry_price,
      positionProof: tradeResponse.position_proof,
      fee: tradeResponse.trade.fee
    })

    return { success: true, token: tradeResponse.position_proof }
  } catch (error) {
    return {
      success: false,
      error: { kind: "send_failed", reason: String(error) }
    }
  }
}

function _recordPosition(
  market: Market,
  side: Side,
  amount: number,
  details?: { fee: number; shares: number; entryPrice: number; endPrice: number; positionProof: string }
): void {
  const preview = details || previewTrade(market, "you", "BUY", side, amount)
  // ... existing logic ...
}
```

**Modified: `src/services/positionService.ts`** — Include position proof

Include `positionProof` in the kind 30078 serialization:

```typescript
export function serializePosition(position: Position): NDKEvent {
  const event = new NDKEvent()
  event.kind = 30078
  event.tags = [
    ["d", `cascade:position:${position.marketId}:${position.direction}`],
    ["market_id", position.marketId],
    ["direction", position.direction],
    ["shares", String(position.shares)],
    ["entry_price", String(position.entryPrice)],
    ["position_proof", position.positionProof || ""],  // NEW
    ["fee_paid", String(position.feePaid || 0)],      // NEW
  ]
  event.content = JSON.stringify({
    shares: position.shares,
    entryPrice: position.entryPrice,
    timestamp: Date.now()
  })
  return event
}
```

### Modified: `src/components/MarketDetail.tsx`

Display fee and preview:

```tsx
export function TradeForm() {
  const [amount, setAmount] = useState<number>(100)
  const [fee, setFee] = useState<number>(1)  // 1% = 1 sat of 100
  const [sharesPreview, setSharesPreview] = useState<number>(0)
  const [pricePreview, setPrice] = useState<number>(0)

  useEffect(() => {
    const feeAmount = Math.floor(amount * 0.01)
    const netAmount = amount - feeAmount
    const shares = solveBuyTokens(market, side, netAmount)
    const price = side === "LONG" 
      ? priceLong(market.qLong, market.qShort, market.b)
      : priceShort(market.qLong, market.qShort, market.b)
    
    setFee(feeAmount)
    setSharesPreview(shares)
    setPrice(price)
  }, [amount])

  return (
    <div>
      <input type="number" value={amount} onChange={(e) => setAmount(+e.target.value)} placeholder="Sats" />
      <p className="text-xs text-neutral-500">
        Fee (1%): {fee} sats
        <br />
        Shares: {sharesPreview.toFixed(2)}
        <br />
        Price: {(price * 100).toFixed(1)}¢
      </p>
      <button onClick={() => handleTrade(amount, side)}>Confirm</button>
    </div>
  )
}
```

### Acceptance Criteria

1. ✅ User selects amount and side
2. ✅ Fee preview shows 1% deduction
3. ✅ Share preview matches LMSR math
4. ✅ Proofs are validated on mint side
5. ✅ Outcome tokens signed and returned
6. ✅ Position recorded locally and published to Nostr
7. ✅ Concurrent trades don't cause double-spend (stateHash prevents)
8. ✅ Error messages clear (insufficient balance, invalid proofs, market not found, etc.)

### Dependencies

- Phase 5 complete (deposit working, wallet has balance)
- LMSR math parity with mint

---

## Phase 7: Settlement & Withdrawal

### Overview

After market resolves, users can:
1. **Mid-market redemption** (any time) — Sell shares back for sats
2. **Post-resolution claiming** (after resolution) — Claim payout based on outcome

### Files & Services

**New: `src/services/settlementService.ts`**

```typescript
export async function redeemSharesMidMarket(
  market: Market,
  side: Side,
  shares: number,
  positionProof: string
): Promise<{ payout: number; fee: number; netPayout: number } | null>

export async function claimSettlement(
  market: Market,
  side: Side,
  positionProof: string
): Promise<{ payout: number } | null>

export async function withdrawToLightning(
  amount: number,
  wallet: NDKCashuWallet
): Promise<{ paymentRequest: string; status: "PENDING" | "PAID" } | null>
```

**Flow: Mid-Market Redemption**

1. User views position, clicks "Redeem" with share amount
2. Frontend calls `POST /v1/cascade/redeem` with position proof
3. Mint validates proof, calculates payout, applies 1% fee, signs new ecash
4. Frontend receives ecash (outcome tokens → sats)
5. Position updated (shares reduced or eliminated)

**Flow: Post-Resolution**

1. Market is resolved (status = "resolved", resolutionOutcome = "YES" or "NO")
2. User clicks "Claim Payout"
3. Frontend calls `POST /v1/cascade/settle` with position proof
4. Mint validates proof, checks if user's side won, calculates payout (1.0 for winners, 0.0 for losers), applies 1% fee, signs ecash
5. If user lost, ecash amount is 0 (no refund)
6. Position marked as "settled"

**Flow: Withdrawal to Lightning**

1. User has ecash (outcome tokens or settlement payout)
2. User clicks "Withdraw"
3. Frontend calls `POST /v1/melt` (NUT-05) on mint, sends proofs
4. Mint validates proofs, creates Lightning payment request (invoice)
5. User pays invoice from their Lightning wallet (or we route to their node)
6. Mint pays out from Lightning reserve
7. Proofs spent, balance updated

### Modified: `src/components/Portfolio.tsx` & Position Cards

Add redemption/settlement UI:

```tsx
export function PositionCard({ position, market }: { position: Position; market: Market }) {
  const [redeemAmount, setRedeemAmount] = useState<number>(position.shares)
  const [redeemLoading, setRedeemLoading] = useState(false)

  async function handleRedeem() {
    setRedeemLoading(true)
    const result = await settlementService.redeemSharesMidMarket(
      market,
      position.direction as Side,
      redeemAmount,
      position.positionProof || ""
    )
    if (result) {
      // Update position, refresh balance
      setRedeemAmount(0)
      // Re-fetch position or update locally
    }
    setRedeemLoading(false)
  }

  async function handleClaim() {
    // Only if market.status === "resolved"
    const result = await settlementService.claimSettlement(
      market,
      position.direction as Side,
      position.positionProof || ""
    )
    if (result) {
      // Position marked as settled
    }
  }

  return (
    <div className="p-4 border border-neutral-800">
      <p>{position.direction === "yes" ? "📈 LONG" : "📉 SHORT"}</p>
      <p>{position.shares.toFixed(2)} shares @ {(position.entryPrice * 100).toFixed(1)}¢</p>
      
      {market.status === "active" && (
        <>
          <input 
            type="number" 
            max={position.shares} 
            value={redeemAmount}
            onChange={(e) => setRedeemAmount(+e.target.value)}
            placeholder="Shares to redeem"
          />
          <button onClick={handleRedeem} disabled={redeemLoading}>
            {redeemLoading ? "Redeeming..." : "Redeem"}
          </button>
        </>
      )}
      
      {market.status === "resolved" && !position.settled && (
        <button onClick={handleClaim}>Claim Payout</button>
      )}

      {position.settled && (
        <p className="text-xs text-neutral-500">✓ Settled</p>
      )}
    </div>
  )
}
```

### Acceptance Criteria

1. ✅ Mid-market redemption: shares → ecash (payout calculated, 1% fee applied)
2. ✅ Position updated after redemption (shares reduced)
3. ✅ Post-resolution payout: mint checks outcome, validates user's side, pays 1.0 or 0.0
4. ✅ Ecash can be melted to Lightning (via NUT-05)
5. ✅ Lightning invoice paid, user receives sats
6. ✅ Proofs properly spent (can't double-redeem)

### Dependencies

- Phase 6 complete (trading working, positions stored)
- Mint's `/v1/cascade/redeem` and `/v1/cascade/settle` endpoints implemented

---

## Phase 8: State Synchronization & Concurrency Management

### Overview

Ensure frontend and mint stay in sync, and concurrent trades don't cause race conditions.

**Key Mechanism: stateHash**

The mint computes a deterministic hash of market state after each trade:

```
stateHash = SHA256(qLong || qShort || reserve || version)
```

Every kind 982 event includes tags:
```
["stateHash", "abc123..."]
["version", "42"]
```

The frontend tracks the latest version/stateHash. When attempting to trade:
1. Frontend reads latest market state from Nostr (or fetches from mint)
2. Includes current stateHash in request to mint
3. Mint validates that stateHash matches its current state
4. If mismatch → reject trade, ask client to refresh and retry
5. If match → execute trade, compute new stateHash, publish

This ensures **optimistic locking** — concurrent trades are serialized.

### Modified: `src/services/marketService.ts`

Add stateHash tracking:

```typescript
export type MarketState = {
  qLong: number
  qShort: number
  reserve: number
  version: number
  stateHash: string
  lastUpdated: number
}

export function parseMarketStateFromEvent(event: NDKEvent): MarketState | null {
  // Extract from tags
  const qLong = parseFloat(event.getMatchingTags('q_long')[0]?.[1] ?? '0')
  const qShort = parseFloat(event.getMatchingTags('q_short')[0]?.[1] ?? '0')
  const reserve = parseFloat(event.getMatchingTags('reserve')[0]?.[1] ?? '0')
  const version = parseInt(event.getMatchingTags('version')[0]?.[1] ?? '0')
  const stateHash = event.getMatchingTags('stateHash')[0]?.[1] ?? ''

  return { qLong, qShort, reserve, version, stateHash, lastUpdated: event.created_at ?? 0 }
}
```

### Modified: `src/services/tradingService.ts`

Include stateHash in mint request:

```typescript
const currentState = await getLatestMarketState(market.eventId)

const response = await fetch(`${getCurrentMintUrl()}/v1/cascade/trade`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    market_id: market.eventId,
    side,
    state_hash: currentState.stateHash,  // NEW: for optimistic locking
    state_version: currentState.version,  // NEW
    inputs: proofs,
    outputs: blindedChange
  })
})

// Handle stateHash mismatch
if (response.status === 409) {  // Conflict
  return {
    success: false,
    error: { kind: "concurrent_trade", reason: "Market state changed; please refresh and retry" }
  }
}
```

### Mint-side: Validate stateHash

```rust
// In trade.rs
pub async fn handle_trade(
  market_id: &str,
  state_hash: &str,  // From request
  side: &str,
  inputs: &[Proof],
  outputs: &[BlindedMessage],
  state: &mut MarketState,
) -> Result<TradeResponse, TradeError> {
  // Validate stateHash
  if state.compute_state_hash() != state_hash {
    return Err(TradeError::ConcurrentTrade);
  }

  // Execute trade, compute new state
  // ...

  // Publish new state to Nostr
  let event = create_market_event(market_id, &state);
  publish_to_relays(event).await?;

  Ok(TradeResponse { ... })
}
```

### Acceptance Criteria

1. ✅ Mint publishes stateHash + version after each trade
2. ✅ Frontend includes stateHash in requests
3. ✅ Concurrent trades detected (409 Conflict response)
4. ✅ Client retries with updated stateHash
5. ✅ No double-spends or state divergence
6. ✅ Nostr events are authoritative source of market state

### Dependencies

- Phase 6 complete (trading working)
- Mint publishing kind 982 events with stateHash

---

## Phase 9: Testing Strategy

### Overview

Phased testing approach, from unit to integration to production.

### Phase 1: Unit Tests (Local, No Network)

**Test LMSR math parity:**

```rust
// tests/lmsr_parity.rs
#[test]
fn test_price_long_matches_frontend() {
  let (q_long, q_short, b) = (100.0, 50.0, 0.0001);
  let price = price_long(q_long, q_short, b);
  assert!((price - 0.6324).abs() < 0.0001);
}

#[test]
fn test_buy_tokens_matches_frontend() {
  let market = Market { qLong: 100, qShort: 50, ... };
  let tokens = solve_buy_tokens(&market, Side::Long, 100);
  // Cross-check with frontend calculation
  assert_eq!(tokens, 87);  // Expected value
}

#[test]
fn test_fee_calculation() {
  let amount = 1000;
  let fee = (amount as f64 * 0.01).floor() as u64;
  assert_eq!(fee, 10);
}
```

**Test proof spending:**

```rust
#[test]
fn test_proof_validation_and_spending() {
  let proof = create_test_proof(100);
  assert!(validate_proof(&proof, &keyset).is_ok());
  
  spend_proof(&proof);
  assert!(spend_proof(&proof).is_err());  // Can't double-spend
}
```

### Phase 2: Integration Tests (Against Nutshell)

Use reference Nutshell mint running locally (Docker):

```bash
docker-compose up -d nutshell
```

Test wallet integration without custom LMSR:

```typescript
// src/test/nutshell.integration.test.ts
import { loadOrCreateWallet, getWalletBalance, createDeposit } from '../walletStore'

describe('Nutshell Integration', () => {
  it('should deposit and receive tokens', async () => {
    const deposit = await createDeposit(100)
    expect(deposit).toBeDefined()
    
    // Simulate payment in test environment
    await simulatePayment(deposit.request)
    
    const balance = await getWalletBalance()
    expect(balance).toEqual(100)
  })
})
```

### Phase 3: Integration Tests (Against Custom Mint)

Run custom CDK Rust mint locally with regtest Bitcoin + testnet Lightning:

```bash
# Terminal 1: Bitcoin regtest
bitcoind -regtest

# Terminal 2: Lightning testnet
lnd --bitcoin.mainnet --lnd.datadir=/tmp/lnd

# Terminal 3: Mint
cargo run --bin cascade-mint

# Terminal 4: Tests
npm run test:integration
```

**Test scenarios:**

```typescript
// src/test/cascade.integration.test.ts

describe('Cascade Mint Integration', () => {
  describe('Deposit Flow', () => {
    it('should request invoice, pay, and receive tokens', async () => {
      const quote = await depositService.requestDepositQuote(100, MINT_URL)
      expect(quote.state).toBe('UNPAID')
      
      // Pay invoice via test node
      await testLightningNode.pay(quote.request)
      
      // Wait for mint to detect payment
      await sleep(2000)
      
      const status = await depositService.checkDepositStatus(quote.quote_id, MINT_URL)
      expect(status).toBe('PAID')
      
      const balance = await getWalletBalance()
      expect(balance).toEqual(100)
    })
  })

  describe('Trading', () => {
    it('should execute trade and record position', async () => {
      // Setup: deposit 1000 sats
      const balance = await getWalletBalance()
      expect(balance).toBeGreaterThanOrEqual(1000)
      
      // Trade: Buy LONG for 500 sats
      const result = await tradingService.executeTrade(market, 'LONG', 500, true)
      expect(result.success).toBe(true)
      
      // Verify position recorded
      const positions = await getPositions(market.eventId)
      expect(positions).toHaveLength(1)
      expect(positions[0].direction).toBe('yes')
      expect(positions[0].shares).toBeGreaterThan(0)
      
      // Verify fee deducted (1% = 5 sats)
      const newBalance = await getWalletBalance()
      expect(newBalance).toBeLessThanOrEqual(balance - 500)  // 500 spent + fees
    })

    it('should reject concurrent trades on same market', async () => {
      // Simulate two concurrent trades
      const trade1 = tradingService.executeTrade(market, 'LONG', 100, true)
      const trade2 = tradingService.executeTrade(market, 'SHORT', 100, true)
      
      const results = await Promise.all([trade1, trade2])
      
      // One should succeed, one should fail with concurrent_trade
      const successes = results.filter(r => r.success)
      const failures = results.filter(r => !r.success && r.error?.kind === 'concurrent_trade')
      
      expect(successes).toHaveLength(1)
      expect(failures).toHaveLength(1)
    })

    it('should calculate reserve correctly after trades', async () => {
      // Trade LONG for 100 sats
      await tradingService.executeTrade(market, 'LONG', 100, true)
      
      // Fetch updated market state from mint
      const updatedMarket = await fetchMarketFromMint(market.eventId)
      
      // Verify reserve = cost function value
      const expectedReserve = costFunction(updatedMarket.qLong, updatedMarket.qShort, updatedMarket.b)
      expect(updatedMarket.reserve).toBe(expectedReserve)
    })
  })

  describe('Redemption', () => {
    it('should redeem shares mid-market', async () => {
      // Setup: trade LONG
      const tradeResult = await tradingService.executeTrade(market, 'LONG', 500, true)
      expect(tradeResult.success).toBe(true)
      
      // Redeem half the shares
      const positions = await getPositions(market.eventId)
      const position = positions[0]
      const shareCount = position.shares / 2
      
      const redeemResult = await settlementService.redeemSharesMidMarket(
        market,
        'LONG',
        shareCount,
        position.positionProof || ''
      )
      expect(redeemResult).not.toBeNull()
      expect(redeemResult!.netPayout).toBeGreaterThan(0)
      expect(redeemResult!.fee).toBeGreaterThan(0)  // 1% fee applied
      
      // Verify position updated
      const updatedPositions = await getPositions(market.eventId)
      expect(updatedPositions[0].shares).toBeLessThan(position.shares)
    })
  })

  describe('Settlement', () => {
    it('should settle winners at 1.0 and losers at 0.0', async () => {
      // Setup: create market, trade both sides
      const longResult = await tradingService.executeTrade(market, 'LONG', 500, true)
      const shortResult = await tradingService.executeTrade(market, 'SHORT', 300, true)
      
      expect(longResult.success && shortResult.success).toBe(true)
      
      // Resolve market (mint marks as resolved)
      await resolutionService.resolveMarket(market.eventId, 'YES')
      
      // Winner (LONG) claims
      const longPositions = await getPositions(market.eventId)
      const longPosition = longPositions.find(p => p.direction === 'yes')
      
      const longClaim = await settlementService.claimSettlement(
        market,
        'LONG',
        longPosition?.positionProof || ''
      )
      expect(longClaim!.payout).toBeGreaterThan(0)
      
      // Loser (SHORT) claims
      const shortPosition = longPositions.find(p => p.direction === 'no')
      const shortClaim = await settlementService.claimSettlement(
        market,
        'SHORT',
        shortPosition?.positionProof || ''
      )
      expect(shortClaim!.payout).toBe(0)  // Loser gets nothing
    })
  })

  describe('Withdrawal', () => {
    it('should melt tokens back to Lightning', async () => {
      // Setup: deposit tokens
      const balance = await getWalletBalance()
      expect(balance).toBeGreaterThanOrEqual(100)
      
      // Melt 100 sats
      const meltResult = await settlementService.withdrawToLightning(100, wallet)
      expect(meltResult).not.toBeNull()
      expect(meltResult!.status).toBe('PENDING')
      
      // Simulate payment
      await testLightningNode.pay(meltResult!.paymentRequest)
      
      // Wait for mint to detect
      await sleep(2000)
      
      // Verify balance decreased
      const newBalance = await getWalletBalance()
      expect(newBalance).toBeLessThan(balance)
    })
  })
})
```

### Phase 4: Smoke Tests (Against Live Testnet)

Once deployed to testnet (Bitcoin testnet + Lightning testnet):

```bash
npm run test:smoke:testnet
```

Run the same test scenarios against live testnet mints, with real testnet Bitcoin and Lightning.

### Phase 5: Manual Testing (Before Mainnet)

Checklist:
- [ ] Deposit 100k sats (or max allowed)
- [ ] Trade both LONG and SHORT on 5 different markets
- [ ] Mid-market redemption (sell some shares, keep some)
- [ ] Concurrency test (open market in 2 browser tabs, trade simultaneously, ensure no double-spend)
- [ ] Settlement test (resolve market, claim payout for winners and losers)
- [ ] Withdrawal (melt 1000 sats back to Lightning)
- [ ] Keyset rotation (mint rotates keyset, old tokens still valid)
- [ ] Network resilience (kill mint, reconnect, see graceful error, then retry)

### Phase 6: Mainnet Go-Live

Once smoke tests pass:
1. Deploy mint to mainnet infrastructure (production Lightning node, Nostr relays)
2. Enable `VITE_CASCADE_MINT_URL` pointing to mainnet mint
3. Start with small liquidity parameters (low `b`, low max market size)
4. Monitor logs, reserve accounting, fee collection
5. Gradually increase market caps and user load

---

## Verification

### How to Verify Complete Implementation

**Phase 1 (Mint Infrastructure):**
```bash
# Mint is running
curl https://<mint-url>/v1/info | jq

# Has custom endpoints
curl https://<mint-url>/v1/cascade/trade -X POST

# Publishes to Nostr
# Check relay for kind 982 events from mint pubkey
nak sub -k 982 -a <mint-pubkey> wss://relay.example.com
```

**Phase 2 (Frontend Mint Integration):**
```bash
# Frontend detects mint
npm run dev
# Open WalletPage
# Confirm mint name and supportsCascade flag

# Wallet initializes with correct keysets
# Open MarketDetail
# Check browser console: wallet has keysets loaded
```

**Phase 3 (Deposit Flow):**
```bash
# Full flow
# 1. Click "Deposit"
# 2. Pay invoice (test Lightning)
# 3. Balance updates
# 4. No manual wallet.sync() needed
```

**Phase 4 (Trading):**
```bash
# Trade execution
# 1. Click "Buy LONG"
# 2. Fee shown (1%)
# 3. Position appears in portfolio
# 4. Check Nostr: position published as kind 30078
```

**Phase 5 (Concurrency):**
```bash
# Test race condition handling
# 1. Open market in 2 browser tabs
# 2. Simultaneously trade LONG in tab 1 and SHORT in tab 2
# 3. One should succeed, one should show "concurrent_trade" error
# 4. User can refresh and retry
```

**Phase 6 (Settlement):**
```bash
# Resolution and payout
# 1. Resolve market (admin action)
# 2. Check Nostr: market status updated
# 3. Winners click "Claim Payout" → receive ecash
# 4. Losers click "Claim Payout" → receive 0 sats
# 5. Both can melt to Lightning
```

**Phase 7 (Full End-to-End):**
```bash
# Complete happy path
# 1. Deposit 500 sats
# 2. Buy LONG for 300 sats (pay 297 net after 1% fee)
# 3. Buy SHORT for 200 sats (pay 198 net after 1% fee)
# 4. Mid-market: redeem 50% of LONG (receive ~150 sats ecash)
# 5. Market resolves YES
# 6. Claim LONG payout (receive ~150 sats)
# 7. Claim SHORT payout (receive 0 sats)
# 8. Melt all ecash back to Lightning
# 9. Check reserve: always ≥ worst-case payout
# 10. Check treasury: accumulated 1% fees
```

---

## Open Questions (From Spec)

These should be resolved before or during implementation:

1. **Liquidity bootstrapping** — When a new market is created, who funds the initial LMSR reserve?
   - Options: (a) Creator stakes initial sats, (b) Cascade seeds all markets, (c) First trader provides liquidity
   - Impact: Determines initial market cap and price discovery

2. **Maximum market size** — Should there be a cap on outstanding shares per market?
   - Options: (a) No cap, (b) Cap at N tokens, (c) Cap per keyset
   - Impact: Reserve growth, tail risk exposure

3. **Multi-market reserve pooling** — Can the mint pool reserves across markets, or strictly segregated?
   - Options: (a) Pooled (risky but capital-efficient), (b) Segregated (safe but capital-intensive)
   - Impact: Capital requirements, default risk concentration

4. **Settlement timeout** — How long do winners have to claim payouts before reserve is recycled?
   - Options: (a) 30 days, (b) 90 days, (c) Forever (don't recycle)
   - Impact: User experience, operational complexity

5. **Partial redemption** — Already supported by LMSR math. Confirm in UI: can users sell fractional shares?
   - Current code supports it. Just confirm product intent.

---

## Execution Order

1. **mint-engineer** starts with Phase 1–2 (mint setup, endpoints)
2. **Frontend team** starts Phase 3 (discovery) once Phase 1 is running
3. **Parallel:** Phases 4–5 (wallet integration, deposits)
4. **Sequential:** Phase 6 (trading), Phase 7 (settlement)
5. **Concurrent:** Phase 8 (state sync) developed alongside Phases 6–7
6. **Final:** Phase 9 (testing strategy, execution)

Each phase has acceptance criteria and can be independently verified before moving to the next.
