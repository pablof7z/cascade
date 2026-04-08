# Critical Decisions — Required Before Deployment

These decisions must be made by the project owner before production deployment can proceed. They are ordered by dependency — later decisions may depend on earlier ones.

---

## Decision 1: Self-Hosted vs Third-Party Mint

**The question:** Should Cascade operate its own Cashu mint, or integrate with an existing third-party mint?

### Option A: Self-Hosted Mint (Recommended)

Run the CDK-based mint that already exists in `cascade-mint/`.

**Pros:**
- Full control over keyset creation (critical for LONG/SHORT market tokens)
- Custom escrow logic (`escrow.rs`) already implemented
- No dependency on third-party uptime or cooperation
- Keep all rake revenue
- Can enforce Cascade-specific rules (position limits, market-scoped keysets)

**Cons:**
- Full operational responsibility (uptime, security, key management)
- Lightning liquidity management is on Cascade
- Regulatory exposure — Cascade is clearly the mint operator

### Option B: Third-Party Mint (Not Recommended for Cascade)

Use an existing public mint (e.g., Minibits, LNbits mint).

**Pros:**
- No infrastructure to manage
- No key custody responsibility

**Cons:**
- **Incompatible with Cascade's architecture** — Market-specific LONG/SHORT keysets require custom mint logic. No public mint supports this.
- No escrow mechanism for market settlement
- Dependent on third-party for availability and security
- Can't enforce rake at the mint level
- Trust assumptions — users trust the third-party mint, not Cascade

**Recommendation:** Self-hosted is the only viable option given Cascade's custom keyset architecture. The `cascade-mint/` implementation already handles this. Third-party mints don't support the LONG/SHORT keyset model.

---

## Decision 2: Jurisdiction & Legal Entity

**The question:** Under which jurisdiction should the mint operator entity be established?

### Considerations

| Factor | Detail |
|--------|--------|
| Money transmitter laws | Operating a Cashu mint + Lightning gateway may qualify as money transmission in many jurisdictions |
| Prediction market legality | Binary outcome markets on real events are heavily regulated (CFTC in US, FCA in UK, etc.) |
| Bitcoin/ecash legal status | Varies by jurisdiction — some require crypto exchange licenses |
| Privacy | Cascade's ecash model is privacy-preserving; some jurisdictions may require KYC |

### Potential Jurisdictions

| Jurisdiction | Prediction Markets | Crypto Licensing | KYC Required | Notes |
|-------------|-------------------|------------------|-------------|-------|
| El Salvador | Bitcoin legal tender, crypto-friendly | Minimal | Unclear | Favorable for BTC but untested for prediction markets |
| Singapore | Regulated but possible | MAS license required | Yes | Clear framework but expensive compliance |
| Switzerland | Generally favorable | FINMA oversight | Yes for >1,000 CHF | Strong rule of law, crypto-friendly |
| British Virgin Islands | Unregulated | Minimal | No formal req | Common for crypto projects |
| No entity (pseudonymous) | N/A | N/A | No | Maximum risk, zero regulatory protection, but Nostr-native ethos |

**This is the highest-stakes decision and requires legal counsel.** The technical implementation can proceed on testnet without this decision, but mainnet deployment with real sats requires clarity.

---

## Decision 3: Testnet vs Mainnet Progression

**The question:** What is the phased rollout plan from testnet to real money?

### Recommended Phases

**Phase A: Signet/Testnet (Current → +2 months)**
- Use Bitcoin signet or testnet for all Lightning operations
- Free test sats, no real money at risk
- Validate: minting, melting, market settlement, keyset lifecycle, escrow flow
- Validate: wallet UI, NIP-60 integration, error handling
- **Exit criteria:** 50+ successful market settlements with no fund discrepancies

**Phase B: Mainnet Beta (Limited)**
- Real sats, but with strict limits:
  - Maximum 10,000 sats per position
  - Maximum 100,000 sats per market total volume
  - Maximum 10 concurrent markets
  - Invite-only access (whitelist by npub)
- **Exit criteria:** 30 days of operation with no fund discrepancies, <1% settlement failure rate

**Phase C: Mainnet Production**
- Raise limits gradually
- Open access (no invite required)
- Full monitoring and alerting operational
- Incident response procedures tested
- Backup and recovery procedures tested

---

## Decision 4: Lightning Integration Approach

**The question:** How should the mint connect to the Lightning Network?

### Option A: Embedded LDK (Recommended for Beta)

Use LDK (Lightning Dev Kit) embedded in the mint process via CDK's LDK integration.

**Pros:**
- Single process — simpler deployment
- CDK has built-in LDK support
- Lower resource usage
- No separate node to manage

