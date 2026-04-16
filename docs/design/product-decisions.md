# Product Decisions

Authoritative record of explicit decisions from the project owner (Pablo). Every agent must consult this document before making product, architecture, or design decisions.

**These are directives, not suggestions. Do not override, ignore, or second-guess them. If a decision here conflicts with your judgment, the decision here wins.**

PENDING: The separate signet/mainnet web deployment directive is being replaced by one web deployment with a Live/Practice switch, shared relays, two mints, and edition-specific event kinds.

> **Implementation status note:** Not all directives below are fully implemented in the current codebase. Treat them as required standards for all new work — if something doesn't yet comply, it's tech debt to fix, not a pattern to follow.

---

## 1. Architecture

### Kind 982 — Non-Replaceable, Immutable Market Events

Markets are kind 982 Nostr events. Not kind 30000. Not any replaceable kind.

- Kind 982 only
- Only `E` tags for references — never `A` tags
- No `version: 1` tag (was explicitly removed)
- Markets are immutable once published

> "market shouldn't be a replaceable event, it MUST be a non 3xxxx kind event, so no 'A', only 'E'"
> "version: 1 is stupid — remove it"

### Markets Never Expire

No expiration mechanism exists. No expiry tags. No countdown timers. Markets live forever.

> "markets never expire"

### Deployment: Vercel, Always

Deploy to Vercel at `cascade.f7z.io`. Auto-deploys on push to main. If it's not deployed, it doesn't exist.

- Commit AND deploy. Both are required.
- Production must be public — no auth required to view.
- Repo: `git@github.com:pablof7z/cascade.git`

### Separate Signet And Mainnet Editions

Cascade needs a paper-trading edition and a real-money edition.

- Mainnet and signet must run as separate app + mint deployments.
- Proofs, reserves, databases, Nostr publishing identities, relay projections, and payment rails must not mix between editions.
- The paper-trading edition exists so humans, agents, and the owner can exercise the full flow without mainnet funds.
- Mainnet and signet use the same proof-custody implementation. The difference is value and infrastructure, not different wallet mechanics.
- Mainnet and signet use the same public funding routes and the same browser-local proof model.
- Signet wallet-funding Lightning quotes may auto-pay inside the signet mint, testnut-style, as long as they still move through the standard mint-quote and mint endpoints and never fall back to a pubkey-keyed server wallet ledger.
- Launch proof custody is browser-local storage in both editions. NIP-60 is deferred and may return later, but it is not part of the current product.

### User-Facing Capital Surface Is Portfolio

The user-facing capital surface is called `Portfolio`.

- The canonical route is `/portfolio`.
- There is no `/wallet` product route.
- Avoid calling the product surface "wallet" in UI copy, onboarding copy, or product docs unless the reference is specifically about internal wallet-mint infrastructure.

### No Server-Side Portfolio Ledger

Cascade does not maintain a canonical per-user portfolio on the backend.

- No pubkey-keyed balance ledger for spendable USD value
- No pubkey-keyed open-position ledger for current holdings
- No pubkey-keyed `/api/product/portfolio/:pubkey` or `/api/product/wallet/:pubkey` route in the launch contract
- The backend may persist quote state, trade status, settlement status, and anti-abuse/risk state
- The backend may verify consumed proofs and track them as spent
- The backend may persist funding and settlement metadata, but never a canonical copy of the user's unspent proofs
- The backend must not persist a canonical snapshot of a user's unspent holdings
- `/portfolio` is derived in the browser from local proofs, browser-local trade/funding recovery state, and public market data

This is true in both signet and mainnet.

### Svelte — React Is Gone

Complete migration from React to Svelte 5 + SvelteKit. No React in new code. No exceptions.

> "Port to Svelte. Abandon React. I MEAN IT."

### Mint Has Its Own Nostr Pubkey

The mint identity is separate from user and platform identity. Mint-published events (kind 983 trades) carry the mint's pubkey, not the user's.

