# Web Launch Implementation Plan

This document is the canonical launch checklist for `web/`.

It answers one strict question: what exact feature set must exist in `web/` for Cascade to launch without depending on any failed legacy frontend snapshot?

Legacy frontend snapshots are reference material at most. `web/` is the active frontend.

## Source Hierarchy

Use these sources in this order when implementing launch:

1. [`../HOW-IT-WORKS.md`](../HOW-IT-WORKS.md)
2. [`../design/product-decisions.md`](../design/product-decisions.md)
3. [`../product/spec.md`](../product/spec.md)
4. [`../technical/frontend.md`](../technical/frontend.md)
5. [`../mint/api.md`](../mint/api.md)
6. [`./usd-stablemint-stripe-implementation.md`](./usd-stablemint-stripe-implementation.md)
7. [`./end-to-end-launch-implementation.md`](./end-to-end-launch-implementation.md)

If the old React app conflicts with current mechanics, current mechanics win.

The field-centered workspace and hosted-agent product are later milestones. They are not launch requirements for `web/`.

## Launch Definition

Launch means:

- `web/` implements the full public market product and full account layer.
- all launch routes use real data and real mint/Nostr integrations rather than placeholder catalogs
- all authenticated product actions execute through NIP-98-signed API endpoints
- the agent onboarding path is functional through `/join` and `/SKILL.md`
- discovery and search are relay-based — the frontend queries relays directly for market and trade events
- portfolio proofs remain self-custodied by the user or agent
- portfolio and trading surfaces are dollar-denominated
- portfolio funding runs through Stripe and Lightning
- signet and mainnet are separate frontend editions with separate proof namespaces and environment labeling
- both editions use the same browser-local proof storage implementation; NIP-60 is deferred
- template/demo routes that are not part of Cascade are removed, redirected, or repurposed
- no launch-critical surface depends on legacy frontend snapshot code

Launch does not require:

- `/embed` and `/embed/market/:slug`
- `/dashboard`
- `/dashboard/fields`
- `/dashboard/fields/new`
- `/dashboard/field/:id`
- `/dashboard/agents`
- `/dashboard/agent/:id`
- `/dashboard/treasury`
- `/dashboard/activity`
- `/dashboard/settings`
- field-centered workspace behavior
- hosted-agent provisioning and management UI
- public editorial topic collections outside the core market feed
- internal blog-post rendering if `/blog` is only a curated landing page or Substack gateway

## Non-Negotiable Product Rules

- Markets trade indefinitely.
- There is no external adjudication event.
- There is no external adjudicator.
- No expiry or countdown logic belongs in the product.
- Linked markets are informational only.
- Kind `982` creates markets.
- Kind `983` is mint-authored trade history.
- Discussion is append-only Nostr content under NIP-22-style semantics. There is no moderation, edit, or delete layer in the product.
- Authenticated API endpoints use NIP-98.
- Follow graph data comes from real kind `3` follow events.
- Discovery and search are relay-based. The frontend queries relays directly. There is no backend market data API.
- Portfolio proofs are self-custodied. There is no canonical `/api/wallet` balance endpoint.
- The browser Cashu client is pinned explicitly to a version compatible with the mint's active keyset-id derivation and standard mint/melt flow behavior.
- The normal human product UI does not expose sats, msats, or Lightning invoices.
- Portfolio funding is Stripe and Lightning-based and market trading spends USD value.
- Public market discovery excludes markets until the first mint-authored kind `983`.
- No mock data in production.
- No Nostr jargon in user-facing UI.

The launch flow is relay-first: client publication creates kind `982`, relay reads power public
discovery and detail views, build-time edition config replaces the runtime manifest, and the first
seed-trade quote/buy carries the signed kind `982` when the mint has not seen the market yet.

## Route Inventory And Disposition

### Canonical launch routes

