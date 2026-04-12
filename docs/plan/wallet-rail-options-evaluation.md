# Wallet Rail Options Evaluation

**Status:** Planning memo with launch decision update  
**Date:** 2026-04-11  
**Purpose:** Compare the funding, payout, and settlement-rail options we evaluated for Cascade's USD stablemint and market-mint architecture.

## Executive Summary

This memo now has two roles:

- preserve the option set we evaluated
- record the launch architecture we selected after that evaluation

The selected launch shape is:

1. Stripe and Lightning at the product boundary for wallet funding
2. a self-operated USD wallet mint
3. Lightning as the hidden inter-mint settlement rail
4. a market mint with LMSR execution and LONG/SHORT keysets
5. a product coordinator that composes `USD <-> msat` and `LONG/SHORT <-> msat` quotes

USDC remains an additive later rail. See [usdc-wallet-rail-addendum.md](./usdc-wallet-rail-addendum.md).

The earlier "internal same-unit USD clearing" idea is no longer the chosen path.

The main architectural question is not "which chain should market tokens live on?" The main question is "what should fund the wallet mint, and how should the wallet mint settle value into the market mint?"

The selected launch shape for Cascade is:

1. external money rail
2. global USD wallet mint
3. Lightning bridge with hidden `msat` settlement
4. market mint with LONG/SHORT LMSR execution

That is better than forcing every trade to settle directly against a market mint over Lightning or a blockchain rail.

The options rank like this:

1. **Chosen launch funding rails:** `Stripe` and `Lightning` into the wallet mint
2. **Best managed multi-rail backend later:** `Lightspark Grid`
3. **Best crypto-native stablecoin rail later:** `Circle USDC`
4. **Best Tether-based crypto rail later:** `USDT-Liquid`
5. **Works but poor first choice:** raw `USDT` on BSC or another EVM chain

The following options are not recommended as the primary architecture:

- direct per-market deposit and withdrawal rails
- Lightspark `Connect` as the main integration surface
- Spark as a launch-critical dependency

## What The Product Needs

These constraints are now explicit in the project docs:

- The user-facing base unit is USD.
- Application and product APIs represent USD in integer minor units.
- The normal product UI should not expose sats, msats, or Lightning invoice mechanics.
- The wallet mint is the reusable capital layer.
- The market mint is the LMSR execution layer.
- The market mint still needs size-aware quotes because LMSR prices every trade as a function of current state plus trade size.

See:

- [product-decisions.md](../design/product-decisions.md)
- [architecture.md](../mint/architecture.md)
- [api.md](../mint/api.md)

## Architectural Baseline

The intended financial topology is:

```text
external rail
  -> wallet mint (USD ecash)
  -> Lightning bridge with hidden msat settlement
  -> market mint (LONG/SHORT)
```

The anti-pattern is:

```text
external rail
  -> each market mint directly
```

Why the anti-pattern is bad:

- balances fragment across markets
- every trade depends on external settlement timing
- every market mint needs direct rail integration
- the trading UX becomes a chain or Lightning UX
- the user loses the idea of a reusable wallet balance

## Evaluation Criteria

Each option was evaluated on:

- product UX
- engineering complexity
- operational burden
- compliance and fraud risk
- self-custody fit
- reuse across all markets
- quote and FX complexity
- time to launch
- vendor dependence

## Option 1: Stripe Gateway

### Shape

```text
Stripe card payment
  -> wallet mint issues USD ecash
```

### Why it fits

This is the cleanest path for a non-crypto consumer product.

- users already understand cards
- no external wallet required
- no onchain UX
- cleanest non-crypto way to get value into the wallet mint

### Strengths

- fastest familiar consumer funding flow
- cleanest onboarding for non-Bitcoin users
- easiest UI copy
- pairs well with a spend-based quote model

### Weaknesses

- chargebacks
- card fraud
- reversible fiat funding against irreversible bearer value
- weakest immediate self-custody story unless export is constrained

### What Stripe actually gives us

Stripe gives payment collection, not the mint.

- PaymentIntent tracks the payment lifecycle: https://docs.stripe.com/payments/payment-intents
- Stripe recommends webhooks for completion handling: https://docs.stripe.com/webhooks/handling-payment-events
- Checkout fulfillment also points to webhook-driven fulfillment: https://docs.stripe.com/checkout/fulfillment

### Verdict

Best first consumer funding rail.

## Option 2: Lightning `msat` Bridge

