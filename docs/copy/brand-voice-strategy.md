# Cascade Markets — Brand Voice & Consumer Copy Strategy

> **Purpose:** This document is the operating manual for anyone writing UI copy for Cascade Markets. Read it before touching a single label. Follow it without exception.

---

## Table of Contents

1. [Brand Voice & Tone Guidelines](#1-brand-voice--tone-guidelines)
2. [Consumer Framing Principles](#2-consumer-framing-principles)
3. [Forbidden Terms Glossary](#3-forbidden-terms-glossary)
4. [Rewrite Principles](#4-rewrite-principles)
5. [Example Rewrites](#5-example-rewrites)
6. [Quick Reference Card](#6-quick-reference-card)

---

## 1. Brand Voice & Tone Guidelines

### Who Cascade Sounds Like

Cascade is **the friend who's smarter than you about markets, but never makes you feel dumb about it.**

Picture a Substack writer with skin in the game. Sharp, opinionated, precise. They use plain words because they're confident — not because they're talking down to you. They wouldn't say "ecash proofs" any more than a Robinhood user would say "fractional share custodianship settlement cycle."

**Reference products:** Robinhood (consumer-first), Polymarket (prediction market confidence), Substack (smart opinion culture)  
**Anti-references:** Bitcoin Core, a white paper, a trading terminal API docs page

---

### Personality

**Confident but never condescending.** Cascade has opinions and uses them. It tells you what things are, not what they might possibly be if you squint. But it never punishes you for not knowing something.

**Sharp but human.** Every sentence earns its place. No filler. No throat-clearing. But there's a dry wit underneath — not corporate, not startup-bro. The app can say "No oracle. No expiration date. Just questions, evidence, and prices that keep moving." That's Cascade's voice.

**Minimal but meaningful.** Less is more. The copy doesn't explain itself. It trusts users to be smart enough to follow.

**Direct without being cold.** "Start trading" beats "Begin your trading journey." "You're in." beats "Your account has been successfully created."

---

### Voice Attributes (The 5 Adjectives)

| Attribute | What It Means | What It Doesn't Mean |
|-----------|---------------|----------------------|
| **Sharp** | Every word is chosen, no fat | Cold, clinical, terse |
| **Confident** | We know what this is and say it plainly | Arrogant, dismissive |
| **Accessible** | Anyone who argues online can understand this | Dumbed down, condescending |
| **Grounded** | Real stakes, real money, real consequences | Hyped, gamified, FOMO-driven |
| **Curious** | We're genuinely interested in the questions markets raise | Academic, philosophical, navel-gazing |

---

### On-Brand vs Off-Brand Language

**Always okay:**
- Plain English financial terms: balance, earnings, position, stake
- Outcome-first framing: "You made $12" not "Settlement resulted in a positive P&L event"
- Second person present tense: "You're up" not "The user's portfolio has appreciated"
- Short, complete sentences
- Numbers without false precision: "$12 earned" not "$12.00347 sats calculated"
- The words: predict, believe, bet (used sparingly), back, stand behind, exit, cash out

**Never okay:**
- Technical protocol terms exposed in UI: see Forbidden Terms Glossary
- Passive voice for user outcomes: "Gains were realized" → "You earned"
- Fake warmth: "Congratulations on your journey!" / "Let's get started!"
- Fear-of-missing-out pressure: "Don't miss out!" / "Act fast!"
- Crypto-native tribal language: "ngmi", "gm", "to the moon", "HODL"
- Unnecessary legalese: "aforementioned", "pursuant to", "in the event that"
- Vague superlatives: "powerful", "revolutionary", "cutting-edge"

---

### Tone Variations by Context

Cascade's voice stays consistent, but the **energy** shifts:

**Onboarding / First impression**
- Tone: Welcoming, confident, brief
- Energy: "You belong here. Here's what to do first."
- Example: "Pick your position. If you're right, you earn. If you're wrong, you lose your stake. Simple."
- ❌ Not: "Welcome to a new era of decentralized prediction markets!"

**Normal usage / Browsing markets**
- Tone: Neutral, informative, efficient
- Energy: Matter-of-fact. Present the fact, get out of the way.
- Example: "53¢ · 14 people backed this"
- ❌ Not: "Current market-implied probability based on automated market maker algorithm: 53%"

**Taking a position**
- Tone: Clear, confident, action-oriented
- Energy: You know what you're doing. Let's go.
- Example: "Back YES · $5 · You're in."
- ❌ Not: "Initiating LONG position minting process..."

**Winning / Position value up**
- Tone: Direct, warm, unsentimental
- Energy: Nice. Here's what it's worth.
- Example: "You're up $8.40. Cash out anytime."
- ❌ Not: "Realized gains detected! Your P&L has moved into positive territory!"

**Losing / Position value down**
- Tone: Straight, non-dramatic, not preachy
- Energy: This happens. Here's where you stand.
- Example: "You're down $3. The market moved."
- ❌ Not: "Your position has experienced negative price movement at this time."

**Error states**
- Tone: Clear, useful, solution-first
- Energy: Here's what happened, here's what to do.
- Example: "Couldn't connect. Check your connection and try again."
- ❌ Not: "An error occurred while processing your request. Error code: MINT_PROOF_VALIDATION_FAILURE"

**Empty states**
- Tone: Brief, inviting, not sad
- Energy: Nothing here yet — that's fixable.
- Example: "No positions yet. Pick a market to back."
- ❌ Not: "No local market proofs found in this browser yet."

---

## 2. Consumer Framing Principles

### The Golden Rule

> **Never name the plumbing. Describe what the user experiences.**

Bitcoin, Nostr, Cashu, LMSR, ecash — these are the pipes. Users don't care how water gets to the tap. They care that it comes out clean and hot. If you catch yourself about to write the word "proof" or "mint" in UI copy, stop and ask: *what is the user actually experiencing?*

---

### The User's Money / Balance

**What users experience:** They have money in their Cascade account. It goes up when they win, down when they lose, and they can add more or take it out.

**Say:**
- "Your balance" — the amount of money available to back positions
- "Available to bet" — same, in action contexts
- "Cash" — casual reference to their liquid balance
- "Add funds" — depositing money into the app
- "Cash out" / "Withdraw" — taking money out
- "$X in your account" — total account value

**Never say:**
- ~~proofs~~ / ~~ecash proofs~~ / ~~local USD proofs~~ → just "balance" or "cash"
- ~~browser-local wallet~~ → just "your account" or "this device"
- ~~tokens~~ → just "funds" or "balance"
- ~~signet balance~~ / ~~mainnet balance~~ → handled invisibly (see Bitcoin section below)

**The rule:** If a bank wouldn't use the word to describe a checking account, don't use it here.

---

### Making Predictions / Taking Positions

**What users experience:** They look at a question, decide if they believe YES or NO, and put money behind their view. If the market moves in their direction, they earn. If not, they lose.

**Say:**
- "Back YES" / "Back NO" — taking a position
- "Take a position" — neutral description of the action
- "Bet on YES" / "Bet on NO" — slightly casual, fine to use
- "Back this" — even more casual, good for CTAs
- "Stand behind" — for editorial contexts ("put money behind your conviction")
- "Exit your position" / "Cash out" — closing a position
- "You're in" — confirmation copy after taking a position

**Never say:**
- ~~mint LONG~~ / ~~mint SHORT~~ → "back YES" / "back NO"
- ~~opening a trade~~ / ~~placing an order~~ → "taking a position"
- ~~going long~~ / ~~going short~~ → "backing YES" / "backing NO"
- ~~withdrawal~~ (when exiting a position) → "cash out" or "exit"
- ~~withdrawing~~ (in trading context) → "selling" or "cashing out"

**LONG / SHORT translation:**  
In UI copy facing users, LONG = YES, SHORT = NO.  
Use LONG and SHORT only where they appear as visual labels on a chart or price table where the convention aids market literacy. Never use them in instructional copy.

---

### Winning / Losing

**What users experience:** They picked a side. The price moved. They made money, or they didn't.

**Say:**
- "You earned $X" / "You're up $X" — positive outcome
- "You're down $X" / "You lost $X" — negative outcome
- "Your position is worth $X" — current marked value
- "Cash out" — the action of locking in gains or cutting losses
- "Exit" — same action, slightly more neutral

**Never say:**
- ~~settlement~~ / ~~settled~~ → "earnings paid out" or just "earned"
- ~~P&L~~ / ~~realized gains~~ / ~~unrealized gains~~ → "$X profit" or "$X up"
- ~~mark-to-market~~ → "current value" or "what it's worth right now"
- ~~withdrawal proceeds~~ → "what you'll receive" or "your payout"

---

### The Markets Themselves

**What users experience:** Markets are questions with prices attached. The price tells you what the crowd thinks the odds are. The higher the price to back YES, the more people think YES is right.

**Consumer framing:** A Cascade market is a **live question with real money riding on it.** Not a "prediction market" (too jargony), not a "contract" (sounds financial/legal), not a "bet" (slightly too casual for primary copy).

**Say:**
- "A question" / "A market" — for individual markets
- "The odds" — what price means to a user
- "The price has moved to X" — market price update
- "People are backing YES / NO" — activity description
- "What the crowd thinks" — aggregate signal

**Never say:**
- ~~prediction market~~ (in user-facing UI copy) — fine in marketing/meta copy, not in the product
- ~~contract~~ — sounds financial/legal
- ~~order book~~ / ~~liquidity pool~~ → "the market"
- ~~LMSR~~ → never, ever. Users never need to know this.

---

### Bitcoin — What Users Need to Know vs. What to Hide

**Users need to know:**
- They're paying with Bitcoin (real money, not credits or points)
- Transactions are fast and fees are tiny
- They can add funds and withdraw funds

**Users don't need to know:**
- That it's technically sats (use dollar values with Bitcoin context where needed)
- Anything about the blockchain, on-chain vs off-chain, L1 vs L2
- Anything about signet vs mainnet
- Anything about the mint, blind signatures, NUT specs, Cashu
- Anything about Lightning vs on-chain

**How to handle:**
- Show values in dollars (or USD cents ¢) — not in sats, not in BTC
- If users ask "is this real money?" → "Yes. Cascade uses Bitcoin under the hood, so there are no middlemen and your funds are settled instantly. You see dollar values."
- Never expose the word "signet" to a user. Signet is a testnet for development. If they're on mainnet, that's the product.

**The one Bitcoin term that's okay:** "Powered by Bitcoin" — in marketing/meta contexts only. Not in product UI.

---

### Fees / Costs

**What users experience:** When they take a position, there's a small cost. It's not a commission, not a spread, not a rake. It's the cost of the market being liquid.

**Say:**
- "A small fee" — generic reference
- "Market fee" — for the fee on a position
- "You'll receive $X after fees" — in confirmation flow
- "Cost: $X" — on the trade summary line

**Never say:**
- ~~LMSR pricing is size-dependent~~ → "Larger positions move the price more. Your payout updates in real time."
- ~~rake~~ — internal revenue term, not user copy
- ~~spread~~ — too financial
- ~~slippage~~ — never. If you need to convey this, say: "Bigger bets move the price — what you see is what you pay."

---

## 3. Forbidden Terms Glossary

| ❌ Never Say | ✅ Say This Instead |
|-------------|-------------------|
| proof / proofs | balance, funds, holdings |
| ecash | (never mention) |
| token(s) | funds, balance |
| mint (as verb — take position) | back YES / back NO / take a position |
| mint (as noun — the system) | (never mention) |
| mint pubkey | (never mention) |
| signet | (never mention — it's a dev testnet) |
| mainnet | (never mention — it's just the product) |
| browser-local | on this device, saved here |
| browser-local wallet | your account, your balance |
| browser-local trade book | your activity, your history |
| settlement / settled | paid out, earned |
| P&L | profit, earnings, how much you're up/down |
| realized gains | what you earned |
| unrealized gains | what it's worth right now |
| withdrawal (exit position) | cash out, exit, sell |
| withdrawal proceeds | your payout, what you'll receive |
| withdrawal quotes | current cash-out value |
| long / going long | back YES, backing YES |
| short / going short | back NO, backing NO |
| trade / trading (as verb) | bet, back, take a position |
| open a trade | take a position |
| trade book | your activity, your history |
| wallet (as technical term) | your account, your balance |
| blind signature | (never mention) |
| NUT- specs | (never mention) |
| LMSR | (never mention) |
| LMSR pricing is size-dependent | Bigger bets move the price — your payout updates live |
| automated market maker | (never mention) |
| on-chain | (never mention) |
| Lightning / Lightning Network | (never mention) |
| sats / satoshis | dollars, cents (show USD values) |
| local proofs | your balance, your funds |
| position mark | current value, what it's worth |
| marked from public market prices | valued at current market odds |
| oracle | (fine to mention in marketing — not in UI) |
| exact exits | cashing out |
| fresh withdrawal quotes | current cash-out value |
| local market-proof holdings | your positions |
| runtimeEditionMismatch (or any dev variable name) | (never expose to users) |

---

## 4. Rewrite Principles

These are the enforceable rules every copy writer must follow. If a piece of copy violates one of these rules, it goes back for a rewrite. No exceptions.

---

**Rule 1: Lead with the user outcome, not the mechanism.**

Users don't care how Cascade works. They care what they can do and what they'll get.

- ❌ "Taking a position means minting LONG or SHORT."
- ✅ "Pick YES or NO and put money behind it."

---

**Rule 2: Every piece of copy must answer "so what?" for the user.**

Before shipping any copy, ask: *what does the user do or feel after reading this?* If the answer is "they learn how our system works," that's not good enough. The answer must be "they take an action" or "they feel more confident."

- ❌ "LMSR pricing is size-dependent." (This tells users about our system. So what?)
- ✅ "Bigger bets move the price. Your payout updates in real time." (This tells users what to expect.)

---

**Rule 3: Use second person, present tense, active voice.**

Always. No exceptions in UI copy.

- ❌ "Portfolio proofs are stored in this browser."
- ✅ "Your balance is saved on this device."

---

**Rule 4: Name the plumbing → kill it.**

If a sentence contains a word from the Forbidden Terms Glossary, rewrite it entirely. Don't substitute the word and leave the sentence structure. The whole sentence needs to come from the user's perspective.

---

**Rule 5: Numbers in user currency, not protocol units.**

All financial figures in the UI must be in dollars and cents (e.g., "$5.40", "41¢"). Never sats, never BTC amounts, never "proofs." If the underlying system uses sats, convert silently.

---

**Rule 6: Empty states invite action. They do not describe absence.**

Empty states should point forward, not describe what isn't there.

- ❌ "No local market proofs found in this browser yet."
- ✅ "No positions yet. Pick a market to back."

---

**Rule 7: Error copy tells users what to do next.**

Error messages that only describe what went wrong are useless. Every error must include what to do next.

- ❌ "Mint proof validation failure."
- ✅ "Couldn't connect to your account. Try refreshing, or add funds to get started."

---

**Rule 8: Cut every word that doesn't serve the user's next action.**

Read every sentence and ask: does every word here help the user understand what to do or decide? If not, cut it.

- ❌ "Current position value is marked from public market prices, and exact exits still come from fresh withdrawal quotes."
- ✅ "Your positions are valued at current market odds. Cash-out prices update in real time."

---

**Rule 9: One sentence, one idea.**

Never chain two concepts with "and" when one concept is enough. If you need to explain two things, use two sentences.

- ❌ "Liquid cash comes from local USD proofs and current position value is marked from public market prices."
- ✅ "Your cash balance is ready to use. Your positions are valued at current market odds."

---

**Rule 10: Labels describe what users have, not what the system stores.**

UI labels should speak from the user's perspective ("Your Balance") not the system's perspective ("Local Proofs").

- ❌ "Local Proofs" (label)
- ✅ "Cash Balance" (label)

---

**Rule 11: Confirmation copy closes the loop, doesn't reopen it.**

After a user takes an action, confirmation copy should close the loop — not introduce new concepts.

- ❌ "LONG position minted. Awaiting mint publication to public trade record."
- ✅ "You're in. Backing YES at 41¢."

---

**Rule 12: Tone is always direct, never dramatic.**

Don't celebrate wins loudly. Don't catastrophize losses. Don't pressure users toward actions. Cascade is grounded. It presents facts and lets users decide.

- ❌ "🎉 Congratulations! You've cashed out successfully!"
- ✅ "Cashed out. $8.40 added to your balance."

---

## 5. Example Rewrites

These are real examples from the current UI codebase. Each shows the current copy, why it fails, and the rewritten version.

---

### Example 1: Portfolio Page Header

**Current copy (PortfolioPage.svelte, lines 798–803):**

```
h1: "Browser-local proof portfolio"

p: "Portfolio proofs are stored in this browser in both signet and mainnet. 
Liquid cash comes from local USD proofs. Current position value is marked 
from public market prices, and exact exits still come from fresh withdrawal 
quotes."
```

**Why it fails:**
- H1 contains "browser-local" and "proof" — technical implementation details
- "Signet and mainnet" are internal infrastructure concepts users shouldn't see
- "Liquid cash comes from local USD proofs" — users don't think about their money as "proofs"
- Three separate concepts chained into one dense paragraph
- Zero user outcome. This describes the system, not what the user can do.

**Rewritten:**

```
h1: "Your Portfolio"

p: "Your cash balance and open positions — all on this device. 
Cash is ready to use. Positions are valued at current market odds."
```

---

### Example 2: Portfolio Stats Labels

**Current copy (PortfolioPage.svelte, lines 818–839):**

```
Card 1:
  label: "Local Proofs"
  description: "{count} proofs stored in this browser."

Card 2:
  label: "Position Mark"
  description: "Derived from local market-proof holdings, the browser-local 
  trade book, and current public market prices."

Card 3:
  label: "Current Value"
  description: "Cash plus current position marks. Exact withdrawal proceeds 
  can differ because LMSR pricing is size-dependent."
```

**Why it fails:**
- "Local Proofs" — a label no consumer would ever recognize as their money
- "Position Mark" — financial jargon that maps to nothing intuitive
- "browser-local trade book" — implementation detail
- "LMSR pricing is size-dependent" — the single worst sentence in the product
- Passive voice throughout
- All three cards describe what the system stores, not what the user has

**Rewritten:**

```
Card 1:
  label: "Cash Balance"
  description: "Available to back positions right now."

Card 2:
  label: "Positions"
  description: "Valued at current market odds. Updates in real time."

Card 3:
  label: "Total"
  description: "Your cash plus what your positions are worth. 
  Bigger bets move the price, so cash-out amounts update live."
```

---

### Example 3: How It Works — Market Mechanics Section

**Current copy (how-it-works/+page.svelte, lines 70–79):**

```
h2: "Mint in. Withdraw out."

p: "Taking a position means minting LONG or SHORT. Exiting means 
withdrawing when the price makes sense for you. There is no close 
button and no trusted party declaring a winner."

ol:
  1. "Create a market and seed the initial liquidity."
  2. "People and agents mint LONG or SHORT."
  3. "The mint publishes the public trade record."
  4. "Holders withdraw when they want to exit."
```

**Why it fails:**
- "Mint in. Withdraw out." — "mint" is a technical verb with no consumer analogue
- "minting LONG or SHORT" — protocol language, not user language
- "The mint publishes the public trade record" — "the mint" is invisible infrastructure
- "Holders withdraw" — "holders" is crypto-native language
- Passive throughout ("seed the initial liquidity," "publishes the public trade record")

**Rewritten:**

```
h2: "Back a side. Exit when you're ready."

p: "Pick YES or NO and put money behind your view. Exit when 
the price makes sense. No oracle, no closing date, no middleman 
decides who's right — the market does."

ol:
  1. "Someone creates a market with a clear question and a case for YES."
  2. "Anyone can back YES or NO with real money."
  3. "The price moves as people take sides."
  4. "Cash out whenever you want — no expiration, no forced close."
```

---

### Example 4: Homepage — "Public commitments" Feature Card

**Current copy (+page.svelte, line 515):**

```
h3: "Public commitments"
p: "Anyone can publish a market. The mint records visible trading 
activity in the public market feed."
```

**Why it fails:**
- "The mint records" — users don't know what the mint is; this is infrastructure detail
- "public market feed" — fine, but the sentence is building toward a feature benefit that never arrives
- "visible trading activity" — corporate phrasing

**Rewritten:**

```
h3: "Everything is visible"
p: "Anyone can publish a market. Every position is public. 
The crowd can't hide — and neither can you."
```

---

### Bonus Example: Empty State

**Current copy (PortfolioPage.svelte, line 812):**

```
p: "Trade markets, track your positions, and keep your proofs in this browser."
```

**Why it fails:**
- "keep your proofs" — technical term in empty state copy (users have nothing here, this isn't the moment to confuse them)
- Three different actions chained with "and" — dilutes focus
- Doesn't invite a specific next action

**Rewritten:**

```
p: "Pick a question, back your view, and watch the market move."
<a href="/">Browse markets →</a>
```

---

## 6. Quick Reference Card

> Print this. Pin it to your monitor. Tattoo it on your wrist.

**Before writing any copy, ask:**
1. Am I describing what the user does or what the system does?
2. Would a Robinhood user understand this without explanation?
3. Does every word here serve the user's next action?
4. Is there any word from the Forbidden Terms Glossary?

**The 5 instant rewrites:**
| If you wrote... | Replace with... |
|----------------|-----------------|
| "mint LONG / mint SHORT" | "back YES / back NO" |
| "proof / proofs" | "balance" or just delete |
| "browser-local" | "on this device" |
| "LMSR pricing is size-dependent" | "bigger bets move the price" |
| "withdrawal" (exit) | "cash out" |

**Tone in 3 words:** Sharp. Direct. Human.

**The one test:** If you'd be embarrassed reading this copy to someone's mom at a dinner party, rewrite it.

---

*Last updated: 2025. Owner: Growth / Marketing. Review alongside any UI copy changes.*
