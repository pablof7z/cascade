# KYC & Identity Verification

## The Cashu Identity Problem

Cashu ecash creates a fundamental tension with KYC requirements:

1. **Bearer tokens**: Cashu tokens carry value without any identity attachment. Anyone who possesses a token can redeem it. The mint sees `mint` and `melt` operations but has no knowledge of who holds tokens between those operations.
2. **No built-in identity layer**: The Cashu protocol has no standard for attaching identity to wallets or tokens. P2PK (Pay-to-Public-Key) locks tokens to a Nostr pubkey, but pubkeys are not identities.
3. **Nostr pubkeys are free**: Creating a new Nostr keypair is instant and free. A single person can create unlimited pubkeys, each appearing as a distinct user.
4. **Mint sees edges only**: The mint observes Lightning deposits (mint operation) and Lightning withdrawals (melt operation). Token-to-token transfers between users are invisible to the mint.

### What the Mint CAN See

| Operation | Visibility |
|-----------|-----------|
| Lightning deposit → mint tokens | Lightning invoice payment (amount, timing) |
| Swap tokens (e.g., buy market position) | Token inputs/outputs, keyset IDs |
| Melt tokens → Lightning withdrawal | Lightning payment destination (amount, timing) |
| P2P token transfer | **Invisible** — bearer tokens change hands off-protocol |

### What the Mint CANNOT See

- Who holds tokens at any point
- Whether two pubkeys belong to the same person
- Token transfers between wallets
- The real-world identity behind any operation

## Tiered KYC Design

Given Cashu's privacy properties, a tiered approach balances compliance with usability:

### Tier 0: Anonymous (Play Money / Demo)

- **Requirements**: None — any Nostr pubkey can interact
- **Limits**: Play money only (no real sat value), or very small amounts (< 10,000 sats / ~$5 equivalent)
- **Purpose**: Onboarding, product discovery, engagement before commitment
- **Compliance basis**: De minimis exemption — amounts too small for meaningful AML risk
- **Implementation**: Default state for all new pubkeys

### Tier 1: Pseudonymous Verified

- **Requirements**:
  - Nostr pubkey with NIP-05 verification (proves domain ownership)
  - OR email verification linked to pubkey
  - OR Lightning node pubkey linkage (proves control of a Lightning node, which typically requires some investment)
- **Limits**: Up to 500,000 sats (~$250) total position value, 100,000 sats (~$50) daily withdrawal
- **Purpose**: Casual users, small-stakes prediction markets
- **Compliance basis**: Simplified due diligence (SDD) for low-risk, low-value accounts per FATF Recommendation 10
- **Implementation**: Verification event stored as Nostr kind (custom, e.g., kind 30079) signed by the platform's pubkey, attesting to verification level

### Tier 2: Identity Verified

