# Section 02: Deposit Flow — Invoice Generation, QR Codes, Real-Time Status

## Overview

Harden the existing deposit flow for production use. The deposit UI and service layer already exist and work. The changes focus on: replacing the external QR API with a local library, adding real-time status updates, displaying invoice metadata (expiry, fees), and adding confirmation/safety UX for real money.

## Current State

**What works today:**
- Deposit tab in `src/routes/wallet/+page.svelte` with amount input and "Create Invoice" button
- `depositService.ts` creates `NDKCashuDeposit`, calls `.start()`, polls at 3s intervals for status changes
- QR code generated via external API: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bolt11)}`
- Status badges with color coding (pending=yellow, paid=green, expired=red)
- After payment detected, calls `wallet.mintTokens(amount, quoteId)` to get proofs
- Deposit history stored in localStorage

**What needs fixing for production:**
1. External QR API is unreliable and a privacy leak (sends invoices to third-party server)
2. No invoice expiry countdown — user doesn't know when the invoice will expire
3. No copy-to-clipboard for the bolt11 invoice string
4. No fee information displayed before invoice creation
5. Status polling is manual ("Refresh status" button) rather than automatic
6. No amount validation beyond `min=1`
7. No confirmation step before creating an invoice

## File Changes

### `package.json`
- **Action**: modify
- **What**: Add `qrcode` package: `npm install qrcode @types/qrcode`. Note: `qrcode` is already imported in the wallet page (`import QRCode from 'qrcode'`) but is **not** in `package.json` dependencies — it may be a phantom dependency from a sub-package or the import may fail at runtime.
- **Why**: Local QR generation eliminates the external API dependency and the privacy issue of sending Lightning invoices to `api.qrserver.com`.

### `src/routes/wallet/+page.svelte` — Deposit Tab
- **Action**: modify
- **What**: Rewrite the deposit tab section (approximately lines 200-320 in the current file). Changes:

  **Amount Input Enhancement:**
  - Add minimum (1000 sats) and maximum (1,000,000 sats) validation with error messages
  - Display the equivalent USD value using the existing price feed (if available) or omit if not
  - Add preset amount buttons: 5k, 10k, 50k, 100k sats — styled as `text-sm font-medium text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1`
  
  **Confirmation Step:**
  - After clicking "Create Invoice", show a confirmation panel before actually creating it:
    - Amount in sats
    - Mint URL (abbreviated, e.g., `mint.cascade.market`)
    - "Confirm" and "Cancel" buttons
  - This prevents accidental invoice creation
  
  **QR Code — Local Generation:**
  - Replace `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(bolt11)}` with:
    ```ts
    import QRCode from 'qrcode';
    const qrDataUrl = await QRCode.toDataURL(bolt11, { 
      width: 256, 
      margin: 2,
      color: { dark: '#ffffff', light: '#0a0a0a' } // white on neutral-950
    });
    ```
  - Render as `<img src={qrDataUrl} alt="Lightning invoice QR code" class="mx-auto" />`
  
  **Invoice Display:**
  - Show the bolt11 string in a truncated monospace field: `font-mono text-xs text-neutral-400 truncate`
  - Add a "Copy Invoice" button that copies the full bolt11 to clipboard using `navigator.clipboard.writeText()`
  - Show copy success feedback: briefly change button text to "Copied!" for 2 seconds
  
  **Expiry Countdown:**
  - Extract `expiry` from the mint quote response (or parse from bolt11 if not directly available)
  - Display a countdown timer: "Expires in 9:42" using `setInterval` that ticks every second
  - When < 60 seconds remaining, change text color to `text-rose-400`
  - When expired, show "Invoice expired" badge and disable the QR code (overlay or dim)
  - Auto-clear the deposit state when expired
  
  **Auto-Polling:**
  - Replace the manual "Refresh status" button with automatic polling
  - Use `depositService`'s existing 3s polling interval — it already supports this via `onStatusChange` callback
  - Wire the callback to update the reactive `currentDeposit` state
  - Show a subtle "Checking payment..." indicator (pulsing dot or spinner) while polling
  - On payment confirmation, show a success state with the amount credited and auto-switch to the balance view after 3 seconds

- **Why**: Every change addresses a production gap. Users sending real sats need confidence: they need to know when invoices expire, easily copy them to external wallets, and see real-time confirmation without manually refreshing.

### `src/services/depositService.ts`
- **Action**: modify  
- **What**:
  - Add invoice metadata extraction: after `NDKCashuDeposit.start()`, capture and return `{ bolt11, quoteId, expiresAt, amount }`
  - If `expiresAt` is not directly available from the NDK deposit object, parse the bolt11 invoice to extract the expiry timestamp (bolt11 invoices encode expiry in the tagged fields)
  - Add `cancelDeposit(quoteId: string)` — cleans up the active deposit tracking for a given quote, stops polling
  - Ensure the `onPaymentReceived` callback is always wired (currently optional) — in production, this MUST fire to trigger proof minting
  - Add error categorization: distinguish between `MINT_UNREACHABLE`, `INVOICE_EXPIRED`, `MINT_ERROR`, and `NETWORK_ERROR`
- **Why**: The deposit service is well-structured but needs metadata extraction for the UI to show expiry and needs better error classification for production error handling.

### `src/lib/components/DepositConfirmation.svelte` (NEW)
- **Action**: create
- **What**: Extract the deposit confirmation step into a standalone component:
  - Props: `amount: number`, `mintUrl: string`, `onConfirm: () => void`, `onCancel: () => void`
  - Displays amount, mint info, and two buttons
  - Styling follows existing patterns: `bg-neutral-900 border border-neutral-800 p-4`
- **Why**: Keeps the wallet page manageable and makes the confirmation step reusable if deposits are triggered from other contexts (e.g., inline during trading).

### `src/lib/components/InvoiceDisplay.svelte` (NEW)
- **Action**: create
- **What**: Reusable component for displaying a Lightning invoice with QR code:
  - Props: `bolt11: string`, `amount: number`, `expiresAt: number | null`, `status: 'pending' | 'paid' | 'expired'`
  - Contains: QR code image, truncated invoice text, copy button, expiry countdown, status badge
  - Handles its own countdown timer via `$effect` (Svelte 5 rune for lifecycle)
  - Emits `oncopy` event when invoice is copied
  - Uses `onDestroy` / cleanup to clear the countdown interval
- **Why**: Invoice display is complex enough to warrant its own component. Will also be reused in the trading flow where users may need to pay an invoice to fund a trade.

## Execution Order

1. **Install QR library** — `npm install qrcode` and verify `@types/qrcode` exists or add it. Run `npm run build` to confirm no conflicts.

2. **Create `InvoiceDisplay.svelte`** — Build the component with QR generation, copy-to-clipboard, countdown timer. Test in isolation by rendering it on a test page with a dummy bolt11 string.

3. **Create `DepositConfirmation.svelte`** — Simple confirmation panel. Verify styling matches project patterns.

4. **Update `depositService.ts`** — Add metadata extraction, `cancelDeposit()`, and error categorization. Ensure existing callbacks still work.

5. **Rewrite deposit tab in `+page.svelte`** — Integrate the new components. Wire the flow: amount input → confirmation → invoice display → auto-polling → success. Remove the external QR API URL entirely.

6. **Add amount validation** — Min 1000 sats, max 1,000,000 sats. Add preset buttons.

7. **Test end-to-end** — With `VITE_CASCADE_MINT_URL` pointed at a test mint:
   - Create a deposit, verify QR code renders locally
   - Verify invoice copy works
   - Verify countdown ticks and shows expiry warning
   - If possible, pay the invoice and verify auto-detection of payment
   - Verify expired invoice handling

8. **Verify build** — `npm run build && npm run check` passes with no errors.
