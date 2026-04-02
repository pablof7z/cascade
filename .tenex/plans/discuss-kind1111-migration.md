# DiscussPage Kind 1111 (NIP-22) Migration

## Context

**Current State (Kind 1):**
- DiscussPage.tsx fetches discussion posts as Nostr kind 1 (text notes) with market identifier in tags: `["m", marketId]` and `["market", marketId]`
- NDK filter: `{ kinds: [1], '#m': [marketId], limit }`
- Threading uses NIP-10: `["e", rootId, "", "root"]` and `["e", parentId, "", "reply"]`
- Functions in nostrService.ts: `fetchMarketPosts()`, `subscribeToMarketPosts()`, `publishMarketPost()`, `publishMarketReply()`
- Post metadata: `parseEventTags()` extracts stance, type, and threading info

**Target State (Kind 1111 NIP-22):**
- Discussions migrate to kind 1111 with proper NIP-22 structure (per nostr-kinds.md lines 110-132)
- Market reference via E-tag (non-replaceable kind 982): `["e", "<kind-982-event-id>", "<relay>", "root"]` pointing to the market event
- Root kind tag: `["k", "982"]` (lowercase, indicates kind of referenced event)
- Replies keep NIP-10 structure: `["e", "<parent-comment-id>", "<relay>", "reply"]` + `["k", "1111"]` tag
- Market creator notifications: `["p", "<market-creator-pubkey>"]`

**No Backward Compatibility:**
- Drop all kind 1 support — write ONLY kind 1111, read ONLY kind 1111
- No dual-mode filters or legacy code paths
- Cleaner migration path with full commitment to NIP-22 standard

**Files Affected:**
- `src/services/nostrService.ts` (lines 144-207): Update `publishMarketPost()`, `publishMarketReply()`, `fetchMarketPosts()`, `subscribeToMarketPosts()`, `parseEventTags()`
- `src/DiscussPage.tsx` (552 lines): Pass market coordinate to publish functions, handle new tag structure
- `src/lib/threadBuilder.ts`: Update to parse NIP-22 A-tags and e-tags with kind 1111 replies

**Tests Affected:**
- All discussion filtering tests
- Thread building tests
- Reaction tests (kind 7 works on any event type)

---

## Approach

**Two-layer implementation strategy:**

1. **Layer 1: Service Functions** — Update nostrService.ts to publish kind 1111 with E-tags referencing kind 982 market events, read only kind 1111
2. **Layer 2: UI Integration** — Update DiscussPage.tsx to pass market.nostrEventId (kind 982 event ID) to publish functions

**No Backward Compatibility:**
- Fetch filters read ONLY kind 1111 (drop kind 1 entirely)
- All posts published as kind 1111 with proper E-tag market references
- Thread builder simplified (no need for dual-kind logic)
- Clean break, full NIP-22 compliance

**Why This Approach:**
- Simplest implementation: one event kind, no legacy support
- Full NIP-22 compliance from day one
- E-tag references (non-replaceable) are more robust than A-tags for market events
- Kind 982 is non-replaceable (correct for immutable market definitions)
- Reactions (kind 7) work unchanged on kind 1111 roots

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Market Reference Tag** | E-tag (not A-tag): `["e", "<kind-982-event-id>", "<relay>", "root"]` | Kind 982 is non-replaceable, so E-tag is correct. A-tags are for replaceable/addressable events (kind 30xxx). |
| **Market Event ID Source** | Use `market.nostrEventId` directly (no d-tag extraction needed) | market.nostrEventId is already the kind 982 event ID. Eliminates complex coordinate resolution. |
| **Relay in Tags** | Use `localRelay` (from NostrContext) or empty string if unavailable | E-tag position [2] requires relay hint for efficient event lookup. |
| **Read Filters** | Fetch `{ kinds: [1111], ...}` for market posts; no kind 1 support | Clean break: single event kind, no dual-mode logic, no legacy filtering. |
| **Root Event Detection** | For kind 1111: presence of E-tag with "root" marker | Consistent with NIP-22: root comments reference the market event; replies reference parent comment. |
| **Kind Tag Format** | Root: `["k", "982"]`; Reply: `["k", "1111"]` (lowercase) | Per nostr-kinds.md spec (lines 122-127). Lowercase k indicates "kind of referenced event". |
| **Thread Hierarchy** | No changes needed to threadBuilder logic | E-tag parsing for replies identical to kind 1 (NIP-10 unchanged); thread detection works as-is. |