### Shape

```text
wallet mint in USD
  -> quote USD <> msat
  -> pay market-mint Lightning invoice
  -> market mint issues LONG/SHORT
```

### Why we considered it

It stays closer to standard Cashu mint and melt flows.

### Strengths

- conceptually Cashu-native
- reuses invoice-backed mint quote patterns
- keeps the market mint close to existing LN-based assumptions

### Weaknesses

- requires `USD <> msat` conversion at the wallet boundary
- requires custom processors because stock CDK does not handle `USD <-> sat/msat`
- adds a rail unit the product is trying to hide
- worse fit if the product is explicitly dollar-denominated

### Current repo implications

The current code is still heavily sat-native, which shows how much migration debt this path would preserve:

- [lmsr.rs](/Users/customer/Work/cascade-8f3k2m/mint/crates/cascade-core/src/lmsr.rs)
- [trade.rs](/Users/customer/Work/cascade-8f3k2m/mint/crates/cascade-core/src/trade.rs)
- [types.rs](/Users/customer/Work/cascade-8f3k2m/mint/crates/cascade-api/src/types.rs)

### Verdict

Chosen as the hidden inter-mint settlement shape, but only behind a dollar-denominated product API.

## Option 3: Circle USDC

### Shape

```text
USDC payin / payout
  -> wallet mint issues USD ecash
  -> internal USD clearing
  -> market mint
```

### Why it fits

Circle gives a much cleaner stablecoin API than raw chain integration.

### Strengths

- explicit stablecoin payin and payout APIs
- clear payment-intent model
- webhook-friendly
- better than raw chain watchers for a first stablecoin rail
- aligns cleanly with a global USD wallet

### Weaknesses

- Circle dependency
- USDC-specific rather than stablecoin-agnostic
- still a crypto funding flow, not a mainstream consumer card flow
- onboarding is harder than Stripe

### Source-backed facts

Circle Mint stablecoin payins and payouts:

- payins use payment intents, deposit addresses, and webhook or polling confirmation: https://developers.circle.com/circle-mint/how-stablecoin-payins-and-payouts-work
- stablecoin payins support continuous and transient intents: https://developers.circle.com/circle-mint/receive-stablecoin-payin
- stablecoin payouts require address-book recipients and payout status tracking: https://developers.circle.com/circle-mint/send-stablecoin-payout

### Verdict

Best crypto-native rail if we want a serious stablecoin path without owning raw chain infrastructure.

## Option 4: USDT-Liquid

### Shape

```text
USDT-Liquid payin / payout
  -> wallet mint issues USD ecash
  -> internal USD clearing
  -> market mint
```

### Why it fits

If we want Tether specifically, Liquid is the most coherent chain for this product.

### Strengths

- issued-asset model matches stablecoin movement well
- one asset standard for BTC and issued assets
- fast and predictable settlement
- confidential transactions are a real differentiator
- better fit than raw EVM token ops

### Weaknesses

- more niche than card rails and mainstream stablecoin APIs
- smaller wallet/user familiarity than Stripe or major EVM wallets
- off-ramp/on-ramp still needs an integration story

### Source-backed facts

- Tether officially lists `Liquid Asset via Liquid Blockchain` as supported: https://tether.to/en/supported-protocols/
- Liquid supports issued assets and stablecoins, one-minute blocks, and final settlement in about two to three minutes: https://docs.liquid.net/docs/technical-overview
- Liquid's confidential transactions hide asset type and amount from third parties by default: https://docs.liquid.net/docs/liquid-features-and-benefits

### Verdict

Best Tether-flavored rail we evaluated.

## Option 5: Raw USDT On BSC Or Another EVM Chain

### Shape

```text
raw token watcher + hot wallet
  -> wallet mint issues USD ecash
  -> internal USD clearing
  -> market mint
```

### Why we considered it

It is cheap, fast, and widely used.

### Strengths

- low fees
- broad wallet support
- straightforward token UX for crypto users

### Weaknesses

- we own chain watching
- we own hot wallet ops
- we own token quirks and failure modes
- support burden is high
- chain choice becomes a product support problem

### Source-backed facts

Tether's official supported protocols page lists:

- BNB Smart Chain
- Liquid
- Ethereum
- Tron
- Solana
- others

As of 2026-04-11, that same official page does **not** list Polygon in the supported-protocols list we checked, so `USDT on Polygon` is not something we should assume without additional confirmation: https://tether.to/en/supported-protocols/

