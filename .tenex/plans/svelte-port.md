# React-to-Svelte 5 + SvelteKit Port

## Executive Summary

Cascade will transition from React 19 + Vite to Svelte 5 + SvelteKit while maintaining backward compatibility during transition. This phased approach ports 41 TSX components across 5 phases, reusing all vanilla TypeScript services (14 services, no React dependencies). API routes migrate from Vite middleware to SvelteKit `src/routes/api/`, and NDK integration transitions from `useNostr()` hook pattern to Svelte stores + `setContext/getContext`. Services, state utilities, and Nostr integration remain unchanged. React and Svelte pages coexist via dual-route strategy (React pages on `/legacy/*`, Svelte on `/`). Full React removal occurs after Phase 4 completion.

## Context

### Current Architecture
- **Framework:** React 19 + React Router 7 + Vite
- **Components:** 41 TSX files (26 pages, 11 components, 14 services, 5 stores, 1 hook, 8 utils)
- **State:** React Context (NostrContext) + localStorage stores (profileStore, walletStore, positionStore, bookmarkStore)
- **APIs:** 13 routes in Vite middleware (vite.config.ts:33–222), handling agent directory, analytics, market data
- **Styling:** Tailwind CSS v4 via @tailwindcss/vite plugin
- **Deployment:** Vercel, custom serverless functions in `api/` directory
- **Testing:** Vitest + React Testing Library
- **Build:** `tsc -b && vite build` → static HTML served by Vercel

### Why Port to Svelte
1. **Smaller bundle:** Svelte compiles away the framework; React remains; eliminates ~45KB gzipped overhead post-port
2. **Reactivity model:** Svelte's `$state` and `$derived` runes simplify Nostr subscription state management vs React hooks
3. **SvelteKit SSR:** Unified TypeScript server/client colocation, built-in API routes, edge function compatibility with Vercel Adapter
4. **File-based routing:** Eliminates React Router dependency, 100% type-safe route matching
5. **Better DX:** Scoped styling, two-way binding, less boilerplate for form state

### Key Constraints
- **Services are vanilla TS:** All 14 services (nostrService, marketService, positionService, etc.) have zero React dependencies and will be reused as-is
- **Tailwind v4 works:** SvelteKit's Vite base supports @tailwindcss/vite without changes
- **TipTap has no official Svelte wrapper:** Custom wrapper needed (minimal, ~40 lines)
- **lightweight-charts community package:** svelte-lightweight-charts exists but unmaintained; use vanilla API via Svelte actions
- **NDK Svelte integration:** @nostr-dev-kit/svelte provides Svelte stores; NostrContext pattern maps cleanly to `setContext/getContext`
- **Dual-serving:** During phases 1–4, React pages remain at `/legacy/*`, Svelte pages at `/`. After Phase 4, remove React layer.

## Approach

### Phasing Strategy

**Phase 1 (Proof of Concept):** Validate Svelte + SvelteKit + NDK integration with 4 loading-state components. Proves subscription patterns, store integration, and Nostr event handling. Success = all 4 POC components fetch and display Nostr data correctly.

**Phase 2 (Stateless Foundation):** Port 10 simple display components (no forms, no complex state). Validates component patterns, styling consistency, test setup. Success = all 10 render correctly, pass accessibility checks.

**Phase 3 (Medium Complexity):** Port 6 components with routing, charts, and light state. Validates form handling, chart integration, route transitions. Success = routes work, data flows correctly, performance meets baseline.

**Phase 4 (Complex Features):** Port remaining 5 pages (ThesisBuilder, TiptapEditor, Wallet, App.tsx, routing orchestration) + all 13 API routes. Validates form state, TipTap wrapper, dependency injection, full feature parity. Success = all pages functional, API routes fully migrated.

**Phase 5 (Polish & Removal):** Accessibility audit, performance tuning, React layer removal, deployment validation.

### Why This Phasing
1. **Phase 1 de-risks:** If Svelte + NDK subscriptions fail, no investment in other phases
2. **Phase 2 establishes patterns:** Simple components show the "Svelte way" without noise
3. **Phase 3 integrates routing + state:** Validates form state and route transitions early
4. **Phase 4 unblocks shipping:** All features available; Phase 5 is pure polish
5. **No waterfall:** Phases 1 & 2 can run in parallel with SvelteKit setup (Phase 0)

### Dual-Route Strategy During Transition

During phases 1–4, both React and Svelte pages serve simultaneously:

```
/                      → SvelteKit (Svelte pages)
/legacy/*              → React Router (backward compatibility)
/api/*                 → SvelteKit server routes (new), fallback to Vite middleware (old)
```

**Routing Logic (src/routes/+page.server.ts):**
- SvelteKit `+page.svelte` files act as primary routes
- Old React routes remain in React Router within `/legacy` layout
- Shared layout components (NavHeader, Footer) initially imported into both, later unified

**After Phase 4:**
1. Remove `/legacy` routes
2. Remove React dependencies from package.json
3. Update build to SvelteKit only
4. Validation: smoke tests, E2E on Vercel staging

## File Changes

### Phase 0: SvelteKit Setup (Parallel)

#### `svelte.config.js`
- **Action:** Create
- **What:** SvelteKit config with Vercel adapter, Tailwind v4 integration, TypeScript preprocessing
- **Why:** Entry point for SvelteKit build system; Vercel adapter handles serverless deployment

#### `src/routes/+layout.svelte`
- **Action:** Create
- **What:** Root layout component with NavHeader, Footer, global styles, Nostr context setup
- **Why:** Shared layout for all Svelte pages; provides Nostr state to entire app via setContext

#### `src/routes/+page.svelte`
- **Action:** Create
- **What:** Landing page (temporary redirect or wrapper until Phase 3 routing complete)
- **Why:** Root route entry point

#### `src/lib/stores/nostr.ts`
- **Action:** Create
- **What:** Svelte stores for Nostr state: `pubkey`, `ndkInstance`, `isReady`, subscription handlers, managed subscription cleanup
- **Why:** Replaces NostrContext; provides reactive state to all components via Svelte's rune syntax. Stores are global and simpler than setContext; no dual state system needed.
- **Subscription Cleanup Pattern:** Implement `createManagedSubscription()` helper to prevent memory leaks:
  ```typescript
  import { writable } from 'svelte/store'
  import type { NDKSubscription } from '@nostr-dev-kit/ndk'

  // Global registry to track and cleanup subscriptions
  const subscriptions = new Map<string, NDKSubscription>()

  export function createManagedSubscription(id: string, sub: NDKSubscription) {
    subscriptions.set(id, sub)
    return () => {
      sub.stop()
      subscriptions.delete(id)
    }
  }

  export function cleanupAllSubscriptions() {
    for (const sub of subscriptions.values()) {
      sub.stop()
    }
    subscriptions.clear()
  }
  ```
- **Usage in components:** Call `createManagedSubscription()` in a `$effect` and return the cleanup function to auto-stop subscriptions

#### `src/lib/utils/nostr-init.ts`
- **Action:** Create
- **What:** Server-side initialization function (not a component) that initializes nostrService and populates stores. Replaces NostrContext.svelte.
- **Why:** Stores provide global state; dual state (stores + context) is unnecessary complexity. Initialize in `src/routes/+layout.ts` load function instead:
  ```typescript
  import { initNostrService, getNDK, getPubkey } from '$lib/services/nostrService'
  import { pubkey, ndkInstance, isReady } from '$lib/stores/nostr'

  export const load = async () => {
    const relayUrls = import.meta.env.PUBLIC_TESTNET === 'true' 
      ? ['wss://relay.nostr.band', 'wss://nos.lol']
      : ['wss://nostr.wine', 'wss://nos.lol']
    
    await initNostrService(relayUrls)
    pubkey.set(getPubkey())
    ndkInstance.set(getNDK())
    isReady.set(true)
  }
  ```
