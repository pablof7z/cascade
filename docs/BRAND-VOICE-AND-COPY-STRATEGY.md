# Cascade Markets — Brand Voice & Consumer Copy Strategy

**Status:** Authoritative Guide — V1.0  
**Audience:** Anyone writing UI copy, onboarding text, marketing copy, error messages, or notifications for Cascade  
**Purpose:** Make Cascade feel like a slick consumer app, not a developer prototype

---

## Table of Contents

1. [Who We're Talking To](#1-who-were-talking-to)
2. [Brand Voice & Personality](#2-brand-voice--personality)
3. [Consumer Framing Principles](#3-consumer-framing-principles)
4. [The Forbidden Terms Glossary](#4-the-forbidden-terms-glossary)
5. [Copy Rules: Rewrites In Practice](#5-copy-rules-rewrites-in-practice)
6. [Context-Specific Tone Guide](#6-context-specific-tone-guide)
7. [Worked Examples](#7-worked-examples)

---

## 1. Who We're Talking To

Before any copy can be written, we need to understand exactly who's reading it.

**The Opinionated Generalist.** This is our user.

They:
- Argue about AI, geopolitics, economics, and markets on X/Twitter
- Read Substack newsletters with strong opinions
- Have heard of Polymarket, maybe tried it once
- Think they're right about most things and want to prove it
- Want to put real money behind their convictions
- **Have never heard of Nostr. Don't know what Cashu is. Don't care.**

They are **not** a Bitcoin developer, protocol enthusiast, or crypto-native. They are an informed, opinionated person who lives on the internet and has things to say.

**Write every piece of copy as if you're talking to a sharp, intellectually curious 28-year-old who uses Robinhood, reads The Atlantic, and has 12,000 Twitter followers. They are not stupid. But they are not a developer.**

---

## 2. Brand Voice & Personality

### The Core Personality

**Sharp. Confident. Grounded.**

Cascade is not excitable. It doesn't use startup superlatives ("Amazing!" "Game-changing!"). It doesn't explain itself to death. It knows what it is — and it's comfortable with that.

Cascade sounds like the sharpest person in the room who doesn't need to tell you they're the sharpest person in the room. They say things plainly. They trust you to get it.

### The Four Voice Traits

**1. Direct**  
Say the thing. No hedging. No throat-clearing. No "we're excited to announce."  
→ Not "We'd love to help you explore your first prediction." → "Your first trade is one click away."

**2. Confident Without Being Arrogant**  
We believe in what we've built. We don't apologize for it. But we don't swagger either.  
→ Not "We've revolutionized prediction markets." → "Prediction markets that never close."

**3. Respectful of the User's Intelligence**  
We don't over-explain. We don't add unnecessary reassurance. We trust users to understand.  
→ Not "Don't worry — your money is safe and always accessible to you at any time!" → "Your balance is always yours."

**4. Human, Not Chatty**  
We sound like a person, not a product. But we don't pad sentences with filler or forced warmth.  
→ Not "We're so glad you're here!" → "Welcome to Cascade."  
→ Actually, just drop the welcome entirely and show them something worth trading on.

### Voice ≠ Tone

Voice is consistent. Tone adjusts to context.

- **Onboarding:** Warm, encouraging, clear. Remove friction.
- **Trading surface:** Crisp, data-forward, decisive. Help them act.
- **Wins/payouts:** Celebratory but not over-the-top. Let the money speak.
- **Errors:** Calm, specific, actionable. Never make the user feel stupid.
- **Empty states:** Inviting, directional. Give them a clear next step.

---

## 3. Consumer Framing Principles

This is the core of the translation work. Each concept below maps from how developers think about it to how users should experience it.

---

### 3.1 The User's Money / Balance

**What the developer calls it:** ecash proofs, Cashu tokens, e-cash, token balance, mint balance

**What the user calls it:** their balance, their funds, their money, what they've got to trade with

**How to frame it:**

The user's balance is just that — a balance. Like the number in a PayPal account or a brokerage. They don't need to know it's backed by Cashu tokens stored in their browser. They care that it's there, it's accurate, and they can use it.

| Developer language | Consumer language |
|---|---|
| "Your ecash balance" | "Your balance" |
| "Cashu tokens" | "Funds" or "money" |
| "Proofs in your wallet" | "Your balance" |
| "Browser-local storage" | *(don't mention — invisible)* |
| "Redeemable tokens" | "Withdrawable balance" |
| "Mint balance" | "Balance" |

**Rule:** The word "balance" does 95% of the work. Use it.

---

### 3.2 Making Predictions / Taking Positions

**What the developer calls it:** opening a trade, buying YES/NO tokens, position creation

**What the user calls it:** making a prediction, taking a side, backing an outcome, putting money on something

**How to frame it:**

Users are making a prediction, not executing a trade. The financial framing is secondary. Lead with the intellectual act — forming a view — and the financial stake is how you prove conviction.

| Developer language | Consumer language |
|---|---|
| "Open a trade" | "Make a prediction" or "Back this outcome" |
| "Buy YES tokens" | "Predict YES" or "Back YES" |
| "Buy NO tokens" | "Predict NO" or "Back NO" |
| "Enter a position" | "Take a position" (this one's acceptable) |
| "Token quantity" | "Amount" or "stake" |
| "Trade size" | "Your stake" |

**The exception:** "trade" and "position" are acceptable as secondary vocabulary on the trading surface itself — users who are actively interacting with markets can handle slightly more precision. But never as primary CTA or onboarding language.

---

### 3.3 Winning / Losing / Settlement

**What the developer calls it:** settlement, position resolution, token redemption, payout

**What the user calls it:** winning, being right, cashing out, getting paid

**How to frame it:**

This is the most important moment in the user journey. The moment they're right. Don't bury it in process language.

| Developer language | Consumer language |
|---|---|
| "Settlement" | "Payout" or "result" |
| "Position resolved" | "Prediction settled" or "Market closed" |
| "Redeem tokens" | "Claim winnings" or "Withdraw" |
| "Your position was settled at YES" | "You predicted correctly — collect your payout" |
| "Token redemption complete" | "Payout sent to your balance" |
| "Resolution criteria met" | *(no user-facing translation needed — just tell them the result)* |

**Win state copy:** Be direct and let the money be the celebration.
- ✅ "You were right. +2,450 sats added to your balance."
- ❌ "Congratulations! Your position has been successfully settled! Your tokens have been redeemed!"

**Loss state copy:** Dignified and forward-looking. Not apologetic.
- ✅ "The market went the other way. Your stake has been applied to the settlement pool."
- ❌ "We're sorry — your tokens were not redeemable in this settlement."

---

### 3.4 The Markets Themselves

**What the developer calls it:** markets, thesis markets, prediction fields

**What the user calls it:** questions, ideas, predictions, theses *(only for users who've been using the product a while)*

**How to frame it:**

A market is a question with a price on every answer. Frame it that way.

The key differentiator for Cascade vs. Polymarket is that our markets are **ongoing beliefs about the world** — not binary event bets with expiry dates. Copy should reinforce this.

| Developer language | Consumer language |
|---|---|
| "Create a market" | "Start a prediction" or "Create a market" *(acceptable)* |
| "Thesis market" | "Prediction" or "Market" |
| "Resolution event" | "When the market settles" or "When the outcome is clear" |
| "Market expiry" | *(our markets don't expire — this is a differentiator; lean into it)* |
| "Market liquidity" | *(don't mention unless advanced context)* |
| "LMSR pricing" | *(never mention — invisible infrastructure)* |

**Key message to reinforce in copy wherever natural:**  
"These markets don't close until the answer is clear." This is the differentiator. Use it.

---

### 3.5 Money Denomination

**What the developer calls it:** sats, satoshis, msat (millisatoshi)

**What the user calls it:** depends on context — "money," "[amount]," or "sats" if gradually introduced

**How to frame it:**

Sats need to be introduced gently. Don't assume users know what a sat is. Solve this by:

1. **Always show USD equivalent** alongside sat amounts: "2,450 sats (~$1.50)"
2. **"sats" is acceptable as a vocabulary term** after user has been active — it's short and memorable
3. **Never show "msats" or "millisatoshi" to users** — round everything up to whole sats
4. **Never show raw satoshi math** — show totals, not the underlying arithmetic

| Developer language | Consumer language |
|---|---|
| "msats" / "millisatoshis" | *(never show — round to sats)* |
| "satoshis" | "sats" |
| "12500 sats" with no context | "12,500 sats (~$7.50)" |
| "Denominated in satoshis" | *(don't say this)* |

---

### 3.6 Adding Funds / Deposits

**What the developer calls it:** funding the mint, depositing to mint, Lightning invoice, payment request

**What the user calls it:** adding money, depositing funds, topping up

**How to frame it:**

| Developer language | Consumer language |
|---|---|
| "Fund your mint" | "Add funds" |
| "Generate Lightning invoice" | "Get a deposit address" or "Add funds via Bitcoin" |
| "Pay this invoice" | "Send Bitcoin to this address" or "Scan to deposit" |
| "Invoice expiry" | "This QR code expires in [time]" |
| "Mint pubkey" | *(never show — invisible)* |
| "Receive ecash" | "Funds received" or "Balance updated" |

**Loading / confirming deposits:**
- ✅ "Waiting for your deposit… this usually takes under a minute."
- ❌ "Awaiting Lightning invoice payment confirmation…"

---

### 3.7 Withdrawals / Sending

**What the developer calls it:** send ecash, redeem tokens, Lightning withdrawal, claiming proofs

**What the user calls it:** withdraw, cash out, send

| Developer language | Consumer language |
|---|---|
| "Claim your ecash" | "Withdraw funds" |
| "Send Lightning payment" | "Send money" or "Withdraw" |
| "Redeem proofs" | "Claim" or "Withdraw" |
| "BOLT11 invoice" | "Paste a Bitcoin payment address" or "Paste your withdrawal address" |

---

### 3.8 Authentication / Account

**What the developer calls it:** signing in with extension, nsec/npub, NIP-07 signer, bunker connection, Nostr identity

**What the user calls it:** signing in, their account, their login

**How to frame it:**

Authentication is the biggest potential source of confusion for new users. The Nostr key system is powerful but alien to newcomers. Abstract it entirely.

| Developer language | Consumer language |
|---|---|
| "Sign in with Nostr extension" | "Continue with extension" *(already good — keep it)* |
| "Your nsec" | "Your account key" *(already good in the code — keep it)* |
| "Your npub" | "Your public profile link" or just their handle/name |
| "NIP-07" | *(never mention)* |
| "Bunker connection" | "Remote login" *(or just avoid and explain the benefit)* |
| "Remote signer" | "Sign in from another device" |
| "Private key" | "Account key" *(already good in code)* |
| "Nostr identity" | "Your Cascade account" |

**Account key guidance copy:**  
When we tell users to back up their key:
- ✅ "Save your account key somewhere safe — it's the only way to recover your account."
- ❌ "Store your nsec securely. This private key controls your Nostr identity."

---

### 3.9 Discussion / Argument Activity

**What the developer calls it:** threads, notes, replies, discussion activity

**What the user calls it:** comments, arguments, takes, the discussion

**How to frame it:**

One of Cascade's key differentiators is that **arguments move prices**. The social layer isn't decoration — it's a mechanism. Copy should make this feel real.

| Developer language | Consumer language |
|---|---|
| "Post a note" | "Share your take" or "Post" |
| "Reply to thread" | "Reply" or "Join the debate" |
| "Discussion activity" | "The debate" or "Discussion" |
| "Author a thesis" | "Start the argument" or "Create a market" |

**Surface the social proof:**
- ✅ "17 traders have weighed in on this market."
- ❌ "17 discussion notes on this thesis."

---

### 3.10 The Portfolio Page

**What the developer calls it:** portfolio, positions, open positions, settled positions

**What the user calls it:** their bets, their predictions, what they've got money on

**How to frame it:**

| Developer language | Consumer language |
|---|---|
| "Your portfolio" | "Your predictions" or "Your positions" |
| "Open positions" | "Active predictions" |
| "Settled positions" | "Completed predictions" or "Past predictions" |
| "P&L" | "Your return" or "+/- [amount]" |
| "Net position value" | "Current value" |
| "Position cost basis" | "Your stake" |

---

## 4. The Forbidden Terms Glossary

These words and phrases **must never appear in consumer-facing UI copy.** Not in buttons. Not in labels. Not in tooltips. Not in empty states. Not in error messages. Not in onboarding. Not anywhere a user reads.

Internal code, developer docs, API responses — fine. User-facing surfaces — banned.

### Hard Banned (Zero Tolerance)

| Term | Why | Use Instead |
|---|---|---|
| **ecash** | Protocol jargon, means nothing to users | "balance," "funds" |
| **e-cash** | Same as above | "balance," "funds" |
| **Cashu** | Protocol name, invisible infrastructure | *(omit entirely)* |
| **proofs** | Technical cryptography term | "balance," "funds" |
| **token** / **tokens** (in financial context) | Implies "crypto," triggers skepticism | "balance," "funds," "amount" |
| **mint** (as noun in user context) | Cashu infrastructure term | *(omit or say "server" if you must)* |
| **mint pubkey** | Never under any circumstances | *(omit entirely)* |
| **signet** | Bitcoin test network — users don't need to know | *(omit; if needed: "test mode")* |
| **mainnet** | Bitcoin production network — jargon | *(omit; if needed: "live")* |
| **msats / millisatoshis** | Sub-unit, too small and confusing | Round up to "sats" |
| **browser-local** | Technical storage description | *(omit entirely — invisible)* |
| **browser-local storage** | Same | *(omit)* |
| **LMSR** | Market maker algorithm | *(never mention)* |
| **Nostr** | Protocol name | *(omit everywhere user-facing)* |
| **NIP** (any NIP number) | Protocol spec reference | *(omit)* |
| **relay** / **relays** | Nostr infrastructure | *(omit in consumer surfaces)* |
| **nsec** | Private key format | "account key" |
| **npub** | Public key format | handle, username, or "your public profile" |
| **bunker** | Remote signer type | "remote login" if needed |
| **NIP-07** | Browser extension spec | *(omit)* |
| **pubkey** | Cryptographic public key | *(omit or say "account" / "your profile")* |
| **Lightning invoice** | Bitcoin payment request | "deposit address," "payment link" |
| **BOLT11** | Invoice format | *(omit entirely)* |
| **decentralized** | Means nothing to target user | *(omit — describe the benefit instead)* |
| **censorship-resistant** | Protocol-native positioning | *(omit)* |
| **on-chain** | Bitcoin blockchain term | *(omit in consumer context)* |
| **thesis** / **theses** | Internal product naming | "prediction," "market," "idea" |
| **settlement** | Financial/technical term | "payout," "result," "when the market closes" |
| **redeem** / **redemption** | Cashu/financial jargon | "claim," "withdraw," "cash out" |
| **denominated** | Financial jargon | *(omit — just show amounts)* |

### Soft Banned (Use With Caution)

These aren't forbidden outright but should be used carefully and rarely:

| Term | Guidance |
|---|---|
| **Bitcoin** | Fine in deposit/withdrawal contexts. Don't lead with it in positioning. |
| **sats** | Fine after first use; first mention should be "sats (Bitcoin)" or with USD equivalent |
| **wallet** | Fine for the balance/funds section, but prefer "your balance" in casual contexts |
| **trade** / **trading** | Acceptable on the actual trading surface; avoid in onboarding and marketing |
| **position** | Acceptable on portfolio/market pages; avoid in first-time user contexts |
| **market** | Fine — this is the right word for what Cascade creates |

---

## 5. Copy Rules: Rewrites In Practice

These are the operating principles. Every copywriter on Cascade should be able to recite these.

---

### Rule 1: Lead With What It Does for the User, Not What It Is

Every piece of copy should answer: "What does this mean for me?"

Before you write a label, button, or message, ask: what does the user *achieve* by interacting with this? Say that, not the mechanism.

> ❌ "Generate a Lightning invoice to receive Bitcoin via the Cashu mint"  
> ✅ "Add funds to your balance"

---

### Rule 2: Name What Users Care About, Not What the System Calls It

The system has a name for everything. Users don't care what the system calls it — they care what it *does.*

> ❌ "Redeem your ecash proofs"  
> ✅ "Claim your winnings"

---

### Rule 3: Omit Infrastructure From User Copy

If it explains how something works under the hood, cut it. Users need to know what to do, not why the system does it that way.

> ❌ "Your balance is stored browser-locally using Cashu tokens for privacy-preserving ecash."  
> ✅ "Your balance is stored in your browser. It's private and instant."

The second version still explains the mechanism slightly — but through the user benefit lens (private, instant) rather than the technical one.

---

### Rule 4: Errors Should Be Specific and Action-Forward

A good error message has two parts:
1. What went wrong (in plain language)
2. What to do about it

> ❌ "Proof verification failed. Ecash token redemption unsuccessful."  
> ✅ "We couldn't verify your funds. Try again, or contact support if this keeps happening."

Never make the user feel like they did something wrong unless they actually did. And even then, tell them how to fix it.

---

### Rule 5: The Simpler Sentence Wins

If you can say the same thing in fewer words, do it. Cascade copy is not minimal for the sake of it — it's minimal because users' attention is finite and we respect it.

> ❌ "In order to begin making your first prediction on a market, you'll first need to fund your account with some Bitcoin."  
> ✅ "Add funds to start trading."

---

### Rule 6: Active Voice. Present Tense. Always.

Passive constructions hide the agent and slow comprehension.

> ❌ "Your position will be settled when the market outcome has been determined."  
> ✅ "You'll get paid when the market closes."

---

### Rule 7: Don't Over-Reassure

Excessive reassurance signals that something is scary. If you have to say "don't worry," you've already worried them.

> ❌ "Don't worry — your ecash tokens are completely safe and always accessible, even if you close your browser!"  
> ✅ "Your balance is saved in your browser."

---

### Rule 8: Numbers Need Context

Sats without a USD equivalent are meaningless to 80% of our users. Always give context.

> ❌ "Current value: 18,400 sats"  
> ✅ "Current value: 18,400 sats (~$11.20)"

Once a user has been active for a while, they'll start to feel sats natively. But never assume they do.

---

### Rule 9: Empty States Are Opportunities, Not Gaps

When a user has no predictions, no balance, nothing — that's not a failure state. It's the start of their journey. Give them a clear, inviting next step.

> ❌ "You have no active positions."  
> ✅ "You haven't made any predictions yet. Find a market you have a view on."  
> ✅ *(Even better: surface a live market inline)*

---

### Rule 10: The Right CTA Changes With the Stage

The words on a button matter enormously. Match the verb to what the user is actually doing:

| Action | Preferred CTA | Avoid |
|---|---|---|
| First time funding | "Add funds" | "Deposit," "Fund wallet," "Top up mint" |
| Making a prediction | "Back YES" / "Back NO" | "Buy YES tokens," "Open position" |
| Claiming a win | "Collect payout" | "Redeem," "Claim tokens," "Settle position" |
| Withdrawing | "Withdraw" | "Redeem ecash," "Cash out tokens" |
| Starting onboarding | "Get started" | "Create account," "Register" |
| Saving profile | "Save" or "Open profile" | "Publish event," "Broadcast profile" |

---

## 6. Context-Specific Tone Guide

### Onboarding (First Contact)

The goal: get them to their first prediction as fast as possible.

- **Warm but not syrupy.** They're adults. They chose to sign up. We don't need to hand-hold.
- **Progress over explanation.** Show them what step they're on. Tell them what's next.
- **Remove friction words.** "Just," "simply," "easily" are filler. Cut them.
- **Don't explain Bitcoin here.** If they got to onboarding, they know enough. Defer complexity.

> **Good onboarding tone:**  
> "Tell people who you are. Set the basics for the profile other traders will see."

> **Bad onboarding tone:**  
> "Welcome to Cascade! We're so excited to have you! In order to get started, you'll need to set up your decentralized Nostr identity, which will be used to sign transactions on the network…"

---

### The Trading Surface (Market Page)

The goal: help them make a decision and act.

- **Data forward.** Prices, movement, percentages first. Copy is secondary.
- **Crisp and decisive.** Short sentences. Clear CTAs.
- **Don't editorialize the market.** Don't add commentary on whether an outcome is likely. Show the data.
- **Make the stake explicit.** They should always know how much they're putting on the line before they confirm.

---

### Confirmation States

The goal: confirm they did the right thing, tell them what happens next.

> ✅ "Prediction placed. You backed YES on [market title]. If you're right, you'll collect [payout amount]."  
> ❌ "Transaction successful. Your YES token purchase has been confirmed. Tokens added to your position wallet."

---

### Error States

The goal: help them recover, never make them feel stupid.

**Structure every error as:** [What happened] + [What to do]

> ✅ "We couldn't process your deposit. Check that your payment was sent and try again."  
> ❌ "Error: Lightning invoice payment validation failed. BOLT11 decode error."

---

### Win / Payout Moments

The goal: let the moment land. Be direct. Don't over-celebrate.

> ✅ "You called it. +4,200 sats added to your balance."  
> ✅ "This one went your way. Collect your payout."  
> ❌ "🎉🎉 Congratulations!! Your prediction was CORRECT! Amazing work! Your tokens have been redeemed and your winnings have been deposited! You really showed them! 🚀"

---

### Loss Moments

The goal: dignified acknowledgment, not pity.

> ✅ "The market closed the other way. No payout this time."  
> ❌ "Sorry, your prediction was incorrect and your tokens have been lost in the settlement process."

---

### Empty States

The goal: invitation, not void.

| Surface | Empty State Copy |
|---|---|
| Portfolio (no predictions) | "No predictions yet. Find a market and take a side." |
| Discussion (no replies) | "Be the first to make the case." |
| Activity (no history) | "Your trading history will show up here." |
| Leaderboard (new user) | "Make your first prediction to get on the board." |

---

### Success States (Account Setup, Deposits, etc.)

The goal: confirm, move forward. Don't linger.

> ✅ "You're all set. Your balance has been added — time to trade."  
> ❌ "Success! Your ecash tokens have been successfully minted and added to your browser-local Cashu wallet via the Lightning Network!"

---

## 7. Worked Examples

Full before/after rewrites from actual copy found in the codebase.

---

### Wallet / Balance Screens

**Before:**
> "Your ecash balance is stored browser-locally. You can redeem your proofs at any time."

**After:**
> "Your balance is saved in your browser. Withdraw anytime."

---

### Deposit Flow

**Before:**
> "Generate a Lightning invoice to receive ecash from an external wallet. The invoice will expire after 30 minutes."

**After:**
> "Scan the QR code with any Bitcoin wallet to add funds. This code expires in 30 minutes."

---

### Payout / Win

**Before:**
> "Your position was settled at YES. Redeem your ecash tokens to claim your winnings."

**After:**
> "You called it. Your payout is ready — collect it now."

---

### Error Message

**Before:**
> "Error verifying proof. The Cashu mint returned an invalid token. Please retry."

**After:**
> "Something went wrong on our end. Your funds are safe — try again in a moment."

---

### Market Creation (Builder)

**Before:**
> "Create a new thesis market. Define the resolution criteria and initial liquidity parameters."

**After:**
> "Create a new prediction. Write the question and set the starting odds."

---

### Authentication — Key Backup

**Before:**
> "Your nsec is your Nostr identity. Back it up securely — if you lose it, you lose access to your account."

**After:**
> "Save your account key somewhere safe. It's the only way to recover your account if you lose access."

---

### Settings / Account Page

**Before:**
> "Mint pubkey: [hex string]"  
> "Connected relay: wss://relay.cascade.markets"

**After:**
> *(Mint pubkey: omit entirely)*  
> *(Relay: omit or place in "Advanced" section with label "Server connection")*

---

### Onboarding Profile Step

**Before:**
> "Set up your decentralized identity on the Nostr network to start trading."

**After:**
> "Create your profile. Other traders will see this when you make predictions."

---

*Last updated: June 2025*  
*Owner: Growth (marketing-team)*  
*Apply across: all consumer-facing UI copy, onboarding flows, error messages, marketing pages, and in-app notifications*
