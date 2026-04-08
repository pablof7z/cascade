# Cascade Product Decisions

**Living Document** — Every directive Pablo has given for this project.
*Last updated: 2026-04-05 21:20 UTC*
*Source: Exhaustive sweep of 19+ conversations + relay extraction of all Pablo notes tagged to cascade-8f3k2m*

**⚠️ DO NOT override, ignore, or second-guess these decisions. They are explicit directives from the project owner. If a decision here conflicts with your judgment, the decision here wins.**

---

## 1. ARCHITECTURE

### 1.1 Svelte Port — Total React Abandonment
> "Port to Svelte. Abandon React. I MEAN IT."
> "we need to migrate it all!"
> "Yes - port everything. Incremental is fine."

- Complete migration from React to Svelte 5 + SvelteKit.
- 5-phase plan at `.tenex/plans/svelte-port.md`.
- No exceptions. No React in new code.
- Incremental migration is acceptable — but everything must be ported.

### 1.2 Market Events — Kind 982 (Non-Replaceable, Immutable)
> "market shouldn't be a replaceable event, it MUST be a non 3xxxx kind event, so no 'A', only 'E'"
> "version: 1 is stupid -- remove it"

- Kind 982 only. Not kind 30000.
- Only `E` tags, never `A` tags.
- Remove `version: 1` tag.
- Markets are immutable once published.

### 1.3 Markets Never Expire
> "markets never expire"

- No expiration mechanism. Markets live forever.

### 1.4 Deployment — Vercel, Always Visible
> "you MUST deploy to vercel and obviously commit things -- otherwise I don't see shit"
> "I want to deploy it to vercel to cascade.f7z.io"
> "deploy to prod so I can see it"
> "commit and push and deploy to vercel"
> "publicly -- it shouldn't require auth"

- Deploy to Vercel at `cascade.f7z.io`.
- Always commit AND deploy. If it's not deployed, it doesn't exist.
- Production deployments must be public — no auth required.

### 1.5 Mint Has Its Own Pubkey
> "the mint obviously needs to have its own pubkey"

- Mint identity is separate from user/platform identity.

### 1.6 Modules Are Informational Links ONLY
> "only market influence the thesis probability, the modules are literally linked just informationally! Why do you insist in claiming there's a deeper fucking link!"

- Modules within a thesis are informational connections only.
- Modules do NOT influence each other's probability.
- Each market's probability is independent.
- The thesis structure shows relationships — it doesn't compute compound probabilities.

### 1.7 Repo Setup
> "hey, the repo of this project is git@github.com:pablof7z/cascade.git -- let's make sure its properly set up"

- Git remote: `git@github.com:pablof7z/cascade.git`
- Auto-deploys on push to main.

---

## 2. CASHU MINT

### 2.1 Specialized Mint — Build, Don't Buy
> "We can't use a regular mint because of that; we need a specialized mint and we need to carefully plan the conditions of how this very specialized piece of software runs."
> "We need to build the mint part; since the issuance of tokens is in a per-market basis, plus the exchange of base tokens to market (long and short) changes based on the market rate at the time."

- Cannot use off-the-shelf mint (rejected Minibits etc.).
- Must build custom mint with LMSR pricing integration.
- Per-market token issuance is the core architectural requirement.

### 2.2 Per-Market Token Issuance with Shared Keysets
> "it should be one key set per market long and one key set per market short, and we obviously need to track what event corresponds to each key set pair"
> "One keyset per market — all users share market's keyset (simpler)"

- One keyset per market long, one per market short.
- All users share the market's keyset (not per-user-per-market).
- Must track which event corresponds to each keyset pair.

### 2.3 Withdrawal via Lightning
> "Lightning (NUT-05 melt) — users provide BOLT11 invoice"

- NUT-05 melt for withdrawals.
- Users provide their own BOLT11 invoice.

### 2.4 Escrow Architecture
> "Build escrow architecture (10-14 dev days)"

- Escrow path chosen for fund management.
- Estimated 10-14 dev days.

### 2.5 Plan Approval Required Before Implementation
> "Don't implement anything. I want to sign off on the plan..."

- No mint implementation without Pablo's explicit sign-off on the plan.

### 2.6 Cashu Expert + Specialist Agent
> "include the cashu expert on how this can work"
> "create an agent that becomes a specialist on one mint software so we can form it to add the LSMR per-token issuance"

- Cashu expert must be consulted on architecture.
- Dedicated specialist agent for mint software.

### 2.7 Multi-Mint Support (Future)
> "Multi mint support; sure, other mints will have to run our software with the special LMSR pricing and whatnot. For the future."