---

## File Changes

### `src/services/nostrService.ts`

**What:** Extend nostrService to resolve market coordinates, publish kind 1111 with NIP-22 tags, and read both kind 1 and 1111.

**Action:** Modify lines 1–300+ to include new functions and update existing ones.



#### Updated: `publishMarketPost()`
- **Old signature** (line 144–158):
  ```typescript
  export async function publishMarketPost(
    marketId: string,
    title: string,
    content: string,
    stance: 'bull' | 'bear' | 'neutral',
    type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
  ): Promise<NDKEvent>
  ```
- **New signature**:
  ```typescript
  export async function publishMarketPost(
    marketId: string,
    title: string,
    content: string,
    stance: 'bull' | 'bear' | 'neutral',
    type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
    marketEventId: string, // New required param: kind 982 event ID
    marketCreatorPubkey: string, // New required param for p-tag
  ): Promise<NDKEvent>
  ```
- **Implementation**:
  ```typescript
  export async function publishMarketPost(
    marketId: string,
    title: string,
    content: string,
    stance: 'bull' | 'bear' | 'neutral',
    type: 'argument' | 'evidence' | 'rebuttal' | 'analysis',
    marketEventId: string,
    marketCreatorPubkey: string,
  ): Promise<NDKEvent> {
    const fullContent = title ? `${title}\n\n${content}` : content
    const relay = _localRelay || '' // From NostrContext initialization
    const tags: string[][] = [
      ['e', marketEventId, relay, 'root'],  // Reference kind 982 market event
      ['k', '982'],                          // Kind of referenced event
      ['p', marketCreatorPubkey],            // For notifications
      ['stance', stance],
      ['type', type],
      ['subject', title],
    ]
    return publishEvent(fullContent, tags, 1111) // Kind 1111 (was 1)
  }
  ```
- **Why:** NIP-22 spec requires E-tag for non-replaceable market event, k-tag for market kind, p-tag for notifications. Kind 1111 is the discussion event kind.

#### Updated: `publishMarketReply()`
- **Old signature** (line 165–178):
  ```typescript
  export async function publishMarketReply(
    marketId: string,
    content: string,
    parentEventId: string,
    rootEventId: string,
    parentAuthorPubkey: string,
  ): Promise<NDKEvent>
  ```
- **New signature** (unchanged, no new params):
  ```typescript
  export async function publishMarketReply(
    marketId: string,
    content: string,
    parentEventId: string,
    rootEventId: string,
    parentAuthorPubkey: string,
  ): Promise<NDKEvent>
  ```
- **Implementation**:
  ```typescript
  export async function publishMarketReply(
    marketId: string,
    content: string,
    parentEventId: string,
    rootEventId: string,
    parentAuthorPubkey: string,
  ): Promise<NDKEvent> {
    const relay = _localRelay || ''
    const tags: string[][] = [
      ['e', rootEventId, relay, 'root'],      // Root comment (for context)
      ['e', parentEventId, relay, 'reply'],   // Direct parent
      ['k', '1111'],                           // Kind of this comment
      ['p', parentAuthorPubkey],               // For notifications
    ]
    return publishEvent(content, tags, 1111) // Kind 1111
  }
  ```
- **Why:** Replies reference root comment and direct parent via e-tags (NIP-10 unchanged). No market reference needed — market is referenced only at root level.

#### Updated: `fetchMarketPosts()`
- **Old signature** (line 184–192):
  ```typescript
  export async function fetchMarketPosts(
    marketId: string,
    limit = 100
  ): Promise<NDKEvent[]> {
    if (!_ndk) throw new Error('Nostr service not initialized')
    const filter: NDKFilter = { kinds: [1], '#m': [marketId], limit }
    const eventsSet = await _ndk.fetchEvents(filter)
    return Array.from(eventsSet)
  }
  ```
