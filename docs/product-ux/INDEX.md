# Cascade Product UX — The Column

*A design system anchor for the direction known as **The Column**.*

This is the source of truth. Every decision we've made — from why comments are sans-serif to why the compose box doesn't carry a stake — is anchored in one of the documents below. Engineering and design both work against this index.

**Direction reference implementations:** `proposals/agency-2026-04/K-the-column/*.html`

---

## How to use this doc

- **Designing a new screen?** Start at [Design principles](./02-design-principles.md), then [Page specs](#pages), then [Components](./20-components.md).
- **Implementing a component?** Read the relevant [Component](./20-components.md) entry plus [Visual system](#visual-system) for tokens.
- **Writing copy?** [Voice & copy](./50-voice-and-copy.md) + the repo's existing [`docs/copy/brand-voice-strategy.md`](../copy/brand-voice-strategy.md).
- **Something feels off?** Check [Anti-patterns](./51-anti-patterns.md) — we've probably rejected it already.
- **Don't know where to look?** [File reference](./90-file-reference.md) maps every pattern to a mock HTML file.

---

## Foundations

Start here. These three define what we're building and why each visual choice exists.

- [**01 — Overview**](./01-overview.md) — What Cascade is (the mechanic in one paragraph), what *The Column* is as a design direction, and what it isn't.
- [**02 — Design principles**](./02-design-principles.md) — The ten laws that anchor every decision. Each one has a *why* and a *where it applies*.
- [**03 — Product primitives**](./03-product-primitives.md) — Claim, case, reply, note, trade, restack, position, subscription, category, linked market. The content model.

## Visual system

Tokens. These are non-negotiable.

- [**10 — Color**](./10-color.md) — Palette, semantic roles, warm-ink accent, the emerald/rose restraint.
- [**11 — Typography**](./11-typography.md) — Inter, Inter Tight, Fraunces, JetBrains Mono — and *exactly* where each is used.
- [**12 — Layout & space**](./12-layout-and-space.md) — Three-column shell, container widths, gutters, breakpoints, vertical rhythm.
- [**13 — Motion & interaction**](./13-motion-and-interaction.md) — Hover, focus, stream-in animation. No spinners. No skeletons.

## Components

- [**20 — Component library**](./20-components.md) — Rail, topbar, tabs, chips, buttons, inputs, avatars, byline, position badge, reply, compose, market embed, claim embed, rail-card, up-item, trade tape row, sparkline thumbnail, split bar. Specs, classes, HTML examples.

## Patterns

Higher-order compositions. These live above components and below pages.

- [**30 — Navigation & chrome**](./30-navigation-and-chrome.md) — The shared rail, the breadcrumb, the topbar, what persists across tabs.
- [**31 — Discussion architecture**](./31-discussion-architecture.md) — Threading model (1 level visible), sort tabs, anchored quotes, holders filter.
- [**32 — Expression vs transaction**](./32-expression-vs-transaction.md) — The most important separation in the product. Where replies happen, where trades happen, and why they're never the same UI.
- [**33 — Feed items**](./33-feed-items.md) — The seven item types that can appear in Home (note, note-with-stake, trade alert, claim publication, image/evidence, restack, case revision, cash-out).

## Pages

The pages that exist today. Each document describes purpose, layout, component composition, copy, and empty states.

- [**40 — Home**](./40-page-home.md) — The mixed feed.
- [**41 — Subscriptions**](./41-page-subscriptions.md) — The reading inbox.
- [**42 — Markets**](./42-page-markets.md) — Category-first browsing.
- [**43 — Market (case + discussion)**](./43-page-market.md) — The tabbed post-page: Case, Discussion, Trades, Linked.
- [**44 — Write a claim (+ sharing toolkit)**](./44-page-create.md) — The composer and the post-publish sharing surface. Where author incentives and product growth align.

## Conduct

Things that would embarrass us if we got them wrong.

- [**50 — Voice & copy**](./50-voice-and-copy.md) — Product-specific vocabulary, tone per surface. Extends the repo's brand-voice doc.
- [**51 — Anti-patterns**](./51-anti-patterns.md) — Every pattern we've tried and rejected, with the reason. Check here before introducing anything "new."
- [**52 — Accessibility**](./52-accessibility.md) — Keyboard, focus, contrast, semantic HTML baseline.

## Reference

- [**90 — File reference**](./90-file-reference.md) — Every mock HTML file mapped to the patterns and pages it demonstrates.
- [**91 — Open questions & roadmap**](./91-open-questions.md) — What we haven't decided yet. What's explicitly next.

---

## The thirty-second version (for new team members)

Cascade is a prediction market where claims are sentences, prices are the crowd's confidence, and positions never expire. **The Column** is the direction we've chosen: *workspace chrome, essay content* — a Substack-shaped reading app with a trading module in the right rail, tied together by a three-column shell. Serif (Fraunces) appears only on the argument itself — claim titles, anchor quotes. Sans-serif (Inter) everywhere else including comments. Categories are navigation, not sections. Position is a standing state about a person; it is never attached to a reply. Expression and transaction are separate UI actions that never merge. The color restraint is absolute: neutrals + emerald (YES) + rose (NO) + a single warm-ink accent (`#efe7d3`) for the primary CTA, wordmark, and author publication names.

Now read [01-overview.md](./01-overview.md).
