# Blast Radius Analysis — What Can Go Wrong

This section catalogs failure modes, their impact, probability, and mitigations. The goal is to answer: "If this fails, how bad is it and who gets hurt?"

## Failure Taxonomy

### Severity Levels

| Level | Definition | Example |
|---|---|---|
| **S0 — Critical** | Users lose funds, no recovery possible | Mint database corruption, Lightning force-close during active trade |
| **S1 — Major** | Service down, funds safe but inaccessible | Mint crash, Lightning node unreachable |
| **S2 — Moderate** | Degraded service, some operations fail | Channel liquidity exhaustion, slow settlement |
| **S3 — Minor** | UX issues, workarounds available | Slow response times, UI glitches |

---

## Scenario 1: Third-Party Mint Goes Down (Phase 0)

**Probability**: Medium (third-party services have outages; no SLA guarantees with Cashu mints)

**What happens**:
- Users cannot deposit or withdraw sats (mint/melt operations fail)
- Users cannot execute trades (trades require minting new tokens)
- Existing ecash proofs in user wallets are **still valid** — they're cryptographic bearer tokens. Users don't lose them.
- Positions on open markets freeze — no new trades possible
- Market resolution is blocked if it requires mint operations

**Blast radius**: 
- **Funds**: Safe. Proofs are held client-side. Once the mint comes back, proofs are redeemable.
- **Availability**: Complete trading halt. No degradation path — it's all or nothing.
- **Duration dependence**: Minutes = annoying. Hours = users leave. Days = existential (users may believe funds are lost).

**Mitigations**:
1. Frontend: Clear "Mint Unavailable" state with estimated recovery time
2. Health check polling on the mint endpoint — detect outage within 30 seconds
3. If using a third-party mint: maintain communication channel with the mint operator
4. No mitigation for the fundamental risk: you do not control the mint. This is why Phase 0 is temporary.

**Recovery**:
- When mint comes back online, all proofs are valid and redeemable
- No data migration needed
- Outstanding trades may need reconciliation if any were mid-flight

---

## Scenario 2: Cascade-Mint Database Corruption (Phase 1+)

**Probability**: Low (PostgreSQL is robust, but bugs happen)

**What happens**:
- Mint cannot verify proofs — cannot tell spent from unspent
- Double-spend protection is gone
- Mint cannot issue new tokens
- Complete halt of all operations

**Blast radius**:
- **Funds**: HIGH RISK. If backup is stale, gap between last backup and corruption = potential double-spend window or lost mints.
- **Availability**: Complete halt until database is restored.
- **Trust**: Catastrophic. Any hint of database issues destroys trust in the mint.

**Mitigations**:
1. PostgreSQL WAL archiving for point-in-time recovery (PITR) — can recover to any second
2. Daily full backups to encrypted remote storage
3. WAL archiving to separate storage every 5 minutes
4. Database checksums enabled at PostgreSQL level (`data_checksums = on`)
5. Regular backup restore tests (monthly) — verify backups actually work

**Recovery**:
1. Stop the mint immediately (prevent inconsistent state)
2. Restore from latest WAL archive (PITR to last consistent point)
3. Audit: compare Lightning balance vs mint's recorded outstanding tokens
4. If gap exists: the difference is the exposure. At conservative limits, this is capped at system exposure cap (10M sats / ~$6,000 at launch).

**Key insight**: The exposure limit system means even catastrophic DB failure has a bounded financial impact.

---

## Scenario 3: Lightning Node Failure (Phase 2)

**Probability**: Medium (Lightning nodes require maintenance; force-closes happen)

**Failure modes**:
- **Node crash**: Process dies, restart fixes it. Downtime = seconds to minutes.
- **Disk failure**: Need to restore from SCB (static channel backups). Channels force-close. Recovery = hours to days.
- **Force-close cascade**: Counterparties force-close channels. Funds locked in timelocks (up to 2 weeks).

