# Section 03: Withdraw Flow — Melt Tokens via Lightning

## Overview

Build the withdraw (melt) flow that lets users convert their Cashu token balance back to Lightning sats. The current wallet page has a withdraw tab with basic UI scaffolding but limited functionality. This section covers the complete withdraw UX: entering a Lightning address or bolt11 invoice, fee estimation, confirmation, and real-time melt status.

## Current State

**What exists today:**
- Withdraw tab in `src/routes/wallet/+page.svelte` with a text input for "Lightning Address or Invoice"
- An amount input field
- A "Withdraw" button that calls into the wallet service
- `withdrawService.ts` exists with `meltTokens(wallet, invoice, amount)` — wraps `NDKCashuWallet.meltTokens()`
- Basic success/error state display after melt attempt
- No fee estimation shown before confirming withdrawal
- No Lightning address resolution (only raw bolt11 invoices work)
- No confirmation step

**What needs building for production:**
1. Lightning address (LNURL) resolution to bolt11 invoice
2. Fee estimation display before confirming withdrawal
3. Confirmation step showing exact amount, fees, and destination
4. Real-time melt status tracking (pending → processing → complete/failed)
5. Input validation — detect whether input is bolt11 invoice, Lightning address, or invalid
6. Maximum withdrawal amount check against current balance
7. Partial withdrawal support (withdraw less than full balance)

## File Changes

### `src/services/withdrawService.ts`
- **Action**: modify
- **What**:
  
  **Add Lightning Address Resolution:**
  - Add `resolveLightningAddress(address: string, amountMsats: number): Promise<string>` 
  - Takes a Lightning address (user@domain.com format), fetches the LNURL metadata from `https://<domain>/.well-known/lnurlp/<user>`, then calls the callback URL with the amount to get a bolt11 invoice
  - Returns the bolt11 invoice string
  - Handle errors: domain unreachable, min/max amount out of range, invalid LNURL response
  
  **Add Input Detection:**
  - Add `detectInputType(input: string): 'bolt11' | 'lightning_address' | 'lnurl' | 'invalid'`
  - bolt11: starts with `lnbc` (mainnet) or `lntb`/`lntbs` (testnet)
  - Lightning address: matches `^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`
  - lnurl: starts with `lnurl1` (bech32-encoded)
  - Otherwise: invalid
  
  **Add Fee Estimation:**
  - Add `estimateMeltFee(wallet: NDKCashuWallet, invoice: string): Promise<{ fee: number, total: number }>`
  - Uses `wallet.meltQuote(invoice)` if available, or extracts the amount from the bolt11 and adds a configurable fee estimate
  - Returns `{ fee: estimatedFeeSats, total: amount + fee }`
  
  **Improve meltTokens:**
  - Add proper error categorization: `INSUFFICIENT_BALANCE`, `INVOICE_EXPIRED`, `MINT_ERROR`, `NETWORK_ERROR`, `FEE_EXCEEDED`
  - Return structured result: `{ success: boolean, preimage?: string, feePaid?: number, error?: { code: string, message: string } }`
  
  **Add Amount Extraction:**
  - Add `extractAmountFromBolt11(invoice: string): number | null` — parse the bolt11 to get the encoded amount in sats. This lets us auto-fill the amount field when a user pastes a bolt11 invoice.
  
- **Why**: The withdraw service needs to handle the full range of user inputs (not just raw bolt11) and provide fee information before the user commits to the withdrawal.

### `src/lib/components/WithdrawConfirmation.svelte` (NEW)
- **Action**: create
- **What**: Confirmation component shown before executing the melt:
  - Props: `amount: number`, `fee: number`, `destination: string`, `destinationType: 'bolt11' | 'lightning_address'`, `onConfirm: () => void`, `onCancel: () => void`
  - Displays:
    - "You're withdrawing" section: amount in sats (font-mono)
    - "Network fee" section: estimated fee in sats
    - "Total deducted" section: amount + fee (emphasized)
    - "Destination" section: abbreviated bolt11 or full Lightning address
    - Confirm button (styled with emphasis) and Cancel button
  - Styling: `bg-neutral-900 border border-neutral-800 p-5` — consistent with deposit confirmation
- **Why**: Users must see the total cost (amount + fees) before committing real money. No surprise deductions.

### `src/lib/components/WithdrawStatus.svelte` (NEW)
- **Action**: create
- **What**: Status tracking component for an in-progress withdrawal:
  - Props: `status: 'pending' | 'processing' | 'complete' | 'failed'`, `amount: number`, `fee: number | null`, `error: string | null`
  - Displays:
    - Pending: "Preparing withdrawal..." with spinner
    - Processing: "Melting tokens..." with animated progress indicator
    - Complete: success icon, "Withdrawn X sats" with fee paid, preimage display (truncated, copyable)
    - Failed: error icon, error message, "Try again" button (emits `onretry` event)
  - Styling: status-appropriate colors (neutral for pending, emerald for complete, rose for failed)
