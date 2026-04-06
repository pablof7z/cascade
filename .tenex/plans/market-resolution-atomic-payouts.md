# Market Resolution: Atomic Redemption Payouts

## Context

Cascade's market resolution currently suffers from three fundamental problems:

1. **Wrong payout math.** `computeWinnerPayouts()` in `resolutionService.ts:115-131` computes payouts using `outcomePrice` (hardcoded to `1.0` for winners). Per Pablo's architecture clarification, payouts MUST use the LMSR fill price — the actual market price at time of redemption — not a flat 1.0.

2. **No idempotency.** `publishPayoutEvent()` at `nostrService.ts:548-611` never checks whether a payout event already exists. `fetchPayoutEvents()` exists (`nostrService.ts:616-625`) but is never called before publishing. The same position can be paid out multiple times.

3. **Batch-resolution architecture is wrong.** The current `_executeResolution()` (`resolutionService.ts:143-250`) iterates all winning positions and pays them in a loop. Pablo's corrected architecture: users request redemption individually, payouts are computed per-request using LMSR fill price, and each payout is atomic (succeed or fail, no partial).

### What Exists Today

| Component | Location | Status |
|-----------|----------|--------|
| LMSR price functions | `src/market.ts:277-288` | ✅ Working — `priceLong()`, `priceShort()`, `costFunction()` |
| Position type | `src/positionStore.ts:28-45` | ✅ Working — `direction: 'yes' \| 'no'`, `quantity`, `entryPrice` |
| Market type | `src/market.ts:140-167` | ✅ Working — `status`, `resolutionOutcome`, `qLong`, `qShort`, `b` |
| Vault token sending | `src/vaultStore.ts:187-217` | ⚠️ Works but returns token with no delivery mechanism |
| Payout event publishing | `src/services/nostrService.ts:548-611` | ⚠️ Publishes kind:30079 but no idempotency check |
| Resolution service | `src/services/resolutionService.ts` | ❌ Batch loop, flat 1.0 price, vault-limited — all wrong |
| Settlement service | `src/services/settlementService.ts:145-173` | ⚠️ Has `claimPositionPayout()` stub but incomplete |
| Mint endpoints | `cascade-mint/src/routes/` | ⚠️ No `/v1/melt` endpoint — users cannot withdraw |
| Kind:983/984 events | `tenex/docs/` only | ❌ Documented but not implemented |

### What This Plan Covers

**Scope:** Atomic single-user redemption flow only. Assumes the market is already resolved (status = `'resolved'`, `resolutionOutcome` set). Does NOT cover:
- How markets get resolved (admin action, oracle, etc.)
- UI for resolution admin panel
- Kind:983 trade event publishing
- Lightning withdrawal (`/v1/melt` endpoint)

## Approach

**Replace batch resolution with user-initiated atomic redemption.**

Each user requests redemption of their position independently. The system:
1. Validates the position and market state
2. Checks idempotency (has this position already been paid?)
3. Computes payout using LMSR fill price at redemption time
4. Sends Cashu tokens atomically
5. Publishes kind:30079 payout event (audit trail + idempotency record)

### Why This Approach

**User-initiated vs batch:** Batch resolution requires iterating all positions and handling partial failures. User-initiated means each redemption is independent and atomic — no coordination, no partial state.

**LMSR fill price vs flat 1.0:** The LMSR price reflects actual market depth. If a market resolved YES and the current `priceLong()` returns 0.92, redeemers get 0.92× their quantity — not 1.0×. This prevents paying out more liquidity than the market can support.

**"Insufficient depth" instead of "insufficient vault":** If the market's reserve cannot cover the computed payout, the redemption fails with `insufficient_depth`. This is an LMSR liquidity concept, not a vault-balance concept.

### Atomicity Model: Token-First, Event-Follows

