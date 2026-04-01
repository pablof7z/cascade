# Post Creation & Publishing for Cascade Market Discussion

## Context

Cascade currently has a fully-built discussion UI in `src/Discussion.tsx` with:
- A post submission form (`handleSubmit` at line 293) that creates draft posts locally
- Form inputs for text content, post type (`newKind`: claim/rebuttal/evidence/catalyst), and stance (`newPosition`: long/short/none)
- A `DebatePost` interface (line 41) defining post structure with `id`, `authorPubkey`, `role`, `headline`, `content`, `kind`, `position`, `conviction`, `timestamp`, `replyCount`, `target`
- Draft posts stored in local state (`draftPosts`) with no persistence
- Display showing user avatar, role, timestamp, reply count, and optional stake info

**Nostr Integration Infrastructure** (from setup plan):
- Event kind: **kind 1 (text notes)** with market-scoped tags
- Tag structure (CORRECTED):
  - `["m", marketId]` — market identifier for filtering (queryable via `#m` filter)
  - `["market", marketId]` — metadata tag for organization
  - `["stance", "bull|bear|neutral"]` — user's market position
  - `["type", "argument|evidence|rebuttal|analysis"]` — post type
  - `["e", eventId]` — reply threading (parent/root event ID)
- Service layer (`src/services/nostrService.ts`):
  - `publishEvent(content: string, tags: string[][], kind: number = 1)` — publish event (kind defaults to 1)
  - `fetchEvents(filters)` — fetch market events
  - `subscribeToEvents(filters, callback)` — real-time event stream
- Auth context (`src/context/NostrContext.tsx`):
  - `useNostr()` hook providing `pubkey` (null if not logged in) and NDK instance
  - NIP-07 detection + read-only fallback already implemented

**What needs to happen:** Replace local draft creation with real Nostr publishing. On form submit, validate input, construct a kind 1 event with proper market and type tags, publish via `publishEvent()`, show success/error feedback, and refresh the thread display.

## Approach

### Strategy: Integrate Nostr publishing into existing form

**Why this approach:**
1. The submission form UI is complete and already has validation logic
2. The `handleSubmit` function (line 293) is a clean integration point
3. Existing draft system can be retained for optimistic UI while events publish asynchronously
4. Minimal changes to component structure—just swap data layer from local to Nostr

**Key decisions:**
- **Optimistic UI**: Show draft post immediately while event publishes in background. If publish fails, keep draft visible with error message and allow retry.
- **Form state when not logged in**: Display inline message "Sign in to post" without hiding the form. Disable submit button to make disabled state obvious.
- **Reply threading**: When user clicks "Reply" on a post, store the parent event ID and encode it in an `["e", parentEventId]` tag on the new event.
- **Content validation**: Check non-empty and reasonable length (max 500 characters) before submission.
- **Stance/type mapping**: 
  - Position long → stance "bull", short → stance "bear", none → stance "neutral"
  - Kind claim → type "argument", rebuttal → type "rebuttal", evidence → type "evidence", catalyst → type "analysis"
- **Post refresh**: After successful publish, trigger a re-fetch of posts for the market to display the new post immediately.

### Alternative approaches considered (rejected)
1. **Hide form when not logged in** — Less discoverable, makes users wonder why UI is missing. Better UX to show the form with clear disabled explanation.
2. **Wait for event confirmation before clearing form** — Too slow; creates laggy user experience. Optimistic UI is standard pattern for this.
3. **Create custom event kind** — Would reduce relay compatibility. Kind 1 with tags is proven, standard approach.

## File Changes

