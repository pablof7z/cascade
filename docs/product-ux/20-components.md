# 20 — Components

The component library for The Column. Every piece below is a first-class primitive with a defined visual, a canonical HTML shape, and a set of rules about when to use it.

If you're about to introduce a new component, first check whether one of these already does the job — and first check [51-anti-patterns.md](./51-anti-patterns.md).

---

## Navigation rail

The left sidebar. 200px wide, sticky, full viewport height.

**Composition (top to bottom):**
1. Brand lockup (logo + "Cascade" wordmark)
2. Nav items (Home · Subscriptions · Markets · Activity · Bookmarks · Portfolio · Profile)
3. Primary CTA ("＋ Publish a claim") in warm ink
4. Spacer
5. "More" link

**HTML:**
```html
<aside class="rail">
  <div class="brand">
    <span class="logo">C</span>
    <span class="mark labels">Cascade</span>
  </div>
  <nav class="rail-nav">
    <a class="rail-item active" href="#">
      <svg>...</svg>
      <span class="labels">Home</span>
    </a>
    <!-- more items -->
  </nav>
  <button class="rail-cta labels">＋ Publish a claim</button>
  <div class="rail-spacer"></div>
  <a class="rail-more labels">More</a>
</aside>
```

See [30-navigation-and-chrome.md](./30-navigation-and-chrome.md) for the nav item list and behavior.

---

## Topbar / breadcrumb

Appears inline at the top of the center column on market/profile pages. Not a global element.

```html
<nav class="crumbs">
  <a href="01-landing.html">Home</a><span class="sep">/</span>
  <a href="03-markets.html">Markets</a><span class="sep">/</span>
  <a href="#">AI</a><span class="sep">/</span>
  <span class="cur">OpenAI ships GPT-5...</span>
</nav>
```

Mono, `.72rem`, letter-spacing `.06em`. Links are `var(--text-2)`; separators are `var(--text-4)`; current page is `var(--text-3)`.

---

## Search (right rail)

Rounded pill input at the top of the right rail.

```html
<label class="search">
  <svg>...</svg>
  <input placeholder="Search Cascade" />
</label>
```

```css
height: 42px;
padding: 0 .95rem;
background: var(--surface);
border: 1px solid var(--border);
border-radius: 999px;
```

⌘K focuses the search.

---

## Text tabs

Used for: view switching (Case · Discussion · Trades · Linked), sort (Top · Newest · Controversial · Holders), category filter (All · Geopolitics · Macro · ...).

**Visual:** text only, no background, no border. Active state = underline + color change to `--ink`.

```html
<nav class="view-tabs">
  <a class="on" href="#">Case</a>
  <a href="#">Discussion<span class="c">24</span></a>
  <a href="#">Trades<span class="c">2,814</span></a>
  <a href="#">Linked<span class="c">3</span></a>
</nav>
```

```css
.view-tabs a {
  padding: .8rem 0;
  color: var(--text-3);
  font-size: .92rem;
  font-weight: 500;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}
.view-tabs a.on {
  color: var(--ink);
  border-bottom-color: var(--ink);
}
```

**Never use pill-chips instead.** See [51-anti-patterns.md](./51-anti-patterns.md).

---

## Buttons & CTAs

Three button types. That's all.

### Primary (ink)

Filled warm ink with dark text. Used for the rail CTA, Subscribe buttons, Post reply, primary actions.

```css
.rail-cta, .post-btn, .sub-btn {
  background: var(--ink);
  color: #1a1610;
  font-weight: 600;
  border: 0;
  border-radius: 999px; /* or 6px for the rail-cta */
  font-size: .88rem;
  letter-spacing: -.005em;
}
.rail-cta:hover { background: #fff; }
```

### Ghost (outlined)

Outlined, transparent. Used for secondary actions: Save, icon buttons.

```css
.btn-ghost, .icon-btn {
  background: transparent;
  color: var(--text-3);
  border: 1px solid var(--border-strong);
}
.btn-ghost:hover, .icon-btn:hover {
  color: var(--text);
  border-color: var(--text-3);
}
```

