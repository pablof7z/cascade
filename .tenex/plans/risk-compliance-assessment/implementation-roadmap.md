# Implementation Roadmap

## Overview

This section defines the phased rollout for risk and compliance infrastructure. Phases are ordered by dependency — later phases depend on earlier ones being complete. No time estimates are provided; phases are defined by capability milestones.

## Phase 1: Foundation — Legal & Structural Prerequisites

**Goal**: Establish the legal entity, jurisdiction, and regulatory posture before any real-money functionality is exposed to users.

### Steps

1. **Select operating jurisdiction**
   - Evaluate: Switzerland (FINMA sandbox), Estonia (VASP license), El Salvador (Bitcoin-friendly), Singapore (MAS sandbox)
   - Decision criteria: regulatory clarity for prediction markets, Cashu/ecash treatment, cost of compliance, jurisdictional risk to US/EU users
   - Output: Chosen jurisdiction documented with rationale
   - _Verify: Legal opinion from qualified counsel confirming jurisdiction choice_

2. **Incorporate legal entity**
   - Register entity in chosen jurisdiction
   - Designate compliance officer (can be external service initially)
   - Output: Registered entity with articles of incorporation
   - _Verify: Entity registration documents filed and confirmed_

3. **Obtain legal opinion on product classification**
   - Engage jurisdiction-specific counsel to classify:
     - Are Cascade's outcome tokens securities, derivatives, gambling instruments, or e-money?
     - Is the Cashu mint a money transmitter / payment service provider?
     - What licenses are required (if any)?
   - Output: Written legal opinion with classification and required licenses
   - _Verify: Legal opinion received and reviewed by team_

4. **Update Terms of Service**
   - Current ToS at `src/routes/legal/terms/+page.svelte` lacks: governing law, jurisdiction clause, arbitration, restricted jurisdictions, AML compliance statement
   - Add:
     - Governing law clause (matches incorporated jurisdiction)
     - Mandatory arbitration clause
     - Restricted jurisdictions list (US residents blocked or limited depending on legal opinion)
     - Real-money-specific provisions (risk warnings, loss disclaimers)
     - AML/sanctions compliance statement
     - Age verification acknowledgment (18+)
     - Data processing disclosure (for KYC data)
   - _Verify: Updated ToS reviewed by legal counsel_

5. **Create Privacy Policy**
   - Currently no privacy policy exists
   - Must cover: KYC data collection and retention, device fingerprinting disclosure, Lightning payment metadata collection, data deletion rights (GDPR if EU users), cross-border data transfer provisions
   - _Verify: Privacy policy compliant with GDPR and jurisdiction requirements_

## Phase 2: Identity Infrastructure

**Goal**: Build the tiered KYC system that gates access to real-money markets based on verification level.

**Dependency**: Phase 1 (legal entity exists, can enter agreements with KYC providers)

### Steps

1. **Implement Tier 0 (anonymous access)**
   - Define Tier 0 limits in configuration (suggested: 10,000 sats daily, 5,000 sats per market)
   - Wire tier-checking middleware into mint swap operations
   - All pubkeys start at Tier 0 by default
   - _Verify: New pubkey can interact with markets up to limit; operations exceeding limit are rejected_

2. **Implement tier storage and management**
   - Mint-side database table: `pubkey_tiers { pubkey TEXT PRIMARY KEY, tier INTEGER, verified_at TIMESTAMP, evidence JSONB }`
   - Admin API: GET/SET tier for pubkey
   - _Verify: Tier can be set via admin API; tier persists across mint restarts_

3. **Implement Tier 1 (NIP-05 + email)**
   - NIP-05 verification: Fetch `/.well-known/nostr.json` from claimed domain, verify pubkey match
   - Email verification: Send code to provided email, verify code
   - On verification, upgrade pubkey to Tier 1 with increased limits
   - _Verify: User with valid NIP-05 can verify and access Tier 1 limits_

