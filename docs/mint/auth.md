# Mint Authentication And Trade Attribution

This document defines how the mint layer should think about identity, bearer proofs, and attribution on kind `983`.

## The Core Constraint

Cashu proofs are bearer instruments.

- the holder of a valid proof can spend it
- proofs can be split, merged, and reissued through NUT-03 swap
- a proof may move from one user to another without any market trade occurring

Because of that, the mint cannot honestly infer a stable market participant identity from proofs alone.

## Goals

Cascade wants all of the following:

- pure bearer market tokens by default
- pure bearer USD wallet tokens by default
- honest public attribution on kind `983`
- no permanent proof-level identity lock
- no extra event for plain token swaps

The attribution model has to respect those constraints.

## Chosen Model

Kind `983` stays mint-authored.

- `event.pubkey` is always the market mint's Nostr pubkey
- `p` reflects the NIP-98 request signer when NIP-98 is present
- launch product trade requests use NIP-98, so launch-originated kind `983` events normally include `p`
- if the mint ever accepts a valid trade request without NIP-98 outside that launch surface, the event can omit `p`

There is no extra `identity` tag and no extra `actor` tag. Request attribution uses the standard Nostr `p` tag only.

## Meaning Of The `p` Tag

When present on kind `983`, `p` means:

- the Nostr pubkey that authenticated the HTTP request which executed this trade against the market mint

It does not mean:

- the original buyer of those proofs
- the current long-term economic owner across future swaps
- the only pubkey allowed to sell in the future

That definition is what keeps the `p` tag honest in a bearer-token system.

## Why Not Bind Proofs To A Stable Pubkey

Pubkey-locked proofs would let the mint enforce identity at the proof level.

Cascade does not want that as the default trade model because it gives the mint a direct per-holder censorship lever on sell-side exits. If the mint can require a specific key for a proof spend, it can selectively refuse that holder.

For that reason:

- bearer proofs remain the default
- NUT-11 proof locking is not the default attribution mechanism

## NIP-98

NIP-98 is the right place for trade attribution.

It proves that a Nostr key signed the exact HTTP request URL and method, and can also bind the request body hash. That is enough for a defensible `p` tag on a mint-authored trade event.

Operationally:

1. Client sends the trade request with a NIP-98 authorization header in normal launch product flows.
2. Mint verifies the NIP-98 event.
3. If valid, mint copies the Nostr pubkey into the `p` tag on kind `983`.
4. If a non-launch or internal trade path ever executes without NIP-98, the mint omits `p` rather than inventing attribution.

## Stable And Ephemeral Attribution

This model supports at least two user behaviors:

- NIP-98 signed by an ephemeral key: pseudonymous `p` tag
- NIP-98 signed by a stable user key: stable public attribution

The mint does not need to distinguish between those modes beyond verifying the signature.

## Swaps Do Not Emit Kind `983`

NUT-03 swap can move or reissue proofs without touching LMSR state.

That means:

- custody may change
- privacy state may change
- denominations may change

But none of the following change:

- `qLong`
- `qShort`
- reserve
- price

So swaps are not buys and not sells. They do not emit kind `983`.

## Optional NUT-20

NUT-20 can still be useful in the future for quote-level authorization on mint quote redemption.

If added, it should be treated as quote hardening, not as the default source of public user attribution on kind `983`. The bearer token model still dominates the downstream identity story.

## Kind `983` Impact

The kind `983` schema should allow:

```text
kind: 983
pubkey: <market-mint pubkey>
tags:
  ["e", "<market-event-id>"]
  ["amount", "<base units>"]
  ["unit", "<currency unit, launch uses 'usd'>"]
  ["direction", "yes" | "no"]
  ["type", "buy" | "sell"]
  ["price", "<ppm>"]
  ["p", "<nostr-pubkey>"]   # present when NIP-98 was validated
```

For launch, `unit=usd` means the trade amount is recorded in USD minor units as product-facing notional, even though settlement may happen over Lightning.

Absence of `p` is intentional and meaningful. It means the mint did not receive valid NIP-98 attribution for that trade path.

## Implementation Consequences

- launch buy and sell endpoints should require NIP-98
- the mint should still define `p` as request-level attribution, not proof ownership
- the mint should never infer `p` from proof history, keyset ownership, or local wallet state
- the mint should never emit kind `983` for plain NUT-03 swap activity

This keeps kind `983` useful without breaking the bearer-token model that Cascade depends on.