- **Requirements**:
  - Government-issued ID document (passport, national ID, driver's license)
  - Liveness check (selfie matching ID photo)
  - Name, date of birth, country of residence
  - Sanctions screening (OFAC, EU consolidated list)
- **Limits**: Up to 10,000,000 sats (~$5,000) total position value, 2,000,000 sats (~$1,000) daily withdrawal
- **Purpose**: Active traders, meaningful prediction market participation
- **Compliance basis**: Standard Customer Due Diligence (CDD) per FATF / EU 6th Anti-Money Laundering Directive
- **Implementation**: Third-party KYC provider (Sumsub, Onfido, or Veriff) with results stored off-chain in encrypted database, linked to Nostr pubkey hash

### Tier 3: Enhanced Due Diligence

- **Requirements**:
  - Everything in Tier 2
  - Source of funds documentation
  - Enhanced ongoing monitoring
  - Periodic re-verification (every 12 months)
- **Limits**: Unlimited (within market-level position limits)
- **Purpose**: High-volume traders, market makers
- **Compliance basis**: Enhanced Due Diligence (EDD) per FATF Recommendation 10 for high-risk customers
- **Implementation**: Manual review process with compliance officer sign-off

## Nostr-Native Verification Challenges

### NIP-05 as Weak Identity Signal

NIP-05 (`user@domain.com` in kind 0 metadata) proves a user controls a domain/email endpoint. It is:
- **Useful**: Provides a cost to identity creation (domains cost money), links pseudonym to a web presence
- **Insufficient**: Doesn't prove real-world identity, can be obtained with anonymous email + cheap domain
- **Fragile**: Domain can be abandoned, NIP-05 provider can revoke

### Pubkey Linking Problem

A user who completes KYC with pubkey A can:
1. Create pubkey B (free, instant)
2. Mint tokens with pubkey A (KYC'd, high limits)
3. Transfer tokens off-protocol to pubkey B (invisible to mint)
4. Operate with pubkey B as an anonymous high-balance user

**Mitigation approaches**:
- **P2PK enforcement**: Require tokens to be locked to the KYC'd pubkey. Tokens can only be redeemed by proving ownership of the pubkey. This breaks Cashu's bearer property but is necessary for compliance.
- **Mint-side balance tracking**: Track total value minted per pubkey. If pubkey A mints 1M sats and only melts 100K, the 900K is "in circulation" under A's KYC umbrella. If A tries to mint more, apply limits against the full minted amount, not just current balance.
- **Withdrawal-side KYC**: Even if tokens circulate anonymously, require KYC at the `melt` (withdrawal to Lightning) step. This is the most practical approach — anonymous tokens are useless until converted back to Lightning sats.

**Recommended approach**: **Withdrawal-side KYC** as the primary gate, with **mint-side tracking** as a secondary control. This preserves Cashu's privacy for small amounts while ensuring real-money exits require identity verification.

## KYC Provider Integration

### Provider Selection Criteria

| Criteria | Weight | Notes |
|----------|--------|-------|
| Global coverage | High | Must support ID documents from target regions |
| API-first | High | Must integrate programmatically, no redirect flows |
| Cost per verification | Medium | Budget $1-3 per Tier 2 verification |
| Crypto-friendly | High | Some KYC providers refuse crypto clients |
| GDPR compliant | High | Required for EU users |
| Liveness detection | High | Prevents document-only fraud |

### Recommended Providers

1. **Sumsub** — Crypto-friendly, 220+ countries, $1.50-2.50/verification, good API
2. **Veriff** — Strong liveness detection, GDPR compliant, $2-3/verification
3. **Onfido** — Enterprise-grade, more expensive ($3-5), but best document coverage

### Integration Architecture

```
User (Nostr wallet) → Frontend SDK (KYC provider widget)
                          ↓
                    KYC Provider API
                          ↓
                    Webhook → Cascade Backend
                          ↓
                    Store: { pubkey_hash: verification_level, country, sanctions_clear }
                          ↓
                    Mint checks verification level on mint/melt operations
```

**Critical design decision**: KYC data (name, ID photos, etc.) should NOT be stored by Cascade. Use the KYC provider as the data processor. Cascade stores only:
- Hash of the Nostr pubkey
- Verification tier (0/1/2/3)
- Country of residence (for jurisdiction rules)
- Sanctions screening result (clear/flagged)
- Verification expiry date

This minimizes GDPR exposure and data breach risk.

## EU-Specific KYC Requirements (MiCA/AMLD)

Under MiCA and the EU's Anti-Money Laundering framework:
- **All** crypto-asset transfers > €1,000 require originator/beneficiary identification (Travel Rule)
- **No anonymous accounts** for CASPs — even Tier 0 may need basic identification in EU
- **Ongoing transaction monitoring** required
- **Suspicious Activity Reports (SARs)** must be filed with national FIUs

**Impact on Cascade**: EU users may need Tier 1 minimum from first interaction. The Tier 0 anonymous level may only be available in non-EU jurisdictions.

## File Changes

### New: `src/lib/server/kyc/` directory
- **Action**: create
- **What**: KYC verification module with:
  - `types.ts` — KYC tier enum, verification record types
  - `provider.ts` — Abstract KYC provider interface
  - `sumsub.ts` (or chosen provider) — Concrete provider implementation
  - `verification-store.ts` — Encrypted storage of verification results (pubkey hash → tier)
  - `tier-limits.ts` — Position and withdrawal limits per tier
- **Why**: Centralized KYC logic separate from mint operations

### New: `src/lib/server/kyc/sanctions.ts`
- **Action**: create
- **What**: OFAC and EU consolidated list screening integration
- **Why**: Required for all tiers — even Tier 0 users must be screened against sanctions lists

### Modify: Mint token operations (Rust CDK mint)
- **Action**: modify
- **What**: Add verification tier check before processing `mint` and `melt` operations. Check pubkey's tier against requested amount. Reject operations exceeding tier limits.
- **Why**: Enforcement point for KYC-gated limits

### New: `src/routes/verify/+page.svelte`
- **Action**: create
- **What**: KYC verification flow UI — embeds KYC provider SDK, guides user through tier upgrade
- **Why**: User-facing verification interface

### Modify: `src/routes/legal/terms/+page.svelte`
- **Action**: modify
- **What**: Add KYC/AML section explaining verification requirements and data handling
- **Why**: Regulatory requirement to disclose verification obligations

### Modify: `src/routes/legal/privacy/+page.svelte` (create if not exists)
- **Action**: create or modify
- **What**: Privacy policy covering KYC data collection, processing basis (legal obligation), data retention, third-party processors (KYC provider), data subject rights
- **Why**: GDPR requirement; essential for EU operation

## Execution Order

1. **Select KYC provider** — Evaluate Sumsub, Veriff, and Onfido against criteria. Obtain test API credentials. _Verify: Test API call succeeds, pricing confirmed._
2. **Define tier limits** — Finalize sat amounts for each tier based on jurisdiction requirements and legal counsel input. _Verify: Limits documented and approved by legal._
3. **Implement verification store** — Create encrypted storage linking pubkey hashes to verification tiers. _Verify: Store/retrieve verification records in test environment._
4. **Implement sanctions screening** — Integrate OFAC SDN list and EU consolidated list. _Verify: Known sanctioned entities are flagged; non-sanctioned entities pass._
5. **Integrate KYC provider** — Build provider adapter and webhook handler. _Verify: End-to-end test verification flow with provider sandbox._
6. **Build verification UI** — Create `/verify` page with KYC provider widget embed. _Verify: User can complete Tier 2 verification in test mode._
7. **Add mint-side enforcement** — Modify mint to check verification tier on mint/melt operations. _Verify: Unverified pubkey is rejected for amounts above Tier 0 limit; Tier 2 pubkey succeeds for amounts within limit._
8. **Update legal pages** — Add KYC/AML section to ToS; create/update privacy policy. _Verify: Legal counsel review and approval._

## Verification

- [ ] KYC provider integrated and functional in test mode
- [ ] Tier limits enforced at mint level (mint and melt operations)
- [ ] Sanctions screening blocks OFAC/EU-listed entities
- [ ] Verification UI allows tier upgrade flow
- [ ] Privacy policy published covering KYC data handling
- [ ] ToS updated with KYC/AML provisions
- [ ] GDPR: KYC PII stored only at provider, Cascade stores only hashes/tiers
- [ ] Pubkey linking mitigation active (withdrawal-side KYC + mint-side tracking)
