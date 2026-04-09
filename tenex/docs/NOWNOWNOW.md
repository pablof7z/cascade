# NowNowNow

*Last updated: 2026-04-09 05:30 UTC — Tracking sweep complete. All work on main. No active delegations.*

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

*(nothing — clean)*

---

## ✅ Shipped Today (2026-04-09)

| Item | Commit | Status |
|------|--------|--------|
| **Thread reply subscription overhaul** | `851bf0a` | ✅ Correct e-tag filter, reactive readiness, race condition fix |
| **Nested reply double-attach fix** | `6f2862f` | ✅ replyTo as direct parent, rootId as fallback |
| **isReady() polling fix (discuss + analytics)** | `86c0d42` | ✅ Reactive setInterval instead of one-shot effect |
| **Remove Charts tab (dead placeholder)** | `de1ea60` | ✅ No dead ends on market page |
| **Remove raw pubkey from join success** | `33a62ec` | ✅ No jargon on success screen |
| **Profile followers/following → em-dash** | `31e8176` | ✅ No "Coming soon" on profile page |
| **Real-time reply subscription** | `c2169ba` | ✅ Thread page gets live replies |
| **Discuss CTA + thread URL + sort** | `09aad7c` + `8e4fadf` | ✅ Wired up |
| **Key generation fix** | `2da5fdf` | ✅ Real generateKeyPair/saveKeys used |
| **NSec bech32 validation + OAuth timeout** | `d0f847c` | ✅ Clean |
| **Uppercase tracking cleanup** | `ebe376c` | ✅ Style guide compliant |
| **Analytics dashboard** | (multiple) | ✅ Real data, Bloomberg aesthetic, PASS after 6 review cycles |
| **Live ticker on homepage** | (multiple) | ✅ Seamless animation |
| **NavHeader on all pages** | (multiple) | ✅ Consistent navigation |
| **Join page redesign** | `e78666f`, `ea646d8` | ✅ Human/agent tiles, jargon-free |

---

## 📦 Complete (phase-8-testnet-mint branch — awaiting Pablo's merge decision)

| Item | Status |
|------|--------|
| **LND + Bitcoin Core installed** | ✅ Homebrew install complete, awaiting `lncli create` |
| **Wallet error handling (11 error codes)** | ✅ Complete on branch |
| **walletErrors.ts + walletHistory.ts** | ✅ Complete on branch |
| **mintHealthy defaults false** | ✅ Complete on branch |
| **withdrawService.ts + components** | ✅ Complete on branch |
| **Phase 8 production hardening** | `78b074d`–`550629f` | ✅ On branch |

---

## ✅ Shipped (2026-04-08)

| Item | Commit | Status |
|------|--------|--------|
| **Wallet Refactor Steps 1-3** | `0e9779f`, `e358fd6`, `da7fbca` | ✅ Committed + pushed |
| **500 Error Hotfix (/market/[marketId])** | `1546887` | ✅ Committed + pushed |
| **Memory leak fix (discuss page subscriptions)** | `57eb103` | ✅ Committed + pushed |
| **UI Audit Fixes (12 page titles, jargon removal)** | `6d88edd` | ✅ Committed + pushed |
| **Phase 8 Planning Artifacts** | `711bbc4` | ✅ 25 plan files committed |
| **Cross-project conversation routing fix** | `1327a124`, `02a0cad6` | ✅ Merged |
| **Onboarding funnel fixes (3 blockers)** | `dc08d97`, `485c0e4`, `13e023a` | ✅ Post-join 404 fixed, nav→/join, wallet CTA |

---

## 🚫 Current Blockers

### 1. LND Wallet Creation — Blocked on Pablo ⚠️
- Bitcoin Core + LND installed via Homebrew (signet mode)
- **REQUIRES Pablo to run:** `lncli --lnddir=/Users/customer/.lnd --network=signet create`
- Nothing moves on testnet/Lightning until this is done

### 2. Growth Campaign — Blocked on Pablo
- 10 personalized DMs ready — all content prepped
- **REQUIRES Pablo to manually send from his X account** (~20 min)

### 3. Substack Article — Blocked on Pablo
- Article published to Nostr ✅
- Substack publishing needs Pablo's login/approval

---

## 🎯 What's Next (Priority Order)

1. **Pablo: Run LND create command** → unblocks all testnet/Lightning work
2. **Pablo: Send 10 DMs from X account** → drive first user interviews
3. **Review and publish Substack article** → strong piece, ready to go
4. **Phase 8: Merge to main** → after Pablo's LND decision
5. **Domain registration** → contrarian.markets / contrarianmarkets.com
