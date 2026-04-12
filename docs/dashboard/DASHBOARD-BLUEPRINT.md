# Cascade Dashboard — Complete Experience Blueprint

*The full information architecture for the hosted agents workspace.*
*Created: 2026-03-31*
*Major revision: 2026-03-31 — Strong Opinions model*

---

## Design Philosophy

This is NOT a dashboard. It's not even a workspace in the traditional sense. It's the place where a user's **strong opinions meet agent-powered research and execution**.

The user comes here with contrarian, unpopular, deeply held views about the world. The system shows them what the consensus thinks. They push back. Agents take that push and run with it — researching, debating, finding evidence, identifying markets, proposing positions. The user returns to find their agents mid-work and provides direction.

**The emotional arc:**
1. "Here's what the world thinks about this topic"
2. "Here's where I think they're wrong" (the strong opinion)
3. "My agents are researching, debating, and building positions around my edge"
4. "I come back, see what they found, and steer"

**The emotional question when the user opens this:** "What have my agents found? Where were they right? Where do I need to redirect?"

---

## Navigation Model

### Top-level: Sidebar (persistent, left)
The workspace uses a **left sidebar** — not tabs in the header. The main site header remains for public Cascade (Markets, etc.), but once inside `/dashboard`, the sidebar owns navigation.

```
┌─────────────────────────────────────────────┐
│ [Cascade logo]              [user avatar] ▾  │
├────────────┬────────────────────────────────┤
│            │                                │
│  WORKSPACE │   [Main content area]          │
│            │                                │
│  Overview  │                                │
│  Fields    │                                │
│  Agents    │                                │
│  Treasury  │                                │
│            │                                │
│ ────────── │                                │
│            │                                │
│  Activity  │                                │
│  Settings  │                                │
│            │                                │
│            │                                │
│ ────────── │                                │
│ + New Field│                                │
│            │                                │
└────────────┴────────────────────────────────┘
```

### Sidebar sections:
All items are ALWAYS visible. No progressive disclosure. Even before the user has created anything, every section should give a taste of what it will feel like with real data — use mock/preview content, not disabled states or "coming soon" placeholders.

1. **Overview** — the home when entering the workspace
2. **Fields** — list of all fields, entry point to field detail
3. **Agents** — all agents across all fields
4. **Treasury** — capital overview across all agents and fields
5. *separator*
6. **Activity** — chronological feed of everything happening
7. **Settings** — workspace preferences, connected agent config
8. *separator*
9. **+ New Field** — primary creation action, always visible

---

## Screen-by-Screen Specification

### 1. Overview (`/dashboard`)

**Purpose:** Answer "What have my agents found? Where do I need to weigh in?"

**Layout:**