- **Why:** SvelteKit +layout.ts load function runs once at app startup, perfect for initialization

#### `tsconfig.json`
- **Action:** Modify
- **What:** Add SvelteKit paths: `{ "$lib": "./src/lib" }`, `{ "$routes": "./src/routes" }`, update jsx to ts
- **Why:** SvelteKit convention; enables clean imports

#### `vite.config.ts`
- **Action:** Delete (or archive)
- **What:** Vite-specific config no longer needed; SvelteKit has its own build system
- **Why:** SvelteKit uses `svelte.config.js` for build config

#### `package.json` - Dependencies
- **Action:** Modify
- **What:**
  - **Add:** `svelte@5.x`, `@sveltejs/kit@2.x`, `@sveltejs/adapter-vercel@5.x`, `@nostr-dev-kit/svelte@latest`, `svelte-check@3.x`, `svelte-preprocess@5.x`
  - **Remove:** `react@19.x`, `react-dom@19.x`, `react-router-dom@7.x`, `@vitejs/plugin-react@6.x`, `@tiptap/react@3.x`, `@types/react*`
  - **Update:** `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/pm`, `@tiptap/extension-placeholder` (use core, not react)
  - **Keep:** All NDK packages, services, Tailwind, PostHog, markdown-it, lightweight-charts
- **Why:** Enables Svelte framework + removes React; TipTap shifts to core API

#### `package.json` - Scripts
- **Action:** Modify
- **What:** Change build/dev/preview:
  ```json
  "dev": "vite dev",
  "build": "svelte-check && vite build",
  "preview": "vite preview"
  ```
- **Why:** SvelteKit's Vite integration replaces standalone Vite

#### `.env.local`
- **Action:** Verify
- **What:** Ensure contains relay URLs, testnet flag (parsed in +layout.server.ts)
- **Why:** Build-time config for relay selection

#### `src/lib/utils/tiptap-wrapper.ts`
- **Action:** Create
- **What:** Helper class wrapping TipTap core API for Svelte component consumption:
  ```typescript
  import { Editor } from '@tiptap/core'
  import Placeholder from '@tiptap/extension-placeholder'
  import StarterKit from '@tiptap/starter-kit'
  import { htmlToMarkdown, markdownToHtml } from './markdown'

  export class TipTapEditor {
    editor: Editor
    constructor(element: HTMLElement, initialContent: string) {
      this.editor = new Editor({
        element,
        extensions: [
          StarterKit.configure({ heading: { levels: [2, 3] } }),
          Placeholder.configure({ placeholder: 'Start writing...' }),
        ],
        content: markdownToHtml(initialContent),
      })
    }
    getContent() { return htmlToMarkdown(this.editor.getHTML()) }
    setContent(content: string) { this.editor.commands.setContent(markdownToHtml(content)) }
    destroy() { this.editor.destroy() }
  }
  ```
- **Why:** TipTap core is DOM-based; wrapper provides clean interface for Svelte components

#### `src/lib/utils/lightweight-charts-action.ts`
- **Action:** Create
- **What:** Svelte action for lightweight-charts integration with data update support:
  ```typescript
  import { createChart, type IChartApi, type ISeriesApi } from 'lightweight-charts'

  export function chart(node: HTMLElement, options: any) {
    const instance = createChart(node, options)
    let series: ISeriesApi<'Line'> | null = null

    return {
      update(newOptions: any) {
        instance.applyOptions(newOptions)
      },
      // For updating chart data when reactive props change
      setSeries(data: any[], config?: any) {
        if (series) series.remove()
        series = instance.addLineSeries(config || {})
        series.setData(data)
        instance.timeScale().fitContent()
      },
      destroy() {
        instance.remove()
      }
    }
  }
  ```
- **Why:** Svelte actions provide lifecycle hooks for DOM manipulation; `update()` and `setSeries()` enable reactive data updates

#### `src/app.d.ts`
- **Action:** Create
- **What:** SvelteKit ambient types for app locals, page data:
  ```typescript
  declare global {
    namespace App {
      interface Locals {
        pubkey?: string | null
        ndkInstance?: NDK | null
      }
      interface PageData {
        pubkey?: string | null
      }
    }
  }
  ```
- **Why:** TypeScript support for SvelteKit's data flow

### Phase 1: Proof of Concept (4 Files)

#### `src/routes/activity/+page.svelte`
- **Action:** Create (port Activity.tsx)
- **What:** Rewrite Activity.tsx:
  - Replace `useState/useEffect` with `$state` and `$effect`
  - Replace `react-router` Link with SvelteKit `goto` or `<a>` tags
  - Fetch via `fetchAllMarketsTransport`, `fetchAllPositions`, `parseMarketEvent` (reused services)
  - Subscribe via `subscribeToEvents` from nostrService (no change needed)
  - Bind filter state to reactive variable: `let filter: ActivityFilter = $state('All')`
  - Use `#each` for loops instead of `.map()`
- **Why:** First test of subscription + fetch + state management in Svelte

#### `src/routes/activity/+page.server.ts`
- **Action:** Create
- **What:** Server-side data pre-fetch (optional; can defer to client load function):
  ```typescript
  import type { PageLoad } from './$types'
  export const load: PageLoad = async ({ parent }) => {
    const { pubkey, ndk } = await parent()
    // Pre-fetch recent activity
    return { initialData: [] }
  }
  ```
- **Why:** Leverage SvelteKit's streaming; improves perceived performance

#### `src/routes/analytics/+page.svelte`
- **Action:** Create (port AnalyticsDashboard.tsx)
- **What:** Rewrite AnalyticsDashboard.tsx:
  - Replace hooks with `$state` for filters, chart data
  - Replace `fetch()` call with `fetch('/api/analytics/summary')`
  - Use Svelte action for chart rendering (lightweight-charts)
  - Bind form inputs directly: `bind:value={filter.kind}`
- **Why:** Tests data fetch from API + chart rendering

#### `src/routes/profile/[pubkey]/+page.svelte`
- **Action:** Create (port ProfilePage.tsx)
- **What:** Rewrite ProfilePage.tsx:
  - Accept `pubkey` from route params via `$page.params.pubkey`
  - Fetch kind:0 metadata via `fetchEvents({ kinds: [0], authors: [pubkey] })`
  - Fetch positions via `positionService.fetchPositions(ndk, pubkey)` (service reused)
  - Subscribe to metadata updates via `subscribeToEvents`
  - Render profile strip, credibility stats, positions grid
- **Why:** Tests parameterized routing + multi-source data fetch

#### `src/routes/thread/[marketId]/+page.svelte`
- **Action:** Create (port ThreadPage.tsx)
- **What:** Rewrite ThreadPage.tsx:
  - Fetch market by ID via `fetchMarketByEventId`
  - Subscribe to discussion events (kind 1111) via `subscribeToEvents`
  - Render thread with live updates
  - Handle reply submission via form action
- **Why:** Tests live subscriptions + form submission

**Phase 1 Success Criteria:**
- All 4 pages load without errors
- Nostr data fetches and displays correctly
- Live subscriptions trigger reactivity
- No React Console warnings
- Lighthouse score ≥90

### Phase 2: Stateless Foundation (10 Files)

#### `src/routes/+layout.svelte` (Refinement)
- **Action:** Modify
- **What:** Add shared NavHeader, Footer, global styles, theme detection
- **Why:** Refinement based on Phase 1 patterns

#### `src/lib/components/Footer.svelte`
- **Action:** Create (port Footer.tsx)
- **What:** Static footer with links, copyright
- **Why:** No state; straightforward port

#### `src/lib/components/TestnetBanner.svelte`
- **Action:** Create (port TestnetBanner.tsx)
- **What:** Banner showing testnet status, derived from context store
- **Why:** Tests context consumption

#### `src/lib/components/UserAvatar.svelte`
- **Action:** Create (port UserAvatar.tsx)
- **What:** Avatar with deterministic color from pubkey, badge
- **Why:** Reusable UI component

