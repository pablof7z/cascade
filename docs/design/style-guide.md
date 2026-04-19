# Brand Style Guide

These are the active high-level visual rules for Cascade. The detailed product UX source of truth is
[`docs/product-ux/INDEX.md`](../product-ux/INDEX.md), known as **The Column**.

Existing deviations are debt, not precedent.

## Direction

Cascade is a writer's product with a trade button.

- Workspace chrome, essay content
- Persistent left rail, centered reading column, and right context rail
- Reading-first surfaces with trading always accessible but never dominant
- Strong hierarchy through typography, spacing, and restraint

Target feel: Substack-shaped reading app with market conviction in the right rail. Not a trading dashboard with comments bolted on.

## Hard Rules

Never introduce:

- global top navigation
- background-fill tabs or pill filter chips
- gratuitous cards
- blue-tinted grays
- stacked borders
- emoji in UI chrome
- loading spinners or skeleton loaders
- forced-end language

If an element does not need a border or container, do not give it one.

## Color

Use The Column warm dark palette through DaisyUI/Tailwind theme tokens.

- Page background: `#0b0a09`
- Secondary surface: `#13120f`
- Hairline border: `#1c1b17`
- Strong border / neutral edge: `#2a2822`
- Primary text: `#ece7dc`
- Muted text: `#8a8678`
- Warm ink / primary CTA / wordmark: `#efe7d3`
- LONG / positive: `#3ec48a`
- SHORT / negative: `#e85d7a`

Warm ink is the only non-directional accent. Emerald and rose are semantic and should not become decoration.

## Typography

- UI chrome, replies, buttons, forms: Inter via `font-sans`
- Section display heads: Inter Tight via `font-tight`
- Claim titles, case writing, anchor quotes, publication names: Fraunces via `font-serif`
- Numbers, prices, percentages, quantities, timestamps: JetBrains Mono via `font-mono`

Serif marks argumentative writing. Do not use Fraunces on chrome, metadata, tabs, buttons, or reply bodies.

## Layout

- The primary shell is a three-column grid: `200px` rail, center reading column up to `720px`, right rail `340px`, max shell width `1320px`.
- At `1200px`, the left rail collapses to icons.
- At `880px`, the right rail hides.
- At `640px`, the rail hides and content becomes single-column.
- The center column owns the document scroll. Rails are sticky.

Do not create per-page shell structures unless the relevant product-UX page spec explicitly allows it.

## Components

Buttons:

- Warm-ink primary CTAs are reserved for the highest-leverage action, usually `Publish a claim`.
- Secondary actions stay transparent or outlined.
- Trade actions use LONG/SHORT semantic color only inside trading modules.

Tabs:

- Text-only underline tabs.
- Active state uses warm ink.
- No pill tabs and no background-fill tabs.

Inputs:

- Subtle borders and warm dark surfaces.
- No glow, no heavy shadows, no oversized rounded corners.

Cards:

- Avoid by default.
- Right-rail cards, modals, and isolated form blocks may use contained chrome.
- Lists should normally be divided rows, not card grids.

## Data Presentation

- Show normal product values in USD.
- Use `font-mono` for prices, probabilities, balances, and timestamps.
- Do not expose sats or msats in normal product UI.
- Use LONG and SHORT in trading/product chrome.
- Use emerald for LONG/positive context and rose for SHORT/negative context.

## Interaction States

- Render empty states, not loading spinners.
- Stream data in as events arrive.
- Error states should be calm and precise.
- Expected actions should update in place rather than producing toast noise.

## Consistency Rule

Before adding a new visual pattern, check [`docs/product-ux/20-components.md`](../product-ux/20-components.md) and
[`docs/product-ux/51-anti-patterns.md`](../product-ux/51-anti-patterns.md). Reuse The Column primitives unless the old pattern is being deliberately replaced everywhere.
