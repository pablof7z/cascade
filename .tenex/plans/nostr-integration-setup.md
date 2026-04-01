# Nostr Integration Setup for Cascade Market Discussion

## Context

Cascade is a React/TypeScript prediction market platform with a discussion UI at `/market/:id/discussion`. Currently, the discussion component (`src/Discussion.tsx`) uses mock data with hardcoded participants and posts. To enable real Nostr-backed discussions, we need to set up the foundational infrastructure:

1. **NDK is already present** — `@nostr-dev-kit/ndk` v3.0.3 is in `package.json` (line 18)
2. **Nostr utilities exist** — `src/nostrKeys.ts` already provides key generation and storage (bech32 encoding/decoding, keypair management)
3. **Testnet/mainnet support exists** — `src/testnetConfig.tsx` provides context-based testnet toggling, allowing relay selection by network

This sub-task focuses ONLY on infrastructure: NDK initialization, relay configuration, user authentication (NIP-07/NIP-46), and a service layer. No data fetching or UI changes yet.

## Approach

### Event Kind and Tag Structure (Recommended)

Use **kind 1 (text notes)** with a custom `m` tag (market identifier) to scope discussion posts to a market. This approach:
- Kind 1 does not support `d` tags as identifiers (relays ignore them); use custom `m` tag instead
- Makes posts queryable by market via `{kinds: [1], '#m': [marketId]}`
- Allows fallback to regular kind 1 posts if the m-tag is missing (graceful degradation)
- Is simpler than a custom kind and leverages existing relay support

**Event structure for a market discussion post:**
```json
{
  "kind": 1,
  "tags": [["m", "market-uuid"], ["market", "market-uuid"]],
  "content": "Post text",
  "created_at": <unix-timestamp>
}
```

The `m` tag acts as the market identifier (queryable via NDK filter `{'#m': [marketId]}`); the `market` tag is metadata for filtering/organization.

### User Authentication Flow

1. **On app load**, check for NIP-07 availability (`window.nostr`)
2. **If NIP-07 exists**, request pubkey and store in context
3. **If NIP-07 unavailable**, offer optional NIP-46 (bunker) flow
4. **If no signer**, allow read-only mode (user sees discussions but cannot post)

This is non-blocking and graceful — the user can still browse discussions without signing in.

### Service Layer Architecture

Create `src/services/nostrService.ts` that exposes:
- **NDK instance** (initialized with relay URLs passed as parameters, NOT via React hooks)
- **User pubkey** (from NIP-07 or null)
- **Key async functions**:
  - `publishEvent(content: string, tags: string[][], kind: number = 1)` — publish a Nostr event (kind defaults to 1; reactions use kind 7)
  - `fetchEvents(filter: NDKFilter)` — query events from relays
  - `subscribeToEvents(filter: NDKFilter, callback: Function)` — subscribe to new events

Create `src/context/NostrContext.tsx` (a React component) to:
- Call `useTestnet()` to get testnet mode
- Determine relay URLs based on testnet/mainnet
- Call `initNostrService(relayUrls)` once at mount to initialize the service
- Provide the service throughout the app via React context

**CRITICAL:** `nostrService.ts` must NOT call any React hooks. It is a pure module. Relay injection happens in `NostrContextProvider` (a component) at startup.

### Why This Approach

- **Minimal disruption** — no changes to Discussion.tsx or other components yet
- **Relay-agnostic** — NDK handles relay selection; `useTestnet()` context determines which relays to use
- **Testnet-aware** — easily switch between testnet and mainnet relay sets
- **Extensible** — other sub-tasks (fetching, reactions, post creation) depend on this layer, not on component internals
- **User-centric** — respects user choice (NIP-07 first, optional NIP-46, read-only fallback)

## File Changes

### `package.json`
- **Action**: verify (no changes needed)
- **What**: Confirm `@nostr-dev-kit/ndk` is present at v3.0.3
- **Why**: Already in place; this file needs no changes

### `src/services/nostrService.ts`
- **Action**: create
- **What**: Pure module (no React hooks). Exports `initNostrService(relayUrls: string[])` to initialize NDK. Detects user auth (NIP-07/NIP-46) at init. Exposes: `publishEvent(content, tags, kind?)`, `fetchEvents(filter)`, `subscribeToEvents(filter, callback)`, `getNDK()`, `getPubkey()`, `isReady()`
- **Why**: Centralizes Nostr logic; service receives relay URLs as parameters (injected by NostrContextProvider), not via hooks. This pattern keeps the service testable and hook-free.

### `src/context/NostrContext.tsx`
- **Action**: create
- **What**: React context wrapping `nostrService`, providing `useNostr()` hook that exposes: `pubkey` (hex string or null), `ndkInstance`, `publishEvent`, `fetchEvents`, `subscribeToEvents`, `isReady` (boolean)
- **Why**: Makes Nostr service available throughout the app; decouples components from direct service import

### `src/context/index.ts`
- **Action**: create (or update if exists)
- **What**: Barrel export for contexts; re-export `NostrContext` and `useNostr` from `./NostrContext`
- **Why**: Cleaner imports for components (`import { useNostr } from '@/context'` instead of full path)

