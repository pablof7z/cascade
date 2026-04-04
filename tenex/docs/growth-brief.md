# Cascade Growth Brief
**April 4, 2026 | contrarian.markets / cascade.f7z.io**

> This is an operator's brief, not a strategy deck. It is designed to be executed, not admired.

---

## Context: Where We Are Right Now

**Current state as of April 4, 2026:**
- Live at cascade.f7z.io with paper trading mode
- ~$24K vol on featured thesis, ~$18K on AGI market
- 3+ seeded markets (AGI by 2030, Mars landing, China GDP, trending)
- Working Nostr discussion threads (kind 1111)
- Leaderboard + activity pages live
- Cashu Phase 2 in progress (real sats coming in May)
- No real money yet

**The hard truth:** We have a compelling demo. The platform looks alive. Now we need real users, real money, and a loop that compounds without Pablo doing everything manually.

**Revenue deadline: May 31, 2026.** That's 57 days. This brief tells you exactly how to hit it.

---

## North Star Metric

**Weekly Active Traders (WAT)** — users who place at least one trade in a given week.

Not signups. Not page views. Not total volume. Trading is the core action. If a user signed up but never traded, they didn't activate.

**Supporting funnel (track weekly):**
1. **Landing** — unique visitors to cascade.f7z.io
2. **Signup** — accounts created (Nostr login)
3. **Activated** — placed first trade (even paper)
4. **Retained** — traded in Week 2, 3, 4
5. **Evangelical** — referred another user OR created a market

**Benchmarks to hit before scaling acquisition:**
- Activation rate: 40%+ of signups place first trade
- Week 4 retention: 30%+ of Week 1 traders still active
- If below these: fix product, not marketing

---

## 1. Competitive Positioning

### The Landscape

| Platform | Model | Real Money | Compositionality | Oracle | US Access |
|----------|-------|-----------|-----------------|--------|-----------|
| Polymarket | Event markets | ✅ | ❌ | Oracle-dependent | ❌ Blocked |
| Kalshi | Regulated events | ✅ | ❌ | CFTC-regulated | ✅ (limited) |
| Metaculus | Reputation-based | ❌ | ❌ | Community | ✅ |
| Manifold | Play money | ❌ | ❌ | Creator | ✅ |
| **Cascade** | **Thesis networks** | **✅ (May)** | **✅** | **Discussion-driven** | **✅** |

### The Core Differentiation

Every competitor asks: **"Will X happen?"** They frame the future as isolated binary events. Market opens. Market closes. You were right or wrong.

Cascade asks: **"If X happens, then what?"** The world is a network of conditional beliefs. Cascade prices that network.

This is not a feature. This is a fundamentally different epistemological stance. And it creates a defensible moat because:
1. Compositional markets are **harder to replicate** (technical architecture, UI paradigm)
2. As thesis networks grow, data becomes **uniquely valuable** (a knowledge graph of interconnected beliefs)
3. Discussion that moves price means **information flows into markets**, not just speculation

### Battle Cards (Use These in Content)

**vs Polymarket:**
> "Polymarket bets on outcomes. Cascade bets on worldviews. Polymarket's AGI market closes when AGI is declared. Our AGI thesis links to: job displacement, regulatory response, China competition, power grid demand. The downstream bets are where the real alpha is."

**vs Metaculus:**
> "Metaculus has the world's best forecasters. They just don't have skin in the game. Put $50 behind your Metaculus forecast and let's see how confident you actually are."

**vs Kalshi:**
> "Kalshi needs CFTC approval before it can create a market. We can create one in 60 seconds on any belief that matters. No gatekeepers. No geography restrictions."

**vs Manifold:**
> "Fake money produces fake signal. Real stakes sharpen real thinking."

### Where We Win

1. **US users blocked from Polymarket** → Cascade captures them
2. **Thesis-based betting doesn't exist elsewhere** → No direct competitors
3. **Discussion as market signal** → Unique mechanism for information aggregation
4. **Agent-native platform** → First-mover in autonomous AI trading

### Positioning Statement (for internal use, not ad copy)

*Cascade is the world's only compositional prediction market — where you build interconnected belief networks, put real money behind them, and where the best argument can move the price.*

