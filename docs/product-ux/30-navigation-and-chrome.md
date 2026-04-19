# 30 — Navigation & Chrome

How the user moves through Cascade. The chrome is intentionally boring — the same rail, the same topbar layout, the same right rail, across every page. Consistency is the point.

---

## Rail (left)

**Primary nav, from top to bottom:**

| Item | Route | Icon | Badge |
|---|---|---|---|
| Home | `/` | home icon | — |
| Subscriptions | `/subscriptions` | stacked lines | unread count (ink chip) |
| Markets | `/markets` | chart arrow | — |
| Activity | `/activity` | bell | notification count |
| Bookmarks | `/bookmarks` | bookmark | — |
| Portfolio | `/portfolio` | wallet | — |
| Profile | `/p/<handle>` | user's avatar | — |

**Below the nav:** the primary CTA, `＋ Publish a claim`, in warm ink. This is the single highest-leverage user action in Cascade — getting a new sentence onto the record.

**At the bottom:** `More` with a `⋯` icon. For Settings, Edition toggle, Help.

**No search in the rail.** Search lives in the right rail because it's a reading-surface action, not a navigation action.

### Rail item states

| State | Appearance |
|---|---|
| Default | `color: var(--text-2); font-weight: 400;` |
| Hover | `color: var(--text);` |
| Active | `color: var(--text); font-weight: 600;` · icon fills |

Active item does *not* get a background tint or left-border indicator. The weight change + filled icon is enough. The Column's rail is quieter than Substack's which uses a left accent bar.

### Rail compacts

At `max-width: 1200px`, labels disappear and the rail collapses to icons only (76px wide). The CTA becomes a tooltip-on-hover "＋".

At `max-width: 880px`, the right rail hides.

At `max-width: 640px`, the whole rail hides. A hamburger appears in a top drawer (not yet designed — see [91-open-questions.md](./91-open-questions.md)).

---

## Breadcrumbs (in-page)

Breadcrumbs appear at the top of the center column on pages where hierarchy matters: Markets → category → specific market → tab.

```
Home / Markets / AI / OpenAI ships GPT-5 before Gemini 2 Pro / Discussion
```

Render rules:
- Mono `.72rem`, letter-spacing `.06em`
- Separators: `/` in `var(--text-4)` (quaternary)
- Earlier segments: `var(--text-2)` — hoverable to navigate up
- Current page: `var(--text-3)` — not hoverable, ellipsis if too long (`max-width: 42ch`)

Home, Subscriptions, Markets don't need breadcrumbs — they're top-level tabs.

---

## Topbar

We don't have a global topbar. The topbar pattern lives *inside* the center column on pages that need it:

- **Subscriptions page:** a `page-head` with H1 ("Inbox"), subtitle, and sub-tabs.
- **Markets page:** same pattern — H1, subtitle, and filter tabs.
- **Home:** no topbar at all. Compose appears at the top directly. The feed is the page.
- **Market page:** breadcrumbs + post-header (title, byline) + view-tabs.

This is deliberate. A global topbar would add chrome without adding information.

---

## Right rail

340px wide, sticky, full viewport height. Contains at most **two rail-cards** per page. More than two is density-noise.

### Patterns

| Page | Card 1 | Card 2 |
|---|---|---|
| Home | Up next (3 items, unread from subscriptions) | Writers to subscribe (5 items, numbered) |
| Subscriptions | — (no right rail) | — |
| Markets | Moving today (4 movers) | Most contested (3 items) |
| Market / Case | Back a side (trade module) + Your position sub-block | Related claims (4 linked markets) |
| Market / Discussion | Back a side (trade module, compact) | Who's in the thread (5–6 voice-rows) |
| Profile (future) | Subscribe + track record block | Recent activity |

### Search

At the top of every right rail:

```html
<label class="search">
  <svg>...</svg>
  <input placeholder="Search Cascade" />
</label>
```

Pill-shaped (border-radius: 999px). Subtle surface background. ⌘K focus.

---

## Sub-tabs (view switching on a page)

Appear inside the center column, below the page header or post-head.

**Styling:** text-only, no pills, no background. Underline on active with `--ink` color.

**Used on:**
- Subscriptions: `Unread · All · Case revisions · Saved`
- Market page: `Case · Discussion · Trades · Linked`
- Markets page has *two* rows of tabs: sort row + category row. Both use this same visual.

See [20-components.md#text-tabs](./20-components.md).

---

## Sticky behavior

| Element | Sticky? |
|---|---|
| Rail | Yes, `top: 0; height: 100vh;` |
| Right rail | Yes, `top: 0; height: 100vh; overflow-y: auto;` |
| Page head (Subscriptions, Markets) | No — scrolls with document |
| Filter tabs on Markets | Yes, `position: sticky; top: 0;` — so categories stay reachable while scrolling |
| View tabs on market page | No — scrolls with document. (The case is long; the tabs re-anchor on the Discussion tab.) |

We rarely use multiple sticky stacked elements — it fragments the viewport. The filter bar on Markets is the one place where sticky is worth it.

---

## Never introduce

- A global top navigation bar (the rail is primary nav; a topbar duplicates it).
- Hamburger menus at desktop widths.
- Hover-expand menus on rail items.
- A user menu "drawer" or dropdown from the avatar in the top-right — there is no top-right avatar. The profile is a rail item.
- Per-page navigation that doesn't reuse the text-tab pattern.

## Next

- [31 — Discussion architecture](./31-discussion-architecture.md)
- [32 — Expression vs transaction](./32-expression-vs-transaction.md)