The redemption flow uses **eventual consistency with token-first, event-follows recovery** — not two-phase commit. The committed action is the token send (step 4). Once tokens are delivered to the recipient, the payout is finalized regardless of whether the kind:30079 event publishes successfully. If event publishing (step 5) fails, a retry queue handles eventual publish. This is safe because the Cashu layer prevents double-spend: vault proofs consumed during token send cannot be reused, so a second payout attempt for the same position will fail at the mint level even without the Nostr event record. This design prioritizes delivery over audit trail — tokens may be delivered before the event is published on relays.

### Alternatives Rejected

- **Batch resolution with retry queue:** Adds complexity (partial state, retry logic) for no benefit. Pablo explicitly rejected retry logic.
- **Vault pre-reservation:** Removed. Payouts are LMSR-price-limited, not vault-limited. The market's mathematical reserve determines payable amounts.
- **Queued/async payouts:** Unnecessary. Each redemption is a single atomic operation — compute price, send tokens, publish event. No reason to queue.

## Data Model

### Kind:30079 Payout Event (Revised)

The existing kind:30079 structure at `nostrService.ts:548-611` needs revision. Current d-tag includes a timestamp, making idempotency checks unreliable (same position can generate different d-tags). The revised structure uses position-scoped d-tags.

```
Kind: 30079 (parameterized replaceable)
d-tag: cascade:payout:<marketSlug>:<positionId>

Tags:
  ['d', 'cascade:payout:<marketSlug>:<positionId>']
  ['c', 'cascade']
  ['market', '<marketSlug>']
  ['position', '<positionId>']
  ['redeemer', '<redeemerPubkey>']
  ['direction', 'yes' | 'no']
  ['quantity', '<quantity>']
  ['entry-price', '<entryPrice>']
  ['fill-price', '<lmsrFillPrice>']       # LMSR price at redemption
  ['payout-sats', '<netPayoutSats>']
  ['rake-sats', '<rakeSats>']
  ['gross-sats', '<grossPayoutSats>']
  ['outcome', 'YES' | 'NO']

Content: JSON {
  marketTitle: string,
  outcome: 'YES' | 'NO',
  fillPrice: number,
  grossSats: number,
  rakeSats: number,
  netSats: number,
  redeemedAt: number   // unix timestamp
}
```

**Key change:** The d-tag is `cascade:payout:<marketSlug>:<positionId>` — no timestamp. NIP-33 replaceable means if a second kind:30079 event with the same d-tag is published, relays keep only the latest. We use this to our advantage: the initial event can be published with a `pending` status (if we choose to publish before token send for audit purposes), and then replaced with a `completed` status after tokens are sent. The `completed` event supersedes the `pending` one on all NIP-33-compliant relays.

**Recovery for orphaned pending events:** If a `pending` event is published but the `completed` event publish fails (e.g., network interruption after token send), the `pending` event remains on relays with no corresponding completion. Recovery options: publish the `completed` replacement via the localStorage retry queue (see Edge Case handling below), or manually delete the orphaned event via NIP-09. For MVP, we accept this edge case — an orphaned `pending` event does not block the user (they already received tokens) and does not enable double-pay (proofs are consumed). For production, implement a background reconciliation job that scans for stale `pending` events older than a threshold and publishes their `completed` replacements.

### Position Validation Requirements

A position is redeemable when ALL conditions hold:
1. `market.status === 'resolved'`
2. `market.resolutionOutcome` is set (`'YES'` or `'NO'`)
3. `position.direction` matches outcome (`'yes'` ↔ `'YES'`, `'no'` ↔ `'NO'`)
4. `position.settled !== true`
5. No existing kind:30079 event with d-tag `cascade:payout:<marketSlug>:<positionId>`

### Payout Computation

```
fillPrice = market outcome is YES ? priceLong(qLong, qShort, b) : priceShort(qLong, qShort, b)
grossSats = Math.floor(position.quantity * fillPrice)
rakeSats  = Math.floor(grossSats * RAKE_FRACTION)    // RAKE_FRACTION = 0.02
netSats   = grossSats - rakeSats

if (netSats > market.reserve) → fail with 'insufficient_depth'
if (netSats <= 0) → fail with 'zero_payout'
```

