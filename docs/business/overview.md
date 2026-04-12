# Business Overview

## Vision

**Cascade is the pricing layer for scenario forecasting.**

Most prediction markets ask a single question: "Will X happen?" Cascade asks the next question: "If X happens, then what?" This compositional structure — theses referencing modules, scenarios referencing predictions — enables a market that reflects not just individual beliefs but the chains of reasoning that connect them.

---

## What Cascade Does

Cascade enables anyone to create and trade prediction markets for interconnected scenarios.

**For individuals**: Take positions on questions you have a view on. Earn if you're right. The price signals are visible to everyone — a public record of what informed participants believe.

**For analysts and researchers**: Create markets that encode your thesis. Cite related predictions as evidence. Earn from your insight before your analysis becomes consensus.

**For AI agents**: Trade markets, create analysis, operate as automated market makers — all using the same economics and mechanics as humans. Cascade should still expose a full machine-friendly API surface and a hosted `SKILL.md` onboarding path so agents can operate programmatically.

**For anyone who thinks carefully**: A structured epistemics tool. What does the market believe about the chain of consequences that follows from a given event?

---

## Revenue Model

Cascade's economics are embedded in the LMSR pricing curve and mint operations.

This is a volume-based model: more trading activity = more revenue. Creating good markets and attracting active traders is the growth flywheel.

No subscription charges. No listing costs. No per-market setup costs.

---

## Targets

| Milestone | Target |
|-----------|--------|
| First revenue | May 31, 2026 |
| Users | 1,000 by August 2026 |
| Profitability | Month 18 |

---

## Positioning

**"Polymarket asks 'Will X happen?' We ask 'If X happens, then what?'"**

Cascade is not trying to out-Polymarket Polymarket on atomic predictions. Cascade's differentiated layer is the compositional structure: theses built on modules, scenarios built on predictions, a graph of interconnected markets that reveals the market's collective model of the world.

---

## Competitive Differentiation

| Factor | Cascade | Competitors |
|--------|---------|-------------|
| Compositional markets | ✓ Theses reference modules | ✗ Isolated questions |
| Oracle required | ✗ Markets exhaust via economic forces; never formally closed | ✓ Most require oracles |
| Protocol | Nostr-native, censorship-resistant | Centralized or chain-specific |
| Agent parity | ✓ AI agents are first-class | ✗ Human-focused UX |
| Settlement layer | Cashu + Lightning (ecash) | Crypto wallets or fiat |
| Data portability | ✓ Everything is Nostr events | ✗ Platform-locked |

---

## Network Effects

Cascade's value compounds as more markets exist:

1. **Thesis-module graph density**: More modules → more material for thesis authors → better theses → more traders.
2. **Agent liquidity**: As AI agents trade and make markets, liquidity improves and price discovery becomes faster.
3. **Information network**: Related markets inform each other. Traders watching one market naturally watch its related markets.
4. **Creator incentives**: LMSR's early-buyer advantage means market creators are rewarded for being right first. Good creators build reputation and following.

---

## Infrastructure Advantages

**Nostr-native**: Data is censorship-resistant and portable. No platform lock-in. Third parties can build on top without permission.

**Cashu ecash**: Private, instant, Lightning-backed settlement. No KYC requirements embedded in the protocol.

**No oracle by default**: Removes a critical dependency and attack surface. Markets reach equilibrium through trading and withdrawal — no trusted party ever declares an outcome.

**Open protocol**: Alternative front-ends, analytics tools, and agent integrations are possible without permission because market definitions, trade records, and discussions are public Nostr events and the product surface can be exposed through machine-friendly APIs.
