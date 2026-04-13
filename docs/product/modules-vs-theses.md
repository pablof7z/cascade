# Modules vs Theses

Cascade has two types of markets: **modules** and **theses**. Both are fully tradeable prediction markets with their own LMSR bonding curves. The difference is in what they represent and how they relate to each other.

---

## Modules

A module is an **atomic prediction**. It asks a single, binary, observable question about the world.

**Characteristics:**
- One clear real-world event
- Binary directional market: LONG or SHORT
- Defined observable condition (no ambiguity about what the question is asking)
- Independent market — its price is set solely by trading activity on this module
- Tradeable by anyone

**Examples:**
- "Will BTC close above $100,000 on any day in 2026?"
- "Will the US Federal Reserve cut rates at their May 2026 meeting?"
- "Will OpenAI announce GPT-5 before June 30, 2026?"
- "Will inflation (CPI) drop below 2.5% year-over-year by Q3 2026?"

Modules look and work like Polymarket questions. They're the atomic unit of prediction in Cascade.

---

## Theses

A thesis is a **higher-order belief** — a market about a more complex scenario. A thesis typically references one or more modules as supporting evidence.

**Characteristics:**
- Represents a compound scenario or chain of logic
- References modules that inform the thesis reasoning
- Has its own independent LMSR market — its price is set solely by trading on the thesis
- Tradeable by anyone
- Anyone can create a thesis using any public modules (permissionless composition)

**Examples:**
- "If BTC breaks $100k, ETH will outperform through the 2026 cycle" (references the BTC/100k module)
- "The AI infrastructure supercycle continues through 2027, driven by enterprise adoption and energy capex" (references multiple AI/energy/enterprise modules)
- "The 2026 US midterms will shift power dynamics enough to stall the current legislative agenda" (references election and policy modules)

---

## The Relationship: Informational, Not Mathematical

This is the most important thing to understand about modules and theses.

**Modules are informational links within a thesis. Full stop.**

When a thesis cites a module, it is saying: "Here is a related prediction that informs my reasoning." It is not saying: "My probability is derived from this module's probability."

The thesis's price is determined entirely by people trading the thesis. The module's price is determined entirely by people trading the module. Neither influences the other mechanically.

### Why this matters

Consider this thesis: "If BTC breaks $100k, ETH will outperform through the cycle."

The module "Will BTC break $100k in 2026?" might trade at 55%. But the thesis might trade at 70% — because traders believe that *if* BTC does break $100k, the ETH outperformance scenario is highly likely. The thesis is asserting a conditional relationship, not a joint probability.

Or the thesis might trade at 30% — even if the BTC module is at 80% — because traders believe the ETH outperformance argument is weak regardless of BTC's price.

The thesis price reflects the market's view on the full scenario as argued by the thesis author. Not a formula. Not an aggregation.

### The hard invariant

**Do not add code that mathematically couples module prices to thesis probabilities.** This has been explicitly decided and repeatedly confirmed. If you're tempted to write `thesisPrice = f(modulePrice1, modulePrice2)`, stop.

Each market's probability is an independent signal. The value of having them co-located in a thesis is the transparency of reasoning — not algorithmic combination.

---

## Permissionless Composition

Anyone can create a thesis using any public module. You don't need permission from the module creator. This is by design.

The result: a rich graph of related predictions, where theses build on modules, modules inform multiple theses, and the overall structure reveals the market's collective model of how the world hangs together.

---

## Creator Advantage

The market creator is always the first buyer. Because LMSR prices are lowest when the reserve is smallest, the creator gets the cheapest entry price on their own market.

This creates a natural alignment: if you believe your prediction strongly enough to create a market, you're rewarded for being first. It also means poorly-reasoned markets are costly to create — you're committing capital to your own thesis.

---

## Summary

| | Module | Thesis |
|---|--------|--------|
| What it represents | Atomic yes/no prediction | Compound scenario / chain of beliefs |
| References | Nothing | One or more modules (informational) |
| LMSR market | Yes — independent | Yes — independent |
| Price determination | Its own trading only | Its own trading only |
| Mathematical coupling | N/A | **None** — modules do not determine thesis price |
| Creator seeds liquidity | Required | Required |
| Who can create | Anyone | Anyone |
| Who can reference | N/A | Anyone can reference any public module |