### Verdict

Possible, but operationally worse than Circle or Lightspark and worse product UX than Stripe.

## Option 6: Lightspark Grid

### Shape

```text
Lightspark Grid
  -> wallet mint issues USD ecash
  -> internal USD clearing
  -> market mint
```

### Why it fits

Grid is the first option we evaluated that looks like a serious managed money-movement backend rather than one rail.

### Strengths

- one API for fiat, stablecoins, and BTC
- quote system with locked rates, explicit fees, and expiry
- internal accounts and prefunded balances fit the wallet-mint mental model
- JIT funding can also support on-demand money movement
- potentially removes a lot of payment plumbing we would otherwise build

### Weaknesses

- likely heavy vendor dependence
- likely onboarding/commercial process heavier than Stripe
- still does not replace the Cascade mint layer
- documentation suggests a broad platform product, which may be more than we need at launch

### Source-backed facts

Grid is explicitly a low-level payment infrastructure API across fiat, stablecoins, and Bitcoin: https://grid.lightspark.com/platform-overview/introduction/what-is-grid

Grid quote system:

- locked exchange rates
- exact send/receive amounts
- fees
- payment instructions
- expiration
- prefunded and JIT funding models

Source: https://grid.lightspark.com/platform-overview/core-concepts/quote-system

Grid also has internal accounts intended for platform or customer funds used for real-time quotes and transfers: https://grid.lightspark.com/platform-overview/core-concepts/account-model

Lightspark's wallet positioning also explicitly mentions:

- Bitcoin, Lightning, stablecoins, and domestic rails
- self custody at scale
- ramps
- support for stablecoins on Bitcoin

Source: https://www.lightspark.com/solutions/wallets

### Verdict

Best managed multi-rail option we evaluated. If we want to avoid building payment infrastructure ourselves, this is the strongest candidate.

## Option 7: Lightspark Connect

### Shape

```text
Lightspark Connect / node product
  -> Lightning infrastructure
  -> wallet mint / market mint bridge
```

### Why it fits less well

Connect is the Lightning node-management product, not the multi-rail money movement API.

### Strengths

- better Lightning ops
- node, liquidity, routing, and uptime handled for us

### Weaknesses

- still centers Lightning
- does not solve the broader wallet-rail question
- less aligned with the move away from `USD <> msat` as the primary product path

### Verdict

Useful only if we choose to stay Lightning-centric. Not the preferred main integration.

## Option 8: Lightspark Spark

### Shape

```text
Spark wallet / asset rail
  -> wallet mint replacement or companion
  -> market mint bridge
```

### Why we considered it

Spark is explicitly about Bitcoin-native instant movement of Bitcoin and native assets, including stablecoins.

### Strengths

- very strong UX story if it matures
- aligned with self-custodial wallets
- stablecoins on Bitcoin is strategically attractive

### Weaknesses

- newer and more strategic than battle-tested for our launch needs
- larger platform bet than just picking a payment rail
- overlaps conceptually with parts of what our wallet mint already does

### Source-backed facts

Lightspark markets Spark as a Bitcoin-native layer for instant movement of Bitcoin and native assets including stablecoins: https://www.lightspark.com/solutions/wallets and https://www.lightspark.com/news/spark/spark-is-live

### Verdict

Interesting future direction. Too ambitious as the launch-critical dependency.

## Option 9: Direct Deposits And Withdrawals From Each Market Mint

### Shape

```text
external rail
  -> market mint directly
  -> user receives LONG/SHORT
```

### Why it looks attractive at first

It appears to remove a bridge step.

### Why it is actually worse

- there is no reusable wallet balance
- every trade becomes a rail event
- every market mint becomes a rail integration point
- user capital fragments across markets
- trade latency and failure modes become external-rail problems
- portfolio and wallet UX become harder to reason about

### Verdict

Rejected as the primary architecture.

## Comparison Matrix

| Option | UX for normal users | Engineering effort | Ops burden | Vendor dependence | Launch speed | Long-term fit |
|---|---|---:|---:|---:|---:|---:|
| Stripe | Excellent | Low | Medium | Medium | Excellent | Good |
| Lightspark Grid | Good | Medium | Low-Medium | High | Good | Excellent |
| Circle USDC | Medium | Medium | Medium | High | Good | Very good |
| USDT-Liquid | Medium | Medium-High | Medium | Medium | Medium | Good |
| Raw USDT on EVM | Medium | High | High | Low | Medium-Low | Fair |
| Lightning/msat bridge | Medium-Low | High | Medium | Low | Low | Fair |
| Direct-to-market deposits | Poor | High | High | Varies | Low | Poor |

