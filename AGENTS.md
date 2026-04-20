# Cascade Agent Rules

## Core Mechanics

- Fund portfolio: user buys USD ecash through the wallet mint.
- Mint a position: user spends USD and receives LONG or SHORT market proofs.
- Withdraw: user returns market proofs and receives USD ecash at the current LMSR price.
- Markets never close. No expiry, no countdown, no admin close button.
- No oracle. No resolution step. Do not use that language.
- Price is determined only by trading activity on that market.
- Normal product language is USD, not sats.

## Event Kinds

- `982` = market creation, authored by the user
- `983` = trade record, authored by the mint

## Forbidden Language

- Never say `resolution`, `resolved`, `market closes`, or `winner payout`.
- Say `withdraw`, `exit`, `withdrawn`, and `withdrawal proceeds`.

## Docs-First Rule

- Clean docs, specs, and plans are a top priority.
- If a planned code change will make a canonical doc inaccurate, update that doc first and add a visible `PENDING:` note describing the incoming change.
- Save the doc before making the code change.
- When the work is finished, remove the `PENDING:` note and leave the doc accurate.
- If no doc exists, update the nearest canonical doc or create one before the code drifts.

## Read Before Deciding

- [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md)
- [`docs/design/product-decisions.md`](docs/design/product-decisions.md)
- [`docs/design/style-guide.md`](docs/design/style-guide.md)
- [`docs/product/spec.md`](docs/product/spec.md)
- [`docs/README.md`](docs/README.md)

## Repository Layout

- `web/` is the only active frontend. Deployed on Vercel — no manual deploy step needed.
- `mint/` is the Rust mint workspace.
- Nested `AGENTS.md` files refine the rules for their subtree.
