# NowNowNow

*Last updated: 2026-04-08 00:20 UTC — Frontend refactor in progress. Phase 8 plan approved & committed. Memory leak fix shipped.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| After frontend refactor ships | Delegate Phase 8 Phase 1 (testnet mint) to execution-coordinator | Plan: `.tenex/plans/phase-8-real-money-integration-revised.md` |
| After web-tester reports | Fix any CRITICAL/HIGH visual issues found | Audit of cascade.f7z.io running (conv: 8c407441ab) |
| After agent categorization ships | Reduce context for orchestrator/router agents | `projects/TENEX-ff3ssq/docs/follow-ups.md` |

---

## ✅ Shipped (2026-04-08)

| Item | Commit | Status |
|------|--------|--------|
| **Memory leak fix (discuss page subscriptions)** | `57eb103` | ✅ Committed + pushed to main |
| **NDK subscription migration (discuss page)** | `0b11156` | ✅ Committed + pushed to main |
| **Phase 8 Planning Artifacts** | `711bbc4` | ✅ 25 plan files committed + pushed to main |
| **Phase 8 Plan APPROVED** | — | ✅ Self-hosted mint, LND, no KYC for MVP |
| **Frontend refactor scoping** | — | ✅ 4 priorities identified |
| **Stale worktree cleanup** | — | ✅ `audit-visual-functional` removed |

## ✅ Shipped (2026-04-07)

| Item | Commit | Status |
|------|--------|--------|
| **Svelte 5 Audit — Medium Fixes (#2, #3)** | `e16ec74` | ✅ Polling→NDK subs, discuss double-fetch |
| **Fix /profile 404** | `61b34d0` | ✅ Auth redirect + sign-in prompt |
| **Product Quality Fixes (5 items)** | `6b9732d` | ✅ Footer, settings, jargon, loading, redirect |
| **Svelte 5 Audit — Critical Fixes (5)** | `8fd4728`, `d2e1981` | ✅ All fixed |
| **Svelte 5 Migration (21 routes)** | `4bfd1fd` | ✅ All ported |
| **Phase 7 Settlement & Withdrawal** | — | ✅ 112 tests, committed to main |

---

## 🔄 In Progress

### Frontend Wallet Refactor (Phase 8 Prerequisite)
- **Delegated**: execution-coordinator → claude-code (conv: 8ea3c8f8d5)
- **Branch**: `refactor/wallet-svelte5`
- **4 Priorities**: P1 unify wallet store, P2 component extraction, P3 wire missing flows, P4 reactivity fixes

### Visual/Functional Audit of cascade.f7z.io
- **Delegated**: web-tester → explore-agent (conv: 8c407441ab)
- **Status**: Awaiting results

---

## ⏸️ Blocked on Pablo

| Item | Blocker |
|------|---------|
| Growth DM Campaign | Pablo needs to send 10 DMs or provide Twitter/X API credentials |
| Substack Distribution | Article published to Nostr; Substack publishing needs Pablo's approval |

---

## Phase 8 Plan — Key Decisions

| Decision | Resolution |
|----------|-------------|
| Third-party vs self-hosted mint | **Self-hosted** (CDK Rust + PostgreSQL) |
| Lightning provider | **Self-run LND node** |
| KYC for MVP | **No KYC** |
| Frontend refactor | **Required prerequisite** before real-money wiring |
| Pablo sign-off | **Required** before implementation begins |

---

## 🏗️ Architecture State

- **Markets:** kind 982 (immutable) ✅
- **Positions:** kind 30078 NIP-78 ✅
- **Discussions:** kind 1111 NIP-22 ✅
- **Cashu Mint:** Per-market keysets, 2% rake, CDK Rust ✅ ALL 7 PHASES DONE
- **React:** Abandoned 🗑️ All Svelte 5 now.