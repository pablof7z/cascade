# 33 — Feed Items

The Home feed on The Column is heterogeneous — multiple item types in a single chronological stream. Each type has a defined shape. Together they cover the full range of activity without looking like a dashboard.

---

## The context line

Every feed item has a single-line *context line* above the author byline, explaining why this item surfaced for you. This is the pattern Twitter uses for "who retweeted" but rewritten in Cascade-voice.

```html
<div class="post-context">
  <svg>...</svg>
  <span>Thread heating up on a claim <strong>in your Watchlist</strong></span>
</div>
```

Examples of context lines:

- *"Thread heating up on a claim in your Watchlist"*
- *"@greta — someone you follow — published a new claim"*
- *"Big move on a claim you watch — $800 just swung YES"*
- *"Your position moved · Nostr DAU claim dropped −4¢"*
- *"@north revised the case on a claim you hold"*
- *"New in Policy — a category you follow"*
- *"@neo — someone you follow — closed a YES position"*
- *"Hot thread — the crowd is split 52% / 48%"*

The context line carries the heterogeneity. It does the job that item-type-specific layout would otherwise do.

---

## Item type 1 — Pure note

A short thought with no embedded content.

```html
<article class="post">
  <!-- context line optional here; pure notes from follows often skip it -->
  <span class="av av-G">G</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Greta Maddox</span>
      <span class="check">◉</span>
      <span class="pub">· Bitcoin, macro &amp; their entanglements</span>
      <span class="time">2h</span>
    </div>
    <div class="post-text">
      <p>The crowd looks underpriced on several 2026 macro claims...</p>
    </div>
    <div class="post-actions">
      <a>Reply</a><a>Restack</a><a>Save</a><a>Share</a>
    </div>
  </div>
</article>
```

Inter body, `.98rem/1.6`. No market embed, no stake chip.

## Item type 2 — Note with embedded market

The author references a specific market. The market appears as a compact link-preview card beneath the note text.

```html
<article class="post">
  <span class="av av-N">N</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Nina Ortega</span>
      <span class="check">◉</span>
      <span class="pub">· Corporate timing, weekly-ish</span>
      <span class="stake-chip">Back YES · $200</span>  <!-- optional disclosure -->
      <span class="time">28m</span>
    </div>
    <div class="post-text">
      <p>Added $200 at 71¢. Three gates became four...</p>
    </div>
    <a class="market-embed">...</a>
    <div class="post-actions">
      <a>Reply</a><a class="back yes">Back YES 71¢</a><a>Save</a>
    </div>
  </div>
</article>
```

The `.stake-chip` is *optional* and appears when the user has just placed a trade and is disclosing it in a note. This is the one sanctioned touch-point between expression and transaction — see [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).

## Item type 3 — Big trade alert (auto-generated)

System-generated feed item for significant trades on markets the user watches or from followed users.

```html
<article class="post">
  <div class="post-context">Big move on a claim you watch — $800 swung YES</div>
  <span class="av av-K">K</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Kamil Owada</span>
      <span class="pub">· AI infra briefing</span>
      <span class="stake-chip">Backed YES · $800 @ 58¢</span>
      <span class="time">14m</span>
    </div>
    <!-- optional short text, often just "Scaling into..." -->
    <div class="post-text">
      <p>Scaling into BTC 150K. Pushed the crowd price from 56¢ to 58¢.</p>
    </div>
    <a class="trade-embed">...</a>
  </div>
</article>
```

The `trade-embed` is a compact one-line summary of the trade: side, market title, amount, avg fill.

## Item type 4 — Claim publication (bigger card)

When someone you follow publishes a new claim. Gets more visual weight.