- `/`
- `/subscriptions`
- `/markets`
- `/market/:slug`
- `/market/:slug/discussion`
- `/market/:slug/discussion/:threadId`
- `/market/:slug/charts`
- `/market/:slug/activity`
- `/builder`
- `/activity`
- `/bookmarks`
- `/leaderboard`
- `/analytics`
- `/how-it-works`
- `/blog`
- `/join`
- `/onboarding`
- `/profile`
- `/p/:identifier`
- `/portfolio`
- `/privacy`
- `/terms`
- `/404` or equivalent catch-all not-found handling
- `/SKILL.md`

### Later milestone routes

- `/embed`
- `/embed/market/:slug`
- `/dashboard`
- `/dashboard/fields`
- `/dashboard/fields/new`
- `/dashboard/field/:id`
- `/dashboard/agents`
- `/dashboard/agent/:id`
- `/dashboard/treasury`
- `/dashboard/activity`
- `/dashboard/settings`

### Routes in current `web/` that should be removed or repurposed before launch

- `/about` unless repurposed into canonical product content
- `/highlights` unless repurposed into a real Cascade surface
- `/note/:id` unless repurposed into blog/article rendering
- `/u/:pubkey` should not ship as a public route
- `/profile/:identifier` should not ship as a public route
- `/wallet` should not exist at launch
- `/relays` and `/relay/:hostname` as public product routes

## Route Assumptions Locked By This Plan

These route choices are part of the launch target unless a later explicit product decision changes them.

- `/onboarding` is the post-join bootstrap route, not the main public account-entry route.
- `/profile` is the canonical self-profile surface.
- `/p/:identifier` is the canonical public-profile route.
- `/portfolio` is the canonical self-custodied capital and positions surface.
- `/wallet` should not exist at launch.
- `/u/:pubkey` and `/profile/:identifier` should not ship at launch, including as compatibility redirects.
- `/blog` is a curated narrative route, not a required full CMS.

## Current Gap Summary

At the time of writing, `web/` already contains pieces of the launch product, but the launch surface is incomplete.

### Already present in `web/`, but not launch-complete

- homepage
- subscriptions
- join
- onboarding
- market detail root page
- builder
- activity
- bookmarks
- leaderboard
- analytics
- portfolio
- profile

### Missing or wrong relative to the launch target

- no market tab subroutes for discussion, charts, activity, or thread detail
- no relay-based discovery/search layer yet wired in the app shell
- current authenticated action flow is not yet locked to NIP-98-signed API calls
- current public profile does not yet prove real follow-graph behavior from kind `3`
- current public profile still lacks recent discussion activity and follow controls
- current `web/` still includes template routes outside the Cascade product surface
- current content routes do not yet prove the full public market + identity launch surface
- current portfolio surface still needs to be fully wired to real local proof state
- current portfolio and market flows still need the USD stablemint + Stripe and Lightning funding story wired end to end
- dashboard/workspace surfaces still exist conceptually, but they are future scope and must not distort launch acceptance

## Workstream 1: Public Shell And Navigation

- [ ] Public site header matches the canonical Cascade nav, not the starter template nav.
- [ ] Header gives fast access to markets, activity, leaderboard, analytics, builder, portfolio, and join/profile.
- [ ] Authenticated state swaps `Join` for session-aware profile/account affordances.
- [ ] Current edition is always visible in the shell.
- [ ] Footer links to how-it-works, privacy, and terms.
- [ ] No public nav item points to dashboard/workspace routes at launch.
- [ ] Not-found handling is explicit and branded.
- [ ] Empty states are purposeful and route users to the next action.
- [ ] All launch pages are responsive on mobile and desktop.
- [ ] No loading spinners or skeleton-driven product logic are introduced.

## Workstream 2: Homepage `/`

