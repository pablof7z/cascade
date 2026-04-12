# NIP-TBD — Kind 983: Prediction Market Trade Event

**Status:** Draft  
**Author:** Cascade  
**Created:** 2026-04-05  
**Depends on:** Kind 982 (Prediction Market Definition)

---

## Overview

This document specifies kind `983`, a non-replaceable Nostr event that records a single trade on a prediction market. Trade events are published exclusively by the prediction market mint using its own keypair. They may optionally include a `p` tag when the trade request was authenticated with NIP-98.

---

## Motivation

Prediction markets built on Cashu ecash mints face a structural design challenge: the mint can prove that a trade occurred without revealing who held those tokens. This property is valuable. It enables a public, auditable trade history — useful for market activity feeds, volume metrics, and price discovery — while preserving the privacy guarantees of the underlying Cashu protocol.

Traditional prediction market designs leak trader identity at the protocol layer. By having the **mint** publish trade events signed with its own keypair, and treating public user attribution as optional request-level metadata, kind 983 keeps mint authority separate from optional identity disclosure.

Clients and relays can verify that a trade event is authentic by checking the `pubkey` against a known mint identity. Fake trade events from third parties are trivially detectable and can be ignored.

---

## Specification

### Event Structure

```
kind: 983
pubkey: <mint's pubkey, hex>
content: ""
tags:
  ["e",         "<kind-982-market-event-id>",  "<relay-url-optional>"]
  ["p",         "<nostr-pubkey-optional>"]
  ["amount",    "<integer — product-facing trade notional in base units>"]
  ["unit",      "<currency unit — e.g. 'usd'>"]
  ["direction", "yes" | "no"]
  ["type",      "buy" | "sell"]
  ["price",     "<integer — average price in millionths (ppm)>"]
```

### Field Definitions

#### `e` — Market Reference

References the kind `982` event that defines the market this trade belongs to.

- Value: 64-character lowercase hex event ID
- A relay URL MAY be included as the second element
- Exactly one `e` tag MUST be present

#### `amount` — Product-Facing Trade Notional

The product-facing notional value involved in this trade, expressed as a positive integer in the smallest indivisible unit of the declared currency.

- For Cascade launch, `unit=usd` and the amount is stored in USD minor units
- This is the user-facing notional amount, not the raw Lightning settlement amount
- MUST be a positive integer greater than zero
- MUST NOT be zero or negative

#### `unit` — Currency Unit

The currency denomination of `amount`. Follows Cashu unit conventions.

- Common values: `sat`, `msat`, `usd`
- For launch, Cascade emits `usd` for the product-facing notional amount
- Clients SHOULD reject events with unknown units unless they can infer meaning from context

#### `direction` — Side of the Market

Which outcome the tokens represent.

- `yes`: tokens representing the affirmative outcome
- `no`: tokens representing the negative outcome
- Explicitly stated in the tag for readability and relay filterability
- Note: The Cashu keyset used to issue the token also encodes direction, but clients SHOULD NOT rely solely on keyset inference — the tag is canonical

#### `type` — Trade Direction

Whether this trade expanded or contracted the market's outstanding token supply.

- `buy`: tokens were minted (trader bought into a position; market cap expands)
- `sell`: tokens were burned (trader exited a position; market cap contracts)

#### `price` — Average Price

The average per-token price paid or received in this trade, expressed as a positive integer in **parts per million (ppm)** of the base unit.

**Rationale for millionths (ppm):**  
Prediction market probabilities range from 0 to 1. Representing this as basis points (0–10,000) gives only 4 decimal places of precision — insufficient for prices near the tails (e.g. a 0.3% or 99.7% market). Millionths (0–1,000,000) give 6 decimal places, which comfortably covers tail pricing and matches the precision available from LMSR cost functions without resorting to floating-point arithmetic.

| Probability | Basis points | Millionths (ppm) |
|-------------|-------------|-----------------|
| 1%          | 100         | 10,000          |
| 50%         | 5,000       | 500,000         |
| 99%         | 9,900       | 990,000         |
| 0.1%        | 10          | 1,000           |
| 99.9%       | 9,990       | 999,000         |

A price of `500000` means a 50% implied probability.

- MUST be a positive integer in range `[1, 999999]`
- Represents the **average** price across the trade (relevant for large trades that walk the LMSR curve)
- Captures price only

### Optional Request-Signer Attribution

Kind 983 events are always authored by the mint. They MAY additionally contain an optional `p` tag when the trade request was authenticated with NIP-98.

