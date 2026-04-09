# React → Svelte Feature Gap Audit Report

**Date:** 2026-04-09  
**Auditor:** explore-agent  
**React source:** git commit `638c064` (last React commit before migration)  
**Svelte source:** current `main` branch  

---

## Executive Summary

The Svelte port covers **~55-60%** of the React frontend's feature surface. Core flows (market browsing, trading, wallet, portfolio, discussion) are functional, but significant gaps exist in data visualization, the entire agent/dashboard subsystem, market detail depth, and several secondary pages.

### Completeness by Area

| Area | Completeness | Notes |
|------|-------------|-------|
| Routing structure | 65% | 8 of 12+ route groups ported; entire /dashboard subtree missing |
| Market detail page | 35% | Trading works but charts, activity, positioning, embed all missing |
| Landing page | 50% | Market cards present but sections, sparklines, discussions missing |
| Portfolio | 70% | Positions + redemption work; payout history from Nostr missing |
| Wallet | 110% | Svelte wallet is MORE complete than React (melt/withdraw flows) |
| Discussion | 60% | Basic thread list works; sorting, stance, evidence types missing |
| Profile | 50% | Basic profile works; Nostr fetch, positions tab, edit modal missing |
| Settings | 40% | Profile edit works; relays, notifications, key management missing |
| Activity feed | 50% | Basic feed works; filters, event types, skeletons missing |
| Analytics | 30% | Page exists but charts, sparklines, detailed metrics missing |
| Agent/Dashboard | 0% | Entire subsystem absent — 6+ pages, sidebar, all features |
| Leaderboard | 0% | No Svelte equivalent |
| Thesis Builder | 80% | Svelte component exists; thesis creation flow may need verification |
| Blog | 50% | Static pages exist; dynamic content/rendering needs verification |
| Onboarding | 60% | Join/welcome pages work; split-panel, OAuth, key import missing |

---

## Route-by-Route Gap Analysis

### 1. Landing Page (`/`)

**React** (1359 lines, `LandingPage.tsx`):
- Hero section with CTA
- Trending markets section
- Low Volume markets section
- Most Disputed markets (with debate cards + discussion previews)
- New This Week markets section
- Latest Discussions section
- Create Market modal (title, description, side select, amount)
- Sparkline component for mini price charts on market cards
- PulseDot animation component
- Sample market data for demo mode
- PostHog tracking (trackMarketView, etc.)

**Svelte** (964 lines, `+page.svelte`):
- Trending markets ✅
- Low Volume markets ✅
- Disputed markets ✅
- Create market modal ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Sparkline mini-charts on market cards | High | M |
| PulseDot animation component | Low | S |
| "New This Week" markets section | High | S |
| "Latest Discussions" section | High | M |
| Most Disputed debate cards with discussion previews | High | M |
| Demo/sample market data for empty states | Medium | S |
| PostHog event tracking | Medium | M |

---

### 2. Market Detail Page (`/market/:slug` → `/mkt/[slugAndPrefix]`)

**React** (1130 lines, `MarketDetail.tsx` + `MarketTabsShell.tsx`):
- **4 tabs**: Overview / Discussion / Charts / Activity
- **Overview tab**:
  - Tilt copy (bull/bear sentiment narrative)
  - Trade panel (BUY YES/NO, amount, price preview, debounced execution)
  - PostHog first-trade tracking
  - Price and positioning section with PriceChart
  - Largest positioned accounts section (Long/Short/Gross per actor)
  - Recent fills section (receipts with notional/tokens/reserve)
  - MarketDiscussionPanel (overview variant)
  - Mint info display (mint name, supportsCascade check)
  - Embed modal button + EmbedModal component
  - Trade frame contextual advice (getTradeFrame)
  - ACTOR_LABELS for human-readable actor names
- **Discussion tab**: Full MarketDiscussionPanel
- **Charts tab**: PriceChart (lightweight-charts AreaSeries + LineSeries for price + reserve), latest execution detail, recent fills
- **Activity tab**: Events log, receipt log, positioning breakdown

