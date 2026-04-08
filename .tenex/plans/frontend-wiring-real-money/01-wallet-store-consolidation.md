# Section 01: Wallet Store Consolidation

## Overview

Merge the two overlapping wallet stores into a single canonical store, configure production mint URL, and ensure NIP-60 wallet persistence works correctly.

## Problem

Two wallet stores exist:

- **`src/walletStore.ts`** (~195 lines) — NDK-based, creates `NDKCashuWallet`, handles `createDeposit()`, `sendTokens()`, `sendP2PKTokens()`, `receiveToken()`, `loadOrCreateWallet()`. Reads mint URL from env vars. Stores wallet reference in a Svelte 5 rune (`$state`).
- **`src/lib/walletStore.ts`** (~195 lines) — localStorage-based, stores proofs directly, manages `cascade_wallet_proofs` and `cascade_mint_url` keys. Has its own balance calculation by summing proof amounts.

The wallet page (`src/routes/wallet/+page.svelte`) imports from BOTH stores, leading to potential state divergence where NDK wallet shows one balance and localStorage proofs show another.

## File Changes

### `src/walletStore.ts`
- **Action**: modify
- **What**: This becomes the single canonical wallet store. Add the missing functionality currently in `src/lib/walletStore.ts`:
  - Add `mintUrl` as a reactive `$state` variable initialized from `import.meta.env.VITE_CASCADE_MINT_URL || import.meta.env.VITE_CASHU_MINT_URL` with **no fallback to external mints**. If no env var is set, `mintUrl` is `null` and wallet operations are disabled.
  - Add a `walletReady` derived state that is `true` only when `wallet !== null && mintUrl !== null`
  - Add `getBalance()` that delegates to `NDKCashuWallet.balance` (the NDK wallet already tracks proofs internally)
  - Add `setMintUrl(url: string)` that persists to `localStorage('cascade_mint_url')` AND reconfigures the NDK wallet's mint list
  - Keep all existing NDK-based methods: `loadOrCreateWallet()`, `createDeposit()`, `sendTokens()`, `sendP2PKTokens()`, `receiveToken()`
  - Add `meltToLightning(invoice: string, amount: number)` — see Section 03 for details
  - Export a `transactions` reactive array for history tracking (deposits, withdrawals, trades)
- **Why**: Single source of truth eliminates state divergence. NDK wallet already manages proofs internally via NIP-60 events.

### `src/lib/walletStore.ts`
- **Action**: delete
- **What**: Remove entirely after migrating any unique functionality to `src/walletStore.ts`
- **Why**: Duplicate store with localStorage-only approach is incompatible with NIP-60 persistence.

### `src/routes/wallet/+page.svelte`
- **Action**: modify
- **What**: 
  - Replace all imports from `$lib/walletStore` with imports from the root `walletStore`
  - Remove any direct `localStorage` reads for proofs or balance — use store's reactive `balance` and `walletReady`
  - Add a "not configured" state when `mintUrl` is null: display a message like "Wallet not available — mint not configured" instead of showing broken deposit/withdraw forms
  - Remove the manual `balance` calculation that sums proof amounts (the store handles this)
- **Why**: Wallet page must use the single consolidated store.

### `src/lib/cashuProofs.ts`
- **Action**: modify
- **What**: 
  - Update imports to use the consolidated wallet store for mint URL
  - Remove any direct localStorage reads for `cascade_mint_url` — get it from the store
  - Keep the keyset-based proof routing logic (LONG_/SHORT_ prefixes) as-is — this is market-specific logic that belongs here
- **Why**: Proof management should read mint config from the canonical store, not its own localStorage key.

### `src/lib/components/WalletWidget.svelte`
- **Action**: modify
- **What**: 
  - Import balance from the consolidated `walletStore` instead of `$lib/walletStore`
  - Use the store's reactive `balance` state
- **Why**: Widget must show balance from the same source as the wallet page.

### `src/services/depositService.ts`
- **Action**: modify
- **What**: 
  - Import mint URL from the consolidated wallet store
  - Remove any hardcoded mint URL fallbacks
  - The service's core logic (NDKCashuDeposit creation, polling) remains unchanged
- **Why**: Deposit service must use the same mint URL as the rest of the app.

### `src/services/tradingService.ts`
- **Action**: modify
- **What**: 
  - Import from consolidated wallet store
  - Remove any direct references to `$lib/walletStore`
- **Why**: Trading service must operate against the same wallet state.

### `src/services/settlementService.ts`
- **Action**: modify
- **What**: 
  - Import from consolidated wallet store
  - Ensure `withdrawToLightning()` delegates to the store's new `meltToLightning()` method
- **Why**: Settlement must use consolidated store.

### `.env.example` (or `env.d.ts`)
- **Action**: modify
- **What**: 
  - Add `VITE_CASCADE_MINT_URL` with a comment: `# Required for production. No default — wallet disabled without this.`
  - Remove or comment out `VITE_CASHU_MINT_URL` to consolidate naming
- **Why**: Make it clear that a mint URL must be explicitly configured for production. No silent fallback to third-party mints.

### `src/services/mintDiscoveryService.ts`
- **Action**: modify
- **What**: 
  - Replace `'https://mint.example.com'` TODO placeholder with logic that reads from `VITE_CASCADE_MINT_URL` env var
  - Add mint info fetching: call `GET {mintUrl}/v1/info` to verify the mint is reachable and get its `name`, `version`, `nuts` (supported NUTs), and `pubkey`
  - Export a `verifyMintHealth()` function that checks mint connectivity
  - This service becomes the single place that validates and provides mint metadata
- **Why**: Mint discovery must work with the configured production mint, not a placeholder.

## Execution Order

1. **Audit all imports** — `grep -r` for both `walletStore` import paths across the entire codebase to identify every consumer. Document the full list before making changes.

2. **Extend `src/walletStore.ts`** — Add `mintUrl` state (env-var based, no fallback), `walletReady` derived, `getBalance()`, `setMintUrl()`, `transactions` array. Verify the file compiles: `npx tsc --noEmit src/walletStore.ts`.

3. **Update `mintDiscoveryService.ts`** — Replace placeholder, add `verifyMintHealth()`. Test with `VITE_CASCADE_MINT_URL` set to a known mint.

4. **Migrate consumers** — Update `WalletWidget.svelte`, `depositService.ts`, `tradingService.ts`, `settlementService.ts`, `cashuProofs.ts` to import from root `walletStore`. Each file: change import, verify no direct localStorage access for wallet state.

5. **Update wallet page** — Rewrite imports, add "not configured" guard, remove manual balance calc.

6. **Delete `src/lib/walletStore.ts`** — Remove the file. Run `npm run build` to verify no broken imports.

7. **Update env config** — Add `VITE_CASCADE_MINT_URL` to `.env.example` or equivalent.

8. **Verify** — `npm run build && npm run check` passes. Manually test: with env var unset, wallet page shows "not configured". With env var set, wallet initializes correctly.