- **New signature**:
  ```typescript
  export async function fetchMarketPosts(
    marketEventId: string, // New: kind 982 event ID
    limit = 100
  ): Promise<NDKEvent[]> {
    if (!_ndk) throw new Error('Nostr service not initialized')
    
    // Fetch kind 1111 posts referencing this market event via e-tag
    const filter: NDKFilter = {
      kinds: [1111],
      '#e': [marketEventId],  // Filter by e-tag matching market event ID
      limit,
    }
    const eventsSet = await _ndk.fetchEvents(filter)
    return Array.from(eventsSet)
  }
  ```
- **Why:** Single event kind (1111), clean filter by E-tag. marketEventId is the kind 982 event ID (no coordinate resolution needed). NDK's #e filter queries events by e-tag value directly.

#### Updated: `subscribeToMarketPosts()`
- **Old signature** (line 198–207):
  ```typescript
  export function subscribeToMarketPosts(
    marketId: string,
    callback: (event: NDKEvent) => void
  ): NDKSubscription
  ```
- **New signature**:
  ```typescript
  export function subscribeToMarketPosts(
    marketEventId: string, // New: kind 982 event ID
    callback: (event: NDKEvent) => void
  ): NDKSubscription
  ```
- **Implementation**:
  ```typescript
  export function subscribeToMarketPosts(
    marketEventId: string,
    callback: (event: NDKEvent) => void
  ): NDKSubscription {
    if (!_ndk) throw new Error('Nostr service not initialized')
    
    // Subscribe to kind 1111 posts referencing this market
    const filter: NDKFilter = {
      kinds: [1111],
      '#e': [marketEventId],
    }
    const sub = _ndk.subscribe(filter, { closeOnEose: false })
    
    // Call callback for all matching events (no further filtering needed)
    sub.on('event', (event: NDKEvent) => {
      callback(event)
    })
    
    return sub
  }
  ```
- **Why:** Single event kind (1111) with direct E-tag filter. Real-time subscription filters on the relay side (no client-side filtering).

#### Updated: `parseEventTags()`
- **Old return type** (lines 212–249):
  ```typescript
  export function parseEventTags(event: NDKEvent): {
    stance?: 'bull' | 'bear' | 'neutral'
    type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    replyTo?: string
    rootId?: string
  }
  ```
- **New return type** (no changes to existing fields; add metadata):
  ```typescript
  export function parseEventTags(event: NDKEvent): {
    stance?: 'bull' | 'bear' | 'neutral'
    type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    replyTo?: string
    rootId?: string
    isRoot?: boolean // True if this is a root comment (has e-tag marked "root")
  }
  ```
- **Implementation**:
  ```typescript
  export function parseEventTags(event: NDKEvent): {
    stance?: 'bull' | 'bear' | 'neutral'
    type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    replyTo?: string
    rootId?: string
    isRoot?: boolean
  } {
    const result: {
      stance?: 'bull' | 'bear' | 'neutral'
      type?: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
      replyTo?: string
      rootId?: string
      isRoot?: boolean
    } = {}

    let hasReplies = false

    for (const tag of event.tags) {
      const [name, value, , marker] = tag
      
      // Parse metadata tags
      if (name === 'stance' && (value === 'bull' || value === 'bear' || value === 'neutral')) {
        result.stance = value
      } else if (
        name === 'type' &&
        (value === 'argument' || value === 'evidence' || value === 'rebuttal' || value === 'analysis')
      ) {
        result.type = value
      }
      // Parse NIP-10 e-tags (threading)
      else if (name === 'e') {
        hasReplies = true
        if (marker === 'root') {
          result.rootId = value
          result.isRoot = false  // This event is a reply to root
        } else if (marker === 'reply') {
          result.replyTo = value
        } else {
          // No marker — treat as reply-to (direct parent)
          result.replyTo = value
        }
      }
    }

    // Root detection: no reply references (rootId or replyTo)
    if (!result.isRoot && !result.rootId && !result.replyTo) {
      result.isRoot = true
    }

    return result
  }
  ```