4. **Integrate KYC provider for Tier 2**
   - Select provider: Sumsub, Jumio, Onfido, or Veriff
   - Selection criteria: API quality, jurisdiction coverage, cost per verification, crypto-friendly policies
   - Implement: KYC flow launches in iframe/redirect, webhook receives result, tier upgraded on pass
   - Store only: verification status, provider reference ID, verification timestamp. Do NOT store ID documents.
   - _Verify: End-to-end KYC flow works in provider sandbox; tier upgraded on successful verification_

5. **Implement geo-restriction**
   - IP-based geo-detection for initial access control
   - Block or restrict users from jurisdictions where operation is not legal (per legal opinion from Phase 1)
   - Include: VPN detection heuristics (optional, depends on legal requirements)
   - _Verify: Requests from restricted jurisdictions receive appropriate block/warning page_

## Phase 3: Transaction Monitoring & Fraud Detection

**Goal**: Deploy real-time and batch fraud detection to protect market integrity.

**Dependency**: Phase 2 (tier system exists to enforce position limits per tier)

### Steps

1. **Implement position limit enforcement**
   - Real-time check on every swap: sum of pubkey's positions across market cannot exceed tier limit
   - Query position data from mint's keyset-per-market system
   - Return clear error message when limit exceeded, including current tier and how to upgrade
   - _Verify: Position limit exceeded → swap rejected with informative error_

2. **Implement rate limiting**
   - Per-pubkey rate limits on: mints per hour, melts per hour, swaps per hour
   - Tier-appropriate limits (Tier 0 stricter, Tier 3 relaxed)
   - Use sliding window algorithm (not fixed windows to prevent burst-at-boundary)
   - _Verify: Rapid successive operations eventually trigger rate limit; normal usage is unaffected_

3. **Implement sanctions screening**
   - Integrate OFAC SDN list (freely available, updated regularly)
   - Screen: Lightning payment identifiers (where obtainable), IP addresses
   - Note: Cannot screen Cashu token holders (bearer instrument) — screen at mint/melt boundaries
   - _Verify: Test with known sanctions-list entries (use test data, not real entries); operations blocked_

4. **Deploy Lightning fingerprinting**
   - Record metadata from Lightning deposits: channel ID (if available), amount, timestamp, payment hash
   - Cluster deposits showing same-source patterns
   - Store as: `deposit_fingerprints { payment_hash TEXT, pubkey TEXT, channel_hint TEXT, amount BIGINT, timestamp TIMESTAMP }`
   - _Verify: Two deposits from same test Lightning node are correctly linked_

5. **Deploy batch detection jobs**
   - Sybil clustering: Run every 6 hours, analyze deposit fingerprints + trading correlation
   - Wash trading: Run every hour, flag pubkeys with volume/position ratio > 10x
   - Price anomaly: Run on 5-minute windows, flag markets with price velocity > 2σ
   - Output alerts to `fraud_alerts` table with severity, evidence, and suggested action
   - _Verify: Synthetic test data triggers expected alerts at expected thresholds_

6. **Build operator alert dashboard**
   - Admin-only page at `/admin/alerts`
   - Show: alert list sorted by severity, alert detail with evidence, action buttons (dismiss, warn user, freeze pubkey)
   - Freeze action: Sets pubkey's tier to -1 (frozen), all operations rejected until unfrozen
   - _Verify: Alerts visible in dashboard; freeze action blocks pubkey's operations; unfreeze restores access_

## Phase 4: Market Integrity Safeguards

**Goal**: Protect resolution integrity and prevent end-of-market manipulation.

**Dependency**: Phase 3 (fraud detection provides signals for resolution disputes)

### Steps

1. **Implement resolution delay**
   - After market creator posts resolution (updates kind 30000 event), impose 24-hour challenge period
   - During challenge period, display resolution as "pending" in UI
   - If unchallenged, resolution finalizes and payouts begin
   - _Verify: Resolution posted → 24-hour delay before payout → payout proceeds if unchallenged_

2. **Implement resolution dispute mechanism**
   - Any Tier 1+ user can dispute a resolution by posting a dispute event (new Nostr event kind, or tagged kind 1)
   - Dispute must include: reason, evidence URL
   - Disputed resolution escalates to platform operator for manual review
   - Platform operator can: uphold original resolution, reverse resolution, or void market (refund all positions)
   - _Verify: Dispute event pauses resolution; operator can resolve dispute in all three ways_

