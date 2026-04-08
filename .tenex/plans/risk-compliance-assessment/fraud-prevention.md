# Fraud Prevention & Market Integrity

## Threat Model

Cascade's architecture — Cashu ecash on Nostr with LMSR-based prediction markets — creates a specific threat surface. Understanding the attack vectors is prerequisite to designing defenses.

### Attack Surface Summary

| Threat | Severity | Likelihood | Cashu-Specific? |
|--------|----------|------------|-----------------|
| Sybil attacks (multiple fake identities) | High | High | Yes — free Nostr pubkeys |
| Wash trading (self-dealing to manipulate prices) | High | High | Yes — bearer tokens enable anonymous self-dealing |
| Market manipulation (pump/dump on thin markets) | High | Medium | No — universal in prediction markets |
| Oracle manipulation (corrupting resolution) | Critical | Medium | No — universal in prediction markets |
| Lightning routing attacks (payment failures for profit) | Medium | Low | Partially — Lightning-specific |
| Token counterfeiting | Critical | Very Low | Yes — but Cashu's blind signature scheme prevents this |
| Mint collusion (mint operator steals funds) | Critical | Low | Yes — custodial mint risk |

## Sybil Resistance

### The Problem

Creating a Nostr keypair costs zero. A single actor can create thousands of pubkeys in seconds. In Cascade's context, Sybil attacks enable:

1. **Circumventing position limits** — If each pubkey is limited to X sats per market, create N pubkeys to get N×X exposure
2. **Gaming Tier 0 allowances** — Create unlimited anonymous accounts to operate with small-amount exemptions
3. **Manipulating market sentiment indicators** — If UI shows "N traders" or "unique positions," Sybils inflate these metrics
4. **Bypassing rate limits** — Any per-pubkey rate limit is meaningless if identities are free

### Defense Layers

#### Layer 1: Economic Sybil Resistance (Primary)

Make identity creation costly relative to the benefit of multiple identities.

**Lightning deposit fingerprinting**:
- Every real-money interaction starts with a Lightning deposit (mint operation)
- Lightning payments carry channel information and timing signatures
- Cluster deposits that come from the same Lightning node or within suspicious timing windows
- **Implementation**: Log Lightning payment metadata (channel ID, amount pattern, timestamp) alongside minted pubkey. Apply clustering algorithms to detect same-source deposits across pubkeys.
- **Limitation**: Sophisticated actors can use multiple Lightning wallets, custodial services, or trampoline routing to obscure origin.

**Proof-of-stake identity**:
- Require a small non-refundable deposit (e.g., 1,000 sats) to activate a pubkey for real-money markets
- This deposit is not a fee — it's a Sybil resistance bond
- Refundable after 90 days of good behavior (no flags)
- **Implementation**: Special "activation" mint operation that locks sats in a separate keyset (non-tradeable). Refund via melt after time lock.

**NIP-05 as weak signal**:
- Require NIP-05 verification for Tier 1+
- NIP-05 requires domain control, adding some cost to identity creation
- Weight: Low — domains are cheap, and NIP-05 providers may bulk-issue identifiers

#### Layer 2: Behavioral Sybil Detection (Secondary)

Detect Sybil clusters through behavioral patterns rather than identity verification.

**Correlated trading detection**:
- Monitor for pubkeys that consistently take the same positions in the same markets within short time windows
- Flag clusters where N pubkeys all buy the same outcome within T minutes
- **Implementation**: Sliding-window correlation analysis on position events. Alert when correlation coefficient between pubkey pairs exceeds threshold (e.g., > 0.8 across 5+ markets).

**Session fingerprinting** (privacy-sensitive):
- Track browser/device fingerprints (screen size, timezone, WebGL hash)
- Detect multiple pubkeys operating from the same device
- **Caution**: This conflicts with Nostr's privacy ethos. Implement as server-side heuristic only, never expose to other users, and disclose in privacy policy.
- **Implementation**: Hash device fingerprint server-side. Store hashed fingerprint alongside pubkey. Alert on multiple pubkeys sharing a fingerprint.