#### `src/lib/components/BookmarkButton.svelte`
- **Action:** Create (port BookmarkButton.tsx)
- **What:** Button toggling bookmark state via bookmarkService, updates UI
- **Why:** Tests store integration

#### `src/lib/components/EmbedModal.svelte`
- **Action:** Create (port EmbedModal.tsx)
- **What:** Modal for embedding markets, copy-to-clipboard logic
- **Why:** Tests modal patterns (using Svelte transitions)

#### `src/routes/help/+page.svelte`
- **Action:** Create (port HowItWorks.tsx)
- **What:** Static help page with sections, images, links
- **Why:** No state; pure presentation

#### `src/routes/legal/privacy/+page.svelte`
- **Action:** Create (port PrivacyPolicy.tsx from LegalPages.tsx)
- **What:** Legal text rendered from markdown
- **Why:** Tests markdown rendering

#### `src/routes/legal/terms/+page.svelte`
- **Action:** Create (port TermsOfService.tsx from LegalPages.tsx)
- **What:** Legal text rendered from markdown
- **Why:** Tests markdown rendering

#### `src/routes/blog/+page.svelte`
- **Action:** Create (port Blog.tsx)
- **What:** List of blog posts, link to full posts
- **Why:** Tests data listing

**Phase 2 Success Criteria:**
- All 10 components render correctly
- No build warnings or TS errors
- Styles match React versions pixel-perfectly
- Accessibility: all interactive elements labeled, keyboard navigable

### Phase 3: Medium Complexity (6 Files + Routing)

#### `src/routes/market/[marketId]/+page.svelte`
- **Action:** Create (port MarketDetail.tsx)
- **What:**
  - Fetch market by ID
  - Render market info, price chart (via lightweight-charts action)
  - Handle buy/sell form submission
  - Live price updates via subscription
- **Why:** Tests routing params + chart + form + subscriptions

#### `src/routes/portfolio/+page.svelte`
- **Action:** Create (port Portfolio.tsx)
- **What:**
  - Fetch user's positions via `positionService.fetchPositions(ndk, pubkey)`
  - Calculate PnL via market service
  - Render positions grid with charts
  - Handle redemption
- **Why:** Tests multi-data-source rendering + chart integration

#### `src/routes/dashboard/+page.svelte`
- **Action:** Create (port DashboardOverview.tsx)
- **What:**
  - Render market overview, recent activity, performance metrics
  - Data aggregation from multiple services
- **Why:** Tests data aggregation patterns

#### `src/routes/discuss/+page.svelte`
- **Action:** Create (port DiscussPage.tsx)
- **What:**
  - Render market discussions, sort/filter options
  - Live updates to discussion threads
- **Why:** Tests filtering + sorting + live data

#### `src/routes/settings/+page.svelte`
- **Action:** Create (port SettingsPage.tsx)
- **What:**
  - Profile settings form, profile picture upload, relay configuration
  - Settings stored in profileStore (vanilla TS, reused)
  - Form submission via POST /api/profile
- **Why:** Tests form state + API submission

#### `src/lib/components/MarketCard.svelte`
- **Action:** Create (no direct React equivalent; extract from multiple pages)
- **What:**
  - Reusable market card component: title, price, 24h change, yes/no buttons
  - Used in dashboard, browse, search results
- **Why:** DRY principle; used by multiple pages

**Phase 3 Success Criteria:**
- All routes load with data
- Forms submit correctly, validation works
- Charts render and respond to data updates
- No performance regressions vs React versions
- Route transitions are smooth

### Phase 4: Complex Features (5 Files + API Routes)

#### `src/routes/build/+page.svelte`
- **Action:** Create (port ThesisBuilder.tsx)
- **What:**
  - Form for creating markets: title, description, category, tags
  - TipTap editor integration via wrapper component
  - Form state management with validation
  - Submit to POST /api/markets endpoint
- **Why:** Tests form + TipTap + complex state

#### `src/lib/components/TiptapEditor.svelte`
- **Action:** Create (port TiptapEditor.tsx)
- **What:**
  - Svelte wrapper for TiptapEditor class
  - Props: value, onChange, placeholder
  - Use `bind:value` for two-way binding
  - Cleanup on destroy
  ```svelte
  <script lang="ts">
    import { onMount } from 'svelte'
    import { TipTapEditor } from '$lib/utils/tiptap-wrapper'
    let container: HTMLDivElement
    let editor: TipTapEditor
    let value: string
    onMount(() => {
      editor = new TipTapEditor(container, value)
      return () => editor.destroy()
    })
    function handleChange() {
      if (editor) value = editor.getContent()
    }
  </script>
  ```
- **Why:** Custom wrapper for TipTap core API

#### `src/routes/wallet/+page.svelte`
- **Action:** Create (port WalletPage.tsx + Wallet.tsx component)
- **What:**
  - Display wallet balance (from walletStore)
  - Deposit/withdraw interface
  - Transaction history (via depositService, withdrawService)
  - QR code for receiving (use svelte-qr or canvas)
- **Why:** Tests wallet state + service integration + QR rendering

#### `src/routes/+page.svelte` (Refinement)
- **Action:** Modify (port LandingPage.tsx)
- **What:** Root landing page with hero, market showcase, call-to-action
- **Why:** Gateway page; completes primary navigation

#### `src/routes/(legacy)/+layout.svelte`
- **Action:** Create
- **What:** React Router wrapper (layout only) for `/legacy/*` routes
- **Why:** Backward compatibility during transition; removed after Phase 4

#### API Routes Migration (13 files total)
All migrate from Vite middleware (`vite.config.ts:33–222`) to SvelteKit `src/routes/api/*`:

##### `src/routes/api/agent/markets/+server.ts`
- **Action:** Create
- **What:**
  ```typescript
  import type { RequestHandler } from './$types'
  import { listAgentMarkets, type AgentMarketKind, type LiquidityState } from '$lib/agentDirectory'

  export const GET: RequestHandler = async ({ url }) => {
    const kind = url.searchParams.get('kind') as AgentMarketKind | undefined
    const ownerId = url.searchParams.get('ownerId') ?? undefined
    const tag = url.searchParams.get('tag') ?? undefined
    const liquidityState = url.searchParams.get('liquidityState') as LiquidityState | undefined
    const minReserve = url.searchParams.get('minReserve') ? Number(url.searchParams.get('minReserve')) : undefined
    const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : undefined

    const data = listAgentMarkets({ kind, ownerId, tag, liquidityState, minReserve, limit })
    return new Response(JSON.stringify({ data, meta: { count: data.length } }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
  ```
- **Why:** Serverless route; direct replacement for middleware

##### `src/routes/api/agent/markets/[marketId]/+server.ts`
- **Action:** Create
- **What:** Fetch single market by ID
- **Why:** Dynamic route replacement

##### `src/routes/api/agent/liquidity/+server.ts`
- **Action:** Create
- **What:** Liquidity report for market
- **Why:** Route replacement

##### `src/routes/api/agent/owned-markets/+server.ts`
- **Action:** Create
- **What:** List markets owned by user
- **Why:** Route replacement

##### `src/routes/api/agent/search/+server.ts`
- **Action:** Create
- **What:** Search markets with filters
- **Why:** Route replacement

##### `src/routes/api/analytics/+server.ts`
- **Action:** Create
- **What:**
  ```typescript
  export const POST: RequestHandler = async ({ request }) => {
    const events = await request.json()
    // Append to analytics.jsonl (use node:fs in +server.ts context)
    return new Response(null, { status: 204 })
  }
  export const GET: RequestHandler = async () => {
    // Compute summary from analytics.jsonl
    return new Response(JSON.stringify(summary), {
      headers: { 'Content-Type': 'application/json' }
    })
  }
  ```
- **Why:** Analytics ingestion + summary endpoint

