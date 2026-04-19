# 90 — File Reference

Every mock HTML file in `proposals/agency-2026-04/K-the-column/` is a reference implementation of a specific page or pattern. This document maps patterns to files so engineers and designers know where to look for the canonical example.

---

## The Column mock set

**Base path:** `proposals/agency-2026-04/K-the-column/`

| File | What it demonstrates | Reference in docs |
|---|---|---|
| `01-landing.html` | The Home feed — heterogeneous stream of notes, claims, trades, restacks; three-column shell; compose at top; two-block right rail. | [40-page-home.md](./40-page-home.md), [33-feed-items.md](./33-feed-items.md) |
| `02-subscriptions.html` | The Subscriptions reading digest — two-column (no right rail); time-grouped inbox cards; serif titles; read/unread state. | [41-page-subscriptions.md](./41-page-subscriptions.md) |
| `03-markets.html` | The Markets browsing view — text-tab filters for sort and category; un-boxed reading-shaped rows; `LEAD` kicker on first item; two right-rail cards. | [42-page-markets.md](./42-page-markets.md) |
| `04-market.html` | The market page — Case tab. Post-header with big serif title, author byline, inline price meta, view tabs. Case body with drop cap + blockquote + anchored passages. Linked markets. Featured 3-reply preview. Recent trades mini. Right rail with trade module + related claims. | [43-page-market.md](./43-page-market.md) |
| `05-discussion.html` | The market page — Discussion tab. Compact post header. Split bar showing composition. Expression-only compose (no side picker, no stake). Threaded replies with position badges. Sort tabs. Right rail with compact trade module + "Who's in the thread" voice list. | [43-page-market.md](./43-page-market.md), [31-discussion-architecture.md](./31-discussion-architecture.md), [32-expression-vs-transaction.md](./32-expression-vs-transaction.md) |

---

## Pattern → file map

### Chrome

| Pattern | File(s) |
|---|---|
| Rail (left) | All five |
| Brand + wordmark | All five |
| Rail nav items | All five |
| Primary CTA (warm ink) | All five |
| Rail compacting at 1200/880/640 | All five |
| Right rail — `rail-card` container | 01, 03, 04, 05 |
| Search input (right rail) | 01, 03, 04, 05 |
| Breadcrumbs | 04, 05 |
| Page header (serif H1) | 02, 03 |
| Post header (claim H1 + byline + meta) | 04 |
| Compact post header | 05 |
| View tabs (Case/Discussion/Trades/Linked) | 04, 05 |

### Typography

| Pattern | Best example |
|---|---|
| Serif H1 claim titles | 04 (market page) |
| Serif case body (drop cap, blockquote, anchor) | 04 |
| Sans-serif reply body | 05 |
| Italic publication tagline | 01, 04, 05 (all bylines) |
| Mono price + delta + meta | 03 (inline rows), 04 (post-meta) |

### Components

| Component | File |
|---|---|
| Feed item types (7 types) | 01 (Home feed) |
| Inbox card (time-grouped) | 02 |
| Reading-shaped market row (lead + standard) | 03 |
| Market-embed (link preview card) | 01 (inside feed items), 04 |
| Claim-embed (new-publication card) | 01 |
| Trade-embed (trade alert row) | 01 |
| Reply (top-level, with nested) | 05 |
| Anchor quote (serif italic) | 05 |
| Compose — Home note | 01 |
| Compose — Discussion reply | 05 |
| Trade module (right rail) | 04, 05 |
| Your position sub-block | 04 |
| Up-item (right-rail row) | 01, 03, 04, 05 |
| Sparkline thumbnail (72×56) | 01 (Up next), 03 (Moving today) |
| Voice row (Who's in the thread) | 05 |
| Split bar | 05 |
| Position badge (`holds YES · $120`) | 04 (featured preview), 05 (thread) |
| Author badge | 04, 05 |

### Patterns

| Pattern | File |
|---|---|
| Text tabs (no pills) | 02 (Unread/All), 03 (sort + category), 04 (view tabs), 05 (sort tabs) |
| Time-grouped list | 02 |
| Category eyebrow (emerald) | 03 (stream rows), 04 (post-head) |
| Nested replies (1 level) | 05 |
| Continue-thread collapse | 05 |

### Ancillary (unchanged from older mocks, referenced from rails)

| File | Status |
|---|---|
| `../H-the-study/02-market.html` | **Superseded** by K's `04-market.html`. Kept for historical reference. Some K files still link to it from the rail via placeholder hrefs. |
| `../H-the-study/03-create.html` | Create flow in the older Study direction. **Not yet redesigned** in The Column's voice — see [91-open-questions.md](./91-open-questions.md). |
| `../H-the-study/04-profile.html` | Profile in the older Study direction. **Not yet redesigned** in The Column's voice. |

Any link in a K file pointing into `H-the-study/` is a placeholder until the Column-native version exists.

---

## Directory listing

```
proposals/agency-2026-04/
├── index.html                    ← Direction selector (multiple options)
├── A-the-desk/                   ← Rejected direction
├── B-the-gazette/                ← Rejected direction
├── C-the-trace/                  ← Rejected direction
├── G-the-feed/                   ← Mobile-native direction (parked)
├── H-the-study/                  ← Precursor direction (older)
├── J-the-floor/                  ← Rejected direction
└── K-the-column/                 ← The chosen direction
    ├── 01-landing.html           ← Home feed
    ├── 02-subscriptions.html     ← Subscriptions inbox
    ├── 03-markets.html           ← Markets browse
    ├── 04-market.html            ← Market page (Case tab)
    └── 05-discussion.html        ← Market page (Discussion tab)
```

Mocks for pages not yet built (Create, Profile, Activity, Trades tab, Linked tab, Portfolio) don't exist yet. See [91-open-questions.md](./91-open-questions.md).

---

## How to use these files

**As a designer:** Open the file in a browser, screenshot the section you care about, annotate it. The mock is the source.

**As an engineer:** Use it as a visual reference. The actual app is built with daisyUI + Tailwind + Svelte — the mock's inline CSS is not the production CSS. But the *visual targets* in the mock are canonical.

**As a reviewer:** Open side-by-side tabs of the five pages and confirm they feel like the same product. If they don't, something is broken.

## Related

- [91 — Open questions](./91-open-questions.md)
