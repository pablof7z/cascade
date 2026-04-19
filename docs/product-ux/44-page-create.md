# 44 — Page: Write a claim (+ post-publish sharing toolkit)

The surface where a new claim becomes a live market. Two screens: the composer and the toolkit shown immediately after publish.

**Reference mocks:**
- `proposals/agency-2026-04/K-the-column/06-create.html` — composer
- `proposals/agency-2026-04/K-the-column/07-create-published.html` — post-publish toolkit

---

## The creator's deal

Cascade markets go live when the **author puts real money on them.** The claim's opening price is literally the seed's implied odds, not an editorial pick. That means:

1. The author has **skin in the game** from t=0. Their first trade *is* the seed.
2. They are **materially motivated** to bring eyeballs — more volume = more opportunity to be right for real money (and more signal on whether the thesis holds).
3. **Our incentives and the author's incentives are brutally aligned.** A bigger audience for their claim is a bigger audience for Cascade.

So we don't just build a form. We build a **ramp**. The composer gets them live with as little churn as we can manage. The post-publish screen hands them a fully-loaded sharing toolkit so they never have to wonder *"how do I tell people about this?"*

This is one of the most important surfaces in the product. It is the **only screen where our business depends on the author doing work outside Cascade**, and the only screen where we can realistically help them with it.

---

## Composer — first principles

### A four-step guided flow — not a single flat page, not a rigid wizard

We tried the single-page "progressive disclosure" composer first. It felt overwhelming: a stacked form with six collapsed sections, a live preview, and a seed block all demanding attention at once. Every section invited a micro-decision. The surface *looked* calm but *read* as a heavy form.

The answer is a **four-step guided flow** where each step has **one primary job**:

1. **Title &amp; category** — write the sentence. Pick the bucket.
2. **Make your case** — write the argument. Link related markets (optional).
3. **Details** — image (optional, category gradient default). AI-drafted summary (optional, regeneratable). Tags (optional).
4. **Launch** — seed the market. Invite specific people (optional).

What this is *not*:

- **Not a rigid wizard.** You can click any step in the stepper to jump around. Back/Forward are both free. Nothing gates nothing except the literal requirement that a claim needs text.
- **Not six+ steps.** Optional fields (image, summary, tags) share one step, they don't each get one. The stepper stays readable at a glance.
- **Not a review screen.** The live preview in the right rail is always up-to-date — a "review everything before publish" screen would be a distrust tax. See [51-anti-patterns.md § 25](./51-anti-patterns.md).

See [51-anti-patterns.md § 25](./51-anti-patterns.md) for why over-staged wizards are wrong, and this file for why a focused guided flow is right.

### The stepper

Top of the page, four dots with labels, connected:

```
(1 •) Title & category ——— (2 ○) Make your case ——— (3 ○) Details ——— (4 ○) Launch
```

- Active step: filled warm-ink dot.
- Completed steps: emerald dot + checkmark. Connector line goes emerald.
- Upcoming steps: hollow muted dot.
- Clicking any step jumps directly there. No modal confirm.

### Footer — pill-shaped, sticky

A capsule pinned at `bottom: 1rem`:

```
[ ← Back ]                                     Step 2 of 4     [ Skip ]  [ Continue → ]
```

- `Back` is disabled on step 1.
- `Skip` appears only on step 3 (the optional-details step).
- `Continue` becomes **`Launch market · $100 →`** on step 4 — warm-ink primary.

### Step 1 — Title &amp; category

The claim field is the product. It gets visual weight — big Fraunces serif textarea, borderless with a single underline, 2rem font-size. Below: character counter (`66 / 140`) and rule hints that light up emerald when satisfied (`✓ specific price · ✓ specific window · ✓ unambiguously resolvable`). These are advisory, not blocking.

Category is one row of text-tabs (no chip UI — see anti-pattern on chip filters).

**Proactive duplicate detection** lives at the bottom of step 1, in a soft accordion:

> **3 similar claims already live**
> — Bitcoin breaks $200K before end of 2026. *@dover* · 34¢
> — BTC spot ETF inflows surpass $100B cumulative by Dec 2026. *@sev* · 62¢

Clicking a row navigates to that market — we'd rather the author join an existing thesis than shed a near-duplicate into the feed. But publishing through is always allowed; "duplicate" is a judgment call.

### Step 2 — Make your case

Big serif textarea, 320px min-height, resizable, Fraunces at 1rem — matches how the case renders on the market page. 200–800 words is typical. No minimum enforced, but an empty case penalizes the claim's ranking in New and Under-the-Radar rails.

