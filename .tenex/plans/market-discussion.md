# Market Discussion Feature

## Context

The Market Detail page (`src/routes/market/[marketId]/+page.svelte`) contains a "Discussion" tab (line 359-375) that currently shows a placeholder message: "No discussions yet — Be the first to start a discussion about this market."

**Existing Backend Infrastructure (Already Implemented):**
- `publishMarketPost(title, content, stance, type, marketEventId, marketCreatorPubkey)` — line 185-203 in `nostrService.ts`
- `publishMarketReply(content, parentEventId, rootEventId, parentAuthorPubkey)` — line 209-222
- `fetchMarketPosts(marketEventId, limit=100)` — line 227-235 (returns NDKEvent[])
- `subscribeToMarketPosts(marketEventId, callback)` — line 241-250 (real-time updates)
- `parseEventTags(event)` — line 255-297 (extracts stance, type, threading info)
- `fetchReactions(eventIds)` — line 321-343 (NIP-25 upvotes/downvotes)
- `subscribeToReactions(eventIds, callback)` — line 350-366 (real-time reactions)
- `resolveAuthorName(pubkey)` — line 372-387 (converts pubkey to npub + display name)

**Event Schema (Kind 1111 NIP-22):**
- Root posts: `[["e", marketEventId, "", "root"], ["k", "982"], ["p", marketCreatorPubkey], ["stance", "bull|bear|neutral"], ["type", "argument|evidence|rebuttal|analysis"], ["subject", title]]`
- Replies: `[["e", rootEventId, "", "root"], ["e", parentEventId, "", "reply"], ["k", "1111"], ["p", parentAuthorPubkey]]`

**Auth & Store Pattern:**
- `nostrStore` (line 57-66 in `src/lib/stores/nostr.ts`) provides `pubkey` and `isReady` state
- Login detection: `$derived(pubkey !== null)` (pattern used in NavHeader.svelte:65)
- NIP-07 signer auto-detects from browser extension; no additional auth needed

**Existing Component Patterns:**
- `ReplyThread.svelte` (src/lib/components/): Threaded reply component with collapsing, reply form, vote buttons — can be adapted or referenced for threading
- `NavHeader.svelte` (line 67-71): Author display as `pubkey.slice(0, 4).toUpperCase()` or display name fallback
- Tab management: `activeTab = $state<MarketTab>()` with conditional rendering (lines 23, 79, 243-415)
- Design: borderless, dark neutral-950/800 bg, no cards, Tailwind only, emerald/rose accents, font-mono for numbers

## Approach

Build a flat-list discussion UI for the Discussion tab with these MVP features:

1. **Post List Component** (`MarketDiscussionList.svelte`) — Fetches kind:1111 events on mount, displays sorted by newest first, shows author, timestamp, stance, type, content, upvote/downvote counts. Supports loading, error, and empty states. Does NOT fetch on-scroll pagination — use limit=100 for MVP.

2. **New Post Form** (`MarketDiscussionForm.svelte`) — Shows only when logged in. Text input for content (no title field for MVP; posts are titled implicitly by market context), dropdown selectors for stance (bull/bear/neutral) and type (argument/evidence/rebuttal/analysis). Publish button disabled when submitting or content empty. Shows error/success feedback.

3. **Post Item Display** (`MarketDiscussionPost.svelte`) — Compact inline layout: author (npub or name), timestamp, stance/type badges, content, upvote/downvote buttons. No nested replies in MVP; focus on clean, scannable post list.

4. **Real-Time Updates** — Use `subscribeToMarketPosts()` on component mount to listen for new posts in real-time; append to visible list. Clean up subscription on unmount.

5. **Reactions (Upvotes/Downvotes)** — Fetch initial reaction counts for all posts using `fetchReactions()`. Subscribe to new reactions using `subscribeToReactions()` for live count updates. Single click toggles user's reaction (requires tracking published reactions locally to avoid duplicate publishes).

6. **Auth Gating** — Show post form only when `$derived(pubkey !== null)`. Replace empty state with CTA "Sign in to start a discussion" in read-only mode.

**Why This Approach:**

- **Flat list (MVP)** — Simpler state management and rendering than threaded replies. Can extend to threaded replies in Phase 2 by using `replyTo` field and ReplyThread component pattern.
- **Real-time** — Subscribe-based architecture matches existing Nostr patterns in the codebase and provides live feedback to users. Non-realtime version would feel stale.
- **No pagination (MVP)** — Kind 1111 discussion posts are expected to be low-volume per market. Limit=100 is reasonable; if pagination needed, add lazy-load-on-scroll in Phase 2.
- **Reaction counts** — NIP-25 reactions (kind 7) already exist in the service. Including counts provides quick sentiment feedback without threading complexity.
- **No deletion UI (MVP)** — Kind 5 delete events exist in the service but are complex (hide own posts, manage visibility). Add in Phase 2 if user feedback demands it.