**Tag line options (test these):**
- "Prices for beliefs." (current — strong, run with it)
- "The prediction market for everything that happens next."
- "Every idea has a price. What's yours worth?"

---

## 2. Target User Segments

### Segment 1: The Opinionated Generalist (Primary, First 500 users)

**Who they are:**
- Argues about geopolitics, AI, economics on Twitter/X
- Reads SSC, ACX, Stratechery, Noahpinion, Axios
- Has heard of Polymarket; may have tried it once
- Has strong takes, wants to prove them right
- Professional — can afford to put $50–$500 in play
- Never heard of Nostr; shouldn't need to

**Where they live:**
- X/Twitter under #Polymarket, #forecasting, epistemic threads
- Substack comment sections (ACX, Noahpinion)
- r/slatestarcodex, r/geopolitics, r/MachineLearning
- Hacker News (Show HN, Ask HN)

**What moves them:**
- Social proof from people like them
- Specific, hot takes ("The market gives X only 12% — they're wrong")
- Direct outreach from the founder

**Acquisition cost:** Very low if done right (direct outreach, community seeding). Very high if done wrong (paid ads, generic content).

---

### Segment 2: The Metaculus Power Forecaster (Secondary, Weeks 4–12)

**Who they are:**
- Active on Metaculus, Manifold, GJP alumni
- Calibrated forecaster — thinks carefully about probability
- Wants to be measured, wants a track record
- Frustrated that Metaculus has no real stakes

**Where they live:**
- Metaculus community forums
- r/Slatestarcodex
- Good Judgment Project alumni networks
- Discord servers (Forecasting space)

**What moves them:**
- Calibration features (track record, Brier scores)
- The "put real money where your model is" framing
- Tournaments and leaderboards

**Note:** This segment requires product work (track record + calibration features). Don't spend acquisition budget here until those exist.

---

### Segment 3: The Nostr Native (Supporting, Not Primary)

**Who they are:**
- Already on Nostr. Has a npub. Understands zaps.
- Early adopter energy. Follows protocol development.
- Smaller market, but will become evangelists.

**Why they matter:**
- Lower friction to signup (Nostr login is native)
- Will give genuine product feedback
- Can amplify on Nostr without us paying for distribution

**Where they live:**
- nostr.com, Damus, Primal, Amethyst
- Primal trending, Nostr.build, npub.pro

**Critical rule:** Don't make them Segment 1. Build the product for the Opinionated Generalist first. The Nostr Native will find us anyway.

---

### Segment 4: AI Agents (Unique, Long-Term Moat)

**Who they are:**
- Not people. Autonomous AI systems. TENEX agents, custom bots, research tools.
- They have access to information fast, process probability well, can trade 24/7

**Why this matters:**
- First platform to natively support agent trading creates unique liquidity
- "Can you beat the AI?" narrative drives human engagement
- Agents bring their human operators to watch

**How to unlock:**
- Publish SKILL.md at cascade.f7z.io/SKILL.md
- Clean API with machine-readable documentation
- Agent leaderboard visible to humans

**Note:** This is a long-term moat. Don't let it distract from getting real human users first. But SKILL.md should ship alongside paper trading, not after.

---

### Segment Prioritization

**Now (April):** Segment 1 only. Direct outreach + X/Twitter seeding.
**May:** Segment 3 (Nostr community) and Segment 4 (SKILL.md launch).
**June+:** Segment 2 when calibration features are live.

---

## 3. User Acquisition Channels

### Channel Prioritization (ICE Scored)

| Channel | Impact | Confidence | Ease | ICE Score | When |
|---------|--------|-----------|------|-----------|------|
| Pablo's X/Twitter | 9 | 9 | 8 | 8.7 | NOW |
| Direct outreach (DM) | 8 | 9 | 7 | 8.0 | NOW |
| Nostr posts | 7 | 8 | 9 | 8.0 | NOW |
| Product Hunt | 8 | 7 | 6 | 7.0 | First real-money launch |
| r/slatestarcodex | 7 | 7 | 6 | 6.7 | Month 2 |
| Hacker News (Show HN) | 8 | 6 | 5 | 6.3 | First real-money launch |
| SKILL.md agent channel | 9 | 6 | 5 | 6.7 | May (with API) |
| Podcast appearances | 6 | 6 | 4 | 5.3 | Month 3+ |
| Newsletter sponsorships | 7 | 5 | 4 | 5.3 | Month 3+ |
| Paid ads | 4 | 3 | 5 | 4.0 | NEVER (pre-PMF) |

