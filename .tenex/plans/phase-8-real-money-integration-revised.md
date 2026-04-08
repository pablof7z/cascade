# Phase 8 Real Money Integration Plan - Revised

## Overview
This document synthesizes the revised plans developed for the real money integration of the Cascade markets platform, detailing mint deployment, Lightning integration, risk and compliance considerations, phased rollout, and frontend adjustments.

## ⚠️ Pablo Sign-Off Gate

**Before any Phase 8 implementation begins, Pablo must explicitly sign off on this plan.** No code changes, infrastructure provisioning, or deployment activities may proceed without his approval. This is a hard gate.

---

### 0. Frontend Refactor Prerequisite (MUST COMPLETE FIRST)

Before any real-money integration work begins, the frontend must be refactored to:
- Consolidate wallet store state management (currently fragmented across multiple files)
- Align Svelte 5 patterns consistently across wallet-related components
- Ensure the deposit/withdraw flow components are structurally ready for real-money wiring
- Remove any remaining React-era patterns in wallet code

This is a prerequisite because wiring real money into a divergent frontend creates technical debt that compounds rapidly. The refactor must be verified clean before Phase 1 begins.

**Deliverable**: Build passes, wallet components are structurally clean and ready for real-money wiring.

---

### 1. Mint Deployment Strategy
- **Infrastructure Requirements**: A production Cashu mint requires an appropriately sized cloud instance. Recommended specs include:
  - **CPU**: 4 cores minimum
  - **RAM**: At least 8 GB
  - **Storage**: SSD with a minimum of 100 GB
- **Deployment Approach**
  - **Self-hosted Mint ONLY**: Using CDK Rust for the mint operations. No third-party mint dependency. This is consistent with the project's architecture — we own the mint, we control the keys, we capture the rake.
  - PostgreSQL is preferred for the database due to its reliability in production.
- **Key Recommendations**:
  - Use LND as the Lightning backend to leverage better integration and support.
  - Begin with a single VPS (~$50-80/month) to manage initial operations, scaling as traffic grows.
  - Break-even on a $25,000 monthly market volume under the 2% rake model.

### 2. Lightning Integration Plan
- **Deposits**: Users will be able to deposit funds through Lightning, with the mint consistently receiving and validating payments. The self-run LND node handles invoice creation and payment verification.
- **Withdrawals**: A streamlined process will allow users to redeem their ecash tokens back to Lightning payments effortlessly, with automated confirmations included throughout the process.
- **Fee Management**: Lightning routing fees are borne by the user on withdrawals. Deposits are free (mint absorbs the routing cost as customer acquisition).
- **Backend**: Self-run LND node, co-located with the mint server for low-latency communication.

### 3. Risk and Compliance Assessment
- **KYC**: No KYC for MVP launch. Cascade is a prediction market on Nostr, not a regulated exchange. Start minimal, add compliance later only if legally required.
- **Regulatory Posture**: Monitor jurisdictional requirements. For now, the service operates as a Cashu mint — ecash, not a custodial exchange. This position should be confirmed with legal counsel before mainnet.
- **Fraud Prevention**: Implement basic anti-sybil measures (Nostr identity-based), automated monitoring for suspicious trading patterns, and rate limiting on deposit/withdrawal endpoints.
- **Blast Radius**: The mint's liability is limited to the sats it holds. Cold storage for excess reserves. Hot wallet only contains operational float.

### 4. Phased Rollout
- **No Third-Party Mint Phase**: We skip directly to self-hosted. The third-party mint option introduces a dependency we don't need and a trust assumption that contradicts our model.
- **Deployment Stages**: Structured phases will guide both technical and user experience aspects to mitigate risks progressively.
  - **Phase 1**: Self-hosted custom mint on testnet. Validate deposit/withdraw flows end-to-end with test sats.
  - **Phase 2**: Mainnet MVP with limited volume. Self-hosted LND + CDK Rust mint. Monitor for stability.
  - **Phase 3**: Scale and optimize. Add monitoring dashboards, automated alerts, and performance tuning.

### 5. Frontend Wiring Plan
- **Existing Infrastructure**: Current wallet infrastructure has been assessed, and enhancements will be made to facilitate real money transactions.
  - Built components include wallet service functions like `loadOrCreateWallet()` and deposit processing.
- **Needed Enhancements**:
  - Build a UI flow for Lightning withdrawal and adjust existing components to ensure smooth real-money transactions.
  - Ensure reliability of QR code generation and facilitate real-time status updates for deposit transactions.
  - Wire the deposit/withdraw flows to the self-hosted mint URL (not a third-party mint endpoint).

### Conclusion
This integrated approach ensures that all critical aspects are addressed in a cohesive manner, facilitating smooth implementation of real money integration into the Cascade markets platform. The self-hosted-only model, LND backend, and no-KYC MVP position us to ship fast while maintaining control of the full stack.

### Next Steps
1. **Pablo sign-off required** before any implementation begins.
2. Complete frontend refactor prerequisite.
3. Delegate to execution-coordinator for Phase 1 implementation (testnet mint deployment + frontend wiring).
4. Iterate through phases with verification gates between each.

**Final Plan Path**: `.tenex/plans/phase-8-real-money-integration-revised.md`