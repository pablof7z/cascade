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

Portfolio valuation uses two different numbers on purpose:

- **mark price** for the normal portfolio list
- **exact exit value** when the user asks what a withdrawal would return right now

Cash value is straightforward: sum the locally held USD proofs.

Position mark value comes from local holdings plus current public market pricing:

- the browser groups local market proofs by market and side
- it reads the latest public YES/NO price for each market from the canonical market feed/detail surface
- it computes a mark value in USD minor units for each locally held side

Exact exit value comes from the mint:

- the browser calls the sell-quote endpoint with the specific quantity it wants to withdraw
- the mint returns the size-aware LMSR proceeds for that finite trade

This distinction matters because LMSR is not a flat-price book. A full withdrawal can move price, so `quantity * current marginal price` is only a portfolio mark, not an executable guarantee.

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
There is also no canonical pubkey-keyed `/api/product/portfolio/:pubkey` or `/api/product/wallet/:pubkey` route for current holdings.

For launch, that means:

- spendable cash comes from locally stored USD proofs
- open-position quantities come from locally stored market proofs
- Lightning-funded USD proofs arrive through the standard Cashu mint flow and are then stored locally in the browser
- trade-issued market proofs and change proofs are created from blind signatures returned by the product trade routes and unblinded locally in the browser
- current portfolio value comes from public market prices
- launch cost basis comes from a browser-local executed-trade position book maintained by the active browser
- exact withdrawal previews come from sell quotes
- token import/export is a browser-local proof-management action, not a server wallet API
- the first import/export implementation can operate on one proof bucket at a time: one mint, one unit, one encoded Cashu token string
- if public market pricing is unavailable, the holding still appears from local proof state and local trade metadata, but with price unavailable / mark-only display rather than backend-derived valuation

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
- a browser-local position book derived from executed buys, seeds, and withdrawals in that browser
- NIP-78 position records used for public profile and cross-device hints

The launch browser-local position book is intentionally narrow:

- it tracks quantity and cost basis for trades executed in this browser
- it is enough to show local cost basis and unrealized PnL for normal launch usage
- imported proofs or proofs acquired on another device may not have local cost basis
- those holdings should still appear in `/portfolio`, but with mark-only valuation rather than fabricated PnL
- it should also retain enough local market metadata to render a readable holding row even if public market detail fetches fail temporarily

The backend must not keep a proof-by-proof mirror of this state. It can expose trade and settlement records, but the bearer proofs themselves remain local to the browser.
The backend must also not keep a canonical per-pubkey portfolio ledger for spendable cash or current open positions.

## Future: Deriving Positions From Kind 983

The current kind `30078` approach has a limitation: it is user-maintained. If a user trades on multiple devices, or uses an agent on their behalf, it can become stale.

A more robust future approach is to partially derive positions from kind `983` trade events published by the mint.

The challenge is unchanged: Cashu is a bearer system. Kind `983` may include an optional `p` tag when the trade request used NIP-98, but that tag only identifies the request signer for that specific trade. It does not identify the long-term bearer owner across future swaps, and it may be absent entirely for anonymous trades.

That means linking kind `983` events back to user positions still requires at least one of:

1. the trade included optional NIP-98 attribution and the user wants to be publicly attributable for that execution
2. the user maintains their own position record
3. the user or wallet reconstructs holdings from local proof state

Kind `30078` is still the current user-facing position record. Kind `983`-based derivation is a future improvement, but it cannot fully replace user-side state unless Cascade deliberately accepts weaker privacy guarantees.