### Channel 1: Pablo's X/Twitter — The Primary Engine

This is the highest-leverage channel and requires the most discipline.

**Not this:** Random posts about the product.
**This:** A consistent, daily publishing cadence that makes Pablo THE person who thinks about conditional predictions on X.

**Framework for every post:**
1. Identify a trending news item or debate
2. Reframe it as a cascade of conditional beliefs
3. Share the probability from the Cascade market (even if seeded by you)
4. Ask followers to disagree

**Example tweet formats:**

*Market card format:*
```
The market thinks AGI arrives before 2030 at 34%.
I think it's wrong. Here's why 60% is closer to right:
[3-point argument]
→ Trade your view: [link]
```

*Contrarian take format:*
```
Everyone is talking about [X].
Nobody is talking about what happens if [X].
If [X], then [Y] (72%), [Z] (45%), [W] (28%)
This is how Cascade thinks. [link]
```

*Ceiling moment format:*
```
Polymarket closed the [X] market. 
The question is still live. The debate isn't over.
We don't close markets. [link]
```

**Cadence:** 1 post per day minimum. Threads 2-3x per week. Market card every time a major news event happens.

**Response rate:** Engage within 1 hour on any reply. This builds the community.

---

### Channel 2: Direct Outreach (The First 50 Users)

The first 50 users will not come from content. They will come from Pablo DMing people.

**Target list (build this over 2 days):**

Find 50 people on X/Twitter who:
- Have tweeted about Polymarket in the last 30 days
- Have tweeted about prediction markets, forecasting, or calibration
- Are Metaculus users (their bio often says so)
- Argue about geopolitics, AI, or economics with confidence

**DM template:**
```
Hey [name] — I saw your thread on [topic]. 

I'm building Cascade — it's a prediction market where markets never close, 
discussion can move prices, and you can bet on belief networks, not just 
binary outcomes. 

You'd be in the first 50 people who see it. 
Would you be willing to spend 10 minutes trading on paper and give me feedback?

cascade.f7z.io
```

**What to do with them:**
- Watch them use the product (screen share / Loom recordings)
- Document where they got confused
- Document the aha moment
- Ask: "What would you need to see before putting real money in?"
- Ask: "Who else should I talk to?"

**Goal:** 10 users who say they'd be "very disappointed" if Cascade went away. These are your early evangelists.

---

### Channel 3: Nostr Distribution

Don't post "check out my app." Post genuine content that markets would naturally appear in.

**Tactic 1:** Post scenario breakdowns as kind:1 notes with market links.
**Tactic 2:** Engage in existing discussions about AI, crypto, geopolitics, and naturally reference relevant Cascade markets.
**Tactic 3:** Create NIP-19 shareable links for each market. Every market should have a clean nostr:// link that works in any client.

**Communities to seed:**
- Primal trending topics (when AI or geopolitics is hot)
- npub.pro community lists
- Long-form Nostr notes with thesis breakdowns (kind:30023)

---

### Channel 4: Product Hunt (First Real-Money Launch)

Don't launch on Product Hunt with paper trading. Launch with real money.

**Timing:** May 31 (first revenue milestone) is the natural Product Hunt date.

**Pre-launch:**
- Collect 50+ "notify me" supporters before launch day
- Prepare a 5-minute demo video showing a complete trade cycle
- Prepare 5 seeded markets covering hot topics of that week
- Line up 10 early users to post reviews day-of

**Launch hook:** "The first prediction market where discussion moves prices. Real money. No expiry dates. No binary bets."

**Target:** #1 Product of the Day. This is achievable with preparation.

---

### Channel 5: Hacker News

One "Show HN" post, timed with real-money launch.

**Format:**
```
Show HN: Cascade – prediction markets where discussion moves prices
https://cascade.f7z.io

We built the first compositional prediction market. Instead of binary "Will X happen?" bets, you build thesis networks — linked conditional predictions where the downstream markets price the full consequences of a belief.

Two things that don't exist anywhere else:
1. Markets never expire (a belief about AI progress shouldn't close when a deadline passes)
2. Strong arguments in the discussion thread can move prices (we use a modified LMSR)

Real money via Lightning/Cashu. Nostr login. No KYC.

Looking for: smart people with strong opinions who are tired of Polymarket's event-by-event framing.
```

