# React-to-Svelte Full Port — Comprehensive Porting Strategy

## Executive Summary

Cascade is a React 19 + react-router-dom application with 45+ TSX components, custom Vite middleware for agent/analytics APIs, NDK 3.0.3 for Nostr integration, and localStorage-backed service layer. This plan outlines a **phased, incremental port to SvelteKit + Svelte 5**, migrating components in dependency order (simple → complex), enabling **concurrent React/Svelte routing during transition**, and removing React only after Phase 4 completes. The migration preserves all pure TS services (marketService, nostrService, positionService, etc.) and reuses Tailwind + NDK without modification.

---

## Approach

### Why SvelteKit + Svelte 5?

1. **File-based routing** — replaces react-router-dom with SvelteKit's `src/routes/` structure; eliminates manual route config
2. **Reactive stores** — replaces React Context with Svelte stores (`writable`, `derived`); eliminates useContext/Context boilerplate
3. **Form actions** — SvelteKit's `+page.server.ts` replaces useEffect + fetch patterns for data loading
4. **Incremental adoption** — SvelteKit can wrap the entire app; React routes coexist during transition
5. **Smaller bundle** — Svelte compiles to minimal JS; React removal saves ~50KB gzipped

### Why This Approach Over Alternatives

| Approach | Rejection Reason |
|----------|------------------|
| **Parallel build** (React + Svelte as separate bundles) | Increases build complexity, duplication, requires routing glue layer. File-based routing coexistence is simpler. |
| **Incremental Component Rewrite** (no routing change) | Keeps react-router-dom; doesn't leverage SvelteKit's strengths; no bundle size wins; mixing paradigms is awkward. |
| **Micro-frontends** (isolate Svelte in iframe) | Overkill; adds iframes, context bridge complexity; defeats purpose of single app. |
| **Complete rewrite** (all at once) | Risky; blocks shipping; high breakage surface. Phased approach lets us ship working pages incrementally. |

### Strategy Summary

1. **Phase 1 (PoC)**: Port 4 isolated pages (Activity, AnalyticsDashboard, ProfilePage, ThreadPage) → establish Svelte + SvelteKit patterns, store structure, NDK integration
2. **Phase 2 (Simple pages)**: Port static/low-state pages (LandingPage, HowItWorks, LegalPages, NotFoundPage) → confidence + coverage
3. **Phase 3 (Routing/Params)**: Port pages with route parameters and derived state (MarketDetail, Portfolio, Leaderboard) → handle dynamic routing in SvelteKit
4. **Phase 4 (Complex)**: Port App.tsx routing orchestration, state machine (reducer), WalletPage, ThesisBuilder → full app interactivity
5. **Phase 5 (Polish)**: Nav, styling alignment, bundle optimization, remove React completely

**During transition (Phases 1–4):**
- SvelteKit is the primary build system and router
- SvelteKit's fallback routes (`+page.svelte`) serve React pages at their original URLs
- Routing between old (React) and new (Svelte) pages works seamlessly
- No user-facing disruption; gradual migration

**After Phase 4:**
- Remove react, react-dom, react-router-dom, @vitejs/plugin-react from package.json
- Delete src/context/, src/App.tsx, all React component files
- Clean up Vite config (remove @vitejs/plugin-react)

---

## Phased Breakdown with Dependencies

### Phase 1: Proof of Concept (4 pages)

**Pages to port:** Activity, AnalyticsDashboard, ProfilePage, ThreadPage

**Why these?**
- **Activity.tsx**: Bulk fetches events, renders list with filters; no route params; establishes fetch + list pattern
- **AnalyticsDashboard.tsx**: Minimal state, simple fetch + render; uses /api/analytics (custom middleware endpoint)
- **ProfilePage.tsx**: Uses route params (pubkey), normalizes npub/hex, fetches Kind 0 + positions; establishes load() function + params pattern
- **ThreadPage.tsx**: Nested replies, subscriptions, optimistic updates; establishes subscription + reactive updates pattern

**Deliverables:**
- `svelte.config.js` (new)
- `src/routes/+layout.svelte` (top-level layout wrapping all pages)
- `src/routes/activity/+page.svelte` + `+page.ts`
- `src/routes/analytics/+page.svelte` + `+page.ts`
- `src/routes/profile/[pubkey]/+page.svelte` + `+page.ts`
- `src/routes/threads/[id]/+page.svelte` + `+page.ts`
- `src/lib/stores/nostr.ts` (Nostr context → Svelte store; replaces NostrContext.tsx)
- `src/lib/stores/ui.ts` (UI state store; replaces scattered useState calls)
- Updated `vite.config.ts` → `vite.config.js` (SvelteKit standard)
- Migrate `/api/analytics` and `/api/agent` Vite plugins to SvelteKit `src/routes/api/` routes

