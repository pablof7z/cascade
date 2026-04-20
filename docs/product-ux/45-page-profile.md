# 45 — Page: Profile

A person's page. Activity-led, identity above, conviction in the rail.

**Reference:** no mock yet. Prior art (`H-the-study/04-profile.html`) is rejected — it framed users as *publications* with taglines, drift personalities, and Fraunces bios. Cascade users are not writers. They are people who post, reply, restack, and trade.

---

## Purpose

*"What has this person done on Cascade, and what are they backing right now?"*

Cascade's unique social signal is that you can see whether someone is putting money on what they're saying. The profile makes that observable in two glances:

1. **The activity feed** answers *what have they done*.
2. **The Open positions card** answers *what do they currently believe*.

Identity (avatar, name, NIP-05, bio) sits above as a thin band — never as the page's centerpiece.

---

## Route

```
/p/<identifier>
```

Where `<identifier>` is, in order of preference:

1. **NIP-05 string, verbatim** — if the profile metadata declares one. URL is literal: `/p/north@cascade.so`. The `@` is RFC-3986-legal in URL paths and is preserved as-is. No domain rewriting, no underscore substitution, no percent-encoding by us. Browsers and link rewriters that mishandle `@` are out of scope.
2. **`npub`** — when no NIP-05 is declared. URL is `/p/npub1qx…3kf`.

**Both URLs render** for any given person. There is no redirect chain. But every internal link in the app emits the canonical form (NIP-05 if present, else npub) via a single helper.

**Display name is never the URL.** Display names are not unique on Nostr; promoting them to URL would create silent collisions.

**No verification gate.** If `nip05` is declared in the profile metadata, we use it. We do not block rendering on a `.well-known` lookup. (Background revalidation may be added later for the verification glyph; the URL choice does not depend on it.)

---

## Composition

**Three-column shell** — same as Home, Markets, Market: 200px rail · center column · 340px right rail. Rail and right rail are sticky, identical to every other page.

The center column is the standard ~720px reading width. Profile is not a reading page (no Fraunces in the chrome) but it shares the shell — that's principle #10.

```
┌──────┬─────────────────────────────────┬──────────────┐
│      │  hero                           │              │
│ rail │  ─────────────────────          │  search      │
│      │  tab strip                      │              │
│      │  ─────────────────────          │  Open        │
│      │                                 │  positions   │
│      │  activity feed                  │              │
│      │   item                          │  Mutual      │
│      │   item                          │  ground      │
│      │   item                          │  (cross-view │
│      │   …                             │   only)      │
│      │                                 │              │
└──────┴─────────────────────────────────┴──────────────┘
```

---

## Hero

A compressed band. ~110px tall. No banner image, no background tint, no bookplate ornament.

```html
<header class="profile-hero">
  <span class="av av-N" aria-hidden="true">N</span>
  <div class="who">
    <div class="line">
      <span class="name">Nina Ortega</span>
      <span class="check" title="NIP-05 declared">◉</span>
      <span class="nip">north@cascade.so</span>
    </div>
    <p class="bio">Watches frontier-model release timing. Mostly wrong about Apple.</p>
    <div class="counts">
      <span><em>12</em> markets created</span>
      <span class="sep">·</span>
      <span><em>47</em> markets invested in</span>
      <span class="sep">·</span>
      <span>joined <em>Mar 2024</em></span>
      <span class="sep">·</span>
      <button class="copy-npub mono" title="Copy npub">npub1qx…3kf</button>
    </div>
  </div>
  <div class="actions">
    <button class="btn-ghost icon-btn" title="Share profile">⇪</button>
    <button class="follow-btn">+ Follow</button>
  </div>
</header>
```

### Tokens

| Element | Spec |
|---|---|
| Avatar | 96px square, warm-gradient as `20-components.md#avatars`. JetBrains Mono initial, weight 600. |
| `.name` | Inter Tight 600, 1.4rem, `--text`, `letter-spacing: -0.015em`. |
| `.check` (`◉`) | 0.85em, `--text-3`. **Renders whenever `nip05` is declared.** No background verification check. |
| `.nip` | Inter 400, 0.86rem, `--text-3`. Same line as the name. |
| `.bio` | Inter 400, 0.96rem, line-height 1.55, `--text-2`, `max-width: 56ch`. **No Fraunces.** No italic. People are not publications. |
| `.counts` | One row, JetBrains Mono 0.74rem, `--text-3`, letter-spacing 0.04em. `<em>` numerals lift to `--text-2` and are non-italic. |
| `.copy-npub` | Inline button styled as text. Click copies the full npub. Tooltip on hover. |
| `.follow-btn` | Primary CTA — warm-ink fill, dark text. Same shape as `+ Subscribe` in the byline component. Toggles to `Following` (ghost outline) when active. |
| `.actions` icon-btn | Share — copies the canonical profile URL to clipboard. |

