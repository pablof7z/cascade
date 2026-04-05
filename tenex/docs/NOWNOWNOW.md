# NowNowNow

*Last updated: 2026-04-05 20:30 UTC — Sweep 145: 5 more commits. Cashu Mint architecture being fixed. Build green.*

---

## ✅ Shipped This Session (5 new commits)

| Commit | Feature |
|--------|---------|
| **a3cc188** | **Fix Hero CTAs** — 'Start Trading' scrolls to markets, 'For agents →' links to /help |
| **6c491bf** | **Fix Market Detail Page** — correct LMSR pricing, wire trade button, fix styles |
| **22537ad** | **Wire Create Market Modal** — `handleCreateMarket()` publishes kind 982 events via `publishMarket()` |
| **c5ae80f** | **Real Legal Pages** — Terms of Service + Privacy Policy, plain English |
| **c3badcd** | **Footer on All Pages** — Footer restored to root layout |

---

## ✅ Previously Shipped (Earlier This Session)

| Commit | Feature |
|--------|---------|
| **a9ec131** | **Wire Trade Button** — `handleTrade()` calls real `executeTrade()` from tradingService |
| **e6cf915** | **Cashu Mint Phase 1** — Hono.js + TypeScript mint foundation (`cascade-mint/`) — ⚠️ ARCHITECTURE BEING REVISED |
| **e6d9343** | **OG/Twitter meta tags** |
| **032e04a** | **Contact info fix** — correct Nostr/email links + 2 new FAQ items |
| **b1b4a09** | **Profile link in nav dropdown** |
| **df16b6a** | **Market Discussion Feature** — 4 Svelte components, kind:1111 NIP-22, real-time |
| **9ae9f0c** | **Blog page cleanup** |
| **245bf0b** | **Analytics cleanup** |
| **6ffe4ed** | **Profile tab fix** |
| **8c37ab3** | **Favicon fix** |

---

## ⚠️ Cashu Mint Architecture Fix — IN PROGRESS

The previously committed mint (`e6cf915`) had a critical architectural error: it fetched kind:30000 market events from Nostr relays at runtime. The correct architecture:
- **Pure Cashu NUT API** — no Nostr relay code in mint
- **URL-segmented routing**: `/{marketId}/v1/mint`, `/{marketId}/v1/keys`, etc.
- Market context comes from URL params, not Nostr
- planning-orchestrator rewrote the plan; mint-engineer reviewing now

**Status:** Plan being reviewed by mint-engineer. Once approved, execution-coordinator will rewrite `cascade-mint/` on a branch.

---

## ⏳ Pending Pablo Decisions

1. **Substack account** — Create `cascadethinking.substack.com` + provide credentials
   - Draft v2 ready: `tenex/docs/substack-draft-2026-04-04-v2.md`
2. **Cashu mint Phase 1 GO** — Architecture being fixed. Once plan approved, needs re-implementation.
3. **Domain registration** — needs update post-rebrand to Cascade
4. **Cashu Phase 2** — Lightning, NIP-46 signing, hardening (after Phase 1 deployed)