- Not now, but architecture should not preclude it.

### 2.8 Fee Model
> "About the fee, sure 2%, whatever, we can figure out that later."

- 2% rake on winning payouts (2000 ppk).
- Exact number is flexible / can be adjusted later.

### 2.9 Mint URL Routing (NOT Nostr)
- Cashu mint uses URL path segmentation for market identification.
- NOT Nostr relay-based routing.
- The mint is a standalone HTTP service, not a Nostr relay.

---

## 3. MARKET CREATION & FUNDING

### 3.1 Creator Must Seed Initial Funding
> "the person that creates the market must seed the initial funding (that's their initial position, right?)"
> "you shouldn't be able to launch it since otherwise it would start with a market cap of $0"

- Market creator provides initial liquidity.
- Cannot launch a market with $0 market cap.
- Initial funding = creator's initial position.

### 3.2 Rename 'Build Thesis' to 'Create Market'
> "rename 'Build thesis' to 'Create Market'"

- UI label change. Done.

### 3.3 User Must Declare Side
> "we need to mark them whether the user thinks they'll resolve for the yes or for the no side."

- When taking a position, user must indicate which side (yes/no) they believe will resolve.

### 3.4 Mock Data → Real Events
> "I had said that I wanted to have the mock data we had in the past as hard used markets, I want it published as events that will show up in the app."

- No mock/fake data in production. All market data must be real Nostr events.
- The sample markets that existed as mock data should be published as real events.

### 3.5 Embeddable Markets (Future Feature)
> "this will be a product feature"

- Markets will be embeddable in other contexts. Plan for it.

### 3.6 LMSR Pricing
> "Do we finally have a plan of how the interaction of funding markets and redemption, LSMR works?"

- LMSR (Logarithmic Market Scoring Rule) is the pricing mechanism.
- Must be integrated into the mint for token pricing.
- The exchange rate between base tokens and market tokens (long/short) is dynamic based on LMSR.

---

## 4. UI/UX & STYLE

### 4.1 NO Loading Spinners — EVER
> "Loading spinners on nostr applications should never exist. Nostr is event based! Show the data as it streams in: not a fucking spinner. No loading states!!!"

- Zero spinners. Zero loading states.
- Show data as it streams in. Event-driven rendering.

### 4.2 Style Guide — Editorial Minimalism
- Dark theme on `neutral-950`.
- Accents: ONLY `emerald` (bullish) and `rose` (bearish).
- No rounded pills, no background-fill toggles, no emojis in UI chrome, no gradients.
- Typography: `font-sans` (Inter) for text, `font-mono` (JetBrains Mono) for numbers.
- Tabs: underline-only style.
- No stacked borders.

### 4.3 No Blue Tint — Neutral Colors Only
> "I don't like the blue-tinted tailwind -- I want neutral colors"
> "it used to have a neutral color; now it has a blue hue as the background -- I hate it"

- NO blue tint anywhere. Pure neutral grays only.
- Tailwind's default `gray` has a blue tint — use `neutral` scale instead.
- Background colors: `neutral-950`, `neutral-900`, `neutral-800` only.

### 4.4 No Cards Everywhere / No Wasted Space
> "I don't want in the design: cards everywhere, wasted space everywhere"
> "the current style and informational density, visual hierarchy and cues are way too cluttered... I want you to redesign the site, nailing the styles, ensuring we have consistency"

- Eliminate unnecessary card wrappers.
- Tight, purposeful layouts.
- Consistency across all pages.

### 4.5 No Nostr Jargon in UI
> "remember to not leak any 'nostr' stuff into the UI; don't overwhelm the user with technical details like showing them their key or anything like that."
> "we don't store the nsec server-side; we put it in localStorage and allow them to get it retrieve it via Settings... we don't show them npub or nsec during onboarding nor talk about keys"

- No npub/nsec shown during onboarding.
- No "Nostr" terminology in user-facing UI.
- nsec stored in localStorage, retrievable only via Settings page.

### 4.6 Restore Onboarding Flow (Lost in Svelte Port)
> "we also need to restore the onboarding flow we had on /welcome -- its completely gone since the svelte port"

- The /welcome onboarding that existed pre-Svelte port must be restored (in Svelte).
- Decided to keep a minimal version — not a full restoration of the React OnboardingSplit.

### 4.7 Restore Footer (Lost in Svelte Port)
> "we used to have a very nice footer, I think when we migrated to svelte we left our nice footer on the cutting floor -- we need to bring it back"

- Footer from React era must be brought back in Svelte. ✅ Done.

