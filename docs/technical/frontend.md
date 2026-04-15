# Frontend Architecture

## Active App

The active frontend lives in `web/`.

- framework: SvelteKit + Svelte 5
- deploy target: Vercel at `https://cascade.f7z.io`
- styling direction: editorial dark theme on neutral grays
- Nostr client: NDK

`web/` is the only canonical frontend. Any legacy snapshot elsewhere in the repo is non-authoritative.

## Current Route Surface

Public product routes:

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
- `/about`
- `/privacy`
- `/terms`

Identity and portfolio routes:

- `/join`
- `/onboarding`
- `/portfolio`
- `/profile`
- `/profile/edit`
- `/p/:identifier`
- `/note/:id`

Secondary routes that exist but are not launch-critical:

- `/dashboard/*`
- `/relays`
- `/relay/:hostname`

## Product Rules

- normal UX is USD-denominated
- `/portfolio` is the capital surface
- there is no `/wallet` product route
- no loading spinners
- no Nostr jargon in normal UI copy
- active product-side direction labels use LONG and SHORT in UI chrome and trading copy; explanatory YES/NO category examples may remain on `/about` and `/how-it-works`

## State Model

The frontend derives user state from:

- local proofs
- local trade and funding recovery state
- public market data
- user-side position records where applicable

The backend is not the canonical source of the user's current portfolio holdings.

## Funding And Trading

- funding calls the mint directly
- Stripe and Lightning are the launch rails
- buys consume local USD proofs and return market proofs
- exits consume market proofs and return USD proofs
- the browser remains the proof holder in both signet and mainnet

## Edition Split

The frontend must treat signet and mainnet as separate editions with separate local proof namespaces and separate mint/discovery configuration.