- **Why**: Melt operations can take a few seconds. Users need feedback that something is happening and clear indication of success/failure.

### `src/routes/wallet/+page.svelte` — Withdraw Tab
- **Action**: modify
- **What**: Rewrite the withdraw tab section. Changes:

  **Input Field Enhancement:**
  - Replace the plain text input with a smart input that detects input type on change
  - Show detected type as a badge next to the input: "Lightning Invoice" (blue) or "Lightning Address" (purple) or "Invalid" (red)
  - When a bolt11 invoice is pasted, auto-extract the amount and fill the amount field (disable amount field since bolt11 encodes the amount)
  - When a Lightning address is entered, keep the amount field enabled (user specifies amount)
  - Validate amount against current wallet balance: `if (amount + estimatedFee > balance) showError("Insufficient balance")`
  
  **Fee Estimation:**
  - After valid input + amount, automatically fetch fee estimate
  - Display below the inputs: "Estimated fee: ~X sats" in `text-xs text-neutral-500`
  - Show total: "Total: X sats (amount + fee)" in `text-sm text-neutral-300`
  
  **Flow:**
  1. User enters destination (bolt11 or Lightning address)
  2. User enters amount (or auto-filled from bolt11)
  3. Fee estimation fetched and displayed
  4. User clicks "Withdraw" → `WithdrawConfirmation` shown
  5. User confirms → melt executes → `WithdrawStatus` shown
  6. On success, balance auto-refreshes, status shown for 3 seconds, then form resets
  7. On failure, error shown with retry option
  
  **Withdraw History:**
  - After the active withdraw area, show recent withdrawals from localStorage
  - Each entry: amount, destination (truncated), timestamp, status badge
  - Format: compact list using `divide-y divide-neutral-800`

- **Why**: The withdraw flow has more edge cases than deposit (fee estimation, input type detection, amount from invoice). Each UX decision prevents real money mistakes.

### `src/stores/walletStore.ts`
- **Action**: modify (supplement to Section 01 changes)
- **What**: 
  - Add `withdrawHistory` state: `{ id, amount, fee, destination, status, timestamp }[]`
  - Persist to localStorage under `cascade_withdraw_history`
  - Add `addWithdrawRecord()` and `getWithdrawHistory()` methods
  - Add `refreshBalance()` method that forces a balance re-fetch from the NDK wallet
- **Why**: Withdraw history provides users with a record of their withdrawals. Balance refresh is needed after successful melts.

## Execution Order

1. **Add input detection and Lightning address resolution to `withdrawService.ts`** — Implement `detectInputType()`, `resolveLightningAddress()`, `extractAmountFromBolt11()`. These are pure functions that can be unit tested independently.

2. **Add fee estimation to `withdrawService.ts`** — Implement `estimateMeltFee()`. Test with a mock wallet if the test mint supports melt quotes.

3. **Improve `meltTokens()` error handling** — Add structured error responses and error categorization.

4. **Create `WithdrawConfirmation.svelte`** — Build the confirmation panel. Verify styling matches `DepositConfirmation.svelte`.

5. **Create `WithdrawStatus.svelte`** — Build the status tracking component with all four states.

6. **Add withdraw history to `walletStore.ts`** — Add the state, persistence, and methods.

7. **Rewrite withdraw tab in `+page.svelte`** — Integrate all new components. Wire the flow: input detection → amount → fee estimate → confirmation → melt → status → balance refresh.

8. **Test end-to-end:**
   - Enter a Lightning address, verify resolution works (if test environment supports it)
   - Enter a bolt11 invoice, verify amount auto-fill
   - Verify fee estimation displays
   - Verify confirmation shows correct total
   - Execute a withdrawal against test mint, verify balance updates
   - Verify error handling for insufficient balance, expired invoice

9. **Verify build** — `npm run build && npm run check` passes.

## Edge Cases to Handle

- **Bolt11 with no amount**: Some invoices don't encode an amount (zero-amount invoices). If detected, keep the amount field enabled and require user input.
- **Lightning address resolution failure**: Show clear error — "Could not reach payment server at domain.com" — not a generic error.
- **Fee higher than expected**: If the actual fee is significantly higher than the estimate, the melt will fail with insufficient proofs. Show "Fee exceeded estimate, please try again with a higher amount reserved for fees."
- **Double-withdrawal prevention**: Disable the withdraw button immediately on click, re-enable only on failure or form reset.
- **Balance race condition**: After a successful melt, the wallet balance from NDK may take a moment to update. Show "Balance updating..." briefly instead of stale balance.