### What is **not** in the hero

- No banner image. NIP-01 has a `banner` field; we ignore it. The Column does not have a place for arbitrary user-uploaded imagery as chrome.
- No follower count. Popularity is not a signal in The Column. Stake is the weight signal (principle #6); we do not introduce a parallel one for people.
- No "Following" count for the same reason — symmetry with no-follower-count.
- No `Message` button. DMs are not in the launch contract.
- No drift stat, no "right N% of the time" line, no "writes about X." Those framed people as publications.

### Display name fallback

Used when generating the `.name` text:

1. `profile.name` (NIP-01 short name)
2. `profile.display_name` (NIP-01 display name)
3. NIP-05 local-part (`north` from `north@cascade.so`)
4. Truncated npub: `npub1qx…3kf`

The hero never reads "Cascade user" or "Anonymous." If we have a key, we have a name — even if that name is just the truncated npub.

### Self-view differences

When the viewer's pubkey matches the profile pubkey:

- `+ Follow` is replaced by `Edit profile`, linking to `/profile/edit`. Same warm-ink fill.
- The Share icon button is preserved (you may want to copy your own URL).
- Nothing else changes. Self-view shows what others see — no private balances, no hidden P&L. Personal account state lives at `/portfolio`.

---

## Tab strip

Below the hero, above the feed.

```
[ All ] [ Notes 14 ] [ Replies 47 ] [ Trades 312 ] [ Claims 12 ]
```

Five tabs. Text-only, no pill chips. Underline + `--ink` color on active. Same `.view-tabs` component as the market page (`20-components.md#text-tabs`).

Counts in JetBrains Mono `.68rem` `--text-3`, beside the label. A tab with zero count is rendered but disabled (muted, no underline on hover, not clickable). A profile with zero of everything still renders all five tabs in disabled state — the structure is honest, not adaptive.

The default tab is **All**.

---

## Activity feed

The center column below the tab strip is a chronological mix of seven Cascade event types. Item shapes are the canonical ones from `33-feed-items.md` — we do not introduce profile-specific variants. Reusing existing shapes is principle #10.

### Items in the All feed

| Event | Shape | Notes |
|---|---|---|
| Note | Note feed-item | As on Home. |
| Reply | Quoted-parent reply card | Shows the parent claim title (Fraunces, single line) above the reply body. The claim title is the only Fraunces in the feed. |
| Claim publication | Claim-embed card | As on Home. |
| Restack | Restack feed-item | Author byline is the profile owner; quoted block is the original. |
| Notable trade | Trade-alert feed-item | See aggregation rule below. |
| Case revision | Case-revision feed-item | Only renders when the profile owner is a claim author. |

### Trade aggregation

A user can produce dozens of trades a week. Rendering each as a feed item turns the page into a ticker. So:

- The **All** feed includes only **notable trades**. A trade is notable if it (a) opens a new position, (b) closes a position, (c) crosses a $250 size threshold, or (d) is the user's first trade on a market.
- Routine trades (incremental adds, small re-balancing) **do not appear** in All. They are visible in the **Trades** tab and are reflected in the right-rail Open positions card.
- The Trades tab is the full ledger — every 983/981 event with the user's `p` tag, in mono trade-tape rows (`20-components.md#trade-tape-row`).

### Tab content rules

| Tab | Contents |
|---|---|
| All | Notes + Replies + Claim publications + Restacks + Notable trades + Case revisions |
| Notes | Notes only |
| Replies | Replies only, with parent-claim title quoted above |
| Trades | Every trade event, rendered as trade-tape rows. No feed-item cards. |
| Claims | Claim publications + Case revisions on those claims |

### Empty feed

When the active tab has zero items:

```
@north hasn't posted, replied, or traded yet.
```

Rendered as italic Inter 400, 0.96rem, `--text-3`, centered, ~3rem of vertical breathing room above and below. No CTA. No skeleton. No "discover" surface — a profile is not a marketing page.

When the **All** tab is empty (no activity at all), only this line renders below the tab strip. Per-tab empty messages adapt the verb (`hasn't replied yet`, `hasn't published a claim yet`, etc.).

---

## Right rail

Two cards on cross-view. One card on self-view. Search at the top, as on every page.

### Card 1 — Open positions (always)

The conviction signal. Up to 5 visible, then a `See all 29 positions →` link.

```html
<section class="rail-card">
  <header class="rail-card-head">
    <h3 class="tight">Open positions</h3>
    <a href="#all">See all 29 →</a>
  </header>
  <ol class="positions">
    <li class="pos">
      <span class="side y" aria-label="YES">YES</span>
      <a class="t serif" href="/market/openai-gpt5">OpenAI ships GPT-5 first.</a>
      <span class="sub mono">$2,400 · avg 62¢</span>
      <span class="pnl up mono">+$432</span>
    </li>
    …
  </ol>
</section>
```

- `.side.y` / `.side.n` — small mono pill, emerald or rose border + text. 0.66rem. Same as `H-the-study` `.pos .side` shape.
- `.t.serif` — Fraunces 500, 0.95rem. The market title is the only Fraunces in the rail card; everything else is sans/mono.
- `.sub` — JetBrains Mono 0.68rem, `--text-3`. Avg cost.
- `.pnl` — JetBrains Mono 0.78rem. `--yes` for `up`, `--no` for `down`, `--text-3` for `flat`.

Sort: by absolute size (largest first). Closed positions do not appear here — they live in the Trades tab.

If the person has **zero open positions**: the card renders with a muted single line — `No open positions.` — and no list. The card is not removed (structural symmetry).

### Card 2 — Mutual ground (cross-view only)

Renders when the viewer is signed in and is **not** the profile owner.

```html
<section class="rail-card">
  <header class="rail-card-head">
    <h3 class="tight">You both hold</h3>
    <span class="c mono">3</span>
  </header>
  <ol class="mutual">
    <li class="mg">
      <a class="t serif" href="/market/openai-gpt5">OpenAI ships GPT-5 first.</a>
      <div class="sides">
        <span class="me mono">you · YES $80</span>
        <span class="them mono">@north · YES $2,400</span>
      </div>
    </li>
    …
  </ol>
</section>
```

- `.t.serif` — Fraunces 500, 0.92rem.
- `.me` / `.them` — JetBrains Mono 0.7rem. Side color (`--yes` or `--no`) on the side label only; size in `--text-2`.
- The card surfaces **agreement and disagreement** equally — if you hold YES and they hold NO on the same market, render both rows in their respective colors. The product point is *we share an exposure to this market*, not *we agree*.
- Sort: largest combined exposure first.
- Cap at 6 rows. `See all N →` link if more.

If the viewer holds nothing in common: the card is **omitted** entirely (not rendered as an empty card). Cross-view falls back to a single-card right rail.

If the viewer is signed out: the card is omitted. (We do not show "Sign in to see mutual positions" — that's chrome upsell, principle says no.)

### Self-view — one card only

On self-view, Card 2 is omitted. The right rail contains the search and Open positions, then ends. The asymmetry is fine because the page is already structurally asymmetric (Edit vs Follow).

---

## Linkable identity rule

This is the rule the rest of the app must adopt for the profile page to do its job.

**Every render of a user's avatar or name must be a link to that user's canonical profile URL.**

Concretely, every one of these surfaces must wrap in an anchor pointing at `/p/<canonical-identifier>`:

- Avatar in the byline component (full and compact)
- Name in the byline component (full and compact)
- Avatar in the reply component (`.reply .av`)
- Name in the reply component (`.reply-head .name`)
- Voice-row avatars and names (`Who's in the thread`, `Subscribed by`)
- Mention components inside note/reply prose
- Restack attribution (`· restacked @north`)
- Trade-tape row handle (`@tessa` in `2s · BACK YES · @tessa · $40 · 71¢`)
- Position-badge owner — the badge itself does not link, but the adjacent name/avatar does
- Pcard `.pcard-author` line (`@north · Corporate timing`)
- Claim-embed footer author attribution
- Subscribed-to list on Home rail
- Author bylines on the market page Case tab
- Profile rail item — links to `/p/<your-canonical>`

Implementation: one helper, e.g. `profileHref(profile)`, returns the canonical URL. Every site that renders a user identity must use it. Drive-by audit during the implementation PR.

**No `target="_blank"`.** Profiles open in the same tab. Cascade is a single navigable space.

---

## Copy

| Surface | Copy |
|---|---|
| Hero CTA (cross, not following) | `+ Follow` |
| Hero CTA (cross, following) | `Following` (ghost outline; click to unfollow) |
| Hero CTA (self) | `Edit profile` |
| Hero share button tooltip | `Copy profile link` |
| NIP-05 glyph tooltip | `north@cascade.so` (the literal NIP-05) |
| npub copy button tooltip | `Copy npub` |
| Counts row (zero markets created) | `0 markets created` (do not hide) |
| Empty All tab | `@<handle> hasn't posted, replied, or traded yet.` |
| Empty Notes | `Nothing posted yet.` |
| Empty Replies | `No replies in any discussion yet.` |
| Empty Trades | `No trades on record.` |
| Empty Claims | `No claims published yet.` |
| Open positions empty | `No open positions.` |
| Mutual ground header | `You both hold` (when ≥1 shared) |

`<handle>` in copy resolves to the same display-name fallback as `.name`.

---

## Behaviors

- **Follow click** publishes/removes the relevant Nostr follow event. Optimistic UI — button toggles immediately, reverts on publish failure with a small rail-style error toast.
- **Share click** copies the canonical profile URL to the clipboard. No native-share sheet on desktop; on mobile, use `navigator.share` if available.
- **NPub copy** copies the full npub string. Brief inline confirmation (1.5s).
- **Tab change** updates the URL hash (`#notes`, `#replies`, `#trades`, `#claims`). No hash for `All` (the default). Browser back/forward works.
- **Activity feed pagination** — same pattern as Home (`40-page-home.md`): `Older →` cursor link at the bottom. No infinite scroll.
- **Re-render on follow change** — the rail item avatar (Profile entry) updates without page reload.

---

## What this page is not

- It is **not** a writer's column. There are no "dispatches," no "publication tagline," no italic Fraunces bio.
- It is **not** a credibility scorecard. There is no drift stat, no track record, no "right N% of the time" claim. Those are conclusions a reader draws from the activity, not a number we render for them.
- It is **not** a portfolio page. Aggregate balance, total P&L, cash on hand — those live at `/portfolio` and are private.
- It is **not** a follower list. Popularity is not a signal here.
- It is **not** a settings page. Editing happens at `/profile/edit`.

---

## Mobile

Below 880px, the right rail collapses below the center column (same as Markets and Home). The two rail-cards stack: Open positions first, Mutual ground second.

Below 640px, the left rail hides behind the global drawer pattern (deferred — see [91-open-questions.md](./91-open-questions.md)). The hero compresses: avatar shrinks to 64px and moves to a row of its own above the name; counts row wraps to two lines if needed.

The tab strip becomes horizontally scrollable (no chrome change — text tabs still text tabs, just with overflow).

---

## Open questions

- **NIP-05 background revalidation.** The `◉` glyph currently renders whenever `nip05` is declared. Should it dim when revalidation fails (e.g., `.well-known` returns 404 or pubkey mismatch)? Tentative: yes, dim to `--text-4`, but revalidate lazily — never block the render.
- **Mutual ground when the viewer is signed out.** Currently omits the card. Could also surface a "Sign in to see what you share" — but that's an upsell. Leaving omitted unless usage data shows users miss it.
- **Restack-of-restack** in the Replies tab — does the original surface? Defer to discussion-architecture decision.

---

## Next

- Implementation will live across `/p/[identifier]/+page.svelte`, the byline component, the reply component, the rail nav, the mention component, and the trade-tape row. The linkable-identity rule (above) is a cross-cutting refactor — not a single-page implementation.
- Update [`30-navigation-and-chrome.md`](./30-navigation-and-chrome.md) right-rail table — Profile row should read: *Open positions · Mutual ground (cross-view only)*.
- Remove the Profile entry from [`91-open-questions.md`](./91-open-questions.md) once the implementation lands.