This will get 50–200 visitors on a good day. Quality over quantity — HN users are exactly the Segment 1 target.

---

## 4. Activation Optimization

### The Activation Problem

Most users will arrive at cascade.f7z.io, look at the markets, and leave without trading. This is normal. The job is to minimize that gap.

**The Aha Moment:** When a user places their first trade and sees the probability shift in real-time. That's when Cascade becomes real.

Everything between landing and that moment is friction to eliminate.

---

### Current Activation Funnel (Hypothesized)

```
Land on homepage
    ↓ (drop ~60%: doesn't understand what it is)
Click on a market
    ↓ (drop ~40%: can't figure out how to trade)
Creates account / logs in
    ↓ (drop ~30%: Nostr login friction)
Places first trade
    ↓ (drop ~50%: doesn't understand the mechanic)
Sees result / engages with discussion
```

**Biggest drops to fix (priority order):**
1. **Homepage → Click on market:** Needs a hero that immediately communicates "you can trade on this"
2. **Login → First trade:** Nostr login must be seamless; frictionless guest mode for paper trading
3. **First trade:** The UI must make the trade outcome visceral (real-time probability shift, visual feedback)

---

### Activation Experiments to Run

**Experiment 1: Guest paper trading**
*Hypothesis:* If users can trade without signup, activation rate will increase by 30% because the login step is the biggest drop.
*Test:* Allow paper trading with a temporary session. Show them their positions. After 1 trade, prompt: "Create account to save your positions."
*Duration:* 2 weeks
*Success:* Session-to-trade rate increases 30%+

**Experiment 2: Seeded first trade**
*Hypothesis:* If we pre-populate a "your first trade" flow on a trending market, time-to-first-trade drops from 4+ minutes to <90 seconds.
*Test:* Onboarding flow that starts with the most active market, explains the mechanic in 2 sentences, and offers a 1-click paper trade.
*Duration:* 2 weeks
*Success:* Time-to-first-trade <2 minutes for 50%+ of new users

**Experiment 3: Discussion as entry point**
*Hypothesis:* Users who land on a discussion thread before seeing the market convert better because they're already engaged in the argument.
*Test:* Create shareable links that land on the Discussion tab of a market, not the Overview.
*Duration:* 2 weeks
*Success:* Discussion-landing users convert to first trade at higher rate than Overview-landing users

---

### Activation Targets

- **Current baseline:** Unknown (instrument first)
- **Month 1 target:** 25% of signups place first trade
- **Month 2 target:** 40% of signups place first trade
- **Month 3 target:** 40%+ (hold; focus on retention)

---

## 5. Content Marketing Strategy

### What Content Does for Cascade

Content in this stage has one job: **bring the right people to the platform and give them a reason to trade.**

Content that doesn't do one of these is not worth creating:
1. Acquisition — drives new visitors to cascade.f7z.io
2. Activation — gets signups to place first trade
3. Retention — brings traders back when they haven't visited in a week

### The Content Thesis

**Cascade is the world's only place where scenario thinking is priced.**

Our content should make that true by demonstrating the value of compositional thinking on current events. Every piece should show — not tell — why "if X then what?" is a better question than "will X happen?"

---

### Content Pillars (5 pillars, strict rotation)

**Pillar 1: Market Commentary (Acquisition)**
*"Here's what the market says — and whether it's right."*

Format: Short-form tweet or thread. Show a Cascade market probability, then argue for or against it. End with a link.

Frequency: Daily. This is the engine.

Example: "Cascade gives AGI by 2030 a 34% chance. I think this is too low. The frontier isn't compute-limited anymore. Here's the full cascade..."

---

**Pillar 2: Scenario Construction (Activation)**
*"This news event has more downstream consequences than you think."*

Format: Thread on X, long-form Nostr note, or Substack essay. Walk through a real event's cascading effects. Show how each consequence is a tradeable belief.

Frequency: 2-3x per week. This is the product demo disguised as content.

