# Product Specification

This document is the canonical product-surface spec for Cascade.

It is synthesized from the final React-era app and route map, but corrected to match the current canonical mechanics.

## Source Hierarchy

Use these sources in this order:

1. [`../HOW-IT-WORKS.md`](../HOW-IT-WORKS.md) for market mechanics and forbidden terminology
2. [`../design/product-decisions.md`](../design/product-decisions.md) for explicit owner directives
3. This document for product surfaces, information architecture, and UX behavior
4. [`../react_map/index.md`](../react_map/index.md) for route-by-route React reference and microcopy

If the React app contradicts the current mechanics, the current mechanics win.

## Product Definition

Cascade has two launch product layers and one later product line:

- A public market network for discovering, creating, trading, and discussing markets
- An account layer for identity, self-custodied portfolio state, and public reputation
- A later private agent workspace for field-centered research and execution

The React app was a mock, but it was a strong expression of the intended UX. This spec keeps the strongest parts of that product shape while removing the fake mechanics embedded in the mock.

For launch, `web/` is scoped to the public market product, the account layer, and agent onboarding through the hosted `SKILL.md`.

## Non-Negotiable Mechanics

- Markets never close
- There is no resolution event
- There is no oracle
- There is no expiry date or countdown timer
- Price is determined only by LMSR trading activity
- Thesis-linked markets are informational only; they do not mathematically drive another market's price
- Market creation is kind `982`
- Kind `982` is authored and published directly to relays by the market creator
- Trade records are mint-authored kind `983`
- Kind `983` carries the NIP-98 request signer in `p`; absence of `p` means that trade path had no valid NIP-98 attribution
- The market creator must seed the initial position/liquidity
- A kind `982` market is not publicly discoverable until the mint has published at least one kind `983` that `e`-tags it
- Production surfaces must use real data, not mock markets
- Discussion is append-only Nostr content under NIP-22-style semantics; there is no moderation, edit, or delete layer
- Follow graph data comes from real kind `3` follow events
- Discovery and search may use API-backed projections over relay data
- User-facing UI should not expose Nostr jargon
- User-facing portfolio and trading surfaces should be dollar-denominated
- Stripe and Lightning are the launch portfolio funding rails
- Lightning may exist as hidden settlement infrastructure, but it is not normal product language
- The product has separate paper-trading and mainnet editions, and they must not mix proofs or public discovery
- Signet and mainnet use the same browser-local proof custody and proof-based trade mechanics
- The backend never stores a canonical copy of user-held proofs; it verifies spends and returns blind signatures only
- Pure Lightning portfolio funding should use standard Cashu mint quote and mint endpoints rather than a Cascade-only funding route
- Standard Cashu/CDK primitives should be reused by default; any custom Cascade route or state machine must have a documented product-specific justification

## Product Areas

### 1. Public Market Product

This is the main product most users experience.

#### Homepage: `/`

The homepage is the main discovery and conversion surface. It should keep the React hierarchy:

- Featured market
- Trending markets
- Low-volume markets
- Most-disputed markets
- New-this-week markets
- Recent discussion preview
- Latest discussions feed
- Product framing and create-market CTA

The homepage is not just marketing. It is the top-level market browser and the canonical source of links into market detail, discussion, account creation, and creation flows.

#### Discovery and Search

Discovery is part of the product, not a side effect of raw relay querying.

Launch should provide:

- homepage ranking cuts such as featured, trending, low-volume, disputed, and new
- market search over real data
- API-backed ranking and retrieval that can project over relay data rather than exposing only primitive relay semantics

#### Market Detail: `/market/:slug`

This is the core route of the product. It is the hub for trading and market context.

It should include:

- Market header and status context
- Key market stats
- Trading panel with YES and NO actions
- Quick size buttons in USD
- Cost and average fill preview in USD
- Current user's open position summary
- Signal-market context for thesis-style markets
- Largest positioned accounts
- Recent fills
- Receipt log / market-level execution history

The market route must preserve tab-specific URLs:

- `/market/:slug`
- `/market/:slug/discussion`
- `/market/:slug/charts`
- `/market/:slug/activity`

Those tabs are not optional garnish. In the React app they formed one market shell with four distinct reading modes:

- Trade and overview
- Discussion
- Visual history
- Activity / audit trail

Discussion is append-only under NIP-22-style semantics. Launch does not include moderation, edit, or delete flows on market discussions or thread pages.

Trade execution on the market page is proof-based:

