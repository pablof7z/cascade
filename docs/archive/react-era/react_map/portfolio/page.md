---
route: /portfolio
kind: page
component: Portfolio
source: src/Portfolio.tsx
related_routes:
  - /wallet
  - "/market/:slug"
  - "/profile/:npub"
rebuild_notes:
  - Preserve open vs exited position states.
  - This route is the main place to inspect outcomes from trades and withdrawals.
  - Keep withdrawal history and the withdrawal flow attached to the same page.
role: |-
  Personal positions and PnL page. It summarized the current user’s holdings, profit and loss, and withdrawal workflow.
---

## Verbatim Microcopy

- Portfolio
- Track your positions and performance
- Total Invested
- Current Value
- Total P&L
- (
- )
- Positions / Win Rate
- /
- %
- Closed Positions
- Loading withdrawal history…
- Withdrawal
- sats
- Rake
- −
- Net
- Confirm Withdrawal
- Position:
- Direction:
- Shares:
- You will receive:
- Calculating...
- Failed to get quote
- Cancel
- No positions yet
- Place your first trade on any market to see it here.
- Browse Markets
- Shares
- Avg Price
- ¢
- Current
- P&L
- Redeem
- Exited
