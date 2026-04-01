# NIP-25 Reactions for Cascade Market Discussion

## Context

Cascade is replacing mock discussion with real Nostr posts. The Nostr integration setup, post creation, and post fetching are handled in separate plans.

Currently, the Discussion UI (`src/Discussion.tsx`) displays posts as a flat list with metadata like author, stance, and reply count, but has no voting/reaction UI. Posts are rendered at lines 372–401 in a repeating `<article>` block.

NIP-25 defines a standard for reactions on Nostr: a reaction event (kind 7) with a content field (`+`, `-`, or custom emoji) and an `e` tag pointing to the target event ID. This plan adds upvote/downvote functionality using `+` and `-` reactions.

**Infrastructure (from Nostr Integration Setup plan — CORRECTED):**
- **Event Kind & Tag Structure**: Posts are kind 1 (text notes) with:
  - `m` tag: market identifier (market ID, queryable via `#m` filter)
  - `market` tag: for metadata/organization
- **Service Layer** (`src/services/nostrService.ts`): Exposes `publishEvent(content: string, tags: string[][], kind: number = 1)`, `fetchEvents()`, `subscribeToEvents()`
- **Context Hook** (`src/context/NostrContext.tsx`): `useNostr()` provides `pubkey` (or null) and `NDK` instance
- **Authentication**: NIP-07 detection + read-only fallback already handled

**Assumptions:**
- User pubkey available via `useNostr().pubkey` (null if not logged in)
- NDK instance available via `useNostr().ndk`
- Posts are kind 1 events with `m` tag for market scoping
- Post event IDs available when posts are fetched/rendered
- `publishEvent()` service handles all NDK publishing logic

## Approach

**Overall Strategy:** Simple, interactive vote UI with real-time count updates and minimal complexity.

1. **Vote UI Component:** Add a small interactive vote section below each post (alongside timestamp/reply-count metadata).
   - Two buttons: upvote (👆) and downvote (👇) using minimal text/icon UI
   - Show aggregated vote counts: `+5 −2` or similar
   - Highlight user's own vote (if logged in and voted)
   - Disable buttons if user not logged in; show "Sign in to vote" tooltip

2. **Reaction Publishing:** When user clicks vote:
   - Validate user is logged in (show login prompt if not)
   - Build a NIP-25 reaction event: kind 7, content `+` or `-`, `e` tag with post event ID
   - Publish via NDK; handle relay errors gracefully
   - Show transient feedback (loading state, success/error toast)
   - **Toggle behavior:** If user already voted with that reaction, remove it (publish deletion event, kind 5, or let app state reflect absence). Recommend: track user's reactions in local state and toggle on/off without re-querying (simpler UX).

3. **Aggregating Reactions:** Fetch reactions for visible posts on mount or when post list updates.
   - Query for events: `kind: 7, tags: { e: [postEventId] }`
   - Parse content field (`+` vs `-`) and group by reaction type
   - Count reactions per type; note which pubkey made each reaction
   - Store in component state: `Map<postId, { upvotes: Set<pubkey>, downvotes: Set<pubkey> }>`
   - Derive counts and user's reaction from this structure

4. **Real-time Updates:** 
   - **Recommended approach:** Refresh vote counts when posts are displayed (one-time fetch per session or on re-subscribe to posts).
   - Optional advanced: Subscribe to reaction events for visible posts in real-time. Complexity: manage subscription lifecycle, handle unsubscribe. Only implement if UX explicitly requires live counts; otherwise, refresh on post fetch is sufficient.

5. **Not-Logged-In State:**
   - Show vote counts (read-only)
   - Disable vote buttons with `disabled` class (opacity 50%, cursor not-allowed)
   - On hover, show tooltip or clear disabled state message: "Sign in to vote"
   - No action on click

