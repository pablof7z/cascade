# Cascade — Risks & Mitigations

> Key risks and how to address them

**Tags:** #risks #strategy #cascade

---

# Cascade — Risks & Mitigations

## Critical Risks

### 1. Regulatory Risk
**Threat:** Real-money prediction markets face gambling regulations

**Impact:** High — could force shutdown or geo-restrictions

**Mitigations:**
- Start with play money (no real stakes)
- Geo-restrict to favorable jurisdictions (not US)
- Structure as "information market" for research
- Decentralize operations sufficiently
- Legal review before real-money launch
- Cashu provides some privacy/plausible deniability

**Status:** Must address before real-money launch

### 2. Cold Start Problem
**Threat:** Empty platform has no value

**Impact:** High — chicken-and-egg for network effects

**Mitigations:**
- Seed initial modules on launch (team-created)
- Incentivize early creators (bonus CAS)
- Partner with forecasting communities
- AI agents can bootstrap activity
- Target news events for immediate relevance

**Status:** Plan required for launch

### 3. Complexity vs Adoption
**Threat:** Chains harder to understand than flat bets

**Impact:** Medium — limits mainstream appeal

**Mitigations:**
- Excellent onboarding/tutorials
- Start simple (2-module chains)
- Visual chain builders
- "Suggested chains" for new users
- Polymarket-style simple bets as gateway

**Status:** UX priority

### 4. Liquidity Bootstrapping
**Threat:** LMSR requires initial liquidity per module

**Impact:** Medium — cost to platform, thin markets initially

**Mitigations:**
- Small initial liquidity (accept wide spreads early)
- Liquidity mining rewards
- Creator stakes part of liquidity
- Dynamic liquidity based on interest
- Cross-subsidize popular modules

**Status:** Economic model needed

### 5. Resolution Disputes
**Threat:** Contested outcomes, bad-faith resolutions

**Impact:** Medium — trust erosion

**Mitigations:**
- Clear resolution criteria required
- Reputation system for creators
- Dispute mechanism with arbitration
- Stake requirements for module creation
- Eventually: decentralized oracles

**Status:** Design dispute system before launch

### 6. Competition
**Threat:** Polymarket copies the model

**Impact:** Medium — they have brand, liquidity

**Mitigations:**
- Move fast, establish position
- Nostr/agent integration as differentiator
- Community/culture moat
- Open source parts to build ecosystem
- Focus on compositional complexity they can't easily copy

**Status:** Execution risk

### 7. Agent Manipulation
**Threat:** Agents collude or exploit pricing

**Impact:** Low-Medium — market integrity

**Mitigations:**
- Rate limiting
- Position limits
- Anomaly detection
- Transparent agent identification
- Human-only modules option

**Status:** Monitor post-launch

## Risk Matrix

| Risk | Likelihood | Impact | Priority |
|------|------------|--------|----------|
| Regulatory | High | Critical | 1 |
| Cold start | Medium | High | 2 |
| Complexity | Medium | Medium | 3 |
| Liquidity | Medium | Medium | 4 |
| Disputes | Medium | Medium | 5 |
| Competition | Medium | Medium | 6 |
| Agent manipulation | Low | Medium | 7 |

## Open Questions

1. What jurisdiction to incorporate/operate from?
2. Play money first or go straight to real money?
3. How much initial liquidity budget needed?
4. Centralized mint or federated?
5. What's the minimum viable dispute mechanism?
