# 12 — Layout & Space

The Column is a three-column shell. Widths, gutters, and breakpoints are fixed. Don't invent new column structures for individual pages.

---

## The shell

```
┌──────┬────────────────────┬───────────┐
│ rail │   center (main)    │   right   │
│      │                    │           │
│ 200  │   max 720px        │   340px   │
│ px   │   (flex 1fr)       │           │
└──────┴────────────────────┴───────────┘
          max 1320px total
```

```css
.app {
  display: grid;
  grid-template-columns: 200px minmax(0, 720px) 340px;
  max-width: 1320px;
  margin: 0 auto;
  min-height: 100vh;
}
```

The left and right rails are sticky. The center column scrolls the document.

### Column roles

| Column | Width | Role | Sticky |
|---|---|---|---|
| Rail | 200px | Navigation + primary CTA | Yes, full viewport height |
| Center | flex, max 720px | Content | No — document scroll |
| Right | 340px | Context, trade module, suggestions | Yes, full viewport height |

The center column's content area has 2rem horizontal padding (`padding: 0 2rem`) inside which 720px is the effective max content width. Reading measures (`max-width: 56ch`) further constrain prose within that.

### When to narrow the shell

On **Subscriptions** (reading-only inbox), we drop the right rail entirely and use a two-column shell:

```css
.app { grid-template-columns: 200px minmax(0, 1fr); max-width: 1080px; }
```

This is the **only** exception. All other tabs preserve the three-column shell to keep navigation and chrome consistent.

---

## Breakpoints

Three breakpoints total:

```css
/* 1200px — rail collapses to icons only */
@media (max-width: 1200px) {
  .app { grid-template-columns: 76px minmax(0, 1fr) 320px; }
  .rail .labels { display: none; }
  .rail .brand .mark { display: none; }
}

/* 880px — right rail hides entirely */
@media (max-width: 880px) {
  .app { grid-template-columns: 76px minmax(0, 1fr); }
  .right { display: none; }
}

/* 640px — rail hides, single column */
@media (max-width: 640px) {
  .app { grid-template-columns: 1fr; }
  .rail { display: none; }
}
```

At the smallest breakpoint (640px), we'd surface a hamburger for rail nav (not yet designed; see [91-open-questions.md](./91-open-questions.md)).

---

## Vertical rhythm

We don't use a formal 8px or 4px grid — typography decides rhythm. But every spacing value should be from this scale:

| Purpose | Value |
|---|---|
| Item internal padding | `.4rem .6rem`, `.5rem .7rem` |
| Compact row padding | `.6rem 1rem`, `.7rem 1.1rem` |
| Standard card padding | `1rem 1.1rem`, `1.1rem 1.2rem` |
| Featured card padding | `1.4rem 0 1.8rem` (vertical), `1.6rem 0 2.2rem` (lead) |
| Section padding | `1.4rem 0`, `1.8rem 0`, `2rem 0` |
| Between feed items (top–bottom combined) | ~2.8rem (1rem top + 1.8rem bottom or similar) |
| Page top padding | `2.5rem` (page title area) |

The key value is **the gap between feed items** in Home/Subscriptions/Markets: items should breathe. The old K inbox violated this — items felt cramped because we used `1rem` per side.

---

## Content widths (reading measures)

| Content | Max width |
|---|---|
| Claim title (serif, big) | 22–28ch |
| Case body paragraph | 56ch |
| Reply / note body | 58ch |
| Excerpt (inbox card) | 56ch |
| Blockquote in case | 52ch |
| Anchor quote in reply | 54ch |
| Lede on featured item | 52–58ch |

These are *content* widths, measured in `ch`. They constrain text flow inside a column — not the column itself.

---

## Gutters & gaps

- **Rail item gap (vertical):** `.3rem` between list items
- **Rail group gap:** `1rem` between groups (e.g., between nav and subscribed-to list)
- **Compose box internal gap (avatar ↔ body):** `.85rem`
- **Reply avatar ↔ body gap:** `.85rem` (top-level), `.7rem` (nested)
- **Between chips/tabs:** `1.2rem` (for tab rows) to `1.5rem` (primary tabs)
- **Between stat columns (inline meta):** `1rem to 1.4rem`

---

## Borders & radii

**Borders:** See [10-color.md](./10-color.md). Two tiers only.

**Radii:**
- `0` — rail rows, list rows, most hairline separators
- `4px` — inputs, small buttons, side-toggle borders
- `6px` — the wordmark logo square, primary CTA button
- `10px` — market-embed link-preview cards (compact)
- `14–16px` — rail-card (right rail), inbox card outline when used
- `999px` — all round badges: unread counts, position-chip pills we use sparingly, avatar circles, subscribe buttons

Avoid radii between 16 and 999 — they land in "just a soft rectangle," which feels amateurish.

---

## Shell composition example

The HTML skeleton every page follows:

```html
<div class="app">
  <aside class="rail">
    <div class="brand">...</div>
    <nav class="rail-nav">...</nav>
    <button class="rail-cta">＋ Publish a claim</button>
    <div class="rail-spacer"></div>
    <a class="rail-more">More</a>
  </aside>

  <main class="center">
    <!-- page-specific content -->
  </main>

  <aside class="right">
    <label class="search">...</label>
    <!-- up to 2 rail-cards -->
  </aside>
</div>
```

Never break this composition for a single page. If the content doesn't fit the shell, the shell isn't wrong — the content is.

## Next

- [13 — Motion & interaction](./13-motion-and-interaction.md)
- [20 — Components](./20-components.md)