## How Quotes Work Under These Architectures

There are two distinct quote problems.

### 1. External Rail Quote

This only exists when an external rail conversion is needed.

Examples:

- card funding cost and fees
- USD to BTC or BTC to USD conversion
- stablecoin to fiat conversion

This quote belongs to the external funding layer, not the LMSR engine.

### 2. Market Trade Quote

This always exists because LMSR pricing depends on trade size.

The market quote must include at least:

- market id
- side
- requested spend or requested quantity
- average fill price
- marginal price before
- marginal price after
- fees
- expiry or slippage rules

This is true regardless of whether the external rail is Stripe, Circle, Liquid, Lightspark, or Lightning.

## Recommended Decision Paths

### Path A: Fastest Consumer Launch

Use:

- Stripe and Lightning for add-funds
- wallet mint for USD ecash
- Lightning bridge with `USD <-> msat` and `LONG/SHORT <-> msat` quote composition
- market mint for LONG/SHORT

This is the lowest-friction user path.

### Path B: Best Managed Multi-Rail Backend

Use:

- Lightspark Grid for external money movement
- wallet mint for USD ecash
- Lightning bridge or other rail-backed settlement adapter under the same wallet-mint model
- market mint for LONG/SHORT

This is the best option if we want a serious money-movement backend and are comfortable with vendor dependence.

### Path C: Best Crypto-Native Rail

Use:

- Circle USDC first
- optionally USDT-Liquid later if Tether-specific demand matters
- wallet mint for USD ecash
- the same wallet-mint model, with a later stablecoin rail adapter instead of changing the market mint
- market mint for LONG/SHORT

This is the strongest path if crypto-native funding matters more than mainstream card UX.

## Recommendation

The most defensible recommendation from everything we evaluated is:

1. keep the **global USD wallet mint**
2. keep the **separate market mint**
3. use **Lightning as the hidden inter-mint bridge**
4. compose **`USD <-> msat`** and **`LONG/SHORT <-> msat`** quotes at execution time
5. keep the user-facing product dollar-denominated

If the goal is fastest product launch for normal users:

- launch with **Stripe** and **Lightning** as the only wallet funding rails

If the goal is a more durable payments backend and we are willing to depend on a vendor:

- choose **Lightspark Grid**

If the goal is crypto-native funding:

- choose **Circle USDC**

If the goal is specifically Tether:

- choose **USDT-Liquid**, not raw BSC first

## What This Means For The Repo

Regardless of rail choice, the first code step is unchanged:

- make the mint core unit-neutral
- stop hard-coding sat-specific reserve/cost fields
- define the product quote contract in USD minor units

Only after that should we bind one external rail to the wallet mint.

See:

- [usd-stablemint-stripe-implementation.md](./usd-stablemint-stripe-implementation.md)
- [architecture.md](../mint/architecture.md)
- [api.md](../mint/api.md)

## Source Index

### Stripe

- Payment Intents: https://docs.stripe.com/payments/payment-intents
- Webhooks: https://docs.stripe.com/webhooks/handling-payment-events
- Checkout fulfillment: https://docs.stripe.com/checkout/fulfillment

### Lightspark

- Grid overview: https://grid.lightspark.com/platform-overview/introduction/what-is-grid
- Grid quote system: https://grid.lightspark.com/platform-overview/core-concepts/quote-system
- Grid account model: https://grid.lightspark.com/platform-overview/core-concepts/account-model
- Wallet solution page: https://www.lightspark.com/solutions/wallets
- Product overview: https://www.lightspark.com/
- Spark launch page: https://www.lightspark.com/news/spark/spark-is-live

### Circle

- Stablecoin payins and payouts overview: https://developers.circle.com/circle-mint/how-stablecoin-payins-and-payouts-work
- Receive a stablecoin payin: https://developers.circle.com/circle-mint/receive-stablecoin-payin
- Send a stablecoin payout: https://developers.circle.com/circle-mint/send-stablecoin-payout

### Tether

- Supported protocols: https://tether.to/en/supported-protocols/

### Liquid

- Technical overview: https://docs.liquid.net/docs/technical-overview
- Features and benefits: https://docs.liquid.net/docs/liquid-features-and-benefits
