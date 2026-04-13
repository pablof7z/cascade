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
There is also no canonical pubkey-keyed backend portfolio read. `/portfolio` is a browser-derived view.

`/portfolio` is the canonical proof-custody route. `/wallet` exists only as a compatibility redirect and should not diverge into a separate product surface.

Before enabling funding or trading actions, the browser should load a runtime manifest from the configured product API:

- `GET /api/product/runtime`

That manifest is the browser's source of truth for:

- actual backend edition
- proof-custody mode
- funding-rail availability
- whether the configured API matches the current frontend edition

If the frontend is in `mainnet` mode and the backend reports `signet`, the browser must disable funding and trading actions and explain the mismatch instead of attempting to continue.

## Trading And Portfolio State

The frontend needs local state for at least two proof classes:

- USD portfolio proofs
- market proofs for LONG/SHORT positions

Trading surfaces should let the user spend dollars on YES or NO and then persist the resulting market proofs locally.

The launch trade path is proof-native in both signet and mainnet:

- the browser selects locally stored USD proofs for buys
- the browser selects locally stored market proofs for withdrawals
- the browser prepares blinded outputs for the target-side issuance and any change
- the mint returns blind signatures, not user proofs
- the browser unblinds those signatures locally, removes the consumed proofs from local storage, and persists the resulting proofs locally
- the browser never relies on a proofless pubkey-only trade shortcut in either edition

Canonical market-proof units are lowercase and slug-based:

- `long_<market-slug>`
- `short_<market-slug>`

If the browser encounters older uppercase market-proof buckets from earlier builds, it should migrate them into the lowercase canonical buckets during local storage reads rather than maintaining parallel holdings.

There is no server-side proof mirror in the launch design. The backend may expose quote, trade, and settlement status, but bearer proofs remain browser-local.
There is also no server-side portfolio ledger in the launch design. Pending top-ups and trade recovery are resumed from browser-local recovery records plus quote/status routes, not from a backend "current portfolio" snapshot.
The mint may know funding quotes, payment hashes, trade execution records, and spent-proof state. It must not know or reconstruct the browser's current unspent proof set.

The `/portfolio` surface derives both spendable state and performance from:

- local proof state
- a browser-local executed-trade position book for launch cost basis
- public market data

For launch cost basis and PnL:

- successful buy, seed, and withdrawal executions in this browser update a browser-local position book
- that local position book tracks quantity and cost basis by market side
- imported proofs or older proofs without local trade history may have quantity but no local cost basis
- when local cost basis is unavailable, `/portfolio` should show a mark-only value instead of inventing PnL from backend compatibility state
- when public market pricing is temporarily unavailable, `/portfolio` should keep the local holding visible with price unavailable rather than falling back to backend-derived valuation

The launch `/portfolio` surface must also handle local proof movement directly in the browser:

- the browser Cashu client must be pinned explicitly and kept compatible with the mint's active NUT-02/NUT-04 behavior
- do not rely on a transitive `@cashu/cashu-ts` version, because keyset-id derivation mismatches break local proof funding and trading even when the HTTP endpoints are otherwise correct

In signet, funding still starts from the normal top-up UI and API contract, and the quote remains pending until the payment object is actually settled. Paper trading comes from signet-value rails and test infrastructure, not from a separate faucet surface or instant quote completion.

Portfolio funding uses one recovery model across both launch rails:

- the browser stores pending funding recovery state in local storage
- Lightning top-ups use the standard Cashu NUT-23 mint flow instead of a bespoke Cascade funding endpoint
- Stripe top-ups use a persisted product top-up request with a client `request_id`
- Lightning top-ups remain pending until the invoice is actually paid
- Stripe top-ups remain pending until the verified webhook completes them
- after Lightning reaches `PAID`, the browser calls `POST /v1/mint/bolt11` and stores the resulting proofs locally
- after Stripe reaches a paid-and-allowed state, the browser must complete the corresponding custom mint flow with blinded outputs and store the resulting proofs locally
- if a Stripe payment is captured but not accepted by the configured issuance policy, the browser should show `review_required` and must not assume funded proofs exist

For Lightning specifically, browser-local recovery must be proof-native:

- the browser stores the standard mint `quote_id`
- if the browser loses the initial quote response, it retries `POST /v1/mint/quote/bolt11` with the same client `request_id` until the mint replays the same quote
- once the quote reaches `PAID`, the browser prepares deterministic blinded outputs from a browser-local Cashu seed and counter
- if the minting response is interrupted after issuance, the browser restores those proofs locally from the same seed/counter path instead of relying on a server-held proof copy
- signet and mainnet use the same local recovery implementation

Trade recovery must use the same privacy model:

- before buy or withdrawal execution, the browser stores deterministic output preparation for the issued side and any change side
- if the response arrives, the browser unblinds the returned signatures locally
- if the response is interrupted after execution, the browser checks trade status and restores the locally prepared outputs instead of asking the backend for bearer proofs

Every state-changing funding or trade request from the browser should send:

- `X-Cascade-Edition: mainnet|signet`

This lets the mint reject a miswired edition boundary before it creates invoices, top-up records, or trades.

For Stripe specifically:

- `/portfolio` offers a hosted Checkout action alongside Lightning when the edition has Stripe configured
- the UI can navigate the user to the returned `checkout_url`
- the return from Stripe is not the source of truth for proof issuance
- the browser must recover through the same pending-topup polling path used for Lightning
- signet and mainnet use the same browser-local proof storage and the same top-up recovery mechanics

For Lightning specifically:

- `/portfolio` should fund through `POST /v1/mint/quote/bolt11`, `GET /v1/mint/quote/bolt11/{quote_id}`, and `POST /v1/mint/bolt11`
- the UI still starts from a USD amount and renders the returned invoice as a funding mechanism only
- the browser must not depend on bespoke `/api/wallet/topups/lightning/*` routes for Lightning funding
- the browser must not depend on `GET /api/wallet/topups/requests/{request_id}` for Lightning recovery either; Lightning recovery stays on the standard mint quote flow plus client `request_id`

- export a locally held proof bucket as a standard Cashu token string
- import a Cashu token string into the local browser store
- keep import/export entirely local rather than introducing a server custody API
- use the same browser-local proof manager in signet and mainnet

The immediate implementation target is one export/import action per local proof bucket:

- one mint URL
- one unit
- one encoded Cashu token string

That keeps export/import aligned with the current storage model and avoids inventing a non-standard multi-unit wrapper before trade execution itself is fully proof-native.

For valuation, the frontend should use a two-layer model:

- liquid USD balance = sum of locally held USD proofs
- mark-to-market position value = locally held market-proof quantity priced against current public market prices
- exact exit value = a fresh sell quote from the mint for the full quantity the user wants to withdraw

The fast portfolio view should use current public market prices for mark-to-market display. When the user is about to exit, the client should call the sell-quote endpoint because LMSR pricing is size-dependent and the executable withdrawal value may differ from the simple mark price.

Market-proof amounts are stored as fixed share-minor units rather than floats:

- one proof amount unit = `0.0001` share
- one whole share = `10_000` stored units

The frontend should convert between stored integer units and displayed decimal share quantities at the edge of the UI instead of storing float quantities in browser state.

Mint-side market keysets must also expose large denominations for these share-minor units. Otherwise a single position near the edge of the LMSR curve can turn into thousands of tiny proofs and overflow browser-local storage.

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
