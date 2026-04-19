# 13 — Motion & Interaction

Motion is quiet here. The product is reading-shaped — nothing should jump at the reader.

---

## Motion philosophy

Three rules:

1. **Data streams, it doesn't "load."** No spinners, no skeletons. New events appear in place; the UI renders what it has and updates when more arrives. (This is a hard product rule — see [`docs/design/product-decisions.md`](../design/product-decisions.md).)
2. **Hover is a small gift, not a party.** Color transitions and subtle background changes only. ~120–150ms.
3. **Nothing rearranges without the user asking.** No algorithmic re-sorting on live updates, no "reorder to show newest at top" without a click. If a new item arrives in a feed, surface a *"3 new · click to load"* pill at the top rather than jumping the scroll.

---

## Transitions

| Change | Transition |
|---|---|
| Color change on hover (title → ink) | `transition: color .12s;` |
| Border-color change on hover (card) | `transition: border-color .12s;` |
| Background tint on row hover | `transition: background .15s;` (often no transition; feels more responsive) |
| Tab underline | No transition — snap. Tab switch is a navigation event, not a visual flourish. |
| Sticky-rail show/hide | No transition. |
| Expanding "Show more replies" | Instant reveal. No accordion motion. |

Never use `transition: all`. Always list the properties.

---

## Hover states

The most common hovers:

```css
/* Rail item */
.rail-item:hover { color: var(--text); }

/* Card-like item (inbox, feed, market row) */
.item:hover { cursor: pointer; }
.item:hover .title { color: var(--ink); }

/* Rail-card row (up-item, voice-row) */
.up-item:hover { background: var(--surface); }

/* Market embed inside a feed item */
.market-embed:hover { border-color: var(--border-strong); }

/* Button (primary ink) */
.btn-primary:hover { background: #fff; }

/* Icon button */
.icon-btn:hover { color: var(--text); border-color: var(--text-3); }
```

No scale transforms. No shadow changes. No lifting. Just color.

---

## Focus states

We rely on the default browser focus ring for keyboard navigation — but we make sure it's visible.

```css
*:focus-visible {
  outline: 2px solid var(--ink);
  outline-offset: 2px;
  border-radius: inherit;
}
```

Inputs and buttons can override with their own treatment:

```css
.compose textarea:focus {
  border-bottom-color: var(--border-strong);
  /* no outline — border carries the focus signal */
}
```

Never remove focus-visible entirely. Every interactive element must have a visible keyboard focus state.

---

## Active / pressed

No separate pressed state (no color shift, no inset shadow). The button action is immediate; visual confirmation comes from state change, not from the click itself.

---

## Cursor

- `cursor: pointer` on: all `<a>`, `<button>`, `.item`, `.reply` (the whole reply is a click target for some actions), `.market-embed`, `.up-item`.
- `cursor: text` on: textareas, inputs.
- Default `cursor: default` on: static text, headings.

Don't use `cursor: pointer` to suggest *"this thing is important"* — only use it for actual links and buttons.

---

## Streaming data — the "fresh" signal

When new events arrive:

- **Trade tape:** new rows insert at the top. No motion. The timestamp column (`2s`, `41s`) shows recency.
- **Reply list:** when the user is sorted by "Newest," new replies insert at the top *only if the user is scrolled to the top*. Otherwise, a small *"3 new replies · click to update"* chip appears above the fold.
- **Price updates:** the price number is JetBrains Mono — when it updates, it just changes. No color flash, no pulse. (The *sparkline* can redraw smoothly; see below.)
- **Sparkline redraw:** if a chart is already on screen, update with a 200ms opacity transition on the new line segment. Not strictly required — this is a polish detail.

---

## The "live" indicator (pulse dot)

Top of rail, green pulse dot:

```css
.dot.live {
  width: 6px; height: 6px;
  background: var(--yes);
  border-radius: 999px;
  animation: pulse 1.9s infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(62,196,138,.5); }
  50%      { box-shadow: 0 0 0 5px rgba(62,196,138,0); }
}
```

One use — the connection indicator in the topbar or rail. Don't use this animation for anything else.

---

## What we never do

- **No loading spinners.** Ever. See [principle #5 in `docs/design/product-decisions.md`](../design/product-decisions.md).
- **No skeleton loaders.** Ever.
- **No toast notifications for expected actions.** If a user backs YES, the right-rail trade module just updates to show the new position. No *"✓ Trade placed!"* pop-up. (Toast only for errors that require the user to read them.)
- **No hover lift (transform: translateY(-4px)).** Reading posture, not marketing-site.
- **No scroll-triggered animations.** Reading shouldn't feel cinematic.
- **No modal overlays for reading content.** If the user taps a claim, they navigate to the market page. They don't get a lightbox.

---

## Keyboard interaction

- **⌘K / Ctrl+K** — focus the search input. (Displayed as a kbd hint in the rail.)
- **Tab** — moves through interactive elements in a logical order: rail → compose → tabs → feed items.
- **Enter on a feed item** — navigates to the linked market / profile.
- **Esc** — closes the compose if it has focus, otherwise no-op.

More keyboard bindings may be added for power users (see [91-open-questions.md](./91-open-questions.md)).

## Next

- [20 — Components](./20-components.md)