- **Why:** E-tag parsing unchanged (NIP-10 applies equally). Root detection simplified: presence of market reference (e-tag marked "root") indicates reply; absence indicates root comment.

---

### `src/lib/threadBuilder.ts`

**What:** Update to handle NIP-22 A-tag market references and kind 1111 event filtering.

**Action:** Modify lines 19–99 to support both kinds transparently.

#### Updated: `buildReplies()`
- **Location:** Lines 19–43
- **Change:** No modification needed — continues to use `parseEventTags()` which now handles both kinds
- **Why:** e-tag parsing is identical for both kinds (NIP-10 threading unchanged)

#### Updated: `convertEventToThread()`
- **Location:** Lines 48–70
- **Change:** No modification needed — parseEventTags() now returns extended type with marketCoordinate
- **Why:** Thread display logic is kind-agnostic; both kinds convert to same DiscussionThread type

#### Updated: `buildThreadHierarchy()`
- **Location:** Lines 86–99
- **Change:** Filter to only include kind 1111 as roots (kind 1 legacy posts are still roots if no replies, but new posts are only 1111):
  ```typescript
  export async function buildThreadHierarchy(
    rawEvents: NDKEvent[],
  ): Promise<DiscussionThread[]> {
    const allEventsMap = new Map(rawEvents.map((e) => [e.id ?? '', e]))

    const rootEvents = rawEvents.filter((event) => {
      const tags = parseEventTags(event)
      // Root if: (kind 1111 with A-tag) OR (no reply references, regardless of kind)
      if (tags.isRoot) return true
      if (!tags.replyTo && !tags.rootId) return true
      return false
    })

    return Promise.all(
      rootEvents.map((event) => convertEventToThread(event, allEventsMap)),
    )
  }
  ```
- **Why:** Ensures kind 1111 roots with A-tags are correctly identified; kind 1 legacy posts (no A-tag) detected by absence of reply references.

---

### `src/DiscussPage.tsx`

**What:** Update to resolve market coordinates, pass them to publish/fetch functions, and maintain backward compatibility.

**Action:** Modify lines 180–320+ for market coordinate resolution and function call sites.

#### Phase 1: No Imports Needed
- No new imports required (remove any coordinate resolution imports)

#### Phase 2: Fetch Market Posts (lines 180–220)
- **Location:** In the `useEffect` that calls `fetchMarketPosts()` (lines 184–212)
- **Current code**:
  ```typescript
  useEffect(() => {
    if (!isReady || !marketId) return

    const loadPosts = async () => {
      try {
        const rawEvents = await fetchMarketPosts(marketId)
        const threads = await buildThreadHierarchy(rawEvents)
        setThreads(threads)
      } catch (error) {
        console.error('Failed to fetch market posts:', error)
      }
    }

    loadPosts()
  }, [marketId, isReady])
  ```
- **Updated code**:
  ```typescript
  useEffect(() => {
    if (!isReady || !marketId) return

    const entry = markets[marketId]
    if (!entry?.market.nostrEventId) return

    const loadPosts = async () => {
      try {
        const rawEvents = await fetchMarketPosts(entry.market.nostrEventId)  // Pass kind 982 event ID
        const threads = await buildThreadHierarchy(rawEvents)
        setThreads(threads)
      } catch (error) {
        console.error('Failed to fetch market posts:', error)
      }
    }

    loadPosts()
  }, [marketId, isReady, markets])
  ```
- **Why:** Pass marketEventId (kind 982 event ID) directly; no coordinate resolution needed.

#### Phase 3: Real-Time Subscription (lines 216–240)
- **Location:** In the subscription useEffect (lines 216–240)
- **Current code**:
  ```typescript
  useEffect(() => {
    if (!isReady || !marketId) return

    const subscription = subscribeToMarketPosts(marketId, async (newEvent) => {
      // ... existing newEvent handling code
    })
    setSubscription(subscription)

    return () => {
      subscription?.stop()
    }
  }, [marketId, isReady])
  ```