**Timing analysis**:
- Sybils tend to act in synchronized bursts
- Track time-between-actions per pubkey. If multiple pubkeys have nearly identical action timestamps, flag as suspicious.

#### Layer 3: KYC Tier Escalation (Tertiary)

The tiered KYC system (see `kyc-identity.md`) inherently limits Sybil effectiveness:
- **Tier 0**: Very low limits (< 10,000 sats). Even 100 Sybils only get ~1M sats total exposure.
- **Tier 1**: Requires NIP-05 or email. Adds some cost per identity.
- **Tier 2**: Requires government ID. Sybil-resistant (one ID per person, liveness check prevents reuse).

**The key insight**: Sybil resistance doesn't need to be perfect at every tier. It needs to make the cost of Sybil attacks exceed the benefit at each tier's limit levels.

## Market Manipulation Prevention

### LMSR as Natural Defense

Cascade uses Logarithmic Market Scoring Rule (LMSR) for pricing. LMSR has inherent manipulation resistance:

- **Bounded loss**: The market maker's maximum loss is bounded by `b * ln(n)` where `b` is the liquidity parameter and `n` is the number of outcomes. This bounds how much a manipulator can extract.
- **Increasing cost**: Moving the price requires exponentially increasing capital as you push further from equilibrium. Moving a market from 50% to 90% costs significantly more than 50% to 60%.
- **No order book to spoof**: Unlike order-book markets, LMSR has no bids/offers that can be placed and cancelled to mislead. The price is a mathematical function of positions held.

**However, LMSR is not immune**:
- **Thin markets**: When `b` is small, markets are cheap to manipulate
- **Information asymmetry**: A manipulator who knows the oracle resolution mechanism can trade against uninformed participants
- **Last-trade manipulation**: If any external system references Cascade's prices, manipulating the final price before resolution is profitable

### Position Limits

Enforce maximum position sizes to cap manipulation potential.

| Tier | Max Position Per Market | Max Total Exposure |
|------|------------------------|--------------------|
| Tier 0 | 5,000 sats | 10,000 sats |
| Tier 1 | 100,000 sats | 500,000 sats |
| Tier 2 | 2,000,000 sats | 10,000,000 sats |
| Tier 3 | Market-specific (set by operator) | Unlimited |

**Implementation**: Check position value on every swap operation. Reject swaps that would exceed the pubkey's tier limit. Position value = sum of all token holdings across outcomes in a market, valued at current LMSR prices.

### Wash Trading Detection

Wash trading in Cascade means a single actor buying and selling (or buying both outcomes) to create the appearance of trading activity or to manipulate the price and then reverse.

**Detection signals**:
1. **Round-trip detection**: Pubkey buys outcome A, then sells outcome A within short window at near-identical price → flag
2. **Both-sides detection**: Pubkey holds significant positions on multiple outcomes in the same market → flag (though hedging is legitimate in multi-outcome markets)
3. **Sybil wash trading**: Pubkey A buys, Pubkey B (same cluster) sells → requires Sybil detection first
4. **Volume inflation**: Pubkey generates high volume but net position is near zero → flag

**Implementation**:
```
For each market:
  Track per-pubkey: { net_position, total_buy_volume, total_sell_volume, trade_timestamps }
  Flag if:
    - total_buy_volume + total_sell_volume > 10 * abs(net_position)  (volume without conviction)
    - buy and sell within same 5-minute window at similar prices (round-trip)
    - Sybil cluster collectively has high volume but low net position
```

### Price Manipulation Alerts

**Pre-resolution manipulation**:
- Markets approaching resolution deadline are highest risk
- If a market's price moves > 20% in the final 10% of its duration, flag for manual review
- Consider: "resolution lock" period where trading is suspended N hours before resolution

**Unusual price movement**:
- Track price velocity (rate of change per unit time)
- Flag markets where price moves > 2 standard deviations from historical velocity
- Alert operator for markets with extreme price-volume divergence

## Oracle / Resolution Integrity