**Blockers & Decisions:**
- **SvelteKit adapter**: Use `adapter-auto` for dev (automatic, works with Vite dev server). For production, use `adapter-node` (Node.js runtime, handles /api/* routes)
- **@nostr-dev-kit/svelte**: Check if v3.0.3 has Svelte bindings. If not, create wrapper stores around NDK instance.

---

### Phase 2: Simple Pages (5 pages)

**Pages to port:** HowItWorks, LandingPage, LegalPages, NotFoundPage, Blog

**Why?**
- No route params (except NotFoundPage as catch-all)
- Minimal state (mostly static renders)
- No subscriptions
- Quick wins; builds confidence

**Dependencies:** Phase 1 complete (stores, routing patterns established)

**Changes:**
- `src/routes/how-it-works/+page.svelte`
- `src/routes/legal/[type]/+page.svelte` (LegalPages as parameterized route)
- `src/routes/blog/+page.svelte`
- `src/routes/+error.svelte` (NotFoundPage; SvelteKit 404 handler)

---

### Phase 3: Dynamic Routing & Params (5 pages)

**Pages to port:** MarketDetail, AgentsPage, Portfolio, Leaderboard, SettingsPage

**Why?**
- Dynamic route params: `/market/[id]`, `/agents/[agentId]`, `/portfolio/[pubkey]`
- Derived state from route + store
- Load functions with fetch + cache
- Error handling for invalid params

**Dependencies:** Phase 1 & 2 complete

**Changes:**
- `src/routes/market/[id]/+page.svelte` + `+page.ts`
- `src/routes/agents/[id]/+page.svelte` + `+page.ts`
- `src/routes/portfolio/[pubkey]/+page.svelte` + `+page.ts`
- `src/routes/leaderboard/+page.svelte` + `+page.ts`
- `src/routes/settings/+page.svelte` + `+page.ts`

---

### Phase 4: Complex State & Interactivity (5 pages + App orchestration)

**Pages to port:** App.tsx (router orchestration), WalletPage, ThesisBuilder, DashboardOverview, TreasuryPage

**Why App.tsx is critical:**
- Manages global market state (`useReducer` → Svelte store with reducer functions)
- Toast notifications (action → store)
- Market subscriptions & syncing
- Publishing, trading, resolution

**Why these pages?**
- **WalletPage**: Form input, wallet state mutations
- **ThesisBuilder**: Rich form, editor (TipTap), complex state
- **DashboardOverview**: Market overview with subscriptions
- **TreasuryPage**: Finance calculations

**Dependencies:** Phase 1, 2, 3 complete

**Changes:**
- `src/lib/stores/market.ts` (App.tsx reducer → writable store with update functions)
- `src/lib/stores/toast.ts` (toast notifications)
- `src/routes/+layout.svelte` (root layout with toast renderer)
- `src/routes/wallet/+page.svelte` + `+page.ts`
- `src/routes/create/+page.svelte` + `+page.ts` (ThesisBuilder)
- `src/routes/dashboard/+page.svelte` + `+page.ts`
- `src/routes/treasury/+page.svelte` + `+page.ts`
- Delete `src/App.tsx`, `src/context/NostrContext.tsx`

**Routing changes:**
- Remove react-router-dom; replace with SvelteKit file-based routing
- All navigation: `navigate()` → `goto()` or `<a href="/path">`

---

### Phase 5: Polish & Optimization

**Tasks:**
- Migrate NavHeader component (shared across all pages)
- Verify Tailwind 4.2.2 compatibility with Svelte 5
- Update `tailwind.config.js` to include Svelte file patterns: `"./src/**/*.{js,ts,jsx,tsx,svelte}"`
- Unit tests: Vitest continues; add Vitest + SvelteKit integration
- E2E tests: Playwright (add or update existing)
- Remove React dependencies entirely
- Bundle optimization: analyze with `vite-plugin-visualizer`
- Accessibility audit: test with axe-core or Lighthouse
- Performance testing: Lighthouse, Core Web Vitals

---

## SvelteKit Setup Instructions

### 1. Install Dependencies

```bash
npm install -D svelte @sveltejs/kit @sveltejs/adapter-auto
npm install @nostr-dev-kit/svelte  # Check if exists; if not, wrap NDK manually
```

### 2. Create `svelte.config.js`

```javascript
import adapter from '@sveltejs/adapter-auto';

export default {
  kit: {
    adapter: adapter(),
    // Use adapter-node for production with /api/* routes
    // adapter: adapter({ out: 'build', precompress: true })
  },
};
```

For production, switch to `adapter-node`:

```javascript
import adapter from '@sveltejs/adapter-node';

export default {
  kit: {
    adapter: adapter({
      out: 'build',
      precompress: false,
    }),
  },
};
```

### 3. Migrate Vite Config

**Current:** `vite.config.ts` with React plugin + custom middleware
**Goal:** `vite.config.js` with SvelteKit integration

SvelteKit automatically uses its own Vite config. Custom `vite.config.js` is optional but can extend it:

```javascript
import { defineConfig } from 'vite';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __COMMIT_HASH__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev'),
  },
});
```

**Custom API plugins** (agentApiPlugin, analyticsApiPlugin) are no longer needed in dev because they move to SvelteKit routes. In production, keep them as **SvelteKit API routes** (`src/routes/api/+server.ts`).

### 4. Create SvelteKit Routes Directory

```
src/
├── routes/
│   ├── +layout.svelte         # Root layout (header, toast)
│   ├── +layout.ts             # Root load function (auth, init)
│   ├── +error.svelte          # Error page (404, 500)
│   ├── +page.svelte           # Home page (landing)
│   ├── api/
│   │   ├── agent/
│   │   │   └── +server.ts     # /api/agent/* endpoints
│   │   └── analytics/
│   │       └── +server.ts     # /api/analytics endpoints
│   ├── activity/
│   │   ├── +page.svelte
│   │   └── +page.ts
│   ├── analytics/
│   │   ├── +page.svelte
│   │   └── +page.ts
│   ├── profile/
│   │   └── [pubkey]/
│   │       ├── +page.svelte
│   │       └── +page.ts
│   ├── market/
│   │   └── [id]/
│   │       ├── +page.svelte
│   │       └── +page.ts
│   └── ... (other routes)
└── lib/
    └── stores/
        ├── nostr.ts       # Replaces NostrContext
        ├── ui.ts          # UI state
        ├── market.ts      # Market state (from App.tsx reducer)
        └── toast.ts       # Toast notifications
```

### 5. Update `tailwind.config.js`

```javascript
export default {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,svelte}",  // Add .svelte
  ],
  theme: { /* ... */ },
  plugins: [],
};
```

### 6. Update `tsconfig.json`

SvelteKit auto-generates TypeScript config. Update to reference it:

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "noEmit": true,
  },
  "include": ["src"]
}
```

### 7. Migrate `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "test": "vitest",
    "test:run": "vitest --run",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "check": "svelte-kit sync && tsc"
  }
}
```

---

## Store Migration Guide: Context → Svelte Stores

### Current Pattern (React Context)

```typescript
// src/context/NostrContext.tsx
const NostrContext = createContext<NostrContextValue | null>(null);