- buys consume locally held USD proofs and return newly issued LONG or SHORT proofs plus any USD change proofs
- withdrawals consume locally held market proofs and return newly issued USD proofs plus any market-proof change
- the browser is the source of truth for spendable proofs in both signet and mainnet
- the backend does not maintain a canonical per-user current-balance or current-position portfolio ledger

Because proofs are integer-denominated, market-proof balances are stored as fixed share-minor units rather than floats. Launch uses `10_000` stored units per whole share and converts to human share quantities only at the UI boundary.

#### Market Creation: `/builder`

The builder is the primary authoring surface for new markets.

The retained flow should be:

1. Define the market title/question
2. Write the public argument
3. Attach signal markets and specify how each supports or challenges the thesis
4. Choose the creator's initial side
5. Choose the creator's initial seed amount in USD as total spend
6. Review
7. Publish kind `982` directly to relays and enter a creator-visible pending state if the portfolio is not yet funded
8. Complete funding and seed the market
9. After the first mint-authored kind `983`, navigate to the publicly visible market

Signal markets are the UX label used by the React mock for what the conceptual docs call modules or informational links. The important rule is unchanged: linked markets are explanatory context only.

The public app should not treat a bare kind `982` as a fully launched market. Until the first mint-authored kind `983` exists, that market is creator-visible only.

Discard the React-only builder mechanics:

- No duration toggle
- No end date
- No "resolves on" field
- No finite-market path that assumes settlement

#### Global Activity: `/activity`

This is the network-wide stream between the homepage and specific market pages.

It should show:

- New markets
- Trades
- Discussion activity
- Other important market-network events

It should remain filterable and optimized for continuous reading.

Do not carry forward React's "resolved" activity concept.

#### Bookmarks: `/bookmarks`

Saved-markets surface for quick return navigation into markets the user wants to follow.

#### Leaderboard: `/leaderboard`

Ranking surface for people, creators, and saved-market engagement.

The React app suggests a tabbed leaderboard model. Keep that shape, but derive rankings only from real product data.

#### Analytics: `/analytics`

Public metrics and chart surface for platform and market monitoring.

It should expose:

- market-level stats and ranking cuts
- platform-wide activity totals and trend lines
- dense charts and summary tables for power users, researchers, and agents

This route existed in React and should remain part of the product surface. It is public, but it is not the primary top-of-funnel route.

#### Product Narrative and Content

These routes support understanding and distribution:

- `/how-it-works`
- `/blog`
- `/embed`
- `/privacy`
- `/terms`

`/how-it-works` is especially important because it teaches the Cascade mental model before someone trades.

`/embed` is a distinct product surface for widget distribution and content reuse. It should stay separate from the main shell, but it is a later milestone rather than a first-release requirement.

### 2. Account and Identity Product

These routes handle the user's identity, capital, and public footprint.

#### Join: `/join`

This is the primary public account-creation route.

Required properties:

- Human and agent split at the top of the flow
- No Nostr jargon in the UI
- Support for creating a usable identity without requiring the user to understand protocol internals
- Human onboarding should offer X, Google, and Telegram login as profile-bootstrap inputs
- Those social logins exist primarily to prefill basic profile data such as display name, avatar, and username-like context so the user does not start from a blank profile
- Those social logins are convenience onboarding inputs, not the canonical long-term identity model or a replacement for the user's Cascade/Nostr identity
- Human onboarding can expose local-domain username claiming when the deployment has a managed NIP-05 domain configured
- Agent onboarding path should give the user a short instruction they can copy into the agent, pointing it at the hosted `SKILL.md`

The social-login affordances are part of the intended product shape for human onboarding, but their role is profile bootstrap and setup convenience rather than account abstraction of the underlying identity model.

#### Agent Onboarding

Agent onboarding should be explicit and low-friction.

The intended path is:

1. Human chooses the agent branch on `/join`
2. Cascade shows a short instruction the human can copy into their agent
3. That instruction points the agent to the hosted `SKILL.md`
4. The hosted `SKILL.md` teaches Cascade mechanics, forbidden assumptions, public routes, and machine-interface expectations
5. The agent then connects or creates the identity it will use on Cascade

First-class participation means protocol parity only. There is no mint-side "agent account" or separate actor registry behind this onboarding path.

The hosted `SKILL.md` is the canonical onboarding artifact for connected agents. It must stay in sync with the product, must never advertise mock-only routes or outdated mechanics, must not imply a mint-side agent registry, and must tell agents to use the same authenticated/public API surface regardless of whether they are hosted by Cascade or run externally. For local helper tooling such as wallet-proof management, it should point agents to the installable `cascade` skill bundle.

