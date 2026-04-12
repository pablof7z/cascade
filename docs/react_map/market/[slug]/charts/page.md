---
route: "/market/:slug/charts"
kind: page
component: MarketDetail
source: src/MarketDetail.tsx
related_routes:
  - "/market/:slug"
  - "/market/:slug/activity"
rebuild_notes:
  - Keep this route available even if the chart component changes.
  - It exists to expose the pricing history and reserve history from the same market detail shell.
  - This route is also a useful target for future embeddable chart views.
role: |-
  Market detail variant with the charts tab selected. The page is the market-level visual history and charting surface.
---

## Verbatim Microcopy

- Live
- Embed
- Mint:
- ⚠ Does not support Cascade trades
- ⚠ Mint unavailable
- Move since open
- Active risk
- accounts
- Average size
- Discussion
- threads /
- replies
- Yes
- ¢
- No
- Reserve
- Executed volume
- Last trade
- Shares leaning YES
- Price and positioning
- Implied probability
- Committed capital
- Outstanding shares
- Trading considerations
- Market signals
- Connected signals
- Signal markets linked to this thesis.
- Live YES
- Expect
- Largest positioned accounts
- tracked
- cash available
- Long
- Short
- Gross
- Recent fills
- Full activity
- Notional
- Tokens
- Reserve after
- No receipt history yet. Trading activity will populate this log.
- Price curve
- Latest execution
- Trade
- Size
- Start price
- End price
- No fills yet.
- No receipt history yet.
- Events
- No events yet.
- Receipt log
- ·
- tokens
- No receipts yet.
- Positioning
- cash
- This market has been resolved. Trading is closed.
- Trades execute instantly via LMSR pricing.
- Buy YES
- Buy NO
- Size (sats)
- Quick sizes
- Cost
- Average fill
- Demo market. Trades execute immediately against the LMSR reserve.
- Resolve Market
- Resolve this market
- Select the outcome:
- Cancel
- Your Positions
- shares @
- (
- %)
