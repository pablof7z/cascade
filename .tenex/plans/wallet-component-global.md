# Global Wallet Component

## Context

Cascade Markets needs a global wallet widget in the navigation bar so users can see their Cashu wallet balance and access quick wallet actions from any page. This is distinct from the full Wallet Page (`/wallet`) which already exists and provides deposit, send, receive, and history tabs.

**Current state:**
- `src/lib/components/NavHeader.svelte` (277 lines): The nav has a "Connect Wallet" button (line 250–255) that triggers Nostr key connection via `reconnect()` — it does **not** connect a Cashu wallet. Once logged in, it shows an avatar + abbreviated pubkey with a dropdown (View Profile, Bookmarks, Disconnect). No wallet balance is displayed anywhere in the nav.
- `src/walletStore.ts` (137 lines): Module-level singleton wrapping `NDKCashuWallet` from `@nostr-dev-kit/wallet`. Exports `loadOrCreateWallet()`, `getWalletBalance()`, `createDeposit()`, `sendTokens()`, `receiveToken()`, `getWallet()`, `getCurrentMintUrl()`, `setMintUrl()`. Uses NIP-60 wallet discovery (kind `CashuWallet`). Not reactive — returns promises, no subscriber pattern.
- `src/lib/stores/nostr.ts`: Reactive store with subscribe pattern (module-level state + `Set<Subscriber>` + `notifySubscribers()`). This is the pattern to follow.
- `src/routes/wallet/+page.svelte` (482 lines): Full wallet page using `walletStore` directly with `onMount` + manual `loadBalance()` calls. Balance displayed as `text-3xl font-mono font-medium text-white` with `formatSats()` and "sats" suffix.
- No React wallet component exists to port — `src/components/` is empty. This is a **new component**.
- NavHeader is imported per-page (not in root layout), so the wallet widget must be embedded within NavHeader itself.

## Approach

Create a reactive wallet store in `src/lib/stores/wallet.ts` that wraps the existing `walletStore.ts` singleton with Svelte-compatible subscriber pattern (matching `nostr.ts`). Then build a `WalletWidget.svelte` component that shows balance in the nav and provides a dropdown with quick actions. Integrate it into `NavHeader.svelte` between the primary CTA button and the user menu.

**Why this approach:**
- Wrapping `walletStore.ts` rather than rewriting it preserves the existing wallet page integration and avoids duplicating NDKCashuWallet management logic.
- A reactive store enables any component (not just the nav widget) to reactively display wallet state — useful for trading UI, market pages, etc.
- Placing the widget inside NavHeader (rather than moving NavHeader to root layout) avoids a larger refactor and keeps the per-page import pattern intact.

**Alternatives rejected:**
- *Embed wallet logic directly in NavHeader*: Would bloat NavHeader and prevent reuse of wallet state elsewhere.
- *Move NavHeader to root layout first*: Larger scope, unrelated to this task. Can be done later independently.
- *Use Svelte 5 runes for the store*: The existing stores (`nostr.ts`, `testnet.ts`) use the subscribe/get pattern. Consistency matters more than using the newest API.

## File Changes

### `src/lib/stores/wallet.ts`
- **Action**: create
- **What**: Reactive wallet store following the same pattern as `src/lib/stores/nostr.ts`. Module-level state for `balance` (number), `isLoading` (boolean), `isInitialized` (boolean), `error` (string | null), `isRefreshing` (boolean — internal dedup flag). Exports:
  - `walletStore` object with `subscribe()` and `get()` methods
  - `initWalletStore()` — calls `loadOrCreateWallet()` from `walletStore.ts`, fetches initial balance, starts a polling interval (30s) for balance refresh
  - `refreshBalance()` — manually triggers `getWalletBalance()` and notifies subscribers. **Must guard against concurrent calls**: if `isRefreshing` is already `true`, return immediately (no-op). Set `isRefreshing = true` before the async call, reset to `false` in a `finally` block. This prevents both rapid manual refreshes and polling overlap from spawning duplicate in-flight requests.
  - `destroyWalletStore()` — clears polling interval, resets all state (balance, isLoading, isInitialized, error, isRefreshing) to defaults
