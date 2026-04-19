# 50 — Voice & Copy

The product's voice for UI copy. Extends [`docs/copy/brand-voice-strategy.md`](../copy/brand-voice-strategy.md), which is the canonical brand-voice reference — read that first.

This document picks up where the brand-voice doc leaves off: it covers *UI-specific* vocabulary, placeholder copy, empty states, and action labels.

---

## The one-paragraph summary

Cascade sounds **sharp, confident, grounded.** We use short, direct sentences. We don't explain the mechanism; we describe what the user does. We don't celebrate wins or soften losses — we state them. We avoid emoji in chrome, avoid exclamation points in actions, and avoid marketing language everywhere.

---

## Vocabulary

### Use these

| Term | Where |
|---|---|
| **Claim** | Every reference to a market. *"Publish a claim"*, *"This claim"*, *"48 claims authored"*. |
| **Case** | The author's argument. *"Read the case"*, *"Case revision"*, *"The case body"*. |
| **Reply** | Responses in the Discussion. *"Post reply"*, *"24 replies"*. |
| **Note** | Short-form Home feed posts. *"What's on your mind?"* compose. |
| **Subscribe** | Follow a writer for long-form. *"+ Subscribe"*, *"14 subscriptions"*. |
| **Follow** | Follow a writer for notes/trades on Home. |
| **Back YES / Back NO** | Take a position. *"Back YES · $25"*. |
| **Cash out** | Close a position. *"Cash out anytime"*. |
| **Holds YES / NO** | Position badge. *"holds YES · $120"*. |
| **Observer** | Person with no position in the market. *"· observer"* inline tag. |
| **Restack** | Amplify with commentary. *"Restacked @north"*. |
| **Writer / author** | The person who published the claim. *"Writers to subscribe"*. |
| **Publication** | A writer's collection of claims. *"Corporate timing, weekly-ish"* (in italic). |
| **Dispatch** (optional) | A publication event — a new claim or case revision. Used sparingly. |
| **Crowd price** | What the market is pricing today. *"The crowd is at 71¢."* |
| **Spread** | Distance between YES and NO prices. *"21¢ spread."* |
| **Drift** | Percentage of a writer's claims that have moved toward their seed side. *"65% drift."* |

### Avoid these

| Term | Use instead |
|---|---|
| ~~Bet~~ | Back YES / Back NO / Take a position |
| ~~Trade~~ (as a verb) | Back, take a position |
| ~~Gamble~~ | Never |
| ~~Resolution~~ | Markets never resolve — don't mention the concept |
| ~~Outcome~~ | Don't use |
| ~~Win / Lose~~ | "You're up / down" |
| ~~Profit / Loss~~ | "Gain / P&L" (in technical contexts); "up / down" in UI |
| ~~Long / Short~~ | Back YES / Back NO (use literacy-oriented terms sparingly) |
| ~~Mint / Mint a position~~ | Back YES / Back NO — hide "mint" vocabulary |
| ~~Wallet~~ (as technical term) | Your account, your balance |
| ~~Proofs~~ | Balance, funds, holdings — hide entirely |
| ~~Nostr, npub, relay, nsec~~ | Never in UI chrome |
| ~~LMSR~~ | Never |
| ~~Signet / mainnet~~ | "Practice edition / Live edition" |
| ~~Sats, satoshis, msats~~ | Dollars and cents |

See [`docs/copy/brand-voice-strategy.md`](../copy/brand-voice-strategy.md) for the full forbidden-terms list.

---

## Specific UI copy

### Compose placeholders

| Surface | Placeholder |
|---|---|
| Home compose | *"What's on your mind?"* |
| Home compose (claim mode, rare) | *"Propose a claim. The crowd will price it."* |
| Discussion compose (market page) | *"Add your view. A question, an observation, a counter — whatever moves the thread."* |

### Action labels

| Button | Copy |
|---|---|
| Rail CTA | *"＋ Publish a claim"* |
| Subscribe to a writer | *"+ Subscribe"* |
| Unsubscribe | *"Subscribed ✓"* (click to unsub — confirm before action) |
| Follow user | *"+ Follow"* |
| Back YES (trade module) | *"Back YES · $25"* (amount inline) |
| Cash out | *"Cash out · $X at 71¢"* |
| Post reply | *"Post reply"* — never *"Reply & back YES"* |
| Post note | *"Post"* |
| Save (bookmark) | *"Save"* — not *"Bookmark"* as a verb |
| Saved state | *"Saved"* |
| Share | *"Share"* |
| Restack | *"Restack"* |

