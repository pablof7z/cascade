# 52 — Accessibility

The baseline — what every page and component must satisfy. Not exhaustive; a full WCAG 2.2 AA audit hasn't been run yet. This document sets the floor.

---

## Contrast

Every text/background combination must meet **WCAG AA** contrast ratios (4.5:1 for body text, 3:1 for large text).

### Verified pairings on `--bg` (`#0b0a09`):

| Foreground | Ratio | AA compliant |
|---|---|---|
| `--text` (`#ece7dc`) | 15.8:1 | ✅ AAA |
| `--text-2` (`#8a8678`) | 5.4:1 | ✅ AA |
| `--text-3` (`#5c5849`) | 3.0:1 | ⚠️ AA large only |
| `--text-4` (`#3a362d`) | 1.5:1 | ❌ decoration only |
| `--yes` (`#3ec48a`) | 9.1:1 | ✅ AAA |
| `--no` (`#e85d7a`) | 5.9:1 | ✅ AA |
| `--ink` (`#efe7d3`) | 16.3:1 | ✅ AAA |

**Usage rules:**

- `--text-4` is for *separators only* (dots, dashes) — never carries meaningful text. Do not use for timestamps, labels, or anything a user needs to read.
- `--text-3` is for metadata and small captions. Keep text size ≥14px when using this.
- `--text-2` can carry body text (`.excerpt`, reply body second tier).
- `--text` for primary content.

---

## Keyboard navigation

Every interactive element must be reachable and operable via keyboard.

### Focus order

- Rail → compose → filter tabs → feed items (top to bottom) → right rail.
- Within a reply: Reply / Restack / Save / Share actions in that order.
- Within the trade module: side toggle → amount input → Back button.

### Tab key behavior

- `Tab` moves forward. `Shift+Tab` moves back.
- `Enter` activates links and default buttons.
- `Space` activates buttons, toggles checkboxes.

### Shortcuts

- `⌘K` / `Ctrl+K` focuses the search input.
- `Esc` closes an open compose, dismisses a hover preview, or moves focus out of an input.

More shortcuts TBD. See [91-open-questions.md](./91-open-questions.md).

### Focus-visible

Every interactive element has a visible focus state for keyboard users:

```css
*:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
  border-radius: inherit;
}
```

Inputs may carry their focus state via `border-bottom-color` change instead of an outline — but still must be perceptible.

**Never** remove focus-visible styles (no `outline: none;` without replacement).

---

## Semantic HTML

Match DOM structure to meaning.

- **`<article>`** for each feed item, reply, inbox card, market-embed preview.
- **`<nav>`** for the rail, the breadcrumb, the tab rows.
- **`<aside>`** for the right rail and the rail itself (left).
- **`<main>`** for the center column.
- **`<header>`** for the page header section on Subscriptions, Markets, and the post-header on the market page.
- **`<form>`** for compose boxes (even if they don't submit to a URL — they're semantically forms).
- **`<button>`** for interactive non-link actions (Post, Back YES, Subscribe). `<a>` for navigation.
- **`<time datetime="...">`** for timestamps.
- **`<blockquote>`** for case blockquotes and anchor-quotes.
- **`<h1>` – `<h3>`** in structural hierarchy: `<h1>` is the claim title, `<h2>` is a page section, `<h3>` is a card section.

---

## ARIA

We prefer native semantics over ARIA where possible, but the following are essential:

- **`role="tablist"`** on tab containers, `role="tab"` on each tab, `aria-selected="true"` on the active.
- **`aria-label`** on icon-only buttons (`<button aria-label="Bookmark">`).
- **`aria-live="polite"`** on regions that receive streaming updates (trade tape, reply count).
- **`aria-current="page"`** on the active rail nav item.
- **`aria-expanded`** on toggles that show/hide content (compose options, if collapsed).

---

## Reduced motion

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0ms !important; transition-duration: 0ms !important; }
  .dot.live { animation: none; }
}
```

The pulse animation on the live indicator stops. Hover transitions become instant.

---

## Screen reader considerations

- **The context line** on a feed item should be read *before* the author name. Use DOM order to enforce this.
- **Position badges** (`holds YES · $120`) should be readable. Consider an `aria-label` that expands the abbreviation: `aria-label="Holds YES with $120 at current price."`
- **Anchor quotes** on replies should be announced with their preamble: *"In reply to: [quote text]"*. The `::before` pseudo-element handles this visually; a screen-reader-only span may be needed.
- **Live announcements** for trades arriving on screen should be throttled — don't spam a screen reader with every trade event. Consider batching to *"N new trades in the last minute"*.

---

## Color-as-information

Color alone must never convey essential information. In Cascade:

- **YES / NO:** always accompanied by the text label ("YES", "NO"). Emerald/rose is the *secondary* signal.
- **Up/down deltas:** always accompanied by `+` or `−` sign. Not just color.
- **Position badges:** always include the side word (*"holds YES"*), not just emerald coloring.

Color-blind users get the same information.

---

## Touch targets (for future mobile)

Minimum 44×44px for touch-primary targets. Currently not strictly enforced on desktop (where hover + click is different), but as mobile design is fleshed out in [91-open-questions.md](./91-open-questions.md), this rule becomes hard.

---

## What's not yet covered

- **Full WCAG audit.** Planned but not scheduled.
- **Screen-reader flow testing.** Needed.
- **Dyslexia / cognitive load.** Serif on reading + sans on chrome is probably helpful, but not verified.
- **Mobile accessibility.** Depends on the mobile design work in [91-open-questions.md](./91-open-questions.md).

## Related

- [13 — Motion & interaction](./13-motion-and-interaction.md)
