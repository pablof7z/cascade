# Rich User Profiles — Architecture Decision

> Design for rich user profiles with pubkey-keyed data models, client-side aggregation, and shared avatar linking

**Tags:** #architecture #profiles #data-models #nostr #cascade

---

# Rich User Profiles — Architecture Decision

**Date**: 2026-03-29  
**Status**: LOCKED — Ready for Implementation  
**Owner**: Architect-Orchestrator

## Architectural Decisions

### 1. Data Model Extensions

**Markets**
```typescript
type Market = {
  // ... existing fields
  creatorPubkey: string     // Nostr pubkey of market creator
  createdAt: number         // Unix timestamp
}
```

**ParticipantBook**
```typescript
// CHANGE FROM: Record<'you' | 'alice' | 'bob', ParticipantAccount>
// CHANGE TO:
type ParticipantBook = Record<string, ParticipantAccount>  // Key = pubkey
```

**DebatePost**
```typescript
interface DebatePost {
  // ... existing fields
  authorPubkey: string      // Nostr pubkey of post author
  marketId: string          // Reference to market
}
```

### 2. Profile Data Aggregation (Client-Side, localStorage)

When user navigates to `/p/:identifier`:

1. **Identity Section**: Display avatar, displayName, bio, npub, NIP-05 verification status
2. **Markets Created**: Query all markets where `creatorPubkey === resolvedPubkey`, display with volume & performance
3. **Trading Activity**: Query all ParticipantBooks for entries where `pubkey === resolvedPubkey`, aggregate positions & P&L
4. **Discussion Contributions**: Filter all DebatePosts where `authorPubkey === resolvedPubkey`, show recent posts & reaction counts
5. **Reputation Score**: Placeholder initially — computed as win/loss ratio across markets where user participated (can be enhanced later)
6. **Wallet**: Display balance (already functional via NIP-60 integration)
7. **Social**: Placeholder followers/following with mock data for demo purposes

**Data Aggregation Scope**: Single-pubkey aggregation only. Don't build cross-profile analytics yet; keep it focused on the queried user.

### 3. Avatar Linking Strategy

Create a shared `UserLink` component that wraps any avatar/user display and links to `/p/:identifier`.

**Affected Components**:
- Discussion post author names and avatars
- Market creator display
- Leaderboard entries (participant names)
- Any other user reference in the UI

All should become clickable links to the user's profile.

### 4. Implementation Phasing

**Canonical route shape**

- Preferred public route: `/p/:nip05`
- Fallback public route: `/p/:npub`
- Public profiles should exist only under `/p/...`; do not keep `/profile/:npub` or `/u/:pubkey` as parallel public routes

**Phase 1 (This Task)**
- Extend data models with creatorPubkey, authorPubkey fields
- Implement `/p/:identifier` page with 7 sections
- Create UserLink component and wire it everywhere users are displayed
- Store profile data in localStorage/client state
- Use mock/computed values for reputation and social data

**Phase 2 (Future)**
- Publish markets, trades, and discussion posts as Nostr events (kind:30023, kind:5000, etc.)
- Query Nostr relays for real user data instead of local state

**Phase 3 (Future)**
- Real reputation metrics (calibration accuracy, track record)
- Actual social connections (followers from Nostr social graph)

## File Change Map

- `/src/market.ts` — Extend Market type, update ParticipantBook keying
- `/src/Discussion.tsx` — Extend DebatePost type with authorPubkey, marketId
- `/src/Profile.tsx` — Expand into rich 7-section profile page
- `/src/components/UserLink.tsx` — NEW, shared avatar-to-profile linker
- All components displaying users — Import and use UserLink

## Why This Approach

1. **Pubkey Keying**: Aligns with Nostr native identity; single source of truth for user identity
2. **Client-Side Aggregation**: No backend needed; markets/posts already exist in state, just query them
3. **Shared UserLink**: Prevents avatar-linking from becoming scattered across 10 different components
4. **Phased Nostr Publishing**: Don't block profile functionality on event publishing; events can be added later
5. **Mock Metrics**: Profiles remain useful while real reputation/social systems are built

## Success Criteria

1. ✓ Profile page renders all 7 sections for any queried identifier
2. ✓ Markets Created section shows correct markets filtered by creatorPubkey
3. ✓ Trading Activity aggregates positions across all markets where user participated
4. ✓ Discussion Contributions show posts authored by that user
5. ✓ Every avatar/user display in app links to `/p/:identifier`
6. ✓ No console errors; clean build
7. ✓ Code passes clean-code-nazi review before merge

## Next Step

Delegate full implementation to claude-code with detailed spec.