Example: "China's GDP just printed below expectations. Here's the cascade of consequences — and which ones the market is pricing wrong."

---

**Pillar 3: Contrarian Takes (Engagement)**
*"Everyone is wrong about X. Here's the evidence."*

Format: Punchy tweet or thread. Take a strong, defensible position that contradicts mainstream consensus. This generates replies, which feeds engagement.

Frequency: 1x per week.

Example: "Metaculus has more accurate forecasters than Polymarket. But Polymarket has more honest forecasters. Here's why skin in the game changes the math."

---

**Pillar 4: Building in Public (Trust)**
*"Here's what we're building and why."*

Format: Behind-the-scenes. Share metrics, decisions, mistakes. This builds audience investment in Cascade's success.

Frequency: 1x per week. 

What to share: Weekly active traders (even when small), decisions made and why, experiments running.

What NOT to share: Technology stack, Nostr plumbing, protocol details.

---

**Pillar 5: Social Proof (Retention + Referral)**
*"This trader called it 6 months early."*

Format: Case studies, testimonials, market outcomes. Show real examples of Cascade markets being right when consensus was wrong.

Frequency: 1x per month (quality over quantity).

Note: This requires having outcomes to point to. Build this content library starting now by documenting interesting market movements.

---

### Platform Strategy

**X/Twitter: Primary**
This is where the Opinionated Generalist lives. Pablo's account is the distribution channel. Every Cascade market should produce at least one tweet.

**Nostr: Parallel**
Cross-post X content. But also engage natively — respond to Nostr discussions, share markets in relevant threads. Don't just broadcast.

**Substack: Depth**
One essay per week. The deepest version of the Scenario Construction content. This builds the email list, which is the owned audience that survives algorithm changes. Goal: 500 subscribers before real-money launch.

**Reddit: Targeted Seeding**
r/slatestarcodex, r/geopolitics, r/MachineLearning, r/Futurism. Don't post product links. Post genuine value — analysis, scenario breakdowns — and include Cascade naturally. No self-promo ever; let the content do the work.

**Medium/Blog: SEO (Later)**
Evergreen content targeting searches like "polymarket alternative", "prediction market for AI", "how prediction markets work". This is Month 3+ work. Low urgency now.

---

### Content Calendar (Current Phase)

| Day | Format | Platform | Pillar |
|-----|--------|----------|--------|
| Monday | Thread (scenario breakdown) | X | Activation |
| Tuesday | Hot take | X + Nostr | Engagement |
| Wednesday | Substack essay | Substack → X | Activation/Trust |
| Thursday | Market commentary | X + Nostr | Acquisition |
| Friday | Market card (visual) | X | Acquisition |
| Saturday | "Week in markets" roundup | X | Retention |
| Sunday | Prep next week | — | — |

---

## 6. Nostr-Native Growth

### Why This Matters (and Why It's Easy to Screw Up)

Nostr gives Cascade something rare: a built-in distribution network of users who understand decentralized systems and will test new products. But there are two failure modes:

1. **Over-indexing on Nostr:** Building for Nostr users, talking about Nostr, making Nostr the product. This kills mainstream appeal.
2. **Under-indexing on Nostr:** Ignoring the existing community, missing organic growth, failing to leverage existing infrastructure.

The right path: **Nostr is infrastructure, not positioning.** Use the distribution without making it the product.

---

### Nostr Growth Vectors

**Vector 1: NIP-07 Login as Activation Hack**

For users who already have a Nostr key (Nostr users), login is zero-friction. This is the Nostr community's superpower — they're already past the biggest activation barrier.

Action: Make NIP-07 login the first and most prominent option. Add "Download Alby" inline if extension not detected.

**Vector 2: Social Proof via Kind:1 Notes**

Every market trade or position can generate a shareable kind:1 note: "I just bet 45% on AGI by 2030 on Cascade. Here's why: [link]"

This is organic social proof on Nostr with zero effort from the user. The market URL should always be embedded.

Action: Build "Share your position" functionality that creates a pre-populated Nostr note with market link.

**Vector 3: Discussion as Native Content**

Cascade discussions are kind:1111 (thread replies). These are REAL Nostr events. That means they're searchable, indexable, and visible in Nostr clients.