### Modules Are Informational Only

Modules within a thesis are informational connections. They do not influence the thesis's probability. Each market's price is set solely by its own trading activity.

> "only market influence the thesis probability, the modules are literally linked just informationally! Why do you insist in claiming there's a deeper fucking link!"

**Do not add code that mathematically couples module prices to thesis probabilities.**

---

## 2. Cashu Mint

### Custom Mint Required

Off-the-shelf Cashu mints cannot do LMSR-priced token issuance. We build custom.

- Implementation: CDK Rust (Cashu Dev Kit)
- Not Nutshell, not cashu-ts, not any existing mint

### Standard-First CDK Reuse

Cascade should reuse standard Cashu/CDK primitives wherever those primitives can already express the required behavior.

- Do not add a custom Cascade route if a standard Cashu mint or melt route already exists for that job.
- Do not add a parallel Cascade state machine when CDK already persists the canonical mint/melt quote state.
- Custom logic is allowed only when the product behavior is genuinely outside the standard mint contract and the deviation is documented with a justification.

At launch, the allowed custom layers are:

- product discovery
- Stripe funding orchestration and webhook completion
- spend-based LMSR trade orchestration that composes multiple standard mint/melt steps into one USD-denominated action
- edition/runtime manifest checks such as signet/mainnet mismatch protection

Everything else should default to the standard CDK/Cashu surface and be treated as debt if it drifts away from it.

### Two Keysets Per Market

One keyset for LONG tokens, one for SHORT tokens. All users share the market's keyset — not per-user keysets.

> "it should be one key set per market long and one key set per market short"
> "One keyset per market — all users share market's keyset (simpler)"

### Lightning Withdrawals

NUT-05 melt for withdrawals. Users provide their own BOLT11 invoice.

### Fee: 1% on Trades

1% flat fee on every trade (buy and sell). Fee stays in the mint as liquidity and treasury.

### USD Base Unit, Not Sats

The user-facing wallet and trading unit is USD.

- The wallet mint issues USD-denominated ecash.
- Application and product APIs represent USD in integer minor units.
- Normal product UX does not expose sats or msats.

> "the base unit of the mint should be usd"
> "i don't want to tell users about 'sats' -- the target audience is not bitcoiners"

### Launch Wallet Funding Rails

Launch wallet funding happens at the USD wallet-mint boundary.

- Stripe is the canonical card rail.
- Lightning is also a launch funding rail.
- A successful Stripe payment or Lightning payment credits the user with USD ecash.
- Off-platform bank payout is not required for launch.
- Lightning portfolio funding should use the standard Cashu NUT-23 BOLT11 mint flow, not a bespoke Cascade-only funding endpoint.
- That means incoming Lightning funding should look like `POST /v1/mint/quote/bolt11`, `GET /v1/mint/quote/bolt11/{quote_id}`, and `POST /v1/mint/bolt11`.
- If the browser loses the initial quote response, it should retry `POST /v1/mint/quote/bolt11` with the same client `request_id` rather than depending on a custom Lightning recovery route.
- Cascade-specific `/api/...` routes are allowed for orchestration such as market buying and selling, but pure wallet-mint Lightning funding should stay on the standard Cashu path.

> "let's use a stripe gateway"

### Market Visibility Requires Funding

The signed kind `982` event is not enough for public market discovery on its own.

- The creator can publish kind `982` immediately.
- Other users should not see that market in normal discovery surfaces until the mint has published at least one kind `983` that `e`-tags the market.
- The first mint-authored kind `983` is the public visibility threshold. There is no dedicated pending-state endpoint; the kind `982` is observable on relays, but the product API only surfaces a market after its first kind `983` exists.

### Lightning Is The Rail, Not The UX

Cross-mint settlement uses Lightning as hidden infrastructure, but users should experience the product as dollar-denominated wallet funding and dollar-denominated trading.

