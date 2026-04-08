# Section 04: Production Hardening — Error Handling, Mint Health, and UX Safety

## Overview

This section covers the cross-cutting concerns that make the wallet safe for real money: error handling, mint connectivity monitoring, wallet state persistence, transaction history, and UX safeguards that prevent users from losing funds. These changes apply across multiple files and build on top of the work in Sections 01–03.

## Current State

**What exists today:**
- Minimal error handling — most operations catch errors and display a generic message string
- No mint health monitoring — if the mint is down, users discover it when an operation fails
- Transaction history only tracks deposits in `localStorage` — no unified history across deposit/send/receive/withdraw
- No confirmation dialogs for destructive operations
- No copy-to-clipboard for invoices (users must manually select and copy)
- No invoice expiry display or countdown timer
- No protection against double-submit on slow operations
- QR codes generated via external API (`api.qrserver.com`) — unreliable for production, creates external dependency

**What needs building for production:**
1. Local QR code generation (remove external API dependency)
2. Unified transaction history across all operation types
3. Mint health indicator in the wallet UI
4. Invoice expiry countdown timer
5. Copy-to-clipboard for invoices and tokens
6. Confirmation dialogs for all money-moving operations
7. Structured error handling with user-friendly messages
8. Double-submit protection on all action buttons

## File Changes

### `src/lib/components/QRCode.svelte` (NEW)
- **Action**: create
- **What**: Local QR code generation component using the `qrcode` npm package (already in `package.json`):
  - Props: `data: string`, `size: number = 200`, `class: string = ''`
  - Uses `QRCode.toDataURL(data, { width: size, margin: 1, color: { dark: '#ffffff', light: '#00000000' } })` for white-on-transparent QR (fits dark theme)
  - Renders an `<img>` tag with the generated data URL
  - Shows a loading placeholder while generating
  - Error state: if generation fails, show "QR code unavailable" text with the raw data below it
- **Why**: The current external API (`api.qrserver.com`) is a reliability risk for production. QR code generation should be local and instant. The `qrcode` package is already a dependency.

### `src/lib/components/CopyButton.svelte` (NEW)
- **Action**: create
- **What**: Reusable copy-to-clipboard button:
  - Props: `text: string`, `label: string = 'Copy'`, `class: string = ''`
  - Uses `navigator.clipboard.writeText(text)` with fallback to `document.execCommand('copy')` for older browsers
  - Shows "Copied!" feedback for 2 seconds after successful copy, then reverts to label
  - Styling: `text-xs text-neutral-500 hover:text-neutral-300` — unobtrusive, doesn't compete with primary content
  - Emits `oncopied` event for parent components that need to track this
- **Why**: Users need to copy Lightning invoices, Cashu tokens, and transaction IDs. A consistent copy component avoids duplicating this logic across the wallet page.

### `src/lib/components/InvoiceExpiry.svelte` (NEW)
- **Action**: create
- **What**: Countdown timer for Lightning invoice expiry:
  - Props: `expiresAt: number` (unix timestamp), `onExpired: () => void`
  - Displays remaining time: "Expires in 9:42" (mm:ss format)
  - Color transitions: `text-neutral-400` when > 2 minutes, `text-amber-500` when 1–2 minutes, `text-rose-500` when < 1 minute
  - When expired: shows "Invoice expired" in `text-rose-500`, calls `onExpired()` callback
  - Uses `setInterval` with 1-second tick, cleaned up in `$effect` teardown
- **Why**: Lightning invoices expire (typically 10 minutes). Users need to know how much time they have and be clearly notified when an invoice expires so they don't send payment to a dead invoice.

### `src/lib/components/MintHealthIndicator.svelte` (NEW)
- **Action**: create
- **What**: Small status indicator showing mint connectivity:
  - Props: `mintUrl: string`, `pollInterval: number = 30000` (30 seconds)
  - On mount and every `pollInterval` ms, calls `GET ${mintUrl}/v1/info` (standard Cashu mint info endpoint)
  - States:
    - Connected: small green dot (`bg-emerald-500`) + "Mint online" tooltip
    - Degraded: yellow dot (`bg-amber-500`) + "Mint slow" tooltip (response > 5 seconds)
    - Disconnected: red dot (`bg-rose-500`) + "Mint offline" tooltip
    - Checking: pulsing neutral dot during initial check
  - Size: 8px dot, positioned inline with the mint URL display
  - When disconnected, disables deposit/withdraw buttons across the wallet (via a reactive `mintHealthy` state exported to parent)
- **Why**: Users need to know the mint is reachable before attempting operations. This prevents frustrating failures and potential edge cases where operations partially complete.