### Empty states

Always invite an action. Don't describe absence.

| Surface | Empty copy |
|---|---|
| Home (new user, no follows) | *"You're not following anyone yet. Subscribe to a writer to see their dispatches here, or head to Markets to see what's live."* |
| Subscriptions (no subs yet) | *"You're not subscribed to any writers yet. Writers publish claims, revise their cases, and build a public record — subscribe to one to start reading."* |
| Subscriptions (all read) | *"Caught up. Next dispatch will show up here."* |
| Markets (filtered empty) | *"No live claims in Geopolitics yet. Want to start one?"* (highlight rail CTA) |
| Discussion (no replies) | *"No replies yet. Be the first to weigh in."* |
| Portfolio (no positions) | *"No positions yet. Pick a claim you have a view on — the trade panel is on the right of every market page."* |

### Trade module footer

*"Cash out anytime · no expiry · no oracle"*

This one line anchors Cascade's three differentiators. Present on every trade module, every time.

### Trade confirmation

After a successful trade, the trade module updates in place. No toast. No modal. The amount field clears, the *Your position* sub-block updates, and the trade appears in the Recent Trades tape.

If there's an error, a single muted line below the button: *"Couldn't complete that. Try again."*

### Fine print

| Context | Copy |
|---|---|
| Reply compose | *"Replies are public and permanent. Want to take a position? Use the trade panel →"* |
| Trade module | *"Cash out anytime · no expiry · no oracle"* |
| Publish a claim form | *"The claim is immutable once published. Your opening stake can be cashed out anytime, but the headline, lede, and case are on the record forever."* |
| Case revision | *"Revision history is public. Every edit is a new event."* |

---

## Tone by surface

### Onboarding

*Warm, brief, orienting.*

- *"Cascade is a prediction market where claims are sentences and prices are what the crowd believes today."*
- *"Pick a claim you have a view on. Take a position. Watch the price move."*

### Trading

*Crisp, action-forward.*

- *"Back YES · $25"*
- *"Cashed out. $78.20 added to your balance."*

### Portfolio

*Clear, matter-of-fact.*

- *"Cash balance"* · *"Current value"* · *"Your positions"*
- *"You're up $47.30 today across 12 positions."*

### Errors

*Calm, actionable.*

- *"Couldn't complete that request. Try again."*
- *"Connection dropped — reconnecting…"* (if the Nostr subscription drops)

### Confirmations

*Close the loop. Don't reopen.*

- *"Posted."* (reply sent)
- *"Saved."* (bookmarked)
- *"Subscribed to @north."* (subscribed)

Never: *"🎉 Great choice!"* Never: *"Thanks for subscribing!"* Cascade doesn't thank people for using it.

---

## Numerals & formatting

- Prices: `71¢` (cent sign, no decimal). Never `$0.71`.
- Dollar amounts: `$25` (no decimal for whole dollars), `$74,120` (thousand separator), `$74K` (for compressed displays).
- Deltas: `+3¢`, `−4¢` (Unicode minus `−`, not hyphen).
- Percentages: `65%` (no space).
- Times: `2s`, `41s`, `14m`, `2h`, `Wed`, `8 Apr` — never `2 seconds ago`.
- Dates: `14 Mar 2026` or `Saturday, 18 April` for group labels.

All numerals in JetBrains Mono with `tnum` so columns align.

---

## Emojis

**Not in chrome.** Never.

**In user-authored content** (notes, replies): allowed. It's the user's voice, not Cascade's.

**In system context lines:** an emoji-free zone. The glyphs we use are unicode symbols: `·` (middle dot), `→` (arrow), `◉` (filled circle for verified), `⋯` (horizontal ellipsis), `×` (multiplication sign for close).

---

## Punctuation

- **Middle dot `·`** as the separator in meta lines and bylines. Not hyphen, not bullet.
- **En-dash `–`** for ranges: *"70–72¢"*.
- **Em-dash `—`** for asides in prose.
- **Typographic quotes** `" "` in prose. Straight quotes in code only.
- **Ellipsis `…`** (single character) in loading states and placeholders.

## Related

- [`docs/copy/brand-voice-strategy.md`](../copy/brand-voice-strategy.md) — full brand voice doc
- [51 — Anti-patterns](./51-anti-patterns.md)