##### `src/routes/api/markets/+server.ts`
- **Action:** Create
- **What:** POST to create market, calls `publishMarket` service
- **Why:** Market creation endpoint

##### `src/routes/api/markets/[marketId]/+server.ts`
- **Action:** Create
- **What:** GET market, DELETE market (for owner)
- **Why:** Market detail + deletion

##### `src/routes/api/profile/+server.ts`
- **Action:** Create
- **What:** POST to update profile (name, about, picture), calls kind:0 publish
- **Why:** Profile updates

##### `src/routes/api/trades/+server.ts`
- **Action:** Create
- **What:** POST to place trade, calls trading service
- **Why:** Trade execution

##### `src/routes/api/positions/+server.ts`
- **Action:** Create
- **What:** GET user positions (server-side or client-side with user pubkey)
- **Why:** Positions endpoint

##### `src/routes/api/bookmarks/+server.ts`
- **Action:** Create
- **What:** POST/DELETE bookmarks (NIP-51), calls bookmarkService
- **Why:** Bookmark management

##### `src/routes/api/wallet/deposit/+server.ts`
- **Action:** Create
- **What:** POST to request deposit address, calls depositService
- **Why:** Deposit flow

##### `src/routes/api/wallet/withdraw/+server.ts`
- **Action:** Create
- **What:** POST to request withdrawal, calls withdrawService
- **Why:** Withdrawal flow

**Phase 4 Success Criteria:**
- All complex pages functional (forms, TipTap, wallet)
- All 13 API routes working identically to Vite middleware
- No performance regressions
- Feature parity with React version

### Phase 5: Polish & Removal

#### `src/routes/legacy/+layout.svelte`
- **Action:** Delete
- **What:** Remove React Router wrapper
- **Why:** Phase 4 complete; React no longer needed

#### `App.tsx`
- **Action:** Delete
- **What:** Remove main React component
- **Why:** Replaced by SvelteKit layout

#### `context/NostrContext.tsx`
- **Action:** Delete
- **What:** Remove React context
- **Why:** Replaced by Svelte stores

#### `main.tsx`
- **Action:** Delete
- **What:** Remove React entry point
- **Why:** SvelteKit has own entry

#### `package.json`
- **Action:** Modify
- **What:** Remove all React packages, React Router, @vitejs/plugin-react, testing-library/react
- **Why:** Full React removal

#### `vite.config.ts`
- **Action:** Delete
- **What:** Already handled by SvelteKit
- **Why:** Consolidate to svelte.config.js

#### `tailwind.config.js`
- **Action:** Modify
- **What:** Update content paths to `src/**/*.{svelte,ts}` instead of `.tsx`
- **Why:** SvelteKit file structure

#### `tsconfig.app.json`
- **Action:** Modify
- **What:** Remove `jsx: "react-jsx"`, add `svelte` to lib array
- **Why:** TypeScript for Svelte

#### Accessibility Audit
- **Action:** Verify
- **What:** Run axe-core or Wave on all pages, fix violations
- **Why:** Maintain accessibility standards

#### Performance Optimization
- **Action:** Tune
- **What:** SvelteKit code splitting, lazy loading, image optimization
- **Why:** Leverage SvelteKit capabilities

## Execution Order

### Phase 0: SvelteKit Setup (Day 1 - Parallel)
1. Install SvelteKit: `npm install -D svelte @sveltejs/kit`
2. Create `svelte.config.js` with Vercel adapter config
3. Create `src/routes/+layout.svelte` with NostrContextProvider setup and global styles
4. Create `src/lib/stores/nostr.ts` with Svelte stores
5. Update `tsconfig.json` with SvelteKit paths
6. Create `src/app.d.ts` with type definitions
7. Update `package.json` dependencies (add SvelteKit, Svelte, @nostr-dev-kit/svelte; remove React from main, keep @types/node)
8. Create `src/lib/utils/tiptap-wrapper.ts` for TipTap integration
9. Create `src/lib/utils/lightweight-charts-action.ts` for chart integration
10. **Verify:** `npm run dev` starts dev server on localhost:5173, no errors
11. **Verify:** SvelteKit Vite preprocessing works, TypeScript compiles

### Phase 1: Proof of Concept (Days 2–3)
1. Create `src/routes/activity/+page.svelte` — port Activity.tsx
   - **Verify:** `localhost:5173/activity` loads, fetches activities, filters work
2. Create `src/routes/analytics/+page.svelte` — port AnalyticsDashboard.tsx
   - **Verify:** `localhost:5173/analytics` loads, fetches summary, chart renders
3. Create `src/routes/profile/[pubkey]/+page.svelte` — port ProfilePage.tsx
   - **Verify:** `localhost:5173/profile/npub1...` loads profile data, positions display
4. Create `src/routes/thread/[marketId]/+page.svelte` — port ThreadPage.tsx
   - **Verify:** `localhost:5173/thread/marketId` loads, live updates appear
5. Run `npm run test:run` on Phase 1 components (basic existence + data binding tests)
6. **Verify:** Lighthouse score ≥90 on all 4 pages
7. **Sign-off:** Phase 1 POC validated; proceed to Phase 2

### Phase 2: Stateless Foundation (Days 4–5)
1. Create `src/lib/components/Footer.svelte` — port Footer.tsx
2. Create `src/lib/components/TestnetBanner.svelte` — port TestnetBanner.tsx
3. Create `src/lib/components/UserAvatar.svelte` — port UserAvatar.tsx
4. Create `src/lib/components/BookmarkButton.svelte` — port BookmarkButton.tsx
5. Create `src/lib/components/EmbedModal.svelte` — port EmbedModal.tsx
6. Create `src/routes/help/+page.svelte` — port HowItWorks.tsx
7. Create `src/routes/legal/privacy/+page.svelte` — port PrivacyPolicy.tsx
8. Create `src/routes/legal/terms/+page.svelte` — port TermsOfService.tsx
9. Create `src/routes/blog/+page.svelte` — port Blog.tsx
10. Run accessibility audit (axe-core on each page)
11. **Verify:** All 10 components render; no accessibility violations
12. **Sign-off:** Phase 2 foundation validated

### Phase 3: Medium Complexity + Routing (Days 6–8)
1. Create `src/routes/market/[marketId]/+page.svelte` — port MarketDetail.tsx
   - **Verify:** Dynamic routing works, chart renders, form submits
2. Create `src/routes/portfolio/+page.svelte` — port Portfolio.tsx
   - **Verify:** Positions load, charts render, PnL calculated
3. Create `src/routes/dashboard/+page.svelte` — port DashboardOverview.tsx
   - **Verify:** All metrics display, no data missing
4. Create `src/routes/discuss/+page.svelte` — port DiscussPage.tsx
   - **Verify:** Discussions load, filtering works
5. Create `src/routes/settings/+page.svelte` — port SettingsPage.tsx
   - **Verify:** Form submits, settings persist via profileStore
6. Create `src/lib/components/MarketCard.svelte` — extract reusable component
7. Update `src/routes/+layout.svelte` to include NavHeader, Footer, global layout
8. **Verify:** All routes accessible, data flows correctly, no errors
9. **Sign-off:** Phase 3 routing validated

### Phase 4: Complex Features & API Routes (Days 9–12)
1. Create `src/lib/components/TiptapEditor.svelte` — wrapper for TipTap
   - **Verify:** Editor renders, content syncs, toolbar works
2. Create `src/routes/build/+page.svelte` — port ThesisBuilder.tsx
   - **Verify:** Form submits market creation, content saved
3. Create `src/routes/wallet/+page.svelte` — port Wallet.tsx + WalletPage.tsx
   - **Verify:** Wallet displays, QR renders, deposit/withdraw flow works