- The wallet mint can melt USD value into Lightning invoices.
- The market mint can mint LONG or SHORT tokens when those invoices are paid.
- The normal product contract is "spend dollars on LONG/SHORT", not "pay a Lightning invoice".

### Dual Quote Model

The canonical launch architecture uses two executable quote layers.

- `USD <-> msat` comes from the wallet-mint FX boundary.
- `LONG/SHORT <-> msat` comes from the market mint's LMSR engine for a specific trade size.
- The product layer composes those quotes and hides the choreography from the user.
- We do not introduce a bespoke public cross-unit swap primitive for launch.

### FX Policy

The `USD <-> msat` quote layer should be modular and source data from multiple major providers.

- The implementation should support multiple provider adapters behind one quote-source interface.
- Launch can use an obvious weighted or averaged policy across large providers.
- Executable quote snapshots must persist the contributing provider data, the final rate, the spread, and expiry.

The product should execute against locked quotes, not loose spot tickers.

### Stripe Is Mint Concern

Stripe is a funding rail. Funding rails are mint concern — period.

- The mint holds the Stripe secret key.
- The mint creates checkout sessions.
- The mint receives Stripe webhooks.
- There is no webapp backend in the funding path. The browser talks to the mint for Stripe session creation, redirects to Stripe, and returns to the frontend. The mint receives the webhook and the browser mints proofs from the mint.
- This is the same architectural boundary as Lightning funding: the mint handles the money, the frontend handles the UX.

> Stripe stuff is about funds; there's zero reason to couple the webapp's backend with the Stripe stuff. Zero. That's all mint concern.

### Stripe Risk Controls

Freshly card-funded USD value is portable bearer ecash once proofs are issued, so launch risk controls must happen before proof issuance.

- Stripe risk signals should feed a wallet-risk policy layer.
- Launch should enforce conservative Stripe volume caps before checkout creation.
- Stripe webhook completion must fetch Stripe risk data before issuing proofs.
- Higher-risk funding requests should end in `review_required` or rejection, not in immediately portable proofs with server-side "limits" that cannot actually be enforced.
- The precise scoring model can evolve, but launch must have an explicit pre-issuance risk gate.

### No Market Data Mirror In The Mint

The mint does not maintain a mirror of relay data. Market discovery, search, activity, and price history are relay concerns — the frontend queries relays directly.

- The mint database stores only execution state: LMSR parameters, keysets, proofs, quotes, funding/settlement state, and risk state.
- There are no product read APIs for market feeds, search, activity, or price history on the mint backend.
- Kind `982` (market definitions) and kind `983` (trade records) are authoritative on relays. The mint publishes kind `983` to relays after trade execution — it does not serve them back to clients through an HTTP API.
- The frontend derives activity feeds, search, and price history from relay subscriptions and local computation.

> Those endpoints shouldn't exist on the webapp; all that stuff is relay concern. The relay is where we store data — why do we have a second database?

### Mint URL Routing

The mint uses URL path segmentation for market identification. Not Nostr relay routing.

- Market-scoped key discovery uses the kind `982` event id in the path.
- Canonical example: `GET /{event_id}/v1/keys`

---

## 3. Market Creation & Funding

### Creator Must Seed Initial Funding

Market creator must provide initial liquidity. Cannot launch a $0 market. Initial funding = creator's opening position.

> "the person that creates the market must seed the initial funding (that's their initial position, right?)"
> "you shouldn't be able to launch it since otherwise it would start with a market cap of $0"

### Seed Amount Means Total Spend

When the builder asks for an initial seed amount in USD, that number should mean total user spend for the launch action.

- The creator enters one dollar amount.
- Fees are included inside that amount, not added afterward as a surprise.
- Quote and execution flows should preserve this semantics for both normal buys and create-and-seed flows.

### No Mock Data

All market data must be real Nostr events. No fake, hardcoded, or placeholder markets in production.

