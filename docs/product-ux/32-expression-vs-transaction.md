# 32 — Expression vs Transaction

The single most important separation in The Column. If you internalize only one design decision, make it this one.

---

## The principle

**Expression** is the act of putting a thought or argument on the public record.
- Notes (short thoughts on Home)
- Replies (responses to a claim's discussion)
- Restacks (amplifying someone else's post)
- Publishing a claim (the big form of expression)

**Transaction** is the act of putting money on a position.
- Back YES
- Back NO
- Cash out
- Seed (at claim-publish time)

In Cascade, **these two actions are always separated in the UI.** They never share a button, a form, or a confirmation flow.

---

## Why this matters

Three reasons this separation is non-negotiable.

### 1. Users do one when they meant the other.

Combined compose-and-trade UI means a user types a reply, clicks Post, and finds out they just bought $25 of YES. Even with the clearest label, the error rate is high. Cascade's trades are *not* reversible in the same session — cashing out is a new event at a new price.

### 2. The mental models are different.

When you're writing a reply, you're thinking: *"What would I say to convince someone?"* When you're placing a trade, you're thinking: *"Do I believe this enough to put money on it?"* Those are different decisions and one should not gate the other.

### 3. It corrupts discussions.

If every reply carried a required stake, people would (a) reply less, (b) reply only when they want to stake, or (c) reply to artificially attach their stake to their argument. None of these improve discussion quality.

Attaching a trade to a reply also turns a *"good point"* response into a marketing action (*"stake-farming"*) — the Reddit problem of reward-shaping taken to its worst form.

---

## How the separation manifests in the UI

### Where expression happens

- **Home compose (top of feed):** `"What's on your mind?"` or `"Propose a claim. The crowd will price it."` Post button: `Post`.
- **Discussion compose (top of Discussion tab):** `"Add your view. A question, an observation, a counter — whatever moves the thread."` Post button: `Post reply`.
- **Note publishing (from Home compose):** Becomes a standalone Note in the feed.
- **Claim publishing (from rail CTA):** Goes to the Create flow.

Each of these is a writing surface. None of them ask for a stake.

### Where transaction happens

**Always and only:** in the right-rail trade module on the market page.

```
┌────────────────┐
│ Back a side    │
│                │
│ [Back YES 71¢] │
│ [Back NO  29¢] │
│                │
│ Amount: $ 25   │
│                │
│ Shares: 35     │
│ Fee:    $0.25  │
│ If right: +$10 │
│                │
│ [ Back YES $25 ]│
│                │
│ Cash out anytime│
└────────────────┘
```

Nothing else in the product is a trade action. Not the compose. Not a reply action button. Not an inline "back this claim" button in feed items.

**Exception:** Feed items on Home can have a secondary action row that includes `Back YES 71¢` as one of the options (alongside Reply, Save, Share). Clicking this navigates to the market page with the trade module pre-filled with YES. It's a *shortcut* to the trade module, not a separate trade flow.

### Where position appears

Position — derived from 983 trade events — appears in two places only:

1. **In the discussion on a specific market:** As an inline badge next to the replier's name (`holds YES · $120`).
2. **In the right rail of the market page:** In a compact "Your position" sub-block under the trade module.

Position does **not** appear:
- As a chip on a reply (it's a state, not a chip).
- In the Home feed on every note (only on notes that explicitly announce a trade — like *"Just closed a position at..."* — and then the position is contextual, not authoritative).
- As a sort signal.
- As a ranking signal.

---

## The one place they touch: notes with stake disclosure

A user posting a Note on Home may have just placed a trade. If so, the Note can *disclose* the trade:

```html
<span class="stake-chip">Back YES · $200</span>
```

This is **not a stake on the note**. It's a small inline indicator that the user is simultaneously disclosing a trade they've placed (or is about to place). The trade itself goes through the normal trade module; the Note just links to it for transparency.

Clicking the stake-chip in a Note opens the market page with the trade module in context. Deleting the Note does not reverse the trade.

This is the **only** place expression and transaction are visually adjacent. Even here, they're two events: a Note + a Trade. Not one combined event.

---

## How to tell if you're violating this principle

Red flags when designing:

- The word "Post" appears next to the word "back" or "stake" or a dollar amount.
- A compose box has a side picker (YES/NO) or a stake input.
- A reply's "Reply" button implies a trade will execute.
- A trade confirmation flow also offers to post a reply.
- A sort order is "Top stake" or "Most-backed reply."
- A feed item's primary action is both "Reply" *and* "Back YES" combined.

If you see any of these, stop. Re-architect.

---

## The trade module — always the same place

Wherever trading happens, the UI is identical:

```
┌────────────────────────────┐
│  Back a side  $1,284 avail │
│                            │
│  ┌──────────┬───────────┐  │
│  │ Back YES │ Back NO   │  │
│  │ 71¢      │ 29¢       │  │
│  └──────────┴───────────┘  │
│                            │
│  $ [    25    ] USD        │
│                            │
│  Shares        35          │
│  Avg fill      71.4¢       │
│  Fee (1%)      $0.25       │
│  If right      +$10.28     │
│                            │
│  [ Back YES · $25        ] │
│                            │
│  Cash out anytime ·        │
│  no expiry · no oracle     │
└────────────────────────────┘
```

Same layout, same copy, same button treatment — whether it's in the right rail of the Case tab, the Discussion tab, or a future mobile drawer. Predictability is the whole point.

---

## Summary

- Expression surfaces: Home compose, Discussion compose, Claim create form.
- Transaction surface: right-rail trade module on market pages.
- Position surfaces: reply badges (on the market's discussion), "Your position" in the trade module.
- These never combine. The Post button posts. The Back YES button trades. They live in different columns of the page.

## Next

- [33 — Feed items](./33-feed-items.md)
