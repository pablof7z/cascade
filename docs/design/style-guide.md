# Brand Style Guide

## Design Direction

**Aesthetic:** Editorial authority. Professional minimalist dark theme. Think Bloomberg meets The Economist in dark mode.

**Feel:** Dense but not cluttered. Information-first. Every element earns its place.

**Anti-patterns — never do these:**
- Rounded pills
- Background-fill toggles
- Emojis in UI chrome
- Gratuitous cards or borders
- Gradients
- Nested cards within cards
- Loading spinners (data streams in via Nostr events — there is no "loading")

---

## Colors

| Role | Token | Hex |
|------|-------|-----|
| Page background | `neutral-950` | `#0a0a0a` |
| Elevated surface | `neutral-900` | `#171717` |
| Interactive / hover | `neutral-800` | `#262626` |
| Primary text | `white` | `#ffffff` |
| Secondary text | `neutral-300` | `#d4d4d4` |
| Tertiary text | `neutral-400` | `#a3a3a3` |
| Muted / disabled | `neutral-500` | `#737373` |
| Strong border | `neutral-700` | `#404040` |
| Subtle border | `neutral-800` | `#262626` |
| Bullish / positive / YES side | `emerald-*` | — |
| Bearish / negative / NO side | `rose-*` | — |

**No other accent colors without explicit approval.**

### The Neutral Rule

Always use `neutral-*`, never `gray-*`. Tailwind's `gray` scale has a blue tint. Cascade uses pure neutral grays with no color cast. If you see blue-tinted backgrounds, replace them.

---

## Typography

### Typefaces

| Role | Font | Tailwind class |
|------|------|----------------|
| Headings | Inter | `font-heading` |
| Body / UI | Inter | `font-sans` |
| Numbers / data / prices | JetBrains Mono | `font-mono` |

JetBrains Mono is for any number that represents a quantity, price, percentage, or odds. Inter everywhere else.

### Type Scale

| Class | Size | Usage |
|-------|------|-------|
| `text-3xl font-heading` | 30px | Page titles, hero headings |
| `text-2xl font-heading` | 24px | Section headings |
| `text-xl font-heading` | 20px | Sub-section headings, market titles |
| `text-lg` | 18px | Lead copy, prominent labels |
| `text-base` | 16px | Body copy |
| `text-sm font-medium` | 14px | Interactive elements, nav, buttons |
| `text-xs` | 12px | Metadata, labels, timestamps |

- `h1`–`h6` default to `font-heading` via global CSS
- No uppercase letter-spacing except explicit label categories (e.g., `RESOLVED`, `OPEN`)
- Use `font-mono` or `tabular-nums` for all prices, percentages, and numeric data

---

## Spacing

- Use Tailwind's default spacing scale. No arbitrary values.
- Prefer `gap` over margins within flex/grid layouts.
- Section spacing: `py-8` or `py-12` between major sections.
- Component internal padding: `p-4` or `px-4 py-3`.

---

## Key Components

### Tabs

Underline style only. No pill tabs, no background-fill tabs.

```
Container: flex gap-1 border-b border-neutral-800
Active:    -mb-px border-b-2 border-white text-white
Inactive:  text-neutral-500 hover:text-neutral-300
```

Reference: `MarketTabsShell.tsx`

### Buttons

| Variant | Classes |
|---------|---------|
| Primary | `bg-white text-neutral-950 hover:bg-neutral-200 text-sm font-medium px-4 py-2` |
| Secondary | `border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white text-sm font-medium px-4 py-2` |
| Ghost | `text-neutral-400 hover:text-white text-sm font-medium px-3 py-1.5` |

No rounded pills. Maximum `rounded-md` if rounding is used at all.

### Inputs

```
bg-neutral-900 border border-neutral-800 focus:border-neutral-600 text-white placeholder:text-neutral-500
```

No outer glow effects. Minimal borders.

### Lists and Tables

- Row separators: `divide-y divide-neutral-800`
- No outer `border-y` on the wrapper — surrounding spacing is sufficient
- Table headers: `text-xs text-neutral-500 uppercase tracking-wide` (exception to the no-uppercase rule)
- No stacked borders (e.g., `border-t` immediately after a `border-b` container)

### Cards

**Avoid.** Use spacing and subtle dividers instead of boxing content in cards. Cards add visual noise without adding information.

If a card is genuinely necessary:
- No rounded corners greater than `rounded-md`
- Background `neutral-900` at most
- No shadow effects
- Absolutely no nested cards

---

## Price and Probability Display

- Always `font-mono`
- Percentages: `72%` not `72.0%` unless precision is meaningful
- Prices: display in sats, formatted with `font-mono`
- YES side color: `emerald-*`
- NO side color: `rose-*`

---

## Loading States

**There are no loading states.** Data streams in via Nostr subscriptions as events arrive. Render what you have. Add items to the list as they appear. Never show a spinner. Never show a skeleton loader. Never show "Loading...".

If a user has never seen a market before and no events have arrived yet, render an empty state — not a spinner.

---

## No Nostr Jargon in UI

The following terms never appear in user-facing UI:
- "Nostr"
- "npub" / "nsec"
- "relay"
- "event"
- "pubkey"

Users see "account", "profile", "key" (only in Settings when they explicitly request it), "activity", "post".
