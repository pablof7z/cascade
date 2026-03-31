# Cascade Dashboard — Complete Experience Blueprint

*The full information architecture for the hosted agents workspace.*
*Created: 2026-03-31*

---

## Design Philosophy

This is a **workspace**, not a dashboard. The word "dashboard" implies passive monitoring — charts, graphs, status lights. This is where a user *works*. They define conviction, staff it with agents, watch deliberation happen, and approve actions. The experience should feel like running a small research firm, not checking a trading portfolio.

**The emotional question when the user opens this:** "What's happening in my fields? Where do I need to weigh in? What are my agents doing?"

---

## Growth-Informed Design Decisions

### Onboarding: Show Value Before Asking For Input
New users must NOT land on an empty dashboard. The first experience is a **pre-populated demo field** with agents mid-deliberation on a real topic. The user watches agents argue, cite sources, and propose positions — THEN gets prompted to create their own field. Time-to-aha target: under 60 seconds.

Flow: Sign up → Demo field running live → User watches → "Want your own?" → Pick a topic (templates/suggestions, not blank essay) → Starter agents auto-assigned → First meeting starts (pre-seeded with auto-gathered sources).

### Progressive Sidebar Disclosure
Day-one users see: **Overview** and **Fields** only. Treasury, Activity, Agents, Settings appear as the user reaches stages where they matter (first capital deployment, first meeting, first agent hire, etc.).

### Meeting ≠ Chat
The Meeting tab must look like a **deliberation/boardroom transcript**, NOT a chatbot UI. Multiple agents with distinct visual identities, disagreement highlighted, source citations prominent. When an agent proposes a position with real money, that entry looks dramatically different from discussion. This is the key differentiator from ChatGPT/Claude.

### Retention: The Product Must Feel Alive
- **"Your agents worked overnight"** — morning summary of what happened while user slept
- **"Needs Attention" queue** — action items requiring human input
- **"You were right" moments** — surface when real-world events confirm the user's thesis
- **Expansion suggestions** — "Your agents found a related thesis worth exploring"

### Future: Social/Sharing Layer
Not in v1, but designed-for: ability to share conviction statements, meeting moments, and positions as social cards. Without shareability, every user is a dead end (K-factor = 0).

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
1. **Overview** — the home/landing when entering the workspace
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

**Purpose:** Answer "what's happening right now across all my fields?"

**Layout:**

```
┌──────────────────────────────────────────┐
│ Good morning. 3 fields active.           │
│                                          │
│ ┌─ NEEDS ATTENTION ────────────────────┐ │
│ │ • AI Regulation: 2 pending proposals │ │
│ │ • Midterms: Meeting in progress      │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─ FIELD CARDS ────────────────────────┐ │
│ │ [AI Regulation]  [Midterms]  [DeFi] │ │
│ │  3 agents         2 agents   1 agent │ │
│ │  $1,240 deployed  $890       $320    │ │
│ │  2 open debates   1 meeting  idle    │ │
│ └──────────────────────────────────────┘ │
│                                          │
│ ┌─ RECENT ACTIVITY ───────────────────┐  │
│ │ 10m ago: Analyst proposed new market │  │
│ │ 1h ago: Scout found conflicting data │  │
│ │ 3h ago: Position opened on Polymarket│  │
│ └─────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

**Content:**
- **Needs Attention** — items requiring human input: pending market proposals, unresolved debates, approval requests. This is the action queue. If empty, it disappears (not "nothing to do" — just gone).
- **Field Cards** — compact cards for each active field showing: name, agent count, capital deployed, current state (active debate, idle, pending proposals). Clicking goes to field detail.
- **Recent Activity** — last ~10 events across all fields, chronological. Agent actions, market moves, meeting entries, proposals.

**What this is NOT:**
- Not a P&L chart
- Not a portfolio summary
- Not a leaderboard
- It's an operations view. "Here's what needs you."

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
- **Permissions:** What this agent can do (propose only? trade with approval? autonomous within limits?)
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

---

### 8. Settings (`/dashboard/settings`)

**Purpose:** Workspace configuration.

**Content:**
- **Connected Agents:** Manage external agent connections
- **Permissions:** Default permission levels for new agents
- **Notifications:** What triggers alerts (proposals, meetings, threshold breaches)
- **Wallet Management:** Fund agent wallets, set limits

---

## User Flows

### Flow 1: New User Onboarding
```
Sign up / Log in
  → Dashboard Overview (empty state)
  → Prompt: "Define your first field — what do you know?"
  → Field creation: name, conviction statement
  → Prompt: "Add some sources" (optional, skippable)
  → Prompt: "Hire your first agent" → /hire-agents
  → Agent attached to field
  → First meeting auto-starts
  → User sees agents deliberating
```

### Flow 2: Daily Check-in
```
Open Dashboard
  → Overview: see "Needs Attention" items
  → Click into field with pending proposals
  → Review meeting thread
  → Approve/reject proposals
  → Optionally add a comment to redirect deliberation
  → Back to overview — clear
```

### Flow 3: New Conviction
```
Dashboard → + New Field
  → Name it, write conviction statement
  → Add sources (articles, notes)
  → Assign agents from existing pool (or hire new ones)
  → Agents start first meeting
  → Deliberation begins
```

### Flow 4: Capital Deployment
```
Agent proposes a market position in a meeting
  → User sees proposal highlighted in meeting thread
  → Reviews reasoning and cited sources
  → Approves with optional capital limit
  → Position opened, tracked in Positions tab and Treasury
```

---

## Empty States

Every page needs a meaningful empty state that drives the user toward the next action:

- **Overview (no fields):** "You don't have any fields yet. Define your first domain of conviction." → `+ New Field`
- **Field detail (no agents):** "This field has no council. Hire an agent to start deliberating." → `Hire Agent`
- **Field detail (no sources):** "No source material yet. Drop articles, links, or notes to give your agents context." → `Add Source`
- **Meeting (no entries):** "No meetings yet. Start one to kick off deliberation." → `Start Meeting`
- **Treasury (no capital):** "No capital deployed. Fund an agent wallet to start." → `Fund Wallet`

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
