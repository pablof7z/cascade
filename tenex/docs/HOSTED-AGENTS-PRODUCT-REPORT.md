# Cascade Hosted Agents — Product Report

*Comprehensive product specification for the field-centered workspace.*
*Created: 2026-03-31*

---

## 1. What This Product Is

A **private research-and-execution workspace** organized around domains where the human has real judgment. The user defines "fields" — areas they genuinely understand — and staffs them with AI agents who extend, challenge, and operationalize the user's edge.

**This is NOT:**
- An autonomous AI trading dashboard
- A black-box "bot trades for you" product
- A generic portfolio tracker
- An SDK or "build on Cascade" platform

**The one-line pitch:** "You now have an always-on staff sharpening and expressing your thinking."

---

## 2. Rationale

Prediction markets are currently flat catalogs of disconnected bets. The user browses, picks one, bets, leaves. There is no infrastructure for:
- Organizing markets around a coherent thesis
- Attaching research and source material to positions
- Having agents debate and refine conviction before deploying capital
- Maintaining persistent deliberation that connects reasoning to risk

The hosted agents product fills this gap by making the human's *conviction* the organizing principle, not the market.

**Core insight from Pablo:** "I don't know shit about topic Y, so I don't want my agents to trade or brainstorm or research on that topic, because I have no idea on how to direct them."

Fields exist because agent value requires human direction. Undirected agents are noise. Directed agents — pointed at a domain the human actually understands — are leverage.

---

## 3. Target Audience

**Primary:** Opinionated individuals who actively follow specific domains (politics, tech, crypto, macro, etc.) and want to operationalize their knowledge into market positions — but lack the time/tooling to do research, monitor, and execute continuously.

**Profile:**
- Has strong opinions backed by reading, experience, or domain expertise
- Comfortable with prediction markets or willing to learn
- Wants their thinking *extended*, not replaced
- Values transparency over convenience — wants to see the reasoning chain
- Not looking for passive income; looking for an edge expressed systematically

**Not for:** People who want to hand money to a bot and check back in a month.

---

## 4. Core Product Model

The workspace is built on five primitives:

### 4.1 Field
The top-level organizing unit. A domain where the user has **strong opinions** — contrarian, unpopular, or deeply held views that constitute their edge.

- A user creates a field around an area they understand (e.g., "AI regulation," "2026 US midterms," "DeFi yield compression")
- No field without human conviction — the system should treat topics without user opinion as out of bounds
- Fields can be `active`, `draft`, or `concluded`
- The field is NOT a thesis statement — it's a living domain of conviction that evolves through interaction

#### Field Creation Flow

**Step 1: The user names a topic.** Just 2-4 words. "2026 midterms." Low friction.

**Step 2: The system generates a broad situational briefing.** Using existing prediction markets, social signals, discussion chatter, and public data, the backend produces a current state-of-the-world snapshot for that topic. Example for "2026 midterms":
- "Democrats at 42% odds to hold the Senate per Polymarket"
- "Growing chatter on whether Vance will denounce the Iran conflict ahead of midterms"
- "Contrarian view emerging: some analysts predicting a larger red wave than consensus"
- Key markets, key narratives, key tensions — all presented as raw material

This briefing serves two purposes: (1) it shows the user what the consensus thinks, which is exactly what they need to push against, and (2) it gives them material to react to rather than creating from scratch.

**Step 3: The user records their strong opinions.** This is the critical moment. The user provides their edge — ideally via **voice/audio** rather than text. An audio recording gives the user space to think out loud, explore, contradict themselves, and express intuitions they couldn't nail down in a clean thesis statement. The system captures and processes this into the initial corpus.

Why audio matters:
- Lowers friction dramatically compared to writing a polished thesis
- Captures nuance, hedges, and half-formed intuitions that text would flatten
- Lets the user react naturally to the briefing material
- Produces richer raw material for agents to work with
- The agents' job is to take this raw, messy human intuition and augment it with research, data, and structure — not the other way around

**Step 4: Agents are auto-assigned and begin working.** A starter council is attached automatically. They immediately begin processing the user's strong opinions alongside the situational briefing, and launch their first meeting — researching, finding supporting/contradicting evidence, identifying relevant markets, and forming initial positions informed by the user's stated edge.

**The user's ongoing role:** At any point, the user can return to their field and find:
- What conclusions the agents have reached
- What research they've done
- What meetings have happened
- Where agents agree/disagree with the user's original opinions
- What positions have been proposed

The user then provides **direction**: reinforcing views, adding nuance, shutting down lines of thinking they disagree with, dropping new information. Every piece of user input is treated as **truth** by the agents — not as a suggestion to evaluate, but as ground truth that must be profoundly integrated into their reasoning. The agents may push back and present counter-evidence, but the user's stated positions carry decisive weight.

**Key term: Strong Opinions.** This is the language that captures what the user brings. Not "thesis" (too academic), not "conviction" (too financial), not "belief" (too passive). Strong opinions — contrarian, unpopular, deeply held views that the user is willing to put capital behind.

### 4.2 Library
First-class source materials that inform a field.

- Books, PDFs, videos, links, notes, clips, annotations
- Sources are NOT attachments — they are primary objects agents can read, quote, and reference
- Each source can have relevance notes explaining why it matters to the field
- The library is what gives agents context beyond market data

### 4.3 Council
The agents attached to a field.

- **Hosted agents:** Provisioned and run by Cascade. Per-agent USD pricing.
- **Connected agents:** User's own agents, connected via the `join` path (their own framework, not a Cascade SDK)
- Both types feel identical once inside the workspace — same interface, same participation model
- The only difference is provisioning: hosted = we run it, connected = you run it

### 4.4 Meetings
The live center of the experience. Private strategy forums where agents and the human deliberate.

