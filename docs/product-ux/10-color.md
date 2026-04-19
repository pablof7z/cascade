# 10 — Color

Cascade's palette is deliberately narrow. Neutrals carry almost everything. The accent colors are semantic — they mean something specific.

---

## Tokens

```css
:root {
  /* Surfaces — warm-leaning dark */
  --bg:             #0b0a09;  /* page background */
  --surface:        #13120f;  /* input backgrounds, compose box, rail-card bg on hover */
  --elev:           #1a1814;  /* elevated surface (rarely used) */

  /* Borders */
  --border:         #1c1b17;  /* standard hairlines */
  --border-strong:  #2a2822;  /* emphasized borders (card outlines, button outlines) */

  /* Text scale */
  --text:           #ece7dc;  /* primary text */
  --text-2:         #8a8678;  /* secondary text, muted */
  --text-3:         #5c5849;  /* tertiary, metadata, labels */
  --text-4:         #3a362d;  /* quaternary, separators, placeholder */

  /* Semantic accents — the only accent colors in the product */
  --yes:            #3ec48a;  /* YES side, upward movement, positive P&L */
  --yes-dim:        rgba(62,196,138,.12);  /* YES tint for backgrounds */
  --yes-line:       rgba(62,196,138,.45);  /* YES thread-line color */

  --no:             #e85d7a;  /* NO side, downward movement, negative P&L */
  --no-dim:         rgba(232,93,122,.12);
  --no-line:        rgba(232,93,122,.45);

  /* Warm ink — the one non-semantic accent */
  --ink:            #efe7d3;  /* wordmark, primary CTAs, pub names, title hover */
}
```

---

## Surfaces

The background has a subtle warm hue (not pure black, not cool). This is on purpose: it makes the serif type feel like it's printed on paper, not projected onto a screen.

| Token | Hex | Where it shows up |
|---|---|---|
| `--bg` | `#0b0a09` | Page background, rail, topbar |
| `--surface` | `#13120f` | Compose box, search input, rail-item hover, row hover |
| `--elev` | `#1a1814` | Used sparingly; e.g., stat-card surface if elevation needed |

Never introduce a fourth surface tier. If something feels like it needs to "stand out more," it needs a border, not a new surface color.

## Borders

Two tiers:

| Token | Use |
|---|---|
| `--border` `#1c1b17` | Standard hairlines: row separators, rail dividers, card edges. ~99% of the time. |
| `--border-strong` `#2a2822` | Emphasized edges: button outlines, input borders, card outlines, active tab underlines (for non-ink). |

Dashed borders use `--border-strong` and appear in one place only: the reply byline's sign-off line and the anchor-quote in replies.

## Text

Four tiers. Don't use opacity to fake levels — use the token.

| Token | Role | Example |
|---|---|---|
| `--text` `#ece7dc` | Primary: claim titles, reply body, author names, values | "OpenAI will ship GPT-5..." |
| `--text-2` `#8a8678` | Secondary: case body paragraphs, excerpt text | The lede under a claim in the inbox |
| `--text-3` `#5c5849` | Tertiary: metadata, labels, captions | "2,814 trades · 318 traders" |
| `--text-4` `#3a362d` | Quaternary: separators (`·`), disabled, placeholder | The `·` between metadata items |

## Semantic accents — emerald & rose

These have meaning. Never use them decoratively.

**Emerald `#3ec48a`** means **YES / positive / upward.**
- Used on: YES prices, positive deltas (`+3¢`), YES position badges (`YES · $120`), the "Back YES" button, YES stake-chip backgrounds (`--yes-dim`), thread-line color on YES-branch nested replies (`--yes-line`).

**Rose `#e85d7a`** means **NO / negative / downward.**
- Used on: NO prices, negative deltas (`−4¢`), NO position badges, the "Back NO" button, NO stake-chip backgrounds, NO thread-line color.

**Dim variants (`--yes-dim`, `--no-dim`)** are used for:
- Selected-state backgrounds on the side-toggle buttons
- Subtle left-accent on featured-claim rows when needed
- Nothing else

**Line variants (`--yes-line`, `--no-line`)** are used for:
- The 2px left-border on nested-reply branches (YES-branch is emerald-tinted, NO-branch is rose-tinted)
- The 2px stripe next to avatar on top-level replies, indicating the replier's position side

Never use emerald or rose for: chart decoration, icon fills that aren't price-semantic, button accents that aren't trade actions, category labels (except the subtle eyebrow color).

## Warm ink — the one non-semantic accent

`--ink: #efe7d3;`

A warm off-white. Used deliberately in these exact places and nowhere else:

| Use | Example |
|---|---|
| Wordmark background | The `C` logo square in the rail |
| Cascade wordmark | "Cascade" in the rail when labels are visible |
| Primary CTAs | "＋ Publish a claim" in the rail, "Subscribe" buttons, "Post reply" button |
| Author publication names | *"Corporate timing, weekly-ish"* in italic Fraunces |
| Title hover color | Claim titles become `--ink` on hover |
| Active tab underline | View tabs (`Case`, `Discussion`...) use ink on active |
| Active rail item | Current page name color |
| Unread count badges | `6` next to "Subscriptions" |
| "New" chip | On a just-published claim |
| Author badge | "Author" pill in replies |
| Anchor-quote marker | The `4 replies ↓` marker in the margin next to anchored case text |
| Strong text in reply bodies | `<strong>` inside a reply body uses `--ink` |

Never used on: chrome borders, chart lines (those stay emerald/rose/neutral), body text, metadata.

## The eyebrow green

Category eyebrows use the emerald `--yes` color:

```html
<span class="eyebrow">
  <span class="cat">AI</span>
  <span class="sep">·</span>
  <span>Corporate timing</span>
</span>
```

Where `.cat` is emerald. This is the *one* place emerald appears outside YES-semantic contexts. It's a soft brand cue — the "Cascade green" — and has been accepted across all pages.

---

## Mode (dark only)

Launch is dark-only. No light mode in the contract. If/when we add light mode, the palette inverts across the same tokens — no new tokens.

---

## Forbidden

Never introduce:

- A blue accent (Cascade's historical brand rule — no blue-tinted neutrals)
- Orange, yellow, purple, cyan (would break palette restraint)
- Pure black (`#000`) — use `--bg`
- Pure white (`#fff`) — use `--text` or `--ink`
- Rainbow charts, gradient fills on data, color-coded categories
- Warm ink on body text (it's reserved — overexposure devalues it)
- Emerald or rose on anything that isn't price/side semantics

See [51-anti-patterns.md](./51-anti-patterns.md).

## Next

- [11 — Typography](./11-typography.md)