**Svelte** (343 lines, `+page.svelte`):
- **3 tabs**: Overview / Discussion / Positions
- **Overview tab**: Probability display, trade panel (YES/NO, amount), description
- **Discussion tab**: MarketDiscussionList
- **Positions tab**: Empty state placeholder

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| PriceChart (lightweight-charts) — price curve + reserve line | **Critical** | L |
| Charts tab entirely | **Critical** | L |
| Activity tab entirely | **Critical** | L |
| Tilt copy (bull/bear narrative) | High | M |
| Largest positioned accounts section | High | M |
| Recent fills / receipt log | High | M |
| EmbedModal + embed button | High | S |
| Mint info display (name, supportsCascade) | High | S |
| Trade frame contextual advice | Medium | M |
| ACTOR_LABELS (human-readable actor names) | Medium | S |
| PostHog first-trade tracking | Medium | M |
| Trade debounce protection | Medium | S |
| Price and positioning section | High | M |
| MarketDiscussionPanel overview variant (inline on overview tab) | Medium | S |

---

### 3. Portfolio Page (`/portfolio`)

**React** (397 lines, `Portfolio.tsx`):
- Enriched positions with currentPrice, marketValue, PnL, PnL%
- Payout history (from Nostr events via fetchPayoutEvents)
- PayoutRecord type: marketId, marketTitle, outcome, payoutSats, rakeSats, netSats, resolvedAt
- Redemption flow (settlementService: canRedeemPosition, getRedemptionQuote, redeemPosition)
- Auto-refresh on window focus
- Open/Settled tabs
- formatCurrency and formatPercent helpers

**Svelte** (`/portfolio/+page.svelte`):
- Enriched positions with PnL ✅
- Total portfolio value ✅
- Redemption flow ✅
- Open/Withdrawn tabs ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Payout history (from Nostr kind:30078 events) | High | M |
| Payout detail (rakeSats, netSats breakdown) | Medium | S |
| Auto-refresh on window focus | Low | S |

---

### 4. Profile Page (`/profile` and `/u/:pubkey`)

**React** (292 lines `Profile.tsx` + 389 lines `ProfilePage.tsx`):
- **Profile** (`/profile`): Display name, about, avatar URL, edit form, save to localStorage, loadStoredKeys, nip19 decode
- **ProfilePage** (`/u/:pubkey`): Markets tab, positions tab (from positionService kind:30078), edit profile modal, load profile from Nostr (kind:0), NDK fetch

**Svelte** (`/profile/+page.svelte` + `/profile/[pubkey]/+page.svelte`):
- Basic profile display ✅
- Profile/[pubkey] with markets ✅
- Profile/[pubkey]/portfolio route ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Nostr kind:0 profile fetch (NDK) | High | M |
| Positions tab on profile (kind:30078) | High | M |
| Edit profile modal | High | M |
| nip19 decode/display | Medium | S |
| Avatar URL display | Medium | S |

---

### 5. Discussion / Thread Pages

**React** (`DiscussPage.tsx` 558 lines + `ThreadPage.tsx` 588 lines):
- **DiscussPage**: Sort options (hot/new/top/controversial), post types (argument/evidence/rebuttal/analysis), stance indicator (bull/bear), thread preview cards, reply hierarchy
- **ThreadPage**: Full thread with nested replies, VoteButtons (NIP-25 reactions), publishMarketReply, publishReaction, fetchReactions, subscribeToReactions, reply tree rendering

**Svelte** (`/discuss/+page.svelte` + `/thread/[marketId]/+page.svelte`):
- Discussion list component (MarketDiscussionList) ✅
- Thread view ✅
- VoteButtons component ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Sort options (hot/new/top/controversial) | High | M |
| Post type classification (argument/evidence/rebuttal/analysis) | High | M |
| Stance indicator (bull/bear) | Medium | S |
| Thread preview cards (on market discussion list) | Medium | M |
| NIP-25 reaction subscriptions (live updates) | High | M |
| Reply hierarchy rendering | Medium | M |

---

### 6. Wallet Page (`/wallet`)

**React** (`Wallet.tsx` 378 lines):
- Balance display
- Vault balance
- Deposit flow (createDeposit, bolt11 invoice, QR code via qrcode.react)
- Send tokens (ecash token)
- Receive token
- Wallet status (disconnected/connecting/ready/error)
- balance_updated listener

**Svelte** (`/wallet/+page.svelte` 761 lines):
- Deposit tab ✅ (createMarketDeposit, InvoiceExpiry, MintHealthIndicator, QRCode)
- Withdraw tab ✅ (detectInputType, extractAmountFromBolt11, estimateMeltFee, meltTokens, WithdrawConfirmation, WithdrawStatus)
- Balance display ✅
- Wallet history ✅ (addTransaction/updateTransaction/getTransactions)

**GAP ANALYSIS:** Svelte wallet is **MORE complete** than React. React had basic deposit/send/receive; Svelte has full melt/withdraw flows, fee estimation, confirmation steps, and transaction history. 

