# 43 — Page: Market

The market page is *tabbed*: Case · Discussion · Trades · Linked. Each tab is a different view of the same underlying market. The post-header and right-rail are shared; only the center-column content changes.

**Reference mocks:**
- `proposals/agency-2026-04/K-the-column/04-market.html` — Case tab
- `proposals/agency-2026-04/K-the-column/05-discussion.html` — Discussion tab

---

## Why tabs instead of a long scroll

Previous iterations put the case, the discussion, the tape, and the linked markets all on one page. That meant every market page was ~3000px tall, with reading and arguing competing for the reader's attention in one flow.

The split works because **reading the case** and **arguing about it** are different modes. Tabs let each mode get its own page treatment.

The four tabs:

| Tab | Content |
|---|---|
| **Case** (default) | The author's argument. Linked markets. Recent trades mini. A 3-reply featured-discussion preview. |
| **Discussion** | Full thread, compose, sort tabs, split bar, who's-in-the-thread rail. |
| **Trades** | Full trade tape with filtering + analytics. (Not yet spec'd — see [91](./91-open-questions.md).) |
| **Linked** | Full list of linked markets with preview cards. (Not yet spec'd.) |

---

## Shared: post-header

Present on all tabs, with minor variation.

**On the Case tab (full header):**

```
[Eyebrow: AI · Corporate timing · Published 14 Mar · rev 3]

[Big serif H1]
OpenAI will ship GPT-5 before Google ships Gemini 2 Pro.

[avatar] Nina Ortega ◉              [bookmark] [share] [+ Subscribe]
         Corporate timing, weekly-ish · 48 claims · 65% drift

[Price meta row — inline, muted]
71¢ YES · +3¢ · 24h · 21¢ spread · 2,814 trades · 318 traders · $74K 30d · last 4s

[Tabs]
Case (on) · Discussion (24) · Trades (2,814) · Linked (3)
```

**On the Discussion tab (compact header):**

```
[Eyebrow: AI · Corporate timing · Published 14 Mar · rev 3]

[Compact H1 — clickable, goes back to Case tab]
OpenAI will ship GPT-5 before Google ships Gemini 2 Pro.

[small avatar] Nina Ortega · Corporate timing, weekly-ish     71¢ YES · +3¢ 24h

[Tabs]
Case · Discussion (on) · Trades · Linked
```

The discussion header is smaller (1.7rem title vs 2.8rem) because when the user is here, they're not here to read the case again — they're here to discuss. The title is still visible and clickable (back to Case) to keep context.

---

## Case tab

*Reference: `04-market.html`*

Below the tabs:

### 1. The case body

Long-form serif prose. Drop cap on the first paragraph. Blockquote for the author's marquee line. Optional *anchored passages* — specific sentences highlighted with a subtle background and a `[N replies ↓]` marker in the margin.

```
Three gates in six weeks. Eight weeks gate-to-launch...

[Blockquote: What would move me?...]

...the signal, as I've said before, is often in what isn't happening. [4 replies ↓]
```

Max-width 56ch. Line-height 1.7. See [11-typography.md](./11-typography.md).

### 2. Case signoff

One-line transparent metadata under the prose:

```
Read by 4,214 · $52,400 on YES · $21,720 on NO across 318 traders · Author holds $2,400 YES @ avg 62¢
```

Dashed-border top and bottom. Mono `.72rem`. Informative, not decorative.

### 3. Linked markets

Compact list of 2–4 linked claims:

```
Linked markets · informational only
  GPT-5 has native agent tool-use at launch.          82¢ YES
  Anthropic ships Claude 5 before end-2026.           54¢ YES
  A frontier model scores above 90% on Frontier Math. 39¢ YES (rose)
```

Each row hoverable, clickable. Title in Fraunces, price in mono.

### 4. From the discussion (curated preview)

Three featured replies: **Top YES · Top NO · From the author**.

```
From the discussion · 3 of 24 · curated       Read all →

[Reply: Jules · holds YES · $120 · "Top YES"]
[anchor quote from the case]
Body in Inter sans-serif...
3 replies ↓  ·  Restack

[Reply: Mark Stone · holds NO · $15 · "From the other side"]
Body in Inter...
2 replies ↓  ·  Restack

[Reply: Nina Ortega · Author · holds YES · $2,400 · "From the author"]
Body in Inter...
5 replies ↓  ·  Restack

24 replies · 14 from YES holders · 5 from NO holders · 5 from observers    Continue the discussion →
```

Balanced by construction. Each reply shows the author's position badge (`holds YES · $120` etc). No stake-on-reply. See [31-discussion-architecture.md](./31-discussion-architecture.md).

### 5. Recent trades

A compact tape at the bottom:

```
Recent trades                                     See the tape →

2s   BACK YES   @tessa       $40 · 71¢
41s  BACK NO    @mark-s      $15 · 29¢
2m   BACK YES   @jules       $120 · 70¢
4m   CASH OUT   @neo         $78 · 70¢
7m   BACK NO    @arca        $25 · 30¢
```

Five rows, most recent first.

### Right rail (Case tab)

Two cards:

1. **Back a side** — the trade module + *Your position* sub-block. See [20-components.md#trade](./20-components.md) and [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).
2. **Related claims** — 4 linked-market mini-rows.

---

## Discussion tab

*Reference: `05-discussion.html`*

Below the compact header + tabs:

### 1. Discussion header

```
24 replies                                    [Top] [Newest] [Controversial] [Holders only]
14 from YES holders · 5 from NO holders · 5 from observers
```

### 2. Split bar (conviction composition)

```
14 repliers hold YES                              5 repliers hold NO
████████████████████████░░░░░░░░░░░░░░░░░░░█████████████
5 observers (no position) · market crowd price stands at 71¢ YES
```

A single horizontal bar, proportional to the composition of the discussion. Allows the reader to see the debate's shape before reading.

### 3. Compose

Expression-only compose. See [31-discussion-architecture.md](./31-discussion-architecture.md) and [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).

```html
<form class="compose">
  <span class="av">pf</span>
  <div class="body">
    <textarea placeholder="Add your view..."></textarea>
    <div class="controls">
      <div class="chips">[Quote a passage] [Link a market] [Image]</div>
      <button>Post reply</button>
    </div>
    <div class="hint">Replies are public and permanent. Want to take a position? Use the trade panel →</div>
  </div>
</form>
```

### 4. Thread list

6–10 top-level replies in the selected sort order. Each can have 1 level of nested children. Deeper threads roll into `Continue thread →`.

See [31-discussion-architecture.md](./31-discussion-architecture.md) for full rules.

### Right rail (Discussion tab)

1. **Back a side** — compact trade module (no `Your position` sub-block; the position shows inline in the thread header).
2. **Who's in the thread** — participant list with position badges.

---

## Trades tab (not yet specified)

Placeholder for a full trade-tape view with filters:
- Time range selector
- Side filter (YES / NO / all)
- Size filter
- Export

See [91-open-questions.md](./91-open-questions.md).

---

## Linked tab (not yet specified)

Placeholder for a detailed view of all linked markets, showing:
- Full preview cards with charts
- Relationship type (if we introduce typed relationships later)
- Cross-reply threads that span linked markets

See [91-open-questions.md](./91-open-questions.md).

---

## Navigation between tabs

Tabs use the standard text-tab pattern. See [20-components.md#text-tabs](./20-components.md). Clicking a tab is a URL change — deep-linkable, back-button-friendly.

The post-header (H1 of the claim, byline, price) **does not** scroll-with-sticky; it scrolls naturally with the document. This avoids a sticky-stack problem when the reader scrolls deep into a long case or a long thread.

The tabs themselves could be made sticky at the top of the center column, but currently aren't. See [91-open-questions.md](./91-open-questions.md) for this decision.

---

## Copy rules

- **"The case"** — the author's argument. Not "description," not "body," not "writeup."
- **"Back a side"** — the trade module heading. Not "Trade" or "Buy."
- **"Cash out anytime · no expiry · no oracle"** — the trade module footer reminder. Anchors Cascade's differentiators without shouting them.
- **"Holds YES · $120"** — position badge copy. Not "Owns," not "Stakes," not "Has YES position."

## Related

- [31 — Discussion architecture](./31-discussion-architecture.md)
- [32 — Expression vs transaction](./32-expression-vs-transaction.md)
- [20 — Components](./20-components.md)