- [x] Homepage uses The Column feed shell instead of the transitional marketing/discovery page.
- [x] Compose box exists with note-oriented copy and non-primary post action.
- [x] Feed controls expose `For you` source selection and `All / Notes / Publications` text tabs.
- [x] Feed combines selected-edition relay market, trade, and discussion events.
- [x] Claim, trade, and discussion feed items link to market or discussion surfaces.
- [x] Feed actions route to market pages rather than executing trades inline.
- [x] Empty state routes users to `/markets`.
- [ ] Personalized graph ranking uses follows, subscriptions, watchlist, and held positions.
- [ ] Writer suggestions use real profile/follow data.
- [ ] Load-more and new-post affordances exist.
- [ ] Home note publishing is backed by the planned note event path.

## Workstream 2A: Subscriptions `/subscriptions`

- [x] Route exists and is linked from The Column rail.
- [x] Route uses the two-column reading layout with the right rail hidden.
- [x] Page copy frames Subscriptions as the long-form digest for followed writers.
- [x] Followed-writer filtering uses real kind `3` follow state.
- [x] Claim rows come from selected-edition relay market/trade events.
- [x] Empty states route users to join or markets without mock data.
- [ ] Read/unread state persists after visiting a claim.
- [ ] Case revision rows use real revision metadata when that event path exists.
- [ ] Saved tab is backed by real bookmark state.

## Workstream 3: Discovery And Search

- [ ] Discovery and search are relay-based — the frontend queries relays directly for kind `982` and kind `983` events.
- [ ] There is no backend API for market feeds, search, activity, or price history. Relays are the database.
- [ ] Homepage ranking cuts are derived client-side from relay data (kind `982` market definitions + kind `983` trade events).
- [ ] Public discovery excludes markets that do not yet have a mint-authored kind `983`.
- [ ] Market search exists in the public product, implemented as client-side filtering/ranking of relay-fetched market events.
- [ ] Search supports query by market title, slug, creator identity, and relevant market text.
- [ ] Search results use the same canonical market-card model as the homepage and link directly to market routes.
- [ ] Empty search state is explicit and useful.

## Workstream 4: Market Detail And Market Tabs

### Canonical routes

- [ ] `/market/:slug`
- [ ] `/market/:slug/discussion`
- [ ] `/market/:slug/discussion/:threadId`
- [ ] `/market/:slug/charts`
- [ ] `/market/:slug/activity`

### Overview tab requirements

- [ ] Market header shows title, slug, creator identity, and current price.
- [ ] Key stats block shows price, recent movement, volume, market cap, and trader count.
- [ ] Trading panel shows LONG and SHORT actions.
- [ ] Quick amount buttons in USD exist.
- [ ] Manual USD input exists.
- [ ] Initial seed amount in the builder is treated as total spend, with fees included in that amount.
- [ ] Quote preview shows spend, estimated shares, average fill, and resulting price before execution.
- [ ] The trading panel never exposes sats, msats, or Lightning invoice mechanics.
- [ ] Creator can still reach their own pending market before the first kind `983`.
- [ ] Anonymous viewers can read the market but trade/bookmark/post actions route them into `/join`.
- [ ] Signed-in users can trade directly from the market page.
- [ ] Current-user position summary appears on the market page when signed in.
- [ ] Bookmark action exists.
- [ ] Share action exists.
- [ ] Signal market section shows linked markets plus direction and rationale.
- [ ] Largest positioned accounts section exists.
- [ ] Recent fills section exists.
- [ ] Receipt log / execution history section exists.
- [ ] No terminology implies markets resolve or settle.

### Discussion tab requirements

- [ ] Market-level discussion list exists.
- [ ] Signed-in users can post new discussion items.
- [ ] Signed-in users can reply to existing discussion items.
- [ ] Discussion ordering is reverse-chronological by event creation time.
- [ ] Thread preview cards link to `/market/:slug/discussion/:threadId`.
- [ ] No moderation, edit, or delete controls are exposed.
- [ ] Empty state encourages first discussion rather than blank chrome.

### Thread page requirements

