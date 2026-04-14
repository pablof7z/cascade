# Cascade Markets — Brand Voice, Tone & Consumer Copywriting Strategy

**Version:** 1.0  
**Status:** Authoritative  
**Audience:** Anyone writing UI copy, marketing copy, or error messages for Cascade Markets

---

## Table of Contents

1. [Brand Personality](#1-brand-personality)
2. [Voice & Tone by Context](#2-voice--tone-by-context)
3. [Consumer Framing Principles](#3-consumer-framing-principles)
4. [Forbidden Terms Glossary](#4-forbidden-terms-glossary)
5. [Rewrite Principles](#5-rewrite-principles)
6. [Copy Patterns by Surface](#6-copy-patterns-by-surface)
7. [Before & After Examples](#7-before--after-examples)

---

## 1. Brand Personality

### The Identity: Sharp Conviction, Plain Language

Cascade is where people put real money behind what they actually believe. It sits at the intersection of intellectual seriousness and financial stakes.

The brand personality is:

**Confident, not arrogant.**  
We know what we built and why it's different. We don't oversell it. We don't hedge everything with disclaimers. We say what a thing is and move on.

**Smart, not technical.**  
Our users are intelligent. They read Substack, argue about AI timelines on Twitter, and have views on geopolitics. They don't need jargon. They need clarity.

**Sharp, not cold.**  
There's a crispness to the copy. Short sentences. Specific words. No filler. But the voice has warmth — we're on the user's side.

**Direct, not blunt.**  
We get to the point fast. We don't cushion things with corporate language. But we're not abrasive. We respect the user's time and intelligence.

**Principled, not preachy.**  
Cascade has a point of view — that argued, evidence-backed conviction deserves to move markets. We don't lecture users about it. We embody it in every surface.

### Brand Voice in One Sentence

> *Clear thinking, real stakes, no middleman.*

### The Anti-Persona

Cascade is **NOT**:
- A crypto project. (Never lean into crypto aesthetics or culture.)
- A gambling app. (Never frame positions as "bets" — positions are argued, not gambled.)
- A developer tool. (Never expose infrastructure details to users.)
- A financial services firm. (No compliance-speak, no "please be advised," no legalese in UX.)

---

## 2. Voice & Tone by Context

Voice is consistent. Tone shifts by context. Here's how:

### Onboarding (New User, First Minutes)
**Tone:** Welcoming, orienting, momentum-building  
**Goal:** Get them to the aha moment without friction  
**Rules:**
- One idea per screen
- Tell them what they'll be able to do, not how the plumbing works
- No jargon, no asterisks, no caveats unless legally required
- Use "you" liberally — make it personal

> ✅ "Pick a market. Take a position. Watch the debate move the price."  
> ❌ "Mint LONG or SHORT tokens against the LMSR liquidity pool."

### Trading Actions (Taking a Position, Entering/Exiting)
**Tone:** Crisp, fast, action-forward  
**Goal:** Confirm the action, give the user confidence, keep them moving  
**Rules:**
- Buttons and labels should be verbs or outcomes, not mechanisms
- Confirm the what, not the how
- Stakes language is fine here — real money, real positions

> ✅ "You're going LONG at 62¢ · $5.00"  
> ❌ "Minting 500 LONG tokens against AMM pool at ppm=620000"

### Wins & Positive Outcomes
**Tone:** Celebratory but grounded — not cringe, not casino  
**Goal:** Reinforce the feeling of being right, encourage sharing  
**Rules:**
- Acknowledge the win concisely
- Connect it back to the conviction ("You called it right")
- Avoid hollow exclamation points and emoji explosions
- Real stakes language is fine ("You're up $12.40")

> ✅ "You're up $12.40 on this position. You called it."  
> ❌ "Settlement complete. Net P/L: +1240 msat. Proofs issued."

### Losses & Negative Outcomes
**Tone:** Matter-of-fact, not brutal, not apologetic  
**Goal:** Respect the user, don't rub it in, keep them oriented  
**Rules:**
- State what happened plainly
- No excessive softening
- Give them a clear path forward

> ✅ "This position is down $3.20. You can hold or exit now."  
> ❌ "Your proofs have declined in redemption value relative to issuance cost."

### Errors & System States
**Tone:** Clear, helpful, calm  
**Goal:** User understands what happened and what to do next  
**Rules:**
- Say what the user should do, not what the system did
- Never expose error codes, infrastructure states, or technical causes
- If it's a transient issue, say "try again" — don't explain the architecture
- If action is needed, say specifically what action

> ✅ "We couldn't process your deposit. Try again or contact support."  
> ❌ "Lightning mint quote expired. Proof issuance failed. Signet node unreachable."

### Empty States (No Data Yet)
**Tone:** Inviting, directional  
**Goal:** Move the user toward action  
**Rules:**
- Don't just say "Nothing here" — tell them what could be here and how to get it
- Keep it short and warm

> ✅ "No positions yet. Find a market you have a view on."  
> ❌ "No local proofs found in this browser session."

### Settings & Account
**Tone:** Neutral, efficient  
**Goal:** Label clearly so users can find what they need  
**Rules:**
- Labels describe what the setting does to the user, not the underlying mechanism
- Avoid developer terminology even here

---

## 3. Consumer Framing Principles

### 3.1 Money / Balance

The user has a **balance** or **available funds**. That's it. The money is real and denominated in USD (displayed as dollars and cents). It does not need to be explained further in UI.

| Concept | Consumer Frame | Avoid |
|---|---|---|
| User's balance | "Your balance" / "Available" | "Local proofs" / "Proof balance" / "Ecash" |
| Topping up balance | "Add funds" / "Deposit" | "Mint proofs" / "Fund wallet" / "Issue tokens" |
| Withdrawing | "Withdraw" / "Cash out" | "Redeem proofs" / "Burn tokens" |
| Bitcoin denomination | Display as dollars where possible | "sats" / "msats" / "msat" in UI |
| How money is stored | "Stored securely on your device" | "Browser-local" / "LocalStorage" / "Cashu proofs in browser" |

**On sats/msats:** The product currently runs in a USD context with Lightning as rails. Show dollar amounts. If sats must appear (e.g., Lightning invoice amounts), label it "bitcoin" not "sats" or "msats." But in most cases, translate to dollars before it hits the UI.

### 3.2 Making Predictions / Taking Positions

Users **take a position**. They **go long** or **go short** on a claim. They can also **trade**, **back**, or **challenge** a market.

The product's unique framing is **argued conviction** — you're not flipping a coin, you're taking a stand with evidence behind it.

| Concept | Consumer Frame | Avoid |
|---|---|---|
| Entering a position | "Take a position" / "Go LONG" / "Go SHORT" | "Open a trade" / "Mint tokens" / "Buy LONG" |
| Exiting a position | "Exit" / "Sell your position" / "Withdraw" | "Redeem" / "Burn" / "Settle" |
| The market price | "Current price" / "Market price" / "The crowd thinks..." | "ppm" / "probability price ppm" |
| Price as probability | "62% likely" or "trading at 62¢" | "latestPricePpm / 1,000,000" |
| LONG position | "LONG" (keep the term — it's understood) | "LONG token" / "LONG proof" |
| SHORT position | "SHORT" (keep the term) | "SHORT token" / "SHORT proof" |

**On LONG/SHORT:** These are acceptable consumer terms — Robinhood, Polymarket, and any financial app uses them. Keep them. The jargon is in "minting LONG tokens" not in "going LONG."

**On the AMM/LMSR:** Users never see this. The price is just "the current price." The mechanism is invisible.

### 3.3 Winning & Losing

Markets on Cascade don't have expiration dates. Users don't "win" when a market "settles." They profit when the price moves in their direction and they exit.

| Concept | Consumer Frame | Avoid |
|---|---|---|
| Making money | "You're up" / "Your position gained" | "Settlement returned more proofs" |
| Losing money | "You're down" / "This position is underwater" | "Proof redemption value below issuance" |
| Exiting profitably | "You made $X" / "Position closed at a gain" | "Settled above cost basis" |
| Market price moving your way | "Price moved in your favor" | "LMSR shifted toward your position" |
| A market resolving | Cascade markets don't expire — avoid any "resolution" framing unless building an explicit resolution feature | "Settlement" / "expiry" / "oracle resolution" |

### 3.4 The Markets Themselves

A **market** is a public claim about how the world works. Users take positions on whether they agree.

| Concept | Consumer Frame | Avoid |
|---|---|---|
| The market itself | "Market" or "thesis" | "AMM pool" / "LMSR instance" |
| Market creator | "The author" / "posted by [name]" | "Market creator pubkey" |
| Market discussion | "The debate" / "Discussion" / "Arguments" | "Nostr thread" / "Kind 1 replies" |
| Who can see it | "Public" / "Open to everyone" | "On-chain" / "On-relay" |
| Market activity | "Trades" / "Recent activity" | "Events" / "Kind 7375 events" |

### 3.5 Bitcoin / Technical Infrastructure

The rule: **the user is using dollars.** The Bitcoin infrastructure is the engine room — users don't go in there.

If a user must know something about the underlying infrastructure (they usually don't), translate it:

| Technical Reality | Consumer Frame |
|---|---|
| Lightning Network deposit | "Pay with Lightning" or "Deposit via Bitcoin Lightning" |
| Cashu/ecash proofs | Never mentioned. Money is "stored in your browser" or "in your account." |
| Nostr identity | "Your account" / "Your profile" |
| Nostr pubkey | "Your account ID" (only if it must appear at all) |
| Relay | Never appears in consumer UI |
| Mint URL | Never appears; if health shown, call it "Network connection" or "Service" |
| Signet | "Practice mode" or "Demo mode" |
| Mainnet | "Live mode" or omit entirely |
| NIP-46 / bunker:// | "Mobile app" or "Connect another device" |
| nsec / secret key | "Account key" (currently used — acceptable) or "Sign-in key" |

---

## 4. Forbidden Terms Glossary

These words and phrases must **never appear in consumer-facing UI copy**. No exceptions. Code variable names can use these terms; copy cannot.

### Category: Ecash / Money Infrastructure

| Forbidden Term | Use Instead |
|---|---|
| `proofs` / `ecash proofs` | your balance / funds / stored value |
| `browser-local proofs` | funds stored in your browser |
| `proof balance` | your balance |
| `local proof count` | (don't surface this to users at all) |
| `mint` (as verb for creating money) | deposit / add funds |
| `mint` (as noun for the service) | (invisible — never name it) |
| `minting` | depositing / adding funds |
| `redeem` / `redemption` | withdraw / cash out |
| `burn` (tokens) | exit / sell |
| `cashu` | (never) |
| `ecash` | (never) |
| `token` (financial) | position / share / (often nothing needed) |
| `sats` | bitcoin (if denomination must appear) |
| `msats` / `msat` | cents / (convert to dollars) |
| `lightning invoice` | payment request / deposit link |
| `quote` (mint quote) | deposit / payment |
| `blind signature` | (never) |

### Category: Network Infrastructure

| Forbidden Term | Use Instead |
|---|---|
| `relay` | (never — infrastructure is invisible) |
| `nostr` | (never in UI — it's the plumbing) |
| `nostr connect` | connect another device / mobile login |
| `bunker://` | (never) |
| `NIP-46` / `NIP-XX` | (never) |
| `ndk` / `nostr-dev-kit` | (never) |
| `pubkey` | account ID (if must appear) or omit |
| `npub` | your account / your profile link |
| `nsec` | account key / sign-in key |
| `kind 1` / `kind 7375` / event kinds | (never) |
| `event` (Nostr event) | post / trade / action |

### Category: Market Mechanics

| Forbidden Term | Use Instead |
|---|---|
| `LMSR` | (never — the pricing mechanism is invisible) |
| `AMM` | (never) |
| `liquidity pool` | (never in consumer copy) |
| `ppm` / `price ppm` | price (shown as ¢ or %) |
| `latestPricePpm` | current price |
| `settlement` (market) | (Cascade markets don't settle — avoid) |
| `oracle` | (never in consumer copy) |
| `mint LONG` / `mint SHORT` | go LONG / go SHORT / take a position |
| `proof unit` | (never) |
| `trade receipt` | confirmation / receipt |
| `blind signature bundle` | (never) |

### Category: Environment / Technical Config

| Forbidden Term | Use Instead |
|---|---|
| `signet` | Practice mode / Demo (or omit entirely) |
| `mainnet` | Live (or omit entirely — it's implied) |
| `mint pubkey` | (never) |
| `mint URL` | (never) |
| `browser-local` | stored in your browser (only if must explain) |
| `localStorage` | (never) |
| `API` / `endpoint` | (never in consumer copy) |
| `signing` / `signed event` | (never) |
| `paper edition` | Practice / Demo mode |

### Category: Auth / Identity

| Forbidden Term | Use Instead |
|---|---|
| `bunker` / `bunker URI` | Connect another device / Mobile login |
| `remote signer` | Mobile app / another device |
| `extension login` | Sign in with browser extension |
| `NIP-46 signer` | (never) |
| `read-only session` | (explain what they can't do, not why) |
| `seed phrase` | (use only if truly necessary, with plain explanation) |

---

## 5. Rewrite Principles

These are the rules the copy team follows when revising any UI copy.

### Principle 1: Lead with the User's Outcome, Not the Mechanism

Before writing any copy, ask: *What does the user want to happen?* Write that. Not the technical process that achieves it.

> ❌ "Mint LONG tokens against the LMSR pool"  
> ✅ "Back this thesis — go LONG"

### Principle 2: Name the Thing the User Cares About

Users care about their money, their position, and whether they're right. They don't care about proofs, tokens, relays, or mint URLs.

Replace every technical noun with the human noun it represents:
- proofs → money / balance / funds
- mint → (invisible, or "service" if health must be shown)
- relay → (invisible)
- pubkey → account / profile

### Principle 3: If It Needs Explaining, Rename It

If a label in the UI requires a tooltip to make sense, the label is wrong. Change the label. Tooltips are for optional depth, not for making broken copy work.

> ❌ Label: "Proof Balance" + tooltip: "The amount of ecash proofs stored in your browser"  
> ✅ Label: "Your Balance"

### Principle 4: One Idea Per Message

Error messages, onboarding prompts, empty states — each should communicate exactly one idea. If you find yourself using "and" in a status message, you have two messages.

> ❌ "Signet funding is capped at $100 per request and $250 per 24-hour window."  
> ✅ Two separate error states: one for per-request limit, one for daily limit.

### Principle 5: Say What to Do, Not What Went Wrong

When something fails, the user needs to know what action to take. The technical cause is almost never relevant to them.

> ❌ "Lightning mint quote expired. Node returned error 503."  
> ✅ "Your deposit window expired. Start a new deposit."

### Principle 6: Use the Present Tense and Active Voice

Financial apps often lapse into passive voice to sound safe and formal. Fight it. Active voice is clearer and faster.

> ❌ "Your position has been settled and proofs have been issued."  
> ✅ "Your position closed. You made $4.20."

### Principle 7: Show Dollar Amounts, Not Protocol Units

All money in the UI should be displayed in dollars (or the display currency). Do the conversion before it hits the UI. Users transact in their mental model of money, not in protocol units.

> ❌ "1,240 msats added to your proof wallet"  
> ✅ "+$0.01 added to your balance" (or batch to meaningful amounts)

### Principle 8: Trust the User to Understand "LONG" and "SHORT"

These are common terms in financial media. Don't replace them with "believe it will go up" or "agree with the thesis" in trading interfaces — that's patronizing and unclear. Do use plain language to *introduce* the concepts the first time.

> ✅ Onboarding: "Going LONG means you think the market will rise. Going SHORT means you think it won't."  
> ✅ Trading panel: "LONG · $5.00 · current price 62¢"

### Principle 9: Empty States Are Invitations, Not Notices

An empty portfolio is not "No local proofs found." It's an opportunity to tell the user what they could have and how to get it.

> ❌ "No local proofs found in this browser."  
> ✅ "No positions yet. Find a market you have a view on."

### Principle 10: Cascade Markets Never Expire — Don't Imply They Do

Cascade is differentiated by its open-ended, always-on markets. Never use language that implies expiry, settlement, or a final outcome. Users exit when they want to, at the price the market is at.

> ❌ "When this market settles, you'll receive your payout."  
> ✅ "Exit when the price is right for you."

---

## 6. Copy Patterns by Surface

### The Wallet / Portfolio

| UI Element | Current (Broken) | Should Be |
|---|---|---|
| Page title | "Browser-local proof portfolio" | "Your Portfolio" |
| Balance label | "Local Proofs" | "Your Balance" |
| Sub-label | "3 proofs stored in this browser." | (remove entirely or: "Stored in this browser") |
| Description | "Trade markets, track your positions, and keep your proofs in this browser." | "Trade markets and track your positions." |
| Signet badge | "Signet" | "Practice" |
| Mainnet badge | "Mainnet" | (omit — it's the default, implied) |
| Deposit CTA | (varies) | "Add Funds" |
| Withdraw CTA | (varies) | "Withdraw" |
| Mint health: connected | "Mint connected" | "Connected" |
| Mint health: offline | "Mint offline" | "Service unavailable" |
| Mint health: degraded | "Mint degraded" | "Service disrupted" |
| Mint health: checking | "Checking mint..." | "Connecting..." |
| Error: single limit | "Signet funding is capped at $100 per funding request." | "You've reached the per-deposit limit of $100." |
| Error: window limit | "Signet funding is capped at $250 per 24 hours." | "You've reached the daily limit of $250. Try again tomorrow." |
| Status after deposit | "Recovered Lightning funding added $X of browser-local proofs." | "Deposit confirmed. $X added to your balance." |

### Auth / Login

| UI Element | Current | Should Be |
|---|---|---|
| Extension login description | "Use a browser extension you already trust." | ✅ Keep as-is — this is clean |
| Remote login description | "Pair with another app. Show a QR code to approve this session, or paste a connection link." | ✅ Keep as-is — the copy here is solid |
| Remote: "Connection link" field label | "Connection link" | ✅ Keep (acceptable abstraction) |
| Private key label | "Account key" | ✅ Keep — acceptable |
| Login tab label that exposes "bunker" | Any label exposing "bunker://" | "Connect device" or "Mobile app" |
| Read-only session prompt | (any mention of read-only as a technical state) | Describe what they can't do: "You can browse markets but can't trade yet." |

### Market Card / Feed

| UI Element | Current | Should Be |
|---|---|---|
| Discussion count | "3 discussions" | ✅ Keep — clean |
| Trade count label | "Trades" | ✅ Keep |
| Volume label | "Volume" | ✅ Keep |
| Price label | "Price" | ✅ Keep |
| "Open market" CTA | "Open market" | ✅ Keep |
| Author attribution | "by [name]" | ✅ Keep |
| "No market summary yet." | "No market summary yet." | ✅ Keep |

### How It Works Page

| Section | Current Copy Issue | Fix |
|---|---|---|
| Mechanics step: taking a position | "People and agents mint LONG or SHORT." | "People and agents go LONG or SHORT." |
| Mechanics step: the record | "The mint publishes the public trade record." | "Every trade is recorded publicly." |
| Curve labels | "Deep SHORT" / "Split market" / "Deep LONG" | ✅ Keep — these are good |

### Onboarding

| Surface | Principle |
|---|---|
| First screen | One line on what Cascade is. One CTA. No technical detail. |
| Wallet setup | Call it "your balance" — never "proof wallet" |
| Any mention of Lightning | "Pay with Bitcoin Lightning" — never "mint quote" or "invoice" |
| Identity/account step | "Your account is created" — never "keypair generated" or "nsec stored" |

---

## 7. Before & After Examples

These demonstrate the principles applied to real copy found in the codebase.

---

**Page Title**  
❌ `Browser-local proof portfolio`  
✅ `Your Portfolio`

---

**Wallet description**  
❌ `Portfolio proofs are stored in this browser in both signet and mainnet. Liquid cash comes from local USD proofs. Current position value is marked from public market prices, and exact withdrawal value will vary by exit timing.`  
✅ `Your balance and positions are stored in this browser. Prices update in real time — exit whenever the market moves in your favor.`

---

**Balance widget**  
❌ `Local Proofs · 3 proofs stored in this browser.`  
✅ `Your Balance`

---

**Empty state**  
❌ `No local proofs found in this browser.`  
✅ `No positions yet. Find a market you have a view on.`

---

**Deposit status message**  
❌ `Recovered Lightning funding added $5.00 of browser-local proofs.`  
✅ `Deposit confirmed. $5.00 added to your balance.`

---

**Stripe in-progress message**  
❌ `Stripe funding settled for $20.00. Claiming browser-local proofs for card funding is not enabled yet.`  
✅ `Card deposit received. Funds will appear in your balance shortly.`

---

**Market mechanics step**  
❌ `Taking a position means minting LONG or SHORT. Exiting means withdrawing when the price makes sense for you. There is no close button and no trusted party declaring a winner.`  
✅ `Taking a position means going LONG or SHORT. You exit when the price works for you. No expiry dates. No middleman calling the outcome.`

---

**Mint health status**  
❌ `Mint connected` / `Mint offline` / `Mint degraded` / `Checking mint...`  
✅ `Connected` / `Service unavailable` / `Service disrupted` / `Connecting...`

---

**Error: signet daily limit**  
❌ `Signet funding is capped at $250 per 24 hours.`  
✅ `You've reached the $250 daily limit for practice mode. Try again tomorrow.`

---

**Login form with "bunker" exposed**  
❌ Tab label: `bunker` / Input placeholder: `Paste a bunker:// link`  
✅ Tab label: `Connect a device` · Input placeholder: `Paste your connection link`

---

## Appendix: Approved Vocabulary

These terms are **safe to use** in consumer copy:

| Term | Notes |
|---|---|
| Position | What the user has in a market |
| LONG / SHORT | Standard trading terms — acceptable |
| Market | The prediction / thesis |
| Price | The current probability price (shown as ¢ or %) |
| Balance | The user's available funds |
| Funds | Generic for the user's money |
| Deposit | Adding money to their balance |
| Withdraw | Taking money out |
| Trade | The act of taking or changing a position |
| Discussion | The debate attached to a market |
| Portfolio | All of the user's positions |
| Exit | Closing / selling a position |
| Gain / Loss | Position performance |
| Bitcoin Lightning | The deposit/withdrawal rail (named only when needed) |
| Practice mode | Signet — test environment |
| Live mode | Mainnet — production (or just implied, omit the label) |
| Account | The user's identity |
| Sign in | Login |
| Your account key | nsec / private key (when it must be named) |
| Connect a device | Mobile/remote signer pairing |

---

*Document owner: Growth / Marketing team*  
*Apply to all consumer-facing copy: UI, onboarding, errors, marketing pages, emails*