**Blast radius**:
- **Funds**: Safe but potentially locked. Force-closed channels have timelock periods.
- **Availability**: Deposits and withdrawals stop. Trading may continue if the mint has sufficient token liquidity already minted.
- **Duration**: Node crash = minutes. Force-close recovery = up to 2 weeks for funds to return on-chain.

**Mitigations**:
1. SCB backups to remote storage after every channel state change
2. On-chain reserve: keep 20% of total system value in on-chain wallet as buffer
3. Multiple Lightning backends: if using LND, have a backup CLN node ready (not active, just configured and ready to deploy)
4. Channel diversification: spread across 5+ peers, no single peer > 30% of total capacity

**Recovery**:
1. If node crash: restart, verify channel states, resume operations
2. If disk loss: restore from SCB, wait for force-close settlement, re-open channels
3. During recovery: mint operates in "withdrawal only" mode using on-chain reserve

---

## Scenario 4: LMSR Implementation Bug

**Probability**: Medium (LMSR math is well-understood but implementation bugs are common in financial math)

**What happens**:
- Prices computed incorrectly — users get unfair prices
- Token quantities miscalculated — mint issues wrong number of tokens
- Reserve tracking diverges from Lightning balance — insolvency

**Blast radius**:
- **Funds**: CRITICAL. If the mint issues more tokens than the reserve can cover, it becomes insolvent. Tokens are bearer instruments — whoever holds them has a valid claim.
- **Scope**: Affects every market using the buggy LMSR. All markets if it's a systemic bug.
- **Detection**: May not be immediately obvious. Slow drain possible.

**Mitigations**:
1. **Solvency invariant check on every trade**: After every trade, verify `Lightning_balance >= Σ(market_reserves) + outstanding_unredeemed_ecash`. If this fails, halt immediately.
2. **Property-based testing**: Fuzz the LMSR implementation with random sequences of buys/sells. Verify invariants hold after every operation.
3. **Known-answer tests**: Compute expected LMSR outputs by hand (or with a reference implementation) for specific scenarios. Test suite verifies exact match.
4. **Conservative liquidity parameter (b)**: Start with a high `b` value (lower price sensitivity). This means less dramatic price swings and lower maximum possible loss per trade.
5. **Market size caps**: The exposure limits from Phase 2 cap the total possible loss from any single market.

**Recovery**:
1. Pause all trading immediately
2. Audit each market: compare theoretical reserve (from trade history) vs actual Lightning balance
3. If shortfall < fee reserve: absorb the loss from accumulated fees
4. If shortfall > fee reserve: operator must inject capital to cover the gap
5. Fix the bug, verify with test suite, resume

---

## Scenario 5: Double-Spend Attack

**Probability**: Low (Cashu protocol prevents this if implemented correctly)

**What happens**:
- Attacker tries to spend the same ecash proof twice
- If successful: attacker gets free tokens, mint becomes insolvent by the double-spent amount

**Blast radius**:
- **Funds**: Direct loss equal to the double-spent amount
- **Scope**: Limited to the attacker's balance

**Mitigations**:
1. CDK library handles double-spend checking — spent proofs are recorded in the database
2. Atomic database transactions: proof verification and marking as spent MUST be in the same transaction
3. The exposure limits cap how much any single user can have in the system

**Recovery**: 
- If detected: the damage is already done (bearer tokens). No way to "undo" a spent proof.
- Quantify the loss, patch the vulnerability, absorb from fee reserve.

---

## Scenario 6: Market Resolution Dispute

**Probability**: High (this is inherent to prediction markets, not a technical failure)

**What happens**:
- Market creator resolves a market, users disagree with the resolution
- Users holding losing tokens believe they should have won
- No appeal mechanism exists (Phase 1 uses creator resolution)

**Blast radius**:
- **Funds**: Losing users lose their positions (as designed). But if resolution is genuinely wrong, this is an unjust loss.
- **Trust**: Severe. A single bad resolution can destroy platform credibility.
- **Legal**: Users may claim fraud if they believe resolution was malicious.