### Trade (YES/NO)

The side-toggle in the right-rail trade module. A 2-col split button, not a pill.

```html
<div class="sides">
  <button class="y on">Back YES<span class="p">71¢</span></button>
  <button class="n">Back NO<span class="p">29¢</span></button>
</div>
```

Active YES has `--yes-dim` background and `--yes` text; active NO has `--no-dim` and `--no`. See [30-navigation-and-chrome.md](./30-navigation-and-chrome.md) for full trade module spec.

---

## Inputs

### Text input

```html
<input class="input" type="text" />
```

```css
border: 1px solid var(--border-strong);
border-radius: 4px;
background: transparent;
color: var(--text);
padding: .55rem .7rem;
font-family: 'JetBrains Mono', monospace; /* for amounts */
/* or Inter for text inputs */
```

Focus: `border-color: var(--text-3);` — no outline.

### Textarea (reply compose)

```css
background: transparent;
border: 0;
border-bottom: 1px solid var(--border);
color: var(--text);
font-family: 'Inter', sans-serif;
font-size: 1rem;
line-height: 1.55;
padding: .55rem 0;
outline: none;
resize: vertical;
```

Focus: `border-bottom-color: var(--border-strong);`

---

## Avatars

Users get warm-gradient avatars (initials on a two-color gradient from within the brand-appropriate warm palette). Never emerald or rose in avatars (preserves price-semantics).

**Gradients (examples):**

```css
.av-N { background: linear-gradient(135deg, #a88a6e 0%, #6b4f3c 100%); }  /* warm brown */
.av-G { background: linear-gradient(135deg, #d4b97a 0%, #8a6b3e 100%); }  /* warm gold */
.av-K { background: linear-gradient(135deg, #6a8a7e 0%, #3e5248 100%); }  /* muted green-neutral */
.av-S { background: linear-gradient(135deg, #7a6ca4 0%, #4a4068 100%); }  /* muted purple */
/* ... */
```

**Sizes:**
- `20–22px` — tiny (rail subscribed-to list, inline footers)
- `26–28px` — small (voice-row, compact nested reply)
- `30–36px` — medium (nested reply avatars)
- `40px` — default (reply, compose, feed item)
- `112px` — profile hero

**Initials:** JetBrains Mono, weight 600, dark color (`#1a1610`) on the warm gradient.

```html
<span class="av av-N">N</span>
```

---

## Author byline

Under a claim title or in a compact market header.

**Full byline (market Case tab):**
```html
<div class="byline">
  <span class="av">N</span>
  <div class="who">
    <div class="line1"><span class="name">Nina Ortega</span><span class="check">◉</span></div>
    <span class="pub">Corporate timing, weekly-ish · 48 claims · 65% drift</span>
  </div>
  <div class="actions">
    <button class="icon-btn">bookmark</button>
    <button class="icon-btn">share</button>
    <button class="sub-btn">+ Subscribe</button>
  </div>
</div>
```

**Compact byline (discussion tab, inbox card, etc.):**
```html
<div class="by">
  <span class="av-s">N</span>
  <span class="name">Nina Ortega</span>
  <span class="dot">·</span>
  <span class="pub">Corporate timing, weekly-ish</span>
  <span class="time">28m</span>
</div>
```

- `.name`: Inter 600, `--text`
- `.pub`: Fraunces italic, `.88rem`, `--text-3`
- `.check` (`◉`): tiny ink glyph to indicate verified/subscribed
- `.time`: JetBrains Mono, `.72rem`, `--text-3`

---

## Position badge

A standing-state indicator for users with a documented 983 position in a specific market. **Only appears in discussion replies on that market page.**

```html
<span class="holds y"><span class="label">holds</span>YES · $120</span>
<span class="holds n"><span class="label">holds</span>NO · $25</span>
```

```css
.reply-head .holds {
  font-family: 'JetBrains Mono', monospace;
  font-size: .78rem;
  letter-spacing: -.005em;
}
.reply-head .holds.y { color: var(--yes); }
.reply-head .holds.n { color: var(--no); }
.reply-head .holds .label { opacity: .7; margin-right: .15rem; }
```

