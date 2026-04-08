# Regulatory Landscape

## United States

### CFTC — Primary Federal Risk

The Commodity Futures Trading Commission has asserted jurisdiction over prediction markets as "event contracts" under the Commodity Exchange Act (CEA). Key precedents:

- **Polymarket settlement (Jan 2022)**: $1.4M fine for operating an unregistered event contract market. Required to cease US operations.
- **Kalshi v. CFTC (2023-2024)**: Kalshi won the right to list election contracts as a registered DCM, but spent $100M+ to get there.
- **CFTC v. Nadex**: Established that binary options on events are "swaps" subject to CFTC oversight.

**Classification risk for Cascade**: LMSR-based continuous market making with real-money settlement almost certainly constitutes offering event contracts or swaps. Operating without DCM registration or exemption is a CEA violation.

**Mitigation options**:
1. **No-action letter**: Request CFTC staff guidance for small-scale operation. Precedent: Iowa Electronic Markets (IEM) received a no-action letter for academic prediction markets with <$500 position limits.
2. **CFTC sandbox/innovation lab**: Apply for regulatory sandbox treatment.
3. **Geo-fence US**: Block US users entirely (Polymarket's current approach).
4. **Register as DCM**: Prohibitively expensive at current stage ($10M+ compliance infrastructure).

**Recommendation**: Geo-fence US users at launch. Pursue no-action letter in parallel for limited US re-entry with position caps (IEM model: $500/contract).

### FinCEN — Money Transmission

The mint operator holds custodial funds (Lightning sats converted to Cashu tokens). This likely constitutes "money transmission" under the Bank Secrecy Act:

- **31 CFR § 1010.100(ff)(5)**: A money transmitter is anyone who "accepts currency, funds, or other value that substitutes for currency" and transmits it.
- Cashu tokens are bearer instruments representing value — functionally equivalent to stored value.
- Each state has its own Money Transmitter License (MTL) requirements — 48 states + DC require licensure.

**Mitigation options**:
1. **Federal MSB registration**: Required regardless — register with FinCEN as a Money Services Business. Low cost (~$0), but triggers BSA/AML obligations.
2. **State MTLs**: Prohibitively expensive to obtain 48+ licenses ($2-5M). Consider partnering with a licensed money transmitter or using a licensed payment processor.
3. **Custodial exemption**: Argue the mint is a "payment processor" not a transmitter — weak argument given Cashu's bearer nature.

**Recommendation**: Register as federal MSB. For state licensure, either (a) partner with an existing licensed entity, or (b) operate only in states with exemptions for small-volume transmitters while building volume.

### SEC — Securities Classification

**Lower risk** but not zero. Prediction market shares could be classified as securities if they:
- Are marketed as investments rather than information/entertainment
- Have secondary market trading that resembles securities markets

**Mitigation**: Market the platform as an information discovery tool, not an investment vehicle. Avoid language like "returns," "portfolio," or "invest."

### State-Level Gambling Laws

Many US states classify prediction markets as gambling. Even with CFTC clearance, state gambling statutes may apply:
- New York: Martin Act gives AG broad authority over "speculative" instruments
- California: Strict anti-gambling provisions
- States with legal sports betting may be more permissive

**Mitigation**: If re-entering US market, start with states that have gambling exemptions for skill-based or information markets, or states with active prediction market legislation.

## European Union

### MiCA (Markets in Crypto-Assets Regulation)

MiCA became fully applicable June 30, 2024. Key provisions affecting Cascade:

**Token Classification**:
- Cashu tokens likely fall under "e-money tokens" (EMTs) if pegged 1:1 to fiat value, or "other crypto-assets" if denominated in sats.
- **EMT implications**: Issuer must be authorized as a credit institution or e-money institution. Requires 1:1 reserve backing (which Cashu already does), but also requires whitepaper publication, authorization from a national competent authority, and ongoing reporting.
- **Sat-denominated tokens**: May fall outside EMT classification if not pegged to fiat. This is architecturally significant — keeping everything in sats (not EUR/USD-pegged stablecoins) may reduce MiCA burden.

**CASP (Crypto-Asset Service Provider) Requirements**:
- Operating a prediction market with crypto-asset settlement likely requires CASP authorization.
- CASP requirements include: legal entity in EU, minimum capital (€50,000-€150,000 depending on services), fit-and-proper management, AML compliance, complaint handling procedures.

**Travel Rule (MiCA Article 68 / TFR)**:
- Transfers > €1,000 require originator and beneficiary identification.
- Cashu's bearer nature makes this extremely difficult — no originator information is attached to tokens.
- **Critical gap**: Cashu P2P transfers are invisible to the mint. The mint sees mint/melt operations but not token transfers between wallets.

**Recommendation**: Sat-denomination (not fiat pegs) reduces EMT classification risk. Seek CASP authorization in a crypto-friendly EU jurisdiction (Lithuania, Estonia post-reform, or Malta). Budget €200,000-€500,000 for EU regulatory setup.

### MiFID II — Financial Instruments

If prediction market contracts are classified as financial derivatives:
- Much heavier regulation — investment firm authorization required
- Best execution obligations, transaction reporting, position limits
- Likely only triggered if contracts are marketed as financial instruments or have extended duration/complexity

**Mitigation**: Structure markets as simple binary event contracts with short durations. Avoid "derivative" language.

### GDPR Interaction

Nostr pubkeys may constitute personal data under GDPR if linkable to natural persons (even pseudonymous data can be "personal data" per CJEU rulings). If implementing KYC:
- Must provide lawful basis for processing (legal obligation for AML)
- Must allow data portability and erasure rights (tension with blockchain/Nostr immutability)
- Requires Data Protection Officer if processing at scale
- Cross-border transfers to US require Standard Contractual Clauses or adequacy decision

## Jurisdiction Selection Strategy

### Recommended: Phased Jurisdictional Approach

**Phase 1 — Launch (Pre-Revenue to Early Revenue)**:
- **Incorporate in**: A crypto-friendly jurisdiction with prediction market precedent
  - **Top pick: El Salvador** — Bitcoin legal tender, no specific prediction market prohibition, minimal regulatory overhead
  - **Alternative: Singapore** — MAS has a regulatory sandbox, crypto-friendly but more expensive
  - **Alternative: BVI/Cayman** — Common for crypto projects but increasing regulatory scrutiny
- **Geo-fence**: US, EU (pending CASP authorization), sanctioned countries (OFAC list)
- **Target markets**: Latin America, Southeast Asia, Africa — large unbanked populations where Lightning/Cashu has traction

**Phase 2 — EU Expansion (Revenue > €50K/month)**:
- Obtain CASP authorization in Lithuania or Malta
- Implement EU-grade KYC (see `kyc-identity.md`)
- Comply with Travel Rule for transfers > €1,000

**Phase 3 — US Re-Entry (Revenue > $500K/month)**:
- Pursue CFTC no-action letter for position-limited operation
- Register as FinCEN MSB
- Partner with licensed money transmitter for state coverage

### Sanctioned Jurisdictions — Immediate Block Required

Regardless of incorporation jurisdiction, the mint MUST block interactions from OFAC-sanctioned countries:
- Cuba, Iran, North Korea, Syria, Crimea/Donetsk/Luhansk regions
- Failure to block sanctioned jurisdictions creates US secondary sanctions risk even for non-US entities

**Implementation**: IP-based geo-fencing at the mint level (NUT-05 Lightning gateway) and at the frontend. Not foolproof (VPNs) but demonstrates good-faith compliance effort.

## File Changes

### `tenex/docs/cascade-risks-mitigations.md`
- **Action**: modify
- **What**: Update regulatory risk section with specific regulatory citations, jurisdiction strategy, and phase gates
- **Why**: Current document identifies regulatory risk but lacks actionable detail

### `src/routes/legal/terms/+page.svelte`
- **Action**: modify
- **What**: Add governing law clause, restricted jurisdictions list, AML/sanctions statement, real-money provisions
- **Why**: Current ToS lacks provisions necessary for real-money operation

### New: `src/lib/config/restricted-jurisdictions.ts`
- **Action**: create
- **What**: Export list of OFAC-sanctioned countries and geo-restricted jurisdictions, with utility functions for checking
- **Why**: Centralized jurisdiction restriction configuration for use in frontend and mint

### New: `src/lib/server/geo-fence.ts` (or mint-side equivalent)
- **Action**: create
- **What**: IP-based geo-fencing middleware that checks request origin against restricted jurisdictions
- **Why**: Required compliance control for sanctioned country blocking

## Execution Order

1. **Legal counsel engagement** — Retain a lawyer specializing in crypto/fintech regulation in the chosen incorporation jurisdiction. Verify jurisdiction strategy before implementing anything. _Verify: Engagement letter signed._
2. **Incorporate legal entity** — Establish the operating entity in chosen jurisdiction. _Verify: Certificate of incorporation obtained._
3. **FinCEN MSB registration** (if US exposure) — Even for geo-fenced US blocking, registration provides compliance documentation. _Verify: FinCEN registration confirmation._
4. **Update Terms of Service** — Add governing law, restricted jurisdictions, AML statement, real-money provisions. _Verify: Legal counsel review and approval of updated ToS._
5. **Implement geo-fencing** — Create restricted jurisdictions config and geo-fence middleware. _Verify: Requests from sanctioned IPs are blocked; test with geo-IP test data._
6. **Begin CASP application** (for EU Phase 2) — Start the authorization process early as it takes 6-12 months. _Verify: Application submitted to chosen national competent authority._

## Verification

- [ ] Legal entity established in chosen jurisdiction
- [ ] OFAC-sanctioned countries are blocked at frontend and mint level
- [ ] ToS updated with governing law, restricted jurisdictions, real-money provisions
- [ ] FinCEN MSB registration filed (if applicable)
- [ ] CASP application initiated (for EU expansion timeline)
- [ ] Regulatory risk document updated with specific citations and phase gates
