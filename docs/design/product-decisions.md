# Product Decisions

Authoritative record of explicit decisions from the project owner (Pablo). Every agent must consult this document before making product, architecture, or design decisions.

**These are directives, not suggestions. Do not override, ignore, or second-guess them. If a decision here conflicts with your judgment, the decision here wins.**

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

### Two Keysets Per Market

One keyset for LONG tokens, one for SHORT tokens. All users share the market's keyset — not per-user keysets.

> "it should be one key set per market long and one key set per market short"
> "One keyset per market — all users share market's keyset (simpler)"

### Lightning Withdrawals

NUT-05 melt for withdrawals. Users provide their own BOLT11 invoice.

### Fee: 1% on Trades

1% flat fee on every trade (buy and sell). Fee stays in the mint as liquidity and treasury.

### Mint URL Routing

The mint uses URL path segmentation for market identification. Not Nostr relay routing.

---

## 3. Market Creation & Funding

### Creator Must Seed Initial Funding

Market creator must provide initial liquidity. Cannot launch a $0 market. Initial funding = creator's opening position.

> "the person that creates the market must seed the initial funding (that's their initial position, right?)"
> "you shouldn't be able to launch it since otherwise it would start with a market cap of $0"

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

**Legacy note:** `src/lib/components/ui/Skeleton.svelte` exists in the codebase as legacy code. Any existing usage of skeleton loaders is tech debt that should be eliminated — do not add new usages.

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

### No Gradients, No Rounded Pills, No Emojis in UI Chrome

All three are explicitly forbidden.

### Tabs: Underline Style Only

No pill tabs, no background-fill tabs. Underline only.

---

## 5. Data & Events

### Kind 984 — NOT APPLICABLE

Kind 984 "resolution events" are not part of Cascade's model. Markets have no oracle, no resolution authority, and no close mechanism. There is no winner declaration, no losing-side payout, and no formal settlement. Withdrawal value is continuous and determined solely by the LMSR price at time of withdrawal.

> **Do not implement kind 984. Do not design features that assume markets close or resolve.**

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

### Editorial Minimalism

Dark theme on `neutral-950`. Accents: only `emerald` (bullish/YES) and `rose` (bearish/NO). No other accent colors.

Feel: Bloomberg meets The Economist in dark mode. Dense, professional, authoritative.

### Typography

Inter for all text. JetBrains Mono for all numbers, prices, and percentages.
