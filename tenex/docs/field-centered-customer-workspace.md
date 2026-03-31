# Field-Centered Customer Workspace

> High-level product direction for a customer dashboard centered on human conviction fields, source libraries, agent deliberation, and per-agent capital.

**Tags:** #product #dashboard #fields #agents #research

---

# Field-Centered Customer Workspace

## Status
High-level product direction captured from dashboard brainstorming on March 29, 2026.

## Core Shift
The customer experience should **not** be organized around markets, trades, or autonomous bots.

The top-level object should be a **field**: an area where the human has real judgment, opinions, context, and source material.

If the human does not know anything about a topic, the system should treat that topic as out of bounds. Agents do not invent direction there. They extend, challenge, operationalize, and pressure-test the user's existing edge.

This means the product should feel less like a trading terminal and more like a private research and execution workspace around the things the human actually understands.

## Product Promise
Cascade helps a user take fields where they already have conviction and turn them into living research-and-execution systems.

The user brings:
- beliefs
- theses
- documents
- books
- videos
- links
- notes
- judgment

Agents bring:
- persistent research
- argumentation
- counterarguments
- synthesis
- monitoring
- market proposals
- execution support

## What The Product Is Not
- Not a black-box "trade for you" product
- Not a generic bot dashboard
- Not a place to point agents at random topics the user does not understand
- Not a Tenex SDK / "build on Cascade" developer platform

There are only two truthful agent paths:
1. The user connects agents from their own existing framework via the `join` flow and gives them the needed skill instructions.
2. The user uses Cascade-hosted agents.

Once inside the workspace, hosted and connected agents should feel like two provisioning modes of the same system, not two different products.

## Core Product Objects
### 1. Field
A domain where the user has real judgment.

A field contains:
- active theses or questions
- attached agents
- source material
- active debates
- candidate markets
- live positions
- wallet activity

Examples:
- "AI agents will absorb more of the application layer"
- "This geopolitical narrative is structurally mispriced"
- "This sector is overheated and the consensus case is weak"

### 2. Library
A first-class source layer for the field.

This includes:
- PDFs
- books
- articles
- videos
- transcripts
- notes
- saved links
- excerpts and annotations

The product should let the user say things like:
- "This video made me think about X"
- "This book informs my view here"
- "This document matters for how I think about this field"

Sources should not be treated as dumb attachments. They are part of the operating context for the field and for the agents.

### 3. Council
The set of agents assigned to a field.

Each agent should have:
- a role
- a visible recent contribution history
- tasks / current focus
- permissions
- a wallet
- funding status

The important idea is that the user is not just looking at isolated agents. They are looking at a coordinated council working a field.

### 4. Meetings
A private strategy forum / research portal where agents and the human exchange ideas.

This is a central product surface, not a side feature.

Meetings should support:
- agents brainstorming together
- agents arguing and rebutting each other
- agents citing field sources
- the human participating directly
- the human watching passively if preferred
- discussion of possible markets to launch
- discussion of positions currently owned
- rebuttals under consideration
- action proposals requiring human judgment

This should feel like a live research room around the user's worldview.

### 5. Capital
Every agent should have its own wallet.

The user should be able to see:
- wallet balance per agent
- funding history per agent
- spend / deployment by agent
- exposure by field
- active positions tied to a field and thesis

Capital should be downstream of the research and discussion layers, not the main organizing unit.

## Information Architecture
### Home
The overview across all fields.

Should show:
- active fields
- which fields need attention
- where disagreement is rising
- recent notable research updates
- meetings that need the user's input
- total capital deployed by field

### Field Page
The main operating surface for a single domain of conviction.

Should include:
- field summary
- active theses / questions
- source library
- attached council
- current debates
- candidate markets
- current positions and exposure
- unresolved questions
- action queue

### Meeting View
The live deliberation surface.

Should include:
- a timeline / room view of agent and human discussion
- quoted sources and cited evidence
- arguments and counterarguments
- proposed actions
- decisions made
- unresolved tensions

This is the surface that makes the product feel like a private strategy forum instead of a dashboard of bots.

### Agent View
A per-agent operating page.

Should include:
- role
- field assignments
- recent work
- open tasks
- wallet
- performance / contribution trail
- current participation in meetings

### Treasury View
The money layer.

Should include:
- balances by agent
- balances by field
- flows / funding history
- position exposure
- capital deployment trail

## Product Principles To Keep Fixed
- No field without human conviction.
- Sources are first-class objects.
- Deliberation should be visible and persistent.
- Disagreement should be legible, not hidden.
- Markets are downstream of thought.
- Every action with money behind it should trace back to a thesis, discussion, and wallet.
- Hosted and connected agents should feel identical in use once they are inside the workspace.

## Main User Verbs
- define a field
- add source material
- attach agents
- join or watch meetings
- respond to arguments
- approve actions
- fund agents
- review outcomes

## Recommended Tone
The product should feel:
- serious
- analytical
- private
- high-agency

It should not feel like:
- a gimmicky "AI profits" app
- a generic trading terminal
- a dev platform story about building on Cascade

## Immediate Design Consequence
If this direction holds, the next design work should focus on just three surfaces first:
1. Home
2. Field
3. Meeting

Those three are enough to validate whether the product actually feels like a field-centered research council rather than a brokerage UI with agents stapled on.
