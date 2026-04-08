# NowNowNow

*Last updated: 2026-04-08 06:45 UTC — CCN compat + getMintUrl fixes shipped. UI audit fixes in progress.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| After UI audit fixes land | Verify build, commit, push. Then delegate Phase 8 Phase 1 (testnet mint) | Plan: `.tenex/plans/phase-8-real-money-integration-revised.md` |
| When Pablo wakes | Growth DM campaign + Substack article decision | Twitter/X API or manual sends needed |

---

## ✅ Shipped (2026-04-08)

| Item | Commit | Status |
|------|--------|--------|
| **Wallet Refactor Step 1: Mint URL Consolidation** | `0e9779f` | ✅ Committed + pushed to main |
| **Wallet Refactor Step 2: Svelte 5 $state Migration** | `e358fd6` | ✅ Committed + pushed to main |
| **Wallet Refactor Step 3: Unify Wallet Access Paths** | `da7fbca` | ✅ Committed + pushed to main |
| **Fix 500 Error on /market/[marketId]** | `1546887` | ✅ Client-side load + MarketCard link fix, pushed to main |
| **Fix walletStore.ts runtime regression** | `06e601a` | ✅ Missing `let` declarations for walletInstance/ndkInstance, pushed to main |
| **Svelte 5 store backward compat fixes** | `799912a` | ✅ isTestnet.get()→isTestnet(), $nostrStore→nostrStore.get(), .env.example |
| **Fix getMintUrl() runtime override** | `ab04ad2` | ✅ Now respects currentMintUrl set via setMintUrl() |
| **Memory leak fix (discuss page subscriptions)** | `57eb103` | ✅ Committed + pushed to main |
| **NDK subscription migration (discuss page)** | `0b11156` | ✅ Committed + pushed to main |
| **Phase 8 Planning Artifacts** | `711bbc4` | ✅ 25 plan files committed + pushed to main |
| **Phase 8 Plan APPROVED** | — | ✅ Self-hosted mint, LND, no KYC for MVP |
| **Stale worktree cleanup** | — | ✅ Removed refactor/wallet-consolidation + refactor/wallet-svelte5 |

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

| Item | Status | Details |
|------|--------|---------|
| **UI Audit Fixes** | 🔄 Delegated to claude-code (308c4c2868) | Page titles, Nostr jargon, raw pubkeys, rounded-full progress bars, background-fill toggles |

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
| Frontend refactor | **✅ DONE** — Steps 1-3 shipped to main |
| Pablo sign-off | **Given** (as proxy) |

---

## 🏗️ Architecture State

- **Markets:** kind 982 (immutable) ✅
- **Positions:** kind 30078 NIP-78 ✅
- **Discussions:** kind 1111 NIP-22 ✅
- **Cashu Mint:** Per-market keysets, 2% rake, CDK Rust ✅ ALL 7 PHASES DONE
- **React:** Abandoned 🗑️ All Svelte 5 now.
- **Wallet:** Unified Svelte 5 $state store ✅ Steps 1-3 shipped