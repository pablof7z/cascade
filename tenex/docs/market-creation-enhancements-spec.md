# Market Creation Enhancements — Locked Specification

> Comprehensive spec for 4 market creation flow enhancements: module support, Tiptap editor, capital requirements, draft markets view

**Tags:** #market-creation #enhancements #spec #data-model #ui-components

---

# Market Creation Enhancements — Locked Specification

**Date**: 2026-03-29  
**Status**: LOCKED — Ready for Execution Phase  
**Owner**: Architect-Orchestrator  
**Branch**: feature/market-creation-enhancements

---

## 1. Data Model Changes

### Market Type Extension

```typescript
// src/market.ts

type GameType = 'thesis' | 'module'

type MarketStatus = 'draft' | 'live'

interface Market {
  // ... existing fields
  id: string
  title: string
  description: string
  creatorPubkey: string
  createdAt: number
  
  // NEW FIELDS
  gameType: GameType                    // 'thesis' (infinite) or 'module' (finite)
  status: MarketStatus                  // 'draft' (not live) or 'live' (published)
  initialCapitalDeposit: number         // USD equivalent, minimum > 0 to launch
  
  // Thesis-specific (optional if gameType === 'thesis')
  caseContent?: string                  // Rich markdown from Tiptap editor
  
  // Module-specific (optional if gameType === 'module')
  moduleResolutionDate?: number         // Unix timestamp when module resolves
  moduleOutcomes?: string[]             // Predefined outcomes for module
}
```

### ParticipantBook Keying

**Existing (remains unchanged)**:
```typescript
type ParticipantBook = Record<string, ParticipantAccount>
// Key = pubkey, Value = ParticipantAccount with positions, balance, etc.
```

No changes needed — pubkey keying already supports the new game types.

### Draft Status Rules