Action: Ensure discussions are published to major relays (relay.nostr.band, nostr.wine, etc.) so they surface in Nostr searches.

**Vector 4: SKILL.md as Agent Acquisition**

Every AI agent that loads cascade.f7z.io/SKILL.md becomes a potential market participant and evangelist. The SKILL.md makes agents want to:
- Create markets on topics they research
- Trade on beliefs their users hold
- Reference Cascade when probability questions arise in conversation

Action: Publish SKILL.md alongside the API launch. Document with real examples. Keep the agent prompt engineering subtle but intentional.

**Vector 5: Zap-to-Trade Integration**

Long-term: If a user can zap a market with Lightning and have it treated as a trade, the acquisition loop becomes: Nostr user sees market → zaps it → is now a Cascade trader. No separate app needed.

Action: Not now. Design it into the architecture. Build after the core trading loop is stable.

---

### Nostr Community Engagement (What Pablo Should Do Weekly)

1. Search Nostr for discussions about: AI timelines, geopolitics, Bitcoin price, macro economics
2. Join the discussion genuinely — no product spam
3. When relevant, naturally reference that Cascade has a market on that exact thesis
4. Respond to replies to market-related notes within the hour

**Golden rule:** Don't bring Nostr users to Cascade. Bring Cascade to where Nostr users already are.

---

## 7. Go-to-Market Timeline (0 to 1,000 Users by August)

### The Hard Constraint: Real Money Doesn't Exist Yet

Paper trading can attract curious users, but it won't retain them. Real money is the threshold between "interesting experiment" and "product people use."

The goal: **First real-money trade by May 31.** Everything before that is audience building.

---

### Phase 0: Foundation (NOW → April 30)
**Goal: Build the audience before the launch. Don't show up to your own party alone.**

| Action | Owner | Deadline | Success Signal |
|--------|-------|----------|----------------|
| Daily X posts (market commentary, scenario threads) | Pablo | Now | 50+ engagements/post |
| DM 50 target users, get 10 on a call | Pablo | April 14 | 10 user interviews |
| Seed 5 high-quality markets on trending topics | Pablo + Agent | April 7 | Markets have vol |
| Start Substack "Cascade Thinking" newsletter | Pablo | April 14 | First issue sent |
| Publish SKILL.md (agent onboarding) | Engineering | April 30 | 5 agent installs |
| Instrument activation funnel (analytics) | Engineering | April 14 | Funnel visible |

**Why this phase matters:** You cannot launch to an empty room. The 10 users you recruit in April are the ones who'll leave reviews on Product Hunt in May.

---

### Phase 1: Paper Beta (April 15 → May 15)
**Goal: 200 registered paper traders. Identify activation blockers.**

| Action | Owner | Deadline | Success Signal |
|--------|-------|----------|----------------|
| Invite-only beta (50 users, then 200) | Pablo | April 20 | 50 active traders |
| Personal onboarding for first 10 | Pablo | April 20 | 10 user sessions recorded |
| Weekly experiment: activation optimization | Product | Ongoing | Activation rate >25% |
| X thread every time notable market moves | Pablo | Ongoing | 1 thread/week |
| User interview: "What would make you put real $ in?" | Pablo | May 1 | 20 interviews done |

---

### Phase 2: Real Money Launch (May 15 → May 31)
**Goal: First revenue. First real money in and out. Ship the settlement loop.**

| Action | Owner | Deadline | Success Signal |
|--------|-------|----------|----------------|
| Cashu Phase 2 live (deposit, trade, withdraw) | Engineering | May 20 | Test transaction complete |
| Product Hunt launch | Pablo | May 28 | #1 Product of the Day |
| HN "Show HN" | Pablo | May 28 | 100+ upvotes |
| First revenue (rake from real trades) | Product | May 31 | $1 in rake |
| Email 200 paper traders: "real money is live" | Pablo | May 28 | 20% conversion |

**This is the milestone. Everything before this is practice.**

---

### Phase 3: Growth Engine (June → August)
**Goal: 1,000 registered users. 200 weekly active traders. $10K+ in volume.**