- **Updated code**:
  ```typescript
  useEffect(() => {
    if (!isReady || !marketId) return

    const entry = markets[marketId]
    if (!entry?.market.nostrEventId) return

    const subscription = subscribeToMarketPosts(entry.market.nostrEventId, async (newEvent) => {
      // ... existing newEvent handling code (unchanged)
    })
    setSubscription(subscription)

    return () => {
      subscription?.stop()
    }
  }, [marketId, isReady, markets])
  ```
- **Why:** Pass marketEventId directly to subscription.

#### Phase 4: Post Publishing (lines 310–330)
- **Location:** In compose/submit handler (around line 315)
- **Current code**:
  ```typescript
  await publishMarketPost(marketId, composeTitle.trim(), composeContent.trim(), composeStance, composeType)
  ```
- **Updated code**:
  ```typescript
  const entry = markets[marketId]
  if (!entry?.market.nostrEventId) {
    // Error: market not found or no event ID
    return
  }

  await publishMarketPost(
    marketId,
    composeTitle.trim(),
    composeContent.trim(),
    composeStance,
    composeType,
    entry.market.nostrEventId,           // Pass kind 982 event ID
    entry.market.creatorPubkey
  )
  ```
- **Why:** marketEventId and creatorPubkey extracted directly from market object; no async resolution needed.

#### Phase 5: Reply Publishing (lines 500–520)
- **Location:** In `ReplyComposer` component or reply handler (search for `publishMarketReply` calls)
- **Current code** (unchanged):
  ```typescript
  await publishMarketReply(marketId, replyContent, parentId, rootId, parentAuthorPubkey)
  ```
- **No changes needed** — publishMarketReply signature unchanged

---

## Execution Order

### Phase 1: Service Layer Upgrade (Foundation)
1. Update `publishMarketPost()` signature and implementation (lines 144–159): E-tag for kind 982, k-tag for kind 982
2. Update `publishMarketReply()` signature and implementation (lines 165–179): No new params, E-tags for root/parent unchanged
3. Update `fetchMarketPosts()` signature and implementation (lines 184–192): Single param (marketEventId), filter by #e tag
4. Update `subscribeToMarketPosts()` signature and implementation (lines 198–207): Single param (marketEventId), filter by #e tag
5. Update `parseEventTags()` return type and implementation (lines 212–249): Add isRoot detection via e-tag marker
6. **Verify:** Run type checking (`tsc --noEmit`) — should reveal all call sites needing updates

### Phase 2: Thread Building Layer (Mid-tier)
7. Update `buildThreadHierarchy()` in threadBuilder.ts (lines 86–99) to use updated `parseEventTags()` with isRoot field
8. Verify `buildReplies()` and `convertEventToThread()` work with new tags (no changes needed)
9. **Verify:** Run tests for threadBuilder if they exist

### Phase 3: UI Integration Layer (Top)
10. Update fetch useEffect in DiscussPage.tsx: pass `entry.market.nostrEventId` to `fetchMarketPosts()`
11. Update subscription useEffect in DiscussPage.tsx: pass `entry.market.nostrEventId` to `subscribeToMarketPosts()`
12. Update `publishMarketPost()` call: pass `entry.market.nostrEventId` and `entry.market.creatorPubkey`
13. Verify `publishMarketReply()` call unchanged (no new params)
14. **Verify:** Application starts, no TypeScript errors

### Phase 4: Integration Testing
15. Test reading kind 1111 posts (all posts should be kind 1111 only)
16. Test publishing new kind 1111 posts (should have E-tag with correct market event ID)
17. Test replying to kind 1111 posts (e-tags should be correct, no market reference needed)
18. Test reactions on kind 1111 roots (kind 7 unchanged)
19. Test thread building with kind 1111 posts only
20. Test real-time subscription captures kind 1111 only

---

## Verification

### Automated Checks
1. **TypeScript compilation**: `npm run build` — must succeed with no errors
2. **Type checking**: `npx tsc --noEmit` — must pass
3. **Existing tests**: `npm run test` — all should pass (no test logic changes required; filter is transparent)

### Manual Testing Checklist

