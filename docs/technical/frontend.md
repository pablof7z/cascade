# Frontend Architecture

## Status

The active frontend implementation lives in `web/`.

`webapp/` is a failed earlier Svelte migration. It may still contain useful reference code or copy, but it is not the active app and should not be treated as the canonical frontend subtree.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit + Svelte 5 |
| Styling | Tailwind CSS |
| Nostr client | NDK (Nostr Dev Kit) |
| Deployment | Vercel at `cascade.f7z.io`, plus a local node-runtime path for supervised signet/mainnet editions |
| Repository | `git@github.com:pablof7z/cascade.git` |

**React is gone.** The active frontend direction is Svelte 5 + SvelteKit in `web/`.

## Deployment

Auto-deploys on push to `main`. If it's not deployed, it doesn't exist.

Production URL: `https://cascade.f7z.io`

No auth required to view the production site.

For local supervised editions on this machine, `web/` also supports `@sveltejs/adapter-node` builds via:

```bash
cd web
./scripts/build-node-edition.sh
./scripts/run-node-edition.sh signet
```

The local edition env templates live in:

- `web/.env.signet.example`
- `web/.env.mainnet.example`

## Current `web/` Routes

| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/about` | About page |
| `/activity` | Activity feed |
| `/analytics` | Public analytics |
| `/blog` | Editorial content |
| `/bookmarks` | Bookmarked markets |
| `/builder` | Market builder |
| `/dashboard` | Private workspace shell |
| `/embed` | Embed surface |
| `/highlights` | Highlighted content |
| `/join` | Account creation (human or agent) |
| `/leaderboard` | Rankings |
| `/onboarding` | Post-join onboarding |
| `/portfolio` | Canonical account surface for balances, funding, positions, and PnL |
| `/privacy` | Privacy policy |
| `/profile` | Current-user profile surface |
| `/relays` | Relay configuration / diagnostics |
| `/terms` | Terms of service |
| `/wallet` | Compatibility redirect to `/portfolio`; not a distinct product surface |

The full target product route model is defined in [../product/spec.md](../product/spec.md). The `web/` app is still being built toward that target.

The app should ship in separate signet and mainnet editions. Proof storage, environment labels, and discovery sources must be edition-aware.

## Nostr Integration

**NDK** handles all Nostr operations:

- real-time subscriptions to relays
- event publishing signed by the user's key
- metadata fetching for profiles, bookmarks, and positions

No polling. Data streams in as events arrive.

Key subscriptions include:

- `kinds: [982]` — all markets
- `kinds: [983]` filtered by market event ID — trade history for a specific market
- `kinds: [1111]` filtered by market event ID — discussions
- `kinds: [30078]` filtered by user pubkey — user position records

Public market discovery should not blindly render every raw kind `982` event. The app should only surface a market publicly after at least one mint-authored kind `983` exists for it. The creator can still see their own pending market between kind `982` publication and the first trade.

## No Loading Spinners

This is a hard directive from the project owner.

- no spinner components
- no skeleton-loader product logic
- no fake "loading complete" states

If nothing has arrived yet for a view, show an empty state, not a spinner.

## Auth

Users authenticate with Nostr keypairs.

- private key is generated client-side and stored locally
- it is never sent to the backend
- the user should not see protocol jargon during onboarding
- authenticated API actions use NIP-98

The cryptography stays behind the product boundary.

## Dollar-Denominated Product UX

The normal product surface is dollar-denominated.

- balances are shown in USD
- trade size inputs are shown in USD
- fill previews and PnL are shown in USD
- sats, msats, and Lightning invoices are not part of the normal human UI

If Lightning is used to settle between mints, that stays behind the product boundary. The exception is an explicit Lightning add-funds flow on `/portfolio`, where the user still starts from a USD amount and receives an invoice only as the funding mechanism.

## Portfolio

The canonical self-custodied capital route is `/portfolio`.

It should allow users to:

- view their USD balance
- add funds through the Stripe gateway
- add funds through a Lightning top-up flow for a chosen USD amount
- receive or import ecash tokens
- send or export ecash tokens
- review transaction history
- review open positions and exited-position history
- review aggregate invested, value, and PnL state

The portfolio stores proofs locally. The mint is the issuer; the user's device is the holder.

There is no canonical server wallet API for current balance because the proofs are self-custodied.

`/portfolio` is the canonical proof-custody route. `/wallet` exists only as a compatibility redirect and should not diverge into a separate product surface.

## Trading And Portfolio State

The frontend needs local state for at least two proof classes:

- USD portfolio proofs
- market proofs for LONG/SHORT positions

Trading surfaces should let the user spend dollars on YES or NO and then persist the resulting market proofs locally.

The `/portfolio` surface derives both spendable state and performance from:

- local proof state
- user-published position records
- public market data

For valuation, the frontend should use a two-layer model:

- liquid USD balance = sum of locally held USD proofs
- mark-to-market position value = locally held market-proof quantity priced against current public market prices
- exact exit value = a fresh sell quote from the mint for the full quantity the user wants to withdraw

The fast portfolio view should use current public market prices for mark-to-market display. When the user is about to exit, the client should call the sell-quote endpoint because LMSR pricing is size-dependent and the executable withdrawal value may differ from the simple mark price.

It is not a private custody dashboard backed by server-held proofs.

## Styling Rules

- Tailwind CSS with `neutral-*` colors only
- page background `neutral-950`
- accents only `emerald-*` and `rose-*`
- numbers and money use `font-mono`
- text and UI use `font-sans`
- no rounded pills, no gradients, no emojis in UI chrome
- no gratuitous cards

See [style-guide.md](../design/style-guide.md) for the full reference.

## Local State And Offline Support

The frontend may use localStorage for categories of state such as:

- USD proofs
- market proofs
- position records
- offline action queues

Every local-storage key involved in wallet or portfolio state should be namespaced by edition and mint URL.

NIP-60 is deferred. The current launch frontend should use browser-local proof storage for both signet and mainnet rather than a separate NIP-60 wallet implementation in one edition.

The failed `webapp/` migration remains legacy implementation reference only, not the active architecture.

## No Mock Data

Every market displayed must come from a real kind `982` Nostr event or a real API projection over real events. No hardcoded, placeholder, or fake markets.
