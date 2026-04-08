# Frontend Refactor Prerequisite for Phase 8

**Purpose**: Consolidate and clean up wallet/frontend state before wiring real money. The current state has fragmented stores, inconsistent patterns, and a disconnect between the wallet page and wallet widget. These must be fixed before Phase 8 begins.

**Approved by**: Pablo (proxy) — 2026-04-08
**Status**: READY FOR IMPLEMENTATION

---

## Problem Summary

1. **Two wallet stores doing the same job differently** — `src/walletStore.ts` (core) and `src/lib/walletStore.ts` (Svelte wrapper) with different defaults and access patterns
2. **Mint URL defined in 4 places with 3 different defaults** — `mint.minibits.cash/Bitcoin`, `mint.cascade.market`, `mint.example.com`
3. **Custom subscriber pattern instead of Svelte 5 `$state`** — manual `.subscribe()` / `.get()` pattern in 3 stores, requiring boilerplate `$effect()` in every consumer
4. **Deposit state in-memory only** — lost on refresh
5. **Wallet page bypasses the Svelte wrapper** — calls core `getWalletBalance()` directly while `WalletWidget` uses the wrapper → potential stale balance
6. **No Lightning withdrawal UI** — `settlementService.withdrawToLightning()` exists but has no user-facing component
7. **Testnet toggle broken** — `subscribe()` never removes subscribers; toggle doesn't affect mint URL
8. **Position store uses custom event emitter** — not integrated with Svelte reactivity

---

## Refactor Steps (in order)

### Step 1: Consolidate Mint URL Configuration
**Priority**: HIGH — foundation for everything else
**Files**: `src/walletStore.ts`, `src/services/depositService.ts`, `src/services/settlementService.ts`, `src/services/mintDiscoveryService.ts`

- Create a single `src/lib/config/mint.ts` that exports `MINT_URL`, `MINT_RELAYS`, and any other mint config
- All 4 files import from this single source
- Default: `VITE_CASCADE_MINT_URL || 'https://mint.cascade.market'` (self-hosted, per Phase 8 plan)
- Remove `mint.minibits.cash/Bitcoin` and `mint.example.com` defaults
- Testnet toggle should switch the mint URL

### Step 2: Migrate Stores to Svelte 5 `$state` Pattern
**Priority**: HIGH — eliminates boilerplate and bugs
**Files**: `src/lib/walletStore.ts`, `src/lib/stores/nostr.ts`, `src/lib/stores/testnet.ts`, `src/positionStore.ts`, `src/vaultStore.ts`

- Replace custom subscriber pattern with Svelte 5 `$state`-based stores
- Pattern: Use a class with `$state` properties, or use `$state` runes at module level
- Example:
  ```typescript
  // src/lib/stores/wallet.svelte.ts
  let balance = $state<number>(0);
  let mintUrl = $state<string>(MINT_URL);
  export function getBalance() { return balance; }
  export function setBalance(val: number) { balance = val; }
  ```
- All consumers can now use `$state` directly — no `.subscribe()` boilerplate
- Fix testnet.ts subscriber bug: `subscribe()` must actually remove subscribers (or better: eliminate the pattern entirely)
- `positionStore.ts`: Replace custom `CacheListener` event emitter with `$state` reactive state

### Step 3: Unify Wallet Access Paths
**Priority**: HIGH — eliminates stale balance risk
**Files**: `src/routes/wallet/+page.svelte`, `src/lib/components/WalletWidget.svelte`, any other consumers

- Wallet page (`+page.svelte`) currently imports directly from `src/walletStore.ts`
- WalletWidget imports from `src/lib/walletStore.ts`
- Unify to a single import path: the new `src/lib/stores/wallet.svelte.ts`
- Both should read from the same reactive state
- Remove the old `src/lib/walletStore.ts` wrapper (its 30-second polling is also wrong — should use NDK subscriptions instead)

### Step 4: Fix Deposit State Persistence
**Priority**: MEDIUM — deposits are lost on refresh
**Files**: `src/services/depositService.ts`

- `activeDeposits` Map is in-memory only (line 51)
- Migrate to NDK persistence (kind 30078 or similar) OR localStorage as a stopgap
- The NDK deposit itself persists (the invoice is on the mint), but tracking state (created, paid, confirmed) is lost
- Minimum: localStorage persistence for deposit tracking
- Better: NDK event-based persistence (aligns with Phase 8 real-money requirements)

### Step 5: Replace Balance Polling with NDK Subscriptions
**Priority**: MEDIUM — polling is fragile and wasteful
**Files**: `src/lib/walletStore.ts` (to be replaced), `src/walletStore.ts`

- Current: 30-second polling in `lib/walletStore.ts`
- Target: NDK subscription that watches for wallet update events (kind 31979)
- This aligns with the work already done on the discuss page (commit 0b11156) where polling was replaced with NDK subscriptions
- Balance should update reactively when the wallet receives tokens, not on a timer

### Step 6: Add Lightning Withdrawal UI
**Priority**: MEDIUM — needed for real money but not blocking for refactor
**Files**: New component in `src/routes/wallet/` or `src/lib/components/`

- `settlementService.withdrawToLightning()` exists but has no UI
- Add a "Withdraw" tab to the wallet page
- Flow: Enter Lightning invoice → confirm amount → submit → wait for confirmation
- Follow style guide: no emojis, no rounded pills, emerald/rose accents only, neutral colors

### Step 7: Clean Up positionStore Reactivity
**Priority**: LOW — works, just not idiomatic
**Files**: `src/positionStore.ts`

- Replace custom `CacheListener` pattern with `$state`-based reactive state
- Keep the localStorage ↔ Nostr migration logic
- Make position updates trigger Svelte reactivity naturally

---

## What NOT to Do

- **Do not redesign the wallet page UI** — the existing 4-tab layout works
- **Do not change trading logic** — that's a separate concern
- **Do not add new features beyond withdrawal UI** — this is a refactor, not a feature sprint
- **Do not change Nostr event kinds or NIP compliance** — stick with what works
- **Do not break existing deposit/send/receive flows** — they work with the demo mint

## Verification

After each step:
1. `npm run build` passes
2. Wallet page loads, shows balance, can create deposits
3. WalletWidget in nav shows same balance as wallet page
4. No console errors related to wallet state

## Depends On

- Nothing — this is the prerequisite for Phase 8
- Should be done on a feature branch: `refactor/wallet-consolidation`

## Estimated Scope

- Steps 1-3 (HIGH priority): ~4-6 hours implementation
- Steps 4-5 (MEDIUM priority): ~2-3 hours implementation  
- Steps 6-7 (LOW priority): ~2-3 hours implementation
- Total: ~8-12 hours