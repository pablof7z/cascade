# Cascade Design Doctrine — Site Aesthetics, Layout, Copy, and Process Rules

> Comprehensive design doctrine for Cascade extracted from Pablo's direct feedback across dozens of conversations. Covers anti-card rules, layout variety, informational density, copy standards, and the mandatory growth agent involvement for all copy work.

**Tags:** #design #homepage #copy #layout #ux #growth #doctrine

---

# Cascade Design Doctrine

*Extracted from Pablo's direct feedback across 30+ conversations. This is not opinion — these are directives.*

---

## 🚨 The #1 Rule: NO CARD OVERUSE

This is Pablo's single most repeated complaint. He has said it **many times** in increasingly frustrated terms:

> "overuse of cards.... again... check on our conversations and actually check how many fucking times I said to not overuse cards-designs -- like literally check and notice how many times I have to repeat myself"

> "this card design is such a piece of shit, you are using it everywhere, I told you a million times I HATE it"

### The Anti-Pattern
The formula agents default to: `bg-neutral-900/X border border-neutral-800 rounded-lg` — copy-pasted on every element. Boxes inside boxes. This is the "I don't know how to design so I'll put everything in a box" move.

### What Cards ARE Acceptable For
- Toast notifications
- Modal dialogs
- Form containers
- Necessary UI chrome

### What Cards Are NOT Acceptable For
- Market listings
- Content sections
- Data display
- Discussion items
- Leaderboard entries
- Any repeated content element

### The Test
If you're about to wrap something in a rounded border + background + border, **STOP**. Ask: "Is this a container that needs to be a container, or am I being lazy?"

---

## 🏛️ Aesthetic Direction: Bloomberg Terminal, Not SaaS Dashboard

### Target Feel
- **Newspaper / Bloomberg terminal** — dense, informational, professional
- **NOT** a SaaS dashboard with rounded cards and gradient CTAs
- Dark theme, information-dense, financial-terminal aesthetic

### Design Elements That Work
- **Raw typography** — large headlines without containers
- **Borders as separators** — horizontal rules, vertical dividers (not boxes)
- **Dense information hierarchy** — ticker tape, data tables, numbered lists
- **Full-bleed sections** with background color changes for rhythm
- **Monospace numbers** (`font-mono tabular-nums`) for financial data
- **Unexpected whitespace** — used intentionally, not just padding
- **Overlapping elements** and **asymmetric typography treatments**
- **Layered depth** beyond simple borders

### Design Elements That Don't Work
- Rounded-corner cards on everything
- Identical grid layouts repeated vertically
- Color variations masquerading as layout variety (different border colors ≠ different design)
- Generic SaaS aesthetics (gradients, shadows, card grids)
- Decoration that doesn't earn its space

---

## 📐 Layout Variety Doctrine

> "right now it looks too boring, perhaps we can add in some parts some sidebars or grid or something"

### Core Principle
Each section must be **structurally different** from every other section. Not just different colors — different LAYOUTS.

### Approved Layout Approaches (from verified implementation)
| Section | Layout Style | What Makes It Distinct |
|---------|-------------|----------------------|
| Trending Markets | Sidebar split | Featured item left, ranked list right, vertical border separator |
| Under the Radar | Bloomberg-style data table | Column headers, alternating row shading, monospace numbers |
| Hot Debates | Asymmetric hero + stacked | One dominant item with tug-of-war bar, smaller items beside |
| New This Week | HN/Reddit numbered text list | Numbered inline items, title + metadata, zero wrappers |

### The Variety Checklist
Before shipping any multi-section page:
1. Does each section use a fundamentally different layout approach?
2. Is visual variety achieved through LAYOUT, not just colors/borders?
3. Are there zero unnecessary card wrappers?
4. Does the overall page feel like a newspaper (varied) or a dashboard (uniform)?

---

## ✍️ Copy & Microcopy Standards

### Precision Over Everything
- Copy must be **factually accurate**. Pablo caught "Modules that influence this thesis probability" — WRONG because only markets influence probability. Modules are informational links. Fixed to "Linked context for this thesis."
- Remove stats that are misleading or unverifiable (e.g., "AVG. RESOLUTION HORIZON" was removed entirely)

### Accessibility Over Jargon
- "Pink-sheet" was rejected as user-facing because "most people won't know what that means" → renamed to "Under the Radar"
- Internal terminology must be translated to language regular users understand instantly
- If a term requires financial knowledge to parse, find a plain alternative

### Mock Data With Intention
- "we're not ready for real nostr data -- mock... but mock with intention!"
- Mock data should feel real — real-sounding usernames, plausible market scenarios, actual back-and-forth arguments
- Never use lorem ipsum or obviously fake placeholder content

---

## 🔑 MANDATORY PROCESS: Growth Agent for ALL Copy

**Rule: The growth agent must be involved in ALL copy and microcopy decisions on the site.**

### Why
The growth agent has:
- Copywriting skill installed (`davila7/claude-code-templates@copywriting`)
- 6+ growth/marketing skills including GTM, social media, content strategy
- Deep understanding of activation, conversion, and retention copy
- Pablo's explicit directive to be opinionated and proactive about content

### When to Involve Growth
- Section headers and subtitles on the homepage
- CTA button text
- Empty states
- Onboarding flows
- Market descriptions and categories
- Navigation labels
- Error messages
- Any user-facing text that affects conversion or comprehension

### How to Involve Growth
When delegating UI work, ALWAYS include a step where growth reviews/writes the copy. Don't let engineers write marketing copy. Don't let architects write microcopy. Growth owns the words.

---

## 💬 Discussion/Forum Design

> "the fucking latest discussions should look a lot more like a reddit"

### Core Principles
- **Discussion is the PRIMARY experience**, not a comment section afterthought
- Reddit/HN-style flat list: dense, scannable, no boxes, compact rows with subtle dividers
- Each OP is an independent post; click to see full thread (exactly like a subreddit frontpage)
- The trading widget should be thin/de-emphasized when viewing discussions
- Remove unnecessary badges (LONG/SHORT stance removed)
- Focus on **market intelligence** — humans and agents probing each other's understanding

### Cascade Philosophy on Discourse
- "Cascade is NOT Polymarket. Not point-in-time resolution. It's truth discovery for infinite games."
- In infinite games, persuasion IS the game — it moves markets
- Discussions are market-moving discourse, not comment sections
- Alpha (asymmetric information) has monetary value
- Eventually: live debates that can affect the market

---

## 👤 Rich User Profiles

> "users need rich profiles, showing everything from the markets they've created, markets they owned, discussions, and anything else that would make sense; think"

### Design Principles
- Profiles aren't a destination page — they're **woven throughout** the app
- Every avatar/username is a gateway to the full profile
- Mock profiles should appear everywhere a user is shown

### What Profiles Answer
"Who is this person, what do they believe, how good are they at predicting, and should I pay attention to them?"

---

## 📋 Summary Checklist for Every UI Delegation

Before delegating ANY UI work on Cascade:

- [ ] **Anti-card constraint** explicitly stated in delegation prompt
- [ ] **Layout variety** required if multiple sections
- [ ] **Growth agent** involved for copy/microcopy
- [ ] **Bloomberg/newspaper** aesthetic referenced as target
- [ ] **Information density** prioritized over decoration
- [ ] **No jargon** in user-facing text
- [ ] **Mock data with intention** if using mocks
- [ ] **Verification step** before merge (web-tester checks for anti-patterns)