export function NostrContextProvider({ children }) {
  const [pubkey, setPubkey] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  // ...
  return <NostrContext.Provider value={value}>{children}</NostrContext.Provider>;
}

// Usage in components
const { pubkey, ndkInstance } = useNostr();
```

### New Pattern (Svelte Stores)

```typescript
// src/lib/stores/nostr.ts
import { writable, readable, derived } from 'svelte/store';
import type NDK from '@nostr-dev-kit/ndk';

interface NostrState {
  pubkey: string | null;
  isReady: boolean;
  ndkInstance: NDK | null;
}

const initialState: NostrState = {
  pubkey: null,
  isReady: false,
  ndkInstance: null,
};

export const nostr = writable<NostrState>(initialState);

// Derived store for convenience
export const pubkey = derived(nostr, ($nostr) => $nostr.pubkey);
export const isReady = derived(nostr, ($nostr) => $nostr.isReady);

// Initialization function (call in +layout.ts)
export async function initializeNostr(testnet: boolean) {
  const relayUrls = testnet
    ? ['wss://relay.nostr.band', 'wss://nos.lol']
    : ['wss://nostr.wine', 'wss://nos.lol'];
  
  const ndk = await initNostrService(relayUrls);
  nostr.set({
    pubkey: getPubkey(),
    isReady: true,
    ndkInstance: ndk,
  });
}

// Update function
export function setNDK(ndkInstance: NDK) {
  nostr.update((state) => ({ ...state, ndkInstance }));
}
```

### Usage in Svelte Components

```svelte
<!-- src/routes/activity/+page.svelte -->
<script lang="ts">
  import { nostr } from '$lib/stores/nostr';

  let items = [];
  let loading = true;

  onMount(async () => {
    const ndk = $nostr.ndkInstance;
    if (!ndk) return;
    
    items = await fetchActivityItems(ndk);
    loading = false;
  });
