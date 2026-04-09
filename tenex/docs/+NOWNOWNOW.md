# NowNowNow

*Last updated: 2026-04-09 04:30 UTC — Real-time reply subscription fully fixed (3 bugs). Massive 35+ commit session. All work shipped to main.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------| 
| **Pablo ASAP** | **LND wallet creation** | Run: `lncli --lnddir=/Users/customer/.lnd --network=signet create` — one-time setup, blocks all Lightning/testnet testing |
| Pablo decides | Merge phase-8-testnet-mint → main | All wallet work on branch. Pablo decides when mint deployment is ready. |
| Pablo decides | Growth DM campaign (10 DMs) | DM file: `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready, published to Nostr |
| Deferred | Market resolution UI | Large feature — market creators can't close markets yet |
| Deferred | Market search | No search on /discuss or homepage |

---

## 🔄 In Flight (main)

*(nothing active — all clean)*

---

## ✅ Shipped This Session (2026-04-09)

| Item | Commit | Status |
|------|--------|--------|
| **Thread reply subscription: 3 bug fixes** | `851bf0a`, `6f2862f` | ✅ Wrong `#e` filter, race condition, threadBuilder double-attach |
| **isReady() polling fix (discuss + analytics)** | `86c0d42` | ✅ Reactive setInterval instead of one-shot `$effect` |
| **Remove dead Charts tab + avatar placeholder** | `de1ea60` | ✅ Charts tab gone from /mkt, corrupted placeholder removed |
| **Remove raw pubkey from join success** | `33a62ec` | ✅ No more "Account ID" hex string shown to new users |
| **Profile followers/following stats** | `31e8176` | ✅ 'Coming soon' → em-dash |
| **Remove dead share/report buttons + discuss CTA** | `09aad7c` | ✅ Dead UI gone, "Create market" link added to /discuss |
| **5 navigation/UX fixes** | `8e4fadf` | ✅ Search redirect, thread URL, thesis post-publish link, reply count, sort dropdown wired |
| **Real-time reply subscription (initial)** | `c2169ba` | ✅ Base implementation |
| **Welcome key + OAuth UX fixes** | `badcd72`, `d0f847c` → `22123aa` | ✅ Key import, OAuth timeout, bech32 validation |
| **Rounded corners, subscription leak, portfolio tabs** | `06ecea5` | ✅ Style + behavior fixes |
| **6 independent fixes** | `0a56705` | ✅ Bookmarks, market redirect, fake 24h removed, FAQ style, dead component, analytics empty states |
| **4 bug fixes** | `2892f40` → `c371d12` | ✅ 404 page, help contact, share button, activity filters |
| **Uppercase tracking cleanup** | `2424571`, `ebe376c` | ✅ 49 violations across 12 files |
| **Thread routing fix** | `053ffe9` | ✅ marketId/threadId params corrected |
| **Key generation fix** | merged | ✅ Real keypair from nostrKeys.ts, nsec display removed |
| **Analytics dashboard** | multiple | ✅ Real Nostr-backed stats, Bloomberg aesthetic |
| **Live ticker** | `cf53bf6` | ✅ Seamless marquee with real market titles |
| **Blog article** | `e4f0ab9` | ✅ "If Bitcoin Hits $100k" article on blog page |
| **OG/Twitter meta tags** | `c164ae9`, `836cf47` | ✅ Corrupted tags replaced with real URLs |
| **NavHeader across 12+ pages** | multiple | ✅ All major pages now have nav |
| **Activity streaming fix** | committed | ✅ Data streams as it arrives, no loading gate |
| **Market detail page overhaul** | committed | ✅ Cards → flat layout, style guide compliance |
| **Discuss page style** | committed | ✅ divide-y layout, style violations fixed |
| **Portfolio + profile loading gates** | committed | ✅ No more blank screens |
| **Remove fake sparklines** | `bd7a8dc` | ✅ Static fake charts gone from landing page |

---

## 🗺️ Phase 8 Status — `phase-8-testnet-mint` branch

### Mint (Rust CDK)
- ✅ CDK project compiles, real blind signing
- ✅ Two keysets per market (LONG/SHORT) via rotate_keyset
- ✅ NUT-04 + NUT-05 via cdk_axum router
- ✅ ALL DB column bugs fixed (insert_trade, insert_payout, insert_lmsr_snapshot, get_price_history)
- ⏳ LND wallet creation (Pablo must run `lncli create`)
- ⏳ Testnet deployment to VPS

### Frontend (on phase-8 branch)
- ✅ walletErrors.ts — 11 error codes typed
- ✅ walletHistory.ts — full history service
- ✅ All wallet components hardened
- ✅ mintHealthy defaults false