```html
<article class="post">
  <div class="post-context">@sono published a new claim in Geopolitics</div>
  <span class="av av-S">S</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Sono Yamada</span>
      <span class="check">◉</span>
      <span class="pub">· East Asia watch</span>
      <span class="time">Tue</span>
    </div>
    <div class="post-text">
      <p>Just published. The spread on this one is narrower than the news cycle suggests.</p>
    </div>
    <a class="claim-embed">
      <span class="kicker">
        <span class="cat">Geopolitics</span>
        <span>New claim · seeded $500 YES</span>
        <span class="new-chip">New</span>
      </span>
      <h3>Taiwan holds a recognised national election in 2026...</h3>
      <p class="sub">The crowd has been holding this between 74¢ and 79¢...</p>
      <div class="row">
        <span class="p">77¢ YES · +2¢ 24h</span>
        <span>218 traders · 28 replies · $42K 30d</span>
      </div>
    </a>
  </div>
</article>
```

The `claim-embed` (bigger than `market-embed`) emphasizes that this is a *publication event*, not just a reference.

**With an author-attached image.** If the claim has an image (see [03-product-primitives.md § Claim](./03-product-primitives.md)), the embed includes it as a 16/9 top band above the kicker. The image is the same asset used on Markets rails as a portrait card — the feed renders it cropped to landscape. When absent, the embed falls back to the category-derived gradient used by the portrait card. Image embeds increase visual pull but don't change the structure of the item; the claim title and seed line remain required elements.

## Item type 5 — Note with image/chart evidence

When the note includes a chart screenshot or image as supporting evidence.

```html
<article class="post">
  <!-- byline etc. -->
  <div class="post-text">
    <p>The two-year agrees. This is the chart I keep coming back to.</p>
  </div>
  <div class="img-embed">
    <!-- SVG or <img> -->
  </div>
  <a class="market-embed">...</a>  <!-- optional link to the related market -->
</article>
```

Images are contained in a bordered aspect-ratio box (16/9 default) on the surface background. Captions optional.

## Item type 6 — Restack (amplification)

A user reshares a reply (or a note, or a claim) with optional commentary.

```html
<article class="post">
  <!-- context line -->
  <span class="av av-J">J</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Jules Henao</span>
      <span class="pub">· restacked @north</span>
      <span class="time">1h</span>
    </div>
    <!-- the restacker's own sentence -->
    <div class="post-text">
      <p>The signal is in what <span class="emph">isn't</span> happening.</p>
    </div>
    <!-- the quoted content -->
    <div class="restack-quote">
      <span class="rq-by"><strong>@north</strong> · Author · on <em>OpenAI ships GPT-5</em></span>
      Safety eval cadence hasn't moved, which is informative by itself...
    </div>
  </div>
</article>
```

The original content appears in a blockquote-style container below the restacker's commentary. The restacker's sentence sits above in Inter.

## Item type 7 — Cash-out note

When someone you follow closes a position. Auto-generated or explicitly posted by the user.

```html
<article class="post">
  <div class="post-context">@neo — someone you follow — closed a YES position</div>
  <span class="av av-O">O</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Neo Ravi</span>
      <span class="stake-chip exit">Cashed out · $78 @ 70¢ · +$11.20</span>
      <span class="time">4m</span>
    </div>
    <div class="post-text">
      <p>Closed the GPT-5 YES at 70¢ for a +$11.20. Held 17 days, average entry 56¢. Rotating the capital into Greta's BTC claim.</p>
    </div>
    <a class="market-embed">...</a>
  </div>
</article>
```

The exit `stake-chip` has a muted variant (`exit` modifier) — not emerald (YES) or rose (NO) — since a cash-out is a neutral event with P&L that could be either positive or negative.

## Item type 8 — Price-move alert

System-generated. Surfaces when a claim you have a position on moves significantly.

```html
<article class="post">
  <div class="post-context">Your position moved · Nostr DAU claim dropped −4¢ in the last 20 minutes</div>
  <span class="av" style="background: var(--no-dim); color: var(--no);">⚠</span>
  <div class="post-body">
    <!-- meta (market alert) -->
    <div class="move-embed">
      <span class="chip">−4¢ YES · 20m</span>
      <div class="txt">
        The crowd moved away from YES. You're <strong>up $4.80</strong> on your NO position — the price is now <strong>32¢</strong>, down from 36¢ when you opened.
      </div>
    </div>
    <a class="market-embed">...</a>
  </div>
</article>
```