- [ ] Full thread view exists for one discussion item.
- [ ] Parent post context is visible.
- [ ] Reply chain is visible in chronological order.
- [ ] Signed-in users can reply from the thread page.
- [ ] No moderation, edit, or delete controls are exposed.
- [ ] Route back to the market discussion tab is obvious.

### Charts tab requirements

- [ ] Market price history chart exists.
- [ ] Time-range controls exist for `24H`, `7D`, `30D`, and `ALL`.
- [ ] Volume series exists alongside price history.
- [ ] Proper empty state exists when history is short or absent.

### Activity tab requirements

- [ ] Market-scoped activity feed exists.
- [ ] Trade rows exist.
- [ ] Discussion activity rows exist.
- [ ] Activity ordering is reverse-chronological and stable.
- [ ] Pagination or incremental loading supports high-frequency reading.

### Market detail states

- [ ] Market not found state exists.
- [ ] Anonymous user state exists.
- [ ] Signed-in user state exists.
- [ ] No discussion state exists.
- [ ] No fills yet state exists.
- [ ] Thin-history chart state exists.

## Workstream 5: Builder `/builder`

- [ ] Builder is the primary market creation surface.
- [ ] Title/question step exists.
- [ ] Public argument step exists.
- [ ] Signal-market search and attach step exists and is backed by the discovery API.
- [ ] Each attached signal includes direction and rationale.
- [ ] Initial side selection exists.
- [ ] Initial seed amount selection exists in USD.
- [ ] Review step exists.
- [ ] In signet, launch publishes kind `982`, coordinates the first seed trade, and only redirects once the public `/market/:slug` route is readable so the creator does not land on a `404` during relay propagation.
- [ ] Builder never exposes duration, end date, or "resolves on" inputs.
- [ ] Builder copy teaches that linked markets are informational only.
- [ ] Creator seeding is mandatory.
- [ ] Validation errors are clear and specific.
- [ ] Draft-preservation behavior exists if the user leaves the page mid-build.

## Workstream 6: Global Activity `/activity`

- [ ] Global activity feed is a distinct route.
- [ ] Feed includes new markets, trades, and discussion activity.
- [ ] Feed ordering is reverse-chronological and stable.
- [ ] Feed supports type filtering.
- [ ] Feed rows link back to the relevant market or thread.
- [ ] Feed is optimized for high-frequency reading.
- [ ] Empty state is explicit.

## Workstream 7: Bookmarks `/bookmarks`

- [ ] Bookmark list shows all saved markets for the current user.
- [ ] Each row links straight back to market detail.
- [ ] Remove/unbookmark action exists.
- [ ] Empty state explains how to bookmark from market cards and market detail.
- [ ] Bookmarks stay in sync with real user state rather than a local demo list.

## Workstream 8: Leaderboard `/leaderboard`

- [ ] Leaderboard uses a tabbed model.
- [ ] Predictor ranking tab exists.
- [ ] Creator ranking tab exists.
- [ ] Each leaderboard row links to a public profile.
- [ ] Empty states explain which data is missing.
- [ ] Aggregation logic is separated from presentation logic.
- [ ] Accuracy, bookmark, and other derivative tabs are omitted from launch unless backed by a fully defined real aggregation model.

## Workstream 9: Analytics `/analytics`

- [ ] Analytics is public.
- [ ] Route is data-dense, not marketing-oriented.
- [ ] Summary metrics appear above the fold.
- [ ] Market-level ranking cuts exist.
- [ ] Platform-wide activity totals exist.
- [ ] Price, volume, and activity time-series charts exist.
- [ ] Summary tables exist.
- [ ] Generation timestamp exists so readers know data freshness.
- [ ] Empty states explain missing stats without breaking layout.
- [ ] Product funnel analytics are not required for launch.

## Workstream 10: Narrative And Content

### `/how-it-works`

