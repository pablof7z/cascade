# React Removal Audit — Phase 5 Preparation

*Audited: 2026-04-05 by explore-agent*
*Status: Ready to execute after Phase 4B complete*

---

## Summary

| Metric | Count |
|--------|-------|
| Total TSX files | 55 |
| Total lines of React code | ~15,961 |
| React packages to remove | 10 |
| Files needing migration first | 0 (hooks obsolete after Phase 4B) |
| Tests affected | 0 (all framework-agnostic) |
| SvelteKit routes active | 11 routes (all `.svelte`) |

---

## Critical Findings

1. **All 55 TSX files are DEAD** — No Svelte file imports any `.tsx` file. SvelteKit routing is completely separate from React's `react-router-dom`.

2. **Two `.ts` files still import React** — but become obsolete after Phase 4B porting:
   - `src/hooks/usePositions.ts` — replaced by Svelte positions store/hook
   - `src/useBookmarks.ts` — replaced by Svelte bookmark store

3. **No tests need updating** — All 7 test files in `src/test/` are service/store tests, not component tests.

4. **API routes are framework-agnostic** — The 7 mock API endpoints in `vite.config.ts` are Vite middleware plugins, not React-specific. Preserve them.

---

## package.json React Dependencies to Remove

(Discover full list from package.json)

Expected:
- `react`
- `react-dom`
- `@types/react`
- `@types/react-dom`
- `@vitejs/plugin-react`
- Possibly: react-router-dom, react-hot-toast, etc.

---

## Deletion Order

### Phase 0: Verify hooks are obsolete (after Phase 4B complete)
Confirm `usePositions.ts` and `useBookmarks.ts` are no longer imported anywhere before deleting.

### Phase 1: Delete all 55 TSX files
Delete `src/` directory TSX files as their Svelte equivalents exist:
- LandingPage.tsx (→ Svelte LandingPage)
- Activity.tsx (→ Svelte activity route)
- Analytics.tsx (→ Svelte analytics route)
- ThreadPage.tsx (→ Svelte thread route)
- ProfilePage.tsx (→ Svelte profile route)
- MarketDetail.tsx (→ Svelte market/[marketId] route)
- BookmarksPage.tsx (→ Svelte bookmarks route)
- DashboardOverview.tsx, Portfolio.tsx (→ Svelte equivalents)
- All UI components: VoteButtons.tsx, ReplyThread.tsx, OriginalPost.tsx, etc.

### Phase 2: Delete infrastructure files
- `src/main.tsx`
- `src/App.tsx`
- `src/index.tsx`
- `src/NostrContext.tsx`
- `src/hooks/usePositions.ts`
- `src/useBookmarks.ts`
- `src/App.css` (if exists)

### Phase 3: Remove React packages from package.json
Remove all React-related dependencies, then `npm install`.

### Phase 4: Clean up vite.config.ts
- Remove `@vitejs/plugin-react`
- Remove React-related plugin imports/config

### Phase 5: Post-deletion verification
- `npm run build` passes
- All tests green
- Lighthouse audit clean
- Deploy to Vercel staging

---

## Risk Assessment

**Low risk** — SvelteKit routing is fully separate from React routing. No shared state between them. Deletion is straightforward once Svelte equivalents exist.

**Key risk**: Ensure `bookmarkStore.ts` and positions store are fully functional before removing the React hooks.
