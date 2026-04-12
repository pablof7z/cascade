# USDC Wallet Rail Addendum

**Status:** Additive post-launch rail plan  
**Date:** 2026-04-11  
**Purpose:** Define how USDC can be added as another wallet funding and withdrawal source without changing the core wallet-mint and market-mint architecture.

## Positioning

USDC is not an either-or replacement for the wallet mint. It is another way to fund and withdraw the same USD wallet.

The canonical model remains:

- user wallet value is USD ecash
- trading spends USD value into market buys
- USDC is one more rail that can create or redeem that wallet value

## Recommended Shape

### Canonical Asset

- native `USDC`

### Canonical Chain

- `Base`

### Recommended Provider Stack

- `Circle` for treasury, deposit intents, and payout orchestration
- `Coinbase Onramp` as the primary consumer fiat-to-USDC onramp
- `Stripe Onramp` as a secondary card-first onramp where available

Direct USDC transfers should remain supported even if an onramp provider is down.

## Architecture

```text
user or onramp provider
  -> USDC deposit intent address
  -> reserve system controlled by Cascade
  -> wallet mint issues USD proofs
```

The mint issues proofs only after confirmed native USDC receipt.

## Required Components

- deposit-intent creation
- per-user or per-session destination addressing
- provider webhook intake and reconciliation
- native-USDC chain validation
- treasury balance monitoring
- outbound USDC withdrawal flow

If Circle is used, prefer letting Circle handle stablecoin payins and payouts instead of building raw chain-watch infrastructure first.

## Funding Flows

### Direct USDC Deposit

1. User chooses `Add Funds`
2. Backend creates deposit intent and returns destination address
3. User sends native USDC
4. Deposit confirms
5. Wallet mint issues USD proofs

### Onramp Into Deposit Address

1. User chooses `Buy USDC`
2. App creates deposit intent first
3. App launches Coinbase or Stripe onramp prefilled to the same destination address
4. Provider delivers native USDC to that address
5. Deposit confirms
6. Wallet mint issues USD proofs

### USDC Withdrawal

1. User requests USDC withdrawal
2. User provides destination address and amount
3. Wallet mint consumes USD proofs
4. Treasury system sends native USDC
5. Withdrawal status is tracked and recoverable

## What This Does Not Change

- the wallet unit remains USD
- the trade APIs remain spend-based and sell-based in USD
- the market mint still prices market trades separately
- the normal product UI still avoids sats and Lightning language

## Success Gates

- direct USDC deposits credit the wallet without manual operator action
- Coinbase or Stripe onramp can fund the same deposit-intent flow
- outbound USDC withdrawal is recoverable and auditable
- the wallet mint never issues against unsupported or bridged assets

## Failure Gates

- onramp provider success is treated as sufficient without confirmed USDC receipt
- bridged USDC is silently accepted
- USDC rail changes the core trade or wallet model

## Best Practices

- accept native USDC only
- keep deposit intent creation provider-agnostic
- treat provider onramps as convenience rails, not as the source of truth
- keep USDC support mainnet-only unless a strong non-mainnet testing story is intentionally added
- persist provider references and onchain settlement references together

## Sequencing Recommendation

Build this after the Stripe + Lightning launch path is stable, unless partner timing makes USDC commercially urgent.
