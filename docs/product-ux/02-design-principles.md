# 02 — Design Principles

Ten laws. Every design decision in The Column can be traced to one of them. Every *rejected* design can be traced to violating one.

When you're unsure whether to introduce a new visual pattern, read this document first. Then [51-anti-patterns.md](./51-anti-patterns.md).

---

## 1. Cascade is a writer's product with a trade button

**Why.** A claim is a sentence someone wrote and is defending with money. If the trading UI dominates, the sentence collapses into a row of data. If the reading UI dominates, the product forgets what it is. The balance is: *reading is the posture, trading is accessible.*

**How to apply.** The main column is always reading-shaped (serif title, prose body, author byline). The trading UI lives in the right rail as a quiet module, always reachable but never loud. Never make the center column primarily about placing trades.

## 2. Serif is reserved for the argument

**Why.** A serif type family (Fraunces) is a typographic signal — "this is considered writing." If serif appears everywhere, it loses that signal. We restrict it so that when a reader sees serif, they know: *I'm reading someone's case.*

**How to apply.** Fraunces appears on:
- Claim titles (home featured, market page h1, inbox card titles, market-embed `<h3>`)
- The case body (the author's argument on the market page)
- Anchor quotes (when a reply quotes a passage from the case)
- Publication names (italic, as a byline)

Fraunces never appears on: chrome (nav, tabs, breadcrumbs), UI text (buttons, labels), metadata, reply bodies, trade modules, stats.

## 3. Expression and transaction are separate UI actions

**Why.** When posting a reply and placing a trade are the same button, users do one when they meant the other. The mental model is also wrong: a reply is public expression; a trade is a private act of conviction. Collapsing them feeds bad discussions ("reply to farm the trade") and bad trades ("I meant to just comment").

**How to apply.** The compose box has *no side picker and no stake amount*. The Post button is "Post reply" — not "Reply & back YES." Trading happens only in the right-rail trade module on the market page, which is always reachable. If a user wants to do both, that's two clicks in two places. See [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).

## 4. Position is a standing state, not a reply chip

**Why.** A person's position in a market is a fact about them, derived from 983 trade events (trades against this market's `E` tag). It doesn't change per-reply. If we render it as a chip attached to each reply, we suggest the reply itself carries that stake — which is a category error (see principle 3).

**How to apply.** Position badges appear next to the author's name in the reply head as subtle inline text: `YES · $120` in emerald, `NO · $25` in rose. No border, no background. Only shown for people with a documented 983-derived position. Observers get `· observer` in their pub-tagline instead.

## 5. Categories are navigation, not sections

**Why.** A newspaper has "sections" with mastheads and styling per section. In Cascade, a category is just a filter — *"show me Geopolitics."* If we render each category as its own visual universe, we (a) duplicate chrome, (b) make the product feel fragmented, (c) imply categories are more important than authors or claims, which they aren't.

**How to apply.** Categories live in the Markets tab as a horizontal text-only underline-tab row. They can also appear as an eyebrow above a claim title (`GEOPOLITICS · ...`). They do not get per-category colors, per-category headers, per-category chrome. They're filter labels, nothing more.

## 6. The crowd's weight is already visible — don't add likes or upvotes

**Why.** In most products, upvotes are the weight signal (*"this is a good comment"*). In Cascade, **stake is already the weight signal** — money on a position. Adding likes would dilute it. Adding downvotes would gamify disagreement, which Cascade expresses through staking the other side.

**How to apply.** No like button. No heart. No upvote/downvote. Replies can be **restacked** (amplified, Substack-style) and **saved**. Sort defaults use replies-plus-restacks as a proxy for quality. "Top" sort is about conversation density, not popularity.

## 7. One claim per viewport is a reading posture

**Why.** When a claim is surrounded by twelve other rows, it reads as a row. When it has room, it reads as a sentence you're being asked to consider. Cascade wants the latter.

**How to apply.** Home's feed items are vertically stacked with generous padding (1.3rem top, 1.8rem bottom per item). Featured/lead items on Markets and in author profiles get 2rem+ of vertical breathing room. We never pack claims into a grid with cells smaller than ~16ch wide.

## 8. Warm ink (`#efe7d3`) is the single accent outside emerald/rose

**Why.** Cascade's brand rule is "neutrals + emerald + rose only." But *zero* accent colors makes the UI feel monastic. One restrained warm-ink color gives the wordmark, primary CTAs, and publication names enough warmth to feel like a publication without breaking the palette rule.

**How to apply.** `#efe7d3` is used for: the Cascade wordmark, the Publish CTA in the rail, subscribe buttons, title-hover color on cards, the "active" underline on tabs, unread-count badges, the "New" chip. Never used on body text, never on charts, never on dividers.

## 9. Reading has its own posture; chrome has its own

**Why.** A reader in the case body wants quiet, generous, slow. A user navigating in the rail wants tight, legible, scannable. If we give the same typographic treatment to both, we lose both modes.

**How to apply.**
- **Reading:** Fraunces 500 at 1.14rem, line-height 1.7, max-width 56ch, drop cap on the first paragraph, italic blockquotes with a left-border rule.
- **Chrome:** Inter 400–600 at 13–15px, tight tracking, one-line rows, no drop caps.
- **Discussion replies:** Sans-serif Inter at 0.98rem, line-height 1.6 — short-form, not essay-form.

See [11-typography.md](./11-typography.md).

## 10. Every decision must survive the "does this look like it's from the same product?" test

**Why.** The single biggest failure mode we caught in iteration: a well-designed sub-page that looks like an embed from another product. If Markets looks like Bloomberg and Home looks like Substack, the user isn't using one thing — they're using a Frankenstein. We'd rather have a less-optimal page that *belongs* than a locally optimal page that doesn't.

**How to apply.** Before shipping any new page, open it side-by-side with Home and ask: same rail? same right-rail card visual language? same button shapes? same breathing room? same typography scale? If the answer is no on any of those, the page isn't done. See [51-anti-patterns.md](./51-anti-patterns.md) for concrete failures.

---

## How these principles show up in concrete decisions

| Decision | Principle |
|---|---|
| Compose has no side-picker | #3 |
| Comments are sans-serif | #2, #9 |
| Market title is Fraunces serif | #2 |
| `YES · $120` badge is inline text, not a chip | #4 |
| Markets tab uses text-tabs not pill chips | #10, #5 |
| No split-bar widgets in right rail | #10 |
| Authorpub-tagline is italic Fraunces in byline | #2 |
| No like button on replies | #6 |
| Trade module lives in right rail only | #3, #1 |
| Home feed items stack with 1.8rem gap | #7 |
| Wordmark uses warm ink `#efe7d3` | #8 |
| Sort default is "Top" (replies + restacks), never "Top stake" | #3, #6 |
| Position badge only shown if 983 event exists | #4 |

## Next

- [03 — Product primitives](./03-product-primitives.md)