**No border, no background.** It is inline colored text. Exposes side and dollar size. For observers (no position), the badge is absent — instead, the pub-line reads `· observer`.

## Author badge

For the market's author, shown alongside their replies.

```html
<span class="author-badge">Author</span>
```

```css
font-family: 'JetBrains Mono', monospace;
font-size: .58rem;
padding: .15rem .4rem;
border: 1px solid var(--ink);
color: var(--ink);
letter-spacing: .14em;
text-transform: uppercase;
border-radius: 999px;
```

One author per market, badge appears on every reply they make.

---

## Reply (discussion)

The canonical reply shape:

```html
<article class="thread">
  <div class="reply s-yes">             <!-- s-yes/s-no if user has position -->
    <span class="av av-J">J</span>
    <div class="reply-body">
      <div class="reply-head">
        <span class="name">Jules Henao</span>
        <span class="check">◉</span>
        <span class="pub">· Commentary, unstaked</span>
        <span class="holds y"><span class="label">holds</span>YES · $120</span>
        <span class="time">2h</span>
      </div>
      <!-- optional anchor-quote -->
      <blockquote class="anchor-quote">The signal, as I've said before...</blockquote>
      <!-- body (sans-serif) -->
      <div class="reply-text">
        <p>The eight-week pattern holds...</p>
      </div>
      <!-- actions -->
      <div class="reply-actions">
        <a>Reply</a><a>Restack</a><a>Save</a><a>Share</a>
      </div>
      <!-- optional nested children (one level) -->
      <div class="nested yes-branch">...</div>
      <div class="continue-thread">Continue thread · 1 more reply from @jules</div>
    </div>
  </div>
</article>
```

**Side stripe.** A 2px vertical line (`--yes-line` or `--no-line`) runs from just below the avatar down to the bottom of the reply block when the author has a side-leaning position. Observers don't get a stripe.

**Nested reply.** Indented 26px with a 2px left border in the side color of the branch. Only **one level** of nesting rendered by default. Deeper replies roll up into `Continue thread →`.

**Never** attach a stake to a reply. See [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).

---

## Compose

### Discussion compose (reply form)

```html
<form class="compose">
  <span class="av">pf</span>
  <div class="body">
    <textarea rows="2" placeholder="Add your view..."></textarea>
    <div class="controls">
      <div class="chips">
        <a>Quote a passage</a>
        <a>Link a market</a>
        <a>Image</a>
      </div>
      <button class="post-btn">Post reply</button>
    </div>
    <div class="hint">Replies are public and permanent. Want to take a position? Use the trade panel →</div>
  </div>
</form>
```

**No side picker. No stake input.** The Post button is "Post reply" — not "Reply & back YES."

### Home compose (note form)

Same shape, different placeholder: `"What's on your mind?"` or `"Propose a claim. The crowd will price it."`

Chips vary by context — a Home compose can offer "Add an image," "Link a market," "Attach a stake" (for notes that carry a stake disclosure). The Home compose is for *notes*, which may reference a market the user just traded on.

---

## Market embed (link preview)

Compact card used when a note, reply, or inbox entry references a market.

```html
<a class="market-embed" href="market.html">
  <span class="cat">AI</span>
  <h3>OpenAI will ship GPT-5 before Google ships Gemini 2 Pro.</h3>
  <div class="row">
    <span class="p">71¢ <span class="up">+3¢ 24h</span></span>
    <span>2,814 trades · 24 replies · $74K 30d</span>
  </div>
</a>
```

```css
.market-embed {
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: .8rem .95rem;
  display: grid; gap: .4rem;
}
.market-embed h3 {
  font-family: var(--serif);
  font-weight: 500;
  font-size: 1.08rem;
  color: var(--text);
}
.market-embed .p { color: var(--yes); font-size: .95rem; font-weight: 500; }
```

---

## Claim embed (new publication card)

