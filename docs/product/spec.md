# Product Specification

This is the current product-surface contract for Cascade.

PENDING: The product surface is moving to one web deployment with a Live/Practice switch. Live keeps kinds `982/983`; Practice uses kinds `980/981`.

## Authority Order

Use these sources in order:

1. [`../HOW-IT-WORKS.md`](../HOW-IT-WORKS.md)
2. [`../design/product-decisions.md`](../design/product-decisions.md)
3. This file

## Non-Negotiable Rules

- Markets never expire.
- There is no oracle and no admin close step.
- Price is set only by trading activity on that market.
- Kind `982` defines markets.
- Kind `983` records trades and is mint-authored.
- A market is not publicly live until the first kind `983` exists.
- Portfolio and trading UX are USD-denominated.
- `/portfolio` is the capital surface. There is no `/wallet` product route.
- Proofs are self-custodied. The backend does not provide a canonical current-balance ledger.
- Humans and agents use the same product and machine interfaces.
- Builder and CLI publish kind `982` directly to relays, then send the signed raw event only as
  part of the first seed-trade quote/buy so the mint can bootstrap market state without owning
  publication or discovery.
- Market discovery, activity, detail, and pricing are relay-backed from kind `982` and kind `983`,
  not from mint-side market read routes.

## Launch Product Areas

### Public Market Surface

Current public routes in `web/`:

- `/`
- `/market/:slug`
- `/market/:slug/discussion`
- `/market/:slug/discussion/:threadId`
- `/market/:slug/charts`
- `/market/:slug/activity`
- `/activity`
- `/analytics`
- `/leaderboard`
- `/bookmarks`
- `/builder`
- `/blog`
- `/how-it-works`
- `/embed`
- `/embed/market/:slug`
- `/privacy`
- `/terms`
- `/about`

Expected behavior:

- homepage is both narrative and discovery
- market pages are the main trading surface
- discussion is append-only
- analytics and leaderboard are public read surfaces
- builder publishes kind `982` and coordinates the required creator seed trade

### Identity And Portfolio

Current account and identity routes:

- `/join`
- `/onboarding`
- `/portfolio`
- `/profile`
- `/profile/edit`
- `/p/:identifier`
- `/note/:id`

Supporting server routes:

- `/.well-known/nostr.json`
- `/api/nip05`
- `/api/social-auth/*`
- `/og/market/:slug`
- `/og/note/:id`

Expected behavior:

- portfolio is browser-derived from local proofs, local trade history, and public market data
- join and login surfaces use product-language labels like `This browser`, `Recovery key`, and `Pair app` instead of protocol names or connection URIs
- profile and identity surfaces avoid Nostr jargon in normal UX and never fall back to raw public-key strings in normal account chrome
- social auth and NIP-05 are support surfaces, not the core product

### Secondary And Later Surfaces

These exist in code but should not redefine launch mechanics:

- `/dashboard`
- `/dashboard/activity`
- `/dashboard/agents`
- `/dashboard/fields`
- `/dashboard/field/:id`
- `/dashboard/settings`
- `/dashboard/treasury`

The dashboard family is a later workspace product line. It should stay clearly separated from the launch market-and-portfolio contract.
Legacy relay browser routes now redirect away from the launch product surface and are not part of the public route contract.

## Core Flows

### Discover And Trade

1. User finds a market from discovery, search, activity, discussion, or profile surfaces.
2. User reviews current price and context.
3. User spends USD from `/portfolio` to mint LONG or SHORT exposure.
4. User exits later by returning market proofs for USD at the current LMSR price.

### Create A Market

1. User writes the market in `/builder`.
2. User publishes kind `982` directly to relays.
3. User funds the portfolio if needed.
4. User executes the required seed trade.
5. After the first kind `983`, the market is publicly live.

### Manage Capital

1. User adds funds through Stripe or Lightning.
2. Proofs are stored locally.
3. Portfolio derives spendable balance and position state locally.
4. Funding status is shown with human-readable payment states rather than raw invoice or checkout identifiers.

## Architectural Boundaries

### Stripe Is Mint Concern

Stripe is a funding rail. Funding is mint concern. The mint holds the Stripe secret key, creates checkout sessions, and receives webhooks. There is no webapp backend involvement in funding flows.

- The mint exposes Stripe session creation and webhook endpoints directly.
- The browser redirects to Stripe and returns to the frontend.
- The browser polls the mint for funding status and mints proofs from the mint.
- No `/api/portfolio/funding/stripe` on a separate webapp. The mint IS the backend for funding.

### No Market Data Mirror In The Mint

The mint does not maintain a SQLite (or any) mirror of relay data for market discovery, search, activity feeds, or price history.

- Market definitions (kind `982`) live on relays. The frontend reads them from relays.
- Trade history (kind `983`) lives on relays. The frontend reads it from relays.
- Search, activity feeds, and price history are relay queries or frontend-derived from relay data.
- The mint database stores only what the mint needs for execution: LMSR state, keysets, proofs, quotes, funding state, trade settlement records, and risk/anti-abuse state.
- There are no `/api/product/feed`, `/api/product/activity`, `/api/product/markets/search`, `/api/market/{id}`, or `/api/market/{id}/price-history` routes. Those concerns belong to relays and the frontend.
- The only market state the mint exposes is what it needs for trade execution: current LMSR price (returned in trade quotes), market-scoped key discovery (`GET /{event_id}/v1/keys`), and the FX preview endpoint.

### What The Mint Database Contains

The mint database is restricted to execution state:

- LMSR state per market (`qLong`, `qShort`, `b`, `reserve`)
- Keyset-to-market mappings
- Spent-proof tracking
- Trade execution records (source of kind `983` publishing)
- Wallet funding state (Stripe sessions, Lightning quotes, USDC intents)
- FX quote snapshots
- Settlement state (inter-mint Lightning records)
- Risk/anti-abuse state

It does NOT contain:

- A copy of kind `982` market events for serving to clients
- A copy of kind `983` trade events for serving to clients
- Market metadata (titles, descriptions, slugs) beyond what LMSR execution requires
- Activity feeds, search indexes, or price history projections

## Out Of Scope For Launch

- any market expiry field
- any market close flow
- any outcome declaration service
- any server-held canonical wallet ledger
- any separate human-versus-agent mechanics
- any route or copy that treats `/wallet` as the main capital surface
- any market data mirror or read API on the mint backend
