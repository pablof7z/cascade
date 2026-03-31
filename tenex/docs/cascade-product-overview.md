# Cascade — Product Overview

> Vision, core concepts, and differentiation for the Cascade prediction market platform

**Tags:** #cascade #product #prediction-markets #thesis #module #no-oracle

---

# Cascade — Product Overview

## Vision

Cascade is a **prediction market for interconnected beliefs** — where atomic predictions inform broader theses about the world.

Traditional prediction markets treat events as isolated. Cascade recognizes that predictions form **evidence networks** — the outcome of one event updates our beliefs about many others.

## Core Primitives

### 1. Modules

**Time-bounded predictions with clear real-world anchors.**

A Module is an atomic market tied to observable reality:
- Has a clear real-world event that will reveal the outcome
- Binary or categorical outcome
- Examples:
  - "Lakers win 2025 NBA Championship" (game happens, outcome observable)
  - "Fed cuts rates by 50bps in March 2025" (FOMC announces, outcome observable)
  - "Bitcoin exceeds $150k before July 2025" (price is public, outcome observable)

Modules are the **building blocks** — factual, verifiable, anchored to reality.

### 2. Theses

**Ongoing beliefs about the world, informed by modules as evidence.**

A Thesis is a higher-order market representing a worldview:
- Not strictly time-bounded (or very long horizon)
- Probability updates based on module price movements
- Modules serve as **concurrent evidence streams**, not sequential steps
- Examples:
  - "US enters recession in 2025"
  - "AI displaces 50% of white-collar jobs by 2030"
  - "Commercial real estate market collapses"

**Key insight:** Modules are not a "chain" of sequential events. They are **concurrent evidence** that informs belief in the thesis.

### Evidence Relationships

When creating a thesis, you specify how each module relates:
- **Supports if YES**: Module going to 100% is evidence FOR the thesis
- **Supports if NO**: Module going to 0% is evidence FOR the thesis
- **Weight**: How strongly this module's price should influence thesis probability

## Market Mechanics

### Both Are Markets

Modules and Theses are **both tradeable markets** with:
- Their own bonding curve
- Their own price (probability)
- Their own liquidity pool
- Buy/sell mechanics identical

The difference is **composition**, not betting mechanics.

### Bonding Curves

Using LMSR or Bancor-style curves:
- Price discovery through automated market maker
- Liquidity provided by the curve, not order books
- Price = current probability estimate

### No Resolution Mechanism — Markets Close Themselves

**There is no oracle. No DAO vote. No "resolution" event.**

Markets close through natural economic forces:

1. **Reality reveals itself** — the game ends, the announcement happens, the price is public
2. **Tokens become redeemable** — winning side tokens are worth $1, losing side worth $0
3. **Arbitrage kicks in** — traders buy underpriced winners, sell overpriced losers
4. **Price converges** — market naturally goes to 100%/0%
5. **Liquidity drains** — holders redeem valuable tokens, destroying market cap
6. **Market "closes"** — not by decree, but by economic exhaustion

This removes an entire category of trust problems:
- No oracle manipulation
- No dispute resolution needed
- No governance overhead
- Just markets doing what markets do when information asymmetry disappears

**For Theses:** Same dynamic, but the "reality" is fuzzier. Thesis markets may persist longer, with prices updating as supporting modules move. A thesis might drain slowly over years as evidence accumulates, or remain active indefinitely as a living belief market.

## What Makes Cascade Different

| Aspect | Traditional PM | Cascade |
|--------|----------------|---------|
| Market structure | Isolated events | Evidence networks |
| Composition | None | Modules inform Theses |
| Resolution | Oracle/admin | Natural market dynamics |
| Closure | Declared | Liquidity drain |
| Insight capture | "X will happen" | "X happening means Y is more likely" |

## Platform Principles

1. **Ships empty** — No pre-created markets. All modules and theses created by users/agents.

2. **Human-agent parity** — Agents can create, trade, and participate. No distinction in protocol.

3. **Nostr-native** — All markets and trades are Nostr events. Portable, censorship-resistant.

4. **Permissionless composition** — Anyone can create a thesis using any public modules.

5. **No oracles** — Markets close themselves through economic incentives, not trusted third parties.

## Open Questions

- Module creator royalties when used in theses
- Thesis probability update algorithm (track module prices? Bayesian? manual?)
- Invalid/ambiguous outcomes (market stays open forever? special handling?)
