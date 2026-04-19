# 51 — Anti-patterns

Every pattern on this list was tried in an iteration, rejected, and documented here so we don't re-try it. Check this list *before* proposing any new visual or interaction idea.

If you see one of these in code, it's a bug.

---

## 1. Combining expression and transaction into one button

**What it looks like:** A compose box with `[Back YES] [Back NO] [No stake]` side picker + `$ [25]` amount input + a `Post reply · back YES $25` combined button.

**Why we rejected it:** Users confuse the two actions. Posting a reply and placing a trade are separate mental acts. Combining them corrupts the discussion (stake-farming, reply-to-trade confusion) and the trading (accidental buys). See [32-expression-vs-transaction.md](./32-expression-vs-transaction.md).

**Use instead:** Compose posts the reply. Trading happens in the right-rail trade module. Always.

---

## 2. Per-reply stake chips (implying the reply carries a stake)

**What it looks like:** `[BACK YES · $120 @ 70¢]` — a bordered rounded-pill chip next to the replier's name, visually suggesting the reply comes with that stake.

**Why we rejected it:** A position is a state about the person, not an attribute of the reply. Multiple replies by the same person all inherit the same current position; it isn't "attached" to any one reply. And the pill visual made it look like a button/action, not metadata.

**Use instead:** A subtle inline text badge — `holds YES · $120` in emerald, no border, no background. Only shown for users with a documented 983-derived position. See [31-discussion-architecture.md](./31-discussion-architecture.md).

---

## 3. Serif on comment/reply bodies

**What it looks like:** Long replies set in Fraunces serif at 1.05–1.14rem.

**Why we rejected it:** Serif in Cascade marks *published argumentation* (claims, cases). A reply is expression — closer to a tweet or a Substack comment than to an essay. Using serif on replies dilutes the serif signal (*"this is the author's considered argument"*) and makes every thread feel like an op-ed anthology.

**Use instead:** Inter sans-serif, 0.98rem, line-height 1.6. Keep serif for claim titles, case body, anchor quotes, and publication names.

---

## 4. Pill chips for filters, sort, or navigation

**What it looks like:** `[All] [Geopolitics] [Macro] [AI]` — each a rounded-pill button with a border, a background on active, and hover states.