Below the case: **linked markets** (optional). Pre-filled if the author has a recent market they were reading. Flat list, remove button on each, `+ Link another market` input at the bottom. Clearly labeled *"informational only — links don't move price."*

### Step 3 — Details (all optional)

Three blocks, all skippable via the `Skip` footer button:

1. **Image.** 4:5 portrait preview on the left. On the right: three options — *Use [Category] gradient* (default, selected), *Upload image*, *Use from URL*. Gradient is deterministic and requires no upload, so no one gets blocked at the image step.

2. **AI-drafted summary.** A pull-quote-sized paragraph that the system drafts from the case on step 2. One-paragraph max. Labeled `✦ Draft summary — from your case`. `↻ Regenerate` button. Footnote: *"This appears in link previews and share cards. Edit if it needs a different angle."* Server regenerates on every case change.

3. **Tags.** Inline chips. Three suggested tags filled in; four more offered dashed as suggestions; free-text add.

### Step 4 — Launch

Now the author writes their check. Three blocks:

**The seed explainer.** A serif paragraph that frames what a seed is, in plain English:

> A market goes live when **you put real money on it.** Pick a side, size it, and you're the first trade. This is what gives the claim price — and it's why we don't have a resolution oracle: you're here to argue, the crowd's here to disagree, and nobody needs a referee.

This is the paragraph we sweat. Hide the seed requirement anywhere and the author feels duped when their balance drops — see [51-anti-patterns.md § 26](./51-anti-patterns.md).

**The opening-position controls.**
- YES / NO toggle with current implied price (LMSR against the seed).
- Amount input with quick-picks (`$25 · $50 · $100 · $250 · $500`, `$100` default).
- **Live math block** in mono: *you'll buy 141 YES · avg 70.9¢ · opening crowd price 71¢ · market liquidity $100*.
- **Reassurance footnote** with emerald tick: *"You're not paying a fee. This is capital you control — the market holds it as your opening YES position. Cash out anytime."*

**Bring your people.** The one growth-adjacent tool in the composer. A compact 2-column grid of people the author follows, each with a `+ Invite` button that toggles to `✓ Invited`. A search input beneath for anyone not in the grid. Help text: *"Invite specific readers to trade this market at the opening price. They receive a note with the claim, and can take either side. Cascade does not spam anyone — it's a direct note from you."*

The invite is just a direct note with the claim — not a special protocol event, not a co-seeding mechanism. Friends who accept can buy either side. The value is the warm opening: the author's first readers arrive as people who already know them, not random feed scrollers. This is the one place in the composer where we lean on the author's network — explicitly opt-in, per-person, no bulk-invite button, no "invite all your follows."

Optional. The market launches either way.

### Focus mode — no right rail, icon-only left rail

This is the *only* surface in the product that enters focus mode. Everywhere else the three-column shell holds (rail + center + right rail). Here it collapses to two narrow columns:

- **Left rail:** icons only (76px wide). No labels. The brand mark still shows at the top but the wordmark is hidden. The `Write a claim` CTA becomes a small warm-ink `＋` pill indicating *"you're here."* The Home icon is the escape hatch.
- **Right rail:** gone entirely.
- **Center:** narrower shell (max-width ~860px total) centered in the viewport. More whitespace on both sides. The composer breathes.

**Why:** Writing a claim and sizing a seed is the one moment in the product where we want *no* cross-traffic — no suggested markets, no feed-style previews, no "what people are trading now" rails. Every pixel that isn't the composer is noise at this moment. The four-step stepper and the inline live state (the claim visible in its big serif field, the image preview right where you upload it, the seed math in place) are all the feedback the author needs.

**What we lose by removing the right rail:** the always-visible portrait-card preview, the "why this step" tip card, and the progress chip. All three were helpful reinforcement but none was essential — each step's lede already explains what it's for, and the stepper is the progress indicator. If we discover users want a preview while composing, we'll revisit with an on-demand preview drawer (keyboard shortcut), not a persistent rail.

### Autosave

Every 5 seconds to localStorage, and to Nostr as a draft event where permissions allow. Indicator in the page head: `● Draft saved · 34s ago`. If the author closes the tab, they come back to what they had, on whichever step they were on.

---

## Post-publish — the sharing toolkit

This is the single most valuable surface in the product from a growth standpoint. Spend design effort on it accordingly.

### Hero

Celebratory but restrained. `● YOUR CLAIM IS LIVE` eyebrow in emerald. Big Inter Tight H1: *"Now help it find its readers."* A one-paragraph lede that re-anchors the alignment:

> Your claim sits at 71¢ YES with $100 of your own capital behind it. The price only moves when *other people* disagree. The more eyeballs you bring, the more signal the market gives you — and the more of your position remains.