**Cons:**
- Less mature than CLN/LND for production
- Fewer tools for channel management
- Harder to run as a standalone Lightning node if needed later

### Option B: CLN (Core Lightning) Backend

Run CLN as a separate process, connect via CDK's CLN backend.

**Pros:**
- Battle-tested Lightning implementation
- Rich plugin ecosystem
- Better channel management tools
- Can be run on a separate server for isolation

**Cons:**
- Two processes to manage
- More complex deployment (Docker Compose with two services)
- Higher resource usage

### Option C: LND Backend

Run LND as a separate process.

**Pros:**
- Most widely deployed Lightning implementation
- Excellent tooling (ThunderHub, RTL)
- Good LSP support

**Cons:**
- CDK's LND support may be less mature than CLN support
- Higher memory usage than CLN
- Two processes to manage

**Recommendation:** Start with embedded LDK for beta (simplicity), plan migration path to CLN for production if LDK proves insufficient for channel management at scale.

---

## Decision 5: KYC/AML Requirements

**The question:** Should Cascade implement any KYC/AML measures?

### Options

**Option A: No KYC (Nostr-Native)**
- Users identified only by npub
- Maximum privacy, minimum friction
- Consistent with Cashu's privacy properties
- Regulatory risk depends on jurisdiction (Decision 2)

**Option B: Soft KYC (Limits-Based)**
- No KYC below threshold (e.g., 100,000 sats cumulative)
- Basic verification above threshold (NIP-05, email)
- Pragmatic middle ground

**Option C: Full KYC**
- Identity verification for all users
- Required in most regulated jurisdictions
- Defeats the privacy properties of Cashu
- High friction, likely kills adoption

**Recommendation:** Start with Option A (no KYC) + strict per-position and per-market limits as de facto risk management. Re-evaluate based on jurisdiction decision.

---

## Decision 6: Proof of Reserves

**The question:** Should the mint provide cryptographic proof of reserves?

### Context

Cashu mint operators can prove solvency by demonstrating that Lightning channel balances ≥ ecash outstanding. NUT-15 (proposed) addresses this, but is not yet standardized.

### Options

**Option A: Manual Proof of Reserves (Recommended)**
- Periodically publish: total ecash outstanding + Lightning channel balances
- Use a simple dashboard or Nostr note
- Not cryptographically verifiable but builds trust

**Option B: Cryptographic Proof (Future)**
- Implement NUT-15 when standardized
- Allows users to independently verify solvency
- Technically complex but the gold standard

**Option C: No Proof of Reserves**
- Users trust the mint operator implicitly
- Acceptable for beta with small amounts
- Not acceptable long-term

**Recommendation:** Implement Option A for beta, plan for Option B when NUT-15 matures.

---

## Decision 7: Multi-Mint Federation (Future Architecture)

**The question:** Should Cascade plan for multi-mint architecture?

### Context

Currently, Cascade runs a single mint. For resilience and trust distribution, multiple mints could serve the platform:

- **Fedimint-style:** Multiple guardians share custody (not Cashu-compatible today)
- **Multi-mint Cashu:** Multiple independent mints, users choose which to trust
- **Single mint with backup key holders:** Operational redundancy without protocol change

### Recommendation

**Don't solve this yet.** Single mint is correct for beta and early production. The multi-mint question becomes relevant at significant scale (>100M sats outstanding) or if regulatory pressure requires distributed custody. Note it as a future architectural option.

---

## Decision Summary

| # | Decision | Urgency | Recommendation | Blocks |
|---|----------|---------|----------------|--------|
| 1 | Self-hosted vs third-party | Resolved | Self-hosted (only viable option) | Everything |
| 2 | Jurisdiction & legal entity | Before mainnet | Requires legal counsel | Mainnet launch |
| 3 | Testnet → mainnet phases | Before testnet launch | 3-phase rollout | Development timeline |
| 4 | Lightning integration | Before testnet launch | LDK embedded for beta | Infrastructure setup |
| 5 | KYC/AML requirements | Before mainnet | No KYC + limits for beta | User onboarding flow |
| 6 | Proof of reserves | Before mainnet | Manual for beta, NUT-15 later | Trust/transparency |
| 7 | Multi-mint federation | Future | Defer | None currently |

### Minimum Decisions for Testnet Launch
- Decision 1 ✅ (self-hosted)
- Decision 3 (confirm phase plan)
- Decision 4 (confirm LDK for beta)

### Minimum Decisions for Mainnet Launch
- All of the above, plus:
- Decision 2 (jurisdiction — requires legal counsel)
- Decision 5 (KYC policy)
- Decision 6 (proof of reserves approach)