**Minor missing:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Vault balance display | Low | S |
| Send ecash token flow | Medium | M |

---

### 7. Activity Feed (`/activity`)

**React** (`Activity.tsx` 526 lines):
- Filter by type: All / New Markets / Trades / Resolutions
- Market trades events
- New markets events
- Resolution events
- Skeleton loading states

**Svelte** (`/activity/+page.svelte`):
- Basic activity feed ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Event type filters (All/Trades/Markets/Resolutions) | High | S |
| Skeleton loading states | Medium | S |
| Structured event rendering (per-type) | Medium | M |

---

### 8. Analytics Dashboard (`/analytics`)

**React** (`AnalyticsDashboard.tsx` ~500 lines with supporting files):
- AnalyticsSummary from API
- Session metrics table
- Market activity table
- Platform stats
- AggregatePnLChart (119 lines)
- PerAgentPnLChart (156 lines)
- PnLCharts component (53 lines)
- Sparkline components

**Svelte** (`/analytics/+page.svelte`):
- Page exists but minimal

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Aggregate PnL chart | High | L |
| Per-agent PnL chart | High | L |
| Session metrics table | Medium | M |
| Market activity table | Medium | M |
| Platform stats dashboard | Medium | M |
| Sparkline components | Medium | M |
| ReserveChart | Medium | M |

---

### 9. Leaderboard (`/leaderboard`)

**React** (`Leaderboard.tsx` 517 lines):
- 4 tabs: Top Predictors / Top Creators / Most Accurate / Most Bookmarked
- Bookmark-based rankings

**Svelte**: ❌ **ENTIRELY MISSING**

| Gap | Severity | Complexity |
|-----|----------|-----------|
| Leaderboard page (all 4 tabs) | High | L |

---

### 10. Settings Page (`/settings`)

**React** (`SettingsPage.tsx` 281 lines):
- Profile edit (display name, about, avatar)
- Relay configuration
- Notification preferences (5 types + capital threshold)
- Wallet balance display
- Key info (npub)

**Svelte** (`/settings/+page.svelte`):
- Profile edit ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Relay configuration | High | M |
| Notification preferences | High | M |
| Capital threshold notification setting | Medium | S |
| Key info display (npub) | Medium | S |
| Wallet balance on settings | Low | S |

---

### 11. Onboarding / Join Pages (`/join`, `/onboarding`)

**React** (`OnboardingSplit.tsx` 736 lines):
- Split-panel layout
- OAuth integration (Twitter, Telegram)
- Key generation
- Key import flow
- Agent vs Human profile selection
- Welcome messaging

**Svelte** (`/join/+page.svelte` + `/welcome/+page.svelte`):
- Basic join page ✅
- Welcome page ✅

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| OAuth integration (Twitter, Telegram) | High | L |
| Split-panel onboarding layout | Medium | M |
| Key import flow | High | M |
| Agent vs Human profile selection | Medium | M |

---

### 12. Blog Page (`/blog`)

**React** (`Blog.tsx`): Dynamic blog with posts, articles, titles, dates, authors, content rendering

**Svelte** (`/blog/+page.svelte`): Exists but needs verification of content rendering completeness

**Potential gaps:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| Dynamic blog post rendering | Medium | M |
| Blog post detail view | Medium | S |

---

### 13. How It Works / Help Page (`/how-it-works` → `/help`)

**React** (`HowItWorks.tsx` 517 lines):
- Multiple sections with step-by-step explanations
- Feature highlights
- FAQ/accordion sections

**Svelte** (`/help/+page.svelte`):
- Basic help page

**MISSING in Svelte:**
| Gap | Severity | Complexity |
|-----|----------|-----------|
| FAQ accordion component | Medium | M |
| Step-by-step feature tour | Low | M |

---

### 14. Bookmarks Page (`/bookmarks`)

**React** + **Svelte**: Both exist with basic bookmark list functionality. ✅

---

## ENTIRELY MISSING SUBSYSTEMS

### Agent Dashboard (`/dashboard` subtree) — 0% Ported

This is the largest gap. The React app had a complete agent/dashboard subsystem:

