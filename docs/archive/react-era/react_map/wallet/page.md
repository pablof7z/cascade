---
route: /wallet
kind: page
component: WalletPage
source: src/WalletPage.tsx
related_routes:
  - /portfolio
  - "/market/:slug"
rebuild_notes:
  - Keep deposit and withdrawal flows visible in one route.
  - This page is the only place where the user should manage wallet actions directly.
role: |-
  Cashu wallet and treasury UI. It handled deposits, withdrawals, balance display, and transaction history in a single place.
---

## Verbatim Microcopy

- Your Wallet
