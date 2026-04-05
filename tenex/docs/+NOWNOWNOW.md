# NowNowNow

*Last updated: 2026-04-05 21:00 UTC — Sweep 146. Cashu architecture rewrite underway. React migration + onboarding restoration in flight.*

---

## 🔧 In Flight — ACTIVE

### Cashu Mint Architecture Rewrite — CRITICAL FIX
- planning-orchestrator rewrote plan (removed Nostr fetching from mint)
- mint-engineer actively reviewing against NUT-01/02/03/04/07 specs (conv: f1ec7620)
- **Issue resolved**: Kind 30000 → proper ecash flow (mint no longer depends on market events)
- **Next**: execution-coordinator will rewrite cascade-mint/ directory after review approval

### React to Svelte Migration — NEW DIRECTIVE
- Pablo: "Create complete inventory of unmigrated React components"
- execution-coordinator delegated to explore-agent for component analysis (parallel exploration underway)
- 404 page identified as critical first blocker
- tenex-planner creating implementation plan for 404 page

### Onboarding Flow Restoration — COMPLETE ✅
- Full flow restored: OAuth (Twitter/Telegram) + profile setup + SKILLS.md agent flow
- Commit: `9ce31e2` (main branch, build green)
- Decision finalized: Keep minimal /welcome page + full OAuth flow combo

---

## ✅ Shipped This Sweep (Sweep 146 — Last 2 hours)

| Commit | Feature |
|--------|---------|
| **fbd189b** | **PRODUCT-DECISIONS.md** — 40+ directives from full relay extraction |
| **9ce31e2** | **Full onboarding restoration** — OAuth (Twitter/Telegram), profile setup, SKILLS.md flow |
| **8ed941b** | **PRODUCT-DECISIONS.md** — comprehensive directive tracking document |
| **2fe4289** | **Add /welcome onboarding page** — minimal Nostr connect flow |
| **a3cc188** | **Fix Hero CTAs** — "Start Trading" scrolls to markets, "How it works" links to /help |
| **6c491bf** | **Fix market detail page** — wire trade button, correct LMSR pricing, fix styles |

---

## ✅ Shipped Previous Sweep (Sweep 145)

| Commit | Feature |
|--------|---------|
| **22537ad** | **Wire create market modal** — users can now create markets via publishMarket() |
| **c5ae80f** | **Real legal pages** — Terms of Service + Privacy Policy (plain English) |
| **c3badcd** | **Add footer** — footer restored to root layout for site-wide consistency |
| **a9ec131** | **Wire trade button** — connected to real executeTrade() service |
| **e6cf915** | **Cashu Mint Phase 1** — Hono.js + TypeScript foundation (⚠️ architecture being revised) |

---

## ✅ Shipped Earlier (Sweeps 140-144)

| Commit | Feature |
|--------|---------|
| **e6d9343** | **OG/Twitter meta tags** — primary market route with full OpenGraph + Twitter Card |
| **032e04a** | **Contact info fix** — correct Nostr/email links + 2 new FAQ items |
| **b1b4a09** | **Profile link in nav** — "View Profile" added to user dropdown |
| **df16b6a** | **Market discussion** — 4 Svelte components, kind:1111 NIP-22, real-time |
| **9ae9f0c** | **Blog cleanup** — removed hardcoded placeholder content |
| **245bf0b** | **Analytics cleanup** — removed mock data/loading spinner |
| **6ffe4ed** | **Profile tab fix** — Markets/Positions tab switching working |
| **8c37ab3** | **Favicon fix** — SVG favicon, no more 404 |

---

## ⏳ Pending Pablo Decisions

1. **Substack account** — Create `cascadethinking.substack.com` + provide credentials
   - Draft v2 ready: `tenex/docs/substack-draft-2026-04-04-v2.md`
2. **Domain registration** — needs update post-rebrand to Cascade
3. **Cashu Mint deployment** — After architecture rewrite approval: Vercel + Turso setup needed
4. **Phase 2 GO** — Lightning integration + NIP-46 (after Phase 1 mint ships)
