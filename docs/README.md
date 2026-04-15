# Cascade Documentation

Comprehensive documentation for the Cascade prediction markets platform. Covers product design, technical architecture, and business context.

---

## Product

### [product/overview.md](product/overview.md)
What Cascade is and why it exists. Covers the module/thesis distinction, LMSR pricing, human-agent parity, and the core differentiator: "Polymarket asks 'Will X happen?' Cascade asks 'If X happens, then what?'"

### [product/spec.md](product/spec.md)
Canonical product-surface specification synthesized from the final React app, corrected to match current Cascade mechanics. Covers route ownership, major product areas, core flows, and which React-era behaviors to preserve versus discard.

### [product/market-lifecycle.md](product/market-lifecycle.md)
How markets are created, how they trade, and why they never close by decree. Key invariants: markets never expire, and economic exhaustion happens through trading pressure rather than admin action.

### [product/modules-vs-theses.md](product/modules-vs-theses.md)
The two market types in detail. Modules are atomic yes/no predictions. Theses are higher-order beliefs that reference modules as informational evidence. Critical: modules do NOT mathematically determine thesis probabilities. Each market's price is set by its own trading activity only.

---

## Technical

### [mint/index.md](mint/index.md)
Canonical entry point for the Cascade mint docs. Explains what the mint owns, how buys and sells work, and where the detailed mint docs live.

### [mint/architecture.md](mint/architecture.md)
Mint internals: state authority, keysets, endpoints, trade lifecycle, swap semantics, and kind 983 publishing.

### [mint/api.md](mint/api.md)
Canonical machine-interface doc for agents and other programmatic clients. Covers current mint routes, the required product API surface beyond raw trade execution, public analytics, and hosted `SKILL.md` onboarding.

### [mint/lmsr.md](mint/lmsr.md)
Full explanation of the Logarithmic Market Scoring Rule — the automated market maker powering every Cascade market. Covers the cost function, price formulas, buy/sell mechanics, reserve dynamics, and solvency guarantee.

### [mint/auth.md](mint/auth.md)
Cashu bearer model, optional NIP-98 request attribution, `983` `p`-tag semantics, and why plain swaps do not emit market events.

### [technical/nostr-events.md](technical/nostr-events.md)
Complete reference for all Nostr event kinds used by Cascade. Includes full tag schemas for kinds 982 (market), 983 (trade), 1111 (discussions), 10003 (bookmarks), and 30078 (positions). Cascade does not use a market-resolution kind.

### [technical/frontend.md](technical/frontend.md)
Frontend architecture for the active `web/` app, plus historical context from the removed legacy `webapp/` migration where relevant.

### [technical/backend.md](technical/backend.md)
Backend architecture: Rust + PostgreSQL + LND. The mint as authoritative LMSR state. Architecture layers from HTTP API through LMSR engine to Lightning.

### [technical/authentication.md](technical/authentication.md)
Identity and auth model. Users are Nostr keypairs. nsec in localStorage, never sent to server. Covers current local/NIP-07 signing, planned NIP-46 support, and optional NIP-98 request attribution for mint trades. No Nostr jargon in user-facing UI.

### [technical/cascade-cli.md](technical/cascade-cli.md)
Target command surface for the Rust `cascade` CLI used by humans and skills. Defines the full machine-first interface including `market create`, proof-native trading, portfolio funding, local proof management, profile actions, bookmarks, and discussion writes.

### [technical/positions-portfolio.md](technical/positions-portfolio.md)
How positions are stored (kind 30078 NIP-78 events), PnL calculation, portfolio and profile pages, and the constraints around any future kind 983-based position derivation.

---

## Design

### [design/style-guide.md](design/style-guide.md)
Full brand style guide. Dark theme on `neutral-950`. Emerald (bullish) and rose (bearish) accents only. Inter for text, JetBrains Mono for numbers. No spinners, no pills, no gradients, no blue tint.

### [design/product-decisions.md](design/product-decisions.md)
Authoritative list of explicit decisions from Pablo (the project owner). Covers architecture, mint, market creation, UI/UX, and data decisions. Every agent and contributor must read this before making product or architecture decisions.

---

## Business

### [business/overview.md](business/overview.md)
Vision, economics model, targets (first revenue May 2026, 1,000 users by August), competitive positioning, and network effects.

### [business/AGENTS.md](business/AGENTS.md)
AI agents as first-class Cascade participants. Protocol parity with humans, what agents can do, why agent liquidity matters, and the human-agent parity design constraint.

---

## Plan

### [plan/web-launch-implementation.md](plan/web-launch-implementation.md)
Canonical implementation checklist for the full `web/` launch surface. Covers the route inventory, route-by-route feature requirements, workspace scope, cleanup of non-product template routes, and the exact criteria for considering the frontend launch-ready.

---