- **Draft market**: `status === 'draft'` AND `initialCapitalDeposit === 0` (creator hasn't deposited yet)
- **Live market**: `status === 'live'` AND `initialCapitalDeposit > 0` (creator has deposited capital)
- A market **cannot transition to 'live'** unless `initialCapitalDeposit > 0`

---

## 2. Creation Flow Architecture

### Step-by-Step Flow (Both Thesis & Module)

```
START: "Create Market" button clicked
  ↓
[STEP 1] Game Type Selection
  ├─ Radio/Button: "Thesis (Infinite Debate)"
  └─ Radio/Button: "Module (Finite Market)"
  ↓
[STEP 2] Market Basics
  ├─ Title (text input)
  ├─ Description (short textarea, ~2-3 lines)
  └─ [Continue] button
  ↓
[STEP 3] Type-Specific Content
  ├─ IF Thesis:
  │   ├─ Case Content (Tiptap editor — bold, italic, links, lists, headings)
  │   └─ [Continue] button
  │
  └─ IF Module:
      ├─ Resolution Date (date picker)
      ├─ Possible Outcomes (comma-separated or add-buttons)
      └─ [Continue] button
  ↓
[STEP 4] Initial Capital Deposit
  ├─ "Deposit Amount" (USD input)
  ├─ Validation: amount > 0, <= wallet balance
  ├─ [Save as Draft] button (skips deposit, market status = 'draft')
  └─ [Launch & Deposit] button (creates market with status = 'live')
  ↓
IF [Launch & Deposit]:
  ├─ Process deposit transaction (NIP-60)
  ├─ Set status = 'live', initialCapitalDeposit = <amount>
  └─ Redirect to market detail page
END

IF [Save as Draft]:
  ├─ Set status = 'draft', initialCapitalDeposit = 0
  ├─ Save to markets state
  └─ Redirect to "My Drafts" view with success message
END
```

### Tiptap Integration Points

- **Thesis-only**: Step 3, "Case Content" field
- **Module**: No Tiptap (module just has outcomes, not case content)
- **Rendering**: On market detail page, render `caseContent` as markdown with increased font size (16px or 1.1em baseline)

### Capital Deposit Workflow

- **Minimum deposit**: $0.01 (or define minimum per Pablo's preference)
- **Validation message** (when empty/zero): "You must deposit capital to launch. To save and launch later, use 'Save as Draft'."
- **Success message** (after launch): "Market launched with ${amount} initial capital."
- **Draft message** (after save): "Market saved as draft. Resume editing anytime from 'My Drafts'."

---

## 3. Component Structure

### New Components

1. **GameTypeSelector** (`src/components/GameTypeSelector.tsx`)
   - Radio/button group for 'Thesis' vs 'Module'
   - Returns selected `GameType`

2. **TiptapEditor** (`src/components/TiptapEditor.tsx`)
   - Wrapper around Tiptap instance
   - Toolbar with: bold, italic, link, bullet list, ordered list, h1–h3
   - Returns HTML string (convert to markdown on save)
   - Props: `value: string`, `onChange: (val: string) => void`

3. **InitialCapitalInput** (`src/components/InitialCapitalInput.tsx`)
   - USD input field
   - Validation against wallet balance
   - Returns numeric amount or null
   - Shows inline validation error if <= 0

4. **DraftMarketsList** (`src/components/DraftMarketsList.tsx`)
   - Table/list view of user's draft markets
   - Columns: Title | Game Type | Created Date | Actions
   - Actions: [Edit] [Delete] [Launch]
   - No excessive cards — Bloomberg-style rows

5. **DraftsMenuItem** (`src/components/DraftsMenuItem.tsx`)
   - Single menu item in user dropdown
   - Counts draft markets: "My Drafts (3)" or "My Drafts" if none

### Modified Components

1. **CreateMarketFlow** (or similar creation component)
   - Integrate GameTypeSelector at Step 1
   - Conditionally render Tiptap vs Module-specific fields at Step 3
   - Add "Save as Draft" button at Step 4 (alongside "Launch & Deposit")

2. **MarketDetail** (market view component)
   - Check `market.gameType`
   - If Thesis: render `caseContent` as markdown with bigger font (16px or 1.1em)
   - Display `market.status` badge (e.g., "Draft" in subtle gray, "Live" in accent color)

3. **UserMenu** (user dropdown menu)
   - Add `<DraftsMenuItem />` entry pointing to `/drafts` route
   - Only show if user has draft markets (or always show, count = 0 is ok)

### Tiptap Extensions

Install and configure:
```bash
npm install @tiptap/react @tiptap/starter-kit
```

Starter kit includes:
- **Bold** (Ctrl+B / Cmd+B)
- **Italic** (Ctrl+I / Cmd+I)
- **Heading** (H1, H2, H3)
- **BulletList** (Ctrl+Shift+8 / Cmd+Shift+8)
- **OrderedList** (Ctrl+Shift+7 / Cmd+Shift+7)
- **Link** (manual add via toolbar button)

### File Structure

```
src/
├── components/
│   ├── GameTypeSelector.tsx           [NEW]
│   ├── TiptapEditor.tsx               [NEW]
│   ├── InitialCapitalInput.tsx        [NEW]
│   ├── DraftMarketsList.tsx           [NEW]
│   ├── DraftsMenuItem.tsx             [NEW]
│   ├── CreateMarketFlow.tsx           [MODIFIED]
│   ├── MarketDetail.tsx               [MODIFIED]
│   └── UserMenu.tsx                   [MODIFIED]
├── market.ts                          [MODIFIED] — Add types
├── pages/
│   └── Drafts.tsx                     [NEW] — Route /drafts
└── styles/
    └── (any new styles for Tiptap)
```

---

## 4. User Menu & Drafts View

### Menu Integration

**UserMenu.tsx** — Add before existing menu items:
```typescript
{draftCount > 0 && (
  <MenuDivider />
)}
<MenuItem to="/drafts" label={`My Drafts (${draftCount})`} icon={<DraftIcon />} />
```

- Only show divider if drafts exist (cleaner UX)
- Badge count updates live

### Drafts View (`/drafts` route)

**Page: DraftsPage.tsx**
- Headline: "My Drafts"
- Subtext: "Resume editing, delete, or launch any of your saved markets"
- Empty state: "No draft markets yet. Create one to get started."
- Table/list view via `<DraftMarketsList />`

**DraftMarketsList Columns**:
| Title | Type | Created | Actions |
|-------|------|---------|---------|
| "Market Title" | Thesis/Module | "Mar 29" | [Edit] [Delete] [Launch] |

- **[Edit]**: Opens CreateMarketFlow in edit mode for that draft
- **[Delete]**: Soft-delete with confirmation ("This cannot be undone")
- **[Launch]**: Takes user to Step 4 (capital deposit) to complete launch

---

## 5. Microcopy & UI Language

### Creation Flow Labels

| Field | Label | Placeholder/Helper |
|-------|-------|------------------|
| Game Type (Thesis) | "Thesis (Infinite Debate)" | "A market where the debate can go on indefinitely" |
| Game Type (Module) | "Module (Finite Market)" | "A market with defined outcomes and resolution date" |
| Market Title | "Market Title" | "e.g., Will AI reach AGI by 2030?" |
| Case Content (Thesis) | "Case Content" | "Make your argument. Use bold, lists, links for clarity." |
| Resolution Date (Module) | "Resolution Date" | "When does this market resolve?" |
| Module Outcomes | "Possible Outcomes" | "List the mutually exclusive outcomes" |
| Capital Deposit | "Initial Capital" | "Minimum $0.01. Cannot be changed after launch." |

### Validation & Error Messages

| Scenario | Message |
|----------|---------|
| Empty capital field | "You must deposit capital to launch this market." |
| Capital = $0 | "Deposit amount must be greater than $0." |
| Capital > wallet balance | "Insufficient funds. Your balance is $X." |
| Empty case content (Thesis) | "Case content is required." |
| Empty resolution date (Module) | "Please select a resolution date." |

### Success & Info Messages

| Action | Message |
|--------|---------|
| Launched with capital | "Market live! Your $X initial capital is now active." |
| Saved as draft | "Draft saved. You can resume editing anytime from 'My Drafts'." |
| Deleted draft | "Draft deleted." |
| Resumed editing | "(No message — just open the edit flow)" |

### Status Badges

- **Draft**: "Draft" (gray text, subtle background)
- **Live**: "Live" (accent color, bold)

---

## 6. Implementation Sequence

### Order of Execution

1. **Data model first** (market.ts)
   - Add `gameType`, `status`, `initialCapitalDeposit` fields
   - No breaking changes to existing Market interface
   
2. **Components (isolated, no routes yet)**
   - GameTypeSelector
   - TiptapEditor (install @tiptap packages first)
   - InitialCapitalInput
   
3. **CreateMarketFlow modifications**
   - Integrate GameTypeSelector at Step 1
   - Add type-specific branching logic
   - Add capital deposit step with both buttons
   
4. **Drafts infrastructure**
   - Add `/drafts` route
   - Create DraftsPage.tsx
   - Create DraftMarketsList.tsx
   - Create DraftsMenuItem.tsx
   
5. **MarketDetail rendering**
   - Render `caseContent` with Tiptap markdown
   - Display status badge
   
6. **UserMenu integration**
   - Add DraftsMenuItem
   
7. **Testing & polish**
   - Verify flow end-to-end
   - Check Bloomberg aesthetic (no card overuse)

### Dependency Graph

```
market.ts (types) ← foundation
  ↓
GameTypeSelector ← needed by CreateMarketFlow
TiptapEditor ← needed by CreateMarketFlow
InitialCapitalInput ← needed by CreateMarketFlow
  ↓
CreateMarketFlow ← uses above components
  ↓
/drafts route + DraftsPage ← depends on updated market.ts
DraftMarketsList ← depends on /drafts route
DraftsMenuItem ← depends on DraftMarketsList
  ↓
MarketDetail ← updated to render caseContent
UserMenu ← updated to include DraftsMenuItem
```

---

## 7. Design Constraints (Verified)

✓ **No card overuse** — DraftMarketsList is a simple table, not a grid of cards  
✓ **Bloomberg/newspaper aesthetic** — Information-dense rows, minimal decoration  
✓ **Microcopy ready for growth agent review** — All labels, messages, and helper text listed in Section 5  

---

## Success Criteria

1. ✓ User can choose between Thesis and Module at creation start
2. ✓ Thesis markets have Tiptap editor for case content
3. ✓ Markets cannot launch without `initialCapitalDeposit > 0`
4. ✓ Users can save markets as drafts (status = 'draft', capital = 0)
5. ✓ "My Drafts" view shows all user's draft markets
6. ✓ Draft markets can be resumed, edited, and launched
7. ✓ MarketDetail renders case content as markdown with bigger font
8. ✓ No console errors; clean build
9. ✓ Bloomberg aesthetic verified (no card overuse)
10. ✓ Code passes clean-code-nazi review

---

## Next Step

Once growth agent reviews and approves microcopy (Section 5), execution-coordinator will delegate implementation to claude-code.