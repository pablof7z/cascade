# 11 — Typography

Four font families, each with a specific role. Serif is the most important rule in the whole system — violate it and the product loses its posture.

---

## Families

```css
:root {
  --sans:   'Inter', system-ui, sans-serif;           /* default, UI */
  --tight:  'Inter Tight', 'Inter', sans-serif;       /* display sans for section heads */
  --serif:  'Fraunces', 'Source Serif 4', Georgia, serif;  /* the argument */
  --mono:   'JetBrains Mono', ui-monospace, monospace;     /* numbers */
}
```

Loaded from Google Fonts. Weights used: 300, 400, 500, 600, 700.

## Family roles — the central rule

| Family | Use | Never use on |
|---|---|---|
| **Fraunces (serif)** | Claim titles, case body, anchor quotes, publication names (italic only), wordmark | Chrome, nav, tabs, buttons, metadata, reply bodies, comment bodies |
| **Inter (sans)** | UI chrome, nav, buttons, forms, reply bodies, note bodies, breadcrumbs, labels | Claim titles, case body |
| **Inter Tight** | Section headers (h2 on pages), heading that's display-y but not editorial | Everything else — use Inter |
| **JetBrains Mono** | Prices, stats, timestamps, kbd shortcuts, position badges, tabular data, log lines, crumbs | Body text, titles |

**The central rule:** *Serif marks argumentative writing. Sans-serif marks everything else.* Reply bodies are sans-serif because they are expression, not publication. A reply is closer to a tweet than to an op-ed — even when it's long.

If you're about to set reply bodies in serif: stop. Read [principle 2](./02-design-principles.md).

## Type scale

We don't use a rigid scale because the content range is wide (compact tabs vs. huge lead titles). Instead, use these reference sizes based on role:

### Claim titles

- **Featured claim on Home (inbox card):** `font: 500 1.9rem/1.1 var(--serif); letter-spacing: -.022em;`
- **Market page H1 (case tab):** `font: 500 clamp(2rem, 3.5vw, 2.8rem)/1.08 var(--serif); letter-spacing: -.025em;`
- **Market page H1 (discussion tab, compact):** `font: 500 1.7rem/1.15 var(--serif); letter-spacing: -.018em;`
- **Inbox card title (Subscriptions):** same as featured — 1.9rem.
- **Markets list item title:** `font: 500 1.6rem/1.15 var(--serif);` (slightly smaller, denser list).
- **Lead item on Markets:** `font: 500 2.2rem/1.1 var(--serif);` (featured treatment).
- **Author profile pinned claim:** `font: 500 clamp(1.8rem, 3vw, 2.4rem)/1.1 var(--serif);`

All claim titles: `max-width: 22–28ch;` — to force line breaks where a serif sentence reads well.

### Case body (serif prose)

- Paragraph: `font: 500 1.14rem/1.7 var(--serif); max-width: 56ch;`
- Drop cap (first paragraph `::first-letter`): `font-size: 3.5rem; color: var(--ink);`
- Blockquote: `font: italic 400 1.25rem/1.5 var(--serif); border-left: 2px solid var(--yes); max-width: 52ch;`
- Strong: `font-weight: 600; color: var(--ink);`

### Anchor quote (serif italic)

A quote from the case, embedded inside a reply:
```css
font: italic 400 .92rem/1.45 var(--serif);
color: var(--text-3);
padding-left: .85rem;
border-left: 2px solid var(--border-strong);
max-width: 54ch;
```

### Reply body / note body (sans-serif)

- `font: 400 .98rem/1.6 var(--sans); max-width: 58ch;`
- `strong`: `font-weight: 600; color: var(--ink);`
- `em`: `font-style: italic; color: var(--text);`

### Chrome (UI)

- **Nav rail items:** `font: 400 1rem var(--sans);` (600 when active)
- **Topbar/breadcrumb:** `font: 400 .72rem var(--mono); letter-spacing: .06em;`
- **Tabs:** `font: 500 .9rem var(--sans);` (500, no bold)
- **Buttons (primary):** `font: 600 .88–.95rem var(--sans); letter-spacing: -.005em;`
- **Section H3 (card heads):** `font: 700 1.05rem var(--tight); letter-spacing: -.015em;`
- **Eyebrows:** `font: 400 .72rem var(--mono); letter-spacing: .14em; text-transform: uppercase;`

### Metadata (mono)

- **Inline meta (`71¢ YES · +3¢`):** `font: 400 .78rem var(--mono); letter-spacing: .02em;`
- **Prices on cards:** `font: 500 .9–1.2rem var(--mono); letter-spacing: -.01em;`
- **Big display price (lockup):** `font: 500 2.3–3.4rem var(--mono); line-height: .9; letter-spacing: -.025em;`
- **Timestamps in rails:** `font: 400 .72rem var(--mono); letter-spacing: .04em;`
- **Position badges (`YES · $120`):** `font: 400 .78rem var(--mono); letter-spacing: -.005em;`

### Italic Fraunces — publication names

```css
font: italic 400 .88rem/1 var(--serif);
color: var(--text-3);  /* in byline */
color: var(--ink);      /* in some author cards */
letter-spacing: -.005em;
```

This is the one italic-serif use case. *"Corporate timing, weekly-ish"* in the byline. Gives the publication a feel of *flavour text* — something closer to a tagline than a credential.

---

## Line-height discipline

| Context | Line-height |
|---|---|
| Claim title | 1.08–1.15 |
| Case body paragraph | 1.7 |
| Reply body (sans) | 1.6 |
| Eyebrow / tab / nav | 1.4–1.5 |
| Mono prices / meta | 0.9 (big) to 1 (inline) |

Prose gets room; chrome gets tightness. Never mix them up.

---

## Letter-spacing

- **Serif titles:** `-.02em to -.03em` (tight — tightens the Fraunces forms)
- **Sans display:** `-.02em` (Inter Tight can carry tight tracking)
- **Body sans:** `0 to -.005em` (barely-tight, readability priority)
- **Uppercase mono eyebrows:** `.14–.18em` (open — uppercase needs breathing)
- **Regular mono (prices):** `-.005em to -.01em` (very slightly tight)

---

## Italic

Italic is reserved for:
- Blockquotes in the case (italic Fraunces, ink color)
- Anchor-quote in replies (italic Fraunces, muted)
- Publication names in bylines (italic Fraunces)
- `<em>` in prose (both reply bodies and case bodies)

Never use italic for emphasis in chrome. Use `<strong>` + ink color.

---

## What's allowed in a reply body

A reply is short-to-medium sans-serif prose. Inside it:
- `<strong>` → `color: var(--ink); font-weight: 600;`
- `<em>` → italic Inter, inherits color
- `<p>` → separator
- Links → inherit, underline on hover
- Inline code → JetBrains Mono at 0.92em

No headings inside replies. No blockquotes inside replies (the anchor-quote is a separate block above the reply).

---

## Numerals

JetBrains Mono with tabular numerals:

```css
.mono {
  font-family: var(--mono);
  font-feature-settings: 'tnum' 1;
  letter-spacing: -.01em;
}
```

All prices, deltas, volumes, timestamps, counts, P&L numbers use `tnum` so columns align.

## Next

- [12 — Layout & space](./12-layout-and-space.md)
- [13 — Motion & interaction](./13-motion-and-interaction.md)