The alert has a different avatar treatment (an alert glyph, tinted by direction) and includes a `move-embed` above the market card to give the specific context.

## Item type 9 — Case revision

When an author you follow (or whose claim you hold) revises their case.

```html
<article class="post">
  <div class="post-context">@north revised the case on a claim you hold</div>
  <span class="av av-N">N</span>
  <div class="post-body">
    <div class="post-meta">
      <span class="name">Nina Ortega</span>
      <span class="check">◉</span>
      <span class="pub">· Corporate timing, weekly-ish</span>
      <span class="stake-chip">Holds YES · $2,400</span>
      <span class="time">28m</span>
    </div>
    <div class="post-text">
      <p>Added a paragraph to the case — three gates are now four. The Google counter-announcement window I was watching for has narrowed.</p>
    </div>
    <a class="market-embed">...</a>
  </div>
</article>
```

Like Note-with-market, but the context line explicitly says *"revised the case"* and the embedded market shows the revision number (`· rev 3`) in its kicker.

## Item type 10 — Hot thread

When a market's discussion is highly active or controversial (split), it can surface on Home as its own item.

```html
<article class="post">
  <div class="post-context">Hot thread — the crowd is split 52% / 48%</div>
  <!-- no single author avatar; use the market's author -->
  <span class="av av-A">A</span>
  <div class="post-body">
    <!-- meta as the market author -->
    <div class="post-text">
      <p>Twenty-eight replies in four hours, $2,100 on YES, $1,950 on NO. The thread is split almost exactly at the market price, which usually means it's about to break.</p>
    </div>
    <a class="market-embed">...</a>
  </div>
</article>
```

This is the one case where the post-body is system-authored ("Twenty-eight replies in four hours..." could be auto-written) but attributed to the market's author for avatar. Needs product decision on tone.

---

## The stake-chip (a note, not a trade)

The small inline chip that appears in the post-meta row of items 2, 3, 7, 9:

```html
<span class="stake-chip">Back YES · $200</span>
<span class="stake-chip">Backed YES · $800 @ 58¢</span>
<span class="stake-chip">Holds YES · $2,400</span>
<span class="stake-chip exit">Cashed out · $78 @ 70¢ · +$11.20</span>
```

**Emerald (YES), rose (NO), muted (cash-out/exit).** This chip is **disclosure**, not action. It says *"the author of this note has placed / holds / just closed this trade."* Clicking the chip navigates to the market page. It does not initiate any trade.

---

## Actions row

Every feed item has a bottom action row:

```html
<div class="post-actions">
  <a>Reply</a>
  <a class="yes">Back YES 71¢</a>
  <a class="no">Back NO 29¢</a>
  <a class="bookmark">Save</a>
  <a class="more-menu">⋯</a>
</div>
```

Actions:
- **Reply** — opens a reply to the market (if a market is referenced) or to the note itself (inline).
- **Back YES / Back NO** — *shortcut* to the market's trade module. Clicking navigates to the market page with the side pre-selected. Not a trade action in itself.
- **Save** — bookmark for later.
- **Restack** — for notes; rebroadcasts with optional commentary.
- **Share** — copy link.
- **⋯** — kebab menu for mute, report, hide.

These are uniform across feed item types. The specific set shown varies slightly per item type (no Back YES on a pure note with no market reference, for instance).

---

## What we explicitly don't have

- **Likes / hearts.** See [principle #6](./02-design-principles.md).
- **Retweets without comment.** Use Restack (which always supports a comment).
- **Repost without attribution.** Restacks always show who originally said it.
- **Emoji reactions.** No.
- **Polls.** No — Cascade *is* a poll, priced.

## Next

- [40 — Page: Home](./40-page-home.md)