**Why we rejected it:** Pill chips are dashboard language. They made Markets look like a Bloomberg terminal dropped inside a Substack-shaped app. See [principle #10](./02-design-principles.md).

**Use instead:** Text-only tabs with an underline on active. See [20-components.md#text-tabs](./20-components.md).

---

## 5. Data grid with multiple columns and sparklines per row

**What it looks like:** A Markets page with columns: `CAT · CLAIM · PRICE · 14-DAY (sparkline) · 24H Δ · VOL · REPLIES · AGE`. Headers. Sortable. Dense.

**Why we rejected it:** Same reason as #4 — it violates the principle that every page must look like it's from the same product. The data grid felt like a terminal embedded in a publication UI.

**Use instead:** Reading-shaped cards with inline mono metadata: `71¢ YES · +3¢ 24h · 2,814 trades · 24 replies · $74K 30d`. Sparklines only appear in the right-rail `up-item` components.

---

## 6. Split-bar widgets in the right rail

**What it looks like:** A "Most contested" rail card with horizontal bar graphs showing YES/NO split for each market.

**Why we rejected it:** Dashboard chart language. Didn't match the calm `up-item` pattern used on Home.

**Use instead:** The `up-item` card with a single-line meta showing *"spread 2¢ · 91 replies"* as text. Visual cards only, no inline graphs.

**Exception:** The *one* split-bar allowed is inside the Discussion tab's head, showing the YES/NO/observer composition of repliers. That's content, not chrome. See [20-components.md#split-bar](./20-components.md).

---

## 7. Masthead / newspaper costume

**What it looks like:** *"Cascade — Vol. 2 No. 47 — Saturday 18 April 2026"* as a big centered header. Double-rule dividers. Three-column newspaper layout. Dateline per article.

**Why we rejected it:** Costume. It made Cascade feel like a 19th-century re-enactor instead of a modern product. The newspaper metaphor was too literal; the editorial *restraint* (serif titles, author bylines) can carry the editorial feel without the full costume.

**Use instead:** Workspace chrome with editorial typography inside content. See [01-overview.md](./01-overview.md) on The Column's origin.

---

## 8. Upvotes, likes, hearts, reaction emoji

**What it looks like:** `❤ 24` or `▲ 42` next to every reply.

**Why we rejected it:** Cascade has stake as the weight signal already. Adding likes dilutes it. Adding upvotes gamifies engagement in a product that doesn't want engagement-as-metric. Reactions are noise.

**Use instead:** Stake-weighted sort (via the derived position of the replier) or reply-count sort or recency. See [principle #6](./02-design-principles.md) and [31-discussion-architecture.md](./31-discussion-architecture.md).

---

## 9. Sparkline per row in a market list

**What it looks like:** A Markets-page row with a tiny line chart embedded in a dedicated column.

**Why we rejected it:** Makes every row feel like a financial-terminal cell. Sparklines are great as a secondary visualization on a *single* prominent item (the featured lead, a right-rail up-item) but become noise when rendered 14× per page.

**Use instead:** Sparklines only in the right rail's `up-item` card (72×56px thumbnail). Inline rows get text-only mono metadata.

---

## 10. Per-card sidebar with price + facts + sparkline

**What it looks like:** Every Subscriptions inbox card has a right-column sidebar showing a big price lockup, a sparkline, and a 4-row fact list.

**Why we rejected it:** Turned every reading item into a dashboard row with a stats panel. Destroyed the calm. Substack's inbox is a single content column per item, not a mini-dashboard.

**Use instead:** Price as inline muted metadata in the footer: `50¢ YES · opening`. One line, one size, no sidebar.

---

## 11. Dense right rail with three or more cards

**What it looks like:** Right rail with *Writers to subscribe* + *Your reading this month* + *Subscribe to a category* + *Trending markets*. Four+ cards stacked.

**Why we rejected it:** Too much context-noise competing with the main column. The user can't focus on reading when the right rail is shouting four things.

**Use instead:** Max two cards per page in the right rail. If more content would be useful, promote it to its own page or to a *"See all →"* link inside a card.

---

## 12. Loading spinners, skeletons, animated placeholders

**What it looks like:** A gray rectangle pulsing while the claim loads. A spinner next to the trade button while the quote is being fetched.

**Why we rejected it:** Cascade is Nostr-native. Data streams in. Render what you have — show more as events arrive. Spinners imply a request/response model that doesn't match our substrate. See [`docs/design/product-decisions.md`](../design/product-decisions.md).

**Use instead:** Render what's known. Let new data appear in place. Use empty states that invite action, not placeholders that describe absence.

---

## 13. Toast notifications for expected actions

**What it looks like:** *"✓ Trade placed!"* slides up from the bottom after a user backs YES.

**Why we rejected it:** The trade module updating in place is confirmation enough. Toasts are visual noise that makes the product feel like marketing-site UI.

**Use instead:** The UI updates in place. Post a reply → reply appears in the thread. Back YES → the trade module shows the new position. Save → the Save button becomes *"Saved."* No separate "hey I did the thing" overlay.

**Exception:** Errors that require user attention may use a toast-like affordance, but even then prefer inline error states inside the affected control.

---

## 14. Category-specific chrome

**What it looks like:** The Geopolitics page has a blue accent. Macro has a warm one. Each category has a custom header image.

**Why we rejected it:** Categories are navigation labels, not brand universes. Introducing per-category styling would (a) violate the palette restraint, (b) imply categories matter more than claims or writers, and (c) multiply the design surface by 9.

**Use instead:** Category is an eyebrow label (`GEOPOLITICS · ...` in the accent emerald) and a filter in the tab row. That's it.

---

## 15. Global top navigation bar

**What it looks like:** A sticky top bar with the Cascade logo, a top-right avatar menu, a separate search.

**Why we rejected it:** Duplicates the rail. Adds chrome without adding information. The rail is primary nav; a topbar would be redundant.

**Use instead:** Rail + in-page breadcrumbs. See [30-navigation-and-chrome.md](./30-navigation-and-chrome.md).

---

## 16. Hamburger menus at desktop widths

**What it looks like:** A `☰` icon that opens a side drawer with primary nav, at widths above 768px.

**Why we rejected it:** The rail already does this at desktop widths. Hamburgers at desktop are 2014-era responsive lazy-fallback.

**Use instead:** The rail collapses to icons-only at 1200px and 880px. At 640px, a hamburger may be introduced — that's a mobile pattern, not a desktop one.

---

## 17. Full-width hero images / video backgrounds

**What it looks like:** A marketing-site-style landing hero with a video background or a huge photograph.

**Why we rejected it:** Cascade is a product, not a landing page. Users hit Home already signed in; the product needs to start working immediately.

**Use instead:** No heroes. Home is the feed. The Substack-shaped compose at top is the "hero."

---

## 18. Author size hierarchies based on wealth or traffic

**What it looks like:** A rail card listing "top writers" ranked by position size ($2,400 > $120 > $40), with bigger avatars and more prominent placement for whales.

**Why we rejected it:** Introduces power-rankings that reward capital over insight. Whales become gravitational, which in a prediction market is precisely the wrong incentive.

**Use instead:** Ranking by *drift* (percentage of authored claims trading toward seed side) — a quality signal, not a capital signal. See [author profile future spec in 91](./91-open-questions.md).

---

## 19. Resolution / outcome language

**What it looks like:** *"Awaiting resolution"*, *"This market resolves on..."*, *"Winners payout..."*.

**Why we rejected it:** Cascade markets never resolve. This is a hard product rule. See [`docs/design/product-decisions.md`](../design/product-decisions.md).

**Use instead:** *"Cash out anytime · no expiry · no oracle"* — the anchor phrase. See [50-voice-and-copy.md](./50-voice-and-copy.md).

---

## 20. "Win rate" or "accuracy" metrics on user profiles

**What it looks like:** *"@north — 72% win rate"*.

**Why we rejected it:** Markets don't resolve — there's no ground truth to compute a win rate against.

**Use instead:** *"65% of her claims are drifting toward her seed side"* — a factual, mechanically-defined metric that doesn't imply resolution.

---

## 21. Rounded-square avatars / non-circle identity shapes

**What it looks like:** Squircle avatars. Rounded-rectangle identity tiles.

**Why we rejected it:** Circles read as people; squares read as apps or logos. Cascade's avatar is the user's identity — circles.

**Use instead:** 999px border-radius on avatars. Always.

---

## 22. Emoji in UI chrome

**What it looks like:** `📊 Markets`, `💬 Discussion`, `✨ New`.

**Why we rejected it:** Emoji is user voice, not product voice. In chrome, emoji breaks the restraint. See [`docs/design/product-decisions.md`](../design/product-decisions.md).

**Use instead:** Unicode symbols where needed (`·`, `→`, `◉`, `⋯`, `×`). Or SVG icons.

---

## 23. Colored category tags per category

**What it looks like:** Geopolitics in blue, Macro in purple, AI in green, etc.

**Why we rejected it:** Introduces a rainbow palette. Breaks the neutrals + emerald + rose + warm-ink restraint.

**Use instead:** Category eyebrows use the single accent emerald (`--yes`) — the "Cascade green." Every category label is this same color. The *label text* differentiates; the color doesn't.

---

## 24. Accordion-style expand/collapse for long content

**What it looks like:** *"Read more ↓"* that expands the rest of the case inline.

**Why we rejected it:** Cuts reading flow. Makes the user click to keep reading. If a case is long, let it be long — the reader can scroll.

**Use instead:** Full content visible. Let the browser scroll.

**Exception:** *"Continue thread →"* for nested discussion replies. That's navigation to a focused sub-thread view, not an expand-in-place. Different semantics.

---

## 25. Review screens and over-staged wizards

**What it looks like:** Publishing a claim ends with a *Review everything* screen before launch. Or the flow has six+ steps because every optional field was promoted to its own stage (image, tags, linked markets, summary, category all treated as equal-weight).

**Why we rejected it:** A review screen is a distrust tax — the author already saw everything building up in the live preview rail. And six+ steps turn optional fields into mandatory clicks.

**Use instead:** A four-step guided flow where each step has one focus and most steps contain one decision: *Title &amp; category → Case → Details (image, AI summary, tags — skippable) → Launch.* Optional content shares a step, not a screen. The live preview in the right rail substitutes for a review step. See [44-page-create.md](./44-page-create.md).

---

## 26. Hiding the seed requirement until publish

**What it looks like:** The composer lets the author fill out claim + case without any mention of a seed, then a modal appears on `Publish` saying *"You need to stake $X to go live."*

**Why we rejected it:** Feels like a bait-and-switch. Authors pre-commit emotionally to publishing, then discover a cost gate and bounce. Destroys trust.

**Use instead:** The seed block is always visible in the composer, labeled honestly as *"Seed the market — required to go live,"* with plain-English copy about why the seed exists and what it does (it becomes your first trade; you can cash out anytime; no fee). See [44-page-create.md § Seed block](./44-page-create.md).

---

## 27. Automated sharing to external networks on publish

**What it looks like:** A checkbox *"Post to X when I publish"* that autoposts a generated tweet to the author's X account.

**Why we rejected it:** Coerces virality. Makes the author's network feel spammed. Also fragile — API auth chains for external networks are the single most common source of "this broke, user lost trust" bugs.

**Use instead:** A post-publish sharing toolkit with pre-rendered cards, pre-written copy in multiple tones, embed codes, and a QR. The author presses a button to share. Nothing autoposts. See [44-page-create.md § Post-publish](./44-page-create.md).

---

## Before you add anything new, ask:

1. Does a component already do this? (Check [20-components.md](./20-components.md).)
2. Does it violate one of the ten principles? (Check [02-design-principles.md](./02-design-principles.md).)
3. Does it look like it belongs in The Column, or in some other product? (Check [principle #10](./02-design-principles.md).)
4. Is it on this list?

If yes to any of 2–4, stop.

## Related

- [02 — Design principles](./02-design-principles.md)
- [20 — Components](./20-components.md)
