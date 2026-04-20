# 91 — Open Questions & Roadmap

What's not yet decided. What's explicitly next. Things we've deliberately deferred.

---

## Pages not yet designed in The Column voice

These exist in older directions (H-the-study, etc.) but haven't been rebuilt in The Column's visual language.

### ~~Profile / publication page~~ — designed

**Status:** Designed. See [45-page-profile.md](./45-page-profile.md).

The earlier "writer's publication view" framing was rejected during design. Cascade users are not writers, so the profile is a **person's page**, not a publication: activity-led, identity above as a thin band, Open positions in the right rail. No follower count, no drift stat, no italic Fraunces bio. The original prior art (`H-the-study/04-profile.html`) is documented as rejected in the spec.

Implementation pending — the page also introduces a cross-cutting **linkable-identity rule**: every avatar and name in the app must link to the canonical `/p/<nip05>` (or `/p/<npub>` if no NIP-05 is declared).

### Activity (notifications)

**What's missing:** A consolidated view of "things that happened to you" — replies to your claims, mentions, subscriptions to your publication, big moves on markets you hold.

**Requirements:**
- Similar in shape to Subscriptions (reading-first)
- Grouped by type or chronological
- Unread state per item

### Portfolio

**What's missing:** Your positions, balance, and P&L over time, in The Column's voice.

**Requirements:**
- Center-column list of open positions (compact claim-row treatment — same as Markets)
- Right-rail summary: total value, today's P&L, cash balance
- Sort: value · P&L · recency
- Transparent public view option (others can see your positions if you allow)

### Bookmarks

**What's missing:** A view of saved content.

**Requirements:**
- Simple chronological list of saved items (claims, notes, replies)
- Group by type via sub-tabs

### Trades tab (inside market page)

**What's missing:** A full trade tape with filtering.

**Requirements:**
- Time range selector (24h / 7d / 30d / all)
- Side filter (YES / NO)
- Aggregate metrics above the tape (volume, unique traders, avg size)
- Tape itself is the compact mono row pattern from the Case tab, just more of them

### Linked tab (inside market page)

**What's missing:** A detailed view of linked markets.

**Requirements:**
- Full preview cards for each linked market (not just a compact list)
- Clearly marked as "informational only" — links don't move prices
- Cross-reply preview showing discussions that span multiple linked markets

---

## Mobile design

**Status:** Not yet fully designed for The Column.

**Prior art:** `G-the-feed/` is a mobile-native direction that was approved as *the right answer for mobile* but not as the primary product direction. The Column needs a mobile adaptation that *inherits* G's gestures (hold-to-commit, bottom-sheet compose) while staying visually consistent with desktop Column.

**Blockers:**
- Decide whether mobile uses a dedicated set of layouts or reflows The Column's desktop patterns.
- Decide the hamburger vs. bottom-nav pattern for primary navigation on narrow viewports.

**Target:** Design by end of Q2 2026.

---

## Interaction decisions pending

### Should the view tabs (Case/Discussion/Trades/Linked) be sticky?

**Currently:** They scroll with the document.

**Argument for sticky:** On long cases or long discussions, the tabs aren't reachable without scrolling back.

**Argument against:** Adds a stacked sticky element (rail + right-rail + tabs) which fragments the viewport.

**Decision:** TBD. Probably: sticky-on-Discussion, not-sticky-on-Case (Discussion is longer, and tab reachability matters more there).

### Keyboard shortcuts beyond ⌘K

Power users will want:
- `j / k` — next/previous feed item
- `r` — reply
- `s` — save
- `?` — show help

None are implemented. Need product input on scope.

### The "New posts" pill at the top of feeds

**What:** When new items arrive while the user is scrolled down, a small *"3 new posts · click to update"* pill appears at the top. Clicking inserts them and scrolls to top.

**Status:** Specified as an interaction principle but no visual design yet.

### Anchor-to-passage composer

**What:** When a user highlights text in a case and clicks "Reply to this," the reply compose opens with the anchor quote pre-filled.

**Status:** Specified in [31-discussion-architecture.md](./31-discussion-architecture.md) but no interaction design — does it open a modal? An inline drawer? Navigate to Discussion tab?

**Tentative:** Navigate to the Discussion tab with the compose focused and the anchor attached.

### Restack interaction

**What:** Clicking "Restack" on a reply or note initiates a restack. But what's the UI?

