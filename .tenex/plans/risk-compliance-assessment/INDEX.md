# Risk & Compliance Assessment: Real Money Integration

## Context

Cascade is a prediction market platform built on:
- **Frontend**: SvelteKit
- **Mint**: Rust CDK-based Cashu mint with custom LMSR pricing
- **Payments**: Cashu ecash tokens, Lightning via NUT-05
- **Identity**: Nostr pubkeys (no centralized user database)
- **Events**: Nostr kind 982 (markets), kind 30078 (positions)
- **Revenue**: 2% rake on winning payouts

### Current Compliance State

**Zero compliance infrastructure exists.** The platform has:
- No KYC/identity verification
- No geo-fencing or jurisdiction restrictions
- No rate limiting or position limits
- No anomaly detection or transaction monitoring
- No sanctions screening (OFAC/EU)
- No AML procedures

An existing risk document (`tenex/docs/cascade-risks-mitigations.md`) identifies regulatory risk as Priority 1 and proposes geo-restricting, play-money-first, and legal review as mitigations — but none are implemented.

### Terms of Service Gaps

Current ToS (`src/routes/legal/terms/+page.svelte`) covers beta disclaimers and 18+ age requirements but lacks:
- Governing law / jurisdiction clause
- Arbitration or dispute resolution mechanism
- Restricted jurisdictions list
- AML/sanctions compliance statement
- Real-money-specific provisions
- Privacy policy aligned with GDPR/state privacy laws

### Core Architectural Challenge

Cashu ecash is a **bearer instrument** — tokens are anonymous by design. The mint operator custodies value but cannot see who holds tokens. This creates a fundamental tension between the privacy properties that make Cashu attractive and the compliance requirements for real-money operation.

### Target Milestones (from product decisions)

- First revenue: May 31, 2026
- 1,000 users: August 2026

## Approach

This assessment uses a **risk-tiered, jurisdiction-aware** approach rather than attempting blanket compliance with all global regulations simultaneously. The strategy:

1. **Identify the regulatory landscape** — Map which regulations apply based on platform architecture and target jurisdictions (US, EU).
2. **Design tiered KYC** — Progressive identity verification that balances Cashu's privacy properties with compliance needs at different volume thresholds.
3. **Engineer fraud prevention** — Technical measures for sybil resistance and market manipulation that work within Cashu's bearer-token model.
4. **Phase the rollout** — Dependency-ordered implementation that achieves compliance before real-money launch.

### Why This Approach

**Alternative 1: Full KYC-first (rejected)** — Requiring full identity verification before any interaction destroys the low-friction onboarding that makes Cashu/Nostr attractive. Would kill the path to 1,000 users by August 2026.

**Alternative 2: Operate offshore with no compliance (rejected)** — High legal risk. The CFTC has demonstrated willingness to pursue prediction market operators (Polymarket $1.4M settlement, 2022). Would make the platform permanently uninvestable and limit growth.

**Alternative 3: US-only CFTC-registered DCM (rejected)** — Kalshi's path ($100M+ in legal/compliance costs). Not viable for a startup at this stage.

**Chosen: Progressive compliance with jurisdiction selection** — Start with a permissive but compliant jurisdiction, implement tiered KYC, and expand regulatory coverage as revenue and user base grow.

## Section Overview

| Section | File | Contents |
|---------|------|----------|
| Regulatory Landscape | `regulatory-landscape.md` | US (CFTC, FinCEN, SEC, state), EU (MiCA, MiFID II), jurisdiction selection strategy |
| KYC & Identity | `kyc-identity.md` | Tiered KYC design, Nostr/Cashu identity challenges, verification integration |
| Fraud Prevention | `fraud-prevention.md` | Sybil resistance, market manipulation detection, wash trading, position limits, anomaly detection |
| Implementation Roadmap | `implementation-roadmap.md` | Phased rollout, dependency order, verification steps |

## Cross-Section Dependencies

1. **Regulatory Landscape** must be finalized first — jurisdiction choice determines KYC requirements
2. **KYC & Identity** depends on regulatory landscape — tier thresholds vary by jurisdiction
3. **Fraud Prevention** is partially independent but position limits interact with KYC tiers
4. **Implementation Roadmap** depends on all three preceding sections
