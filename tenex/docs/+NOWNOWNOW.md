# NowNowNow

*Last updated: 2026-04-09 06:30 UTC — Thread page 404 fixed. TradeForm wallet balance CTA shipped. Auth-gate on replies shipped. UX audit complete.*

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

## 🔄 In Flight

| Item | Conv | Status |
|------|------|--------|
| **CDK Mint Implementation** | 00b6ea0772 | 🔄 mint-engineer implementing blind signing on phase-8-testnet-mint |
| **Docs cleanup** | 8767a64e4d | 🔄 resolutionService.ts → withdrawalService.ts rename in progress |

---

## ✅ Shipped Today (2026-04-09)

| Item | Commit | Status |
|------|--------|--------|
| **Thread page 404 fix** | committed | ✅ Back-button + breadcrumb no longer link to non-existent /discussion sub-route |
| **TradeForm: wallet balance + fund CTA** | `2e42de0` | ✅ Balance shown, submit disabled at 0 sats, "Fund your wallet →" link to /wallet |
| **Auth-gate reply buttons** | `a4a9ed3` | ✅ OriginalPost + ReplyThread show "sign in to reply" when logged out |
| **Nav "Sign in" → /join + welcome page orientation** | `485c0e4` | ✅ New users routed to /join, not Nostr-only reconnect |
| **Real-time reply subscription overhaul** | `851bf0a` | ✅ Correct e-tag filter, reactive readiness, race condition fix |
| **Nested reply double-attach fix** | `6f2862f` | ✅ replyTo as direct parent, rootId as fallback |
| **isReady() polling fix (discuss + analytics)** | `86c0d42` | ✅ Reactive setInterval instead of one-shot effect |
| **Charts tab removed from market page** | `de1ea60` | ✅ No dead-end placeholders |
| **Raw pubkey removed from join success** | `33a62ec` | ✅ No Nostr jargon for new users |
| **Profile Followers/Following placeholders** | `31e8176` | ✅ Replaced "Coming soon" with em-dash |
| **Thread reply subscription (initial)** | `c2169ba` | ✅ Feature foundation |
| **Discuss CTA, thread URL, sort wired** | `8e4fadf` | ✅ Multiple UX fixes |
| **Loading gate removed (profile page)** | committed | ✅ No loading spinners on profile |
| **Key generation + nsec removal** | multiple | ✅ Real key gen, no nsec display |
| **Analytics dashboard** | multiple | ✅ Full PASS — real Nostr data, Bloomberg aesthetic |
| **Join page redesign** | multiple | ✅ Human/agent visual dominance + copy rewrite |
| **Wallet store consolidation** | phase-8 branch | ✅ On branch awaiting Pablo's testnet decision |

---

## ✅ Complete (phase-8-testnet-mint branch — awaiting Pablo's merge decision)

| Item | Commits | Status |
|------|---------|--------|
| **Phase 8 production hardening** | `78b074d`–`550629f` | ✅ All done. walletErrors.ts, walletHistory.ts, all components, mintHealthy defaults false, all 11 error codes. |
| **Wallet store consolidation** | on branch | ✅ Single source of truth, deposit flow, QR local gen |