**Mitigations**:
1. **Resolution delay**: After creator submits resolution, 24-48 hour dispute window before settlement
2. **Evidence requirement**: Creator must submit evidence/source for resolution
3. **Admin override**: Platform operator can override a resolution during the dispute window if clearly wrong
4. **Market creator reputation**: Track resolution history, surface creator track record
5. **Conservative market choices**: Initially, only allow markets with objectively verifiable outcomes (sports scores, election results, on-chain events)

**Recovery**:
1. If caught during dispute window: admin overrides resolution
2. If caught after settlement: operator must manually compensate affected users from fee reserve
3. Long-term: implement oracle-based or decentralized resolution (Phase 3 in project roadmap)

---

## Scenario 7: Regulatory Action

**Probability**: Medium-High (prediction markets are regulated in most jurisdictions)

**What happens**:
- Regulator classifies Cascade as an unregistered exchange, gambling platform, or derivatives market
- Cease and desist order
- Domain seizure
- Legal action against operator

**Blast radius**:
- **Funds**: If forced to shut down, users must withdraw all funds. With Cashu bearer tokens, users can self-custody.
- **Availability**: Potentially permanent shutdown in the affected jurisdiction
- **Operator**: Personal legal liability

**Mitigations**:
1. **Jurisdiction selection**: Operate from a jurisdiction with clear crypto/prediction market regulations (or minimal regulation). Consider: Switzerland, UAE, El Salvador, or established crypto-friendly jurisdictions.
2. **Legal opinion**: Before mainnet launch, get a legal opinion on the specific jurisdiction's treatment of crypto prediction markets.
3. **Progressive decentralization**: The more decentralized the platform, the harder it is to shut down. Nostr data layer is already censorship-resistant. Self-hosted mints by market creators (future roadmap) would distribute operator risk.
4. **Geographic restrictions**: Block access from jurisdictions with explicit prohibition (US CFTC jurisdiction is complex — prediction markets are heavily regulated).
5. **No fiat on/off-ramp**: Staying purely in Bitcoin/Lightning reduces touchpoints with traditional financial regulation.

**Recovery**:
- Users withdraw their funds (bearer tokens are self-custodied)
- Nostr events (markets, positions) remain on relays regardless of platform status
- If forced to move jurisdiction: redeploy mint in new jurisdiction, announce new mint URL

---

## Aggregate Risk Summary

| Scenario | Probability | Max Financial Impact (at launch limits) | Detection Speed | Recovery Time |
|---|---|---|---|---|
| Third-party mint outage | Medium | 0 (funds safe) | Seconds | Depends on third party |
| Database corruption | Low | Up to system cap (10M sats) | Minutes | Hours (with PITR) |
| Lightning node failure | Medium | 0 (funds locked, not lost) | Seconds | Minutes to weeks |
| LMSR bug | Medium | Up to system cap (10M sats) | Minutes to days | Hours + capital injection |
| Double-spend | Low | Limited to attacker balance | Immediate (if logs monitored) | Patch + absorb loss |
| Resolution dispute | High | Limited to market size | Hours (during dispute window) | Admin override or compensation |
| Regulatory action | Medium-High | 0 (users can withdraw) | Days to weeks (legal process) | Permanent in jurisdiction |

## Key Takeaway

**The exposure limit system is the single most important risk control.** At Phase 2 launch values (10M sats total system cap ≈ $6,000), even a catastrophic failure — complete database loss with no backup — results in a bounded loss that an individual operator can absorb. This is by design.

As limits increase, the blast radius grows proportionally. Every limit increase should be justified by operational confidence earned through incident-free operation and verified monitoring.

The third-party mint strategy in Phase 0 has a paradoxical risk profile: it has lower technical blast radius (you didn't build it, it's battle-tested) but higher operational risk (you don't control it, can't fix it, can't audit it). The migration to self-hosted is a trade: accepting more technical responsibility in exchange for full operational control.