### `src/lib/components/ConfirmDialog.svelte` (NEW)
- **Action**: create
- **What**: Generic confirmation dialog for money-moving operations:
  - Props: `title: string`, `message: string`, `confirmLabel: string = 'Confirm'`, `cancelLabel: string = 'Cancel'`, `danger: boolean = false`, `onConfirm: () => void`, `onCancel: () => void`
  - Modal overlay: `fixed inset-0 z-50 bg-black/60 flex items-center justify-center`
  - Dialog: `bg-neutral-900 border border-neutral-800 p-6 max-w-sm w-full`
  - Confirm button: `bg-white text-black` (normal) or `bg-rose-600 text-white` (danger)
  - Cancel button: `text-neutral-400 hover:text-white`
  - Closes on Escape key, does NOT close on backdrop click (prevent accidental dismissal during money operations)
  - Traps focus within the dialog for accessibility
- **Why**: Every operation that moves real money needs explicit user confirmation. This is a shared component used by deposit, withdraw, and send flows.

### `src/lib/walletErrors.ts` (NEW)
- **Action**: create
- **What**: Structured error handling for wallet operations:
  
  ```typescript
  export type WalletErrorCode =
    | 'MINT_UNREACHABLE'
    | 'MINT_ERROR'
    | 'INSUFFICIENT_BALANCE'
    | 'INVOICE_EXPIRED'
    | 'INVOICE_INVALID'
    | 'LIGHTNING_ADDRESS_UNREACHABLE'
    | 'MELT_FAILED'
    | 'MINT_TOKENS_FAILED'
    | 'TOKEN_ALREADY_SPENT'
    | 'NETWORK_ERROR'
    | 'UNKNOWN';

  export class WalletError extends Error {
    code: WalletErrorCode;
    userMessage: string;
    recoverable: boolean;
  }
  ```
  
  - `WalletError` class extending `Error` with `code`, `userMessage` (human-friendly), and `recoverable` (boolean)
  - `classifyError(error: unknown): WalletError` — maps raw errors from `@cashu/cashu-ts` and NDK into typed wallet errors
  - Error code → user message mapping:
    - `MINT_UNREACHABLE`: "Unable to reach the mint. Please check your connection and try again."
    - `INSUFFICIENT_BALANCE`: "You don't have enough balance for this operation."
    - `INVOICE_EXPIRED`: "This invoice has expired. Please generate a new one."
    - `TOKEN_ALREADY_SPENT`: "These tokens have already been spent."
    - `MELT_FAILED`: "Withdrawal failed. Your balance has not been deducted."
    - etc.
  - `isRecoverableError(error: WalletError): boolean` — determines if the user can retry

- **Why**: Raw error messages from Cashu libraries are cryptic (e.g., "Token already spent" or HTTP error codes). Users need clear, actionable messages. The `recoverable` flag determines whether to show a "Try again" button.

### `src/lib/walletHistory.ts` (NEW)
- **Action**: create
- **What**: Unified transaction history manager:
  
  ```typescript
  export type TransactionType = 'deposit' | 'withdraw' | 'send' | 'receive' | 'trade';
  export type TransactionStatus = 'pending' | 'complete' | 'failed' | 'expired';
  
  export interface WalletTransaction {
    id: string;           // crypto.randomUUID()
    type: TransactionType;
    amount: number;        // sats
    fee?: number;          // sats
    status: TransactionStatus;
    timestamp: number;     // unix ms
    destination?: string;  // bolt11, Lightning address, or pubkey
    memo?: string;
    metadata?: Record<string, unknown>; // quote_id, preimage, etc.
  }
  ```
  
  - `addTransaction(tx: Omit<WalletTransaction, 'id'>): string` — adds a transaction, returns its ID
  - `updateTransaction(id: string, updates: Partial<WalletTransaction>): void` — update status, add metadata
  - `getTransactions(filter?: { type?: TransactionType, limit?: number }): WalletTransaction[]` — query with optional filters
  - `clearHistory(): void` — with confirmation requirement (pass `confirm: true`)
  - Persists to `localStorage` under `cascade_wallet_history`
  - Limits storage to 500 most recent transactions (LRU eviction)
  - Each transaction type gets a display icon and color in the UI

- **Why**: Currently deposit history is tracked separately and withdraw/send/receive have no history. Users need a single place to see all their wallet activity for reconciliation and debugging.

