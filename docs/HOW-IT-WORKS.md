# How Cascade Works

Read this first. It is the shortest accurate explanation of the product.

## The Core Model

Cascade is a prediction market product for interconnected beliefs.

- A **module** is an atomic yes-or-no market.
- A **thesis** is a broader market that can link modules as supporting context.
- Linked modules are informational only. They do not mathematically set another market's price.

Every market has its own LMSR curve. Each market trades independently.

## Funding, Trading, And Exiting

There is no order book and no counterparty matching. Users trade against the mint's LMSR engine.

Funding:

- The user adds funds in USD through Stripe or Lightning.
- The wallet mint issues USD-denominated ecash.

Taking a position:

- The user spends USD ecash on a market.
- The market mint issues LONG or SHORT market proofs.
- Price moves with trading activity on that market.

Exiting:

- The user returns LONG or SHORT proofs to the mint.
- The mint returns USD ecash at the current LMSR price.

That is the whole loop: fund, mint a position, exit when the price makes sense.

## Markets Are Perpetual

Markets do not expire.

- No countdown timer
- No end date
- No admin close button
- No oracle
- No outcome declaration service

Price drifts because people trade. Users exit when they want to. If the world makes one side obviously stronger, trading pressure pushes the price toward the edge.

## Nostr Event Kinds

| Kind | Purpose | Published by |
|------|---------|--------------|
| `982` | Market definition | User |
| `983` | Trade record | Mint |

Kind `982` defines the market. It is immutable once published.

Kind `983` is the public trade log. It is mint-authored, not user-authored. When a trade request is authenticated with NIP-98, the mint may include the request signer in an optional `p` tag.

## Mint Shape

Cascade uses a custom CDK Rust Cashu mint layer.

- The **wallet mint** issues USD ecash.
- The **market mint** issues market proofs priced by LMSR.
- Each market has two keysets: one LONG keyset and one SHORT keyset.
- Lightning is hidden plumbing between mints, not the normal product UX.

## Product Language

Use these terms:

- `fund portfolio`
- `mint LONG` / `mint SHORT`
- `withdraw`
- `exit a position`
- `withdrawal proceeds`
- `LMSR price`

Do not talk about market closure, winner payout, or a resolution step. Cascade is about continuous pricing and voluntary exits.