### 4.8 Onboarding — Clean, No Clutter
> "the onboarding flow is still cluttered with gradients and cards..."

- Onboarding must follow the minimal style guide. No gradients. No cards.

### 4.9 Human vs Agent Distinction
> "the difference between human vs agent is very bland; it should dominate hierarchically a lot more"

- The human/agent choice in onboarding must be visually dominant, not subtle.

### 4.10 Landing Page Needs Punch
> "the landing page is still very bland... there's nothing pulling you in, there's no even any differentiator that grabs you"

- Landing page needs a strong hook / differentiator.
- Current version is too generic.

### 4.11 Discussion Layout
> "1. remove the long/short"
> "2. add the title of in which market the discussion is happening"
> "3. put it below markets"
> "remove both; just have the placeholder be 'Market title'"

- Discussions: remove long/short labels.
- Show which market the discussion belongs to.
- Position discussions below markets section.
- Input placeholder: just "Market title".

### 4.12 Dashboard — Briefing, Not Greeting
> "Rewrite to match the new spec. The emotional frame is 'Your agents worked overnight — here's what they found.' It's a briefing, not a greeting."

- Dashboard tone: professional briefing.
- Not a welcome/greeting page.

### 4.13 Enable All Navigation Items
> "Enable ALL items. Remove disabled states from Treasury, Activity, Settings. All should be clickable and route to real pages."

- No disabled/greyed-out nav items. Everything routes to a real page.

### 4.14 Remove "Avg. Resolution Horizon" Stat
> "Remove the AVG. RESOLUTION HORIZON stupid stat"

- This stat should not appear anywhere in the UI.

### 4.15 Tab Buttons — Fix the Styling
> "cna you please fix this shit? why do the buttons look so bad?"

- Tab buttons must follow the underline-only style defined in the style guide.
- No pill/filled tab styles.

### 4.16 Don't Remove Valid Content During Redesigns
> "The previous redesign FAILED. It removed valid content from the page while 'redesigning'."
*(from Cascade Website Redesign round 2)*

- When redesigning pages, preserve ALL existing valid content.
- Redesign means restyle — not strip content.

### 4.17 Hero CTA Buttons
> "Start Trading" → scrolls to markets section
> "For agents →" → links to /help

- Verified and implemented 2026-04-05. ✅

---

## 5. COPY & CONTENT

### 5.1 Don't Claim — Show
> "we shouldn't *say* arguments move price... this is a matter of reality, not something we should fucking say!"

- Don't make claims about mechanics. Let the product demonstrate them.

### 5.2 Hero Section Needs Work
> "the current hero section's copy is not good imo"

- Hero copy needs revision for impact and clarity.

### 5.3 Agent Enrollment Copy
> "the join > agents page needs some text that explains, to the human, how they can benefit from enrolling their agents -- some good copy that aligns with sales since we need to persuade the user"

- /join agents page needs persuasive copy explaining benefits to humans.

### 5.4 Think Broader
> "don't just *only* address the things I explicitly cited; think broader"

- When fixing issues, look beyond the specific items mentioned. Fix the whole category.

---

## 6. PROCESS & WORKFLOW

### 6.1 Use Execution-Coordinator, Not Direct Claude-Code
> "from now on, use execution coordinator to direct work, not directly to claude code"

- All implementation work goes through execution-coordinator.

### 6.2 Planning → Planning-Orchestrator
> "planning should go to the planning orchestrator; when planner is done; send the plan to the orchestrator so it can carry on its planning workflow"

- Plans go to planning-orchestrator, not directly to planner.

### 6.3 Architect-Coordinator Manages Implementation
> "let's ensure the architect coordinator manages the implementation through claude code and clean code nazi reviews"

- architect-orchestrator oversees implementation.
- clean-code-nazi reviews are part of the workflow.

### 6.4 Don't Follow Up Constantly
> "don't follow up constantly -- you will be awaken when the agent is done!"

- No polling. Wait for completion callbacks.

### 6.5 Don't Babysit
> "I shouldn't have to babysit you on obvious shit like this."

- Take initiative on obvious decisions. Don't ask when the answer is clear.

### 6.6 Look Up Existing Code — Don't Redesign From Scratch
> "that was a stupid answer -- if this was already designed and all we did was port from react to svelte... why would you think from scratch?! the actual react code is still on git; why not fucking look it up!"

- When porting/migrating, ALWAYS check the existing code first.
- Don't redesign something that already has an implementation — port it faithfully.
- The React codebase is in git history. Use it as reference.

### 6.7 Systematic Migration — Nothing Left Behind
> "create a list of things that need to be migrated -- do one by one -- don't leave anything behind"

