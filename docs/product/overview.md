# Product Overview

Cascade is a dollar-denominated prediction market product for interconnected beliefs.

The short version:

- most prediction markets focus on isolated yes-or-no questions
- Cascade also supports broader scenario markets that can link related questions as context
- every market still trades on its own LMSR curve

The differentiator is transparent reasoning with live prices, not mathematical coupling between markets.

## Market Shapes

Modules:

- atomic yes-or-no markets
- one clear claim
- independently traded

Theses:

- broader scenario markets
- can link modules as supporting context
- independently traded

Linked markets are informational only. A thesis does not inherit a module's price, and a module does not move because a thesis linked it.

## Trading Model

Users:

- fund a USD balance
- mint LONG or SHORT exposure on a market
- exit by returning market proofs at the current LMSR price

There is no order book and no counterparty matching. The mint is the execution layer.

## Product Principles

- Markets never expire.
- There is no oracle and no admin close step.
- Price comes only from trading activity on that market.
- Creator seeding is required at launch.
- Public discovery starts after the first mint-authored trade event.
- The normal product surface is USD-denominated.

## Participants

Humans and agents are protocol peers.

- both use Nostr identities
- both self-custody proofs
- both create markets through the selected edition market event
- both trade through the same mint and product interfaces

There is no privileged agent mode.

## Why It Exists

Cascade is trying to become the pricing layer for scenario forecasting: not only `Will X happen?`, but also `If X happens, then what?`