#### Setup: Create a Test Market
1. ✓ Create a new market via Cascade UI
2. ✓ Note the market ID and creator pubkey
3. ✓ Allow the market to publish to Nostr (verify kind 982 event created)
4. ✓ Extract d-tag from the kind 982 event; compose expected coordinate `982:creatorPubkey:d-tag`

#### Test 1: Publishing New Kind 1111 Posts
1. ✓ In DiscussPage discussion, compose and submit a new post ("Bull Argument")
2. ✓ Use Nostr dev tools to inspect the published event
3. ✓ Verify: `kind === 1111`
4. ✓ Verify E-tag: `["e", "<kind-982-market-event-id>", "<relay>", "root"]` with correct market event ID
5. ✓ Verify k-tag: `["k", "982"]` (lowercase, indicates kind of root event)
6. ✓ Verify p-tag: `["p", "market-creator-pubkey"]`
7. ✓ Verify metadata tags: stance, type, subject (unchanged)

#### Test 2: Replying to Kind 1111 Posts
1. ✓ In DiscussPage discussion, click "Reply" on the new post
2. ✓ Compose and submit a reply ("Rebuttal")
3. ✓ Use Nostr dev tools to inspect the reply event
4. ✓ Verify: `kind === 1111`
5. ✓ Verify e-tags: one with `["e", "<root-comment-id>", relay, "root"]`, one with `["e", "<parent-comment-id>", relay, "reply"]`
6. ✓ Verify k-tag: `["k", "1111"]` (lowercase, indicates this event is kind 1111)
7. ✓ Verify p-tag: `["p", parentAuthorPubkey]`
8. ✓ Verify reply appears in thread under the parent post

#### Test 3: Reactions on Kind 1111 Posts
1. ✓ In DiscussPage discussion, upvote a kind 1111 root post
2. ✓ Use Nostr dev tools to inspect the reaction event
3. ✓ Verify: `kind === 7`
4. ✓ Verify e-tag references the kind 1111 post ID
5. ✓ Verify upvote count increments on the post

#### Test 4: Multi-level Nested Replies
1. ✓ Create a root post (kind 1111)
2. ✓ Reply to root (kind 1111 with e-tag root marker)
3. ✓ Reply to that reply (kind 1111 with e-tag parent marker)
4. ✓ Verify nesting is 3 levels deep in thread
5. ✓ Verify all e-tags are correct (root and parent markers)

#### Test 5: Real-Time Subscription
1. ✓ Open DiscussPage discussion page
2. ✓ In another browser tab, publish a new kind 1111 post to the same market (using Nostr dev tools)
3. ✓ Verify the new post appears in DiscussPage within 3 seconds WITHOUT page reload

### Edge Cases to Test

1. **Market Without nostrEventId**
   - ✓ Create a market with no nostrEventId (not yet published to Nostr)
   - ✓ Attempt to view discussion / publish post
   - ✓ Verify DiscussPage handles gracefully (returns early, shows error or disabled state)

2. **Event ID Mismatch in Filter**
   - ✓ Publish a kind 1111 post with e-tag referencing Event ID "abc"
   - ✓ Try to fetch posts for market with different Event ID "xyz"
   - ✓ Verify the post does NOT appear (filter by e-tag is strict)

3. **Relay Unavailable**
   - ✓ Disconnect relay temporarily
   - ✓ Attempt to publish kind 1111 post
   - ✓ Verify NDK timeout handling works
   - ✓ Verify offline outbox or retry logic (if implemented)

4. **Duplicate Posts (Same Content, Rapid Publish)**
   - ✓ Compose a post and submit
   - ✓ Click submit again immediately
   - ✓ Verify two kind 1111 events are published (idempotency not enforced at this layer)

5. **Long Thread Chain**
   - ✓ Create 10 replies in a chain
   - ✓ Verify nesting renders correctly
   - ✓ Verify thread building completes in <2 seconds

6. **Missing P-Tag in Published Event**
   - ✓ Manually publish a kind 1111 without p-tag
   - ✓ Verify it still appears in discussion (p-tag is optional for display)
   - ✓ Verify notifications still work (may require p-tag on relays)

