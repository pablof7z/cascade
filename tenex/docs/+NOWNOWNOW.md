# NowNowNow

*Last updated: 2026-04-08 14:10 UTC — Nav "Sign in" routes to /join. Welcome page has new-user path. Auth gate + scroll CTA already live.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| When Pablo decides | Merge phase-8-testnet-mint → main | CDK blind signing committed (`f364a9c`). Ready to merge when mint deployment ready. |
| When Pablo sends | 10 DMs from X account for growth campaign | DM file at `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready + published to Nostr; needs Substack distribution |

---

## ✅ Shipped (2026-04-08)

| Item | Commit | Status |
|------|--------|--------|
| **Nav "Sign in" → /join, welcome page new-user path** | `485c0e4` | ✅ Nav no longer dead-ends new users; welcome page links to /join |
| **Fix threadBuilder author jargon + discuss loading blank** | `5611012` | ✅ Reply authors show 'Anonymous' not hex; discuss no blank state on load |
| **Wallet UX: Lightning withdraw + local QR + auto-polling** | `d95723f` | ✅ Lightning withdrawal flow, local QR (no external service), 5s balance auto-polling |
| **Remove dead Side/Sats fields from market creation modal** | `35e0d47` | ✅ Jargon gone, form cleaner — fields never did anything, now deleted |
| **Activity Simulator: skip profile re-publish on restart** | `a836371` | ✅ `profilesPublished` flag in state — restarts skip 200s blocking publish loop |
| **Fix relay jargon on activity page error** | `5293183` | ✅ Removed relay URL from user-facing error message |
| **Fix hardcoded $12.5K volume** | `4361d13` | ✅ Real volume computed from receipts |
| **Fix missing executeTrade import on market page** | `19aaaa7` | ✅ Runtime ReferenceError fixed |
| **CDK Blind Signing — real tokens on phase-8-testnet-mint** | `f364a9c` | ✅ types.rs + settlement.rs + market.rs — `blind_sign` replaces all mock token outputs, `rotate_keyset` per market |
| **Activity Simulator** | `95c8dd4` | ✅ `scripts/simulate.ts` — 200 keypairs, Ollama content, kind 982/1111/7/30078, relay publishing working |
| **SEO: SeoHead component + dynamic OG tags + cache headers** | `fde14de` | ✅ Market pages now have real social cards when shared |
| **Fix raw pubkey jargon** | `95c8dd4` | ✅ 9 files — display names instead of hex pubkeys |
| **Fix testnet mint URL + legal jargon** | `5de2494` | ✅ Issues 1, 3, 4 fixed |
| **Wallet Refactor Step 1: Mint URL Consolidation** | `0e9779f` | ✅ Committed + pushed to main |
| **Wallet Refactor Step 2: Svelte 5 $state Migration** | `e358fd6` | ✅ Committed + pushed to main |
| **Wallet Refactor Step 3: Unify Wallet Access Paths** | `da7fbca` | ✅ Committed + pushed to main |
| **Fix 500 Error on /market/[marketId]** | `1546887` | ✅ Client-side load + MarketCard link fix, pushed to main |
| **Fix walletStore.ts runtime regression** | `06e601a` | ✅ Missing `let` declarations for walletInstance/ndkInstance, pushed to main |
| **Svelte 5 store backward compat fixes** | `799912a` | ✅ isTestnet.get()→isTestnet(), $nostrStore→nostrStore.get(), .env.example |
| **Fix getMintUrl() runtime override** | `ab04ad2` | ✅ Now respects currentMintUrl set via setMintUrl() |
| **UI Audit Fixes** | `6d88edd` | ✅ 12 page titles, Nostr jargon removal, rounded-full→rounded-sm, bg-fill toggle fix |
| **Memory leak fix (discuss page subscriptions)** | `57eb103` | ✅ Committed + pushed to main |
| **NDK subscription migration (discuss page)** | `0b11156` | ✅ Committed + pushed to main |
| **Phase 8 Planning Artifacts** | `711bbc4` | ✅ 25 plan files committed + pushed to main |
| **Phase 8 Plan APPROVED** | — | ✅ Self-hosted mint, LND, no KYC for MVP |
| **Style fixes: rounded pills + wallet rounding** | `8a1540a` | ✅ Removed `rounded` from badges, 11x `rounded-lg`→`rounded-sm` in wallet |
| **Style fix: EmbedModal rounding** | `8ef275b` | ✅ `rounded-lg`→`rounded-sm` per style guide |
| **Footer icon conditional fix** | `c8630b6` | ✅ `link.label === 'Nostr'`→`'Cascade'` — icon now renders correctly |
| **Stale branch cleanup** | — | ✅ 7 local branches pruned |
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

No active work in progress.

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