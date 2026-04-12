# Positions & Portfolio

## What A Position Is

A position is a record that a user holds shares in a market outcome. It captures:

- which market
- which side (`YES` / `NO`)
- how many shares are held
- how much was paid in USD minor units to acquire them
- the average purchase price

UI renders those monetary values as dollars. Storage should stay in integer minor units.

## Current Implementation: Kind 30078 (NIP-78)

Positions are stored as NIP-78 application-specific data events (kind `30078`). The user signs and publishes these events themselves.

```text
kind: 30078
pubkey: <user pubkey>
content: <JSON-stringified position object>
tags:
  ["d", "cascade:position:<marketId>:<direction>"]
  ["c", "cascade"]
  ["v", "1"]
```

**d-tag format**: `cascade:position:<marketId>:<direction>`

Example: `cascade:position:abc123def456:yes`

## Replaceability

Kind `30078` is replaceable for a given pubkey + d-tag combination. Last-write-wins.

That is acceptable because each user writes only their own position record for a given market + direction pair.

## Updating Positions

After each trade, the frontend publishes an updated kind `30078` event reflecting the new position state.

- after **buying** YES shares: increment `shares`, update `amount_minor`, recalculate `avg_price_minor`
- after **selling** YES shares: decrement `shares`, update `amount_minor` proportionally
- after **full exit**: either delete the event or set `shares` to `"0"`

Average price is recalculated on each buy:

```text
new_avg_price = (old_shares * old_avg_price + new_shares * new_price) / (old_shares + new_shares)
```

## PnL Calculation

**Unrealized PnL** is current mark-to-market value minus the amount paid.

```text
unrealized_pnl_minor = current_position_value_minor - total_minor_committed
```

Current LMSR price is fetched from the mint. If a client wants to derive price from public history, it must do so from a full trade/state reconstruction pipeline; canonical kind `983` events do not directly expose `qLong` and `qShort`.

**Realized PnL** is locked in after a sale. It is the difference between the USD value received and the USD value paid for the shares that were sold.

## Portfolio Page (`/portfolio`)

Shows the current user's open positions across all markets:

- market title and link
- direction (`YES` / `NO`)
- shares held
- average purchase price
- current price
- unrealized PnL in dollars and percentage

Only open positions are shown in the main list. Fully sold positions may appear in a history section.

There is no canonical private `/api/portfolio` route backed by server-held proofs. Portfolio is derived from user-side proof state, user-published position records, and public market data.

## Public Profile Surface

Public profiles may show a user's published positions because kind `30078` events are public Nostr events.

The profile surface can display:

- active positions with current values
- performance summary where appropriate
- recent market activity

## Local State

The active frontend should treat local proof state as the wallet source of truth.

That includes:

- USD proofs in the wallet
- market proofs for open positions
- NIP-78 position records used for public profile and cross-device hints

## Future: Deriving Positions From Kind 983

The current kind `30078` approach has a limitation: it is user-maintained. If a user trades on multiple devices, or uses an agent on their behalf, it can become stale.

A more robust future approach is to partially derive positions from kind `983` trade events published by the mint.

The challenge is unchanged: Cashu is a bearer system. Kind `983` may include an optional `p` tag when the trade request used NIP-98, but that tag only identifies the request signer for that specific trade. It does not identify the long-term bearer owner across future swaps, and it may be absent entirely for anonymous trades.

That means linking kind `983` events back to user positions still requires at least one of:

1. the trade included optional NIP-98 attribution and the user wants to be publicly attributable for that execution
2. the user maintains their own position record
3. the user or wallet reconstructs holdings from local proof state

Kind `30078` is still the current user-facing position record. Kind `983`-based derivation is a future improvement, but it cannot fully replace user-side state unless Cascade deliberately accepts weaker privacy guarantees.