- [ ] Explains the Cascade mental model in the current language.
- [ ] Explains that markets trade indefinitely.
- [ ] Explains that price comes only from trading activity.
- [ ] Explains modules vs theses correctly.
- [ ] Explains LMSR correctly.
- [ ] Includes a human-and-agent section.
- [ ] Ends with a clear CTA into markets or join.

### `/blog`

- [ ] Blog route exists as a content and narrative surface.
- [ ] It works as a curated landing page for long-form writing, outbound links, and/or Substack.
- [ ] It does not look like leftover template content.
- [ ] Internal article rendering is not required for launch.

### `/privacy` and `/terms`

- [ ] Legal routes are complete and linkable from the footer.
- [ ] Copy is production-appropriate and not placeholder legal text.

### `/embed` and `/embed/market/:slug`

- [ ] Explicitly deferred from launch.

## Workstream 11: Join, Onboarding, And Agent Onboarding

### `/join`

- [ ] Human vs agent split is explicit.
- [ ] Human branch has a clear identity-creation path.
- [ ] Human branch offers X, Google, and Telegram login options for profile bootstrap.
- [ ] Social login is framed as a way to prefill profile setup rather than as a replacement for the underlying Cascade identity model.
- [ ] Social bootstrap can import at least basic profile fields such as display name and avatar.
- [ ] When a managed local NIP-05 domain is configured, the human path can lead into claiming a username on that domain.
- [ ] Agent branch contains the copyable hosted-skill instruction.
- [ ] Agent branch links directly to `/SKILL.md`.
- [ ] Agent branch does not rely on vague "agent trades while you sleep" copy.
- [ ] No Nostr jargon leaks into the page.

### `/SKILL.md`

- [ ] Hosted skill file is served from the active `web/` app.
- [ ] The skill teaches current market mechanics only.
- [ ] The skill points agents to the real public-read and authenticated API surfaces.
- [ ] The skill states that hosted agents and external agents use the same API endpoints.
- [ ] The skill states that authenticated API actions use NIP-98.
- [ ] The skill never advertises fake `/api/agent/*` routes.
- [ ] The skill never treats the field/workspace product as a launch requirement.
- [ ] The skill is kept in sync with `docs/mint/api.md` and `docs/product/spec.md`.

### `/onboarding`

- [x] Post-join profile bootstrap exists.
- [x] Human onboarding covers display name, avatar, bio/tagline, and public profile setup.
- [ ] Social-login bootstrap from X, Google, and Telegram can prefill the onboarding form when available.
- [ ] Users can still edit or replace imported profile data before completing onboarding.
- [ ] Agent onboarding path can bootstrap the identity the agent will use.
- [ ] Hosted NIP-05 issuance is not required for launch, but if configured it should support claiming usernames on the deployment's local domain.

## Workstream 12: Identity And Profiles

### Self profile `/profile`

- [ ] Self-profile route exists and is session-aware.
- [ ] User can edit display name.
- [ ] User can edit bio.
- [ ] User can edit avatar.
- [ ] User can review and override profile fields initially imported from X, Google, or Telegram.
- [ ] User can view their own created markets.
- [ ] User can view their own trading activity summary.
- [ ] User can view their own recent discussions.

### Public profile `/p/:identifier`

- [x] Canonical public profile route exists.
- [x] Route accepts preferred NIP-05, local-domain bare username shortcuts, and fallback npub-style identifier.
- [x] Bare usernames resolve against the local managed NIP-05 domain when one is configured.
- [x] Bare domains are passed through to NDK's root-NIP-05 lookup semantics without app-side rewriting.
- [x] Identity header exists.
- [x] Created markets list exists.
- [x] Public positions list exists.
- [ ] Recent discussion activity exists.
- [ ] Follower and following data are sourced from real kind `3` follow state.
- [ ] Signed-in viewers can follow and unfollow using real follow events.
- [ ] Sharing and direct linking work correctly.

