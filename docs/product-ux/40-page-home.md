# 40 — Page: Home

The default landing surface for logged-in users. The mixed feed.

**Reference mock:** `proposals/agency-2026-04/K-the-column/01-landing.html`

---

## Purpose

*"What's happening in my graph right now?"*

Home mixes content types — notes, new claims, trade alerts, case revisions, cash-outs, hot threads — into a single chronological stream sourced from the user's **subscriptions + follows + watchlist + held positions**. It's fast-moving, heterogeneous, and non-exhaustive.

Home is **not:**
- A full list of everything Cascade has (that's Markets).
- A reading inbox of publications-only (that's Subscriptions).

---

## Composition

Standard three-column shell. See [12-layout-and-space.md](./12-layout-and-space.md).

### Center column (max 720px)

1. **Compose box** at the top — pinned, always visible.
2. **Filter + view switch:** `For you ⌄` dropdown + `All · Notes · Publications` text tabs on the right.
3. **Feed stream** — heterogeneous items. See [33-feed-items.md](./33-feed-items.md) for all types.
4. **Load more** footer.

### Compose box

The compose invites a **Note**. It does not invite a claim — that's the rail CTA. It does not invite a reply — those live on market pages.

```
┌─────────────────────────────────────────┐
│  [avatar]  What's on your mind?         │
│                                          │
│            [textarea]                    │
│                                          │
│  [＋ image] [🔗 market] [＄ stake]   [Post]│
└─────────────────────────────────────────┘
```

- Placeholder: `"What's on your mind?"`
- Chips (secondary actions): `Add an image`, `Link a market`, `Attach a stake`
- Post button: muted outline style (not primary ink). Primary ink is reserved for the rail CTA (publishing a claim).

**"Attach a stake" chip:** opens a compact trade widget that places the trade *and* attaches a disclosure chip to the resulting Note. See [33-feed-items.md#the-stake-chip](./33-feed-items.md) — this is the sanctioned touch-point.

### Right rail

Two cards. Both use `rail-card` + `up-item` structure.

**Up next** — claims from subscribed writers you haven't read yet. Three items max. Sparkline thumbnails.

**Writers to subscribe** — five numbered suggestions. Warm-ink Subscribe buttons. See [20-components.md#best-item](./20-components.md).

### Footer

Compact link list: `About · How it works · Brand voice · Terms · Privacy · · Cascade 2026`. Small mono, muted.

---

## The feed filtering

The `For you ⌄` dropdown opens options:

- **For you** (default) — algorithm-ranked mix
- **Following** — only from users you follow
- **Subscribed** — only from writers you subscribe to
- **Watchlist** — only from markets in your watchlist

The `All · Notes · Publications` switch is orthogonal — filters by item type:

- **All** — every type
- **Notes** — Types 1, 2, 5, 6, 7, 9 from [33-feed-items.md](./33-feed-items.md)
- **Publications** — Type 4 only (new claims)

---

## Empty state

For new users with no follows/subscriptions yet:

*"You're not following anyone yet. Subscribe to a writer to start getting claims in your inbox, or head to Markets to see what's live."*

Accompanied by a 3-writer suggestion stack (same shape as the right-rail "Writers to subscribe" card).

---

## Copy rules

- "What's on your mind?" (compose placeholder) — Substack-direct, first-person-friendly
- "For you" (filter) — no "algorithm" language
- "Publish a claim" (rail CTA) — not "Create" or "New market"
- Post button is just `Post` — no "share," no "send"

---

## Interaction notes

- **Scrolling inserts new items** only when the user is scrolled to the top; otherwise a small "*N new posts · click to update*" pill appears above the fold.
- **Clicking a feed item's avatar or name** navigates to the author's profile.
- **Clicking a feed item's market embed** navigates to the market page (Case tab).
- **Clicking "Reply" on a feed item** navigates to the market's Discussion tab with the compose focused.
- **"Back YES" action in feed items** navigates to the market page with the trade module pre-filled. Never executes a trade inline.

## Related

- [33 — Feed items](./33-feed-items.md)
- [20 — Components](./20-components.md)
