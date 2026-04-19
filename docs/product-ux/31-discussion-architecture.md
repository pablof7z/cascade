# 31 — Discussion Architecture

How arguments happen on Cascade. This is the product's richest interaction — get it wrong and the whole thing feels like either Twitter or Reddit, both of which we explicitly aren't.

The companion doc is [32-expression-vs-transaction.md](./32-expression-vs-transaction.md) — read that first if you haven't.

---

## The frame

A Cascade discussion is a public thread of replies attached to a specific claim. Everyone can post. Money isn't required — but money changes how you're rendered.

The product's job:

1. Let long-form arguments and short reactions coexist without the latter flooding the former.
2. Make the *sides* of the debate visible at a glance.
3. Make *who has money on which side* visible without making the discussion a market.
4. Allow branching (reply-to-reply) without drowning in depth.
5. Anchor specific points of disagreement to specific passages in the case.

---

## The reply as a primitive

See [03-product-primitives.md#reply](./03-product-primitives.md).

Every reply has:
- An author
- A body (sans-serif, 1–4 paragraphs typical)
- A timestamp
- Optional: an anchor (a quote from the case that this reply responds to)
- Optional: a parent reply (one level of nesting)

A reply **does not have** a stake. See [principle #3 and #4](./02-design-principles.md).

---

## Position badge

Derived from 983 events, not from the reply.

**What it is:** A small inline indicator next to the replier's name showing their current position in the market.

**Visual:** `holds YES · $120` in emerald, `holds NO · $25` in rose. JetBrains Mono, `.78rem`. No border, no background — just colored text.

**Where it comes from:** Query the user's 983 events where `E` tags include this market's id and `p` tags include the user. Sum YES shares minus YES cash-outs; same for NO. If non-zero, render the badge with the dollar value at current market price.

**For observers (no position):** No badge. Instead, the pub-line reads `· observer`.

**For the market's author:** The position badge appears alongside the `Author` badge. The author may hold any amount of YES or NO (or none); all three are valid and all are rendered transparently.

---

## Threading model

We chose **1 level of nesting rendered by default**, with a "Continue thread →" affordance for deeper replies. This is the Hacker News / Substack compromise — deep enough for branching, shallow enough to stay readable.

**Render rules:**

- Level 0 — top-level reply. Full-width, 40px avatar, can be long-form.
- Level 1 — reply to a top-level reply. Indented 26px, 30px avatar, max-width narrower.
- Level 2+ — collapsed into `Continue thread → · N more replies`.

Clicking "Continue thread" navigates to a focused view of that sub-thread, where level 1 in that view becomes the new top-level (and its children become level 1, etc.). Recursive.

**Never** render level 2+ inline — Reddit's deep nesting is unreadable at scroll. Keep discussions legible.

### Side stripes

A 2px vertical line runs down the left of each reply block, colored by the replier's *side position*:

- Emerald (`--yes-line`) if they hold YES
- Rose (`--no-line`) if they hold NO
- No stripe if they're an observer

This makes the thread's composition scannable — a thread with lots of emerald stripes is a YES-leaning thread.

**Nested thread border:** The 2px left-border on `.nested` inherits the side color of the nested branch. A NO child under a YES parent gets a rose branch border. It's a visual breadcrumb: the branch *inherits the side of the replier who spawned it*.

---

## Sort tabs

Four sort modes. Text tabs, underline-on-active.

| Sort | Behavior |
|---|---|
| **Top** (default) | Ranked by a hybrid signal: number of direct replies × restacks × recency decay. Not upvotes (none exist), not stake-on-reply (doesn't exist). |
| **Newest** | Reverse chronological. Top-level only; children stay in their parent's thread. |
| **Controversial** | Prioritize top-level replies whose children are split between sides (YES children on a NO parent, or vice versa). Debate density. |
| **Holders only** | Filter: show only replies from users with a documented 983 position in the market. Hides observer replies entirely. |

These are *sort tabs*, not filters stacked on top of sort. In practice that means "Holders only" is a filtered view, not combined with "Top stake" (which doesn't exist). Simplicity wins.

---

## Anchored replies

Any sentence in the case can be highlighted and replied to. The reply is then "anchored" to that passage.

**Author's experience (writer):** No action required — their case is published as-is.

**Reader's experience:** Selecting text in the case body offers a "Reply to this →" action. The reply opens with the selected text pre-filled as the anchor quote.

**Rendering in the case:** Anchored passages get subtle styling and a marker:

```css
.case .anchored {
  background: linear-gradient(to right, rgba(239,231,211,.08), transparent 90%);
  border-bottom: 1px dotted var(--text-3);
  padding: 0 .2em;
}
.case .anchored::after {
  content: attr(data-count) ' ↓';  /* e.g., "4 replies ↓" */
  /* positioned to the right of the text, ink-colored */
}
```

Clicking the marker jumps to the Discussion tab with that sub-thread expanded.

**Rendering in the reply:** The anchored quote appears as an italic serif block-quote at the top of the reply, with "In reply to" as a small sans-serif label above it.

```html
<blockquote class="anchor-quote">
  The signal, as I've said before, is often in what isn't happening.
</blockquote>
```

This is the single most important feature of the discussion UI. It turns generic commentary into *specific counter-argument tied to a specific claim*.

---

## The compose

```html
<form class="compose">
  <span class="av">pf</span>
  <div class="body">
    <textarea rows="2" placeholder="Add your view. A question, an observation, a counter — whatever moves the thread."></textarea>
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

**Critical absences:**
- No side picker (no YES/NO/no-stake toggle)
- No stake amount input
- No "Post & back YES" combined button

The compose is a reply box, not a trading terminal. See [principle #3](./02-design-principles.md) and [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).

The hint line directs users who *want* to place a trade toward the right-rail trade panel. This is not a limitation — it's the design.

### Chips (optional actions)

- **Quote a passage** — opens a selector to pick a passage from the case, sets this reply as anchored.
- **Link a market** — opens a market search, inserts a market embed link in the reply body.
- **Image** — attach an image for evidence (chart, screenshot).

---

## Discussion head

The Discussion tab's top section shows:

```
24 replies · 14 from YES holders · 5 from NO holders · 5 from observers
```

A one-line summary of the discussion's composition.

Below it: the **split bar** — a visual representation of the same information. See [20-components.md#split-bar](./20-components.md).

Below the bar, one line of context: *"market crowd price stands at 71¢ YES"* — so readers can see whether the discussion's composition matches the market price or diverges from it.

---

## Who's in the thread (rail card)

On the Discussion tab's right rail:

```html
<section class="rail-card">
  <header><h3>Who's in the thread</h3><a>See all</a></header>
  <a class="voice-row">
    <span class="av-s av-N">N</span>
    <div class="who">
      <span class="n">Nina Ortega <span>· author</span></span>
      <span class="stake-sub y">holds YES · $2,400</span>
    </div>
    <span class="p">22m</span>
  </a>
  <!-- ... -->
</section>
```

Lists the top participants by position + most recent activity. Author first, then biggest holders on each side, then observers.

**Not a "top voices" card** — that name implied ranking by stake-on-reply. It's "who's in the thread" because it describes the participants as people, not actions.

---

## What's *never* in the discussion UI

- Likes / hearts / upvotes (see [principle #6](./02-design-principles.md)).
- Downvotes.
- Reaction emoji.
- A "view as flat" toggle — we chose 1-level nesting, we stick with it.
- Reply quality badges ("Verified expert," "Top contributor") — Cascade's quality signal is the position badge, and that's enough.
- A separate private chat thread attached to a market.
- Reply deletion (replies are immutable once posted, like trades).

---

## A note on deletion & editing

Cascade's Nostr-native event model means replies are immutable once published. This is a feature, not a bug — it matches the product ethos of "every position, every argument, on the record." Users can retract (a *"retracted by author"* state) but not delete.

Editing is possible but every edit publishes a new event; the reply shows `edited 2m ago` in the time field.

## Next

- [32 — Expression vs transaction](./32-expression-vs-transaction.md)
- [33 — Feed items](./33-feed-items.md)
