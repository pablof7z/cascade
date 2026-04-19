# 03 — Product Primitives

The content types Cascade has. Each primitive has a purpose, a shape, and rules about how it renders. Engineers and designers should share the same mental model here — we use the same word for the same thing, everywhere.

---

## Claim

A single sentence, authored by one user, representing a falsifiable thesis.

**Example:** *"OpenAI will ship GPT-5 before Google ships Gemini 2 Pro."*

- **Shape.** A sentence, ending with a period. 60–140 characters is typical.
- **Authored.** Exactly one author (`@north`). Immutable once published.
- **Priced.** Has a live crowd price (e.g., `71¢ YES`) derived from all trade events.
- **Category.** Exactly one (Geopolitics, Macro, AI, Crypto, Tech, Sports, Culture, Policy, Nostr).
- **Tags.** Zero or more; used for search and findability.
- **Never expires.** No resolution, no oracle, no closing date.
- **Rendering:** Fraunces serif. Always.
- **Image (optional).** Claims may have an author-attached image (photograph, chart, illustration) used in portrait cards on Markets rails and in Home feed embeds. When absent, a gradient placeholder derived from the category renders instead. See [20-components.md#portrait-card](./20-components.md).

The claim is the product's atom. Every other primitive either describes a claim, responds to one, or records an action on one.

## Case

The author's *argument for* the claim. A long-form prose body published alongside the claim.

- **Shape.** Multi-paragraph prose, possibly including a blockquote. 200–800 words typical.
- **Authored by the claim's author.** One case per claim. The case *can be revised* — Cascade keeps a history (rev 1, rev 2, rev 3), and each revision is an event.
- **Rendering:** Fraunces serif, line-height 1.7, drop cap on first paragraph, optional italic blockquotes.
- **Anchor points:** Specific sentences in the case can be *anchored* — they're marked as "this passage has N replies tied to it." Highlighting a passage and replying creates an anchored reply. See [31-discussion-architecture.md](./31-discussion-architecture.md).

The case is where the writer makes their best argument. Case revisions are first-class events (they appear on Home and in Subscriptions as *"case revision · rev 3 on a claim you hold"*).

## Reply

A response to a claim. Part of the market's discussion. Lives in the Discussion tab.

- **Shape.** Short to medium prose. 1–5 sentences is typical; long replies (2–4 paragraphs) are welcome.
- **Optional anchor.** May reference a specific passage from the case as its anchor.
- **Optional nesting.** May be a reply-to-a-reply (one level of nesting rendered by default).
- **No stake attached.** A reply is expression, not transaction. See [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).
- **Rendering:** Inter sans-serif, 0.98rem, line-height 1.6.

The reply does not carry a stake. The author's *position in the market* (if any) is rendered separately as a position badge next to their name — a standing state, not a reply chip.

## Note

A short thought that isn't about any one market. Lives in Home feed.

**Example:** *"The crowd looks underpriced on several 2026 macro claims. Something's off in the way the curve is pricing in the October meeting."*

- **Shape.** Plain text, 1–3 short paragraphs.
- **May embed:** a market card (link preview), an image, a linked reply (restack), or nothing at all.
- **Not tied to a specific market.** A note is standalone content, visible to followers/subscribers and on Home.
- **Authored.** Has an author, a timestamp, and can carry optional metadata (*e.g., "closed a position"*).
- **Rendering:** Inter, 1rem, line-height 1.6.

Notes are Substack-style short posts. They fill the gap between *"I had a thought"* and *"I'm publishing a claim."*

## Trade

A 983 event (or 981 in practice edition). Issued by the mint, not by the user.

- **Authored by the mint**, with an optional `p` tag identifying the user who initiated it.
- **Types (from the user's perspective):** Back YES, Back NO, Cash out.
- **Derives.** Position, price, volume. All market numbers come from the trade event log.
- **Rendering:** As a row in the trade tape (`2s · BACK YES · @tessa · $40 · 71¢`). As a feed item on Home ("Big move · $800 just swung YES"). Never as a stake chip on a reply.

Trades are the crowd's collective answer to each claim.

## Restack

An amplification primitive. A user reshares a reply (or a note, or a claim) with optional commentary of their own.

- **Example.** *"Restacked @north"* with a quoted block of the original content and @jules's own sentence added.
- **Shape.** The user's own short text + the quoted content below.
- **Rendering:** On Home, shows as a feed item with the user's avatar and name, the pub-line shows `· restacked @north`, their own text in Inter, the quoted content in a serif block-quote style beneath.

Restack is Cascade's answer to *"how do I say 'this is good, look at it'"* without introducing likes or upvotes.

## Position

A user's current holding in a specific market. **A derived state, not an event.**

- **Derived from** the 983 events that `p`-tag the user and `E`-tag the market. Sum the YES shares minus the YES shares cashed out; same for NO.
- **Shape.** `{ side: 'YES' | 'NO', amount_usd, avg_cost_cents, shares }`.
- **Rendering in discussions:** small inline text next to the user's name: `YES · $120`. Emerald for YES, rose for NO.
- **Not rendered on** Home feed items, notes, or the feed compose (those are author-level rendering, market-agnostic).

Position is never *claimed* by the user — it's derived from the record.

## Subscription

A user's opt-in to hear from another user.

- **Shape.** A follows B. When B publishes a new claim or revises a case, A gets an entry in their Subscriptions tab.
- **Cost:** Free. No paid tiers in the launch contract.
- **Visible:** Yes — subscribe counts are public, and a "subscribed" chip appears in bylines when the viewer subscribes to the author.
- **Cross-over with "Follow":** Subscribe = hear from them on the reading surfaces (Subscriptions, notifications). Follow = see their notes and trades on Home.

See [41-page-subscriptions.md](./41-page-subscriptions.md).

## Category

One of ten taxonomic labels: Geopolitics, Macro, AI, Crypto, Tech, Sports, Culture, Policy, Nostr.

- **Exactly one per claim.** Assigned at publish time by the author; auto-suggested based on claim text.
- **Lives in navigation**, not as content. Filter label only. See [principle #5](./02-design-principles.md).
- **Never gets its own chrome.** No per-category colors (other than the accent emerald for eyebrows), no per-category mastheads.

## Linked market

A relationship between two claims. Informational only.

- **Added by** the author at create time, or later via case revision.
- **Informational only.** Links do not influence the linked market's price. A note on @sono's Taiwan claim linking @north's GPT-5 claim doesn't move @north's price. See [`docs/design/product-decisions.md`](../design/product-decisions.md).
- **Rendering.** Compact list below the case, showing claim title + current price. On Home/Subscriptions, linked claims may appear as secondary cards when there's context.

---

## What's *not* a primitive

These things *do not* exist as first-class content types, by design:

- **Like / upvote / heart.** Not a primitive. Use restack or stake. See principle #6.
- **Downvote / dislike.** Not a primitive. Disagreement is expressed by staking the other side.
- **Resolution / outcome event.** Not a primitive. Markets never resolve.
- **Administrative close.** Not a primitive. No admin close button.
- **Private message / DM.** Not in the launch contract.

---

## Event map (for engineers)

| Primitive | Nostr kind | Who publishes |
|---|---|---|
| Claim (live) | 982 | User |
| Trade (live) | 983 | Mint |
| Claim (practice) | 980 | User |
| Trade (practice) | 981 | Mint |
| Reply | 1111 (comment on kind 982/980) | User |
| Note | (TBD — likely a kind-1 equivalent with tagging) | User |
| Case revision | Replaceable or addressable via E tag chain | User (claim author) |
| Restack | (TBD) | User |

See [`docs/product/spec.md`](../product/spec.md) for the Nostr event schemas. This doc is about the UX — the primitive names here should align with the event names there.

## Next

- [10 — Color](./10-color.md)
- [11 — Typography](./11-typography.md)
