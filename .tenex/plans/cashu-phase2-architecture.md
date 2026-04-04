# Cashu Mint Architecture for Cascade Phase 2

**Status**: Architecture Blueprint — Revised After Expert Review  
**Audience**: Pablo (Product), Calle (Cashu), Engineering Team  
**Purpose**: Define Cashu mint design for Phase 2 (pure Cashu bearer token model)

---

## Executive Summary

Cascade Phase 2 deploys a **specialized Cashu mint built in CDK Rust** for binary prediction market trading using pure ECASH principles. The architecture:

- **Issues TWO keysets per market** (YES keyset, NO keyset) — standard Cashu outcome isolation
- **Uses bearer tokens** (no user accounts, no escrow balances) — preserves Cashu privacy
- **Prices trades via LMSR** (in frontend; mint validates only)
- **Settles via claim-based swap** (winners initiate swaps after resolution; losers' keyset deactivated)
- **Deposits/withdraws via Lightning** (NUT-06 mint, NUT-05 melt)

This is a pure Cashu implementation with custom LMSR validation, not a custodial exchange.

---

## Confirmed Design Decisions (Locked)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Mint software** | CDK Rust | Official Cashu; production-grade ECASH |
| **Keyset strategy** | TWO per market | YES keyset + NO keyset; standard Cashu pattern |
| **Outcome isolation** | Keyset deactivation | Losing keyset marked inactive; swap handler rejects |
| **Privacy model** | Pure bearer tokens | No user accounts; Cashu blind signatures throughout |
| **Trading model** | Swap (NUT-03/NUT-04) | User swaps sat proofs → outcome proofs |
| **Pricing** | LMSR (frontend) | Deterministic; mint validates prices only |
| **Deposit** | NUT-06 (BOLT11) | Standard Cashu deposit |
| **Withdrawal** | NUT-05 (BOLT11) | Standard Cashu melt |
| **Resolution** | Claim-based | Winners initiate swaps; losers' keyset inactive |

---

## Architecture Overview: Pure Cashu Model

### Bearer Token Flow

```
Deposit Phase:
  1. User: "I want to trade Bitcoin market"
  2. User: Pays BOLT11 to mint (e.g., 100 sats)
  3. Mint: Issues 100 sats in generic proofs (sat-denomination)
  4. User: Holds bearer tokens (100 sats)
  
Trade Phase:
  5. User: "Buy YES for 50 sats"
  6. Frontend: Computes LMSR price, creates swap request
  7. User: Submits 50 sats proofs + blinded messages for YES outcome
  8. Mint: Validates price, signs blinded messages (YES keyset)
  9. User: Receives 50 sats worth of YES outcome proofs
  
Hold Phase:
  10. User: Stores YES proofs locally (bearer tokens, privacy-preserved)
  11. Market: State tracks qYES, qNO on kind 982 events
  
Resolution Phase:
  12. Oracle: Publishes YES outcome on kind 30023 event
  13. Mint: Deactivates NO keyset (swap handler rejects NO tokens)
  14. Winners: Initiate claim swap (YES proofs → sats, minus 2% rake)
  15. Losers: Can't swap (NO keyset inactive)
  
Withdrawal Phase:
  16. User: Holds sat proofs (from claim swap or original deposit)
  17. User: Melts sat proofs → Lightning (NUT-05 BOLT11)
  18. Mint: Burns proofs, pays user's invoice
```

### Key Privacy Property

At **no point** does the mint know:
- Which user holds which token
- How many outcome tokens a user has
- User's trading history

Blind signatures ensure token creation is confidential. Tokens are bearer: "who holds it, owns it."

---

## Two Keysets Per Market (Keyset Strategy)

### Why Two Keysets?

Each market has two possible outcomes (YES/NO). We use **two independent Cashu keysets**:

```
Market Bitcoin:
  - Keyset A: bitcoin_yes_keyset_abc (denominations: 1, 2, 4, 8, 16, 32, 64, ...)
  - Keyset B: bitcoin_no_keyset_xyz  (denominations: 1, 2, 4, 8, 16, 32, 64, ...)
```

**Outcome isolation**: A token from keyset A (YES) cannot be swapped using keyset B's (NO) validation logic. The keysets are separate Cashu units.

### Market Kind 982 Extension

```json
{
  "kind": 982,
  "tags": [
    ["d", "bitcoin"],
    ["title", "Bitcoin Price > $100k"],
    ["mint", "https://mint.contrarian.markets"],
    ["keyset_yes", "bitcoin_yes_keyset_abc"],
    ["keyset_no", "bitcoin_no_keyset_xyz"],
    ["qLong", "150"],
    ["qShort", "100"],
    ["b", "500"],
    ["oracle_pubkey", "npub1oracle..."]
  ]
}
```

### Scaling

For M markets:
```
Total keysets = M * 2
Example: 100 markets = 200 keysets
```

**Manageable**: Each keyset is ~100 bytes. 200 keysets = ~20KB. Relaying via `/keysets` is standard Cashu.

---

## LMSR Pricing Architecture

### Where LMSR Lives

**Frontend only** (not mint):

1. Frontend fetches market state from kind 982: `qYES`, `qNO`, `b`
2. User selects trade: amount, direction (YES/NO)
3. Frontend computes:
   ```
   price = e^(qYES/b) / (e^(qYES/b) + e^(qNO/b))
   shares_purchased = amount_sats / price
   new_qYES = qYES + shares_purchased
   new_price = e^(new_qYES/b) / (e^(new_qYES/b) + qNO/b)
   slippage = (price - new_price) / price
   ```
4. Frontend displays preview
5. User approves

### Mint Validation (Custom Swap Handler)

The mint's swap handler (NUT-03/NUT-04) is extended with **optional LMSR validation**:

```rust
// Pseudocode: CDK swap handler extension
impl SwapHandler {
  fn handle_swap(&self, request: SwapRequest) -> Result<SwapResponse> {
    // Standard Cashu validation
    self.verify_proofs(&request.inputs)?;
    self.check_denominations(&request.outputs)?;
    
    // CUSTOM: LMSR validation (optional)
    if request.has_lmsr_params {
      let market_state = request.market_state.clone();
      let price = compute_lmsr_price(&market_state)?;
      
      // Verify price matches client computation
      if (request.client_price - price).abs() > tolerance {
        return Err("Price mismatch");
      }
      
      // Verify keyset matches outcome
      let expected_keyset = match request.outcome {
        "YES" => &self.market.keyset_yes,
        "NO" => &self.market.keyset_no,
      };
      
      if request.keyset_id != expected_keyset.id {
        return Err("Keyset mismatch");
      }
    }
    
    // Issue blind signatures
    self.sign_blinded_messages(&request.blinded_messages, &expected_keyset)
  }
}
```

**Key point**: The mint **validates** prices, not **computes** them. Frontend owns computation; mint owns cryptography.

---

## Pure Bearer Token Model (No Accounts)

### Unlike Custodial Exchange

The original plan proposed:
```
Mint: escrow[user] = 100 sats
Mint: Check escrow_balance[user] >= 50
```

**This is NOT Cashu**. It requires:
- User identification for every trade
- Account balances (privacy loss)
- Non-standard `/api/trade` endpoint

### Pure Cashu Model (Revised)

```
User has 100 sat proofs (bearer tokens).
User wants to trade 50 sats on YES.

Frontend:
  1. Selects 50 sats from proofs
  2. Creates blinded messages for YES outcome
  3. Computes LMSR price
  
POST /swap:
  {
    "inputs": [50 sats in sat-denomination proofs],
    "blinded_messages": [8 messages for YES outcome],
    "market": "bitcoin_market_keyset_abc",
    "outcome": "YES",
    "price": 0.55,
    "qYES": 150,
    "qNO": 100,
    "b": 500
  }

Mint:
  1. Verify proofs valid (standard Cashu)
  2. Compute LMSR price, verify matches
  3. Verify keyset matches outcome
  4. Sign blinded messages with YES keyset
  5. Return signatures

Frontend:
  1. Unblind signatures (only frontend knows blinding factors)
  2. User now holds 50 sats in YES outcome proofs
  3. User holds remaining 50 sats in sat proofs (can trade NO, or withdraw)
```

**No escrow accounts**. Tokens are bearer. Privacy preserved.

---

## Trade Flow (Bearer Token Swap)

### Step-by-Step

```
┌────────────────────────────────────────────────────┐
│ User: "I want 50 sats of YES in Bitcoin"          │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ Frontend: Fetch market state from kind 982        │
│ qYES=150, qNO=100, b=500                          │
│ Compute: price = e^(150/500) / (e^(150/500)+...) │
│ Compute: shares = 50 / 0.55 ≈ 91 shares          │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ Frontend: Show preview                            │
│ Entry price: 0.55                                 │
│ Slippage: ~0.2%                                   │
│ New market state: qYES=241, qNO=100               │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ User: Approve trade                               │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ Frontend: Create swap request                     │
│ - Select 50 sats from holdings                    │
│ - Create 50 blinded messages (denominations:      │
│   32, 16, 2 — powers of 2 only per Cashu spec)  │
│ - Include market state + price + keyset_yes      │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ POST /swap (CDK standard endpoint)                │
│ {                                                  │
│   "inputs": [50 sat proofs],                      │
│   "outputs": [                                     │
│     {amount: 32, blinded: "..."},                 │
│     {amount: 16, blinded: "..."},                 │
│     {amount: 2, blinded: "..."}                   │
│   ],                                              │
│   "market_keyset_yes": "bitcoin_yes_keyset_abc", │
│   "market_state": {qYES: 150, qNO: 100, b: 500}, │
│   "price": 0.55                                   │
│ }                                                  │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ Mint: Validate swap                               │
│ 1. Verify input proofs (standard Cashu)          │
│ 2. Verify keyset_yes is YES outcome keyset       │
│ 3. Compute LMSR price                            │
│ 4. Verify price matches client (tolerance: 0.1%) │
│ 5. Verify blinded message count/amounts          │
│ 6. Sign all blinded messages with YES keyset     │
└──────────────────────┬─────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────┐
│ Frontend: Unblind signatures                      │
│ (Only frontend knows blinding factors)            │
│ User now holds: 50 sats of YES outcome proofs    │
│ Remaining: 50 sats in generic sat proofs         │
│                                                   │
│ Record position on Nostr (kind 30078):            │
│ {                                                  │
│   direction: "yes",                               │
│   quantity: 91,  (shares, not sats)              │
│   entryPrice: 0.55,                              │
│   costBasis: 50,  (sats)                         │
│   market: "bitcoin"                               │
│ }                                                  │
└────────────────────────────────────────────────────┘
```

---

## Market Resolution Flow (Claim-Based)

### Phase 1: Oracle Publishes Outcome

```
Oracle: "Bitcoin market → YES outcome"
  Publishes kind 30023 event:
  {
    market: "bitcoin_market_keyset_abc",
    outcome: "YES",
    timestamp: 1712234400,
    signature: "..."
  }
```

### Phase 2: Mint Marks Losing Keyset Inactive

```
Mint Admin:
  1. Fetches kind 30023 event
  2. Verifies oracle pubkey matches market event
  3. Updates keyset status:
     - bitcoin_yes_keyset_abc: active (winning)
     - bitcoin_no_keyset_xyz: INACTIVE (losing)
  4. Records: resolution_at, winning_outcome
```

**After this point**:
- Swap handler accepts swaps for YES keyset
- Swap handler **rejects** swaps for NO keyset (keyset inactive)

### Phase 3: Winners Claim Payouts

Winners initiate a **claim swap**:

```
User has: 50 sats of YES outcome proofs

POST /swap (claim):
  {
    "inputs": [50 sats YES proofs],
    "outputs": [
      {amount: 32, blinded: "..."},  // Sat-denomination
      {amount: 16, blinded: "..."},
      {amount: 2, blinded: "..."}
    ],
    "payout_type": "claim",  // Signal to rake 2%
    "market_keyset_yes": "bitcoin_yes_keyset_abc"
  }

Mint:
  1. Verify YES proofs (YES keyset active)
  2. Compute payout: 50 * 0.98 = 49 sats (2% rake)
  3. Sign blinded messages (sat-denomination keyset)
  4. Record: rake_sats += 2

User:
  1. Unblind signatures
  2. User now holds 49 sats in sat proofs
  3. Can withdraw via NUT-05 melt
```

**No account balances**. No unilateral minting. Winner proves they own the YES proofs, mint validates and swaps.

### Phase 4: Loser Proofs Become Worthless

```
User has: 50 sats of NO outcome proofs

POST /swap:
  {
    "inputs": [50 sats NO proofs],
    ...
  }

Mint:
  1. Checks: NO keyset inactive (resolution reached)
  2. Rejects swap: "Keyset marked as losing outcome"
  
User:
  Can never redeem NO proofs.
  (Optional future: Allow user to "burn" proofs for grace period, then permanently invalid)
```

---

## Keyset Deactivation Mechanism

### Implementation (CDK)

CDK's keyset structure needs **resolution status flag**:

```rust
struct CashuKeyset {
  kid: String,                          // Keyset ID
  pubkey: PublicKey,
  denominations: HashMap<u64, Key>,     // 1, 2, 4, 8, 16, ...
  
  // NEW: Resolution tracking
  market_outcome_type: Option<String>,  // "YES" or "NO"
  resolution_status: Option<String>,    // "active" or "inactive"
  resolved_at: Option<u64>,             // Timestamp
}
```

Swap handler validation:

```rust
impl SwapHandler {
  fn validate_keyset(&self, keyset: &Keyset) -> Result<()> {
    match keyset.resolution_status {
      Some("inactive") => {
        // Keyset is losing outcome; reject all swaps
        Err("Keyset marked as losing outcome; can no longer swap")
      },
      Some("active") | None => Ok(()), // Can swap
      _ => Err("Unknown keyset status"),
    }
  }
}
```

### Calle Question (Escalation)

**Can CDK's keyset management be extended with resolution status?** This is critical for outcome isolation without external account logic.

---

## Lightning Integration

### Deposit (NUT-06)

```
User: "I want to deposit 100 sats"

1. Frontend: POST /mint/quote/bolt11 {amount: 100}
2. Mint: Creates BOLT11 invoice, stores pending quote
3. Frontend: Shows QR code
4. User: Pays 100 sats from personal Lightning wallet
5. Mint: Receives payment, issues 100 sat proofs
6. Frontend: Polls /mint/bolt11/{quote_id}
7. User: Receives generic sat proofs (bearer tokens)
```

**Standard Cashu NUT-06. No custom logic.**

### Withdrawal (NUT-05)

```
User: "Withdraw 49 sats"
(User has 49 sat proofs from claim swap)

1. User: Generates BOLT11 invoice from personal wallet
2. Frontend: POST /melt/quote/bolt11 {invoice: "...", amount: 49}
3. Mint: Validates BOLT11 amount matches
4. Frontend: POST /melt/bolt11 {quote_id, proofs: sat proofs}
5. Mint: Validates proofs, burns, pays invoice via Lightning
6. User: Receives 49 sats
```

**Standard Cashu NUT-05. No custom logic.**

---

## Frontend Integration Points

### Market Kind 982 (Extended)

```json
{
  "kind": 982,
  "content": "Market description",
  "tags": [
    ["d", "bitcoin"],
    ["title", "Bitcoin Price > $100k"],
    ["mint", "https://mint.contrarian.markets"],
    ["keyset_yes", "bitcoin_yes_keyset_abc"],
    ["keyset_no", "bitcoin_no_keyset_xyz"],
    ["qLong", "150"],
    ["qShort", "100"],
    ["b", "500"],
    ["oracle_pubkey", "npub1oracle..."]
  ]
}
```

### Position Kind 30078 (Market Position Tracking)

```json
{
  "kind": 30078,
  "tags": [
    ["d", "cascade:position:bitcoin:yes"],
    ["market", "bitcoin"],
    ["outcome", "yes"]
  ],
  "content": {
    "quantity": 91,
    "entryPrice": 0.55,
    "costBasis": 50,
    "timestamp": 1712234400
  }
}
```

**Purpose**: **Not for escrow tracking**. Just for user's record of their position. Positions are **informational only** — the mint doesn't validate against them.

### Mint API (Standard Cashu + Custom LMSR Validation)

| Endpoint | Standard? | Purpose |
|----------|-----------|---------|
| `GET /keys` | ✅ NUT-01 | List keysets (YES + NO per market) |
| `GET /keysets` | ✅ NUT-01 | Keyset metadata + resolution status |
| `POST /mint/quote/bolt11` | ✅ NUT-06 | Deposit quote |
| `GET /mint/bolt11/{id}` | ✅ NUT-06 | Check deposit paid |
| `POST /swap` | ✅ NUT-03/04 | Swap (with optional LMSR validation) |
| `POST /melt/quote/bolt11` | ✅ NUT-05 | Withdrawal quote |
| `POST /melt/bolt11` | ✅ NUT-05 | Execute withdrawal |

**No custom endpoints**. All standard Cashu with optional LMSR validation in swap handler.

---

## Data Models

### Keyset Metadata

```rust
struct MarketKeyset {
  keyset_id: String,
  market_id: String,
  outcome: String,              // "YES" or "NO"
  keyset_secret: Vec<u8>,       // HSM-protected
  
  // Resolution tracking
  resolution_status: String,    // "active" or "inactive"
  resolved_outcome: Option<String>,  // "YES" if this is winning keyset
  resolved_at: Option<u64>,
}
```

### Rake Reserve

```rust
struct RakeAccounting {
  total_sats: u64,
  last_updated: u64,
  
  // Per-market breakdown (for transparency)
  per_market: HashMap<String, u64>,
}
```

**Simple tracking**: Whenever a winner claims or loser's keyset is deactivated, increment rake. No per-user accounts.

---

## Open Questions (For Pablo + Calle)

### 1. CDK Keyset Resolution Status
- **Question**: Can CDK's keyset structure be extended to track resolution status (active/inactive)?
- **Impact**: If not, need custom keyset management layer
- **Escalation**: Calle

### 2. LMSR Validation in Swap Handler
- **Question**: How should CDK's swap handler be extended to validate custom LMSR prices?
- **Options**:
  - Option A: Extend swap handler with optional LMSR validation
  - Option B: Separate `/trade` endpoint that validates LMSR, then calls swap
  - Option C: No validation; frontend enforces atomically
- **Recommendation**: Option A (cleaner, stays in standard flow)
- **Escalation**: Calle

### 3. Rake Accounting
- **Question**: Should rake sats stay in mint (for reinvestment/liquidity), or be withdrawable?
- **Options**:
  - A: Keep in mint, grow liquidity pool
  - B: Withdrawable to platform wallet (revenue model)
  - C: Both (partial withdrawal allowed)
- **Recommendation**: Option A for MVP (simpler, reinvests into market depth)
- **Decision needed**: Pablo

### 4. Claim Deadline
- **Question**: Should winners have a deadline to claim payouts (e.g., 30 days)?
- **Impact**: Unclaimed payouts → rake permanently
- **Recommendation**: 30-day claim deadline, then losing keyset can be deleted
- **Decision needed**: Pablo

### 5. Multi-Mint Support (Phase 3)
- **Question**: Should Phase 2 design for federated mints, or single mint?
- **Recommendation**: Phase 2 = single mint. Phase 3 can add federation
- **Decision needed**: Pablo

---

## Cashu Specification Corrections (From Expert Review)

### Denomination Fix
- ❌ Original: "20 blinded messages (2.5 sats each)"
- ✅ Correct: Cashu uses power-of-2 denominations: {1, 2, 4, 8, 16, 32, 64, 128, ...}
- **Fix**: 50 sats = {32, 16, 2} (3 messages)

### NUT Attribution
- ❌ Original: "P2PK from NUT-07/NUT-11"
- ✅ Correct: NUT-07 is state checks (lightning conditionals). P2PK is NUT-10/NUT-11.
- **Fix**: Removed P2PK from this design (now using two keysets instead)

### Fee Handling
- **Missing**: Plan didn't address NUT-02 fees on swaps/melts
- **Fix**: Add: "Mint applies NUT-02 fees on swaps (e.g., 0.1%). Documented in `/keys` response."

---

## Summary: What Changed

### Original Plan (Rejected)
- One keyset per market + P2PK outcome locking
- Per-user escrow accounts
- Unilateral payout minting
- Non-standard `/api/trade` endpoint

### Revised Plan (Current)
- ✅ **Two keysets per market** (YES + NO)
- ✅ **Pure Cashu bearer tokens** (no accounts)
- ✅ **Claim-based resolution** (winners initiate swaps)
- ✅ **Standard Cashu endpoints** (NUT-06, NUT-03/04, NUT-05)
- ✅ **Optional LMSR validation** in swap handler
- ✅ **Keyset deactivation** for outcome isolation

**Result**: Simpler, more Cashu-aligned, privacy-preserving.

---

## Next Steps

### For Pablo
1. Confirm two-keyset approach (YES keyset + NO keyset per market)?
2. Confirm pure bearer token model (no escrow accounts)?
3. Confirm claim-based resolution (winners initiate swaps)?
4. Decide: Single mint (Phase 2) or federated (Phase 4)?
5. Decide: Rake kept in mint (liquidity) or withdrawn (revenue)?

### For Calle (After Pablo Approval)
1. Can CDK keyset resolution status be tracked?
2. How to extend swap handler with LMSR validation?
3. Any other Cashu compliance issues?

### For Implementation Team (After Calle Approval)
- API spec with LMSR validation logic
- Keyset management design
- Rake accounting module
- Frontend wallet refactoring (multi-market token management)

---

## Conclusion

This revised architecture is **pure Cashu** with **custom LMSR pricing**. It preserves privacy (bearer tokens, blind signatures), uses standard Cashu flows (NUT-06, NUT-03/04, NUT-05), and simplifies the mint logic (no accounts, no custom escrow).

The core insight: **Outcome isolation via keyset deactivation is simpler and more Cashu-native than P2PK locking.**