### `src/main.tsx`
- **Action**: modify
- **What**: Wrap the app root with `<NostrContextProvider>` (inner, after TestnetProvider), so all components have access to Nostr context
- **Why**: Ensures NDK is initialized once at app startup; makes `useNostr()` available globally

### `src/testnetConfig.tsx`
- **Action**: modify (light)
- **What**: Add relay URL constants for testnet and mainnet (currently in the file, but nostrService will read from here). Ensure `useTestnet()` is exported and can be called from `nostrService.ts`
- **Why**: `nostrService` needs to select relays based on testnet/mainnet mode without duplicating URLs

## Execution Order

1. **Verify NDK availability** — run `npm list @nostr-dev-kit/ndk` to confirm package is installed
   - ✅ Verify: Output shows `@nostr-dev-kit/ndk@3.0.3`

2. **Create `src/services/nostrService.ts`**
   - Export `initNostrService(relayUrls: string[])` function that takes relay URLs as a parameter
   - Inside `initNostrService()`, create NDK with the provided relay URLs
   - Detect NIP-07 availability and request pubkey on init (inside `initNostrService()`)
   - Implement `publishEvent(content: string, tags: string[][], kind: number = 1)` — uses NDK to publish
   - Implement `fetchEvents(filter: NDKFilter)` — uses NDK to fetch
   - Implement `subscribeToEvents(filter: NDKFilter, callback: Function)` — uses NDK to subscribe
   - Export getters: `getNDK()`, `getPubkey()`, `isReady()`
   - Handle errors gracefully (missing signer → null pubkey, read-only mode)
   - **DO NOT call `useTestnet()` or any React hooks** — this is a pure module
   - **Verify**: Service initializes without errors; `getPubkey()` returns null or hex string

3. **Create `src/context/NostrContext.tsx`**
   - Define `NostrContextValue` type with `pubkey`, `ndkInstance`, `publishEvent`, `fetchEvents`, `subscribeToEvents`, `isReady`
   - Create `NostrContextProvider` component that:
     - Calls `useTestnet()` to get testnet mode
     - Maps testnet/mainnet to appropriate relay URLs (e.g., testnet: `['wss://relay.damus.io']`, mainnet: `['wss://relay.damus.io', 'wss://nostr.wine']`)
     - Calls `initNostrService(relayUrls)` inside `useEffect` at mount with dependency on `isTestnet`
     - Exposes service methods via context
   - Export `useNostr()` hook
   - **Verify**: Context is created; `useNostr()` returns expected shape; relay selection changes when testnet mode toggles

4. **Create `src/context/index.ts`**
   - Re-export `NostrContext`, `useNostr`, `NostrContextProvider` from `./NostrContext`
   - **Verify**: Import path `import { useNostr } from '@/context'` works in a test file

5. **Modify `src/main.tsx`**
   - Import `NostrContextProvider`
   - Wrap root `<App>` with `<TestnetProvider><NostrContextProvider><App /></NostrContextProvider></TestnetProvider>`
   - **Verify**: App starts without errors; no console errors about missing context

6. **Document event kind and tag structure**
   - Add comment block in `nostrService.ts` explaining kind 1 + `d` tag + `market` tag approach
   - **Verify**: Comment is clear and references this plan

## Verification

1. **App starts cleanly**
   - Run `npm run dev`
   - Check browser console for no errors
   - Confirm no React context warnings

2. **NDK initializes**
   - Add temporary debug log: `console.log('NDK ready:', useNostr().ndkInstance !== null)`
   - Verify output is `NDK ready: true`

3. **NIP-07 detection works** (if user has a Nostr extension)
   - Open app with Nostr extension installed
   - Check that `useNostr().pubkey` is a hex string (not null)
   - If no extension, verify `pubkey` is null (no error thrown)

4. **Read-only mode works**
   - Without a Nostr signer, app should still load and allow navigation
   - Verify no crashes; `useNostr().isReady` is true but `pubkey` is null

5. **Relay connectivity** (manual)
   - Open DevTools Network tab, filter by "WebSocket"
   - See connections to relay URLs (should show for testnet relays)
   - Verify no hanging/failed connections

## Notes for Future Sub-Tasks

- **Real Post Fetching**: Will call `useNostr().fetchEvents({kinds: [1], '#m': [marketId]})` in canonical Discussion component
- **Post Creation**: Will call `useNostr().publishEvent(content, [['m', marketId], ['market', marketId]])` on form submit (kind defaults to 1)
- **Reactions (NIP-25)**: Will call `useNostr().publishEvent('+', [['e', eventId], ['p', authorPubkey], ['m', marketId]], 7)` to create kind 7 reaction (kind 7 explicitly passed)
- **Market Scoping**: Always include both `m` (primary market identifier, queryable) and `market` (searchable metadata) tags
- **Discussion Component Consolidation**: Post-fetching targets `DiscussPage.tsx`, post-creation and reactions target `Discussion.tsx`. Consolidate to single canonical component before merging all sub-tasks.
- **NIP-25 Vote Removal**: Currently votes are kind 7 events; NIP-25 delete via kind 5 is out of scope. Session-local vote removal is documented in reactions plan; votes will re-appear on page refresh.

---

**Plan approved for implementation by sub-tasks.**