4. Migrate API routes (all 13):
   - `src/routes/api/agent/markets/+server.ts`
   - `src/routes/api/agent/markets/[marketId]/+server.ts`
   - `src/routes/api/agent/liquidity/+server.ts`
   - `src/routes/api/agent/owned-markets/+server.ts`
   - `src/routes/api/agent/search/+server.ts`
   - `src/routes/api/analytics/+server.ts`
   - `src/routes/api/markets/+server.ts`
   - `src/routes/api/markets/[marketId]/+server.ts`
   - `src/routes/api/profile/+server.ts`
   - `src/routes/api/trades/+server.ts`
   - `src/routes/api/positions/+server.ts`
   - `src/routes/api/bookmarks/+server.ts`
   - `src/routes/api/wallet/deposit/+server.ts`
   - `src/routes/api/wallet/withdraw/+server.ts`
   - **Verify:** Each route responds identically to old Vite middleware
5. Finalize `src/routes/+page.svelte` (landing page)
6. Create `/legacy/*` wrapper for fallback to React (if needed during transition)
7. **Verify:** All pages functional, no regressions, API routes pass integration tests
8. **Sign-off:** Phase 4 complete; feature parity achieved

### Phase 5: Polish & Removal (Days 13–14)
1. Run full test suite: `npm run test:run`
2. Accessibility audit: axe-core on all Svelte pages
3. Performance audit: Lighthouse, bundle analysis (confirm React removal shrinks bundle)
4. Delete React layer:
   - Remove `App.tsx`, `main.tsx`, `context/NostrContext.tsx`, `vite.config.ts`
   - Remove `/legacy` routes and wrapper
   - Remove from `package.json`: all React packages, React Router, react testing libraries
   - Delete `src/test/**/*.tsx` (React-specific tests)
5. Update `tsconfig.app.json`: remove `jsx: "react-jsx"`
6. Update `tailwind.config.js`: change content glob to `src/**/*.{svelte,ts}`
7. Deploy to Vercel staging; validate zero errors
8. Run E2E smoke tests on staging
9. **Sign-off:** Ready for production

## Verification

### Phase-End Verification
- **Phase 0:** SvelteKit dev server runs, no TypeScript errors
- **Phase 1:** All 4 POC pages fetch data, render correctly, Lighthouse ≥90
- **Phase 2:** All 10 stateless components render, accessibility ≥95 (WCAG AA)
- **Phase 3:** All routes with params work, forms submit, charts render
- **Phase 4:** All complex features work, API routes respond like old Vite middleware
- **Phase 5:** No React packages remain, bundle smaller, all E2E tests pass

### Build Verification
```bash
npm run build        # Should produce .svelte-kit/build/
npm run preview      # Should serve static files correctly
```

### Deployment Verification
1. Deploy to Vercel staging
2. Run smoke tests:
   - Load landing page → should see hero + market showcase
   - Navigate to profile/:pubkey → should fetch and render kind:0 data
   - Create market → form submits, kind:982 event created
   - Check `/api/analytics/summary` → returns JSON
3. Lighthouse on 5 key pages: ≥90
4. No 5xx errors in logs
5. No React Console warnings or errors

## Risk Mitigation

### TipTap Integration Risk
**Risk:** No official @tiptap/react successor; core API is DOM-based.
**Mitigation:** Create custom wrapper class (TiptapEditor); wrap in Svelte component with onMount/destroy lifecycle. Proven pattern; minimal (~40 lines).

### Chart Integration Risk
**Risk:** svelte-lightweight-charts unmaintained; community package may be outdated.
**Mitigation:** Use vanilla lightweight-charts API via Svelte action. Chart instances created in DOM; no wrapper needed beyond Svelte action for lifecycle.

### Bundle Size Risk
**Risk:** Svelte removal of React should shrink bundle, but if it doesn't, Phase 5 is blocked.
**Mitigation:** Measure bundle before Phase 0, after Phase 5. If size increases >10%, audit dependencies. Expected: ~45KB gzip reduction.

### Testnet/Mainnet Switching Risk
**Risk:** Relay selection (testnet vs mainnet) must work correctly; old code uses context.
**Mitigation:** Store relay URLs in env vars (already in .env.local). Svelte store computed from $page.url.searchParams or stored flag. Test both modes before Phase 1 sign-off.

### State Persistence Risk
**Risk:** localStorage stores (profileStore, walletStore, etc.) must work in SvelteKit; might differ in SSR context.
**Mitigation:** Keep all stores vanilla TS (no React hooks); they work identically. If SSR needed, wrap localStorage calls in browser check: `typeof window !== 'undefined'`.

### API Route Compatibility Risk
**Risk:** Vite middleware params parsed differently than SvelteKit URL.
**Mitigation:** Test each new API route against old Vite middleware with same request; verify identical response. Script: loop through 10 random requests, compare payloads.

## Dependency & Package Changes

### Add to package.json
```json
"svelte": "^5.0.0",
"@sveltejs/kit": "^2.0.0",
"@sveltejs/adapter-vercel": "^5.0.0",
"@nostr-dev-kit/svelte": "^0.6.0",
"svelte-check": "^3.0.0",
"svelte-preprocess": "^5.0.0",
"@tiptap/core": "^3.21.0",
"@tiptap/pm": "^3.21.0",
"@tiptap/starter-kit": "^3.21.0",
"@tiptap/extension-placeholder": "^3.21.0",
"svelte-qr": "^0.3.0",
"vitest": "^3.2.4"
```

### Remove from package.json
```json
"react": "^19.2.4",
"react-dom": "^19.2.4",
"react-router-dom": "^7.13.1",
"@tiptap/react": "^3.21.0",
"@vitejs/plugin-react": "^6.0.1",
"@testing-library/react": "^16.3.2",
"@testing-library/user-event": "^14.6.1",
"@types/react": "^19.2.14",
"@types/react-dom": "^19.2.3",
"eslint-plugin-react-hooks": "^7.0.1",
"eslint-plugin-react-refresh": "^0.5.2"
```

### Keep (No Changes)
```json
"@nostr-dev-kit/ndk": "^3.0.3",
"@nostr-dev-kit/wallet": "^1.0.0",
"@noble/hashes": "^2.0.1",
"@noble/secp256k1": "^3.0.0",
"lightweight-charts": "^5.1.0",
"markdown-it": "^14.1.1",
"posthog-js": "^1.364.7",
"@tailwindcss/vite": "^4.2.2",
"tailwindcss": "^4.2.2",
"typescript": "~5.9.3",
"vite": "^8.0.1",
"vitest": "^3.2.4"
```

## Form Handling: SvelteKit Form Actions vs Client-Side Fetch

### Trade-off Documentation (Critical Architectural Choice)

Svelte 5 + SvelteKit provides two paths for form submission. **Choose based on whether the operation requires Nostr wallet signing:**

#### 1. SvelteKit Form Actions (Progressive Enhancement)
**Use for:** Public operations, read-only queries, admin/moderation actions.
**Pros:**
- Works without JavaScript (progressive enhancement)
- Built-in CSRF protection
- Automatic form state management
- Server-side validation feedback

**Example: Update user profile (no signing needed)**
```svelte
<script lang="ts">
  import { enhance } from '$app/forms'

  let name = $state('')
  let about = $state('')
</script>

<form method="POST" use:enhance>
  <input name="name" bind:value={name} />
  <textarea name="about" bind:value={about}></textarea>
  <button>Save Profile</button>
</form>
```

**Server handler (src/routes/profile/+page.server.ts):**
```typescript
export const actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData()
    const name = data.get('name')
    const about = data.get('about')
    // Validate and update profile store
    return { success: true }
  }
}
```

#### 2. Client-Side Fetch (Required for Nostr Signing)
**Use for:** Operations requiring Nostr wallet signature (events, market creation, trades).
**Why:** Wallet signing happens in browser via NIP-07 extension; server cannot access private keys.

