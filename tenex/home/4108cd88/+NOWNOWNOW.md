# NowNowNow

*Last updated: 2026-04-09 03:35 UTC — Massive audit+fix session complete. 30+ issues resolved. Audit #2 (thesis/discuss/search quality) in flight.*

---

## 📌 Pending Follow-Ups

| When | What | Details |
|------|------|---------|
| **Pablo ASAP** | **LND wallet creation** | Run: `lncli --lnddir=/Users/customer/.lnd --network=signet create` — blocks all Lightning/testnet testing |
| Pablo decides | Merge phase-8-testnet-mint → main | All wallet work on branch. Pablo decides when mint deployment is ready. |
| Pablo decides | Growth DM campaign (10 DMs) | DM file: `$AGENT_HOME/research/dm-campaign-10-users.md` |
| When Pablo publishes | Substack article | Article ready, published to Nostr |
| Deferred | Market resolution UI | Large feature — market creators can't close markets yet |
| Deferred | Market search | No search on /discuss or homepage |

---

## 🔄 In Flight (main)

| Item | Conv | Status |
|------|------|--------|
| **Audit #2: thesis/discuss/search** | 643502f96d | 🔄 explore-agent reading files — findings expected shortly |

---

## ✅ Shipped Today (2026-04-09) — Main Branch

### Wave 10 (latest): Welcome + OAuth fixes
- Welcome page key-file import flow fixed
- OAuth polling timeout handling added
- nsec bech32 validation added
- Commits: `badcd72`, `d0f847c` | Merge: `22123aa`

### Wave 9: 4 high-priority bugs
- join page redirects to /discuss (not /)
- Trade success confirmation message shown
- Old /market/[marketId] route deleted (SSR 500 time bomb)
- Insufficient balance error links to /wallet
- Commits: merged with `2424571`

### Wave 8: Rounded corners + style cleanup
- rounded corners removed from interactive elements
- discuss subscription memory leak fixed
- Portfolio open/settled tabs added
- Commit: `06ecea5`

### Wave 7: 6 small fixes batch
- Bookmarks page shows market titles (not pubkeys)
- Market creation redirects to new market (not /)
- Fake 24h change removed from market cards
- Help FAQ style fixed (no cards)
- Dead DashboardOverview component deleted
- Analytics empty states added
- Commit: `0a56705`

### Wave 6: 404 page, help, share, activity filters
- Custom 404 page built
- Help page contact link works
- Share button on market page
- Activity page filters functional
- Commit: `2892f40` | Merge: `c371d12`

### Wave 5: Uppercase tracking sweep
- 49 `uppercase tracking-*` violations removed across 12 files
- Commits: `2424571`, `ebe376c`

### Wave 4: Thread routing
- Thread page fixed — threadId from searchParams, correct market loading
- Commits: `053ffe9`, `e59b9ef`

### Earlier today:
- ✅ Analytics dashboard — real Nostr-backed stats
- ✅ Live ticker — scrolls real market titles
- ✅ Blog article — "If Bitcoin Hits $100k" published
- ✅ NavHeader added to ALL pages (8-page sweep + individual fixes)
- ✅ OG/Twitter meta tags fixed
- ✅ Activity page streams data (no loading gate)
- ✅ Market detail page style overhaul (no cards)
- ✅ Fake sparklines removed from landing page
- ✅ Real keypair generation on join flow
- ✅ nsec removed from join success screen

---

## 🗺️ Phase 8 Status — `phase-8-testnet-mint` branch

### Mint (Rust CDK)
- ✅ CDK project compiles, real blind signing
- ✅ Two keysets per market (LONG/SHORT) via rotate_keyset
- ✅ NUT-04 + NUT-05 via cdk_axum router
- ✅ ALL DB column bugs fixed
- ⏳ LND wallet creation (Pablo must run `lncli create`)
- ⏳ Testnet deployment to VPS