---

## Scope & Limitations

### In Scope
- Migration of DiscussPage.tsx to read and write kind 1111 (NIP-22)
- E-tag market references pointing to kind 982 non-replaceable events
- Pure kind 1111 support (no legacy kind 1 dual-mode)
- Threading model uses NIP-10 e-tags with "root" and "reply" markers
- Reactions (kind 7) on kind 1111 posts (no changes — already compatible)
- All tag structures per NIP-22 spec and nostr-kinds.md (with E-tags for non-replaceable markets)

### Out of Scope / Deferred
- **Discussion.tsx**: Field-based mock component is NOT touched; uses mock data only
- **Event ID Validation**: No checking if market.nostrEventId actually corresponds to a valid kind 982 event (trust client state)
- **Relay Discovery**: Relay hints in tags are hardcoded; no dynamic relay selection
- **P2P Market Events**: Markets with no creator pubkey (decentralized) are not supported (not in Cascade scope)
- **Retroactive Migration**: No tool to convert historical data or posts

### Acceptable Trade-offs
- **No Fallback for Missing nostrEventId**: If market has no nostrEventId, DiscussPage does not load (early return). This is acceptable because all real markets must be published as kind 982 events first.

---

## Success Criteria

All of the following must be true at implementation completion:

1. ✓ **TypeScript Compilation**: `npm run build` succeeds with zero errors
2. ✓ **All Function Signatures Updated**: `publishMarketPost()`, `publishMarketReply()`, `fetchMarketPosts()`, `subscribeToMarketPosts()` signatures match spec
3. ✓ **publishMarketPost New Signature**: Accepts `marketEventId: string` and `marketCreatorPubkey: string` (was neither before)
4. ✓ **publishMarketReply Unchanged**: Signature identical to original (no new params)
5. ✓ **fetchMarketPosts New Signature**: Accepts `marketEventId: string` instead of `marketId: string`
6. ✓ **subscribeToMarketPosts New Signature**: Accepts `marketEventId: string` instead of `marketId: string`
7. ✓ **New Kind 1111 Events Only**: All posts published from DiscussPage have `kind: 1111`, never kind 1
8. ✓ **E-Tags Correct for Roots**: Root posts have E-tag with format `["e", "<kind-982-event-id>", "<relay>", "root"]`
9. ✓ **k-Tag Present**: Root posts have `["k", "982"]` (lowercase); replies have `["k", "1111"]` (lowercase)
10. ✓ **P-Tag Present**: All posts have `["p", "<relevant-pubkey>"]` for notifications (market creator for roots, parent author for replies)
11. ✓ **E-Tags Correct for Replies**: Replies have two e-tags with "root" and "reply" markers, matching NIP-10 spec
12. ✓ **No Legacy Kind 1 Support**: Filters read ONLY kind 1111, no dual-mode or fallback to kind 1
13. ✓ **Subscription Single-Kind**: Real-time subscription filters only kind 1111 events for the market
14. ✓ **Thread Building Updated**: `buildThreadHierarchy()` correctly identifies roots via e-tag "root" marker and builds nesting
15. ✓ **parseEventTags Enhanced**: Return type includes `isRoot?: boolean` calculated from e-tag presence/absence
16. ✓ **Reaction Compatibility**: Kind 7 reactions published on kind 1111 posts with correct e-tag references (unchanged)
17. ✓ **Manual Test 1 Pass**: New kind 1111 posts published with correct E-tag structure (market event ID, not coordinate)
18. ✓ **Manual Test 2 Pass**: Replies nest correctly under kind 1111 roots with correct e-tags
19. ✓ **Manual Test 3 Pass**: Reactions work on kind 1111 posts
20. ✓ **Manual Test 4 Pass**: Multi-level nested replies build and display correctly
21. ✓ **Manual Test 5 Pass**: Real-time subscription detects kind 1111 within 3 seconds
22. ✓ **No Breaking Changes**: All existing MarketEntry, DiscussionThread, and Reply types remain unchanged
23. ✓ **Error Handling**: Missing nostrEventId returns early in DiscussPage (no fallback or error state)