3. **Implement creator bond requirement**
   - Market creators must lock a bond (e.g., 5% of initial liquidity or minimum 10,000 sats) when creating a real-money market
   - Bond returned on undisputed resolution
   - Bond slashed (sent to platform treasury) on reversed resolution
   - _Verify: Market creation requires bond; undisputed resolution returns bond; reversed resolution slashes bond_

4. **Implement pre-resolution trading controls**
   - For markets in final 10% of their duration: increase monitoring sensitivity
   - Optional: reduce position limits during final period
   - Optional: halt trading N hours before resolution (configurable per market)
   - _Verify: Increased monitoring active during final period; trading halt works if configured_

## Phase 5: Ongoing Compliance Operations

**Goal**: Establish the operational processes that keep compliance functioning over time.

**Dependency**: Phases 1–4 complete

### Steps

1. **Establish SAR filing process**
   - If required by jurisdiction: define when and how Suspicious Activity Reports are filed
   - Threshold triggers: fraud alerts above HIGH severity, single pubkey with > X sats in suspicious patterns
   - Process: Alert → review → document → file with relevant authority
   - _Verify: Process documented; test filing created (not submitted) to verify format_

2. **Implement audit trail**
   - All compliance-relevant actions logged to immutable audit log:
     - Tier changes (who, when, evidence)
     - Freeze/unfreeze actions (who, when, reason)
     - Resolution disputes and outcomes
     - SAR filings
   - Log format: append-only, tamper-evident (hash chain or write-once storage)
   - _Verify: Audit log records all compliance actions; log is append-only_

3. **Establish regulatory monitoring**
   - Track changes in relevant regulations: CFTC guidance on prediction markets, MiCA implementation updates, FinCEN crypto guidance
   - Quarterly review process: assess whether current compliance posture matches regulatory landscape
   - _Verify: Monitoring process documented; first quarterly review completed_

4. **Define incident response plan**
   - Scenarios: regulatory inquiry, exploit/hack, discovered fraud ring, sanctions match
   - For each: who is notified, what is preserved (evidence), what is communicated to users, what is reported to authorities
   - _Verify: Incident response plan documented; tabletop exercise completed for each scenario_

## Cross-Phase Dependencies

```
Phase 1 (Legal)
    ↓
Phase 2 (Identity) ──→ Phase 3 (Fraud Detection) ──→ Phase 4 (Market Integrity)
                                                              ↓
                                                      Phase 5 (Operations)
```

- Phase 1 is hard prerequisite for everything — no real-money features without legal entity and opinion
- Phase 2 and Phase 3 can have some parallel work (e.g., position limit logic can be built while KYC provider integration is in progress), but Phase 3 enforcement depends on Phase 2 tier system
- Phase 4 can begin during Phase 3 if resolution infrastructure is prioritized
- Phase 5 is ongoing and begins as soon as real-money features are live

## Verification (Full Plan)

- [ ] Legal entity incorporated in selected jurisdiction
- [ ] Legal opinion received classifying product and required licenses
- [ ] Terms of Service updated with all required provisions
- [ ] Privacy Policy created and published
- [ ] Tier 0 limits enforced on all operations
- [ ] Tier 1 NIP-05 + email verification functional
- [ ] Tier 2 KYC provider integration functional (sandbox-tested)
- [ ] Geo-restriction active for prohibited jurisdictions
- [ ] Position limits enforced per tier on all swap operations
- [ ] Rate limiting active on all operations
- [ ] Sanctions screening active at mint/melt boundaries
- [ ] Lightning fingerprinting operational
- [ ] Batch fraud detection jobs running on schedule
- [ ] Operator alert dashboard functional
- [ ] Resolution delay and challenge period active
- [ ] Resolution dispute mechanism functional
- [ ] Creator bond requirement enforced on real-money markets
- [ ] Pre-resolution trading controls configurable and functional
- [ ] SAR filing process documented
- [ ] Audit trail operational and tamper-evident
- [ ] Regulatory monitoring process established
- [ ] Incident response plan documented and tested
