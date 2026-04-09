# NowNowNow

*Last updated: 2026-04-09 00:30 UTC — Session: join page, activity, discuss, market detail all shipped. Analytics dashboard in 3rd iteration.*

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
| **Analytics dashboard** | 1085c84f50 | 🔄 3rd revision — fixing reply-thread drops + hard cap stats. 2 review FAILs so far. |

## ✅ Shipped (2026-04-09 ~00:00-00:30 UTC)

| Item | Commit | Status |
|------|--------|--------|
| **Join page redesign** | `e78666f`, `ea646d8`, `fab19a3` | ✅ Large human/agent tiles (dominant visual), emerald/neutral left borders, punchy copy, no jargon |
| **Activity page: remove loading gate** | `f1b4bcc` | ✅ Data streams immediately — no blank page wait |
| **Discuss page style fixes** | `6348eb5` | ✅ divide-y list, button tabs for filters, header cleanup |
| **Market detail page redesign** | `293d9d4` | ✅ No card wrappers, border-only YES/NO + submit, clean header |

## ✅ Shipped (2026-04-08)

| Item | Commit | Status |
|------|--------|--------|
| **Phase 8 production hardening** | `78b074d`–`550629f` | ✅ All done. walletErrors.ts, walletHistory.ts, all components, mintHealthy defaults false, all 11 error codes. |
| **Cross-project conversation routing fix** | `1327a124`, `02a0cad6` | ✅ One-off scheduled tasks now fire across projects. ConversationResolver disk fallback + error logging. 3 regression tests. |
| **Onboarding funnel fixes (3 blockers)** | `dc08d97`, `485c0e4`, `13e023a` | ✅ Post-join 404 fixed, nav→/join, wallet CTA copy |
| **Wallet Refactor Steps 1-3** | `0e9779f`, `e358fd6`, `da7fbca` | ✅ All committed + pushed |
| **7 UX fixes** | `6e83c62` | ✅ No spinners, no Nostr jargon across Welcome/Profile/Wallet/NavHeader/TestnetBanner/Discuss/Profile |
| **Project documentation** | `a64c04c`, `f04da2a` | ✅ 15 docs + 44 tenex/docs + corrections |
| **SEO fixes** | `fde14de` | ✅ SeoHead, dynamic OG meta |

## 🗺️ Phase 8 Status — `phase-8-testnet-mint` branch

### Mint (Rust CDK)
- ✅ CDK project compiles, real blind signing
- ✅ Two keysets per market (LONG/SHORT) via rotate_keyset
- ✅ NUT-04 + NUT-05 via cdk_axum router
- ✅ ALL DB column bugs fixed (insert_trade, insert_payout, insert_lmsr_snapshot, get_price_history)
- ⏳ LND wallet creation (Pablo must run `lncli create`)
- ⏳ Testnet deployment to VPS

### Frontend (Complete)
- ✅ Wallet store consolidation (single source of truth)
- ✅ Deposit flow (local QR, auto-polling, countdown)
- ✅ Lightning withdrawal (withdrawService, WithdrawConfirmation, WithdrawStatus)
- ✅ Production hardening (all 11 error codes, mintHealthy defaults false)