6. **Error Handling:**
   - Publish failure (relay down, signer error): show transient error toast (e.g., "Vote failed to publish")
   - Graceful fallback: keep optimistic UI state but don't persist to server; user can retry
   - Invalid reactions (malformed event): log to console, don't display to user

## File Changes

### `src/Discussion.tsx`
- **Action**: modify
- **What**: 
  - Add state for tracking reactions: `const [reactions, setReactions] = useState<Map<string, { upvotes: Set<string>, downvotes: Set<string> }>>(new Map())`
  - Add effect to fetch reactions for all posts on mount: `useEffect(() => { fetchReactionsForPosts(posts) }, [posts])`
  - Extract post metadata rendering into a new `<PostMetadata />` sub-component or inline new vote UI
  - Below line 398 (after reply-count display), add vote UI: upvote button, downvote button, and vote counts
  - Add helper functions: `publishReaction(postId, reactionType)`, `fetchReactionsForPosts(posts)`, `getPostReactionCounts(postId)`
- **Why**: Reactions are tightly coupled to post display; changes are centralized in the Discussion component where posts are rendered. This avoids prop-drilling and keeps reaction logic near the UI.

### `src/services/nostr.ts` (or similar Nostr service layer)
- **Action**: modify or create
- **What**:
  - Add function `publishReaction(eventId: string, reactionType: '+' | '-', signer: Signer): Promise<void>` — builds kind 7 event, publishes via NDK
  - Add function `fetchReactionsForEventIds(eventIds: string[]): Promise<Map<string, ReactionEvent[]>>` — queries for kind 7 events with `e` tags matching the provided IDs
  - Optionally add `deleteReaction(reactionEventId: string): Promise<void>` — publishes kind 5 deletion event (if toggle-via-delete is chosen) or simply don't re-publish if using local state toggle
  - Export types: `ReactionEvent = { id: string, content: string, pubkey: string, tags: Array<string[]> }`
- **Why**: Nostr interactions (publish, fetch) should be centralized in a service layer to avoid tight coupling, enable testing, and reuse across components. Keeps Discussion.tsx focused on UI logic.

### `src/components/VoteUI.tsx` (new)
- **Action**: create
- **What**: Extract vote UI into a reusable component for clarity and potential reuse.
  - Props: `postId: string, eventId: string, upvoteCount: number, downvoteCount: number, userVote: '+' | '-' | null, isLoggedIn: boolean, onVote: (type: '+' | '-') => Promise<void>`
  - Render two buttons (upvote/downvote) with counts, highlight user's vote
  - Handle loading/error states with small inline feedback (optional: use toast if global toast service exists)
  - Disable buttons if not logged in
- **Why**: Encapsulating vote UI into a component improves readability, testability, and reusability. Keeps Discussion.tsx lean.

## Execution Order

### Phase 1: Core Infrastructure (Session 1)
1. **Set up Nostr service functions** (`src/services/nostr.ts`)
   - Implement `publishReaction(eventId, reactionType)` — publish kind 7 reaction event
   - Implement `fetchReactionsForEventIds(eventIds)` — query reactions for multiple posts
   - **Verify**: Call with test post IDs; confirm reactions are published and fetched correctly via NDK

2. **Add reaction state to Discussion component**
   - Add `reactions` state and `useEffect` to fetch reactions for current post list
   - **Verify**: Check browser DevTools console for successful fetch; inspect state in React DevTools

### Phase 2: Vote UI (Session 2)
3. **Create VoteUI component** (`src/components/VoteUI.tsx`)
   - Render upvote/downvote buttons with counts
   - Highlight user's vote
   - Handle not-logged-in state (disabled buttons)
   - **Verify**: Component renders without errors; buttons respond to prop changes

4. **Integrate VoteUI into Discussion component**
   - Import VoteUI in Discussion.tsx (line 372–401 post rendering)
   - Pass vote data, counts, and `onVote` handler
   - Connect `onVote` callback to `publishReaction()` service function
   - **Verify**: Vote buttons appear below each post; clicking upvote/downvote publishes reaction event (check relay logs or NDK debug output); vote counts update in real-time or after refresh