- **Error recovery strategy**: Both `initWalletStore()` and `refreshBalance()` must wrap all async calls in try/catch:
  - On error in `initWalletStore()`: set `error` to the error message, set `isLoading = false`, do NOT start the polling interval. The widget will show the error state.
  - On error in `refreshBalance()` (including during polling): set `error` to the error message, but keep the last known `balance` value visible (don't zero it out). Polling continues — the next successful poll clears the error. This means transient network failures don't wipe the displayed balance.
  - On error in the polling interval callback: catch and set `error`, but never let an unhandled rejection escape. Log to `console.warn` (not `console.error`) to avoid alarming users in devtools.
  - `error` is cleared (`null`) on any successful balance fetch.
- **Why**: The existing `src/walletStore.ts` is imperative (async functions, no reactivity). Components need reactive state to update UI when balance changes. This store wraps it without modifying it.

### `src/lib/components/WalletWidget.svelte`
- **Action**: create
- **What**: Compact nav-bar wallet widget with four visual states:
  1. **Not logged in**: Hidden (wallet requires Nostr keys — the existing "Connect Wallet" button handles Nostr login).
  2. **Loading**: Skeleton pulse (`w-16 h-5 bg-neutral-800 animate-pulse`).
  3. **Loaded**: Balance display as a button — `text-sm font-mono text-white` showing formatted sats (e.g., "1,234 sats"). Clicking opens a dropdown panel.
  4. **Error**: If `error` is set and no balance has ever loaded (`balance === 0 && error`), show a muted "Wallet" label in `text-neutral-500` (clickable, still opens dropdown with error message). If a previous balance exists but there's a current error (`balance > 0 && error`), show the stale balance in `text-neutral-500` (dimmed to indicate staleness) — the dropdown header shows a small `text-rose-400 text-xs` error hint like "Balance may be outdated" with a retry button.
  
  **Dropdown panel** (absolute positioned, right-aligned, `bg-neutral-900 border border-neutral-700`, matching the user menu dropdown pattern at NavHeader lines 219–246):
  - Balance header: `text-lg font-mono font-medium text-white` with "sats" suffix in `text-neutral-400`, plus a refresh button.
  - Quick action links (each as `<a>` tags navigating to `/wallet` with appropriate tab context):
    - "Deposit" — links to `/wallet` (deposit tab)
    - "Send" — links to `/wallet` (send tab)
    - "Receive" — links to `/wallet` (receive tab)
  - "Manage Wallet →" link at bottom, navigating to `/wallet`.
  
  **Styling rules**:
  - No rounded pills, no gradients, no emojis
  - Dropdown: sharp corners, `border border-neutral-700`, `bg-neutral-900`
  - Action items: `text-sm text-neutral-300 hover:bg-neutral-800 hover:text-white` (same as user menu items)
  - Dividers: `border-t border-neutral-700 my-1` (same as user menu)
  - Close-on-outside-click using the same `dropdownRef` + `$effect` pattern as NavHeader's `userMenuRef` (lines 40–51). Concrete implementation:
    ```svelte
    <script>
      let dropdownRef: HTMLDivElement | undefined = $state();
      let isOpen = $state(false);

      $effect(() => {
        if (!isOpen) return;
        function handleClickOutside(e: MouseEvent) {
          if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
            isOpen = false;
          }
        }
        document.addEventListener('click', handleClickOutside, true);
        return () => document.removeEventListener('click', handleClickOutside, true);
      });
    </script>

    <div bind:this={dropdownRef}>
      <button onclick={() => isOpen = !isOpen}><!-- balance display --></button>
      {#if isOpen}
        <div class="absolute right-0 top-full mt-2 ..."><!-- dropdown panel --></div>
      {/if}
    </div>
    ```
- **Why**: Gives users persistent visibility of their balance and quick access to wallet actions without navigating away from their current page.

### `src/lib/components/NavHeader.svelte`
- **Action**: modify
- **What**:
  1. Add imports at top of `<script>`: import `WalletWidget` from `./WalletWidget.svelte`, import `walletStore` from `$lib/stores/wallet`, import `initWalletStore` from `$lib/stores/wallet`.
  2. Add wallet state subscription in the existing `$effect` block (around lines 24–28): subscribe to `walletStore` to get reactive wallet state.
  3. Add `$effect` that reacts to `pubkey` changes for wallet lifecycle management:
     - When `pubkey !== null` (logged in): call `initWalletStore()` to start wallet + polling.
     - When `pubkey === null` (logged out / disconnected): call `destroyWalletStore()` to stop polling, clear balance, and reset state.
     - The `$effect` cleanup function must also call `destroyWalletStore()` to handle component teardown.
     ```svelte
     $effect(() => {
       if (pubkey) {
         initWalletStore();
         return () => destroyWalletStore(); // cleanup on teardown
       } else {
         destroyWalletStore(); // cleanup on logout
       }
     });
     ```
  4. Insert `<WalletWidget />` in the right-side actions area, between the primary CTA button (line 191) and the user menu/connect button section (line 193). It should render only when `isLoggedIn` is true. Approximate insertion point: after line 191, before the `<!-- User Menu or Connect Button -->` comment at line 193.
  5. On the mobile menu (lines 260–275): Add a wallet balance display row showing formatted balance and a link to `/wallet`. Simple inline display, not the full dropdown. **Important**: The mobile menu must subscribe to the same `walletStore` state used by the desktop `WalletWidget` — it is NOT a separate data source. Since both the mobile menu section and the desktop widget are within the same `NavHeader` component, they share the same `walletState` subscription variable. When `refreshBalance()` fires (from polling or manual refresh), both the desktop widget and mobile menu row update reactively and simultaneously.
- **Why**: NavHeader is where all nav-level UI lives. The wallet widget sits naturally between the primary action and user identity.

### `src/routes/wallet/+page.svelte`
- **Action**: modify
- **What**: After balance-changing operations (deposit confirmed, send completed, receive completed — the `loadBalance()` calls at lines 94, 134, 160), also call `refreshBalance()` from the wallet store so the nav widget updates immediately without waiting for the polling interval.
  - Import `refreshBalance` from `$lib/stores/wallet`
  - Add `refreshBalance()` call after each existing `loadBalance()` call (3 locations)
- **Why**: When a user completes a wallet action on the wallet page, the nav widget balance should update immediately rather than waiting up to 30 seconds for the next poll.

## Execution Order

1. **Create `src/lib/stores/wallet.ts`** — Build the reactive wallet store wrapping `walletStore.ts`. Verify by importing in a test script or checking TypeScript compilation (`npx svelte-check`). No UI dependency yet.

2. **Create `src/lib/components/WalletWidget.svelte`** — Build the widget component consuming the wallet store. Verify by checking TypeScript compilation. Component won't be visible yet since it's not imported anywhere.

3. **Modify `src/lib/components/NavHeader.svelte`** — Import and integrate `WalletWidget`, add wallet store initialization lifecycle. Verify by:
   - Running `npx svelte-check` for type errors
   - Visually confirming the widget appears in the nav when logged in
   - Confirming the widget is hidden when not logged in
   - Testing the dropdown opens/closes correctly
   - Testing close-on-outside-click works
   - Confirming mobile menu shows balance

4. **Modify `src/routes/wallet/+page.svelte`** — Wire up `refreshBalance()` calls. Verify by:
   - Completing a receive-token action on the wallet page
   - Confirming the nav widget balance updates immediately

## Verification

- **Build check**: `npm run build` completes without errors
- **Type check**: `npx svelte-check` passes
- **Visual checks** (manual):
  - Not logged in: No wallet widget visible, only "Connect Wallet" button
  - Logged in, wallet loading: Skeleton pulse appears in nav between CTA and avatar
  - Logged in, wallet loaded: Balance shown in `font-mono` format (e.g., "1,234 sats")
  - Click balance: Dropdown appears with balance header, Deposit/Send/Receive links, "Manage Wallet →"
  - Click outside dropdown: Dropdown closes
  - Click "Manage Wallet →": Navigates to `/wallet`
  - Complete action on `/wallet` page: Nav balance updates immediately
  - Mobile view: Balance appears in mobile menu
- **Edge cases**:
  - Wallet initialization failure (no keys, network error): Widget shows error state — muted "Wallet" label, no unhandled promise rejections, `console.warn` only
  - User disconnects (Nostr disconnect): `$effect` fires `destroyWalletStore()`, wallet store resets all state, widget disappears, polling stops
  - User reconnects after disconnect: `$effect` fires `initWalletStore()` again, fresh polling starts
  - Multiple rapid `refreshBalance()` calls: Only one in-flight request at a time (`isRefreshing` dedup flag), subsequent calls are no-ops
  - Polling error followed by recovery: Balance stays at last known value (dimmed), error hint shown. Next successful poll clears error and restores normal display
  - Network down during polling: Errors caught, `console.warn` logged, polling continues on schedule, no crash
