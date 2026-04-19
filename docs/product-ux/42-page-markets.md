# 42 — Page: Markets

Category-first browsing view. *"Show me what the market is doing, regardless of who wrote each claim."*

**Reference mock:** `proposals/agency-2026-04/K-the-column/03-markets.html`

---

## Purpose

A section-page for all of Cascade's live claims. Filter by category, sort by activity, browse.

Markets is **not:**

- A data-grid with 8 columns and sparklines per row. We tried that. It broke the visual cohesion of The Column. See [51-anti-patterns.md](./51-anti-patterns.md).
- A trading terminal. Individual trades happen on market pages, not here.

---

## Composition

Standard three-column shell.

### Center column

1. **Page header** — `<h1>Markets</h1>` (sans Inter Tight — it's chrome), subtitle, summary line.
2. **Five featured horizontally-scrollable rails** — Most Active · New · Contested · Biggest Moves · Under the Radar. Each rail contains 5–6 portrait cards with author-attached images.
3. **"All markets"** block — category filter (text tabs) + flat list of all claims.
4. **Load more** footer.

The old design (sort tabs + lead + flat stream) was replaced by this rail-first pattern. Sort is expressed by *which rail you look at* rather than a global sort selector. The flat "All markets" list at the bottom handles pure browsing with a category filter.

### Page header

```
Markets
Every live claim, across every category. Browse without following anyone.

147 live · 38 moved today · $128K in 24h volume
```

- `<h1>` Inter Tight 700 at 1.9rem — chrome, not content, so **sans**.
- Subtitle in muted text.
- Summary count line: mono `.74rem`, muted.

No sort tabs, no category chips at the top. Sort is expressed by the featured rails below; category is expressed by the tabs in the All Markets block.

### Featured rails

Five sections, one per sort dimension: **Most Active · New · Contested · Biggest Moves · Under the Radar.**

Each rail has:
- A section header: title (Inter Tight 700, 1.1rem) + optional descriptor + **"See more →"** link on the right.
- A horizontally-scrollable row of portrait cards, scroll-snap enabled.

```html
<section class="feat-section">
  <header class="feat-head">
    <h3>Most Active<span class="cnt">by 24h volume</span></h3>
    <a class="see-more" href="#">See more <span class="arr">→</span></a>
  </header>
  <div class="rail-scroller">
    <a class="pcard">
      <div class="pcard-img">...author-attached image or category-fallback gradient...</div>
      <div class="pcard-body">
        <span class="pcard-eyebrow"><span class="cat">AI</span> · 35d</span>
        <h4>OpenAI will ship GPT-5 before Google ships Gemini 2 Pro.</h4>
        <span class="pcard-author">@north · Corporate timing</span>
        <div class="pcard-meta">
          <span class="p">71¢</span>
          <span class="delta up">+3¢</span>
          <span>$8.2K</span>
        </div>
      </div>
    </a>
    <!-- more cards, scrolling right -->
  </div>
</section>
```

See [20-components.md#portrait-card](./20-components.md) for the full card spec.

**Card dimensions.** Each card is 196px wide, ~340px tall. Image area is 4:5 portrait aspect-ratio. On the 720px center column, 3 cards are fully visible with a fourth peeking — users scroll horizontally to see the rest.

**Card body.** Below the image:
- Category eyebrow + age (mono, .58rem)
- Serif claim title (3-line clamp, .98rem)
- Author byline (mono, .64rem)
- Meta row with price + delta + volume (mono, bordered top)

### "All markets" — the flat list below

Under the five rails, a dense flat list for pure browsing:

```html
<section class="all-markets">
  <header class="all-markets-head">
    <h3>All markets <span class="cnt">147 live</span></h3>
    <nav class="cat-tabs">
      <a class="on">All</a>
      <a>Geopolitics</a>
      <a>Macro</a>
      <!-- ... -->
    </nav>
  </header>
  <div class="stream">
    <!-- flat reading-shaped rows, same as before -->
  </div>
</section>
```

Category text-tabs sit at the top-right of this block. Below them: the un-boxed reading-shaped rows. Each row is a single claim with eyebrow, serif title, byline, inline mono meta — no sparkline, no boxes.

### Right rail — two cards

**Moving today** — 4 top movers with sparkline thumbnails (`up-item` pattern).

**Most contested** — 3 contested markets with sparkline thumbnails.

Both use the same `up-item` composition as Home. See [principle #10](./02-design-principles.md).

---

## Sort modes

- **Most active** (default) — by 24h volume
- **New** — by age, newest first
- **Contested** — by tight spread (closer to 50¢ = more contested)
- **Biggest moves** — by absolute 24h price change
- **Under the radar** — low volume + interesting divergence (bit algorithmic; calibrated with product)

---

## Category modes

- **All** (default)
- **Geopolitics · Macro · AI · Crypto · Tech · Sports · Culture · Policy · Nostr**

Only one category selected at a time. The counts next to each category come from the live market set.

---

## Interaction

- **Click a claim row** → navigate to the market page (Case tab).
- **Hover** → title color shifts to `--ink`.
- **Right-rail items click** → navigate to the market page.

---

## Empty state

For a category with no live claims:

*"No live claims in Geopolitics yet. Want to start one?"*

With the rail CTA highlighted ("＋ Publish a claim"). Don't repeat the button inline — the rail CTA is always visible.

---

## The Markets ≠ Home distinction

Home is curated by *follows* (algorithmic, personal). Markets is not — **everything on Markets is global**, filtered only by category and sort. Nothing on Markets reflects your subscriptions, follows, or positions. If you visit Markets in incognito, the content would be identical.

This is important for discovery: users should be able to find claims from writers they don't follow yet.

## Related

- [40 — Page: Home](./40-page-home.md)
- [43 — Page: Market](./43-page-market.md)
- [51 — Anti-patterns](./51-anti-patterns.md) — the data-grid Markets we rejected.