```
┌──────────────────────────────────────────┐
│ Your agents worked overnight.            │
│                                          │
│ ┌─ NEEDS YOUR INPUT ──────────────────┐  │
│ │ • AI Regulation: Analyst found       │  │
│ │   counter-evidence to your thesis    │  │
│ │ • Midterms: 2 position proposals     │  │
│ │   awaiting approval                  │  │
│ └──────────────────────────────────────┘  │
│                                          │
│ ┌─ YOUR FIELDS ───────────────────────┐  │
│ │ [AI Regulation]  [Midterms]  [DeFi] │  │
│ │  3 agents         2 agents   1 agent │  │
│ │  $1,240 deployed  $890       $320    │  │
│ │  "Agents are pushing    "New data    │  │
│ │   back on your take      confirms    │  │
│ │   on EU timeline"        your read"  │  │
│ └──────────────────────────────────────┘  │
│                                          │
│ ┌─ RECENT ACTIVITY ───────────────────┐  │
│ │ 10m ago: Analyst cited new EU draft  │  │
│ │ 1h ago: Scout found Vance interview  │  │
│ │ 3h ago: Position opened: YES on S.42 │  │
│ └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Content:**
- **"Your agents worked overnight"** — morning-style summary. What happened while you were away. Not a greeting — a status report.
- **Needs Your Input** — items requiring the human's direction: proposals to approve, counter-evidence to respond to, questions agents are stuck on. This is the action queue. If empty, it disappears.
- **Your Fields** — compact cards for each active field. Each card includes a short agent-generated status line that relates back to the user's strong opinions ("agents are pushing back on your take on X" or "new data confirms your read on Y"). Not just stats — context about where things stand relative to what the user said.
- **Recent Activity** — last ~10 events across all fields. Agent actions tied to deliberation, not generic system events.

**What this is NOT:**
- Not a P&L chart
- Not a portfolio summary
- Not a "good morning" greeting card
- It's a briefing. "Here's what your team found while you were gone."

---

### 2. Fields List (`/dashboard/fields`)

**Purpose:** Browse and manage all fields.

**Layout:**

```
┌──────────────────────────────────────────┐
│ Fields                      [+ New Field]│
│                                          │
│ ┌─ ACTIVE ─────────────────────────────┐ │
│ │                                      │ │
│ │ AI Regulation                active  │ │
│ │ "Regulation accelerates post-2026    │ │
│ │  elections, creating moats for..."    │ │
│ │ 3 agents · 4 markets · $1,240       │ │
│ │ Last meeting: 2h ago                 │ │
│ │                                      │ │
│ │ 2026 US Midterms             active  │ │
│ │ "Republican Senate gains stall at    │ │
│ │  2 seats due to suburban backlash"   │ │
│ │ 2 agents · 2 markets · $890         │ │
│ │ Meeting in progress                  │ │
│ │                                      │ │
│ ├─ DRAFT ──────────────────────────────┤ │
│ │                                      │ │
│ │ DeFi Yield Compression       draft   │ │
│ │ "Working on thesis..."               │ │
│ │ 0 agents · 0 markets                 │ │
│ │                                      │ │
│ ├─ CONCLUDED ──────────────────────────┤ │
│ │                                      │ │
│ │ (collapsed by default)               │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Content:**
- Grouped by status: Active → Draft → Concluded
- Each row: field name, status badge, conviction statement (truncated), agent count, market count, capital deployed, last activity indicator
- Concluded fields collapsed by default — expandable
- Primary action: `+ New Field` button

**Behavior:**
- Click field → goes to Field Detail
- Click `+ New Field` → field creation flow

---

### 3. Field Detail (`/dashboard/field/:id`)

**Purpose:** Deep dive into a single field. This is where the user spends most of their time.

**Layout:** Tabbed interface within the field.

```
┌──────────────────────────────────────────┐
│ ← Fields                                │
│                                          │
│ AI Regulation                    active  │
│ "Regulation accelerates post-2026        │
│  elections, creating compliance moats    │
│  for incumbents"                         │
│                                          │
│ 3 agents · 4 markets · $1,240 deployed   │
│                                          │
│ [Meeting] [Positions] [Library] [Council]│
│ ─────────────────────────────────────────│
│                                          │
│  (tab content below)                     │
│                                          │
└──────────────────────────────────────────┘
```

**Header (always visible):**
- Back link to fields list
- Field name + status badge
- Conviction statement (full)
- Summary stats: agent count, market count, capital

**Tabs:**

#### 3a. Meeting (default tab)
The center of gravity. This is where agents deliberate.

- Persistent thread of meeting entries — agents arguing, citing sources, proposing actions
- Each entry shows: agent name, timestamp, content, cited sources (if any)
- Human can type directly into the thread
- Action items / proposals are visually distinct (highlighted, with approve/reject buttons)
- "Start New Meeting" button if no active meeting
- Meeting history accessible (previous meetings collapsed below)

#### 3b. Positions
Active market positions tied to this field.

- Each position: market name, direction (yes/no), size, current price, P&L, which agent proposed it, link to the deliberation that led to it
- Candidate markets (proposed but not yet acted on) shown separately
- Every position traces back to a reason — this is the key differentiator

#### 3c. Library
Source materials informing this field.

- List of sources: title, type (article/book/video/note), date added, relevance note
- Each source is a first-class object, not an attachment
- "Add Source" button — drop a URL, upload a file, or write a note
- Sources can be referenced in meetings (agents cite them)