- [x] `/u/:pubkey` route is removed before launch.
- [x] `/profile/:identifier` route is removed before launch.

### Non-launch profile features

- [ ] Derived reputation scores are not required for launch.

## Workstream 13: Portfolio `/portfolio`

- [ ] Portfolio is the only direct money-management surface.
- [ ] Portfolio is explicitly self-custodied rather than server-custodied.
- [ ] Signet and mainnet use the same portfolio product model and same `/portfolio` route shape.
- [ ] Balance display exists in USD.
- [ ] Add-funds flow exists.
- [ ] Add-funds flow offers Stripe and Lightning.
- [ ] Signet funding uses the normal funding rails and the same standard mint routes in the same edition-local proof model; the signet mint may auto-pay Lightning funding quotes testnut-style rather than introducing a separate "paper wallet" account system.
- [ ] Stripe and Lightning funding share one browser-local recovery surface, even though Lightning uses the standard Cashu mint flow and Stripe uses a persisted product saga.
- [ ] Add-funds pending, paid, and minted states exist.
- [ ] Lightning funding uses `POST /v1/mint/quote/bolt11`, `GET /v1/mint/quote/bolt11/{quote_id}`, and `POST /v1/mint/bolt11`.
- [ ] If the initial Lightning quote response is lost, the browser retries `POST /v1/mint/quote/bolt11` with the same client `request_id` until the mint replays the same quote.
- [ ] Browser-local Lightning recovery can restore proofs after an interrupted mint response using locally stored deterministic wallet state.
- [ ] The browser does not depend on a bespoke Lightning funding route when the standard Cashu mint flow already covers the job.
- [ ] Builder preserves pending market state after kind `982` publication when the creator still needs funding.
- [ ] Public users do not see pending markets until the first mint-authored kind `983`.
- [ ] Send/export token flow exists.
- [ ] Receive/import token flow exists.
- [ ] Token import/export is browser-local and does not call a custody API.
- [ ] Market exits return USD ecash into the portfolio balance.
- [ ] Transaction history exists.
- [ ] Transaction states are legible.
- [ ] Portfolio errors are explicit and recoverable.
- [ ] Portfolio never doubles as a market-trading page.
- [ ] The normal portfolio UI does not expose sats, msats, or Lightning invoices.
- [ ] Off-platform bank withdrawal is not required for launch.
- [ ] No product copy implies that Cascade custody or server account balances exist.

## Workstream 14: Positions And PnL

- [ ] Aggregate summary row exists.
- [ ] Total invested metric exists in USD.
- [ ] Current value metric exists in USD.
- [ ] Total PnL metric exists in USD.
- [ ] Open positions list exists.
- [ ] Exited-position history exists.
- [ ] Each position row shows side, shares, average price, current price, and PnL.
- [ ] Liquid cash balance is derived by summing locally stored USD proofs.
- [ ] Portfolio mark-to-market uses local market-proof holdings plus current public market prices.
- [ ] Exit confirmation uses a fresh sell quote for exact finite-trade withdrawal proceeds rather than reusing the mark price.
- [ ] Token export emits a standard Cashu token string for one local proof bucket at a time.
- [ ] Token import decodes a standard Cashu token string and merges proofs into the matching local proof bucket.
- [ ] Position rows link back to the relevant market.
- [ ] Position rows support exiting/selling when appropriate.
- [ ] Empty state routes users back to markets.
- [ ] Copy reflects exits and sales.
- [ ] Portfolio is derived from local/user-side state plus public market data, not from a private custody API.

## Workstream 15: Data, Auth, And Protocol Foundations

### Auth and identity

- [ ] Web identity creation and restoration work reliably.
- [ ] Authenticated API endpoints use NIP-98-signed HTTP requests.
- [ ] Public read endpoints remain readable without signing in.
- [ ] Product behavior does not depend on cookie-based server sessions.
- [ ] No user-facing Nostr jargon leaks into auth flows.
- [ ] `/.well-known/nostr.json` and `/api/nip05` support public identity lookup where applicable.
- [ ] Docs explicitly describe `bob -> bob@<local-domain>` lookup on `/p/:identifier` when a managed local NIP-05 domain is configured.

