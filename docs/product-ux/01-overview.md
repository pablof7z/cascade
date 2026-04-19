# 01 — Overview

## What Cascade is, in one paragraph

Cascade is a prediction market where **a claim is a sentence someone has written** ("OpenAI will ship GPT-5 before Google ships Gemini 2 Pro.") and **the price is what the crowd is willing to pay for the YES side today**. Claims never expire. There is no oracle, no judge, no resolution. A user opens a position by spending USD on YES or NO; they exit whenever the price works for them. Every trade is public. Every claim is authored. The product's job is to make *defending a thesis* and *taking a position* feel like two sides of the same act, without collapsing them into one UI.

See [`docs/HOW-IT-WORKS.md`](../HOW-IT-WORKS.md) for the mechanical detail and [`docs/product/overview.md`](../product/overview.md) for the spec.

## What *The Column* is

A design direction — one of several explored in `proposals/agency-2026-04/`. The name is lifted from *"writer's column"*: each author has a publication, each claim is a dispatch from that column, and the homepage is a reading surface that looks like a curated feed rather than a trading dashboard.

The Column's thesis, stated plainly:

> **Cascade is a writer's product with a trade button. Not a trading product with a comments section.**

That sentence is the difference between The Column and every other direction we considered.

## What The Column is (tactically)

- **Workspace chrome, essay content.** The rail, the breadcrumbs, the search, the right rail — all tool-native Inter at 14px. The *inside* of a claim — title, author's case, threaded replies — gets the editorial treatment.
- **Three-column shell.** Left rail (200px, fixed), center reading column (max 720px), right rail (340px with two calm cards). Identical across every tab so navigating feels like changing *what you're looking at*, not *what app you're in*.
- **Substack-shaped information architecture.** Home is a mixed feed (notes, claims, trade alerts, restacks). Subscriptions is a reading inbox. Markets is a category-first browse. Market pages have tabs (Case · Discussion · Trades · Linked).
- **Serif used surgically.** Fraunces appears only on claim titles and anchor-quotes. Everything else — nav, chrome, comments, buttons, tabs, metadata — is Inter or JetBrains Mono.
- **Expression and transaction are separate.** Compose for expression (notes, replies); the right-rail trade module for transaction (Back YES / Back NO). They never merge into one button.
- **Positions are states, not actions.** A user's position in a market is a standing fact derived from 983 trade events. It appears as a small badge (`YES · $120`) next to their name in discussions. It is *not* something you attach to a reply.

## What The Column isn't

We rejected these directions after building mocks of each. See [51-anti-patterns.md](./51-anti-patterns.md) for the long list.

- **The Terminal / The Desk.** Bloomberg-shape dashboard with data grids and filter pills. Too tool-y. It made every claim feel like a row, not a sentence.
- **The Gazette.** Newspaper costume — masthead, dateline, "Vol. 2 No. 47", double-rule dividers. Too much theater; the metaphor made Cascade feel like a re-enactor, not a modern product.
- **The Trace.** Edward Tufte data-first with hairline grids and sparkline rows. Beautiful but cold — the people and their arguments disappeared.
- **The Floor.** Twitter-chrome heterogeneous feed. Close to what The Column eventually became, but the chrome felt social-media rather than editorial.
- **The Feed (mobile-native).** Hold-to-commit phone app. The right answer for mobile, but not the right anchor for the whole product.

## Direction confidence

The Column is the chosen direction as of April 2026. Explorations above the line are archived. If a future question arises, we start from **the principles** ([02](./02-design-principles.md)) before introducing any new visual pattern.

## The thirty-second version (for new joiners)

Cascade is a prediction market where claims are sentences. The Column is a Substack-shaped reading app with a quiet trading module in the right rail. Serif on the argument, sans on everything else. Categories are nav. Position is a state, not a button. Expression and transaction never share a UI. Neutrals + emerald + rose + warm ink. That's it.

## Next

- [02 — Design principles](./02-design-principles.md) — the laws that make everything else fall into place.
- [03 — Product primitives](./03-product-primitives.md) — the things Cascade has (claims, cases, replies, notes, trades, positions).