**Example: Create market (requires Nostr signing)**
```svelte
<script lang="ts">
  import { publishEvent } from '$lib/services/nostrService'

  let title = $state('')
  let content = $state('')
  let loading = $state(false)

  async function handleCreateMarket(e: Event) {
    e.preventDefault()
    loading = true
    try {
      // Client-side: sign with NIP-07 extension
      const event = await publishEvent(content, [['title', title]], 982)
      // Server: optional backend update (market indexing, notifications)
      await fetch('/api/markets', {
        method: 'POST',
        body: JSON.stringify({ eventId: event.id, title, content }),
        headers: { 'Content-Type': 'application/json' }
      })
      title = ''
      content = ''
    } catch (err) {
      console.error(err)
    } finally {
      loading = false
    }
  }
</script>

<form onsubmit={handleCreateMarket}>
  <input bind:value={title} placeholder="Market Title" />
  <TiptapEditor bind:value={content} />
  <button disabled={loading}>Create Market</button>
</form>
```

### Hybrid Pattern
Some operations need both: sign client-side, then record server-side.

```svelte
async function handleTrade(direction: 'yes' | 'no') {
  // 1. Client-side: sign trade event
  const event = await publishEvent(
    JSON.stringify({ direction, amount: 100 }),
    [['k', '982']],
    1111
  )

  // 2. Server-side: record trade for indexing, notifications
  const response = await fetch('/api/trades', {
    method: 'POST',
    body: JSON.stringify({ eventId: event.id, direction, amount: 100 }),
    headers: { 'Content-Type': 'application/json' }
  })

  if (response.ok) {
    // Update local positions
    positions = [...positions, ...]
  }
}
```

### Summary for Cascade
- **Form actions:** Settings page, profile updates, admin operations
- **Client-side fetch:** Market creation, trades, bookmarks, profile kind:0 updates (requires signing)
- **Hybrid:** Trading flow (sign event client, index server)

---

## Component Migration Patterns

### Pattern 1: Subscription-Based Component

**React (Activity.tsx):**
```typescript
export default function Activity() {
  const { subscribeToEvents } = useNostr()
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [filter, setFilter] = useState<ActivityFilter>('All')

  useEffect(() => {
    const sub = subscribeToEvents(
      { kinds: [982, 1111, 30000], limit: 50 },
      (event) => {
        setActivities((prev) => [parseEvent(event), ...prev].slice(0, 100))
      }
    )
    return () => sub.stop()
  }, [subscribeToEvents])

  return (
    <div>
      {activities.filter(matchesFilter).map((a) => (
        <ActivityRow key={a.id} item={a} />
      ))}
    </div>
  )
}
```

**Svelte (+page.svelte):**
```svelte
<script lang="ts">
  import { page } from '$app/stores'
  import { getNDK, subscribeToEvents } from '$lib/services/nostrService'
  import { parseEvent } from '$lib/utils/parse'

  type ActivityFilter = 'All' | 'New Markets' | 'Trades' | 'Resolutions'

  let activities: ActivityItem[] = $state([])
  let filter: ActivityFilter = $state('All')

  let subscription: NDKSubscription | null = null

  $effect.pre(() => {
    const ndk = getNDK()
    if (!ndk) return

    subscription = subscribeToEvents(
      { kinds: [982, 1111, 30000], limit: 50 },
      (event) => {
        activities = [parseEvent(event), ...activities].slice(0, 100)
      }
    )

    return () => subscription?.stop()
  })

  $derived filtered = activities.filter((a) => matchesFilter(a, filter))
</script>

<div>
  {#each filtered as item (item.id)}
    <ActivityRow {item} />
  {/each}
</div>
```

**Key Differences:**
- `useState` → `$state`
- `useEffect` cleanup → `$effect` return cleanup
- `.map()` → `{#each}`
- `useContext` → `getNDK()` directly (service, not context)

### Pattern 2: Data Fetch with Loading State

**React (ProfilePage.tsx):**
```typescript
export default function ProfilePage() {
  const { pubkey: paramPubkey } = useParams<{ pubkey: string }>()
  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      const events = await fetchEvents({
        kinds: [0],
        authors: [paramPubkey],
      })
      if (events.size > 0) {
        const event = Array.from(events)[0]
        setProfile(JSON.parse(event.content))
      }
      setLoading(false)
    }
    fetch()
  }, [paramPubkey])

  if (loading) return <div>Loading...</div>
  if (!profile) return <div>Not found</div>

  return <ProfileDisplay profile={profile} />
}
```

**Svelte (+page.svelte) — Correct Pattern (Svelte 5):**
```svelte
<script lang="ts">
  import { page } from '$app/stores'
  import { fetchEvents } from '$lib/services/nostrService'

  const pubkey = $page.params.pubkey

  let profile: ProfileData | null = $state(null)
  let loading: boolean = $state(true)

  // CORRECT: Separate async function called FROM the effect, not IN it
  async function loadProfile(pk: string) {
    loading = true
    try {
      const events = await fetchEvents({
        kinds: [0],
        authors: [pk],
      })
      if (events.size > 0) {
        const event = Array.from(events)[0]
        profile = JSON.parse(event.content)
      } else {
        profile = null
      }
    } finally {
      loading = false
    }
  }

  // CORRECT: $effect is synchronous; it calls the async function
  $effect.pre(() => {
    loadProfile(pubkey)
  })
</script>

{#if loading}
  <div>Loading...</div>
{:else if !profile}
  <div>Not found</div>
{:else}
  <ProfileDisplay {profile} />
{/if}
```

**Key Differences:**
- `useParams` → `$page.params`
- `useEffect(() => { const fetch = async () => {...}; fetch() })` → separate `async function` + synchronous `$effect.pre()` that calls it
  - ⚠️ **Important:** `$effect` must be synchronous; async functions must be called FROM the effect body, not await'd within it
- Conditional rendering: `{#if}` blocks instead of ternary
- **Reactivity:** `$effect.pre()` re-runs whenever `pubkey` (a reactive value it references) changes

### Pattern 3: Form Submission with Action

**React (ThesisBuilder.tsx):**
```typescript
export default function ThesisBuilder() {
  const { publishEvent } = useNostr()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await publishEvent(content, [['title', title]], 982)
      // Redirect or show success
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TiptapEditor value={content} onChange={setContent} />
      <button disabled={loading}>Create Market</button>
    </form>
  )
}
```

**Svelte (+page.svelte with form action):**
```svelte
<script lang="ts">
  import { enhance } from '$app/forms'
  import TiptapEditor from '$lib/components/TiptapEditor.svelte'

  let title: string = $state('')
  let content: string = $state('')
  let loading: boolean = $state(false)

  async function handleSubmit(event: SubmitEvent) {
    const form = event.target as HTMLFormElement
    loading = true
    const response = await fetch('/api/markets', {
      method: 'POST',
      body: JSON.stringify({ title, content, kind: 982 }),
      headers: { 'Content-Type': 'application/json' }
    })
    loading = false
    if (response.ok) {
      title = ''
      content = ''
      // Show success
    }
  }
</script>

<form onsubmit={handleSubmit}>
  <input type="text" bind:value={title} />
  <TiptapEditor bind:value={content} />
  <button disabled={loading}>Create Market</button>
</form>
```

**Key Differences:**
- `onChange` callbacks → `bind:value` (two-way binding)
- `onSubmit` with `e.preventDefault()` → `onsubmit` (lowercase, implicit prevent default in Svelte)
- Form submission to API route (SvelteKit convention; can also use `enhance` from `$app/forms`)
- `useNostr()` call removed; service used directly

### Pattern 3b: Effect Dependencies and Reactivity Semantics (Svelte 5)

**Understanding $effect Re-runs:**

In Svelte 5, `$effect` re-runs whenever ANY reactive value it references changes. This is automatic — no explicit dependency array needed like React's `useEffect`.

