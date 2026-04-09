# Idea: Private Trading Groups ("Prediction Leagues")

**Status:** Evaluated by marketing team — worth building, sequencing matters  
**Date:** 2026-04-09  
**ICE Score:** 7/10 (marketing team)

## The Concept

Allow users to create private groups and invite friends to participate together. The emphasis is on intimacy and exclusivity — it should *feel* like a private space, not a public forum.

## Core UX Vision

- A user creates a group and invites a close circle of friends
- The group has its own space (private feed? shared portfolio view? group chat around markets?)
- Feels exclusive — like a group chat, not a public leaderboard
- Members can trade the same markets and see each other's positions/performance

## Growth Angle

- Social/viral mechanism: people invite their smartest friends
- Word-of-mouth driver — "come trade with us"
- Creates stickiness: you don't leave if your friends are there
- Natural onboarding: join because a friend invited you, stay because the group is active

## Marketing Team Assessment

**tl;dr: Good idea, but sequence it correctly or it'll be a distraction.**

### The underlying mechanics are real

- **Viral coefficient > 0.** Invite loops convert 3-5x better than paid channels (Robinhood waitlist, Discord, etc.)
- **Retention is the real win.** Social obligation is stickier than any notification strategy. Users don't leave because their group is active.
- **Discussion-moves-price is a natural fit.** A thesis market in a private group is a running debate backed by real money. Polymarket doesn't have this.

### Private vs. public: right call for now

Private groups → **retention**. Public leaderboards/challenges → **virality**. At sub-1K users, retention is more valuable. Build private groups now, add public tournament features later.

### Naming recommendation

Don't call it "private groups" — that's a UI description. Call it **"Prediction Leagues"** — activates the fantasy sports mental model instantly.

### Hook

> "Create a market with your smartest friends. See who's actually right."

### Comparable examples

**Worked:**
- Fantasy sports leagues — private league mechanic is 30 years old, still the #1 retention driver in the category
- Wordle in WhatsApp groups — micro-competition within friend groups drove viral spread
- Discord servers for Polymarket — users *already* self-organized into private servers; build it in-product
- Robinhood referrals — invite as a gift (free stock), not a request to try software

**Didn't work:**
- Social betting apps (Bettor.io, Prophet.me, 2015-2019) — built social on top of a broken core loop; it doesn't fix a weak experience

### Recommended build sequence

1. **First:** Fix solo onboarding to sub-5-minute time-to-first-trade
2. **Then:** Build Prediction Leagues with social obligation mechanics (draft threshold, shared P&L, group discussions)
3. **Then:** Seed one high-profile group publicly to prove the model
4. **Later:** Add public leaderboards and challenges for virality

### Risks

1. **Building before solo experience is good enough.** Groups amplify existing quality; they don't create it. If a warm invite leads to a confusing onboarding, that's a non-renewable resource wasted.
2. **Empty groups kill retention.** Need a minimum launch threshold (5+ active traders) — don't go live until N members accept. The group dies without critical mass.
3. **Misreading "private" as the feature.** The feature is *shared conviction among people you know*. Must include: group leaderboard, argument threads that move prices, group P&L — not just access control.
4. **Cold start problem for group creators.** Make the creator experience feel like *hosting*, not *recruiting*. Pre-load context: "Here's the market we're all betting on. Pick a side."

## Open Questions

- What does the group actually share? Positions? A curated market list? A leaderboard?
- Is it Nostr-native (NIP-51 kind list? custom kind?) or app-layer only?
- Does the group creator set the markets, or do members bring their own?
- Public vs. private — can groups be discoverable later?
- How does it interact with theses? Could a group collaborate on a shared thesis?