Market resolution is the highest-value attack target. If an attacker can influence resolution, they can guarantee profitable positions.

### Current Resolution Design

Based on codebase research: Market resolution appears to be controlled by the market creator via kind 30000 events. The `resolution` field in market metadata determines the outcome.

### Resolution Attack Vectors

1. **Creator collusion**: Market creator takes a position, then resolves in their favor
2. **Creator compromise**: Attacker gains access to creator's Nostr keys, resolves fraudulently
3. **Ambiguous resolution**: Deliberately ambiguous market questions that can be resolved either way
4. **Delayed resolution**: Creator abandons market, positions are stuck indefinitely

### Resolution Safeguards

**Short-term (before dedicated oracle system)**:
- **Resolution delay**: After creator posts resolution, impose a challenge period (e.g., 24-48 hours) during which other verified users can dispute
- **Creator stake**: Require market creators to post a resolution bond (e.g., 5% of market liquidity). Bond is slashed if resolution is successfully disputed.
- **Resolution evidence**: Require creators to include a URL to resolution evidence (news article, official data source) in the resolution event
- **Platform override**: Platform operator (signing with cascade's Nostr key) can override disputed resolutions

**Medium-term (dedicated oracle system)**:
- **Multi-sig resolution**: Require N-of-M resolution committee signatures instead of single creator
- **Optimistic oracle**: Resolution is proposed by anyone, challenged by anyone, with staked bonds on both sides. Unchallenged resolutions pass after timeout.
- **External oracle integration**: For factual markets (sports, elections, financial data), integrate external data feeds with cryptographic attestation

## Rake and Fee Exploitation

Cascade's LMSR mint has a rake mechanism (fee on trades). Potential exploits:

1. **Rake avoidance**: If tokens can be transferred P2P (Cashu bearer property), users could trade outside the market to avoid rake → **Mitigation**: P2PK-locked tokens that can only be redeemed through the mint
2. **Rake manipulation**: If rake is percentage-based, many small trades vs. few large trades may yield different effective rates → **Mitigation**: Consistent per-unit rake regardless of trade size
3. **Rake theft**: If the rake account is a regular Cashu balance, compromising the rake key steals accumulated fees → **Mitigation**: Rake auto-sweeps to cold storage on regular interval

## Implementation: Anomaly Detection System

### Architecture

```
Market Events (kind 30000, swap operations)
        ↓
  Event Ingestion Pipeline
        ↓
  ┌─────────────────────────┐
  │  Real-time Rule Engine   │
  │  - Position limits       │
  │  - Rate limits           │
  │  - Sanctions check       │
  └──────────┬──────────────┘
             ↓ (pass/reject)
  ┌─────────────────────────┐
  │  Batch Analysis Engine   │
  │  - Sybil clustering      │
  │  - Wash trade detection  │
  │  - Price anomaly alerts  │
  │  - Correlation analysis  │
  └──────────┬──────────────┘
             ↓ (alerts)
  ┌─────────────────────────┐
  │  Alert Dashboard         │
  │  - Severity scoring      │
  │  - Manual review queue   │
  │  - Action: warn/freeze   │
  └─────────────────────────┘
```

### Real-time Rules (Block on Violation)

| Rule | Action |
|------|--------|
| Position exceeds tier limit | Reject swap |
| Pubkey on sanctions list | Reject all operations |
| Withdrawal exceeds tier daily limit | Reject melt |
| Pubkey is frozen (manual flag) | Reject all operations |

### Batch Detection (Alert for Review)

| Detection | Frequency | Alert Threshold |
|-----------|-----------|-----------------|
| Sybil clustering | Every 6 hours | New cluster with > 5 correlated pubkeys |
| Wash trading | Every hour | Volume/position ratio > 10x for any pubkey |
| Price anomaly | Real-time (5-min windows) | Price movement > 2σ from market's historical velocity |
| Pre-resolution manipulation | Continuous for markets in final 10% duration | Price movement > 20% |
| Correlated trading | Every 6 hours | Correlation > 0.8 between pubkey pair across 5+ markets |

## File Changes

### New: `src/lib/server/fraud/` directory
- **Action**: create
- **What**: Fraud detection and prevention module:
  - `types.ts` — Alert types, severity levels, detection rule definitions
  - `position-limits.ts` — Position and withdrawal limit enforcement per tier
  - `sybil-detector.ts` — Sybil clustering algorithms (Lightning fingerprinting, behavioral correlation, device fingerprinting)
  - `wash-trade-detector.ts` — Wash trading detection (round-trip, volume/position ratio, cross-pubkey)
  - `price-anomaly.ts` — Price velocity tracking, pre-resolution manipulation detection
  - `alert-store.ts` — Alert persistence and review queue
  - `rule-engine.ts` — Real-time rule evaluation (position limits, sanctions, rate limits)
- **Why**: Centralized fraud detection separate from market operations

### New: `src/lib/server/fraud/lightning-fingerprint.ts`
- **Action**: create
- **What**: Extract and store Lightning payment metadata for deposit clustering
- **Why**: Primary Sybil resistance signal for Cashu-based system

### Modify: Mint swap handler (CDK Rust mint)
- **Action**: modify
- **What**: Before processing any swap, call `rule-engine.evaluate()` with the requesting pubkey and operation details. Reject operations that violate real-time rules.
- **Why**: Enforcement point for position limits, sanctions, and frozen accounts

### New: `src/routes/admin/alerts/+page.svelte`
- **Action**: create
- **What**: Admin dashboard showing fraud alerts, review queue, ability to freeze/unfreeze pubkeys
- **Why**: Operator needs visibility into fraud signals and ability to take action

### New: `src/routes/admin/alerts/+page.server.ts`
- **Action**: create
- **What**: Server-side load function fetching alerts from `alert-store`, gated behind admin auth
- **Why**: Admin pages must be server-rendered with auth

## Execution Order

1. **Implement position limits** — Create `position-limits.ts` with tier-based limits. Wire into swap operations. _Verify: Swap exceeding Tier 0 limit is rejected for unverified pubkey._
2. **Implement real-time rule engine** — Create `rule-engine.ts` evaluating position limits + sanctions check before every operation. _Verify: All mint/melt/swap operations pass through rule engine; blocked operations return error._
3. **Implement Lightning fingerprinting** — Create `lightning-fingerprint.ts` to extract and store deposit metadata. _Verify: Two deposits from same Lightning node are flagged as related._
4. **Implement Sybil clustering (batch)** — Create `sybil-detector.ts` with correlation analysis. Run on schedule. _Verify: Synthetic test data with correlated pubkeys produces cluster alerts._
5. **Implement wash trade detection** — Create `wash-trade-detector.ts` with round-trip and volume/position analysis. _Verify: Synthetic round-trip trading pattern produces alert._
6. **Implement price anomaly detection** — Create `price-anomaly.ts` tracking price velocity. _Verify: Simulated rapid price movement triggers alert._
7. **Build alert dashboard** — Create admin UI showing alerts and enabling freeze/unfreeze actions. _Verify: Alerts visible in UI; freezing a pubkey blocks subsequent operations._
8. **Add resolution safeguards** — Implement resolution delay, challenge period, and evidence requirement. _Verify: Resolution can be disputed during challenge period; evidence URL is required._
9. **Add Sybil bond mechanism** — Implement activation deposit for real-money market access. _Verify: Pubkey without activation deposit cannot participate in real-money markets._

## Verification

- [ ] Position limits enforced per tier on all swap operations
- [ ] Real-time rule engine evaluates every mint/melt/swap operation
- [ ] Lightning deposit fingerprinting active and clustering operational
- [ ] Sybil detection batch job runs on schedule and produces alerts
- [ ] Wash trade detection identifies synthetic round-trip patterns
- [ ] Price anomaly detection flags extreme movements
- [ ] Admin alert dashboard functional with freeze/unfreeze capability
- [ ] Resolution delay and challenge period active on new markets
- [ ] Activation bond required for real-money market participation
- [ ] All detection thresholds documented and configurable
