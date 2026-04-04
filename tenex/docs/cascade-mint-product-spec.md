# Cascade Mint — Product Specification

> Custom Cashu mint for the Cascade prediction market platform

**Status:** Decisions Confirmed — Implementation Pending 31933 Sig  
**Tags:** #cashu #mint #specification #lmsr #trading  
**Last updated:** 2026-04-04 15:05 UTC — Added Section 0 (confirmed decisions), updated Section 2 and 8 (CDK Rust, pure bearer, two keysets)

---

## 0. Decisions Confirmed by Pablo (2026-04-02)

The following decisions are final. Implementation can proceed once the mint-engineer agent is assigned via 31933 event.

| # | Decision | Choice | Source |
|---|----------|--------|--------|
| 1 | Fee model | Flat 1% on trades | Section 2 |
| 2 | Token model | **Pure bearer tokens** (NOT escrow accounts) | Pablo override conv fb86ff |
| 3 | Implementation | CDK Rust (NOT cashu-ts or Nutshell) | Pablo conv fb86ff |
| 4 | Keyset strategy | **TWO keysets per market** (one per outcome) | Pablo conv fb86ff |
| 5 | Lightning | **Required** — on/off-ramp for real sats | Section 2 |
| 6 | Rake model | **Rake stays in mint** — becomes mint liquidity | Proxy Decision 5 |
| 7 | P2PK (NUT-11) | Not required | Section 2 |
| 8 | Timed redemption | Not required | Section 2 |
| 9 | Token unit | Satoshis (1 token = 1 sat) | Section 2 |

**⚠️ Open Questions (Section 9)** — these remain unresolved and should be addressed before or during implementation:
1. Liquidity bootstrapping — who funds the initial LMSR reserve?
2. Maximum market size — should there be a cap on outstanding shares?
3. Multi-market reserve pooling — pooled or segregated reserves?
4. Settlement timeout — how long do winners have to claim payouts?
5. Partial redemption — can users sell fractions of shares mid-market?

---

## 1. Overview

Cascade requires a **custom Cashu-compatible mint** that serves as the settlement engine for its prediction markets. The mint is **operated by Cascade** (single operator, not federated) and manages the lifecycle of sats flowing into and out of LMSR-priced markets.

The mint is not a generic Cashu mint. It is purpose-built for prediction market mechanics while remaining Cashu-protocol-compatible for wallet interoperability.

---

## 2. Product Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Fee model | **Flat 1% on trades** | KISS — simple, predictable, easy to reason about |
| Operator | **Cascade-operated** | Single operator, full control, no federation complexity |
| Lightning | **Required** | On/off-ramp for real sats; users deposit/withdraw via Lightning |
| Token model | **Pure bearer tokens** | Users hold ecash directly; no per-user escrow accounts in mint DB |
| Rake model | **Rake stays in mint** | Fees accumulate as mint liquidity; Cascade extracts via melt when needed |
| Keyset strategy | **TWO keysets per market** | One keyset per outcome (LONG/SHORT); not one global keyset |
| P2PK (NUT-11) | **Not required** | No need for pubkey-locked tokens at mint level |
| Timed redemption | **Not required** | No HTLC or timelock conditions on proofs |
| Token unit | **Satoshis** | 1 token = 1 sat; no synthetic CAS denomination |

---

## 3. How Money Flows: LMSR ↔ Cashu Integration

### 3.1 The Core Insight

A standard Cashu mint is a simple ledger: sats in (via Lightning) → ecash out, ecash in → sats out (via Lightning). Every token is backed 1:1.

Cascade's mint has an **additional layer**: the LMSR cost function determines how many **outcome tokens** (LONG/SHORT shares) a user gets for their sats, and how many sats they get back when redeeming shares.

**The mint must understand that sats and market-position-tokens are not the same thing.**

### 3.2 The LMSR Pricing Model (Already Implemented)

The codebase already implements LMSR. Here's how it works for the mint:

```
Cost function:  C(q) = (1/b) * ln(e^(b*qLong) + e^(b*qShort))
Price of LONG:  p_long = e^(b*qLong) / (e^(b*qLong) + e^(b*qShort))
Price of SHORT: p_short = 1 - p_long
```

Where:
- `qLong` / `qShort` = outstanding shares for each outcome
- `b` = liquidity sensitivity parameter (currently `0.0001`)
- Price is always between 0 and 1, represents the market's probability estimate

**Buying shares:** User pays sats → LMSR calculates how many shares they receive:
- Cost to buy `Δq` shares of LONG = `C(qLong + Δq, qShort) - C(qLong, qShort)`
- The more shares already outstanding on a side, the more expensive new shares become
- Binary search solver finds token count for a given sat amount (see `solveBuyTokens`)

**Selling (redeeming) shares:** User returns shares → LMSR calculates sat payout:
- Payout for selling `Δq` LONG shares = `C(qLong, qShort) - C(qLong - Δq, qShort)`
- Selling reduces outstanding shares, making remaining shares cheaper

