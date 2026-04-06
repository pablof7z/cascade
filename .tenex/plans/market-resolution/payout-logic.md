# Payout Logic — LMSR Settlement Math

## Outcome Types

| Outcome | Who Gets Paid | Formula | Use Case |
|---|---|---|---|
| `YES` | Holders of YES positions | `netSats = shares * outcomePrice - costBasis * RAKE_FRACTION` | Market resolves affirmatively |
| `NO` | Holders of NO positions | `netSats = shares * (1 - outcomePrice) - costBasis * RAKE_FRACTION` | Market resolves negatively |
| `VOID` | **All** position holders | `netSats = costBasis * (1 - RAKE_FRACTION)` | Event cancelled, dispute, ambiguous outcome |

- `RAKE_FRACTION` = platform fee (e.g., 0.02 = 2%)
- For `VOID`: every position holder receives their cost basis back minus rake, regardless of side. This is a refund, not a profit.

## Winner Determination

| Outcome | Winners | Losers |
|---|---|---|
| YES (outcomePrice=1.0) | All positions where `position.outcome === 'YES'` | All positions where `position.outcome === 'NO'` |
| NO (outcomePrice=0.0) | All positions where `position.outcome === 'NO'` | All positions where `position.outcome === 'YES'` |
| VOID | **All positions** (refund) | None |

**Losing stakes**: When users bought shares on the losing side, their sats entered the vault via the LMSR cost function during trading. Those sats remain in the vault — they are not explicitly "moved" during resolution. The vault balance naturally includes these proceeds, which is why the vault should have sufficient funds to pay winners if the LMSR math is correct.

## LMSR Payout Math

### Core Functions (from `tradingService.ts`)

```typescript
// Price of outcome i given current share quantities
getPrice(i, quantities, b) = exp(q_i / b) / Σ exp(q_j / b)

// Cost function: total cost for current state
C(quantities, b) = b * ln(Σ exp(q_j / b))

// Cost to buy `delta` shares of outcome i
calcCost(i, delta, quantities, b) = C(q + delta*e_i, b) - C(q, b)
```

### Per-Winner Payout Calculation

For outcome `YES` or `NO`:

```typescript
function calculatePayout(position: Position, outcome: string, outcomePrice: number): number {
  if (outcome === 'VOID') {
    return Math.floor(position.costBasis * (1 - RAKE_FRACTION));
  }

  // Only winning positions get payouts
  if (position.outcome !== outcome) return 0;

  const grossPayout = position.shares * outcomePrice;
  const rake = position.costBasis * RAKE_FRACTION;
  const netPayout = Math.floor(grossPayout - rake);

  return Math.max(0, netPayout); // Never negative
}
```

### Total Expenditure Pre-Check

```typescript
function calculateTotalExpenditure(positions: Position[], outcome: string, outcomePrice: number): number {
  return positions.reduce((total, pos) => total + calculatePayout(pos, outcome, outcomePrice), 0);
}

// In _executeResolution:
const totalExpenditure = calculateTotalExpenditure(allPositions, outcome, outcomePrice);
const vaultBalance = getVaultBalance();
if (vaultBalance < totalExpenditure) {
  return { success: false, error: { kind: 'insufficient_vault', needed: totalExpenditure, available: vaultBalance } };
}
```

## Bridge Function

The bridge function connects payout math to the resolution service:

```typescript
interface PayoutEntry {
  position: Position;
  recipientPubkey: string;  // MUST exist — hard error if missing
  netSats: number;
  outcomeLabel: string;     // 'YES', 'NO', 'VOID'
}

function buildPayoutList(
  positions: Position[],
  outcome: 'YES' | 'NO' | 'VOID',
  outcomePrice: number
): PayoutEntry[] {
  return positions
    .map(pos => {
      // Hard error if no ownerPubkey (I7: no UUID fallback)
      if (!pos.ownerPubkey) {
        throw new Error(`Position ${pos.id} has no ownerPubkey — cannot deliver payout`);
      }

      const netSats = calculatePayout(pos, outcome, outcomePrice);
      if (netSats <= 0) return null; // Skip losers and zero payouts

      return {
        position: pos,
        recipientPubkey: pos.ownerPubkey,
        netSats,
        outcomeLabel: outcome,
      };
    })
    .filter(Boolean) as PayoutEntry[];
}
```

## Payout Delivery

Token delivery uses the existing vault/wallet infrastructure:

```typescript
async function sendPayoutTokens(recipientPubkey: string, sats: number): Promise<string> {
  // 1. Create Cashu token for amount
  const token = await wallet.send(sats, { pubkey: recipientPubkey });

  // 2. Self-verify token before marking as sent (I6: trust minimization)
  //    Verifies DLEQ proof per NUT-12 and token structure
  await wallet.receiveToken(token);

  // 3. Return token string for TX log
  return token;
}
```

## Vault Re-Check During Send Loop (B1/I5)

The send loop in `_executeResolution()` (see service-layer.md) re-checks vault balance every 15 iterations:

```
for i in payouts:
  if (i > 0 && i % 15 === 0):
    remainingObligation = sum of netSats for payouts[i..]
    if getVaultBalance() < remainingObligation:
      → abort, return { success: false, error: { kind: 'payout_partial', ... } }
      → market stays 'active' for retry
```

This protects against TOCTOU between the initial pre-check and actual sends, as well as other processes depleting the vault during the send loop.

## Partial Failure Recovery (B3)

### TX Entry State Machine

```
┌─────────┐    ┌─────────┐    ┌──────┐
│ pending  │───→│ sending  │───→│ sent │
└─────────┘    └─────────┘    └──────┘
                    │
                    ▼
               ┌─────────┐
               │ failed   │
               └─────────┘
```

### Recovery Flow

On retry (same market, same resolution):

1. Load TX log from `localStorage` key `cascade-tx-log:${marketSlug}`
2. For each entry:
   - `sent` → Skip (already delivered)
   - `failed` → Retry the send
   - `pending` → Process normally (was interrupted before attempt)
   - `sending` → Treat as `failed` (tab crashed mid-send)
3. Market transitions to `'resolved'` only when:
   - ALL entries are `'sent'`, OR
   - ALL remaining entries have `'failed'` with unrecoverable errors (e.g., recipient unreachable permanently)
4. If mix of `'sent'` and `'failed'`: market stays `'active'`, creator can retry

### Persisted TX Log

```typescript
// localStorage key: cascade-tx-log:${marketSlug}
// Value: JSON array of PayoutTxEntry (see service-layer.md for type)

function persistTxLog(marketSlug: string, entries: PayoutTxEntry[]): void {
  localStorage.setItem(`cascade-tx-log:${marketSlug}`, JSON.stringify(entries));
}

function loadTxLog(marketSlug: string): PayoutTxEntry[] {
  return JSON.parse(localStorage.getItem(`cascade-tx-log:${marketSlug}`) || '[]');
}
```

## Edge Cases

| Case | Behavior |
|---|---|
| No winners (e.g., YES resolution but no YES positions) | Resolution succeeds, no payouts, market marked 'resolved' |
| Insufficient vault balance | Pre-check fails, return error before any sends, market stays 'active' |
| Partial send failure | Market stays 'active', TX log records partial state, retry resumes |
| No positions at all | Resolution succeeds, no payouts, market marked 'resolved' |
| Zero quantity position | `calculatePayout` returns 0, position skipped in payout list |
| Rounding (sub-sat amounts) | `Math.floor()` always rounds down; platform absorbs dust |
| Missing ownerPubkey | Hard error thrown — position data is corrupt, payout fails explicitly |
| VOID with no positions | Resolution succeeds, no payouts, market marked 'resolved' |

## Data Flow

```
Creator clicks "Resolve YES/NO/VOID"
  → resolveMarket(market, outcome, outcomePrice)
    → validate outcomePrice (0.0 or 1.0 for binary; ignored for VOID)
    → check NIP-09 deletion
    → publishResolutionEvent()
    → enqueueResolution()
      → dedup check (pendingMarketIds Set)
      → _executeResolution()
        → acquireResolutionLock() (multi-tab)
        → getVaultBalance() pre-check
        → buildPayoutList(positions, outcome, outcomePrice)
        → initialize TX log entries as 'pending'
        → sequential send loop:
            → re-check vault every 15 iterations
            → skip already-sent entries (retry)
            → sendPayoutTokens(pubkey, sats)
            → self-verify token
            → update TX entry: pending → sending → sent/failed
        → evaluate: all sent → 'resolved' / partial → 'active'
        → mark positions as settled
        → releaseResolutionLock()
```

## File Changes

### `src/lib/services/payoutCalculation.ts`
- **Action**: create
- **What**: `calculatePayout()`, `calculateTotalExpenditure()`, `buildPayoutList()`, `RAKE_FRACTION` constant
- **Why**: Pure math functions, no side effects, independently testable

### `src/lib/services/payoutDelivery.ts`
- **Action**: create
- **What**: `sendPayoutTokens()`, `persistTxLog()`, `loadTxLog()` — token delivery with self-verification and TX log persistence
- **Why**: Separates I/O (wallet + localStorage) from pure math

## Execution Order

1. **Create `payoutCalculation.ts`** — Pure functions: `calculatePayout`, `calculateTotalExpenditure`, `buildPayoutList`, `RAKE_FRACTION`. Verify: `npx tsc --noEmit` and unit tests pass.
2. **Create `payoutDelivery.ts`** — `sendPayoutTokens` with self-verification, `persistTxLog`, `loadTxLog`. Verify: `npx tsc --noEmit`.
3. **Wire into resolutionQueue** — Import payout functions into `_executeResolution`. Verify: `npx tsc --noEmit`.
4. **Test partial failure recovery** — Manually seed TX log with mixed states, trigger retry, verify correct behavior. Verify: unit tests for recovery flow pass.