### `src/Discussion.tsx`
- **Action**: modify
- **What**:
  - Import `useNostr()` hook from NostrContext
  - Add props: `marketId: string` (from route)
  - Add state: `isPublishing: boolean`, `publishError: string | null`, `replyToEventId: string | null`
  - Modify `handleSubmit` function (line 293):
    - Check if `pubkey` exists; if not, return early (form already disabled)
    - Validate `content.trim().length > 0` and `<= 500` characters
    - Create optimistic draft post with current timestamp
    - Add draft to `draftPosts` immediately (for instant visual feedback)
    - Set `isPublishing = true` and clear `publishError`
    - Call `publishEvent(content, tags)` with proper tags (see tag structure below)
    - On success: remove draft from `draftPosts` or update with real event ID, clear form inputs and `replyToEventId`
    - On error: set `publishError`, keep draft visible, disable clearing form
    - Set `isPublishing = false` when done
  - Add `handleReply(postId: string, eventId: string, authorPubkey: string)` function:
    - Set `replyToEventId = eventId`
    - Focus the form input
  - Add `handleCancelReply()` function:
    - Clear `replyToEventId`
  - Tag structure for publishing (build in `handleSubmit`):
    ```
    [
      ["m", marketId],
      ["market", marketId],
      ["stance", positionToStance(newPosition)],
      ["type", kindToPostType(newKind)],
      ...(replyToEventId ? [["e", replyToEventId]] : [])
    ]
    ```
  - Update form rendering:
    - Show "Sign in to post" message above form if `!pubkey`
    - Disable submit button if `!pubkey` or `isPublishing`
    - If `replyToEventId` is set, show "Replying to [author name]" header with a "Cancel" button
    - Show `publishError` inline (red text below form) if present; clear on new text input
    - Show loading spinner on submit button when `isPublishing`
  - Add "Reply" button to each rendered post (line 372 in post list) that calls `handleReply(post.id, post.eventId, post.authorPubkey)`
  - Refresh post list after successful publish:
    - Call the post-fetching function provided by the Real Post Fetching plan to reload discussion
- **Why**: Integrates real Nostr publishing, manages auth state gracefully, enables reply threading, handles errors.

### `src/DiscussPage.tsx` (or component wrapping Discussion)
- **Action**: modify
- **What**:
  - Import `useParams()` from react-router (if not already)
  - Extract `marketId` from route: `const { id } = useParams()`
  - Pass `marketId={id}` prop to `<Discussion />` component
- **Why**: Provides market context required for event tagging.

### `src/Discussion.tsx` (add helper functions)
- **Action**: modify (add to Discussion.tsx)
- **What**:
  - Add `positionToStance()` function:
    ```typescript
    function positionToStance(position: PositionType): "bull" | "bear" | "neutral" {
      if (position === "long") return "bull"
      if (position === "short") return "bear"
      return "neutral"
    }
    ```
  - Add `kindToPostType()` function:
    ```typescript
    function kindToPostType(kind: PostKind): "argument" | "evidence" | "rebuttal" | "analysis" {
      if (kind === "rebuttal") return "rebuttal"
      if (kind === "evidence") return "evidence"
      if (kind === "catalyst") return "analysis"
      return "argument"
    }
    ```
- **Why**: Converts UI types to Nostr tag values; keeps conversion logic local to component.

### `src/services/nostrService.ts` (integrate with existing)
- **Action**: verify / modify
- **What**:
  - Ensure `publishEvent(content: string, tags: string[][]): Promise<{ eventId: string; error?: string }>` exists and:
    - Uses NDK to create kind 1 event with provided tags
    - Publishes to configured relays
    - Returns event ID on success or error string on failure
  - Ensure `fetchEvents(filters: any): Promise<NostrEvent[]>` exists for post refresh
- **Why**: Centralizes Nostr publishing; decouples UI from NDK details.

## Execution Order

### Phase 1: Preparation
1. Verify that `src/context/NostrContext.tsx` exists and exports `useNostr()` hook
   - Hook should provide: `{ pubkey: string | null, ndk: NDK }`
   - Verify: `grep -n "useNostr\|useContext" src/context/NostrContext.tsx`

2. Verify that `src/services/nostrService.ts` exists with `publishEvent()` function
   - Should accept: `(content: string, tags: string[][]) => Promise<{ eventId: string; error?: string }>`
   - Verify: `grep -n "publishEvent\|export function" src/services/nostrService.ts`

3. Identify the parent component that wraps `Discussion` (likely `DiscussPage.tsx`)
   - Verify: Find where `<Discussion />` is rendered and check route parameters available

### Phase 2: Add Helper Functions
4. Add `positionToStance()` and `kindToPostType()` helper functions to `src/Discussion.tsx`
   - Verify: Functions are defined and convert correctly (e.g., "long" → "bull", "claim" → "argument")

