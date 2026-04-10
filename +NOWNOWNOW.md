# NowNowNow

*Last updated: 2026-04-10 02:05 UTC — Polish sprint 4: market 2-col layout shipped, landing overlap fixed.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| When Pablo sends | 10 DMs from X account for growth campaign | DM file: `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready, published to Nostr |
| Deferred | Market search | No search on /discuss or homepage |
| Pablo decides | `buyer_pubkey` schema decision | `trades` table has `buyer_pubkey TEXT NOT NULL` but `market::Trade` struct uses empty string placeholder. Options: make nullable / add to struct / remove column. Not blocking testnet. |

---

## 🔄 In Flight

*Nothing — workspace is clean.*

---

## ✅ Shipped (2026-04-10)

| Item | Commit | Status |
|------|--------|--------|
| **Market detail: 2-col layout with sticky trade box** | `d25fab9` | ✅ Desktop: sticky right sidebar (w-80) with probability (text-4xl) + full trade box always visible. Mobile: trade box above tabs. Left col: prob display, tabs, content. Widened from max-w-4xl to max-w-6xl. |
| **Landing: Low Volume excludes Trending markets** | `bd3431e` | ✅ Markets no longer appear in both Trending and Low Volume sections simultaneously. |

## ✅ Shipped (2026-04-09)

| Item | Commit | Status |
|------|--------|--------|
| **Market nav links: slug--pubkeyPrefix format** | `ce18559` | ✅ portfolio + activity pages now build proper `/mkt/slug--pubkeyPrefix` links. |
| **Landing: Chg column → Traders** | `f2b5052` | ✅ Replaced broken `--` placeholder column with real `Traders` count. |
| **Discuss: loading state text** | `f2b5052` | ✅ "Loading discussions…" instead of blank void. |
| **Trade box: estimated shares + price impact** | `1c1fa40` | ✅ Shows ~X shares, avg price, start→end price impact. Live LMSR math. |
| **Landing: thesis chain visualization** | `62d7f7e` | ✅ IF/THEN cascade structure shows Cascade's core concept. |

---

## 🏗 Architecture Reference

- Markets: kind 982 (non-replaceable), `E` tags only
- Modules are informational only — do NOT add probability coupling
- Terminology: mint/withdraw, never resolve/payout/winner
- All positions tracked via Nostr (kind 30078 NIP-78)
- Cashu wallet: NIP-60 (testnet mint active)
