# The Column — Migration Plan
*Last updated: 2026-04-20 (ALL PHASES COMPLETE)*

## Audit Summary

Two independent audits completed (claude-code + clean-code-nazi). Combined findings:
- **14 items** from claude-code (priority-ranked by brokenness)
- **39 items** from clean-code-nazi (6 families)
- **Consensus:** Shell chrome migrated. Market detail mostly done. Portfolio, create flow, profile, and utility pages are the main unmigrated territory.

Confirmed migrated: shell chrome, home feed, markets browse, subscriptions, market detail refresh (Case), onboarding/join.
Confirmed broken: `discussion/[threadId]` page (missing CSS classes).

---

## Migration Checklist

### Phase 1 — URGENT (broken pages)

- [ ] **1.1** `routes/market/[slug]/discussion/[threadId]/+page.svelte` — references undefined `.section`, `.surface`, `.panel`, `.page-header` — **page is broken**
- [ ] **1.2** `routes/relays/+page.svelte` — references undefined `bookmarks-layout`, `trending-grid`
- [ ] **1.3** `routes/relay/[hostname]/+page.svelte` — references undefined `relay-banner-*` classes
- [ ] **1.4** `routes/embed/+page.svelte` — references undefined `.section`, `.surface`, `.content-prose`
- [ ] **1.5** `routes/+error.svelte` — DaisyUI `hero`/`hero-content` (old pattern — replace with Column-style error page)

### Phase 2 — Market Detail refinement

- [ ] **2.1** `routes/market/[slug]/+page.svelte` — `tabs tabs-bordered` / `tab-active` old tab pattern → needs The Column text-underline tabs per spec
- [ ] **2.2** `routes/market/[slug]/charts/+page.svelte` — charts page needs Column treatment
- [ ] **2.3** `routes/market/[slug]/activity/+page.svelte` — activity sub-page needs Column treatment
- [ ] **2.4** `routes/market/[slug]/discussion/+page.svelte` — discussion tab (ensure matches `05-discussion.html` mock)
- [ ] **2.5** Missing **Trades tab** — spec says Trades tab exists but no route found — CREATE it
- [ ] **2.6** Missing **Linked tab** — spec says Linked tab exists but no route found — CREATE it

### Phase 3 — Portfolio & Wallet (high complexity, core to launch)

- [ ] **3.1** `lib/components/cascade/PortfolioPage.svelte` — massive DaisyUI `stats`, `card`, `table-zebra` throughout → needs full Column rewrite
- [ ] **3.2** `routes/portfolio/+page.svelte` — wrapper route for PortfolioPage
- [ ] **3.3** Funding UX (Stripe/Lightning) — clean up Lightning terminology, use USD language, hide sats/msats
- [ ] **3.4** "Loading..." text in PortfolioPage → remove per no-loading-state rule

### Phase 4 — Create Flow

- [ ] **4.1** `routes/builder/+page.svelte` — old staged Create Market flow with review step → replace with The Column create flow per `docs/product-ux/44-page-create.md` + `proposals/agency-2026-04/K-the-column/06-create.html`
- [ ] **4.2** `routes/builder/+page.server.ts` — server-side logic for old create flow

*Note: The Column spec says create is READY for engineering. Needs DaisyUI → Column component migration.*

### Phase 5 — Profile & Identity

- [ ] **5.1** `routes/profile/+page.svelte` — needs The Column profile page per `docs/product-ux/91-open-questions.md` (hero, avatar, subscribe, track record, tabs)
- [ ] **5.2** `routes/profile/edit/+page.svelte` — profile edit page
- [ ] **5.3** `routes/p/[identifier]/+page.svelte` — publication/author page (unclear if migrated)
- [ ] **5.4** Missing **Profile mock** — `proposals/agency-2026-04/H-the-study/04-profile.html` is old direction; needs Column-native version

### Phase 6 — Utility Pages

- [ ] **6.1** `routes/activity/+page.svelte` — notifications/activity page (listed in 91-open-questions)
- [ ] **6.2 ~~`routes/analytics/+page.svelte`~~** — ~~analytics page~~ → REMOVE from nav per Pablo decision (2026-04-19). Keep route for direct links, but hide from primary nav.
- [ ] **6.3** `routes/leaderboard/+page.svelte` — leaderboard (data-dense, doesn't fit Column)
- [ ] **6.4** `routes/bookmarks/+page.svelte` — bookmarks (listed in 91-open-questions)

### Phase 7 — Legacy / Decide

- [ ] **7.1** `routes/blog/+page.svelte` + `routes/blog/[slug]/` — blog routes — decide: keep as static content, or migrate to Column editorial format
- [ ] **7.2** `routes/note/[id]/+page.svelte` — standalone note page + 300-line custom CSS — needs review
- [ ] **7.3** `routes/relays/+page.svelte` + `routes/relay/[hostname]/` — relay info pages (low priority)
- [ ] **7.4** `routes/how-it-works/+page.svelte` — how-it-works page needs Column treatment
- [ ] **7.5** `routes/terms/+page.svelte` + `routes/privacy/+page.svelte` — legal pages (style minimally, text is static)
- [ ] **7.6** `routes/join/+page.svelte` — verify migrated (recent commit says it was reworked — audit to confirm)
- [ ] **7.7** `routes/onboarding/+page.svelte` — verify migrated

### Phase 8 — Components & CSS

- [ ] **8.1** `lib/components/RelayCard.svelte` — DaisyUI card → Column card style
- [ ] **8.2** `lib/components/Sidebar.svelte` — `menu`/`menu-active`, old sidebar → verify if still needed or replaced by Column rail
- [ ] **8.3** `lib/features/auth/auth.css` — raw `neutral-400/700/800` blue-tinted classes → replace with Column neutral tokens
- [ ] **8.4** Dashboard layout `routes/dashboard/+layout.svelte` — `menu`/`menu-active` overrides Column shell → needs audit (dashboard may be legacy/secondary)
- [ ] **8.5** `routes/dashboard/*` — entire dashboard family (agents, fields, treasury, settings) → MIGRATE to Column per Pablo decision (2026-04-19). This is a secondary feature but should get Column treatment.

### Phase 9 — Right Rail & Layout Refinements

- [ ] **9.1** Global right rail is "placeholder" across many routes — needs consistent Column treatment
- [ ] **9.2** Some routes bypass Column shell entirely — audit which routes are missing the shell

---

## Implementation Notes

- All work goes to `main`. Commit per item or logical group.
- Auto-deploy to Vercel on push — verify `https://cascade.f7z.io` after each commit.
- Use `bun test` to check for regressions.
- For pages with existing mocks (`06-create.html`, etc.), use the mock as visual reference.
- For pages with no mocks (Profile, Trades tab, Linked tab, Activity, Portfolio), create mock first or work from `91-open-questions.md` spec.
- "Loading..." text violations: remove across all affected pages.
- `tabs tabs-bordered` → text-only underline tabs per Column spec.

---

## Pablo Decisions (2026-04-19)
- Dashboard family → MIGRATE to Column
- Analytics page → REMOVE (hide from nav, can keep route for direct links)
- Leaderboard → MIGRATE to Column
4. **Blog routes** — keep as-is, migrate to Column, or convert to static pages?
5. **Profile page** — does it need a new mock before implementation?