## File Changes

### `src/lib/components/MarketDiscussionList.svelte`
- **Action**: create
- **What**: Main container component that fetches and displays discussion posts. Imports MarketDiscussionForm, MarketDiscussionPost. Manages posts state, loading/error states, subscriptions to real-time post and reaction updates. Implements cleanup on unmount.
- **Why**: Central orchestrator for discussion feature; separates data loading/management from display logic.

### `src/lib/components/MarketDiscussionForm.svelte`
- **Action**: create
- **What**: Form for publishing new market discussion posts. Text input for content, dropdowns for stance (bull/bear/neutral) and type (argument/evidence/rebuttal/analysis). Calls `publishMarketPost()` with required market/creator data. Shows loading state during publish, error messages, resets form on success. Visible only when logged in (`pubkey !== null`).
- **Why**: Encapsulates post creation UI and user interaction; reusable if discussion feature extends to other pages.

### `src/lib/components/MarketDiscussionPost.svelte`
- **Action**: create
- **What**: Displays a single discussion post. Renders author (npub or display name via `resolveAuthorName()`), timestamp (formatted as time-ago), stance/type badges (small pills: emerald for bull, rose for bear, neutral-500 for neutral), content preview, upvote/downvote button counts and interactions. Does NOT show nested replies in MVP.
- **Why**: Reusable post item component; clean separation of post display from list logic. Can extend for replies in Phase 2.

### `src/lib/components/MarketDiscussionEmpty.svelte`
- **Action**: create
- **What**: Empty state component shown when no posts exist. If logged in: "No discussions yet — Be the first to add your thoughts below." If logged out: "No discussions yet — Sign in to join the conversation."
- **Why**: Cleaner templating; reusable empty state pattern.

### `src/routes/market/[marketId]/+page.svelte`
- **Action**: modify
- **What**: Replace discussion tab placeholder (lines 359-375) with `<MarketDiscussionList market={market} />` component. Import at top.
- **Why**: Activate the feature on the page.

## Execution Order

1. **Create MarketDiscussionPost.svelte** — Start with the simplest component: post display logic (author name resolution, time-ago formatting, stance/type badge styling). Does not manage state or interact with Nostr.

2. **Create MarketDiscussionEmpty.svelte** — Empty state display; depends on auth state (login check via props).

3. **Create MarketDiscussionForm.svelte** — Form component for new posts. Integrate `publishMarketPost()`, handle loading/error states, validate inputs. Does not fetch or subscribe yet.

4. **Create MarketDiscussionList.svelte** — Main orchestrator. Implement post fetching on mount (`fetchMarketPosts()`), real-time subscription (`subscribeToMarketPosts()`), reaction fetching (`fetchReactions()`), reaction subscription (`subscribeToReactions()`). Assemble post list from NDKEvent[]. Pass market context (eventId, creator pubkey) down to child components. Manage cleanup on unmount.

5. **Integrate into +page.svelte** — Replace placeholder with `<MarketDiscussionList market={market} />`. Verify tab switching and component lifecycle.

6. **Verification** — Load a market, verify posts render correctly, test new post form (if logged in), test auth gating (show form only when signed in), test real-time updates by opening multiple tabs/windows and publishing a new post.

## Verification

### Build & Type Check
```bash
npm run build
# Should complete without errors; TypeScript should pass.
```

### Component Rendering
1. Open a market detail page with the discussion tab.
2. Verify discussion tab shows either:
   - Empty state if no posts exist
   - List of posts sorted by newest first if posts exist
3. Verify post items show: author (npub or display name), timestamp, stance/type badges, content, upvote/downvote counts.

### Auth Gating
1. **Logged out**: Verify post form is hidden; empty state shows "Sign in to join the conversation."
2. **Logged in**: Verify post form is visible below post list; can type content, select stance/type, click publish.

### Real-Time
1. Open same market in two browser windows.
2. Publish a new post in window 1.
3. Verify post appears in window 2 within seconds (no refresh needed).
4. Publish an upvote on the new post in window 2.
5. Verify upvote count increments in window 1 in real-time.

### Edge Cases
- Empty post list: Verify empty state displays correctly.
- Author resolution: Verify pubkey displays as npub fallback if profile fetch fails.
- Long content: Verify content text wraps correctly (no overflow).
- Rapid publishes: Verify multiple posts published in succession all appear (no lost events).
- Network slow: Verify loading spinner shows while fetching initial posts.
- Subscription cleanup: Verify browser dev tools show no active subscriptions after navigating away from discussion tab.