> "I had said that I wanted to have the mock data we had in the past as hard used markets, I want it published as events that will show up in the app."

### LMSR Pricing

LMSR (Logarithmic Market Scoring Rule) is the pricing mechanism. Integrated into the mint for dynamic token pricing.

---

## 4. UI/UX

### No Loading Spinners — Ever

Zero spinners. Zero loading states. Zero skeleton loaders.

Data streams in via Nostr subscriptions as events arrive. Render what you have. Add items as they appear.

> "Loading spinners on nostr applications should never exist. Nostr is event based! Show the data as it streams in: not a fucking spinner. No loading states!!!"

**Legacy note:** Skeleton-loader code may still exist in legacy frontend files. Any existing usage is tech debt that should be eliminated — do not add new usages.

### No Blue Tint — Neutral Colors Only

Always `neutral-*`, never `gray-*`. Tailwind's default gray has a blue tint that Pablo explicitly rejected.

> "I don't like the blue-tinted tailwind -- I want neutral colors"
> "it used to have a neutral color; now it has a blue hue as the background -- I hate it"

### No Cards Everywhere

No gratuitous card wrappers. Tight, purposeful layouts. Use spacing and dividers instead.

### No Nostr Jargon in UI

No npub, nsec, relay URLs, or "Nostr" on any user-facing surface. nsec is stored in localStorage and accessible only from the Settings page — not shown during onboarding.

> "remember to not leak any 'nostr' stuff into the UI"
> "we don't show them npub or nsec during onboarding nor talk about keys"

**Legacy note:** Some Nostr terminology may still appear in current UI code as legacy. Remove it when encountered — do not treat existing occurrences as precedent.

### No Sats In Normal Product UI

The normal human product surface is dollar-denominated.

- Show balances, trade sizes, fills, and PnL in USD.
- Do not make the user think about sats, msats, or Lightning invoices.
- If Lightning is used internally, it stays behind the product boundary.

### No Gradients, No Rounded Pills, No Emojis in UI Chrome

All three are explicitly forbidden.

### Tabs: Underline Style Only

No pill tabs, no background-fill tabs. Underline only.

---

## 5. Data & Events

### Markets Never Close

Cascade markets never close. There is no resolution event, oracle, or admin-driven settlement. Exit value is continuous and determined solely by the LMSR price at time of exit.

> **Do not design features that assume markets close.**

### No Expiry Tags

Markets never have an expiry tag. Do not add one.

### No Version Tag

No `version: 1` tag on kind 982 events. Removed by explicit decision.

---

## 6. Agents & Automation

### Human-Agent Parity

AI agents are first-class participants. Same protocol as humans. Same market mechanics. No special agent mode.

---

## 7. Roadmap Constraints

### No Feature Without Pablo Sign-Off on Mint Plan

> "Don't implement anything. I want to sign off on the plan..."

The mint plan required explicit sign-off before implementation. This principle extends to major architectural decisions: when in doubt, document and confirm before building.

---

## 8. Visual Design

### Component Framework: Tailwind v4 + DaisyUI

Use **Tailwind CSS v4** with **DaisyUI** for all UI components. No hand-rolled component CSS for things DaisyUI provides (`btn`, `card`, `modal`, `tab`, `badge`, `alert`, `input`, `select`, `textarea`, `toggle`, `dropdown`, etc.).

**bits-ui** remains for headless accessibility primitives (tabs, dialogs, dropdowns) — style them with DaisyUI classes.

This replaces any prior shadcn-svelte or custom CSS approaches.

### Editorial Minimalism

Dark theme on `neutral-950`. Accents: only `emerald` (bullish/YES) and `rose` (bearish/NO). No other accent colors.

Feel: Bloomberg meets The Economist in dark mode. Dense, professional, authoritative.

### Typography

Inter for all text. JetBrains Mono for all numbers, prices, and percentages.
