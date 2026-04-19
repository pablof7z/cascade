# 41 — Page: Subscriptions

The reading digest. A calm, two-column page dedicated to long-form content from the writers you subscribe to.

**Reference mock:** `proposals/agency-2026-04/K-the-column/02-subscriptions.html`

---

## Purpose

*"What did the writers I follow actually publish?"*

Subscriptions only contains two content types:

1. **New claims** from subscribed writers
2. **Case revisions** on claims from subscribed writers

It explicitly does **not** contain: notes, trade alerts, hot threads, restacks. Those live on Home.

The distinction is deliberate. Home is fast and varied; Subscriptions is slow and focused. This is Substack's Inbox, not Substack's Home.

---

## Composition

**Two-column shell.** Subscriptions is the one page in The Column that drops the right rail entirely.

```css
.app {
  grid-template-columns: 200px minmax(0, 1fr);
  max-width: 1080px;
}
```

The center column is narrower (effective ~840px max) to make reading comfortable. No right-rail context — the page is purely reading.

### Page header

```
Subscriptions
Claims from the writers you subscribe to. Long-form only — notes, trades, 
and replies live on Home.

14 subscriptions · 6 unread this week · 4 case revisions on claims you hold

[Unread 6] [All] [Case revisions 4] [Saved 12]          [Mark all read]
```

- `<h1>Subscriptions</h1>` in serif, 2.4rem
- Summary line in mono, small, muted
- Sub-tabs: `Unread · All · Case revisions · Saved` — text-only underline-on-active. See [20-components.md#text-tabs](./20-components.md).
- `Mark all read` button — secondary (ghost) style, top right

### Time-grouped feed

Items are grouped by time:

- **Today · Saturday, 18 April** · 2 new
- **This week** · 3 new
- **Earlier in April** · 1 from subscriptions

Group labels are mono, `.64rem`, uppercase, letter-spacing `.18em`. They demarcate reading rhythm.

### Inbox card

Each card is a single reading-shaped row:

```html
<article class="item unread">
  <span class="av av-G">G</span>
  <div class="body">
    <div class="by">
      <span class="name">Greta Maddox</span>
      <span class="dot">·</span>
      <span class="pub">Bitcoin, macro &amp; their entanglements</span>
      <span class="time">4h</span>
    </div>
    <div class="kicker">
      <span class="cat">Crypto</span>
      <span class="sep">·</span>
      <span>New claim, seeded $500 YES</span>
    </div>
    <h2 class="title">Bitcoin trades above $150,000 at any point before 1 July 2026.</h2>
    <p class="excerpt">A market on a single print before mid-year, not a sustained level...</p>
    <div class="foot">
      <span class="price">50¢<small>YES · opening</small></span>
      <span class="divider">·</span>
      <a class="read" href="market.html">Read the case →</a>
      <a href="#">Save</a>
      <span class="time-read">3 min</span>
    </div>
  </div>
</article>
```

- **Byline** — name, publication tagline (italic Fraunces), time
- **Kicker** — category + event type (new claim / case revision)
- **Title** — serif, 1.9rem, the main anchor
- **Excerpt** — serif, 1.08rem, 1–2 sentences max
- **Foot** — inline mono price + read link + save + read-time estimate

### Read / unread state

- **Unread:** full color. A 5px ink dot appears in the left gutter (`::before`).
- **Read:** `opacity: 0.55;` — dimmed but still readable. No "mark as read" button per item.

Visiting the market page marks the item read automatically.

### Case revisions

On the "Case revisions" sub-tab (or mixed into "All"), items render with a distinct kicker tone:

```
CATEGORY · Case revision — rev 3 on a claim you hold
```

The `.kicker .update` span uses `--ink` color to signal the specificity. The title is the same claim title. The excerpt shows the *diff* or the new paragraph (not the full revised case).

---

## No right rail

This is the only page in The Column without a right rail. Reasons:

1. **Reading is the posture.** Right-rail noise competes with the content.
2. **Subscriptions are already chosen.** No "Writers to subscribe" card is needed — the user has chosen their list.
3. **No trade module.** Trading happens on market pages; a right-rail trade module here would be context-free (which market?).

---

## Empty state

For users with no subscriptions:

*"You're not subscribed to any writers yet. Writers publish claims, revise their cases, and build a public record — subscribe to one, and their dispatches show up here."*

With a call to action: *"Discover writers →"* (goes to an Explore/Writers page, not yet built).

For users with subscriptions but no unread items:

*"Caught up. Next dispatch will show up here."* (Centered, muted, with a subtle "All" tab link.)

---

## Copy rules

- **"Inbox"** is not used as a label (too email-y). The page is titled *Subscriptions*.
- **"Dispatch"** as a noun for a claim + case is allowed but optional. Some editions of the UI use "claim" exclusively.
- **"Read the case →"** not "Read more →" — Cascade's specific vocabulary for the author's argument.
- **"Revisit"** for items the user has read before.

---

## Interaction notes

- **Clicking an item** navigates to the market page (Case tab by default).
- **"Read the case →" link** does the same as clicking the card.
- **"Save"** bookmarks the claim.
- **Hover on the title** changes color to `--ink`.

## Related

- [40 — Page: Home](./40-page-home.md)
- [42 — Page: Markets](./42-page-markets.md) — the category-filter browse view.
