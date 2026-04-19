# Brand Style Guide

These are the active visual rules for Cascade. Existing deviations are debt, not precedent.

> **PENDING:** The active product UX direction is now **The Column** in
> [`docs/product-ux/INDEX.md`](../product-ux/INDEX.md). The next frontend
> changes will align `web/` with that direction: warm dark surfaces, warm-ink
> CTA/wordmark accents, Fraunces for claim/case writing, Inter Tight for
> section display headings, and a persistent rail/center/right-rail shell. This
> file will be reconciled after the implementation slice lands.

## Direction

Cascade should feel like editorial authority on a dark terminal-like surface.

- Professional minimalist dark theme
- Dense, information-first layout
- Strong hierarchy through typography and spacing
- Confidence through restraint, not decoration

Target feel: newsroom, research terminal, financial briefing. Not SaaS dashboard chrome.

## Hard Rules

Never introduce:

- rounded pills
- background-fill toggles
- gratuitous cards
- gradients
- blue-tinted grays
- stacked borders
- emoji in UI chrome
- loading spinners or skeleton loaders

If an element does not need a border or container, do not give it one.

## Color

Use only the neutral palette plus the two directional accents.

- Page background: `neutral-950`
- Secondary surfaces: `neutral-900` and `neutral-800`
- Borders: `neutral-800` and `neutral-700`
- Primary text: `white`
- Secondary text: `neutral-300`, `neutral-400`, `neutral-500`
- Bullish / positive: `emerald`
- Bearish / negative: `rose`

Use `neutral-*`, not `gray-*`.

## Typography

- Headings and body: Inter via `font-sans`
- Numbers, prices, percentages, and quantities: JetBrains Mono via `font-mono`
- Interactive labels: `text-sm font-medium`
- Metadata: `text-xs`

Do not use decorative fonts. Do not use all-caps tracking except for small category labels that truly need it.

## Layout

- Prefer full-width sections, dividers, grids, and sidebars over card grids.
- Use whitespace to separate sections before reaching for borders.
- Make adjacent sections structurally different when the page is long.
- Lists should usually use `divide-y divide-neutral-800` without an outer frame.

## Components

Buttons:

- Keep them simple, compact, and rectangular.
- No pill buttons.
- Primary action color should stay within the approved palette.

Tabs:

- Underline style only.
- Container: `flex gap-1 border-b border-neutral-800`
- Active: `-mb-px border-b-2 border-white text-white`
- Inactive: `text-neutral-500 hover:text-neutral-300`

Inputs:

- Keep borders subtle.
- No glow, no heavy shadows, no oversized rounded corners.

Cards:

- Avoid by default.
- Use only when a component genuinely needs container chrome such as a modal box or isolated form block.

## Data Presentation

- Show normal product values in USD.
- Use `font-mono` for prices, probabilities, and balances.
- Do not expose sats or msats in normal product UI.
- Use emerald for LONG / YES positive context and rose for SHORT / NO negative context.

## Interaction States

- Render empty states, not loading spinners.
- Stream data in as it arrives.
- Error states should be calm and precise, not dramatic.

## Consistency Rule

When an existing component pattern already works, reuse it. Do not introduce a new visual variant of an established control unless the old one is being deliberately replaced everywhere.
