# Modules vs Theses

Cascade has two market shapes.

## Module

A module is an atomic yes-or-no market.

Characteristics:

- one clear claim
- one independent LMSR curve
- price determined only by trading on that market

Examples:

- `Will BTC trade above $150k before July 2026?`
- `Will the Fed cut rates in May 2026?`

## Thesis

A thesis is a broader scenario market.

Characteristics:

- can link one or more modules as supporting context
- still has its own independent LMSR curve
- price determined only by trading on that thesis

Examples:

- `If BTC breaks out, ETH outperforms through the cycle`
- `AI infrastructure capex keeps expanding through 2027`

## The Important Rule

Modules are informational links only.

A thesis can cite modules to explain its reasoning, but:

- a thesis price is not computed from module prices
- module prices do not move because a thesis linked them
- there is no formula that combines markets into one derived probability

That rule is absolute. If a future implementation tries to mathematically couple linked markets, it is wrong.

## Composition

Anyone can create a thesis using any public module as context. That is permissionless composition, not shared state.