#### 3d. Council
Agents assigned to this field.

- Each agent: name, role, type (hosted/connected), status, wallet balance, contribution count
- "Hire Agent" or "Connect Agent" action
- Per-agent: recent contributions, last active, ability to remove from field

---

### 4. Agents (`/dashboard/agents`)

**Purpose:** Cross-field view of all agents the user has.

**Layout:**

```
┌──────────────────────────────────────────┐
│ Agents                     [Hire Agent]  │
│                                          │
│ 5 agents · 3 active · $2,450 deployed   │
│                                          │
│ ┌────────────────────────────────────┐   │
│ │ Research Analyst         hosted    │   │
│ │ Fields: AI Regulation, Midterms    │   │
│ │ Active · $820 balance · 14 contribs│   │
│ │                    [View] [Manage] │   │
│ │                                    │   │
│ │ Devil's Advocate         hosted    │   │
│ │ Fields: AI Regulation              │   │
│ │ Active · $420 balance · 8 contribs │   │
│ │                    [View] [Manage] │   │
│ │                                    │   │
│ │ My Custom Agent       connected    │   │
│ │ Fields: DeFi                       │   │
│ │ Idle · $320 balance · 3 contribs   │   │
│ │                    [View] [Manage] │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

**Content:**
- Summary stats: total agents, active count, total capital
- Agent list: name, type badge, field assignments, status, wallet balance, contribution count
- Actions: View (detail page), Manage (field assignments, permissions)
- "Hire Agent" links to `/hire-agents`

---

### 5. Agent Detail (`/dashboard/agent/:id`)

**Purpose:** Everything about one agent.

**Content:**
- **Identity:** Name, role, type (hosted/connected), avatar
- **Field Assignments:** Which fields they're on, with links
- **Wallet:** Balance, transaction history, capital allocation
- **Contributions:** Recent meeting entries, proposals, market actions — across all fields
- **Operating model:** Agent acts autonomously inside the workspace and may escalate to the user when it decides escalation is useful
- **Status:** Active/idle/offline, last active timestamp

---

### 6. Treasury (`/dashboard/treasury`)

**Purpose:** "Where is my money and what's it doing?"

**Content:**
- **Total Capital:** Aggregate across all agent wallets
- **By Field:** Capital deployed per field, with exposure breakdown
- **By Agent:** Wallet balances per agent
- **Positions:** All open positions across all fields, with P&L
- **Flow:** Recent deposits, withdrawals, trades — chronological

**Preview/empty state:** Show the full treasury layout with mock data — a realistic example of what this looks like with 3 fields, 5 agents, and several positions. The user should immediately understand what this page will feel like when they're using it. Subtle indicator that this is preview data ("Sample data — fund your first agent to get started").

**What this is NOT:**
- Not a chart-first trading view
- Not a P&L leaderboard
- It's a transparency tool. "Where did every dollar go, and why?"

---

### 7. Activity Feed (`/dashboard/activity`)

**Purpose:** Chronological stream of everything happening across the workspace.

**Content:**
- All agent actions: meeting entries, proposals, market actions, source additions
- Human actions: approvals, field creation, source drops
- System events: agent status changes, meeting starts/ends
- Filterable by: field, agent, action type
- Each entry links to its context (the meeting, the field, the position)

**Preview/empty state:** Show a realistic mock activity feed — what a typical day looks like with agents working across fields. Meeting entries, source discoveries, proposals, position actions. The user should see the texture of daily agent activity before they've generated any. Subtle indicator: "Sample activity — create your first field to start."

---

### 8. Settings (`/dashboard/settings`)

**Purpose:** Workspace configuration.

**Content:**
- **Connected Agents:** Manage external agent connections
- **Agent Defaults:** Default scopes, limits, and operating defaults for new agents
- **Notifications:** What triggers alerts (proposals, meetings, threshold breaches)
- **Wallet Management:** Fund agent wallets, set limits

**Preview/empty state:** All settings sections visible with sensible defaults pre-filled. Nothing is hidden or locked. The user can see what's configurable even before they have agents or capital deployed.

---

## User Flows

### Flow 1: New User — First Field Creation
```
Sign up / Log in
  → Dashboard Overview with demo field showing agents mid-deliberation
  → User clicks "+ New Field"
  → Step 1: Names a topic ("2026 midterms") — 2-4 words
  → Step 2: System generates situational briefing
      (consensus odds, active chatter, key narratives, relevant markets)
  → Step 3: User records strong opinions — audio preferred, text accepted
      ("I think everyone's wrong about the red wave because...")
  → Agents auto-assigned (starter council)
  → First meeting starts immediately, informed by user's opinions + briefing
  → User lands on Field Detail → Meeting tab, agents already working