Bigger than a market embed. Used when the feed item is *announcing* a new claim (a publication event).

```html
<a class="claim-embed" href="market.html">
  <span class="kicker">
    <span class="cat">Geopolitics</span>
    <span>New claim · seeded $500 YES</span>
    <span class="new-chip">New</span>
  </span>
  <h3>Taiwan holds a recognised national election...</h3>
  <p class="sub">The crowd has been holding this between 74¢ and 79¢ for six weeks...</p>
  <div class="row">
    <span class="p">77¢ YES · +2¢ 24h</span>
    <span>218 traders · 28 replies · $42K 30d</span>
  </div>
</a>
```

More padding (1.2rem 1.3rem), bigger h3 (1.45rem), includes a lede paragraph in serif.

---

## Rail card (right rail container)

The container for every right-rail section.

```html
<section class="rail-card">
  <header class="rail-card-head">
    <h3 class="tight">Up next</h3>
    <a href="#">See all</a>
  </header>
  <!-- up-items or similar rows -->
</section>
```

```css
.rail-card {
  border: 1px solid var(--border);
  border-radius: 16px;
  overflow: hidden;
}
.rail-card-head { padding: 1rem 1.1rem .3rem; }
.rail-card-head h3 { font: 700 1rem var(--tight); }
```

Max two rail-cards per page. Ever.

---

## Portrait card (`.pcard`)

The featured-rail card on the Markets page. Portrait orientation, image on top, content below.

```html
<a class="pcard" href="market.html">
  <div class="pcard-img" style="background: linear-gradient(...);">
    <svg>...optional motif...</svg>
  </div>
  <div class="pcard-body">
    <span class="pcard-eyebrow">
      <span class="cat">AI</span>
      <span class="sep">·</span>
      <span>35d</span>
    </span>
    <h4>OpenAI will ship GPT-5 before Google ships Gemini 2 Pro.</h4>
    <span class="pcard-author">@north · Corporate timing</span>
    <div class="pcard-meta">
      <span class="p">71¢</span>
      <span class="delta up">+3¢</span>
      <span class="dot">·</span>
      <span class="v">$8.2K</span>
    </div>
  </div>
</a>
```

**Dimensions:** 196px wide × ~340px tall. Image area uses `aspect-ratio: 4/5` (portrait).

**Image:**
- If the claim has an author-attached image, render it fitted `object-fit: cover`.
- Otherwise, render a category-appropriate gradient fallback with an optional SVG motif overlay at 25–30% opacity. Six gradient families are currently defined (amber, rust, sage, gold, mauve, slate); more can be added as categories expand.

**Body:**
- `.pcard-eyebrow` — mono .58rem, letter-spaced, uppercase. Category in accent emerald.
- `<h4>` — Fraunces 500, .98rem, line-height 1.22, 3-line clamp via `-webkit-line-clamp`.
- `.pcard-author` — mono .64rem, muted.
- `.pcard-meta` — mono .72rem, price + delta + dot + volume. Top border (hairline) separates from body.

**Scroller:**
```css
.rail-scroller {
  display: flex;
  gap: .85rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding: .2rem 2rem 1.2rem;
  margin: 0 -2rem;
}
.pcard { flex: 0 0 196px; scroll-snap-align: start; }
```

Cards snap to start when scrolling. On 720px center column, 3 cards visible + 4th peeking.

## Up-item (rail card row)

The row shape for *Moving today*, *Up next*, *Most contested*.

```html
<a class="up-item">
  <div>
    <div class="pub-line"><span class="cat">Crypto</span></div>
    <h4 class="serif">Solana flips Ethereum on monthly fees...</h4>
    <div class="mini-meta"><span class="p">41¢</span><span>+5¢</span><span>$3.9K</span></div>
  </div>
  <div class="up-thumb">
    <svg viewBox="0 0 72 56" preserveAspectRatio="none">
      <polyline class="line" points="..."/>
    </svg>
  </div>
</a>
```

