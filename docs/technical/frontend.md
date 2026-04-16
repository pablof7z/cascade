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

Legacy relay browser routes exist only as redirects away from the launch product surface:

- `/relays`
- `/relay/:hostname`

## Product Rules

- normal UX is USD-denominated
- public discovery surfaces only link to markets after the first public trade exists
- thread detail SSR merges current relay discussion data so newly published threads can open without waiting for a later refresh
- perpetual-market copy describes indefinite trading and voluntary exits, not oracle outcome declaration or forced shutdown
- `/portfolio` is the capital surface
- there is no `/wallet` product route
- no loading spinners
- no Nostr jargon in normal UI copy
- no raw funding states, checkout identifiers, or custody plumbing in visible portfolio copy
- public feeds and account chrome use neutral fallback labels rather than raw public keys
- active product-side direction labels use LONG and SHORT in UI chrome and trading copy; explanatory YES/NO category examples may remain on `/about` and `/how-it-works`
- `/leaderboard` uses a smaller cached SSR trade sample for Top Traders instead of opening a live trade subscription on initial render.

## State Model

The frontend derives user state from:

- local proofs
- local trade and funding recovery state
- public market data
- user-side position records where applicable

The backend is not the canonical source of the user's current portfolio holdings.

Builder publishes the signed selected edition market event directly to relays, keeps creator-only pending state
locally, and sends the signed raw event only with the first seed quote/buy when the mint has not
seen the market yet. Public market discovery, search, detail pricing, and portfolio mark pricing
come from relay-fetched edition-specific market and trade events:

- Live: market kind `982`, trade kind `983`
- Practice: market kind `980`, trade kind `981`

Portfolio funding and runtime affordances come from frontend config and the user's selected edition rather than a mint-side runtime manifest.

## Funding And Trading

- funding calls the mint directly
- Stripe and Lightning are the launch rails
- buys consume local USD proofs and return market proofs
- exits consume market proofs and return USD proofs
- the browser remains the proof holder in both Live and Practice

## Edition Split

The frontend is a single deployment with a Live/Practice switch.

- Live uses the mainnet mint.
- Practice uses the signet mint.
- Both editions can share the same relay list because event kinds separate market and trade streams.
- Local proof and recovery storage stays edition-local.
- The selected edition is request-scoped on the server and persisted in the browser with `cascade_edition`.
