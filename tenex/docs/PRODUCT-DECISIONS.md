# Cascade Product Decisions

**Living Document** — Updated every time a new Pablo directive is identified and verified.
*Last updated: 2026-04-05 20:35 UTC*
*Status: Foundation (14 core directives + 5 pending decision areas)*

---

## TABLE OF CONTENTS

1. [Core Architecture Directives](#core-architecture)
2. [UI/UX & Style Decisions](#ui-ux-style)
3. [Feature Decisions](#features)
4. [Pending Decision Areas](#pending)
5. [Tracking & Updates](#tracking)

---

## CORE ARCHITECTURE

### 1. **Svelte Port — Total React Abandonment**
**Status:** COMMITTED & IN PROGRESS  
**Directive:** "Port to Svelte. Abandon React. I MEAN IT."  
**Source:** Conversation 6567377883a19e4d32  
**Date Given:** 2026-04-02  
**Details:**
- Complete migration from React to Svelte 5 + SvelteKit
- 5-phase incremental plan at `.tenex/plans/svelte-port.md` (1764 lines)
- Phase 0: SvelteKit setup ✅ DONE
- Phase 1: All 4 core routes ported ✅ (thread, activity, analytics, profile)
- No exceptions. React codebase to be sunset entirely.
- All streaming patterns must use SvelteKit subscriptions, not React hooks

**What This Means:**
- Every React component gets a Svelte equivalent
- No React libraries in new code
- NDK Svelte components used exclusively for Nostr integration
- Build must pass before moving to next phase

---

### 2. **Market Events — Kind 982 (Non-Replaceable)**
**Status:** IMPLEMENTED  
**Directive:** Markets MUST use kind 982 (non-replaceable) instead of kind 30000  
**Source:** Session state + code implementation  
**Date Implemented:** 2026-04-03  
**Details:**
- Market events are immutable once published
- No replacements or updates to existing market events
- Kind 982 structure required: market metadata, LMSR parameters, outcomes
- Market ID in d-tag format: follows Nostr event structure
- Old kind 30000 markets have been migrated; do not use moving forward

**Why:** Ensures market integrity. No ability to retroactively change market terms.

---

### 3. **Cashu Mint Architecture — Per-Market Token Issuance**
**Status:** ACCEPTED ARCHITECTURE (pending deployment)  
**Directive:** Keyset ID format: `{market_id}_long` / `{market_id}_short`  
**Source:** Cashu Phase 1/2 planning + mint-engineer review  
**Date:** 2026-04-05  
**Details:**
- One keyset per market (long + short)
- 2% rake on winning payouts (2000 ppk = 0.002 → 2%)
- Keyset ID derived from market ID via URL routing
- Each market's Cashu tokens are distinct and non-interchangeable across markets
- Mint handles per-market swap/mint/melt operations
- Fee structure: 2% on payout redemptions

**Implementation Notes:**
- NUT-05 Lightning integration for deposits
- Escrow account system for Cashu mint
- CDK Rust or compatible implementation
- Testnet mint ready for verification

---

## UI/UX & STYLE

### 4. **Style Guide — Editorial Authority Minimalism**
**Status:** ACTIVE STANDARD  
**Directive:** Design authority is editorial minimalism with strict color/component constraints  
**Source:** STYLE-GUIDE.md enforcement  
**Date:** Ongoing  
**Details:**
- **Theme:** Professional minimalist dark theme
- **Primary backgrounds:** `neutral-950` for page, `neutral-800`/`neutral-900` for components
- **Text colors:** `white`, `neutral-300`, `neutral-400`, `neutral-500` (progressive hierarchy)
- **Borders:** `neutral-700`/`neutral-800` only
- **Accent colors:** ONLY `emerald` (bullish/positive) and `rose` (bearish/negative)
  - No amber, blue, purple, or other accent colors without explicit approval
- **Typography:** 
  - Headings/body/UI: `font-sans` (Inter)
  - Numbers/data: `font-mono` (JetBrains Mono)
  - Interactive elements: `text-sm font-medium`
  - Metadata: `text-xs`
- **No:** Rounded pills, background-fill toggles, emojis in UI chrome, gratuitous cards/borders, stacked borders, gradients
- **Tabs:** Underline-only style (see MarketTabsShell.tsx for reference)

**Enforcement:**
- All UI code must pass style guide review before merge
- Violations detected during PR review are blocking

---

### 5. **Hero CTA Buttons — Navigation Targets**
**Status:** IMPLEMENTED  
**Directive:** Fix Hero CTAs to navigate correctly  
**Source:** Conversation 29db039d8c13da912f  
**Date:** 2026-04-05  
**Details:**
- **"Start Trading" button:** Scrolls to markets section on same page (not new route)
- **"For agents →" button:** Links to `/help` page (not `/agents` or other route)
- Both buttons verified in build; styling matches design guide

---

### 6. **Onboarding Flow — Minimal, SvelteKit-Native**
**Status:** DECISION MADE  
**Directive:** Keep minimal `/welcome` page; do NOT restore React OnboardingSplit flow  
**Source:** Conversation d9ebf96ba96f575d8a  
**Date:** 2026-04-05  
**Details:**
- React OnboardingSplit.tsx is archived in git history but NOT to be restored
- `/welcome` route implemented in Svelte (minimal entry point)
- No complex multi-step onboarding in current release
- Full onboarding to be redesigned in Svelte if needed later
- Architectural reason: Streaming patterns + full SvelteKit migration

---

## FEATURES

### 7. **Legal Pages — Full Terms & Privacy**
**Status:** SHIPPED ✅  
**Directive:** Replace placeholder legal pages with comprehensive real content  
**Source:** Conversations 67b08a2c3f46fe5290 + 3a5d1e7f88746f9a97  
**Date:** 2026-04-05  
**Details:**
- Terms of Service: Covers LMSR mechanics, Cashu/ecash risks, Nostr identity model
- Privacy Policy: Data collection, relay interactions, user sovereignty
- Both pages committed to main branch
- Plain English; legally reviewed for prediction market + Nostr + Cashu context
- Footer links to both pages site-wide

---

### 8. **Market Discussion Feature**
**Status:** IMPLEMENTED  
**Directive:** Enable market discussions via kind:1111 NIP-22 events  
**Source:** Implementation completed 2026-04-05  
**Date:** 2026-04-05  
**Details:**
- Real-time discussion tab on market detail pages
- 4 Svelte components: DiscussionThread, DiscussionInput, DiscussionItem, DiscussionHead
- Events: kind:1111 (NIP-22 compliant)
- Live relay sync; comments appear in real-time
- No mock data; all comments from Nostr relays

---

## PENDING DECISION AREAS

These are known decision areas where Pablo has initiated conversations but final direction hasn't been fully documented. **These require explicit clarification and commitment.**

### 9. **Market Funding & LMSR Redemption** ⏳
**Status:** NEEDS DECISION  
**What's Unclear:**
- How are markets initially funded? (creator-provided liquidity vs. platform?)
- What triggers market close/resolution?
- How does the mint compute payout at the closing market price?
- Who/what provides the closing price? (oracle, creator, external service?)
- How does LMSR redemption actually work in Cashu context?

**Related Conversations:**
- Conversation 6bb2e0d73e4ab87fbcbb296036d884bc2b79e16313bff3572d3a764e3711497d (Cascade Market Architecture)
- Sent via nak (4 specific questions waiting for response)

**What This Affects:** Market resolution flow, payout calculation, fee model implementation

---

### 10. **Cashu Mint Deployment — Phase 1/2** ⏳
**Status:** BLOCKED (waiting for Pablo)  
**What's Needed:**
- CDK Rust mint deployment strategy
- Vercel deployment feasibility
- Testnet vs. mainnet mint decision
- Relay restore after mint implementation
- Test harness + validation plan

**Related Conversations:**
- Conversation d2dae9ee419b1b0f7ff460f94d5fe9396c11dc15ab47f884077fa14bc2359762 (Rust LMSR Mint Deployment)
- Conversation 54d18cd2c3d7d0dc50dea61c25c157a04ea36c6053513419020bd39a7d59d374 (Deploy CDK Rust Mint)

**What This Affects:** Real Cashu functionality; market settlement with actual ecash

---

### 11. **Substack Publication** ⏳
**Status:** BLOCKED (SSL/auth issues)  
**What's Needed:**
- Substack account setup (cascadethinking.substack.com?)
- Article publication strategy
- Content calendar for growth marketing
- Newsletter subscriber base building

**Related Conversations:**
- Conversation 89ef1a6655cd1b399db0bf156245e43c69e6c2ca4f4f4773ffb6510df6cded4f (Publish Substack Article)
- Draft ready at `tenex/docs/substack-draft-2026-04-04-v2.md`

**What This Affects:** Growth/marketing channel; thought leadership positioning

---

### 12. **Domain Registration** ⏳
**Status:** NEEDS DECISION  
**What's Needed:**
- Register `contrarian.markets` or `contrarianmarkets.com`?
- Handling after product rebrand (was Cascade, now Contrarian Markets)
- DNS pointing + SSL setup

**Related Conversations:**
- Conversation e815816fd99a2329c7e4fad2a2e1df88be75a1cd1c3ec3191ae62d63904256fb (Rename to Contrarian Markets)

**What This Affects:** Public marketing URL; professional branding

---

### 13. **API Endpoint Design** ⏳
**Status:** NEEDS SCOPE DEFINITION  
**What's Needed:**
- Which API endpoints does Cascade/Contrarian actually need?
- REST vs. GraphQL?
- Authentication model?
- Rate limiting?
- Public vs. authenticated endpoints?

**What This Affects:** Third-party integrations; developer experience

---

## TRACKING & UPDATES

### How to Use This Document

1. **When you find a new directive:** Add it to the appropriate section with full context, source conversation ID, and date.
2. **When a pending decision gets clarified:** Move it from "Pending" to the appropriate section with full details.
3. **When a decision is superseded:** Note the supersession with date and explanation. Keep old decision visible (strike-through).
4. **When implementation changes:** Update the "Implementation Notes" or "Details" section with actual code references.

### Version History

| Date | Changes |
|------|---------|
| 2026-04-05 | **Initial document creation** — 8 core directives + 5 pending areas. Foundation established. |

---

## VERIFICATION CHECKLIST

Use this to verify all directives are being honored in code:

- [ ] Svelte port phase 1 complete with clean build
- [ ] No React code in new features (only legacy)
- [ ] All markets using kind 982 events
- [ ] Cashu keyset IDs follow `{market_id}_*` pattern
- [ ] Style guide colors/components enforced (emerald/rose only)
- [ ] Legal pages linked in footer
- [ ] Hero CTAs navigate correctly
- [ ] Onboarding at `/welcome` is Svelte-native
- [ ] Market discussions using kind:1111
- [ ] No mock data in production features

---

## CRITICAL REMINDERS

### DO NOT:
- Restore React OnboardingSplit without explicit new directive
- Use kind 30000 for new markets
- Add accent colors outside emerald/rose without approval
- Re-implement streaming refactor (superseded)
- Remove market discussion feature without direction
- Use rounded pills, gradients, or emojis in UI chrome

### DO:
- Check this document before implementing features
- Add every Pablo directive immediately when identified
- Search conversation history if uncertain about a decision
- Flag ambiguities for clarification (don't guess)
- Keep implementation notes updated with code references

---

**Questions about any directive?** Reference the conversation ID and search for full context.
