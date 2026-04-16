# Market Lifecycle

## Creation

Every market starts the same way:

1. The creator writes the market and signs the selected edition market event.
2. The market event is published to relays.
3. The creator seeds the market with an initial trade.
4. The mint lazy-initializes the LMSR pool on that first trade.
5. The mint publishes the first selected edition trade record.
6. The market becomes publicly discoverable.

Live uses market/trade kinds `982`/`983`. Practice uses market/trade kinds `980`/`981`.

The seed trade is required. There is no zero-liquidity launch.

## Visibility

A raw market event is not enough for normal public discovery.

Anonymous public reads stay `404` until relays have both the market event and the first
mint-authored trade event for the selected edition. Creator pending visibility remains in creator-aware flows rather than
anonymous public reads.

The public visibility threshold is the first mint-authored trade event. That proves the market is funded and live.

## Trading

Once live:

- users spend USD ecash to mint LONG or SHORT exposure
- users can exit by returning market proofs to the mint
- price updates continuously with every trade
- all public trade activity is represented by the selected edition trade event

There is no order book and no counterparty matching.

## Perpetual Markets

Markets do not expire.

- no end date
- no countdown timer
- no forced close step
- no oracle-driven finish

The market keeps trading until participants stop caring or exit at the prices available.

## Exits

Users exit by returning market proofs for USD ecash at the current LMSR price.

- near the strong edge, proceeds can be close to full value
- near the weak edge, proceeds can be very small

Nothing forces exit. The user decides when to leave.

## Solvency

The LMSR reserve is designed to remain solvent by construction. The mint can always quote a buy or exit price for a given size based on the current state of that market.