- If present, `p` is the Nostr pubkey that signed the HTTP request which executed the trade
- If absent, the trade is intentionally anonymous
- `p` does not claim permanent ownership of the proofs involved in the trade
- `p` does not survive later bearer-proof swaps
- Clients MUST NOT interpret `p` as a proof-level ownership lock

### Mint Authentication

Clients MUST verify that a kind 983 event's `pubkey` matches the known mint pubkey for the referenced market before treating it as authoritative. The mint pubkey is discoverable from the kind 982 market event or from out-of-band mint metadata.

Events purporting to be kind 983 from unknown pubkeys SHOULD be ignored or clearly labeled as unverified.

---

## Event Example

```json
{
  "id": "a3f1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
  "pubkey": "9d2b4e6f8a0c1e3f5a7b9c0d2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0",
  "created_at": 1743876300,
  "kind": 983,
  "tags": [
    ["e", "5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"],
    ["p", "63fe6318dc58583cfe16810f86dd09e18bfd76aabc24a0081ce2856f330504ed"],
    ["amount", "1000"],
    ["unit", "usd"],
    ["direction", "yes"],
    ["type", "buy"],
    ["price", "623000"]
  ],
  "content": "",
  "sig": "b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2"
}
```

**Reading this event:** The Cascade mint (`9d2b4e...`) records that `$10.00` notional of `yes` exposure was **bought** on market `5c83da...` at an average price of 623,000 ppm (≈ 62.3% implied probability). The optional `p` tag says which Nostr pubkey authenticated the HTTP request for this trade.

---

## Relay Filtering Patterns

### All trades for a specific market

```json
{
  "kinds": [983],
  "#e": ["5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"]
}
```

### All trades from a known mint

```json
{
  "kinds": [983],
  "authors": ["9d2b4e6f8a0c1e3f5a7b9c0d2e4f6a8b0c2e4f6a8b0c2e4f6a8b0c2e4f6a8b0"]
}
```

### Recent trades on a market (for activity feed)

```json
{
  "kinds": [983],
  "#e": ["5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"],
  "since": 1743873000,
  "limit": 50
}
```

### YES-side trades only

The `direction` tag is indexed (single-letter tags are indexed by relays per NIP-01). Clients can filter by direction:

```json
{
  "kinds": [983],
  "#e": ["<market-id>"],
  "#direction": ["yes"]
}
```

> **Note:** `direction` is a multi-character tag name, which means it is **not** automatically indexed by all relay implementations. Clients that need direction filtering SHOULD either: (a) fetch all trades for a market and filter client-side, or (b) rely on relays that implement custom tag indexing. A relay optimization is to store `direction` as a single-letter alias (`d` is taken; consider `x` for direction) if relay-side filtering is a hard requirement.

### Volume computation

Clients wishing to compute total traded volume SHOULD subscribe to all kind 983 events for a market, accumulate `amount` values, and distinguish `buy` vs `sell` to compute net open interest separately from gross volume.

---

## Notes

### Why tags instead of JSON content?

All trade fields are placed in tags rather than the `content` field. This follows Nostr convention: structured machine-readable data belongs in tags (indexed, filterable), while `content` is for human-readable prose. The `content` field is left empty. Packing fields into a JSON content blob would prevent relay-side filtering and requires clients to parse an extra layer.

### Relationship to Cashu keysets

A Cashu prediction market mint issues tokens using different keysets per outcome (e.g., one keyset for `yes` tokens, one for `no` tokens). The `direction` tag in kind 983 is the canonical, human-readable encoding of which keyset was used. Clients and auditors MAY cross-reference the mint's keyset metadata to verify consistency, but SHOULD treat the tag as authoritative for display and filtering purposes.

### Auditability

Because kind 983 events are non-replaceable and signed by the mint's keypair, they form a tamper-evident public audit log of all market activity. Anyone can verify:
- Total tokens bought per outcome (sum of `amount` where `type=buy` and `direction=yes/no`)
- Net outstanding supply (bought minus sold)
- Price history over time
- That the mint is not creating unbacked tokens (if token supply is cross-referenced against Lightning invoices)

### Fees

The `price` field reflects the marginal cost from the LMSR pricing function. Pricing policy details are out of scope for this specification.

### Multi-outcome markets

This specification covers binary (yes/no) markets. Markets with more than two outcomes SHOULD use a broader set of `direction` values (e.g. `a`, `b`, `c` or human-readable outcome labels). A future revision of this spec will address multi-outcome markets formally.

---

## Changelog

| Date       | Change                          |
|------------|---------------------------------|
| 2026-04-05 | Initial draft                   |