```

### Flow 2: Daily Check-in
```
Open Dashboard
  → Overview: "Your agents worked overnight" summary
  → See what needs attention (proposals, new evidence, pushback)
  → Click into field
  → Review meeting thread — see where agents went
  → Provide direction: reinforce, redirect, shut down, add nuance
  → Approve/reject any proposed positions
  → Optionally drop new sources or record additional strong opinions
  → Back to overview
```

### Flow 3: New Strong Opinion (adding to existing field)
```
Field Detail → record new input (audio/text)
  → "I just read X and it changes my thinking on Y"
  → Agents integrate as ground truth
  → Meeting thread responds — research adjusts, positions recalibrated
```

### Flow 4: New Field from Expansion
```
Agents surface: "Related thesis worth exploring"
  → User clicks through
  → Pre-populated briefing on related topic
  → User records strong opinions
  → New field created, agents assigned
```

### Flow 5: Capital Deployment
```
Agent proposes a market position in a meeting
  → Proposal rendered distinctly (not chat — action card with reasoning chain)
  → User sees: strong opinion → agent research → evidence → proposed position
  → Approves with optional capital limit
  → Position opened, tracked in Positions tab and Treasury
  → Every position traces back to a strong opinion
```

---

## Empty States

Every page needs a meaningful empty state that drives toward the next action. No blank pages, no "coming soon."

- **Overview (no fields):** Demo field showing agents mid-deliberation on a real topic. CTA: "Want your own? Tell us what you know." → `+ New Field`
- **Field detail (no agents):** "This field needs a council. Hire agents to start researching your opinions." → `Hire Agent`
- **Field detail (no sources):** "No source material yet. Drop articles, links, or notes — or let your agents find their own." → `Add Source`
- **Meeting (no entries):** "Record your strong opinions to kick off the first meeting." → `Record`
- **Treasury (no capital):** Preview of what treasury will look like with mock data. "Fund an agent wallet to start deploying." → `Fund Wallet`
- **Activity (no events):** Preview with mock activity entries showing what a typical day looks like. "Create your first field to start generating activity."
- **Settings:** All options visible with current defaults, even if nothing is configured yet.

---

## What Changes from Current Implementation

| Current State | Target State |
|---|---|
| FieldsHome looks like a landing page with hero sections | Fields list is a clean workspace list — no marketing copy |
| FieldDetail has mixed landing-page / app feel | FieldDetail is a tabbed workspace view (Meeting, Positions, Library, Council) |
| Meeting view is a standalone page | Meeting is the default tab within FieldDetail |
| No Overview page | Overview is the dashboard home with attention queue |
| Agents page is a flat list | Agents page has summary stats + links to agent detail |
| No Treasury view | Treasury shows capital flow across fields and agents |
| No Activity feed | Activity feed is a chronological stream of all workspace events |
| No empty states | Every page has a purposeful empty state |
| Nav header switches modes | Sidebar owns workspace navigation, header stays out of it |

---

## Design Constraints (from AGENTS.md)

- Dark theme on `neutral-950`
- No rounded pills, no background-fill toggles, no emojis in UI chrome
- Tabs: underline style (see `MarketTabsShell.tsx`)
- Colors: `neutral-800/900/950` backgrounds, `white/neutral-300/400/500` text, `emerald` positive, `rose` negative
- Typography: `text-sm font-medium` interactive, `text-xs` metadata
- Borders: sparingly, `neutral-700/800`
- Professional, minimalist — this is a workspace, not a consumer app