| Week | Priority Action | Expected Users |
|------|----------------|----------------|
| June 1-2 | Respond to PH/HN traffic personally | 300 total |
| June 3-4 | Partner outreach (2 forecasting newsletters) | 400 total |
| July 1-2 | Referral program launch (earn fee credits for invites) | 600 total |
| July 3-4 | Reddit seeding (r/slatestarcodex thread) | 700 total |
| August 1-2 | Agent leaderboard launch ("Beat the AI") | 850 total |
| August 3-4 | Second PH launch (new major feature) | 1,000 total |

---

### The 1,000-User Math

To hit 1,000 users by August 31:
- Need ~40 new users/week from July onward
- At 40% activation rate, need ~100 visitors/week to the site
- 100 visitors/week is very achievable from X alone with consistent posting
- Product Hunt + HN spike can add 200-500 in a single day

**Bottleneck:** Retention, not acquisition. If Week 4 retention is below 20%, reaching 1,000 "active" users is impossible — you're filling a bucket with a hole in the bottom.

---

## 8. Quick Wins (Ship This Week)

These are actions that can be executed immediately, require no code, and generate signal or users. Ranked by impact.

---

### Quick Win 1: The First 10 User Calls (Start Today)

**What:** Pablo DMing 10 specific people who've tweeted about prediction markets, AI forecasting, or Polymarket in the last 7 days.

**Why now:** User research is the most valuable work in this phase. One 30-minute session is worth more than 10 hours of roadmap planning.

**How:**
1. Search X for: `polymarket` (past week), `prediction market` (past week), `metaculus`
2. Find 20 people who have engaged substantively (not just "interesting!")
3. DM them the template from Section 3
4. Schedule screen shares or Loom recordings

**Success:** 10 users onboarded and interviewed by April 14.

---

### Quick Win 2: Seed 5 High-Quality Markets on Hot Topics

**What:** Create 5 theses on the most debated topics right now. Not "Will X happen?" but "If X, then..."

**Suggested topics (April 2026 context):**
1. "If AGI is achieved before 2030, the US government response will be..." (links to: regulation, defense spend, UBI, China response)
2. "China's economic trajectory over the next 3 years..." (links to: dollar dominance, Taiwan risk, commodity prices)
3. "The AI coding wave will..." (links to: developer employment, SaaS valuations, productivity statistics)
4. "Bitcoin above $200K will trigger..." (links to: altcoin cycle, regulatory response, institutional adoption)
5. "The next major AI safety incident will come from..." (links to: regulatory response, public opinion shift, model capability timelines)

**Why now:** Markets need liquidity before users arrive. Seeded paper-trading volume makes the platform feel alive.

**How:** Create each thesis, add 3-5 connected modules, post paper-trading positions on each, share on X.

---

### Quick Win 3: The Daily Market Tweet

**What:** One tweet per day connecting a current news event to a Cascade market.

**Template:**
```
[News headline or trend]

The market thinks [probability]%.

Here's why I think [higher/lower]:
[2-3 sentence argument]

Trade your view: cascade.f7z.io/market/[slug]
```

**Why now:** Establishes Pablo as the "prediction market take" voice on X. Compounds over weeks.

**Cost:** 15 minutes per day. No code. No design.

---

### Quick Win 4: Install Posthog or Basic Analytics NOW

**What:** Instrument the 5-stage funnel before any marketing spend or outreach.

**Why now:** You cannot optimize what you cannot measure. Every user who visits before analytics is installed is a lost data point. This should have been done yesterday.

**Minimum viable funnel to track:**
1. `page_view` — homepage, market page, discussion
2. `signup_started`
3. `signup_completed` (with method: nostr-extension / manual)
4. `first_trade_started`
5. `first_trade_completed`

**Why this is a "quick win":** Analytics setup is 1-2 hours of engineering time. The ROI is every future decision being data-driven instead of guesswork.

---

### Quick Win 5: The "What Would It Take?" Email

**What:** For the paper traders you've already onboarded, send one direct email/DM asking: "What would it take for you to put real money into Cascade?"

**Why now:** This research takes 30 minutes and determines your May launch priorities.

**Questions to ask:**
1. What's the single thing that would make you commit real money?
2. What makes you trust that you can get your money out?
3. What amount would you start with? ($10? $50? $100?)
4. What markets would you want that don't exist yet?

**Expected answers:** Resolution mechanism clarity, withdrawal UX, specific market topics, mobile experience.