```svelte
<script lang="ts">
  let marketId: string = $state('')
  let filter: 'all' | 'yes' | 'no' = $state('all')

  let events: any[] = $state([])
  let loading: boolean = $state(false)

  async function fetchMarketEvents(id: string, f: string) {
    loading = true
    const result = await fetch(`/api/market/${id}/events?filter=${f}`)
    events = await result.json()
    loading = false
  }

  // This effect re-runs whenever marketId OR filter change
  // (because the effect function references both)
  $effect.pre(() => {
    fetchMarketEvents(marketId, filter)
  })
</script>
```

**Why $effect.pre()?**
- `$effect.pre()` runs **before** the component renders, ideal for data fetching
- `$effect()` runs **after** render, ideal for DOM side-effects (e.g., focus, scrolling)

**Avoiding Unnecessary Re-runs:**
If you want the effect to run only when `marketId` changes (not `filter`), restructure:

```svelte
<script lang="ts">
  let marketId: string = $state('')
  let filter: 'all' | 'yes' | 'no' = $state('all')

  // Derived: computed from marketId only
  let events = $derived.by(async () => {
    const result = await fetch(`/api/market/${marketId}/events`)
    return await result.json()
  })

  // Separate filter logic
  let filtered = $derived(events.filter(e => filter === 'all' || e.stance === filter))
</script>
```

(Note: `$derived.by()` with async requires careful error handling; use plain `$effect.pre()` + state for clearer control.)

### Pattern 4: Chart Rendering

**React (PriceChart.tsx):**
```typescript
import { createChart } from 'lightweight-charts'

export default function PriceChart({ data }: { data: PricePoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 300,
      timeScale: { timeVisible: true },
    })

    const series = chart.addLineSeries({ color: '#22c55e' })
    series.setData(data)
    chart.timeScale().fitContent()

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [data])

  return <div ref={containerRef} style={{ width: '100%', height: 300 }} />
}
```

**Svelte (component with action):**
```svelte
<script lang="ts">
  import { chart } from '$lib/utils/lightweight-charts-action'
  import type { PricePoint } from '$lib/types'

  let { data }: { data: PricePoint[] } = $props()

  let containerDiv: HTMLDivElement

  $effect(() => {
    if (!containerDiv) return
    const instance = chart(containerDiv, {
      width: containerDiv.clientWidth,
      height: 300,
      timeScale: { timeVisible: true },
    })
    const series = instance.addLineSeries({ color: '#22c55e' })
    series.setData(data)
    instance.timeScale().fitContent()
    return () => instance.remove()
  })
</script>

<div bind:this={containerDiv} style="width: 100%; height: 300px;" />
```

**Key Differences:**
- `useRef` → `bind:this`
- `useEffect` → `$effect`
- Manual resize listener → handled by action or component (Svelte reactive)

### Pattern 5: Component Props (Svelte 5 $props())

**React (UserAvatar.tsx):**
```typescript
type UserAvatarProps = {
  pubkey: string
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

export default function UserAvatar({ pubkey, size = 'md', showLabel = false }: UserAvatarProps) {
  const bg = getColorFromPubkey(pubkey)
  const initials = pubkey.slice(0, 4).toUpperCase()

  return (
    <div className={`avatar avatar-${size}`} style={{ backgroundColor: bg }}>
      {initials}
      {showLabel && <span className="label">{abbreviate(pubkey)}</span>}
    </div>
  )
}
```

**Svelte (component.svelte) — Idiomatic Svelte 5 $props():**
```svelte
<script lang="ts">
  import { getColorFromPubkey, abbreviate } from '$lib/utils/pubkey'

  type Props = {
    pubkey: string
    size?: 'sm' | 'md' | 'lg'
    showLabel?: boolean
  }

  const { pubkey, size = 'md', showLabel = false }: Props = $props()

  const bg = getColorFromPubkey(pubkey)
  const initials = pubkey.slice(0, 4).toUpperCase()
</script>

<div class={`avatar avatar-${size}`} style="background-color: {bg}">
  {initials}
  {#if showLabel}
    <span class="label">{abbreviate(pubkey)}</span>
  {/if}
</div>

<style>
  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.25rem;
  }
  .avatar-sm { width: 1.5rem; height: 1.5rem; }
  .avatar-md { width: 2rem; height: 2rem; }
  .avatar-lg { width: 3rem; height: 3rem; }
</style>
```

**Key Differences:**
- Props destructuring in script with `$props()` rune (Svelte 5 idiom)
- No prop types file needed (type defined inline)
- Two-way binding implicit (if parent passes `bind:pubkey`, automatically synced)
- Scoped styles (no className overhead)

## Testing Migration Strategy

### Vitest Setup (No Changes)
Vitest already in use; no migration needed. Tests remain in `src/test/` with same tooling.

### Testing React Components → Svelte Components

**Before (React Testing Library):**
```typescript
import { render, screen } from '@testing-library/react'
import Activity from '../Activity'

test('Activity renders and filters', async () => {
  const { rerender } = render(<Activity />)
  // Mock subscription
  expect(screen.getByText(/activity/i)).toBeInTheDocument()
})
```

**After (Vitest + Svelte Testing Library):**
```typescript
import { render, screen } from '@testing-library/svelte'
import Activity from '../routes/activity/+page.svelte'

test('Activity renders and filters', async () => {
  const { component } = render(Activity)
  // Tests same assertions
  expect(screen.getByText(/activity/i)).toBeInTheDocument()
})
```

**Action:** Update test files to use Svelte Testing Library instead of React Testing Library. Process:
1. Replace `@testing-library/react` with `@testing-library/svelte`
2. Update imports: `import { render, screen } from '@testing-library/svelte'`
3. Remove `<Component />` JSX syntax; pass Svelte component directly
4. Remove cleanup (Svelte Testing Library handles it)

### Testing Svelte Actions

Actions are pure functions; test them separately from components.

**Example: Test lightweight-charts action**
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { chart } from '../lightweight-charts-action'

describe('chart action', () => {
  let container: HTMLDivElement
  let mockCreateChart: any

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    // Mock lightweight-charts if needed
    mockCreateChart = vi.fn().mockReturnValue({
      addLineSeries: vi.fn().mockReturnValue({
        setData: vi.fn(),
        remove: vi.fn(),
      }),
      applyOptions: vi.fn(),
      timeScale: vi.fn().mockReturnValue({ fitContent: vi.fn() }),
      remove: vi.fn(),
    })
  })

  afterEach(() => {
    container.remove()
  })

  it('should create chart instance', () => {
    const result = chart(container, { width: 400, height: 300 })
    expect(result.destroy).toBeDefined()
  })

  it('should update chart on update() call', () => {
    const instance = chart(container, { width: 400 })
    instance.update({ height: 500 })
    // Assert that applyOptions was called
  })

  it('should cleanup on destroy', () => {
    const instance = chart(container, {})
    instance.destroy()
    // Assert remove() was called on chart
  })
})
```

**Example: Test TipTap wrapper**
```typescript
import { describe, it, expect } from 'vitest'
import { TipTapEditor } from '../tiptap-wrapper'

describe('TipTapEditor', () => {
  it('should initialize with content', () => {
    const container = document.createElement('div')
    const editor = new TipTapEditor(container, '# Heading')
    expect(editor.getContent()).toContain('Heading')
    editor.destroy()
  })

  it('should update content', () => {
    const container = document.createElement('div')
    const editor = new TipTapEditor(container, '')
    editor.setContent('New content')
    expect(editor.getContent()).toContain('New content')
    editor.destroy()
  })
})
```

### New Dependencies for Testing
```json
"@testing-library/svelte": "^4.0.0"
```

## Build & Deployment Changes

### Local Development
```bash
npm run dev
```
Starts SvelteKit Vite dev server on `localhost:5173`.

### Build Process
```bash
npm run build
```
Produces `.svelte-kit/build/` (static HTML + JS + assets).

### Deployment to Vercel

**vercel.json (update if needed):**
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".svelte-kit/build",
  "framework": "sveltekit"
}
```