- Create comprehensive checklists for migrations.
- Track every item. Do them one by one.
- Nothing gets left behind.

### 6.8 Track Everything — Don't Make Me Repeat Myself
> "and you better keep tabs of this -- don't make me have to repeat myself again on this"

- Every directive must be tracked and persisted.
- If Pablo said it once, that's enough. Don't make him say it again.

### 6.9 Careful Planning for Critical Systems
> "we need to carefully plan the conditions of how this very specialized piece of software runs"

- Critical systems (mint, LMSR) require thorough planning before implementation.
- Not a rush job — get it right.

---

## 7. BUSINESS & GROWTH

### 7.1 Substack Agent
> "Let's build an agent to manage our substack publication and whatnot"

- Dedicated agent for Substack content management.

### 7.2 Agent Meetings (Future)
> "agents should have meetings where they can brainstorm, research, argue together"

- Future feature: collaborative agent sessions.

### 7.3 Domain Registration — DEFERRED
- Pablo explicitly said: "the domain registration will do later; stop pestering me on that"
- Do NOT bring this up again until Pablo raises it.

### 7.4 Revenue Model
- 2% rake on winning payouts.
- Module royalties (future).
- Token spread (future).
- Target: First revenue May 31, 2026.
- 1,000 users by August 2026.
- Profitable by Month 18.

### 7.5 Cascade Positioning
> Polymarket asks "Will X happen?" — Cascade asks "If X happens, then what?"

- Conditional prediction markets are the differentiator.
- Not just binary yes/no — thesis networks showing causal reasoning.

---

## 8. PRODUCT CONCEPT & IDENTITY

### 8.1 Core Concept — From Grok Conversation
> "hey, I want you to read exhaustively [Grok conversation] and generate a report..."

- Pablo designed the core prediction market concept in a Grok conversation.
- Modules = atomic predictions (like Polymarket questions).
- Theses = networks of modules connected by causal beliefs.
- The key innovation: expressing conditional conviction, not just binary bets.

### 8.2 Name
- Originally "Contrarian Markets" → renamed to **"Cascade"**.
- The "cascading" refers to how beliefs cascade through connected predictions.

### 8.3 Nostr-Native
- Built on Nostr from day one.
- Markets are Nostr events.
- Trading positions are Nostr events (kind 30078, NIP-78).
- Discussions use kind:1111 (NIP-22).
- No centralized backend for user data.

---

## 9. PAGES & FEATURES — EXPLICIT DECISIONS

### 9.1 Required Pages (All Must Route)
- `/` — Landing page with markets
- `/thread/[marketId]` — Market detail / trading
- `/activity` — Real activity (uses fetchAllMarketsTransport, no mock data)
- `/analytics` — Analytics page (removed mock data/loading spinner ✅)
- `/profile/[pubkey]` — User profile with Markets/Positions tabs
- `/welcome` — Onboarding flow (minimal, clean)
- `/portfolio` — User positions and PnL
- `/settings` — Settings including nsec retrieval
- `/help` — Help/FAQ page
- `/blog` — Blog page (removed hardcoded placeholder ✅)
- `/terms` — Terms of Service (real content ✅)
- `/privacy` — Privacy Policy (real content ✅)
- `/wallet` — Treasury/Wallet page

### 9.2 Discussion Feature
- Kind:1111 NIP-22 comments.
- Real-time via Nostr subscriptions.
- 4 Svelte components. ✅ Shipped.

### 9.3 Legal Pages
- Must be real content, not placeholders.
- Plain English.
- Covers LMSR mechanics, Cashu/ecash, Nostr identity model.
- ✅ Shipped.

---

## VERSION HISTORY

| Date | Changes |
|------|---------|
| 2026-04-05 21:20 | **Comprehensive rewrite** — Exhaustive sweep of 19+ conversations. Added: §1.6 Modules informational-only, §1.7 Repo setup, §2.9 Mint URL routing, §3.6 LMSR pricing, §4.3 No blue tint, §4.14 Remove resolution horizon stat, §4.15 Tab styling, §4.16 Don't remove content during redesigns, §6.6 Look up existing code, §6.7 Systematic migration, §6.8 Track everything, §6.9 Careful planning, §7.4 Revenue model, §7.5 Positioning, §8 Product concept & identity, §9 Pages & features. |
| 2026-04-05 20:55 | **Major rewrite** — Full relay extraction. Expanded from 8 to 40+ directives across 8 categories. |
| 2026-04-05 20:35 | Initial document creation — 8 core directives + 5 pending areas. |