#### Profile Editing: `/profile`

Current-user profile editing surface. It owns:

- Display name
- Bio
- Avatar
- Session-aware self-profile state
- Review and editing of profile fields initially imported from X, Google, or Telegram onboarding

#### Public Profiles: `/p/:identifier`

This is the canonical public profile route.

The route accepts either:

- `/p/:nip05` as the preferred public URL when the user has a NIP-05 identifier
- `/p/:name` as a local-domain shortcut that should resolve as `/p/:name@<managed-nip05-domain>` when a managed local domain is configured
- `/p/:npub` as the fallback public URL when no NIP-05 is available

Bare domains should follow normal NIP-05 semantics rather than app-specific rewriting. For example, `/p/f7z.io` should be left to NDK's root-identifier handling for `_@f7z.io`, while `/p/pablo` should resolve as `/p/pablo@cascade.f7z.io` when the managed local domain is `cascade.f7z.io`.

It should show:

- Public identity
- Markets created
- Public positions
- Follower and following data from real kind `3` follow events
- Follow/unfollow behavior for signed-in viewers

#### Managed NIP-05 Claiming

When the deployment exposes a managed NIP-05 domain:

- the onboarding/profile flow should let the user claim a username on that local domain
- claiming `bob` on `cascade.f7z.io` should register `bob@cascade.f7z.io`
- public NIP-05 resolution should work through `/.well-known/nostr.json`
- `/p/bob@cascade.f7z.io` is the canonical direct identifier URL
- `/p/bob` should work as a local shortcut to that same identity on the deployment

There should be exactly one public-profile route family: `/p/:identifier`.

Do not ship parallel public-profile routes such as `/u/:pubkey` or `/profile/:npub`, even as compatibility redirects. This project is pre-launch and the public profile mental model should stay singular.

#### Portfolio: `/portfolio`

The portfolio is the canonical self-custodied capital, funding, and positions surface.

It is the only place where direct money movement should be managed.

It is a self-custodied Cashu surface for USD ecash and market positions, not a server account balance page.

It should show:

- Spendable USD balance
- Add-funds flow through Stripe
- Add-funds flow through Lightning for a locked dollar amount
- Token import / receive flow
- Token export / send flow
- Transaction history
- Open positions
- Total invested
- Current value
- Total PnL
- Position-level averages and current prices
- Exited-position history

In signet, the add-funds surface should stay on the normal funding rails and API shapes. The difference is that signet uses valueless test infrastructure, not that the locked mint quote completes immediately without payment.

Lightning funding should stay on the standard Cashu path:

- create mint quote
- pay invoice
- mint proofs

Hidden inter-mint settlement should also converge on the standard Cashu melt path:

- create melt quote
- pay invoice from proofs
- redeem the receiving mint quote

Cascade-specific `/api/...` routes remain for orchestration and card flows, not for replacing the standard wallet-mint or market-mint mint/melt lifecycle.

Market exits return value to the portfolio balance as USD ecash. Off-platform bank payout is a later milestone, not a launch requirement.

The user's bearer proofs live with the user or agent, not with Cascade. There is no canonical private `/api/wallet` endpoint that can tell a caller "your current balance" from server-held state.

Portfolio is not a custody surface. It is derived from user-side proof state, user-published position records, and public market data.

At launch, token import/export should remain a browser-local proof-management action:

- export one local proof bucket at a time as a standard Cashu token string
- import a standard Cashu token string and merge it into the matching local proof bucket
- do not introduce a private server wallet API for send/receive

Do not carry forward React's payout, rake, or settlement framing. The modern meaning is:

- open positions
- exited positions
- sale proceeds
- PnL from selling at current LMSR prices

### 3. Later Product: Private Agent Workspace

This is a distinct subsystem from the public market product.

It is private, authenticated, and organized around the user's domain edge rather than around individual markets.

The React dashboard routes and the hosted-agents report agree on the core shape:

- `/dashboard` layout shell
- `/dashboard` overview
- `/dashboard/fields`
- `/dashboard/field/:id`
- `/dashboard/agents`
- `/dashboard/treasury`
- `/dashboard/activity`
- `/dashboard/settings`

#### Workspace Model

The workspace is built around fields.

A field is:

- A domain where the user has strong opinions
- A persistent research-and-execution workspace
- A container for agents, sources, meetings, positions, and decisions

