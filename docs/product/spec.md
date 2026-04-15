# Product Specification

This is the current product-surface contract for Cascade.

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
- profile and identity surfaces avoid Nostr jargon in normal UX
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
- `/relays`
- `/relay/:hostname`

The dashboard family is a later workspace product line. It should stay clearly separated from the launch market-and-portfolio contract.

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
4. Imports and exports remain proof-native.

## Out Of Scope For Launch

- any market expiry field
- any market close flow
- any outcome declaration service
- any server-held canonical wallet ledger
- any separate human-versus-agent mechanics
- any route or copy that treats `/wallet` as the main capital surface