| Route | React Component | Features | Svelte Equivalent |
|-------|----------------|----------|-------------------|
| `/dashboard` | AgentDashboard | Sidebar nav (Overview/Fields/Agents/Treasury/Activity/Settings) | ❌ None |
| `/dashboard` (index) | DashboardOverview | Action items, fields summary, agent status cards | ❌ None |
| `/dashboard/fields` | FieldsHome | Search, attention badges, disagreement indicators, source library | ❌ None |
| `/dashboard/field/:id` | FieldDetail | 4 tabs (Meeting/Positions/Library/Council), meeting entries, tensions, proposed actions | ❌ None |
| `/dashboard/field/:id/meeting` | MeetingView | Live meeting entries, tensions, proposed actions | ❌ None |
| `/dashboard/agents` | AgentsPage | Agent list, status, management | ❌ None |
| `/dashboard/treasury` | TreasuryPage | Treasury overview, balances | ❌ None |
| `/dashboard/activity` | (DashboardActivity) | Dashboard-specific activity feed | ❌ None |
| `/dashboard/settings` | (DashboardSettings) | Dashboard configuration | ❌ None |
| `/hire-agents` | HireAgents | Agent planner with count/roles/FAQ, feature cards, install flow | ❌ None |
| `/enroll-agent` | EnrollAgent | SKILL.md content, code examples, agent enrollment flow | ❌ None |

**Estimated complexity to port: XL** — This is an entire application sub-section with complex state management, real-time features, and domain-specific UI.

---

## Missing Cross-Cutting Features

### Charts / Data Visualization

| Feature | React File | Lines | Svelte Status |
|---------|-----------|-------|---------------|
| PriceChart (lightweight-charts) | PriceChart.tsx | 134 | ❌ Missing |
| ReserveChart | ReserveChart.tsx | 104 | ❌ Missing |
| AggregatePnLChart | AggregatePnLChart.tsx | 119 | ❌ Missing |
| PerAgentPnLChart | PerAgentPnLChart.tsx | 156 | ❌ Missing |
| Sparkline | (inline in LandingPage) | ~30 | ❌ Missing |

All chart components used the `lightweight-charts` library. Svelte has no chart implementation at all.

### Services (backend logic)

| Service | React Lines | Svelte Status |
|---------|------------|---------------|
| nostrService | 637 | Partially ported (lib/stores/nostr.svelte.ts) |
| quoteService | 512 | Needs verification |
| positionService | 400 | Partially ported |
| depositService | 308 | Ported (wallet page) |
| resolutionService | 300 | Needs verification |
| tradingService | 272 | Ported |
| mintDiscoveryService | 219 | Needs verification |
| bookmarkService | 168 | Ported |
| marketService | 153 | Ported |
| participantIndex | 113 | ❌ Likely missing |
| keysetService | 298 | Needs verification |
| settlementService | 269 | Partially ported |

### Stores

| Store | React Lines | Svelte Status |
|-------|------------|---------------|
| bookmarkStore | 533 | Ported |
| positionStore | 351 | Partially ported |
| profileStore | 151 | Partially ported |
| walletStore | 136 | Ported (more complete) |
| vaultStore | 95 | Needs verification |

### Key Components

| Component | React | Svelte |
|-----------|-------|--------|
| NavHeader | 307 lines | Ported (NavHeader.svelte) |
| MarketTabsShell | Tab container | Svelte uses inline tabs |
| EmbedModal | EmbedModal.tsx | EmbedModal.svelte exists (142 lines) ✅ |
| TiptapEditor | 231 lines | Needs verification |
| AgentFeatureSection | 228 lines | ❌ Missing (agent subsystem) |
| VoteButtons | Inline | VoteButtons.svelte ✅ |
| MarketDiscussionPanel | In DiscussPage.tsx | MarketDiscussionList.svelte ✅ |
| QRCode | qrcode.react | Ported with different library |

---

## Priority-Ordered Gap List

### Tier 1: Critical — Core Functionality Missing

| # | Gap | Affected Page | Complexity | Notes |
|---|-----|--------------|-----------|-------|
| 1 | PriceChart (lightweight-charts) | Market Detail | L | No price visualization at all; most impactful single gap |
| 2 | Charts tab on market detail | Market Detail | L | Includes price curve, latest execution, recent fills |
| 3 | Activity tab on market detail | Market Detail | M | Events log, receipt log, positioning breakdown |
| 4 | Payout history in Portfolio | Portfolio | M | Nostr kind:30078 event fetch; users can't see resolved payouts |

### Tier 2: High — Notable UX Gaps