**Environment Variables:**
Existing `.env.local` variables (relay URLs, testnet flag) read at build time via `$env/static/private` in SvelteKit, or at runtime via `import.meta.env.PUBLIC_*` for client-side.

### Performance & Bundle Size

**Expected Size Reduction:**
- React + React Router removed: ~45KB gzipped saved
- Svelte compiler overhead: ~3KB gzipped added
- Net: ~42KB gzipped smaller

**Verification:**
```bash
npm run build
du -h .svelte-kit/build/_app/immutable/chunks/
```
Compare before (React) and after (Svelte).

## Alternative & Rejected Approaches

### Alternative 1: Gradual Migration with Parallel Build
Keep React and Svelte in same build, route `/` to Svelte, `/legacy/*` to React, use micro-frontend approach.
**Rejected:** Complexity of dual bundling, bundle duplication, no clear removal path. Simpler to route at HTTP level.

### Alternative 2: Use `@tiptap/svelte` (Non-Existent Package)
Hoped for official Svelte wrapper.
**Rejected:** Doesn't exist; core API suffices via custom wrapper.

### Alternative 3: SvelteKit SSR + Hydration for Performance
Full server-rendering of pages for faster FCP.
**Rejected:** Nostr data inherently client-side (requires wallet connection); SSR adds complexity without benefit. SvelteKit pre-rendering on build is sufficient.

### Alternative 4: Keep Vite + Svelte (No SvelteKit)
Possible; Svelte 5 works with Vite directly.
**Rejected:** SvelteKit provides file-based routing, server routes, and Vercel integration out-of-box. Adding these manually is larger effort.

## Success Criteria

### End-of-Phase Verification

| Phase | Criteria | Verification Method |
|-------|----------|---------------------|
| 0 | SvelteKit boots, no TS errors | `npm run dev` starts server, `npm run build` succeeds |
| 1 | All 4 POC pages load + fetch + render correctly | Load in browser, inspect data, Lighthouse ≥90 |
| 2 | All 10 components render, accessibility ≥95 | `npm run test`, axe-core audit |
| 3 | Routes, forms, charts work | Test all routes, submit forms, verify data |
| 4 | API routes match Vite middleware | Compare req/response for 10 random calls |
| 5 | React fully removed, bundle smaller, E2E pass | Dependency audit, `du -h`, E2E smoke tests |

### Final Sign-Off
- [ ] Zero React packages in package.json
- [ ] Bundle size decreased by ≥40KB gzipped
- [ ] All Svelte pages pass Lighthouse ≥90
- [ ] All Svelte pages pass WCAG AA accessibility audit
- [ ] E2E smoke tests pass on Vercel staging
- [ ] No Console errors or warnings (React or otherwise)
- [ ] All 13 API routes respond identically to Vite middleware
- [ ] Deployment to production succeeds

## Implementation Checklist

### Phase 0
- [ ] Install SvelteKit, Svelte, adapter-vercel
- [ ] Create svelte.config.js
- [ ] Create src/routes/+layout.svelte with NostrContextProvider
- [ ] Create src/lib/stores/nostr.ts
- [ ] Create src/lib/utils/tiptap-wrapper.ts
- [ ] Create src/lib/utils/lightweight-charts-action.ts
- [ ] Update tsconfig.json
- [ ] Update package.json (add dependencies)
- [ ] Verify npm run dev works
- [ ] Verify npm run build succeeds

### Phase 1
- [ ] Port Activity.tsx → src/routes/activity/+page.svelte
- [ ] Port AnalyticsDashboard.tsx → src/routes/analytics/+page.svelte
- [ ] Port ProfilePage.tsx → src/routes/profile/[pubkey]/+page.svelte
- [ ] Port ThreadPage.tsx → src/routes/thread/[marketId]/+page.svelte
- [ ] Test all 4 pages (data load, render, Lighthouse)
- [ ] Run Phase 1 tests
- [ ] Sign-off: POC validated

### Phase 2
- [ ] Port Footer, TestnetBanner, UserAvatar, BookmarkButton, EmbedModal
- [ ] Port HowItWorks, Privacy, Terms, Blog pages
- [ ] Accessibility audit on all 10 components
- [ ] Sign-off: Stateless foundation validated

### Phase 3
- [ ] Port MarketDetail, Portfolio, DashboardOverview, DiscussPage, SettingsPage
- [ ] Create MarketCard reusable component
- [ ] Update src/routes/+layout.svelte with NavHeader, Footer
- [ ] Test all routes, forms, charts
- [ ] Sign-off: Routing validated

### Phase 4
- [ ] Create TiptapEditor.svelte wrapper
- [ ] Port ThesisBuilder, WalletPage, update landing page
- [ ] Migrate all 13 API routes to SvelteKit
- [ ] Test all API routes match Vite middleware
- [ ] Create /legacy wrapper (if needed for transition)
- [ ] Sign-off: Feature parity achieved

### Phase 5
- [ ] Run full test suite
- [ ] Accessibility audit (all pages)
- [ ] Performance audit (Lighthouse, bundle)
- [ ] Remove React dependencies and files
- [ ] Deploy to Vercel staging
- [ ] Run E2E smoke tests on staging
- [ ] Sign-off: Ready for production

---

## Appendix: Code Snippets

### svelte.config.js
```javascript
import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $lib: 'src/lib',
      $routes: 'src/routes',
    },
  },
}
```

### src/routes/+layout.svelte
```svelte
<script lang="ts">
  import { NostrContextProvider } from '$lib/context/NostrContext.svelte'
  import NavHeader from '$lib/components/NavHeader.svelte'
  import Footer from '$lib/components/Footer.svelte'
  import '../app.css'
</script>

<NostrContextProvider>
  <NavHeader />
  <main>
    <slot />
  </main>
  <Footer />
</NostrContextProvider>

<style>
  :global(body) {
    @apply bg-neutral-950 text-white;
  }
</style>
```

### src/lib/stores/nostr.ts
```typescript
import { writable, derived } from 'svelte/store'
import type NDK from '@nostr-dev-kit/ndk'

export const pubkey = writable<string | null>(null)
export const ndkInstance = writable<NDK | null>(null)
export const isReady = writable(false)

export const isLoggedIn = derived(pubkey, ($pubkey) => $pubkey !== null)
```

### src/lib/context/NostrContext.svelte
```svelte
<script lang="ts">
  import { setContext } from 'svelte'
  import { initNostrService, getNDK, getPubkey } from '$lib/services/nostrService'
  import { pubkey, ndkInstance, isReady } from '$lib/stores/nostr'

  const TESTNET_RELAYS = [
    'wss://relay.nostr.band',
    'wss://nos.lol',
    'wss://relay.primal.net',
  ]
  const MAINNET_RELAYS = [
    'wss://nostr.wine',
    'wss://nos.lol',
    'wss://relay.primal.net',
  ]

  const relayUrls = import.meta.env.PUBLIC_TESTNET === 'true' ? TESTNET_RELAYS : MAINNET_RELAYS

  onMount(async () => {
    await initNostrService(relayUrls)
    pubkey.set(getPubkey())
    ndkInstance.set(getNDK())
    isReady.set(true)
  })

  setContext('nostr', {
    pubkey: { subscribe: pubkey.subscribe },
    ndkInstance: { subscribe: ndkInstance.subscribe },
    isReady: { subscribe: isReady.subscribe },
  })
</script>

<slot />
```

### src/routes/api/markets/+server.ts
```typescript
import type { RequestHandler } from './$types'
import { publishMarket } from '$lib/services/nostrService'

export const POST: RequestHandler = async ({ request, locals }) => {
  const { title, content, kind } = await request.json()

  try {
    const event = await publishMarket(content, [['title', title]], kind)
    return new Response(JSON.stringify({ eventId: event.id }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Failed to publish market' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
```