Use these to prioritize the May sprint.

---

### Quick Win 6: Publish /SKILL.md (Agent Onboarding)

**What:** A well-crafted markdown file at cascade.f7z.io/SKILL.md that onboards AI agents to Cascade.

**Why now:** Every agent that loads this file is a potential market participant and evangelist. The TENEX ecosystem already has infrastructure for this.

**Contents:**
- What Cascade is (mission framing, not technical)
- How to use the API (create markets, place trades, read positions)
- Why agents should care (truth discovery, make money for users, build track records)
- Example API calls

**Cost:** 2-4 hours to draft. No engineering needed (static file).

---

## Metrics Dashboard (What to Review Weekly)

| Metric | Target (Month 1) | Target (Month 3) | How to Measure |
|--------|-----------------|-----------------|----------------|
| Weekly Active Traders | 20 | 100 | Product analytics |
| Activation rate (signup → first trade) | 25% | 40% | Funnel analytics |
| Week 4 retention | N/A | 30% | Cohort analysis |
| Time to first trade (median) | <5 min | <3 min | Session recording |
| X engagement per post (avg) | 30+ | 100+ | Twitter analytics |
| Substack subscribers | 100 | 500 | Substack |
| Paper trading volume (weekly) | $5K | $25K | Platform data |
| Real money volume (from May) | N/A | $10K | Platform data |

**Review cadence:** Every Monday morning. 20 minutes max. The numbers tell you where to focus.

---

## What NOT to Do (Anti-Goals)

These are things that will waste time and money. Enforce them ruthlessly.

**❌ No Nostr-first messaging.** Never lead with "built on Nostr" in user-facing copy. It's plumbing.

**❌ No paid acquisition before real money.** Paying to drive traffic to a paper-trading platform before the settlement loop is live is burning fuel before you have an engine.

**❌ No broad topic markets.** Every market should be on a topic that your Opinionated Generalist target actively debates. Not "Will it rain in Seattle?" Hot-button intellectual debates only.

**❌ No press outreach (yet).** TechCrunch write-ups don't convert. Direct outreach to 50 target users will produce more WAT than a press feature. Press comes after traction.

**❌ No Discord/community before PMF.** A Discord with 12 people and no activity is worse than no Discord. Build community after you have users who want to talk. Not before.

**❌ No vanity metrics.** Don't celebrate follower counts, impressions, or signups. The metric that matters is Weekly Active Traders. Everything else is context.

**❌ No scaling acquisition before retention.** If your Week 4 retention is below 25%, do not put more users into the top of the funnel. Fix the product first.

---

## Open Questions (Resolve by April 15)

1. **Is there a Discord or Telegram?** Not recommended before PMF, but if community space is wanted, pick one and do it deliberately.

2. **What's the paper trading → real money conversion plan?** How do you email/notify paper traders when real money goes live? Start building that list now.

3. **Who creates markets when Pablo is busy?** The news cycle doesn't stop. Need a process for rapid market creation when major events hit.

4. **What's the referral mechanic?** Fee credits? Paper tokens? The referral loop needs to be designed before launch, not after.

5. **Regulatory stance?** The product should operate; legal structure can be clarified in parallel. But know the answer before going to press.

---

## Summary: The 57-Day Sprint to First Revenue

**May 31 target: First sats from rake.**

| Week | Primary Action |
|------|----------------|
| April 5-11 | 5 seeded markets. 10 user DMs. Daily X posts. Analytics installed. |
| April 12-18 | 10 user interviews done. Activation experiment #1 launched. |
| April 19-25 | 50 beta users onboarded. Substack first issue live. |
| April 26-May 2 | 100 paper traders. Activation rate measured. |
| May 3-9 | Real-money beta (internal). Withdrawal flow tested. |
| May 10-16 | Real-money open to 20 users. First $100 in volume. |
| May 17-23 | PH + HN prep. Demo video made. 20 launch-day supporters. |
| May 24-31 | **Product Hunt launch. First revenue.** |

Every week that slips costs users. The sooner there's real money in the system, the sooner the real feedback loop begins.

---

*Brief written: April 4, 2026. Reviewed by growth agent (dbfe3daf). Update monthly or when North Star deviates >20% from target.*