### Market, discussion, follow, and discovery data

- [ ] Markets load from real kind `982` data and/or canonical server projections.
- [ ] Discussions load from real kind `1111` data and/or canonical server projections.
- [ ] Search and discovery are relay-based. The frontend queries relays directly for kind `982` and kind `983` events.
- [ ] Bookmarks load from real bookmark state.
- [ ] Positions load from the actual current position model.
- [ ] Follow graph loads from real kind `3` data.
- [ ] Discussion surfaces remain append-only under NIP-22-style semantics. No moderation, edit, or delete feature is built into launch.

### Portfolio and proof state

- [ ] Portfolio proofs are stored client-side or agent-side, not on Cascade servers.
- [ ] Browser-local proof storage is the active implementation for both signet and mainnet.
- [ ] NIP-60 is explicitly deferred and does not power one edition while another uses local proof state.
- [ ] There is no canonical `/api/wallet` route in the launch contract.
- [ ] There is no canonical `/api/product/portfolio/:pubkey` or legacy `/api/product/wallet/:pubkey` pubkey-keyed balance API in the launch contract.
- [ ] `/portfolio` derives balance and spendable state from local proof storage.
- [ ] `/portfolio` does not depend on any backend current-balance or current-position snapshot for a pubkey.
- [ ] Trade execution consumes locally stored proofs and browser-generated blinded outputs, then writes locally unblinded issued/change proofs back into browser-local storage.
- [ ] `POST /api/trades/buy` and `POST /api/trades/sell` reject proofless pubkey-only execution in both editions.
- [ ] `POST /api/trades/buy` and `POST /api/trades/sell` require browser-generated blinded outputs for the issued side and any change side.
- [ ] Trade execution responses return blind signatures, not fully formed proofs.
- [ ] Trade execution responses do not include a server-authored portfolio balance or open-position snapshot.
- [ ] The backend never persists or reconstructs a canonical set of the user's unspent proofs.
- [ ] Legacy backend mirror helpers for wallet balances or open positions have been deleted, not merely bypassed.
- [ ] Browser-local trade recovery restores deterministic issued/change outputs after an interrupted response instead of depending on a server proof mirror.
- [ ] Any pubkey-keyed funding-activity endpoint is non-canonical and must not expose or imply server-held proofs.
- [ ] Open-position cost basis and unrealized PnL come from a browser-local executed-trade position book, not from backend compatibility state.
- [ ] Imported or older local proofs without browser-local trade history still appear in `/portfolio`, but as mark-only holdings.
- [ ] `/portfolio` keeps locally held market positions visible even when public market detail fetches fail, without falling back to backend-derived prices or PnL.
- [ ] Market-proof storage uses a fixed integer share-minor scale of `10_000` units per whole share in both signet and mainnet.
- [ ] Market-proof bucket names are canonicalized to lowercase `long_<slug>` / `short_<slug>`.
- [ ] Web product orchestration may call `/api/trades/*`, but any pure mint or melt action stays on the standard Cashu route surface.
- [ ] Browser storage migrates any legacy uppercase market-proof buckets into the lowercase canonical buckets during load.
- [ ] Market keysets use a wide denomination ladder so browser-local proof buckets stay compact even for large share positions.
- [ ] Builder, market trading, and `/portfolio` do not depend on a server-side per-pubkey wallet ledger in signet.
- [ ] Agent flows use a local proof manager rather than a Cascade portfolio API.
- [ ] Local proof storage covers both USD portfolio proofs and market proofs.
- [ ] Portfolio views are derived from local proof state, user-authored position records, and public market data.
- [ ] Portfolio valuation distinguishes between mark price for list views and exact exit quotes for withdrawal actions.
- [ ] Portfolio import/export uses standard Cashu token encoding rather than a Cascade-specific wrapper.

