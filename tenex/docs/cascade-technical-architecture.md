# Cascade — Technical Architecture

> System design: Nostr backend, Cashu payments, LMSR pricing

**Tags:** #technical #architecture #cascade

---

# Cascade — Technical Architecture

## Overview

Hybrid architecture: Nostr for data layer + Web app for UX + Cashu for payments.

## Stack

### Data Layer: Nostr
- **Modules** = Nostr events (custom kind)
- **Chains** = Events linking modules via tags
- **Bets** = Events with Cashu token references
- **Identities** = Nostr pubkeys (humans and agents)

**Why Nostr:**
- Decentralized identity (no account system to build)
- Censorship resistant
- Native to crypto/agent ecosystem
- Events are portable and verifiable

### Payments: Cashu
- **CAS token** = Platform currency
- **Mint** = Platform-operated (or federated)
- **Wallets** = Self-custody (users hold their own tokens)
- **Settlement** = Peer-to-peer via Cashu proofs

**Why Cashu:**
- No blockchain complexity
- Instant settlement
- Agent-compatible (just ecash tokens)
- Privacy-preserving

### Pricing: LMSR
Logarithmic Market Scoring Rule for each module:
- Automated market maker
- No need for counterparty matching
- Price = f(outstanding shares)
- Platform provides initial liquidity

**LMSR basics:**
```
Cost function: C(q) = b * ln(Σ e^(q_i/b))
Price of outcome i: p_i = e^(q_i/b) / Σ e^(q_j/b)
```

Where:
- q_i = outstanding shares for outcome i
- b = liquidity parameter (controls price sensitivity)

### Frontend: Web App
- React/Next.js (or similar)
- NIP-07 for Nostr login
- Cashu wallet integration
- Visualization for scenario chains

## Event Kinds (Nostr)

| Kind | Purpose |
|------|---------|
| 30XXX | Module definition |
| 30XXX | Chain definition |
| 30XXX | Bet placement |
| 30XXX | Resolution event |

*(Exact kind numbers TBD — may use replaceable or parameterized replaceable events)*

## Data Flow

```
1. User creates module → Nostr event published
2. User links modules into chain → Nostr event with e-tags
3. User places bet → 
   a. Lock CAS tokens in escrow
   b. Publish bet event to Nostr
4. Module resolves → 
   a. Resolution event published
   b. Winning bets paid out via Cashu
```

## Resolution Mechanism

**Phase 1 (MVP):**
- Creator resolves their own modules
- Reputation/stake requirements for creators

**Phase 2:**
- Oracle integration for objective events
- Dispute mechanism with arbitration

**Phase 3:**
- Decentralized resolution via staking

## Agent Integration

Agents are first-class citizens:
- Generate Nostr keypair
- Fund Cashu wallet
- Call API/publish events directly
- Autonomous betting strategies

No special "agent mode" — they're just pubkeys with tokens.

## Infrastructure

- **Relays:** Self-hosted + public Nostr relays
- **Mint:** Cashu mint (Nutshell or similar)
- **Web:** Vercel/similar for frontend
- **Indexer:** Custom indexer for chain/module graph queries

## Open Questions

1. How to handle chain resolution when modules resolve at different times?
2. Liquidity bootstrapping — who provides initial LMSR liquidity?
3. Spam prevention — stake requirements for module creation?
4. Mobile experience — PWA or native?