### Phase 3: Polish & Error Handling (Session 3)
5. **Add feedback and error handling**
   - On publish: show brief loading state (spinner or disabled button)
   - On success: show updated counts, optionally brief toast "Vote recorded"
   - On failure: show error toast "Vote failed to publish"; keep button enabled for retry
   - **Verify**: Manually trigger failures (unplug relay, kill relay process) and confirm graceful fallback

6. **Test toggle behavior**
   - Vote on a post, refresh page → vote persists (reaction was published and fetched)
   - Vote again with same reaction → remove vote (unpublish or toggle in local state)
   - Switch between upvote/downvote → old vote disappears, new vote appears
   - **Verify**: Via manual testing and by inspecting Nostr relay for published events

### Phase 4: Real-time Updates (Session 4 - Optional)
7. **Implement real-time reaction subscriptions** (if UX requires live counts)
   - In Discussion effect, add NDK subscription for kind 7 events
   - On new reaction, update reaction state in real-time
   - Manage subscription lifecycle (subscribe on mount, unsubscribe on unmount)
   - **Verify**: Open discussion in two browser windows; vote in one window; confirm counts update in real-time in the other

## Verification

**Manual Testing Checklist:**

1. **Logged-in user:**
   - [ ] Vote buttons appear below each post
   - [ ] Click upvote: loading state visible, reaction publishes, count increments
   - [ ] User's reaction is highlighted (e.g., button active state)
   - [ ] Click same reaction again: vote removed, count decrements, highlight disappears
   - [ ] Switch upvote to downvote: upvote count decrements, downvote increments
   - [ ] Refresh page: votes persist (fetched from relay)

2. **Not-logged-in user:**
   - [ ] Vote buttons are visible but disabled (opacity, cursor)
   - [ ] Vote counts display correctly (read-only)
   - [ ] Clicking disabled button shows tooltip or no-op (no action)
   - [ ] Link to "Sign in" is present (if included in VoteUI)

3. **Error Cases:**
   - [ ] Kill relay / simulate network failure: publish fails, error toast shown, button remains enabled for retry
   - [ ] User publishes duplicate reaction: NDK or app logic handles gracefully (no double-posting)
   - [ ] Malformed reaction event (e.g., missing `e` tag): app ignores, doesn't crash

4. **Edge Cases:**
   - [ ] Very high vote counts (100+): UI doesn't overflow, counts display cleanly
   - [ ] No reactions on a post: counts show `0`, buttons are clickable
   - [ ] User votes on own post: allowed (Nostr has no permission model)

**Automated Testing (if test framework exists):**
- Unit test `fetchReactionsForEventIds()` with mock NDK
- Unit test `publishReaction()` with mock signer
- Component test for VoteUI: upvote/downvote click handlers, prop updates, disabled state

**Performance Considerations:**
- Reaction fetch should batch queries (e.g., fetch reactions for 10 posts in one NDK query)
- Real-time subscriptions (if added) should only be active for visible posts; unsubscribe when posts leave viewport (optional: use IntersectionObserver)

## Toggle Behavior Recommendation

**Chosen: Local state toggle with implicit unpublish**

When user votes on a reaction they've already made, the app:
1. Removes their reaction from local state (visual feedback immediate)
2. Does *not* publish a deletion event (kind 5)
3. On next fetch of reactions (page refresh or re-subscribe), the reaction is absent from relay

**Why:** Simpler implementation, fewer events published to relay (cleaner history), and familiar UX (clicking again = toggle off). Deletion events (kind 5) are complex to manage (they expire, not all relays honor them) and unnecessary for reactions.

**Alternative (not chosen):** Publish kind 5 deletion event when user removes reaction. Downside: more complexity, more relay traffic, deletion events are optional/unreliable.
