# Contrarian Markets — Brand Style Guide

## Design Direction

**Aesthetic:** Minimalist, shadcn-like. Dark theme. Fewer borders and cards — use spacing and subtle separators instead of boxing everything.

**Feel:** Editorial authority. Professional. Dense but not cluttered. Think Bloomberg meets The Economist in dark mode.

**Anti-patterns (never do these):**
- Rounded pills
- Background-fill toggles
- Emojis in UI chrome
- Gratuitous cards or borders
- Gradients
- Nested cards within cards

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
| Bullish / positive / up | `emerald-*` | — |
| Bearish / negative / down | `rose-*` | — |

No other accent colors without explicit approval.

---

## Typography

### Typefaces

| Role | Font | Tailwind class |
|------|------|----------------|
| Headings | Inter | `font-heading` |
| Body / UI | Inter | `font-sans` |
| Numbers / data / prices | JetBrains Mono | `font-mono` |

**Rationale:** Inter is used throughout for both headings and UI — clean, consistent, and well-suited to dark-mode editorial UI. JetBrains Mono provides legibility for numeric data.

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

- `h1`–`h6` elements default to `font-heading` via global CSS.
- No uppercase tracking except for explicit label categories (e.g. `RESOLVED`, `CLOSED`).
- Use `font-mono` (or `tabular-nums`) for prices, percentages, odds, and all numeric data.

---

## Spacing

- Use Tailwind's default scale consistently.
- Prefer `gap` over margins within flex/grid layouts.
- Section spacing: `py-8` or `py-12` between major sections.
- Component internal padding: `p-4` or `px-4 py-3`.
- Never use arbitrary spacing values — stick to the scale.

---

## Key Components

### Tabs
Underline style only. Reference: `MarketTabsShell.tsx`.
- Container: `flex gap-1 border-b border-neutral-800`
- Active: `-mb-px border-b-2 border-white text-white`
- Inactive: `text-neutral-500 hover:text-neutral-300`

### Buttons
- **Primary:** `bg-white text-neutral-950 hover:bg-neutral-200 text-sm font-medium px-4 py-2`
- **Secondary:** `border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white text-sm font-medium px-4 py-2`
- **Ghost:** `text-neutral-400 hover:text-white text-sm font-medium px-3 py-1.5`
- No rounded pills. Max `rounded-md` if rounding is used at all.

### Inputs
- `bg-neutral-900 border border-neutral-800 focus:border-neutral-600 text-white placeholder:text-neutral-500`
- Minimal borders. No outer glow effects.

### Lists / Tables
- Row separators: `divide-y divide-neutral-800`
- No outer `border-y` on the wrapper — surrounding spacing is sufficient.
- Table headers: `text-xs text-neutral-500 uppercase tracking-wide` (exception to no-uppercase rule).

### Cards
**Avoid.** Use spacing and subtle dividers instead. If absolutely necessary:
- No rounded corners greater than `rounded-md`
- Background `neutral-900` at most
- No shadow effects
- No nested cards
