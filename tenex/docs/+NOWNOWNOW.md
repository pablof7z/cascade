# NowNowNow

*Last updated: 2026-04-09 02:10 UTC — Session: live ticker shipped (seamless marquee), nsec removed from join success, key gen fixed, wallet/discuss/thread bugs fixed, analytics dashboard shipped, OG meta confirmed correct.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| **Pablo ASAP** | **LND wallet creation** | Run: `lncli --lnddir=/Users/customer/.lnd --network=signet create` — one-time setup, blocks all Lightning/testnet testing |
| Pablo decides | Merge phase-8-testnet-mint → main | All wallet work on branch. Pablo decides when mint deployment is ready. |
| Pablo decides | Growth DM campaign (10 DMs) | DM file: `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready, published to Nostr |

---

## 🔄 In Flight (main)

| Item | Conv | Status |
|------|------|--------|
| **Live ticker** | f4d3f24142 | 🔄 clean-code-nazi final review running (1236c1ea1e) |
| **OG/Twitter meta tags** | dc6e81d8e8 | 🔄 claude-code fixing (file on disk appears correct per Python hex check) |

## ✅ Shipped (2026-04-09 session)

| Item | Commit | Status |
|------|--------|--------|
| **nsec removed from join success screen** | `1ab8079` | ✅ Merged via fix/remove-nsec-from-join-success |
| **Real key generation on join** | `2da5fdf` | ✅ generateKeyPair/saveKeys from nostrKeys.ts |
| **Live ticker marquee** | `cf53bf6` | ✅ Seamless scrolling market titles, reduced-motion, aria-hidden |
| **Wallet page fixes** | `e839d02` | ✅ NavHeader, rounded classes, balanceError wired |
| **Discuss page fixes** | `0cc2355` | ✅ NavHeader, memory leak, cleanup |
| **Thread page fixes** | `d80e60f` | ✅ formatMarketSlug, threadId, NavHeader |
| **Analytics dashboard** | committed + pushed | ✅ Real Nostr-backed stats page |

## 🗺️ Phase 8 Status — `phase-8-testnet-mint` branch

### Mint (Rust CDK)
- ✅ CDK project compiles, real blind signing
- ✅ Two keysets per market (LONG/SHORT) via rotate_keyset
- ✅ NUT-04 + NUT-05 via cdk_axum router
- ✅ ALL DB column bugs fixed (insert_trade, insert_payout, insert_lmsr_snapshot, get_price_history)
- ⏳ LND wallet creation (Pablo must run `lncli create`)
- ⏳ Testnet deployment to VPS

### Frontend (4 Plans Complete)
- ✅ **Plan 01** — Wallet store consolidation (single source of truth)
- ✅ **Plan 02** — walletErrors.ts + walletHistory.ts typed stores
- ✅ **Plan 03** — Component error handling (WalletBalance, MintStatus, etc.)
- ✅ **Plan 04** — mintHealthy defaults false, all 11 error codes
