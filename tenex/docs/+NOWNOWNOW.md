# NowNowNow

*Last updated: 2026-04-09 07:30 UTC — Onboarding UX gaps fixed. Landing hero + TradeForm fund-wallet CTA shipped.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| Pablo decides | Merge phase-8-testnet-mint → main | All wallet work on branch. LND fully operational. Pablo decides when mint deployment is ready. |
| Pablo decides | Growth DM campaign (10 DMs) | DM file: `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready, published to Nostr |

---

## 🔄 In Flight (main)

*(nothing — all clear)*

---

## ✅ Shipped Today (2026-04-09)

| Item | Commit | Status |
|------|--------|--------|
| **resolutionService → withdrawalService rename** | `80ebe6f`, `6a23b40` | ✅ Renamed + docs cleaned + final review PASS |
| **60 docs in docs/** | `a64c04c`, `f04da2a`, `2639dec`, `9d216bb`, `76efe03` | ✅ Full product/technical/business docs, terminology corrected |
| **Thread 404 fix** | `304857e` | ✅ Back-button + breadcrumb links fixed to `/mkt/${slug}--${prefix}` |
| **Auth-gate reply buttons** | `a4a9ed3` | ✅ Logged-out users see "Sign in to reply" instead of blank submit |
| **TradeForm wallet balance** | `2e42de0` | ✅ Shows balance, disables submit + prompts to fund wallet when 0 |
| **Hero CTA → /join** | `ddc09d7` | ✅ "Start Trading" now routes logged-out users to /join |
| **UX audit complete** | — | ✅ explore-agent: 5 conversion killers identified, 3 already fixed |
| **Landing page hero for logged-out users** | `fd84f3f`, `9feac4f` | ✅ Bloomberg-style minimal hero, hidden when logged in, links to /join |
| **TradeForm zero-balance CTA** | `8f2028c` | ✅ "You need sats to trade. Fund your wallet →" when balance = 0 |

---

## ✅ Shipped Earlier This Session

| Item | Commit | Status |
|------|--------|--------|
| **LND + Bitcoin Core** | — | ✅ Running on signet. Pablo created wallet. launchd-managed. |
| **Cross-project conversation routing fix** | `1327a124`, `02a0cad6` | ✅ One-off scheduled tasks now fire across projects. |
| **Onboarding funnel fixes (3 blockers)** | `dc08d97`, `485c0e4`, `13e023a` | ✅ Post-join 404 fixed, nav→/join, wallet CTA copy |
| **Wallet Refactor Steps 1-3** | `0e9779f`, `e358fd6`, `da7fbca` | ✅ All committed + pushed |
| **Phase 8 production hardening** | `78b074d`–`550629f` | ✅ All done. On phase-8-testnet-mint branch. |