Three metrics: seed / opening price / link. Two buttons: **Copy sharing link** (primary) and **View live market** (secondary).

On the right: the published claim rendered as a **portrait card**, tilted slightly, with a subtle shadow — a visual confirmation object. "This is the thing I just made."

### Share cards grid (2×2)

Four pre-rendered cards, sized to each surface:

1. **X / Twitter** — 1200×675 landscape
2. **LinkedIn** — 1200×627 landscape (alt composition, more sober)
3. **Instagram square** — 1080×1080
4. **Instagram Story** — 1080×1920 portrait (with a pull-quote from the case)

Each card uses the same visual language as the rest of the product (Fraunces claim, mono price, ink-on-warm background, minimal chrome) — readers of the tweet should recognise Cascade's brand without it being a logo-heavy ad.

Each card has a `Download` button. Hover shows the target dimensions.

**Design note:** the cards are *not* dynamically generated in the browser. Server renders them as static PNGs at publish time and serves them from a CDN URL (`cscd.io/og/{claim-id}/{surface}.png`). This is what makes them usable as Twitter link previews and Open Graph images.

### Side panel — four tools

**One-click share.** Tap Twitter, LinkedIn, Email, Nostr, or Copy link. Each opens the target surface pre-populated with copy that matches the tone of the destination.

**Copy · three tones.** Tabs: *Punchy · Thoughtful · Direct.* Each renders a draft post tailored for the author to use. The `Punchy` version for this BTC claim reads:

> I put $100 down that **Bitcoin prints above $150K in 2026**. The crowd's at 71¢ YES. If you disagree, take the other side — the market's open.
> *cscd.io/btc-150k-2026*

**Regenerate** button for when the author wants a variation. **Copy** button for grabbing the text as-is. No editing-in-place — if the author wants to rewrite, they compose it themselves.

**Embed.** Tabs: `iframe · markdown · html`. The iframe version is a responsive widget that renders the live claim with current crowd price — ideal for dropping into a Substack post or personal blog.

**QR · for print.** SVG QR code + the shortlink. Download as SVG or PNG. For the author who wants to put this on a slide, a sticker, a poster — we should not make them go to another tool for this.

### "What usually happens next" strip

Three numbered cards at the bottom:

1. **Watch.** Check who's taking the other side — notifications fire on counter-replies and meaningful NO positions.
2. **Write.** Publish a Note riffing on the claim. Cascade's crowd scans Notes differently than claim embeds — both work.
3. **Track.** Set a price-move alert at ±5¢ or $1K volume threshold.

This normalises the post-publish behaviour Cascade wants. Authors tend to publish and then disappear — these cards make it obvious there are three more small moves worth making.

---

## What this page is not

- **Not a rigid wizard.** A "wizard" implies a one-way street with gates between steps. Our flow is guided — you can jump back and forward, skip the optional step, and edit anything from the stepper. The four steps exist to make each surface feel comfortable, not to enforce a sequence.
- **Not a growth-hacking farm.** We don't ask for email invites. We don't auto-post to X, LinkedIn, or anywhere else. The `Bring your people` invite on step 4 is a per-person opt-in — no "invite all your follows" button, no bulk import. Sharing tools appear *after* publish, author-controlled.
- **Not a moderator's gate.** There is no review queue. No "are you sure?" modal before launch. The live preview and the four-step buildup are the review. Bad claims sink into low-volume purgatory; duplicate-ish claims compete on the author's ability to argue the thesis.

See [51-anti-patterns.md](./51-anti-patterns.md) for the list of things we explicitly reject.

---

## Metrics that tell us this surface is working

1. **Time-to-first-publish (median)** — from route-enter to publish-click. Target: under 4 minutes for an author with a thesis ready.
2. **Publish-to-share conversion** — what % of authors click any share tool on the post-publish screen. Target: >60%.
3. **48h seed-relative volume** — avg (volume traded in 48h after publish) / seed. If authors are bringing readers, this is >3×. If not, they're publishing into void.
4. **Seed abandonment rate** — fraction of users who reach the seed block and bounce. This is where churn hides. If >20%, we've made the seed feel too heavy; consider defaulting lower and letting them top up.

---

## Related

- [03 — Product primitives § Claim](./03-product-primitives.md) — what a claim *is*
- [20 — Components § Portrait card](./20-components.md) — the card shape the preview mimics
- [32 — Expression vs transaction](./32-expression-vs-transaction.md) — seed is a transaction, case is expression; the composer honors the split
- [42 — Page: Markets](./42-page-markets.md) — where published claims end up
- [51 — Anti-patterns](./51-anti-patterns.md) — what we don't do
