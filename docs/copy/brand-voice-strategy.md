# Cascade Brand Voice

Use this document for UI copy, onboarding copy, empty states, notifications, and headline-level marketing copy.

## Voice

Cascade should sound:

- sharp
- confident
- grounded
- concise
- respectful of the user's intelligence

Think opinionated financial writing, not crypto marketing and not enterprise software copy.

## Core Rules

- Lead with what the user experiences, not the plumbing underneath.
- Use short, direct sentences.
- Prefer plain financial language over protocol language.
- Keep the tone calm. No hype, no fake warmth, no casino energy.
- When the user makes money or loses money, say it plainly.

## Product Framing

Use these frames:

- `balance`
- `add funds`
- `withdraw`
- `take a position`
- `back YES` / `back NO`
- `LONG` / `SHORT` where market literacy helps
- `current price`
- `current value`
- `exit`
- `you’re up` / `you’re down`

Hide or avoid these implementation terms in user-facing copy:

- Nostr
- relay
- pubkey
- nsec
- Cashu
- proofs
- LMSR
- msats
- blind signatures

## Market Language

Markets are live questions with prices, not contracts and not admin-run closeout flows.

Say:

- `This market keeps trading`
- `Exit when the price works for you`
- `The market moved`
- `What the crowd thinks`

Do not say:

- `resolution`
- `market closes`
- `winning payout`
- `settlement`
- `expiry`
- `resolves on`

## Money Language

Normal product UX should speak in USD.

Say:

- `balance`
- `available`
- `add funds`
- `withdraw`
- `you’ll receive`

Do not say:

- `proofs`
- `wallet rail`
- `ecash`
- `sats`
- `msats`

If Bitcoin or Lightning must appear, keep it secondary and practical.

## Tone By Surface

Onboarding:

- Warm, brief, and orienting
- Example: `Pick a market. Take a position. Watch the price move.`

Trading:

- Crisp and action-forward
- Example: `Back YES · $10`

Portfolio:

- Clear and matter-of-fact
- Example: `Available balance`, `Current value`, `Exit position`

Errors:

- Calm and actionable
- Example: `Couldn’t complete that request. Try again.`

Empty states:

- Directional, not apologetic
- Example: `No positions yet. Find a market you have a view on.`

## Rewrite Checklist

Before shipping copy, check:

- Does it describe the user experience instead of the infrastructure?
- Does it avoid banned market language?
- Does it sound like a smart product, not a protocol document?
- Would a non-Bitcoin user understand it immediately?

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