## Redemption Flow

### Step-by-step atomic flow

```
User clicks "Redeem" on a resolved position
        │
        ▼
┌─────────────────────────────┐
│  1. VALIDATE                │
│  ─ Market status='resolved' │
│  ─ Outcome matches direction│
│  ─ Position not settled     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  2. IDEMPOTENCY CHECK       │
│  ─ Query kind:30079 with    │
│    d-tag filter for this    │
│    market + position        │
│  ─ If found → FAIL:         │
│    'already_redeemed'       │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  3. COMPUTE PAYOUT          │
│  ─ fillPrice from LMSR      │
│  ─ grossSats, rakeSats,     │
│    netSats                  │
│  ─ If netSats > reserve     │
│    → FAIL: 'insufficient    │
│    _depth'                  │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  4. SEND TOKENS             │
│  ─ sendPayoutTokens(        │
│    pubkey, netSats)         │
│  ─ If fails → FAIL:         │
│    'token_send_failed'      │
│  ─ No retry, no partial     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  5. PUBLISH PAYOUT EVENT    │
│  ─ kind:30079 with revised  │
│    structure                │
│  ─ Marks position as paid   │
│    (audit + idempotency)    │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│  6. UPDATE LOCAL STATE      │
│  ─ position.settled = true  │
│  ─ Update positionStore     │
│  ─ Deduct from market       │
│    reserve                  │
└─────────────────────────────┘
```

### Failure Modes

| Failure Point | State After Failure | Recovery |
|---------------|-------------------|----------|
| Step 1 (validate) | No mutation | User sees error, can retry when conditions met |
| Step 2 (idempotency) | No mutation | User informed they already redeemed |
| Step 3 (compute) | No mutation | User sees error — market lacks depth or zero payout |
| Step 4 (token send) | No mutation | User sees error, can retry — tokens weren't sent |
| Step 5 (publish event) | **Tokens sent but event not published** | This is the only dangerous failure. See edge case handling below. |
| Step 6 (local state) | Tokens sent, event published | Cosmetic only — next page load will fetch event and reconcile |

### Edge Case: Step 5 Failure (Event Publish After Token Send)

If tokens are sent (step 4 succeeds) but the kind:30079 event fails to publish (step 5), the user has received tokens but there's no on-chain record. Handling:

1. **Retry event publishing** (this is NOT retry of the payout — tokens are already sent). Attempt to publish the kind:30079 event up to 3 times with exponential backoff.
2. **Log to localStorage** as `pendingPayoutEvents` — a recovery list of events that need publishing. On next app load, attempt to publish any pending events.
3. **If all retries fail:** The user has their tokens (good) but the idempotency record is missing. The next redemption attempt will succeed the idempotency check (no event found) but `sendPayoutTokens()` will fail because vault proofs are already consumed. This is safe — the failure mode is "user cannot redeem twice" not "user gets paid twice."

**Note:** This retry is for event publishing only, never for token sending. Token sending is strictly atomic: succeed or fail once.

## Idempotency Mechanism

### Pre-Redemption Check

Before computing any payout, query for existing kind:30079 events:

```typescript
async function hasBeenRedeemed(marketSlug: string, positionId: string, ndk: NDK): Promise<boolean> {
  const filter: NDKFilter = {
    kinds: [30079],
    '#d': [`cascade:payout:${marketSlug}:${positionId}`],
    '#c': ['cascade']
  }
  const events = await ndk.fetchEvents(filter)
  return events.size > 0
}
```

### Why This Is Sufficient

1. **NIP-33 replaceable events:** Even if two kind:30079 events with the same d-tag are published, relays keep only the latest. The d-tag is position-scoped (no timestamp), so the same position always maps to the same d-tag.

2. **Local `settled` flag:** `position.settled = true` provides a fast local check before querying relays. The relay check is the authoritative guard.