**Options:**
1. A modal compose with the original quoted below and a textarea for your sentence.
2. An inline drawer below the original item.
3. Navigate to Home with the compose pre-filled with the quoted content.

**Tentative:** Option 3 feels most Substack-native.

---

## Visual decisions pending

### Should observer replies show any marker at all?

**Currently:** `· observer` appears inline in the pub-line. No badge.

**Alternative:** Show a muted `observer` chip like we show position badges, just in `--text-3`. This would create visual parity (every reply has a badge).

**Concern:** Adds chrome. The current inline text is calmer.

### Should the right-rail trade module be more prominent?

**Currently:** Matches other rail-card styling. Subtle.

**Alternative:** Slight ink accent on the Back YES button (it uses the primary-CTA style right now, which is warm ink). Perhaps too subtle for a money action.

**Decision:** Watch usage. If users miss it, elevate visually.

### Do we need a "market summary" sparkline at the top of the market page?

**Currently:** The post-meta row is text-only (`71¢ YES · +3¢ · ...`).

**Alternative:** Add a small sparkline alongside it.

**Concern:** Violates the "sparklines only in right rail" heuristic. But the market page is not a list — it's *the* page about this market, so a primary chart may earn its place.

**Decision:** Deferred. Watch if users ask for it.

### Case revision diff UI

**What:** When the case changes from rev 2 to rev 3, what does the reader see?

**Options:**
1. A "rev 3" label on the case, no diff.
2. A toggle to see "what changed" with added/removed highlighted.
3. A separate "Revisions" sub-tab showing the history.

**Tentative:** Option 1 for now (simplicity). Option 3 later.

---

## Product decisions that affect UX

### The "practice" edition switch

Cascade has a Practice edition (signet, paper money) and Live (mainnet, real money). How is the switch rendered in The Column?

**Currently:** A tiny `· Practice` label under the Cascade wordmark.

**Open:** Should it be more prominent? A toggle in "More" menu? Different chrome in Practice (e.g., a subtle warning stripe)?

### Subscriptions: free vs. paid

The launch contract says free subscriptions. If paid tiers are added later, the Subscribe button and publication page need a second state (subscribed-free vs. subscribed-paid).

### Author identity reveal

Some Cascade authors may want to publish pseudonymously. How does the handle→name mapping work? What does a user-without-a-display-name look like (just `@handle`)?

**Currently:** Mocks show both a display name (*"Nina Ortega"*) and a handle (*"@north"*). Real Nostr users may have only a handle.

**Decision pending:** fall back to handle as the display name, render identically.

---

## Technical prerequisites blocking UX

- **Position derivation (983 events) service**: needed for the position-badge feature on every reply. Backend needs to support efficient querying of "user X's position in market Y." Currently unclear if this is indexed.
- **Hot-thread detection**: a "hot thread" feed item (type 10 in [33-feed-items.md](./33-feed-items.md)) requires a service that identifies controversial / high-activity threads. Not yet built.
- **Anchor-to-passage indexing**: mapping reply events to specific sentences in case revisions requires a stable reference scheme. TBD with the protocol team.

---

## What's been explicitly rejected

Don't re-propose these. See [51-anti-patterns.md](./51-anti-patterns.md).

- The Terminal / Bloomberg-shape UI
- The Gazette / newspaper costume
- The Trace / data-first Tufte minimalism
- The Floor / Twitter-chrome social feed
- Combined expression+transaction compose
- Per-reply stake chips
- Pill chips on any filter/sort UI
- Data grid on Markets
- Likes / upvotes / reactions
- Category-specific chrome

---

## Where to go next

- If you want to start designing mobile: build on [`G-the-feed/`](../../proposals/agency-2026-04/G-the-feed/01-landing.html) but keep the type and color system from The Column.
- If you want to build Profile: start from `H-the-study/04-profile.html` and reapply The Column's visual system.
- If you want to build Create: it's done — [44-page-create.md](./44-page-create.md) + `K-the-column/06-create.html` + `K-the-column/07-create-published.html`. Ready for engineering.
- If you want to ship The Column: implement the daisyUI migration from [`docs/plan/2026-04-18-daisyui-everywhere.md`](../plan/2026-04-18-daisyui-everywhere.md) first.

## Related

- [90 — File reference](./90-file-reference.md)
- [51 — Anti-patterns](./51-anti-patterns.md)