### Trading and portfolio integration

- [ ] `web/` talks to real mint endpoints.
- [ ] Buy flows use real USD spend quote and execution endpoints.
- [ ] Sell flows use real exit quote and execution endpoints that return USD portfolio value.
- [ ] Portfolio funding uses the real Stripe and Lightning wallet-mint flows.
- [ ] Discovery and market detail reads respect the creator-only pending visibility rule.
- [ ] Portfolio proof storage and token import/export happen locally.
- [ ] Portfolio proof storage is namespaced by edition so signet and mainnet proofs cannot collide.
- [ ] Launch web trades execute through NIP-98-authenticated requests.
- [ ] Normal web flows hide Lightning payment details from the user.

### Agent machine interface

- [ ] Frontend and onboarding copy match the machine-interface contract in [`../mint/api.md`](../mint/api.md).
- [ ] Agent-facing public read routes have corresponding JSON APIs.
- [ ] Authenticated product actions are available through NIP-98-signed API endpoints.
- [ ] Hosted agents and external agents use the same public and authenticated API endpoints.
- [ ] Portfolio-proof handling is explicitly local and not modeled as a Cascade account API.
- [ ] The hosted `SKILL.md` points agents to the installable `cascade` skill for local proof management.
- [ ] Discovery/search APIs extend relay capabilities rather than requiring HTML scraping or relay-only querying.

## Workstream 16: SEO, Sharing, And Public Reach

- [ ] Homepage has solid metadata and OG tags.
- [ ] Market detail pages have shareable metadata.
- [ ] Public profile pages have shareable metadata.
- [ ] Blog and how-it-works pages are crawler-friendly.
- [ ] Canonical URLs are stable.
- [ ] Social previews do not leak placeholder/demo content.

## Workstream 17: Launch Cleanup

- [ ] Remove or redirect leftover template routes that are not part of the Cascade product.
- [ ] Remove public nav exposure for anything not in the canonical launch surface.
- [ ] Remove copy that still says Contrarian.
- [ ] Remove copy that implies forced endings or expiry.
- [ ] Remove dependence on legacy frontend snapshot code for launch-critical behavior.
- [ ] Ensure all launch-critical docs point to `web/`, not a legacy frontend snapshot.
- [ ] Ensure dashboard/workspace routes are not treated as launch-critical surfaces.

## Launch Exit Criteria

The launch plan is complete only when all of the following are true:

- [ ] Every canonical launch route exists in `web/`
- [ ] Every launch route is backed by real product data or real integrations
- [ ] The public market product is fully navigable end to end
- [ ] The account layer is usable end to end
- [ ] Agent onboarding through `/join` and `/SKILL.md` is coherent
- [ ] Portfolio and trading flows function against the real mint
- [ ] Authenticated write actions function through NIP-98-signed API endpoints
- [ ] Discovery and search function through relay queries — no backend market data API
- [ ] Public profiles include real follow-graph behavior from kind `3`
- [ ] Portfolio behavior is self-custodied and does not depend on a server wallet API
- [ ] Template leftovers are removed or repurposed
- [ ] Copy and mechanics are fully aligned with "markets never close"
- [ ] Mobile and desktop layouts are both launch-safe

## Explicitly Deferred From Launch

- `/embed`
- `/embed/market/:slug`
- `/dashboard`
- `/dashboard/fields`
- `/dashboard/fields/new`
- `/dashboard/field/:id`
- `/dashboard/agents`
- `/dashboard/agent/:id`
- `/dashboard/treasury`
- `/dashboard/activity`
- `/dashboard/settings`
- field-centered workspace behavior
- hosted-agent provisioning and management UI
- private agent treasury, meeting, library, and council surfaces
- public editorial topic pages distinct from the main feed
- internal blog CMS / post renderer