3. **Mint proof consumption = natural guard:** Even if the idempotency check somehow fails (relay doesn't have the event yet), the first payout already consumed proofs from the vault's pool via the mint's `/v1/swap` endpoint. If the vault's remaining balance is insufficient for a second payout of the same amount, `sendPayoutTokens()` will fail. Note: Cashu proofs are fungible — they are not tied to specific positions. Layers 1 and 2 are the primary guards; Layer 3 (Cashu) is the cryptographic backstop. See Three-Layer Defense below for full explanation.

### Three-Layer Defense Against Double-Pay

The system uses three independent layers to prevent the same position from being paid out twice. Each layer operates on different data and provides a different level of certainty:

| Layer | Mechanism | Speed | Certainty |
|-------|-----------|-------|-----------|
| 1. Local | `position.settled === true` flag in localStorage | Instant | Best-effort (localStorage can be cleared by user) |
| 2. Nostr | kind:30079 event published to relays | ~1-3s relay query | High (relay-dependent; event may not have propagated) |
| 3. Cashu | Mint proof consumption via `/v1/swap` (NUT-03) | At token-send time | Absolute (cryptographic, non-reversible) |

**Critical clarification on Layer 3:** The Cashu layer is the final, absolute guard — but it works differently than Layers 1 and 2. When `sendPayoutTokens()` executes, it calls the mint's `/v1/swap` endpoint. This consumes the vault's input proofs (the ecash backing this payout) at the mint level. Proof consumption is atomic and non-reversible — once the mint marks those proofs as spent, they cannot be used again by anyone.

A second attempt to pay the same position will fail at step 4 (token send) because the vault no longer holds sufficient unspent proofs to cover the payout. This is NOT because vault proofs are "tied" to a specific position or payout — Cashu proofs are fungible. It works because the first payout consumed proofs from the vault's pool, reducing the vault's total balance. If the vault had enough remaining balance from other deposits, a second payout could theoretically succeed at the Cashu layer alone. That's why Layers 1 and 2 are essential: they prevent the redemption flow from even reaching step 4 for an already-paid position.

**In practice, all three layers work together:** Layer 1 catches the common case instantly (user clicks Redeem twice). Layer 2 catches the case where localStorage was cleared or the user switches devices. Layer 3 is the cryptographic backstop that makes double-spend mathematically impossible at the protocol level, regardless of what Layers 1 and 2 report.

## Error Handling

### Error Types

Create a `RedemptionError` type to replace the existing `ResolutionError` pattern:

```typescript
type RedemptionErrorCode =
  | 'market_not_resolved'     // Market status !== 'resolved'
  | 'outcome_mismatch'        // Position direction doesn't match outcome
  | 'already_redeemed'        // Kind:30079 event found OR position.settled
  | 'insufficient_depth'      // netSats > market.reserve
  | 'zero_payout'             // Computed payout <= 0
  | 'token_send_failed'       // sendPayoutTokens() returned error
  | 'position_not_found'      // Position ID doesn't exist

type RedemptionError = {
  code: RedemptionErrorCode
  message: string             // User-facing message
  details?: Record<string, unknown>  // Debug info (fillPrice, netSats, etc.)
}
```

### User-Facing Error Messages

| Code | User Message |
|------|-------------|
| `market_not_resolved` | "This market hasn't been resolved yet." |
| `outcome_mismatch` | "Your position doesn't match the market outcome." |
| `already_redeemed` | "This position has already been redeemed." |
| `insufficient_depth` | "This market doesn't have enough liquidity for this redemption right now." |
| `zero_payout` | "No payout available for this position." |
| `token_send_failed` | "Failed to send tokens. Please try again." |
| `position_not_found` | "Position not found." |

### Error Surfacing

Current code logs errors to `console.error()` only — no toast, no error store. The redemption flow MUST surface errors to the user:

1. `redeemPosition()` returns `Promise<RedemptionResult>` (success with payout details, or error with `RedemptionError`)
2. The calling component displays errors via toast notification (use existing toast pattern if one exists, otherwise add a minimal one)
3. Success shows the payout amount and a confirmation message

## File Changes

### `src/services/redemptionService.ts`
- **Action:** Create
- **What:** New service encapsulating the entire atomic redemption flow. Exports:
  - `redeemPosition(market: Market, position: Position, ndk: NDK): Promise<RedemptionResult>`
  - `hasBeenRedeemed(marketSlug: string, positionId: string, ndk: NDK): Promise<boolean>`
  - `computeRedemptionPayout(market: Market, position: Position): RedemptionPayout`
  - Types: `RedemptionResult`, `RedemptionError`, `RedemptionErrorCode`, `RedemptionPayout`
- **Why:** Clean separation from the existing batch `resolutionService.ts`. The old service handles market resolution (setting status/outcome). This new service handles user-initiated token redemption. They are distinct concerns.

### `src/services/nostrService.ts`
- **Action:** Modify
- **What:**
  - Update `publishPayoutEvent()` (lines 548-611) to use the revised kind:30079 structure: position-scoped d-tag (`cascade:payout:<marketSlug>:<positionId>`), remove timestamp from d-tag, add `redeemer`, `fill-price`, `gross-sats` tags, remove `winner` tag nomenclature
  - Add `fetchPayoutEvent(marketSlug: string, positionId: string): Promise<NDKEvent | null>` — fetches a single payout event by d-tag for idempotency checks
  - Rename `winnerId` references to `redeemerId` throughout the payout event code
- **Why:** The d-tag change is critical for idempotency (timestamp-based d-tags defeat the purpose). Adding `fetchPayoutEvent()` enables the idempotency check. Renaming 'winner' to 'redeemer' per Pablo's terminology.

### `src/services/resolutionService.ts`
- **Action:** Modify
- **What:**
  - Remove the payout loop from `_executeResolution()` (lines 196-230). Resolution should ONLY set market status to `'resolved'` and record the outcome. It should NOT iterate positions or send tokens.
  - Remove `computeWinnerPayouts()` (lines 115-131) — replaced by `computeRedemptionPayout()` in the new service
  - Remove `reserveProofsForPayouts()` call (lines 158-173) — vault pre-reservation is no longer needed
  - Keep: market status update, outcome recording, resolution event publishing
- **Why:** Separates "resolving a market" (admin/oracle action) from "redeeming a position" (user action). These are now independent flows.

### `src/services/settlementService.ts`
- **Action:** Modify
- **What:**
  - Update `claimPositionPayout()` (lines 145-173) to delegate to `redemptionService.redeemPosition()` instead of its current incomplete implementation
  - Update `canRedeemPosition()` to include the idempotency check (query kind:30079)
  - Remove the hardcoded outcome-to-number mapping (lines 145-154 — `outcome === 0 || outcome === 1`) — use string-based `'YES'`/`'NO'` matching
- **Why:** `settlementService` is the existing entry point for user-initiated claims. It should delegate to `redemptionService` for the actual work, keeping it as a thin coordination layer.

### `src/positionStore.ts`
- **Action:** Modify
- **What:**
  - Add `markPositionSettled(positionId: string): void` — sets `settled = true` and persists to localStorage
  - Add `getRedeemablePositions(marketSlug: string, outcome: 'YES' | 'NO'): Position[]` — returns positions matching market + outcome direction that aren't settled
- **Why:** Clean accessors for the redemption flow. Avoids reaching into localStorage directly from the redemption service.

### `src/market.ts`
- **Action:** Modify
- **What:**
  - Export a `computeOutcomePrice(market: Market): number` convenience function that returns `priceLong()` or `priceShort()` based on `market.resolutionOutcome`. This wraps the existing `priceLong()`/`priceShort()` functions at lines 277-288 with the market's current `qLong`, `qShort`, and `b` values.
  - Add `deductFromReserve(market: Market, amount: number): Market` — returns updated market with reduced reserve after payout
- **Why:** Centralizes "given a resolved market, what's the fill price?" logic. Currently callers must manually choose between `priceLong`/`priceShort` and pass `q`/`b` values — error-prone.

### `src/vaultStore.ts`
- **Action:** Modify
- **What:**
  - Remove `reserveProofsForPayouts()` (line 219) — vault pre-reservation is no longer needed in the atomic model
  - **Update `sendPayoutTokens()` signature to accept `recipientPubkey`:** `sendPayoutTokens(amount: number, recipientPubkey: string): Promise<string | null>`. The `recipientPubkey` parameter MUST be passed through to `walletStore.sendTokens()` so that the token is delivered to the recipient via NIP-60 encrypted send. Without this, the function creates a token string but never delivers it to anyone — the current implementation's critical gap.
  - Update the internal call: `const memo = "Cascade payout → " + recipientPubkey.slice(0, 8) + "…"; const token = await sendTokens(amount, memo, recipientPubkey)` — the third argument enables recipient-targeted delivery.
  - Ensure `sendPayoutTokens()` returns a clear error message when proofs are insufficient (currently returns generic `{ success: false }`)
  - **Implementation validation:** If `NDKCashuWallet.send()` does not support a `recipientPubkey` parameter for NIP-60 encrypted delivery, this is a critical gap that must be resolved before implementation. Check NDK wallet API for `send()` or `sendTo()` methods that accept a target pubkey.
- **Why:** Pre-reservation was for the batch model. In atomic mode, each `sendPayoutTokens()` call either succeeds with available proofs or fails. The recipient parameter is essential — without it, tokens are created but never delivered.

### Implementation Assumption: Mint Swap Operation

When `walletStore.sendTokens(amount, memo, recipientPubkey)` is called during step 4 of the redemption flow, the following operations MUST occur at the Cashu protocol level:

1. **Load vault proofs (input):** The wallet selects unspent Cashu proofs from the vault's proof set totaling at least `amount` sats.
2. **Call mint's `/v1/swap` endpoint (NUT-03):** The wallet sends the selected input proofs to the mint and receives new blinded output proofs. Input: vault's existing proofs. Output: new proofs for the recipient (blinded by the recipient's key or an intermediary key).
3. **Mint signs outputs:** The mint validates the input proofs are unspent, marks them as consumed (atomic, non-reversible), and signs the blinded outputs to create new valid proofs.
4. **Create token string:** The new proofs are serialized into a Cashu token string (NUT-00 format).
5. **Deliver token to recipient:** The token is sent to `recipientPubkey` via NIP-60 encrypted send (the token is wrapped in a NIP-04 or NIP-44 encrypted message to the recipient's pubkey).
6. **Vault proofs consumed:** The input proofs are now permanently spent at the mint. Any subsequent attempt to use them in a swap will be rejected by the mint.

This entire flow is the responsibility of `NDKCashuWallet.send()` (or equivalent NDK wallet method). The redemption service does NOT interact with the mint directly — it calls the wallet abstraction, which handles proof selection, swapping, and delivery.

**Critical dependency:** If NDK's wallet implementation bypasses the mint swap (e.g., constructs tokens from existing proofs without calling `/v1/swap`), the token would contain proofs that are still marked as unspent at the mint. The recipient could spend them, but so could the vault — breaking the double-spend guarantee. The implementation MUST verify that `NDKCashuWallet.send()` calls `/v1/swap` under the hood.

**Pre-implementation validation checklist:**
- [ ] Confirm `NDKCashuWallet.send()` accepts a `recipientPubkey` parameter for NIP-60 delivery
- [ ] Confirm `NDKCashuWallet.send()` calls the mint's `/v1/swap` endpoint (NUT-03) internally
- [ ] Confirm input proofs are consumed atomically at the mint after swap
- [ ] Confirm the token delivery mechanism (NIP-60 encrypted send vs. alternative) matches Cascade's wallet architecture

### UI Component (redemption trigger)
- **Action:** Create or modify (location TBD based on existing resolved-market UI)
- **What:**
  - A "Redeem" button visible on resolved positions where `position.direction` matches `market.resolutionOutcome`
  - Button calls `redeemPosition()` and displays result (success with amount, or error message)
  - Disabled states: already redeemed, wrong direction, market not resolved
  - Loading state during redemption (disable button, show spinner)
- **Why:** Users need a way to trigger redemption. The exact component depends on where resolved positions are displayed (market detail page, portfolio page, or both).

## Execution Order

### Phase 1: Data Layer

1. **Add `computeOutcomePrice()` to `src/market.ts`** — Wrap existing `priceLong()`/`priceShort()` with outcome-aware convenience function. Add `deductFromReserve()`. Verify by calling with test market values and confirming price matches manual LMSR calculation.

2. **Add position helpers to `src/positionStore.ts`** — Add `markPositionSettled()` and `getRedeemablePositions()`. Verify by writing unit tests that check settled flag persistence and filtering logic.

3. **Update kind:30079 event structure in `src/services/nostrService.ts`** — Change d-tag to position-scoped format, add `fetchPayoutEvent()`, rename winner→redeemer. Verify by publishing a test event and confirming d-tag format and tag structure match spec.

### Phase 2: Redemption Service

4. **Create `src/services/redemptionService.ts`** — Implement `redeemPosition()` with the full atomic flow: validate → idempotency check → compute payout → send tokens → publish event → update local state. Include all error types. Verify with unit tests covering happy path and each error case.

5. **Update `src/services/settlementService.ts`** — Wire `claimPositionPayout()` to delegate to `redemptionService.redeemPosition()`. Update `canRedeemPosition()` with idempotency query. Verify by calling through the settlement service and confirming it delegates correctly.

### Phase 3: Cleanup

6. **Strip payout loop from `src/services/resolutionService.ts`** — Remove lines 115-131 (`computeWinnerPayouts`), lines 158-173 (vault pre-reservation), and lines 196-230 (payout distribution loop). Keep market status update and resolution event publishing. Verify by running market resolution and confirming it only sets status without attempting payouts.

7. **Clean up `src/vaultStore.ts`** — Remove `reserveProofsForPayouts()`. Improve `sendPayoutTokens()` error messages. Verify `sendPayoutTokens()` returns descriptive errors for insufficient proofs.

### Phase 4: UI Integration

8. **Add redemption UI trigger** — Add "Redeem" button to resolved position display. Wire to `redeemPosition()`. Show success/error states. Verify by resolving a test market and clicking redeem — confirm tokens sent, event published, button disabled after redemption.

## Verification

### Automated Tests

- **Unit: `computeOutcomePrice()`** — YES outcome returns `priceLong()` value, NO outcome returns `priceShort()` value
- **Unit: `computeRedemptionPayout()`** — Correct gross/rake/net calculation for various fill prices and quantities
- **Unit: `hasBeenRedeemed()`** — Returns true when kind:30079 exists, false when it doesn't
- **Unit: Validation logic** — Each `RedemptionErrorCode` is triggered by its corresponding invalid state
- **Integration: Full redemption flow** — Mock NDK + vault, verify event published with correct structure, tokens sent with correct amount, position marked settled

### Manual Test Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| Happy path | Resolve market YES, redeem a YES position | Token sent, kind:30079 published, position marked settled |
| Already redeemed | Redeem same position twice | Second attempt: "already_redeemed" error |
| Wrong direction | Redeem a NO position on a YES-resolved market | "outcome_mismatch" error |
| Market not resolved | Try to redeem on active market | "market_not_resolved" error |
| Insufficient depth | Redeem when `netSats > market.reserve` | "insufficient_depth" error |
| Zero payout | Position with 0 quantity or fill price ≈ 0 | "zero_payout" error |
| Concurrent redemptions | Two users redeem different positions simultaneously | Both succeed independently (no shared state) |
| Event publish failure | Token send succeeds, event publish fails | Tokens delivered, event queued for retry, no double-pay possible |
| Local state cleared | Clear localStorage, try to redeem | Relay-based idempotency check still prevents double-pay |