### Phase 3: Integrate Nostr Publishing
5. Update `handleSubmit()` in `src/Discussion.tsx`:
   - Add `const { pubkey } = useNostr()` at top of component
   - Add auth check at start of `handleSubmit`: `if (!pubkey) return`
   - Add content validation: `if (!content || content.length > 500)`
   - Build tags array with market ID, stance, and type
   - Call `publishEvent()` and handle success/error
   - Verify: Console logs show event tags correctly structured with market ID, stance, type

6. Add state for publishing status and errors:
   - Add `isPublishing`, `publishError`, `replyToEventId` to component state
   - Update these during publish cycle
   - Verify: Button shows loading spinner when `isPublishing`; error message displays on failure

7. Update form rendering to show auth state and errors:
   - Show "Sign in to post" message if `!pubkey`
   - Disable submit button if `!pubkey` or `isPublishing`
   - Display `publishError` below form if present
   - Verify: Form is disabled when logged out; error message appears on publish failure

### Phase 4: Implement Reply Threading
8. Add `handleReply()` and `handleCancelReply()` functions:
   - `handleReply()` stores parent event ID and focuses form
   - `handleCancelReply()` clears reply context
   - Verify: Clicking reply sets visual "Replying to..." header; cancel clears it

9. Add reply buttons to posts (in the post rendering section around line 372):
   - Each post displays "Reply" button
   - Clicking calls `handleReply(post.id, post.eventId, post.authorPubkey)`
   - Verify: Reply button is clickable; clicking updates form header

10. Encode parent event ID in tags:
    - In `handleSubmit`, if `replyToEventId` is set, add `["e", replyToEventId]` to tags
    - Verify: Publish a reply and inspect event; e-tag contains parent event ID

### Phase 5: Post Refresh & UX Polish
11. After successful publish, refresh the post list:
    - Call post-fetching function from Real Post Fetching plan (e.g., `refetchPosts()` or re-subscribe)
    - Time refresh to happen 1–2 seconds after publish to allow relay propagation
    - Verify: New post appears in discussion thread shortly after publish

12. Polish error handling and edge cases:
    - Catch network errors from `publishEvent()` and show user-friendly message
    - Retain draft on error for retry (don't clear form)
    - Debounce rapid successive submits to prevent duplicate events
    - Verify: Disconnect relay, attempt publish, error displays, draft is retained for retry

### Phase 6: Testing
13. End-to-end manual test:
    - [ ] Not logged in: Form visible, submit disabled, "Sign in to post" message shows
    - [ ] Logged in, new post: Submit triggers loading state, draft appears, event publishes, post refreshes in thread
    - [ ] Reply flow: Click reply, form shows "Replying to [author]", submit encodes parent event ID
    - [ ] Validation: Empty post blocked; 501+ char post rejected
    - [ ] Error handling: Disconnect relay, submit, error displays, draft kept for retry
    - [ ] Refresh: Publish post, refresh page, post still visible

## Verification

**Automated Checks:**
- [ ] `grep -n "useNostr" src/Discussion.tsx` — confirms hook import
- [ ] `grep -n "positionToStance\|kindToPostType" src/Discussion.tsx` — confirms helpers exist
- [ ] Inspect published event in relay: contains `d`, `market`, `stance`, `type` tags
- [ ] Inspect reply event: contains `["e", parentEventId]` tag

**Manual Testing:**
- [ ] Not logged in: form disabled with explanation, no error spam
- [ ] Logged in, submit post: optimistic draft appears, loading state shows, event publishes
- [ ] Publish success: draft removed (or updates), form cleared, new post visible in thread
- [ ] Publish error: error message displays, draft retained, button re-enabled for retry
- [ ] Reply: click reply, form shows context, submit creates child event with e-tag
- [ ] Content validation: oversized post rejected before publish attempt

**Edge Cases:**
- Network drops mid-publish: graceful error, draft retained
- User logs out while publishing: handle auth error
- Rapid consecutive submits: debounce or disable to prevent duplicates
- Reply to deleted post: publish succeeds but e-tag references missing event (graceful)
- Very long posts (near 500 char): accepted; over 500 char: rejected with message