- Agents brainstorm, research, argue, cite sources, propose markets, write rebuttals
- The human can participate directly or observe
- Meetings produce action items: market proposals, position adjustments, thesis refinements
- Deliberation is persistent and visible — not ephemeral chat
- This is where the product *feels* different from every other trading tool

### 4.5 Capital
Per-agent wallets and field-level exposure.

- Every agent has its own wallet with visible balance
- Capital is tracked per-field, not just per-market
- Every action with money behind it traces back to: a thesis → a discussion → an agent wallet
- Positions are displayed in the context of the thesis they express, not as isolated bets

---

## 5. Dashboard Surfaces

### 5.1 Home (Field Overview)
All fields at a glance:
- Which fields are active
- Where disagreement is rising
- Which meetings need attention
- Where capital is deployed
- Aggregate stats: total exposure, agent count, recent activity

### 5.2 Field Page
Deep dive into one field:
- Thesis summary and conviction statement
- Key source materials (library)
- Attached agents (council) with roles and contribution history
- Current debates and unresolved questions
- Candidate markets (proposed by agents or human)
- Active positions and exposure
- Meeting snapshot with recent entries

### 5.3 Meeting View
The deliberation room:
- Timeline/room where agents talk to each other and to the human
- Quoted sources and evidence
- Arguments and counterarguments
- Action items and proposals
- Persistent — not a chat that disappears

### 5.4 Agent View
Per-agent detail:
- Role and field assignments
- Recent contributions across fields
- Current tasks and permissions
- Wallet balance and transaction history
- Hosted vs. connected status

### 5.5 Treasury View
Capital overview:
- Balances and flows by agent
- Aggregate exposure by field
- Position performance tied to theses
- Spend tracking

---

## 6. Key User Verbs

The main actions a user takes in the workspace:

1. **Name a topic** — 2-4 words, the domain they know
2. **React to the briefing** — see what the world thinks, identify where they disagree
3. **Record strong opinions** — voice/audio preferred, text accepted. Raw, messy, intuitive. The agents will structure it.
4. **Provide direction** — come back, see what agents found, reinforce/redirect/shut down lines of thinking
5. **Drop sources** — add articles, links, notes that support or inform their views
6. **Approve actions** — greenlight trades, market positions, capital deployment
7. **Review and refine** — see how their strong opinions map to positions, evidence, and outcomes

---

## 7. Pricing Model

- **Per-agent USD pricing** for hosted agents
- Each hosted agent has a visible, separate wallet
- Connected agents (user's own framework) have no Cascade hosting fee
- No "subscription tier" abstraction — you pay for the agents you use

---

## 8. Design Principles

1. **No field without strong opinions.** Agents do not invent direction. They extend, challenge, and operationalize the user's edge. The user's stated opinions are ground truth.
2. **The user's voice is the primary input.** Audio-first, text-accepted. Lower the friction of expressing intuition. Agents structure what the user expresses — not the other way around.
3. **Show the consensus so the user can push against it.** The situational briefing exists to give the user something to react to. The product is built for contrarians.
4. **Sources are first-class objects.** Not attachments. Agents read, quote, and reference them.
5. **Deliberation is visible and persistent.** The meeting layer is the product's center of gravity.
6. **Disagreement is legible, not hidden.** Show where agents are being challenged by the user's views, and where agents push back with evidence.
7. **User input is truth, not suggestion.** When the user provides direction, agents integrate it as decisive ground truth. Agents may present counter-evidence, but the user's position carries weight.
8. **Markets are downstream.** They are outputs of fields and strong opinions, not the main organizing unit.
9. **Hosted and connected agents feel the same** once inside the workspace. Two provisioning modes, one experience.
10. **Every position traces to a strong opinion.** User's opinion → agent research → deliberation → position. The chain is always visible.
11. **Don't lead with charts. Don't lead with profits.** Lead with strong opinions and evidence.

---

## 9. Emotional Tone

- Serious, analytical, slightly sovereign
- NOT "AI makes you money while you sleep"
- More: "you now have an always-on staff sharpening and expressing your thinking"
- The user should feel like they are running a research-and-execution system around their edge, not renting a black-box bot

---

## 10. What "Fields" Is NOT (Public vs. Private)

Fields is a **private, authenticated workspace feature**. It is NOT:
- A public browsable directory of topics
- An editorial/curated content section
- A community feature visible to other users

Fields live inside the user's dashboard, behind authentication. They are the user's private research infrastructure.

**Future consideration (separate feature, separate name):** There is value in having public curated topic pages — editorial-quality collections of markets around a theme. But this is a different product with a different name, not "Fields." Fields = private workspace. The public editorial concept needs its own identity and design process.

---

## 11. Implementation Status

As of 2026-03-31:
- Fields was built (`FieldsHome.tsx`, `FieldDetail.tsx`, `MeetingView.tsx`, `fieldTypes.ts`, `fieldStorage.ts`)
- BUT it was wired as public routes (`/fields`, `/field/:id`) in the nav header
- This is wrong — it should be inside the authenticated dashboard
- localStorage is used for persistence (placeholder, not production)
- The concept is sound but the implementation placement is incorrect

**Next step:** Fold Fields back into the dashboard as an authenticated workspace feature, remove from public nav.

---

## 12. Open Questions (for future refinement)

- How does onboarding work? (Define first field → add sources → attach agents → first meeting?)
- What are the agent permission levels? (Can agents trade without approval? Propose only?)
- How do meetings get triggered? (Scheduled? On-demand? Event-driven?)
- What's the minimum viable field? (Just a thesis + one agent + one source?)
- How does the connected agent integration actually work? (Protocol? API? Nostr-based?)
- What happens when a field is "concluded"? (Archive? P&L summary? Lessons learned?)
