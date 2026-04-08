# Cascade Documentation

Comprehensive documentation for the Cascade prediction markets platform. Covers product design, technical architecture, and business context.

---

## Product

### [product/overview.md](product/overview.md)
What Cascade is and why it exists. Covers the module/thesis distinction, LMSR pricing, human-agent parity, and the core differentiator: "Polymarket asks 'Will X happen?' Cascade asks 'If X happens, then what?'"

### [product/market-lifecycle.md](product/market-lifecycle.md)
How markets are created, how they trade, and how they close. Key invariants: markets never expire, never close by decree. They close by economic gravity — arbitrage and redemption, not admin action.

### [product/modules-vs-theses.md](product/modules-vs-theses.md)
The two market types in detail. Modules are atomic yes/no predictions. Theses are higher-order beliefs that reference modules as informational evidence. Critical: modules do NOT mathematically determine thesis probabilities. Each market's price is set by its own trading activity only.

---

## Technical

### [technical/lmsr.md](technical/lmsr.md)
Full explanation of the Logarithmic Market Scoring Rule — the automated market maker powering every Cascade market. Covers the cost function, price formulas, buying/selling mechanics, solvency guarantee, and the `b` parameter. Implementation reference: `src/market.ts`.

### [technical/nostr-events.md](technical/nostr-events.md)
Complete reference for all Nostr event kinds used by Cascade. Includes full tag schemas for kinds 982 (market), 983 (trade), 984 (resolution), 1111 (discussions), 10003 (bookmarks), and 30078 (positions).

### [technical/mint.md](technical/mint.md)
The Cascade Mint: why it's custom, how it works, keyset model, LMSR state authority, custom endpoints (`/trade`, `/redeem`, `/settle`), NUTs implemented, and fee model.

### [technical/frontend.md](technical/frontend.md)
Frontend architecture: SvelteKit + Svelte 5, NDK for Nostr, route map, auth model, no-loading-spinner rule, no-mock-data rule, styling constraints.

### [technical/backend.md](technical/backend.md)
Backend architecture: Rust + PostgreSQL + LND. The mint as authoritative LMSR state. Architecture layers from HTTP API through LMSR engine to Lightning.

### [technical/authentication.md](technical/authentication.md)
Identity and auth model. Users are Nostr keypairs. nsec in localStorage, never sent to server. NIP-46 remote signing support. No Nostr jargon in user-facing UI.

### [technical/positions-portfolio.md](technical/positions-portfolio.md)
How positions are stored (kind 30078 NIP-78 events), PnL calculation, portfolio and profile pages, and the future path toward kind 983-based position derivation.

---

## Design

### [design/style-guide.md](design/style-guide.md)
Full brand style guide. Dark theme on `neutral-950`. Emerald (bullish) and rose (bearish) accents only. Inter for text, JetBrains Mono for numbers. No spinners, no pills, no gradients, no blue tint.

### [design/product-decisions.md](design/product-decisions.md)
Authoritative list of explicit decisions from Pablo (the project owner). Covers architecture, mint, market creation, UI/UX, and data decisions. Every agent and contributor must read this before making product or architecture decisions.

---

## Business

### [business/overview.md](business/overview.md)
Vision, revenue model (1% rake on all trades), targets (first revenue May 2026, 1,000 users by August), competitive positioning, and network effects.

### [business/agents.md](business/agents.md)
AI agents as first-class Cascade participants. Protocol parity with humans, what agents can do, why agent liquidity matters, and the human-agent parity design constraint.

---

## Legacy Docs (`tenex/docs/`)

The `tenex/docs/` directory contains additional reference material including competitive analysis, roadmaps, growth briefs, design doctrine, and working documents. These are not replaced by the above — they provide supplementary context.

Key files in `tenex/docs/`:
- `PRODUCT-DECISIONS.md` — original product decisions (authoritative source, mirrored in `design/product-decisions.md`)
- `STYLE-GUIDE.md` — original style guide (mirrored in `design/style-guide.md`)
- `cascade-technical-architecture.md` — early architecture notes
- `cascade-business-plan-master.md` — full business plan
- `cascade-roadmap.md` / `cascade-roadmap-2026-q2.md` — roadmap docs
- `nostr-kinds.md` — Nostr kind reference (earlier version)
- `kind-983-trade-event.md` — kind 983 specification detail
