# How Cascade Works

> Read this before anything else. These are the fundamentals. Everything else follows from here.

---

## The two primitives

**Modules** are atomic yes/no predictions. "Will BTC exceed $150k before July 2026?" One question, binary outcome, its own market.

**Theses** are belief networks — a collection of modules that together express a broader view. "US enters recession in 2026" might reference three separate modules as supporting evidence. Each module still trades independently. The thesis is a statement of reasoning, not a mathematical aggregation.

---

## How trading works

There is no order book. There is no counterparty. Trading is against the **LMSR** (Logarithmic Market Scoring Rule) — an automated market maker built into the mint.

**To fund your wallet:**
- You buy USD ecash through Cascade's Stripe gateway or a Lightning funding flow
- The wallet mint issues you dollar-denominated Cashu ecash

**To take a position:**
- You spend dollars from that wallet on a market, choosing LONG or SHORT
- The market mint issues you Cashu ecash tokens representing your position
- Price is determined by the LMSR curve — early buyers pay less, later buyers pay more as the side fills up
- Lightning is used behind the scenes between the wallet mint and the market mint, but that rail is hidden from the normal product UX

**To exit a position:**
- You **sell** — return your tokens to the mint
- The system returns dollar-denominated ecash to your wallet at the current LMSR price

That's the entire trading loop. Mint in, sell out.

---

## Markets never close

There is no expiry date. No countdown timer. No admin close button. No oracle. No DAO vote.

Markets are **perpetual**. They live as long as people hold positions. If a real-world event happens and one side is clearly correct, arbitrageurs push the price toward 1.0 (or 0.0). Holders of the winning side sell at near-full value. Holders of the losing side sell at near-zero - or hold forever, which is their choice.

Nothing forces closure. Reality reveals itself through price.

Markets never close. There is no resolution event and no admin-triggered ending. As prices move and the market cap falls away naturally, users sell when the price makes sense for them.

---

## Nostr event kinds

| Kind | What it is | Who publishes it |
|------|-----------|-----------------|
| **982** | Market creation — defines the market, immutable once published | The user who creates the market |
| **983** | Trade record — every mint or sell | The mint only (never the user) |

Kind 983 is published by the **mint**, not the user. Cashu bearer tokens do not let the mint infer a stable proof owner from the trade alone. When a trade request is authenticated with NIP-98, the mint may also attach an optional `p` tag for the request signer.

---

## The mint layer

Cascade runs custom Cashu mint infrastructure (built with CDK in Rust). It is not a standard Cashu mint — it understands LMSR pricing and it separates wallet funding from market execution.

- The **wallet mint** issues USD ecash
- Every market gets **two keysets** on the **market mint**: one for LONG tokens, one for SHORT tokens
- The market mint holds the LMSR reserve in Lightning settlement units — always solvent by math, not by trust
- Lightning is the hidden settlement rail between the wallet mint and the market mint
- The market mint publishes kind 983 to Nostr after every trade

---

## What doesn't exist

- ❌ No resolution event
- ❌ No oracle
- ❌ No market expiry
- ❌ No "winning side" declared by anyone
- ❌ No order book
- ❌ No counterparty matching

---

## Terminology

| Say this | Not this |
|----------|----------|
| fund wallet | top up Lightning / buy rail balance |
| buy position / mint | deposit directly into the market rail |
| sell | settle / resolution |
| sale proceeds | payout / winnings |
| exit a position | cash out / settle |
| LMSR price | market price (fine, but be specific) |

Never use "resolution." Never say a market "closes." Never say there are "winners and losers" in the traditional sense - only people who sold at a good price and people who didn't.
