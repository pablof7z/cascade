# Brand Style Guide

> **Implementation status note:** These are directives from the project owner — not all are fully implemented in current code. Treat them as required standards for all new work. Existing deviations are tech debt to fix, not patterns to follow.

---

## Styling Stack

- **Tailwind CSS v4** — utility classes, native CSS config via `@import "tailwindcss"` in `app.css`
- **DaisyUI** — component classes for buttons, cards, modals, tabs, inputs, badges, alerts, etc.
- **bits-ui** — headless Svelte 5 primitives for accessible behavior (tabs, dialogs, dropdowns); styled with DaisyUI/Tailwind classes

**Rule: Use DaisyUI component classes first.** If DaisyUI has a class for it (`btn`, `card`, `modal`, `tab`, `input`, `badge`, `alert`, `toggle`, `dropdown`, etc.), use it. Do not hand-roll CSS for things DaisyUI covers. Custom CSS only for genuinely unique Cascade elements.

---

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

## DaisyUI Theme

Configure a custom dark theme in `app.css` using DaisyUI's CSS variable theming. Map Cascade's palette:

| Role | DaisyUI variable | Value | Notes |
|------|-----------------|-------|-------|
| Page background | `--b1` | `#0a0a0a` (neutral-950) | |
| Elevated surface | `--b2` | `#171717` (neutral-900) | |
| Interactive / hover | `--b3` | `#262626` (neutral-800) | |
| Primary text | `--bc` | `#ffffff` | Base content color |
| Primary accent | `--p` | emerald-500 | YES side, positive, CTAs |
| Primary content | `--pc` | white | Text on primary |
| Error accent | `--er` | rose-500 | NO side, negative, errors |
| Error content | `--erc` | white | Text on error |
| Neutral | `--n` | `#404040` (neutral-700) | Borders, secondary surfaces |
| Neutral content | `--nc` | `#d4d4d4` (neutral-300) | Secondary text |

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
- No uppercase letter-spacing except explicit label categories (e.g., `LIVE`, `NEW`)
- Use `font-mono` or `tabular-nums` for all prices, percentages, and numeric data

---

## Spacing

- Use Tailwind's default spacing scale. No arbitrary values.
- Prefer `gap` over margins within flex/grid layouts.
- Section spacing: `py-8` or `py-12` between major sections.
- Component internal padding: `p-4` or `px-4 py-3`.

---

## Key Components

### Buttons

Use DaisyUI `btn` classes:

| Variant | DaisyUI classes |
|---------|-----------------|
| Primary | `btn btn-primary` |
| Secondary | `btn btn-outline` |
| Ghost | `btn btn-ghost` |
| Danger | `btn btn-error` |

Size: `btn-sm` for compact UI, default for standard. No rounded pills — override DaisyUI's default border-radius to `rounded-md` max in the theme.

### Tabs

Use DaisyUI `tabs` with `tabs-bordered` variant. Underline style only — no boxed/lifted tabs.

```html
<div class="tabs tabs-bordered">
  <a class="tab tab-active">Active</a>
  <a class="tab">Inactive</a>
</div>
```

When using bits-ui `Tabs` primitives for keyboard navigation, apply DaisyUI tab classes to the rendered elements.

### Inputs

Use DaisyUI `input` class:

```html
<input class="input input-bordered w-full" />
<select class="select select-bordered" />
<textarea class="textarea textarea-bordered" />
```

The DaisyUI theme variables handle the colors. No outer glow effects.

### Modals / Dialogs

Use DaisyUI `modal` class for styling, bits-ui `Dialog` for behavior:

```html
<dialog class="modal">
  <div class="modal-box">
    <!-- content -->
  </div>
  <form method="dialog" class="modal-backdrop">
    <button>close</button>
  </form>
</dialog>
```

### Badges / Labels

Use DaisyUI `badge` class:

```html
<span class="badge badge-primary">LIVE</span>
<span class="badge badge-error">CLOSED</span>
<span class="badge badge-ghost">PENDING</span>
```

### Dropdowns

Use DaisyUI `dropdown` class for styling, bits-ui `DropdownMenu` for behavior and accessibility.

### Cards

**Avoid.** Use spacing and subtle dividers instead of boxing content in cards. Cards add visual noise without adding information.

If a card is genuinely necessary, use DaisyUI `card`:
- `card bg-base-200` — no shadow
- No rounded corners greater than `rounded-md`
- Absolutely no nested cards

### Lists and Tables

- Row separators: `divide-y divide-neutral-800`
- No outer `border-y` on the wrapper — surrounding spacing is sufficient
- Table headers: `text-xs text-neutral-500 uppercase tracking-wide` (exception to the no-uppercase rule)
- No stacked borders (e.g., `border-t` immediately after a `border-b` container)
- For data tables, use DaisyUI `table` class

---

## Price and Probability Display

- Always `font-mono`
- Percentages: `72%` not `72.0%` unless precision is meaningful
- Monetary values: display in USD in the normal product UI, formatted with `font-mono`
- Never expose sats or msats in the normal product UI
- YES side color: `text-primary` (emerald via theme)
- NO side color: `text-error` (rose via theme)

---

## Loading States

**There are no loading states.** Data streams in via Nostr subscriptions as events arrive. Render what you have. Add items to the list as they appear. Never show a spinner. Never show a skeleton loader. Never show "Loading...".

If a user has never seen a market before and no events have arrived yet, render an empty state — not a spinner.

**Legacy note:** Skeleton-loader code may still exist in legacy frontend files. Any such usage is tech debt — do not add new usages, and remove it when touching the relevant area.

---

## No Nostr Jargon in UI

The following terms never appear in user-facing UI:
- "Nostr"
- "npub" / "nsec"
- "relay"
- "event"
- "pubkey"

Users see "account", "profile", "key" (only in Settings when they explicitly request it), "activity", "post".
