# Phase 8 Real Money Integration Plan

## Overview
This document synthesizes the plans developed for the real money integration of the Cascade markets platform into a comprehensive strategy, detailing mint deployment, Lightning integration, risk and compliance considerations, phased rollout, and frontend adjustments.

### 1. Mint Deployment Strategy
- **Infrastructure Requirements**: A production Cashu mint requires an appropriately sized cloud instance. Recommended specs include:
  - **CPU**: 4 cores minimum
  - **RAM**: At least 8 GB
  - **Storage**: SSD with a minimum of 100 GB
- **Deployment Options**  
  - **Self-hosted Mint**: Using CDK Rust for the mint operations, this avoids dependencies on third-party providers. PostgreSQL is preferred for the database due to its reliability in production.
- **Key Recommendations**:
  - Use LND as the Lightning backend to leverage better integration and support.
  - Begin with a single VPS (~$50-80/month) to manage initial operations, scaling as traffic grows.
  - Break-even on a $25,000 monthly market volume under the 2% rake model.

### 2. Lightning Integration Plan
- **Deposits**: Users will be able to deposit funds through Lightning, with the mint consistently receiving and validating payments.
- **Withdrawals**: A streamlined process will allow users to redeem their ecash tokens back to Lightning payments effortlessly, with automated confirmations included throughout the process.

### 3. Risk and Compliance Assessment
- **KYC and Regulatory Factors**: Minimal KYC will be required initially, though attention will be paid to adjust as jurisdictional laws tighten. 
- **Fraud Prevention**: Implement various layers of fraud detection and prevention measures, including automated monitoring systems and regular audits.

### 4. Phased Rollout
- **Initial Launch**: Commence with a third-party mint to onboard initial users effectively, later migrating to a self-hosted version.  
- **Deployment Stages**: Structured phases will guide both technical and user experience aspects to mitigate risks progressively.
  - **Phase 0**: Launch via a third-party mint.
  - **Phase 1**: Transition to the customized mint for testnet validation.
  - **Phase 2**: Full mainnet functionality with a focus on scaling and performance optimization.

### 5. Frontend Wiring Plan
- **Existing Infrastructure**: Current wallet infrastructure has been assessed, and enhancements will be made to facilitate real money transactions.
  - Built components include wallet service functions like `loadOrCreateWallet()` and deposit processing.
- **Needed Enhancements**:
  - Build a UI flow for Lightning withdrawal and adjust existing components to ensure smooth real-money transactions.  
  - Ensure reliability of QR code generation and facilitate real-time status updates for deposit transactions.

### Conclusion
This integrated approach ensures that all critical aspects are addressed in a cohesive manner, facilitating smooth implementation of real money integration into the Cascade markets platform. Following this synthesis, the plan will be sent for review and feedback, ensuring alignment with project stakeholders.

---

### Next Steps
- Send this plan to architect-orchestrator and clean-code-nazi for review.
- Incorporate any feedback and finalize before handing over to the execution-coordinator to start implementation.

**Final Plan Path**: `.tenex/plans/phase-8-real-money-integration.md`