</script>

{#if loading}
  <p>Loading...</p>
{:else}
  {#each items as item (item.id)}
    <div>{item.title}</div>
  {/each}
{/if}
```

### Reactive Derived Stores (Replace useCallback + useMemo)

```typescript
// src/lib/stores/market.ts
import { writable, derived } from 'svelte/store';

export const markets = writable<Record<string, Market>>({});

// Derived: markets with calculated metrics
export const marketsWithMetrics = derived(markets, ($markets) =>
  Object.entries($markets).map(([id, market]) => ({
    ...market,
    priceLong: priceLong(market.qLong, market.qShort, market.b),
  }))
);

// Usage in component
import { marketsWithMetrics } from '$lib/stores/market';

// In Svelte component:
// {#each $marketsWithMetrics as market (market.id)}
//   <div>{market.priceLong}</div>
// {/each}
```

### Async Data Loading (Replace useEffect + fetch)

**Old pattern (React):**
```typescript
useEffect(() => {
  setLoading(true);
  fetch('/api/analytics/summary')
    .then((r) => r.json())
    .then(setSummary)
    .catch(setError)
    .finally(() => setLoading(false));
}, []);
```

**New pattern (SvelteKit):**
```typescript
// src/routes/analytics/+page.ts
export async function load({ fetch }) {
  const response = await fetch('/api/analytics/summary');
  if (!response.ok) throw error(500, 'Failed to load analytics');
  
  return {
    summary: await response.json(),
  };
}
```

```svelte
<!-- src/routes/analytics/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  
  export let data: PageData;
</script>

<div>
  <p>Daily Active: {data.summary.dailyActiveSessions}</p>
</div>
```

---

## Coexistence Implementation: Concurrent React + Svelte Routing

### How It Works

1. **SkeliteKit is the primary router** — all requests go through `src/routes/`
2. **React pages are served as fallback** — unmigrated React pages remain in `src/` and are bundled with the app
3. **Routing glue** — SvelteKit routes for new pages; React pages accessible via wildcard routes
4. **No rebuild needed** — React/Svelte coexist in the same bundle

### Implementation

#### Option A: Vite Dev Adapter (Simplest)

Use SkeliteKit's `adapter-auto` in dev (automatically serves React fallback via Vite plugin).

**Setup:**
1. SkeliteKit routes are created first (`src/routes/activity/+page.svelte`, etc.)
2. React App.tsx remains; routes not yet ported fall back to React's router
3. In dev, navigating to an unmigrated route triggers Vite's React plugin

**Limitation:** Only works in dev with `vite dev`. For production, requires different approach.

#### Option B: Explicit Fallback Route (Production-Ready)

Create a catch-all SkeliteKit route that renders the React app for unmigrated paths.

**File: `src/routes/[...slug]/+page.svelte`**
```svelte
<script lang="ts">
  import { browser } from '$app/environment';
  import ReactApp from './ReactApp.svelte';
  
  // This route catches all unmigrated paths
  // Renders React App which uses its own router
</script>

<ReactApp />
```

**File: `src/routes/[...slug]/ReactApp.svelte`**
```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  
  let AppComponent: any;
  let appContainer: HTMLDivElement;
  
  onMount(async () => {
    // Dynamically import and render React App
    const { default: App } = await import('../../App');
    const root = ReactDOM.createRoot(appContainer);
    root.render(<App />);
    
    return () => root.unmount();
  });
</script>

<div bind:this={appContainer} />
```

**Advantage:** Seamless fallback; old routes work as-is.
**Disadvantage:** Doubles bundle size (React + Svelte); increases complexity.

#### Option C: Planned Deprecation (Recommended)

1. **Phase 1–3:** Port high-traffic pages first → most users hit Svelte routes
2. **Phase 4:** Port remaining complex pages and App.tsx
3. **Phase 5:** Delete React entirely

During Phase 1–4, keep React in bundle but mark old routes as "legacy" (redirect prompts or deprecation notices). Once all pages are ported, delete React code.

**Implementation:**
- Create SkeliteKit routes incrementally
- In `+layout.svelte`, detect old routes and show "this route is legacy" message (optional)
- After Phase 4, delete src/App.tsx and fallback routes; remove React from package.json

---

## File Migration Reference

| Old File | New File | Type | Notes |
|----------|----------|------|-------|
| `src/Activity.tsx` | `src/routes/activity/+page.svelte` | Page | List + filters → reactive list |
| `src/AnalyticsDashboard.tsx` | `src/routes/analytics/+page.svelte` | Page | Fetch in +page.ts → use load() |
| `src/ProfilePage.tsx` | `src/routes/profile/[pubkey]/+page.svelte` | Page | Route param handling |
| `src/ThreadPage.tsx` | `src/routes/threads/[id]/+page.svelte` | Page | Subscriptions → reactive store |
| `src/LandingPage.tsx` | `src/routes/+page.svelte` | Page | Static render |
| `src/HowItWorks.tsx` | `src/routes/how-it-works/+page.svelte` | Page | Static render |
| `src/LegalPages.tsx` | `src/routes/legal/[type]/+page.svelte` | Page | Parameterized route |
| `src/MarketDetail.tsx` | `src/routes/market/[id]/+page.svelte` | Page | Subscriptions + params |
| `src/Portfolio.tsx` | `src/routes/portfolio/[pubkey]/+page.svelte` | Page | Derived state |
| `src/WalletPage.tsx` | `src/routes/wallet/+page.svelte` | Page | Form submission |
| `src/ThesisBuilder.tsx` | `src/routes/create/+page.svelte` | Page | Rich form + editor |
| `src/App.tsx` | `src/lib/stores/market.ts` | Store | Reducer → store + functions |
| `src/context/NostrContext.tsx` | `src/lib/stores/nostr.ts` | Store | Context → writable + derived |
| `src/NavHeader.tsx` | `src/lib/components/NavHeader.svelte` | Component | Reusable nav component |
| `src/components/*.tsx` | `src/lib/components/*.svelte` | Components | Straightforward conversion |

---

## API Routes Migration

### Current Setup (Vite Middleware)

```typescript
// vite.config.ts
function agentApiPlugin() {
  return {
    name: 'cascade-agent-api-mock',
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/agent')) {
          // Handle /api/agent/* requests
        }
      });
    },
  };
}
```

### New Setup (SkeliteKit Routes)

**File: `src/routes/api/agent/+server.ts`**
```typescript
import { json, error } from '@sveltejs/kit';
import { listAgentMarkets, getAgentMarket } from '../../../agentDirectory';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const pathname = new URL(url).pathname;

  if (pathname === '/api/agent/markets') {
    const markets = listAgentMarkets({
      kind: url.searchParams.get('kind') || undefined,
      // ... other params
    });
    return json({ data: markets, meta: { count: markets.length } });
  }

  if (pathname.startsWith('/api/agent/markets/')) {
    const marketId = pathname.split('/').at(-1);
    const data = getAgentMarket(marketId || '');
    if (!data) return error(404, 'market not found');
    return json({ data });
  }

  return error(404, 'unknown agent endpoint');
};
```

**File: `src/routes/api/analytics/+server.ts`**
```typescript
import { json, error } from '@sveltejs/kit';
import { readFileSync, appendFileSync } from 'fs';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const events = await request.json();
  if (!Array.isArray(events)) {
    return error(400, 'expected array');
  }

  // Write to JSONL file
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  appendFileSync('data/analytics.jsonl', lines);

  return new Response(null, { status: 204 });
};

export const GET: RequestHandler = async ({ url }) => {
  if (url.pathname === '/api/analytics/summary') {
    // Compute summary from JSONL
    // ... (existing logic)
  }
  return error(404, 'unknown analytics endpoint');
};
```

---

## Testing Strategy During Transition

### Unit Tests (Vitest continues as-is)

Pure TS services remain unchanged:
- `src/services/marketService.ts`
- `src/services/nostrService.ts`
- etc.

No changes needed to existing `vitest.config.ts`. Tests pass through unchanged.

### Integration Tests (Vitest + SvelteKit)

For new Svelte components, add tests:

```typescript
// src/routes/activity/+page.test.ts
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';

describe('Activity page', () => {
  it('renders loading state', () => {
    render(Page, { props: { data: { items: [] } } });
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });
});
```

### E2E Tests (Playwright)

Add Playwright tests for user flows:

```typescript
// tests/activity.spec.ts
import { test, expect } from '@playwright/test';

test('Activity page filters work', async ({ page }) => {
  await page.goto('/activity');
  await expect(page).toHaveTitle('Cascade');
  
  const filter = page.getByRole('button', { name: /Trades/i });
  await filter.click();
  
  // Verify filtered items appear
});
```

Install Playwright if not already present:
```bash
npm install -D @playwright/test
npx playwright install
```

---

## Execution Order

These steps **must** be followed in dependency order. Each step is independently verifiable.

### Phase 1: SkeliteKit Foundation (Prerequisite)

1. **Install SkeliteKit packages**
   - Run: `npm install -D svelte @sveltejs/kit @sveltejs/adapter-auto`
   - Verify: `node_modules/@sveltejs/kit` exists; `npx svelte --version` returns 5.x.x

2. **Create `svelte.config.js` with adapter-auto**
   - File: `.tenex/plans/svelte-port.md` specifies content
   - Verify: `cat svelte.config.js` shows `adapter: adapter()`

3. **Create `src/routes/` directory structure**
   - Run: `mkdir -p src/routes/{activity,analytics,profile,threads,api/{agent,analytics}} src/lib/{stores,components}`
   - Verify: `ls -la src/routes/` shows subdirectories

4. **Migrate Vite config → `vite.config.js` (SveliteKit standard)**
   - Delete: `vite.config.ts`
   - Create: `vite.config.js` with SkeliteKit plugin as specified above
   - Verify: `npm run build` succeeds; `npm run dev` starts without errors

5. **Create root layout `src/routes/+layout.svelte`**
   - Include: Navigation, toast notifications, global styles
   - Import: `$lib/stores/nostr`, `$lib/stores/ui`
   - Verify: `npm run dev` loads without JS errors; `/` page renders

6. **Create `src/routes/+layout.ts` (root load function)**
   - Initialize Nostr store
   - Verify: `npm run dev` → navigate `/` → check browser devtools console for no errors

7. **Create `src/lib/stores/nostr.ts`**
   - Content: writable `nostr` store, `initializeNostr()`, setter functions
   - Verify: `npm run dev` → open browser devtools → `$lib/stores/nostr` is importable

8. **Migrate API routes: Create `src/routes/api/agent/+server.ts` and `src/routes/api/analytics/+server.ts`**
   - Copy logic from vite.config.ts plugins → SkeliteKit routes
   - Verify: `curl http://localhost:5173/api/agent/markets` returns JSON; `npm run dev` has no warnings

9. **Update `tailwind.config.js` to include `.svelte` files**
   - Change: `content: ["./src/**/*.{js,ts,jsx,tsx}"]` → `["./src/**/*.{js,ts,jsx,tsx,svelte}"]`
   - Verify: Svelte components use Tailwind classes correctly; `npm run dev` shows no missing classes

### Phase 2: Proof of Concept — 4 Pages

10. **Port Activity.tsx → `src/routes/activity/+page.svelte` + `+page.ts`**
    - **+page.ts**: Async `load()` function to fetch activity items
    - **+page.svelte**: Render list, filter tabs, handle errors
    - Verify: `npm run dev` → navigate `/activity` → page renders without errors; filtering works

11. **Port AnalyticsDashboard.tsx → `src/routes/analytics/+page.svelte` + `+page.ts`**
    - Use SkeliteKit's `load()` to call `/api/analytics/summary`
    - Render metrics with skeleton loading
    - Verify: `npm run dev` → `/analytics` loads data and renders metrics

12. **Port ProfilePage.tsx → `src/routes/profile/[pubkey]/+page.svelte` + `+page.ts`**
    - Extract route param: `const { pubkey } = params`
    - Normalize npub → hex in `load()`
    - Fetch Kind 0 + positions in `load()`
    - Render profile, markets, positions; handle tabs
    - Verify: `/profile/npub1...` and `/profile/hex...` both work; data loads correctly

13. **Port ThreadPage.tsx → `src/routes/threads/[id]/+page.svelte` + `+page.ts`**
    - Fetch initial thread in `load()`
    - Subscribe to reactions/replies in component's `onMount()`
    - Handle optimistic updates via store
    - Verify: `/threads/[id]` loads; voting updates optimistically; subscriptions work

14. **Manual testing: Cold start from React landing, navigate to new Svelte pages**
    - Start: `npm run dev`, open `http://localhost:5173/`
    - Actions: Click to Activity, Analytics, Profile, Thread — verify no 404s, data loads
    - Verify: Network tab shows `/api/*` calls; store state updates reflect in UI

15. **Run Playwright smoke test**
    - Create: `tests/poc-pages.spec.ts` with basic navigation checks
    - Run: `npm run test` or `npx playwright test`
    - Verify: All 4 pages load; no JS errors in console

### Phase 3: Simple Pages

16. **Port LandingPage.tsx → `src/routes/+page.svelte`**
    - Verify: `/` loads landing page correctly

17. **Port HowItWorks.tsx → `src/routes/how-it-works/+page.svelte`**
    - Verify: `/how-it-works` renders without errors

18. **Port LegalPages.tsx → `src/routes/legal/[type]/+page.svelte`**
    - Extract param: `const { type } = params` → determine tos or privacy
    - Verify: `/legal/tos` and `/legal/privacy` work

19. **Port NotFoundPage.tsx → `src/routes/+error.svelte`**
    - SkeliteKit automatically shows this for 404s
    - Verify: Navigate to `/nonexistent` → error page appears

20. **Port Blog.tsx → `src/routes/blog/+page.svelte`**
    - Verify: `/blog` renders list of blog posts

### Phase 4: Dynamic Routing & Complex State

21. **Port MarketDetail.tsx → `src/routes/market/[id]/+page.svelte` + `+page.ts`**
    - Load market data in `+page.ts`
    - Subscribe to market updates in component
    - Verify: `/market/[id]` with real IDs loads; subscriptions update state

22. **Port AgentsPage.tsx → `src/routes/agents/[id]/+page.svelte` + `+page.ts`**
    - Verify: `/agents/[id]` loads agent details

23. **Port Portfolio.tsx → `src/routes/portfolio/[pubkey]/+page.svelte` + `+page.ts`**
    - Verify: `/portfolio/[pubkey]` renders user portfolio

24. **Port Leaderboard.tsx → `src/routes/leaderboard/+page.svelte` + `+page.ts`**
    - Verify: `/leaderboard` fetches and renders rankings

25. **Port SettingsPage.tsx → `src/routes/settings/+page.svelte`**
    - Verify: `/settings` page renders and form submissions work

26. **Create `src/lib/stores/market.ts` (migrate App.tsx reducer)**
    - Implement writable store for markets
    - Export reducer functions: `createMarket()`, `tradeMarket()`, `deleteMarket()`, etc.
    - Verify: Store updates reflect in components that subscribe

27. **Port App.tsx logic → market store + load functions**
    - Move market state machine → store
    - Move toast logic → `src/lib/stores/toast.ts`
    - Verify: Market creation, trading, deletion work via store mutations

28. **Port WalletPage.tsx → `src/routes/wallet/+page.svelte` + `+page.ts`**
    - Handle form submission with SkeliteKit form actions
    - Verify: Wallet interactions work; balance updates

29. **Port ThesisBuilder.tsx → `src/routes/create/+page.svelte` + `+page.ts`**
    - Integrate TipTap editor (can stay as-is; Svelte-compatible)
    - Handle form submission → create market
    - Verify: Market creation form works end-to-end

30. **Port DashboardOverview.tsx → `src/routes/dashboard/+page.svelte` + `+page.ts`**
    - Verify: Dashboard renders market overview

31. **Port TreasuryPage.tsx → `src/routes/treasury/+page.svelte` + `+page.ts`**
    - Verify: Treasury data loads and calculations display

### Phase 5: Polish & Cleanup

32. **Migrate NavHeader component → `src/lib/components/NavHeader.svelte`**
    - Update all routes to import and render NavHeader
    - Verify: Navigation works across all pages

33. **Audit Tailwind styles for Svelte 5 compatibility**
    - Check: All custom classes from tailwind.config.js apply correctly
    - Run: `npm run dev` → inspect element → all styles render

34. **Remove React dependencies from `package.json`**
    - Delete: `react`, `react-dom`, `react-router-dom`, `@vitejs/plugin-react`
    - Run: `npm ci` → `npm run build`
    - Verify: Build succeeds; bundle size is smaller

35. **Delete React source files**
    - Remove: `src/App.tsx`, `src/context/`, `src/*.tsx` (except components that might be reused)
    - Keep: `src/services/`, `src/lib/`, `src/routes/`
    - Run: `npm run build`
    - Verify: No import errors; build succeeds

36. **Run full test suite**
    - Run: `npm run test:run` (Vitest)
    - Run: `npx playwright test` (E2E)
    - Verify: All tests pass

37. **Bundle analysis & optimization**
    - Install: `npm install -D vite-plugin-visualizer`
    - Run: `npm run build && npx vite-plugin-visualizer`
    - Verify: No React bundles; Svelte is ~40KB gzipped; total bundle < original

38. **Deploy to Vercel**
    - Update: `vercel.json` to point to SkeliteKit build output
    - Run: `npm run build` locally
    - Verify: Artifact builds; Vercel preview works; all routes load

---

## Verification

After each phase, verify:

1. **Cold start (new user):** Open browser, no cached state, all pages load
2. **Routing:** All old routes still work (via React fallback or exact Svelte routes)
3. **State persistence:** localStorage is read/written correctly (bookmarks, profiles, etc.)
4. **Nostr integration:** kind 0, kind 30000, kind 30078 queries work; subscriptions update UI
5. **API endpoints:** `/api/agent/*` and `/api/analytics` respond correctly
6. **Performance:** Lighthouse audit > 85 (mobile)
7. **Accessibility:** axe-core audit passes; keyboard navigation works
8. **Error handling:** Invalid routes → 404 page; failed fetches → error state

### Full End-to-End Verification (Phase 5 completion)

```bash
# Build production artifact
npm run build

# Test build artifact locally
npm run preview

# Lighthouse on http://localhost:4173
# npx lighthouse http://localhost:4173

# Playwright full suite
npx playwright test

# Bundle analysis
npx vite-plugin-visualizer --open

# Git diff: confirm no React files remain in src/
git diff HEAD -- src/ | grep -E '^\-' | grep -v .map
```

Expected: No React file deletions in git diff (they were already gone).

---

## Rollback Plan

If a phase encounters insurmountable blockers:

1. **Before Phase 1:** Ensure all uncommitted work is stashed; SkeliteKit is isolated in separate branch
   - Branch: `git checkout -b svelte-port-prep`
   - If abort: `git checkout main && git branch -D svelte-port-prep`

2. **During Phase 2–3:** If Nostr stores or API routes malfunction
   - Revert: Stash changes, keep React app running
   - Fallback: Use Option A (Vite dev adapter) to serve React as primary; Svelte as secondary

3. **During Phase 4:** If market state machine is incompatible
   - Revert: Keep `src/App.tsx` and React Context
   - Migrate piecemeal: Port individual components while keeping App.tsx orchestration

4. **Complete abort:**
   - Command: `git reset --hard origin/main`
   - Result: Back to full React setup; Svelte exploration can restart with lessons learned

---

## Success Metrics

✅ **Phase 1 PoC shipped:** 4 pages in Svelte; Activity, Analytics, Profile, Thread load and render correctly
✅ **Phase 2 simple pages:** 5 static/simple pages migrated; test coverage > 80%
✅ **Phase 3 dynamic routing:** 5 parameterized pages work; route transitions smooth
✅ **Phase 4 complex state:** Market trading, creation, deletion work via Svelte stores
✅ **Phase 5 polish:** Bundle size < original; Lighthouse 90+; all tests pass; React removed
✅ **Users ship new UI:** Zero broken URLs; analytics show engagement on new routes; error rates normal

---

## Known Blockers & Mitigations

| Blocker | Status | Mitigation |
|---------|--------|-----------|
| @nostr-dev-kit/svelte doesn't exist | Likely | Wrap NDK in Svelte stores manually; use existing NDK 3.0.3 as-is |
| TipTap editor (React) in ThesisBuilder | Likely | TipTap has Svelte bindings (@tiptap/extension-svelte); replace @tiptap/react |
| Lightweight-charts (React wrapper) | Possible | Use base library directly or find @lightweight-charts/svelte |
| Custom analytics middleware in Vite | Expected | Migrate to SkeliteKit routes; well-defined path |
| localStorage + NIP-46 signing | Low | Pure TS services; no React dependency; works as-is |

---

## Additional Notes for Implementation Team

1. **Keep services pure TS:** Never import React or Svelte into `src/services/`. Services are UI-agnostic.

2. **Store everything in Svelte stores:** Avoid component-local state for data that multiple pages need (e.g., nostr pubkey, market state, UI toasts).

3. **Use `+layout.ts` load functions:** Prefer SkeliteKit's `load()` over `onMount()` + `fetch()` for data that blocks page render.

4. **Subscriptions in `onMount()`:** Use `subscribeToEvents()` from services in `onMount()` → unsubscribe in cleanup. Stores update reactively.

5. **Form actions with `+page.server.ts`:** SkeliteKit's form actions handle mutation logic server-side; prefer over client-side mutations.

6. **Type safety:** SkeliteKit auto-generates `PageData` and `PageLoad` types. Use them:
   ```svelte
   <script lang="ts">
     import type { PageData } from './$types';
     export let data: PageData;
   </script>
   ```

7. **Commit strategy:** 
   - Commit each phase separately (5 commits total: foundation, PoC, simple, dynamic, complex, polish)
   - Each commit should pass tests and be deployable
   - PR = entire phase; not per-component

8. **Communication:**
   - Announce Phase 1 PoC completion to stakeholders
   - Show Lighthouse scores + bundle size wins
   - Gather feedback before Phase 2

---

## References

- [SkeliteKit Docs](https://kit.svelte.dev/)
- [Svelte 5 Docs](https://svelte.dev/)
- [SvelteKit Routing](https://kit.svelte.dev/docs/routing)
- [SvelteKit Load Functions](https://kit.svelte.dev/docs/load)
- [Svelte Stores](https://svelte.dev/docs/svelte/stores)
- [NDK Docs](https://ndk.fun/)
- [Tailwind CSS with Svelte](https://tailwindcss.com/docs/guides/sveltekit)