**Key property:** The LMSR reserve (`market.reserve`) always holds exactly enough sats to cover the worst-case payout. This is not fractional reserve — it's mathematically guaranteed solvent.

### 3.3 Where the 1% Fee Applies

The fee is taken on every trade execution (buy or sell):

**On BUY:**
```
User sends: 100 sats
Platform fee: 1 sat (1%)
Net into LMSR: 99 sats
Shares received: solveBuyTokens(market, side, 99)
```

**On REDEEM (sell):**
```
Shares returned: N tokens
Gross payout: solveRedeemValue(market, side, N) = X sats
Platform fee: X * 0.01
Net to user: X * 0.99
```

The fee goes to the **Cascade treasury** — a separate keyset or Lightning address controlled by the operator.

---

## 4. Mint Architecture

### 4.1 Standard Cashu Functions (NUT-Compliant)

The mint MUST implement these standard NUTs:

| NUT | Function | Cascade Usage |
|-----|----------|---------------|
| NUT-00 | Types & conventions | Proof/BlindSignature format |
| NUT-01 | Mint public keys | Publish keysets for denomination signing |
| NUT-02 | Keysets & fees | Active keysets; `input_fee_ppk` for standard swap fees |
| NUT-03 | Swap | Token splitting/merging (change-making) |
| NUT-04 | Mint tokens (Lightning) | User deposits sats → receives ecash |
| NUT-05 | Melt tokens (Lightning) | User redeems ecash → Lightning payout |
| NUT-06 | Mint info | `/v1/info` endpoint with supported NUTs |
| NUT-07 | Token state check | Wallet checks if tokens are spent/pending |
| NUT-12 | DLEQ proofs | Mint proves blind signatures are honest |
| NUT-17 | WebSocket subscriptions | Real-time quote status updates |

### 4.2 Custom Cascade Functions (Non-Standard)

These are **Cascade-specific extensions** beyond standard Cashu:

#### `POST /v1/cascade/trade`

Execute a prediction market trade. Accepts Cashu proofs as payment, returns outcome-position tokens.

```typescript
// Request
{
  inputs: Proof[],           // Standard Cashu proofs (sats being spent)
  market_id: string,         // Cascade market ID
  side: "LONG" | "SHORT",   // Outcome being purchased
  outputs: BlindedMessage[], // Blinded outputs for change (standard Cashu)
}

// Response
{
  trade: {
    market_id: string,
    side: "LONG" | "SHORT",
    sats_spent: number,      // After 1% fee
    fee: number,             // 1% platform fee
    shares_received: number, // LMSR-calculated
    entry_price: number,     // Average fill price
    end_price: number,       // Post-trade market price
  },
  change: BlindSignature[],  // Signed change outputs (if overpaid)
  position_proof: string,    // Signed receipt of position (for redemption)
}
```

#### `POST /v1/cascade/redeem`

Redeem outcome shares for sats.

```typescript
// Request
{
  position_proof: string,    // Position proof from trade
  market_id: string,
  side: "LONG" | "SHORT",
  shares: number,            // How many shares to redeem
  outputs: BlindedMessage[], // Blinded outputs to receive payout as ecash
}

// Response
{
  redemption: {
    gross_payout: number,    // LMSR-calculated
    fee: number,             // 1% fee
    net_payout: number,      // What user actually gets
    end_price: number,       // Post-redemption market price
  },
  signatures: BlindSignature[], // Signed ecash for payout amount
}
```

#### `POST /v1/cascade/settle`

Settle a resolved market. Winners redeem shares at 1.0, losers at 0.0.

```typescript
// Request
{
  position_proof: string,
  market_id: string,
  side: "LONG" | "SHORT",
  outputs: BlindedMessage[],
}

// Response
{
  settlement: {
    outcome: "YES" | "NO",
    winning_side: "LONG" | "SHORT",
    payout_per_share: number,   // 1.0 for winners, 0.0 for losers
    total_payout: number,
    fee: number,                // 1% on settlement payout
    net_payout: number,
  },
  signatures: BlindSignature[],
}
```

### 4.3 Market State Management

The mint is the **authoritative source of LMSR state**. This is critical.

Currently the codebase stores market state in Nostr events (kind 30000) with concurrency checking via `stateHash` and `version`. The mint must either:

**Option A: Mint IS the state authority**
- All trades go through the mint
- Mint computes LMSR state transitions
- Mint publishes updated market state to Nostr
- Frontend reads from Nostr but writes (trades) through mint
- Eliminates race conditions entirely

**Option B: Mint validates against Nostr state** (current architecture)
- Mint fetches latest market state from Nostr before executing trades
- Mint validates trade, signs tokens, publishes new state
- Concurrency errors handled via version/stateHash (already implemented)

**Recommendation: Option A.** The mint should own market state. Nostr events become a read-replica/audit log, not the source of truth. This is simpler and safer for financial operations.

---

## 5. Reserve Model

### 5.1 LMSR Solvency Guarantee

The LMSR cost function guarantees that the reserve always holds enough to pay out worst-case:

```
Reserve = C(qLong, qShort, b)
```