| # | Gap | Affected Page | Complexity | Notes |
|---|-----|--------------|-----------|-------|
| 5 | Tilt copy / trade frame on market detail | Market Detail | M | Bull/bear narrative + contextual advice; key UX differentiator |
| 6 | Largest positioned accounts section | Market Detail | M | Shows who's long/short and by how much |
| 7 | Recent fills / receipt log | Market Detail | M | Trade transparency |
| 8 | Leaderboard page (entirely missing) | Leaderboard | L | 4-tab page with Top Predictors/Creators/Accurate/Bookmarked |
| 9 | Discussion sort options (hot/new/top/controversial) | Discussion | M | No sorting; flat list only |
| 10 | Discussion post types (argument/evidence/rebuttal/analysis) | Discussion | M | No type classification; all posts look the same |
| 11 | Profile Nostr fetch (kind:0) | Profile | M | Profile pages can't load real Nostr profiles |
| 12 | Profile positions tab (kind:30078) | Profile | M | Can't see other users' positions |
| 13 | Edit profile modal | Profile | M | No way to edit display name, about, avatar |
| 14 | Relay configuration in Settings | Settings | M | No relay management UI |
| 15 | Notification preferences in Settings | Settings | M | No notification config |
| 16 | Activity feed type filters | Activity | S | Can't filter by trades/markets/resolutions |
| 17 | Landing page: "New This Week" section | Landing | S | Entire section missing |
| 18 | Landing page: "Latest Discussions" section | Landing | M | No discussion previews on homepage |
| 19 | Sparkline mini-charts on market cards | Landing + Market | M | No price sparklines anywhere |
| 20 | OAuth integration (Twitter, Telegram) | Onboarding | L | Social login entirely missing |
| 21 | Key import flow | Onboarding | M | Can only generate new keys |

### Tier 3: Medium — Nice-to-Have Enhancements

| # | Gap | Affected Page | Complexity | Notes |
|---|-----|--------------|-----------|-------|
| 22 | Analytics: PnL charts | Analytics | L | No chart visualizations |
| 23 | Analytics: session metrics table | Analytics | M | No session data |
| 24 | Mint info display on market detail | Market Detail | S | Show mint name + supportsCascade |
| 25 | Embed modal button on market detail | Market Detail | S | Component exists but not wired up |
| 26 | Trade debounce protection | Market Detail | S | Prevents double-trades |
| 27 | Stance indicator (bull/bear) in discussions | Discussion | S | Visual indicator of poster stance |
| 28 | NIP-25 reaction subscriptions | Discussion | M | Live reaction updates |
| 29 | Profile edit from ProfilePage | Profile | M | No inline edit on /u/:pubkey |
| 30 | FAQ accordion on Help page | Help | M | Better onboarding UX |
| 31 | Skeleton loading states | Activity, Market | S | Polish |
| 32 | Auto-refresh portfolio on focus | Portfolio | S | Stale data otherwise |
| 33 | Vault balance in Wallet | Wallet | S | React showed vault balance separately |

### Tier 4: Agent Dashboard — Entire Subsystem

| # | Gap | Complexity | Notes |
|---|-----|-----------|-------|
| 34 | Agent Dashboard with sidebar nav | XL | 6+ routes, complex state |
| 35 | DashboardOverview (action items, fields, agents) | L | Real-time status |
| 36 | Fields management (search, badges, library) | L | Complex domain logic |
| 37 | Field Detail (4 tabs) | XL | Meeting, positions, library, council |
| 38 | Meeting View (live entries, tensions, actions) | L | Real-time meeting system |
| 39 | Agents Page (list, status, management) | M | Agent CRUD |
| 40 | Treasury Page | M | Treasury overview |
| 41 | Hire Agents page | M | Planner + agent catalog |
| 42 | Enroll Agent page | M | SKILL.md + enrollment flow |

---

## Summary Statistics

- **Total React routes:** 35+ (including dashboard sub-routes)
- **Svelte routes:** 20
- **Routes entirely missing in Svelte:** 15+ (mostly dashboard/agent subtree + leaderboard)
- **Critical feature gaps:** 4
- **High-severity gaps:** 17
- **Medium gaps:** 12
- **Agent/Dashboard gaps:** 9 (entire subsystem)
- **Largest single gap:** PriceChart + Charts tab (affects core product UX)
- **Svelte advantage:** Wallet page is significantly more complete than React

---

## Recommendations

1. **Start with PriceChart** — it's the single most impactful missing feature. Use `lightweight-charts` (same as React) or a Svelte-compatible chart library.
2. **Add Charts and Activity tabs to market detail** — these are core market transparency features.
3. **Port payout history to Portfolio** — users need to see resolved market outcomes.
4. **Add discussion sorting and post types** — significantly improves discussion UX.
5. **Port profile Nostr integration** — essential for social features.
6. **Defer Agent Dashboard** — it's a complete subsystem; plan it as a dedicated phase.
7. **Add Leaderboard** — relatively straightforward page with high user engagement value.