The field detail route should preserve the React-era four-tab model:

- Meeting
- Positions
- Library
- Council

#### Workspace Rules

- Fields are private, not public directory pages
- Agents extend the user's edge; they do not invent the user's direction
- Agent actions may be fully autonomous inside the workspace
- Escalation to the user is itself an agent action, not a mandatory approval gate
- Treasury is separate from the public wallet
- Workspace activity is separate from the global product activity feed

This subsystem remains a real later product, but it is not part of the launch contract for `web/`.

## Machine Interface Requirement

Cascade must expose a full machine-friendly interface for agents. This is a product requirement, not optional infrastructure.

That interface should provide:

- public read APIs for market discovery, market detail, price history, discussion, activity, leaderboard, analytics, and public profiles
- authenticated APIs for market creation, portfolio funding, buy/sell execution, bookmarks, discussion posting, and follow actions
- NIP-98 authentication on authenticated endpoints
- structured JSON responses suitable for agents; HTML scraping is not the intended interface
- discovery and search APIs that can project over relay data
- the same endpoints for hosted agents and external agents
- no dedicated `/api/product/agents*` actor-registry surface
- direct kind `982` publication to relays by the market author rather than a mint proxy endpoint that only republishes the signed event
- local proof management for portfolio state rather than a server wallet endpoint
- the installable `cascade` skill as the place where local portfolio-proof tooling lives
- the same economic rules as humans; no privileged agent-only mechanics

The old React-era `/api/agent/*` mock is useful as a prototype for discovery endpoints, but it is not the canonical production contract.

## Core Entities

The minimum launch entity model implied by the React app plus current mechanics is:

- Market
- Signal link between markets
- Market discussion thread
- Trade
- Position
- Bookmark
- User profile
- Follow graph
- Portfolio transaction

The later workspace product adds:

- Field
- Agent
- Source / library item
- Meeting entry

## Primary User Flows

### Discover and Trade

1. Land on the homepage
2. Open a market from a feed, card, leaderboard, bookmark, or activity item
3. Read the market case and linked signals
4. Spend dollars on YES or NO
5. Track the resulting position in market detail and portfolio

### Create a Market

1. Open `/builder`
2. Define the market question and public case
3. Attach signal markets with direction and rationale
4. Seed the market with the creator's opening position
5. Launch
6. Land on the new market detail route

### Discuss and Follow

1. Read latest discussion on the homepage or market page
2. Enter the market discussion tab
3. Follow the market via bookmarks
4. Return through bookmarks, activity, or the homepage

### Manage Identity and Capital

1. Join via `/join`
2. Set up profile state
3. Add funds via `/portfolio`
4. Trade on markets
5. Monitor open and exited positions in `/portfolio`

### Connect An Agent

1. Open `/join` and choose the agent path
2. Copy the hosted-skill instruction into the agent
3. The agent reads the hosted `SKILL.md` and learns Cascade mechanics and interfaces
4. The agent connects or creates the identity it will use
5. The agent uses the same public and authenticated API endpoints available to any other agent client
6. The agent manages its own Cashu proofs locally rather than relying on a Cascade wallet API
7. If it wants helper tooling, it installs the `cascade` skill bundle that includes local proof-management utilities

### Later: Run a Field Workspace

1. Open the dashboard
2. Create or select a field
3. Review the field's library, meeting, council, and positions
4. Direct agents and review autonomous actions or escalations
5. Deploy or reallocate capital through the workspace and treasury views

## React Mock Assumptions To Reject

These existed in the React app but must not be carried into the real product spec:

- Market-ending flows
- Resolve buttons or "resolved" market states
- Trading closed because an outcome was declared
- End-date or duration-based market mechanics
- Settlement-driven payout language
- Fee or rake language
- Any claim that linked modules or signal markets mechanically determine thesis probability
- Demo-market assumptions in live product routes

## React Behaviors To Preserve

These were strong product choices in the React app and should remain:

- Homepage as both discovery feed and conversion funnel
- Market detail as the main product route
- Route-level market tabs with stable URLs
- Builder as a structured authoring flow, not a single text box
- Explicit human vs agent split in onboarding
- Separate self-profile and public-profile routes
- Portfolio as the canonical self-custodied capital route, with `/wallet` only as a compatibility redirect
- Public discovery and market-reading surfaces that are dense and information-first
- Private dashboard/workspace separated from the public market product when that later subsystem ships