This means:
- If ALL long holders redeem → reserve covers it
- If ALL short holders redeem → reserve covers it
- The reserve is **not** the sum of all bets — it's the LMSR cost function value

After resolution:
- Winning side shares are worth the full payout
- Losing side shares are worth 0
- Reserve exactly covers winning payouts

### 5.2 Fee Reserve (Cascade Treasury)

Separate from the LMSR reserve. The 1% fee accumulates here:

```
Per trade: treasury += trade_amount * 0.01
```

This is pure profit to Cascade. It's backed by real Lightning sats — not market-dependent.

### 5.3 Lightning Backing

The mint's total Lightning balance must equal:
```
Total Lightning = Σ(all market reserves) + treasury + unredeemed user ecash balances
```

Standard Cashu accounting: every token in circulation is backed by a sat in the mint's Lightning node.

---

## 6. Module Creator Advantage

> "Module creators get to allocate when the market is small, so you get already an advantage/incentive."

When a user creates a new market (module), the market starts at 50/50 with zero outstanding shares. The creator is the first participant and can buy shares at the cheapest possible price (near 0.50 per share).

This is a **natural incentive** — no custom mint logic needed:
- Creator buys LONG at 0.50 → if they're right and it resolves YES, shares pay 1.00 → ~2x return
- The earlier you buy (fewer outstanding shares), the cheaper shares are
- As the market grows and more people buy one side, price moves and later entrants pay more

The mint doesn't need special "creator discount" logic. The LMSR curve itself rewards early conviction.

---

## 7. Testing Strategy

### 7.1 Phase 1: Nutshell (Development)

Use the reference Nutshell mint for developing wallet integration:
- `https://testnut.cashubtc.com` for quick testing
- Local Nutshell instance for CI/automation
- Validates: deposit, withdrawal, token serialization, proof verification

### 7.2 Phase 2: Cascade Mint (Custom)

Build the custom mint with LMSR integration:
- Local development against regtest Lightning
- Trade execution with real LMSR pricing
- Fee collection verification
- Reserve accounting audits

### 7.3 Phase 3: Testnet Launch

- Deploy on Bitcoin testnet/signet with real Lightning testnet
- Public beta users trade with testnet sats
- Stress test concurrency, reserve model, settlement

### 7.4 Phase 4: Mainnet

- Real sats, real Lightning
- Start with low liquidity parameter (small markets)
- Scale `b` parameter and market caps as confidence grows

---

## 8. Technology Choices

> **Chosen implementation: CDK Rust** — confirmed by Pablo (conv fb86ff). mint-engineer agent is being created to implement this.

### Mint Implementation Options

| Option | Language | Maturity | Pros | Cons |
|--------|----------|----------|------|------|
| ~~Nutshell fork~~ | Python | High | Reference impl, well-tested crypto | Python performance, harder to customize deeply |
| ~~Moksha~~ | Rust | Medium | Performance, type safety | Smaller community, steeper learning curve |
| ~~cashu-ts~~ | TypeScript | Medium | Same stack as frontend, fast iteration | Less battle-tested for production mints |
| **CDK Rust** ✅ | Rust | High | Cashu Dev Kit — official SDK, battle-tested, Rust performance | Needs mint-engineer agent to implement |
| Custom (Go/Rust) | Go/Rust | N/A | Full control, optimal performance | Build everything from scratch |

**Chosen for MVP: CDK Rust** — Cashu Dev Kit provides battle-tested blind signatures, DLEQ proofs, and keyset management out of the box. The mint-engineer agent will build on this. Custom endpoints (`/v1/cascade/*`) add the LMSR layer and prediction market mechanics.

---

## 9. Open Questions

1. **Liquidity bootstrapping**: Who funds the initial LMSR reserve when a market is created? Does Cascade seed it, or does the creator stake sats?
2. **Maximum market size**: Should there be a cap on outstanding shares per market to limit reserve exposure?
3. **Multi-market reserve pooling**: Can the mint pool reserves across markets, or must each market's reserve be strictly segregated?
4. **Settlement timeout**: When a market resolves, how long do winners have to claim payouts before the reserve is recycled?
5. **Partial redemption**: Can users sell a fraction of their shares mid-market, or only full position?
   - *Current code supports partial redemption* — the `solveRedeemValue` function handles arbitrary token amounts.

---

## 10. Appendix: Current LMSR Implementation Reference

The existing codebase (`src/market.ts`) already implements:
- `priceLong(qLong, qShort, b)` — current LONG price
- `priceShort(qLong, qShort, b)` — current SHORT price  
- `costFunction(qLong, qShort, b)` — LMSR cost (= reserve requirement)
- `solveBuyTokens(market, side, sats)` — binary search for share count given sat amount
- `solveRedeemValue(market, side, tokens)` — payout calculation for share redemption
- `applyBuy(market, side, sats, actor)` — full buy execution with state mutation
- `applyRedeem(market, side, tokens, actor)` — full redemption with proof spending

The custom mint must reuse or reimplement this exact math server-side. The LMSR parameters must match between frontend (preview) and mint (execution).
