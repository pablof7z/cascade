# NowNowNow

*Last updated: 2026-04-09 16:00 UTC — Gap sprint complete. 13 major features shipped. Analytics charts in progress.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| When Pablo sends | 10 DMs from X account for growth campaign | DM file: `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready, published to Nostr |

---

## 🔄 In Flight

| Item | Conv | Notes |
|------|------|-------|
| **Analytics charts** | `fda65b22e3` | Adding lightweight-charts to /analytics (market activity + discussion activity over time) |

---

## ✅ Shipped (2026-04-09) — Gap sprint

| Item | Commit | Status |
|------|--------|--------|
| **LMSR price snapshot recording after trades** | `a7b90f4` | ✅ `insert_lmsr_snapshot` wired into buy/sell handlers. PriceChart gets real data. |
| **Key import flow on /welcome** | `7a1c073` | ✅ nsec + hex import, toggle UI, "Private key" label, redirects to /discuss |
| **Sparkline mini-charts on market cards** | `63b1976` | ✅ Sparkline.svelte + MarketCard integration |
| **Settings: relay config + notifications + npub display** | `433a1d9` | ✅ Relay list with status dots, 5 notification toggles, npub copy |
| **Profile: Nostr fetch, positions tab, edit profile** | `8b2b035` | ✅ kind:0 fetch, edit modal, positions from kind:30078 |
| **Market detail: tilt copy, recent fills, positions** | `db748b3` | ✅ Bull/bear narrative, receipt log, positioned accounts |
| **PriceChart + Charts tab on market detail** | `e83c401` | ✅ lightweight-charts, real LMSR price history |
| **Portfolio: payout history** | `c61eb09` | ✅ Nostr kind:30078 payout events |
| **Leaderboard page** | `ab58c8b` | ✅ 3 tabs: Top Traders / Top Creators / Most Active |
| **Discussion sorting + post type classification** | `01ddaf6` | ✅ hot/new/top/controversial + argument/evidence/rebuttal filters |
| **Activity tab on market detail + activity feed filters** | `65624be` | ✅ Trade log, filter by All/Trades/Markets |
| **Homepage: New This Week + Latest Discussions sections** | `35a2113` | ✅ Both sections live |

## ✅ Shipped (2026-04-09) — Testnet mint (main branch merge)

| Item | Commit | Status |
|------|--------|--------|
| **Phase 8 testnet mint integration** | `11a91eb` | ✅ CDK Rust mint, PostgreSQL, LND, real Cashu tokens |

---

## ⏸️ Blocked on Pablo

| Item | Blocker |
|------|---------| 
| Growth DM Campaign | Pablo sends 10 DMs from X (content ready) |
| Substack Distribution | Article published to Nostr; needs Substack cross-post |

---

## 🏗️ Architecture State

- **Markets:** kind 982 (immutable) ✅
- **Positions:** kind 30078 NIP-78 ✅
- **Discussions:** kind 1111 NIP-22 ✅
- **Cashu Mint:** Per-market keysets, 2% rake, CDK Rust ✅
- **React:** Abandoned 🗑️ Svelte 5 only.
- **Wallet:** Unified Svelte 5 $state store ✅
- **Svelte gap coverage:** ~90% of React features now ported (was 55-60%)

## Phase 8 Plan — Key Decisions

| Decision | Resolution |
|----------|-------------|
| Third-party vs self-hosted mint | **Self-hosted** (CDK Rust + PostgreSQL) |
| Lightning provider | **Self-run LND node** |
| KYC for MVP | **No KYC** |
| Pablo sign-off | **Given** ✅ |