### `src/routes/wallet/+page.svelte` — Cross-cutting Changes
- **Action**: modify (in addition to Section 02 and 03 changes)
- **What**:
  
  **Replace External QR Code:**
  - Replace `https://api.qrserver.com/v1/create-qr-code/...` with the new `<QRCode data={bolt11} size={200} />` component
  - Apply in the deposit tab's invoice display
  
  **Add Copy Buttons:**
  - Add `<CopyButton text={invoice} />` next to the bolt11 invoice display
  - Add `<CopyButton text={encodedToken} />` next to the encoded Cashu token display in send flow
  
  **Add Invoice Expiry:**
  - In the deposit tab, after the QR code display, add `<InvoiceExpiry expiresAt={deposit.expiresAt} onExpired={handleInvoiceExpired} />`
  - `handleInvoiceExpired()`: update deposit status to 'expired', show "Invoice expired" message, enable "Create new invoice" button
  
  **Add Mint Health:**
  - Add `<MintHealthIndicator mintUrl={currentMintUrl} />` in the wallet header area, next to the balance display
  - Bind `mintHealthy` state from the indicator
  - Conditionally disable deposit/withdraw buttons when `!mintHealthy`
  - Show subtle warning: "Mint unreachable — operations disabled" below balance when disconnected
  
  **Add Confirmation Dialogs:**
  - Wrap deposit confirmation (after invoice is paid): "Confirm deposit of X sats?"
  - Wrap withdraw execution: show `WithdrawConfirmation` (from Section 03)
  - Wrap send tokens: "Send X sats? This cannot be undone."
  
  **Unified History Tab:**
  - Replace the current deposits-only history with a unified list from `walletHistory.ts`
  - Each entry shows: type icon, amount (font-mono), status badge, destination (truncated), timestamp
  - Filter tabs within history: All | Deposits | Withdrawals | Sends | Receives
  - Styling: `divide-y divide-neutral-800`, items `py-3`
  
  **Double-Submit Protection:**
  - Every action button should be disabled while its operation is in flight
  - Use a reactive `isOperationInFlight` state that's true during any async wallet operation
  - Show spinner/loading state on the active button

- **Why**: These are the UX safety features that separate a toy wallet from a production wallet. Each one prevents a specific class of user error or frustration.

### `src/lib/components/WalletWidget.svelte`
- **Action**: modify
- **What**:
  - Add a small mint health dot (2px) next to the balance display — green/red only (simplified version of MintHealthIndicator)
  - If mint is unhealthy, show balance with `text-neutral-600` (dimmed) and tooltip "Mint offline"
  - Ensure balance updates after any wallet operation via the reactive wallet store from Section 01
- **Why**: The nav wallet widget is the most-seen wallet surface. A health indicator there provides ambient awareness of mint status.

## Execution Order

1. **Create `walletErrors.ts`** — Define error types and classification. This is a pure utility with no dependencies. Verify: TypeScript compiles, error classification covers common Cashu errors.

2. **Create `walletHistory.ts`** — Define transaction types and localStorage persistence. Verify: unit-testable — add/update/query transactions, check localStorage persistence.

3. **Create `QRCode.svelte`** — Local QR generation component. Verify: renders a scannable QR code for a test bolt11 string. Check it renders white-on-transparent on the dark theme.

4. **Create `CopyButton.svelte`** — Copy-to-clipboard component. Verify: clicking copies text, shows "Copied!" feedback.

5. **Create `InvoiceExpiry.svelte`** — Countdown timer. Verify: counts down correctly, fires callback on expiry, shows color transitions.

6. **Create `MintHealthIndicator.svelte`** — Mint health polling component. Verify: shows green dot when mint responds, red when unreachable, exports `mintHealthy` state.

7. **Create `ConfirmDialog.svelte`** — Confirmation modal. Verify: renders, traps focus, closes on Escape, doesn't close on backdrop click.

8. **Integrate all into `+page.svelte`** — Replace external QR, add copy buttons, add expiry timer, add mint health, add confirmation dialogs, replace history tab, add double-submit protection.

9. **Update `WalletWidget.svelte`** — Add mini health indicator.

10. **Full integration test:**
    - Start the app, verify wallet page renders with all new components
    - Check QR code generates locally (no external API calls in Network tab)
    - Verify copy buttons work
    - Verify mint health indicator reflects actual mint status
    - Verify history tab shows unified transaction list
    - `npm run build && npm run check` passes

## Verification

**Build verification:**
```bash
npm run build
npm run check
```

**Manual checks:**
- No network requests to `api.qrserver.com` (check browser Network tab)
- QR codes render on dark background (white modules, transparent background)
- Copy buttons show feedback on click
- Invoice expiry timer counts down in real time
- Mint health dot reflects actual connectivity (test by disconnecting network)
- Confirm dialogs appear before every money-moving operation
- All buttons disabled during operations (no double-clicks possible)
- Transaction history persists across page reloads
- History shows correct icons and colors for each transaction type

**Edge cases:**
- QR code with very long data (large bolt11 invoices) — should still render, may need higher error correction
- Clipboard API denied (some browsers/contexts) — fallback to `document.execCommand('copy')` works
- Invoice expires while user is away — on return, shows "expired" state, not stale "pending"
- Mint health check during mint restart — should recover to "connected" within one poll interval
- localStorage full (unlikely but possible) — history should gracefully degrade, not crash the wallet