- Title in Fraunces 500 (small — `.98rem`)
- Sparkline thumbnail on the right (`72×56px`, minimal)
- Mini-meta in mono `.66rem`

---

## Voice row (rail card row, people-oriented)

For "Who's in the thread" and similar.

```html
<a class="voice-row">
  <span class="av-s av-J">J</span>
  <div class="who">
    <span class="n">Jules Henao</span>
    <span class="stake-sub y">holds YES · $120</span>
  </div>
  <span class="p">2h</span>
</a>
```

Small avatar (28px), name, inline position text, timestamp.

---

## Trade tape row

Single-line mono row in the Recent Trades section.

```html
<div class="tape-row">
  <span class="t">2s</span>
  <span class="s y">Back YES</span>
  <span class="who">@tessa</span>
  <span class="p">$40 · 71¢</span>
</div>
```

Grid: `44px 100px 1fr auto`. All JetBrains Mono except the handle (Inter).

---

## Anchor quote

A serif italic quote that appears at the top of a reply when that reply is anchored to a specific passage in the case.

```html
<blockquote class="anchor-quote">
  The signal, as I've said before, is often in what isn't happening.
</blockquote>
```

```css
.anchor-quote {
  padding: .5rem 0 .5rem .85rem;
  border-left: 2px solid var(--border-strong);
  color: var(--text-3);
  font: italic 400 .92rem/1.45 var(--serif);
  max-width: 54ch;
}
.anchor-quote::before {
  content: 'In reply to ';
  display: block;
  font: 400 .72rem var(--sans);
  color: var(--text-4);
  letter-spacing: .02em;
  margin-bottom: .2rem;
}
```

---

## Price lockup (featured, on cards)

A big price + tilt label side by side.

```html
<div class="price-lockup">
  <span class="v">50¢</span>
  <span class="tilt">YES · opening</span>
</div>
```

```css
.v {
  font-family: 'JetBrains Mono', monospace;
  font-size: 2.3–3.4rem;
  color: var(--yes);
  line-height: .9;
  letter-spacing: -.025em;
  font-weight: 500;
}
.tilt {
  font-family: 'JetBrains Mono', monospace;
  font-size: .78rem;
  color: var(--yes);
  letter-spacing: .06em;
}
```

Used on: featured claim on Home/Markets, Case tab's post-meta row, author profile pinned claim.

---

## Sparkline thumbnail

Small SVG line chart, 72×56px, used in rail cards.

```html
<div class="up-thumb">
  <svg viewBox="0 0 72 56" preserveAspectRatio="none">
    <polyline class="line" points="0,42 9,38 18,36 27,32 36,30 45,28 54,24 63,20 72,16"/>
    <circle cx="72" cy="16" r="2" fill="#3ec48a"/>
  </svg>
</div>
```

```css
.up-thumb {
  width: 72px; height: 56px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
}
.up-thumb .line { fill: none; stroke: var(--yes); stroke-width: 1.2; }
.up-thumb .line.no { stroke: var(--no); }
```

The last point gets a 2px-radius filled dot. No axis labels. Pure shape.

---

## Split bar (discussion composition)

The horizontal bar at the top of the Discussion tab showing YES/NO/observer composition of repliers.

```html
<div class="split-bar">
  <div class="labels">
    <span class="y-label">14 repliers hold YES</span>
    <span class="n-label">5 repliers hold NO</span>
  </div>
  <div class="bar">
    <span class="y" style="width: 58%"></span>
    <span class="n" style="width: 21%"></span>
  </div>
  <div class="sub">5 observers (no position) · market crowd price stands at 71¢ YES</div>
</div>
```

Inline on the Discussion tab only. Not used elsewhere.

---

## What to remember

- Everything here is a *shared* primitive — reused across pages. If a page needs something new, it's a signal the design is wrong (see [principle #10](./02-design-principles.md)).
- Every border radius, type size, and color here is deliberate. Changes to this document require a design review.

## Next

- [30 — Navigation & chrome](./30-navigation-and-chrome.md)
- [31 — Discussion architecture](./31-discussion-architecture.md)
