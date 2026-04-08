# NowNowNow

*Last updated: 2026-04-08 21:00 UTC — Phase 8 wave 1 complete. All DB column bugs fixed. Wallet consolidation done. LND install in progress.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| Pablo decides | Merge phase-8-testnet-mint → main | 6 commits (f364a9c→14ddb40): CDK signing, DB fixes x4, wallet consolidation. Pablo decides when ready. |
| LND install completes | Testnet deployment | LND + Bitcoin Core launchd setup in progress (conv: 9027f94b3a) |
| When Pablo sends | 10 DMs from X account for growth campaign | DM file at `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready + published to Nostr; needs Substack distribution |

---

## ✅ Shipped (2026-04-08) — Phase 8 Wave 1 — on `phase-8-testnet-mint`

| Item | Commit | Status |
|------|--------|--------|
| **Fix get_price_history market_id → market_slug** | `14ddb40` | ✅ All 4 DB column bugs now fixed (insert_trade, insert_payout, insert_lmsr_snapshot, get_price_history) |
| **Fix wallet consolidation review issues (3 items)** | `722eae9` | ✅ Double start() fixed, cancel wired, wallet page uses single store — 0 TS errors |
| **Fix insert_payout + insert_lmsr_snapshot column names** | `4dc481f` | ✅ market_id → market_slug, cargo build clean |
| **Fix insert_trade column bug + direction field** | `72c0490` | ✅ 129 Rust tests pass |
| **Wallet store consolidation + deposit flow hardening** | prior | ✅ Local QR, countdown, copy invoice, confirmation gate, auto-polling, typed errors |
| **Mint DB bugs: status parsing + trade reconstruction** | `e01a82a` | ✅ cargo test 129/129 |
| **CDK Blind Signing — real tokens** | `f364a9c` | ✅ blind_sign replaces all mock token outputs |

## ✅ Shipped (2026-04-08) — on `main`

| Item | Commit | Status |
|------|--------|--------|
| **UX sweep: no spinners, no Nostr jargon (7 fixes)** | `6e83c62` | ✅ animate-pulse gone, "Sign in" copy, rounded-sm badges |
| **Onboarding: post-join redirect → / (was /markets 404)** | `dc08d97` | ✅ New users complete signup and land on home, not 404 |
| **Onboarding: wallet CTA copy fix** | `13e023a` | ✅ "Set up your wallet" not "Add funds" for uninitialised wallet state |
| **Svelte 5 state_referenced_locally warnings** | `07d2a6a` | ✅ MarketDiscussionPost.svelte — clean build, no warnings |
| **Positions empty state: scroll-to-trade CTA** | `1b2e04d` | ✅ "Go to trade form" smooth scroll from empty positions |
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

| Item | Conv | Notes |
|------|------|-------|
| **LND + Bitcoin Core as launchd services** | `9027f94b3a` | SHA256 verified, extracting binaries — nearly done |

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