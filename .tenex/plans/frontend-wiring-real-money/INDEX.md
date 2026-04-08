# Frontend Wiring for Real Money Integration

## Context

Cascade Markets is a prediction market platform built on SvelteKit 2 / Svelte 5, using Cashu ecash via NDK wallet (`@nostr-dev-kit/wallet ^1.0.0`) and `@cashu/cashu-ts`. The frontend already has significant wallet infrastructure:

### What Already Exists (Wired)

| Component | File | Status |
|---|---|---|
| Wallet page with 4 tabs (deposit, send, receive, history) | `src/routes/wallet/+page.svelte` (~482 lines) | ✅ Built |
| Wallet store with Svelte 5 runes, mint URL config, proof persistence | `src/lib/walletStore.ts` (~195 lines) | ✅ Built |
| NDK wallet store with `loadOrCreateWallet()`, `createDeposit()`, `sendTokens()`, `sendP2PKTokens()`, `receiveToken()` | `src/walletStore.ts` (~195 lines) | ✅ Built |
| Deposit service with NDKCashuDeposit, polling, callbacks | `src/services/depositService.ts` (~309 lines) | ✅ Built |
| Cashu proof management with keyset routing (LONG_/SHORT_ prefixes) | `src/lib/cashuProofs.ts` (~329 lines) | ✅ Built |
| Trading service with LMSR pricing, position recording | `src/services/tradingService.ts` (~273 lines) | ✅ Built |
| Settlement service with `withdrawToLightning()` | `src/services/settlementService.ts` | ✅ Built |
| WalletWidget for nav balance display | `src/lib/components/WalletWidget.svelte` | ✅ Built |
| QR code display for deposit invoices | Wallet page deposit tab | ✅ Built (external API) |

### What Needs Building or Fixing

1. **Production mint URL** — Currently falls back to `'https://mint.minibits.cash/Bitcoin'` (testnet). `mintDiscoveryService.ts` has a `'https://mint.example.com'` TODO placeholder.
2. **Lightning withdrawal UI** — "Withdraw" tab is labeled "Send tokens" and only produces encoded Cashu tokens. No UI to pay a Lightning invoice (melt) or withdraw to Lightning address.
3. **QR code reliability** — Uses external API (`api.qrserver.com`), which is unreliable for production. The `qrcode` npm package IS in package.json and imported but the wallet page uses the external URL approach.
4. **Deposit status UX** — Manual "Refresh status" button instead of real-time polling/WebSocket.
5. **NIP-60 wallet persistence** — `walletStore.ts` creates NIP-60 wallet events (kind 37375) via NDK but `src/lib/walletStore.ts` stores proofs in localStorage only. Two wallet stores exist with overlapping concerns.
6. **Error handling** — No recovery for failed mints, expired invoices, network errors. No confirmation dialogs for real-money operations.
7. **Transaction history** — Only tracks deposits. Missing withdrawals and trade history.
8. **Fee transparency** — `cashuProofs.ts` calculates 1% rake but fees aren't shown in the UI during trades.
9. **Invoice expiry** — `TradeReceipt` has `expires_at` field but no countdown or expiry warning in UI.
10. **Dual wallet store** — `src/lib/walletStore.ts` and `src/walletStore.ts` have overlapping functionality, creating confusion about which is canonical.

### Key Technical Details

- **Mint URL config**: `src/walletStore.ts` reads `import.meta.env.VITE_CASCADE_MINT_URL || VITE_CASHU_MINT_URL || 'https://mint.minibits.cash/Bitcoin'`
- **NDK wallet**: `NDKCashuWallet.create(ndk, [mintUrl], relays)` creates/loads wallet, `wallet.deposit(amount, targetMint)` returns `NDKCashuDeposit`
- **Deposit flow**: `NDKCashuDeposit.start()` emits status events; `depositService.ts` polls at 3s intervals
- **Proof storage**: `localStorage` keys `cascade_mint_url` and `cascade_wallet_proofs`
- **Relay list**: `['wss://relay.damus.io', 'wss://relay.primal.net', 'wss://nos.lol']`

## Approach

**Strategy: Consolidate, then enhance.** Rather than building new components from scratch, consolidate the two wallet stores into a single source of truth, fix the existing deposit flow for production reliability, and add the missing Lightning withdrawal UI.

### Why This Approach

The existing code covers ~70% of what's needed. The biggest risk is the dual wallet store creating state inconsistencies. Consolidating first prevents bugs where one store shows a balance the other doesn't recognize. After consolidation, enhancements (better QR, auto-polling, withdrawal UI) can be layered cleanly.

### Alternatives Considered

1. **Full rewrite of wallet page** — Rejected. Too much working code already exists. Risk of introducing regressions.
2. **Keep both wallet stores, add adapter** — Rejected. Adds complexity. One canonical store is simpler to maintain and debug.
3. **Build withdrawal as separate page** — Rejected. Existing tab structure works well. Adding Lightning withdrawal as a sub-option within the existing withdraw tab maintains UI consistency.

## Section Overview

| Section | File | Scope |
|---|---|---|
| Wallet Store Consolidation | `01-wallet-store-consolidation.md` | Merge dual stores, production mint config, NIP-60 persistence |
| Deposit Flow Production-Ready | `02-deposit-flow.md` | QR reliability, auto-polling, invoice expiry, error handling |
| Withdraw Flow & Lightning | `03-withdraw-flow.md` | Lightning withdrawal UI, fee display, confirmation dialogs, history |

## Cross-Section Dependencies

Sections MUST be executed in order:
1. **Section 01** (store consolidation) must complete first — Sections 02 and 03 depend on the unified store API.
2. **Section 02** (deposit) and **Section 03** (withdraw) can proceed in parallel after Section 01, but Section 02 is recommended first since deposit is the entry point for users.

## Verification

After all sections are complete:

1. `npm run build` — No TypeScript errors, clean build
2. `npm run check` — Svelte check passes
3. Manual flow test:
   - Configure production mint URL via env var
   - Create deposit → verify QR displays locally (no external API call)
   - Verify auto-polling detects payment
   - Withdraw to Lightning invoice → verify melt completes
   - Check transaction history shows deposit + withdrawal
4. Verify no references remain to `api.qrserver.com` or `mint.example.com`
5. Verify `src/lib/walletStore.ts` is removed (consolidated into `src/walletStore.ts`)
