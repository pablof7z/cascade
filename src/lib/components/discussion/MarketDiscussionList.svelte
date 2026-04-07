<script lang="ts">
  import { onMount } from 'svelte';
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import {
    fetchMarketPosts,
    subscribeToMarketPosts,
    fetchReactions,
    subscribeToReactions,
    parseEventTags,
  } from '../../../services/nostrService';
  import { nostrStore } from '$lib/stores/nostr';
  import MarketDiscussionPost from './MarketDiscussionPost.svelte';
  import MarketDiscussionEmpty from './MarketDiscussionEmpty.svelte';
  import MarketDiscussionForm from './MarketDiscussionForm.svelte';
  import type { Market } from '../../../market';

  interface Props {
    market: Market;
  }

  let { market }: Props = $props();

  // Auth state
  let pubkey = $state<string | null>(null);
  let isLoggedIn = $derived(pubkey !== null);

  // Posts state - Map for O(1) duplicate detection, derive sorted array for display
  let postsMap = $state<Map<string, NDKEvent>>(new Map());
  let posts = $derived(
    Array.from(postsMap.values())
      .sort((a, b) => b.createdAt - a.createdAt)
  );

  // Reactions state - Map<eventId, { upvotes, downvotes }>
  let reactionsMap = $state<Map<string, { upvotes: number; downvotes: number }>>(new Map());

  // Published reactions set (session-only, prevents duplicate publishes)
  let publishedReactions = $state<Set<string>>(new Set());

  // Loading and error states
  let loading = $state(true);
  let error = $state<string | null>(null);

  // Subscriptions
  let postsSubscription: ReturnType<typeof subscribeToMarketPosts> | null = null;
  let reactionsSubscription: ReturnType<typeof subscribeToReactions> | null = null;

  // Subscribe to nostr store for auth state
  $effect(() => {
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
    });
    return unsubscribe;
  });

  // Handle new post from subscription
  function handleNewPost(event: NDKEvent) {
    // Check if this is a root post (not a reply)
    const tags = parseEventTags(event);
    if (!tags.isRoot) return; // Only show root posts in MVP

    // Duplicate detection - only add if not already in Map
    if (!postsMap.has(event.id)) {
      postsMap = new Map(postsMap).set(event.id, event);
    }
  }

  // Handle new reaction from subscription
  function handleNewReaction(eventId: string, content: '+' | '-') {
    const current = reactionsMap.get(eventId) ?? { upvotes: 0, downvotes: 0 };
    const updated = { ...current };
    if (content === '+') updated.upvotes++;
    else if (content === '-') updated.downvotes++;
    reactionsMap = new Map(reactionsMap).set(eventId, updated);
  }

  // Handle vote button click
  function handleReact(eventId: string, content: '+' | '-') {
    // Session-only duplicate prevention
    const key = `${eventId}:${content}`;
    if (publishedReactions.has(key)) return;
    publishedReactions = new Set(publishedReactions).add(key);

    // Trigger the reaction - the subscription will update counts
    // For now, optimistically update
    const current = reactionsMap.get(eventId) ?? { upvotes: 0, downvotes: 0 };
    const updated = { ...current };
    if (content === '+') updated.upvotes++;
    else if (content === '-') updated.downvotes++;
    reactionsMap = new Map(reactionsMap).set(eventId, updated);
  }

  // Fetch initial data
  async function fetchData() {
    loading = true;
    error = null;

    try {
      // Fetch posts
      const posts = await fetchMarketPosts(market.eventId);

      // Filter to root posts only (MVP - no replies)
      const rootPosts = posts.filter((post) => {
        const tags = parseEventTags(post);
        return tags.isRoot;
      });

      // Build posts map
      const newPostsMap = new Map<string, NDKEvent>();
      for (const post of rootPosts) {
        newPostsMap.set(post.id, post);
      }
      postsMap = newPostsMap;

      // Fetch reactions for all posts
      if (rootPosts.length > 0) {
        const eventIds = rootPosts.map((p) => p.id);
        const reactions = await fetchReactions(eventIds);

        // Build reactions map
        const newReactionsMap = new Map<string, { upvotes: number; downvotes: number }>();
        for (const [id, counts] of reactions) {
          newReactionsMap.set(id, counts);
        }
        reactionsMap = newReactionsMap;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load discussions';
    } finally {
      loading = false;
    }
  }

  // Set up subscriptions
  function setupSubscriptions() {
    // Subscribe to new posts
    postsSubscription = subscribeToMarketPosts(market.eventId, handleNewPost);

    // Subscribe to reactions for all current posts
    if (postsMap.size > 0) {
      const eventIds = Array.from(postsMap.keys());
      reactionsSubscription = subscribeToReactions(eventIds, handleNewReaction);
    }
  }

  // Clean up subscriptions
  function cleanupSubscriptions() {
    if (postsSubscription) {
      postsSubscription.abort();
      postsSubscription = null;
    }
    if (reactionsSubscription) {
      reactionsSubscription.abort();
      reactionsSubscription = null;
    }
  }

  // On mount: fetch data and set up subscriptions
  onMount(() => {
    fetchData().then(() => {
      setupSubscriptions();
    });

    return () => {
      cleanupSubscriptions();
    };
  });

  // Refresh after posting
  function handlePostPublished() {
    fetchData();
  }
</script>

<div>
  <!-- Loading state -->
  {#if loading}
    <div class="py-12 text-center">

    </div>
  <!-- Error state -->
  {:else if error}
    <div class="py-12 text-center">
      <div class="text-rose-400">Failed to load discussions</div>
      <p class="mt-2 text-sm text-neutral-500">{error}</p>
      <button
        onclick={fetchData}
        class="mt-4 text-sm text-emerald-500 hover:text-emerald-400"
      >
        Try again
      </button>
    </div>
  <!-- Posts list or empty state -->
  {:else if posts.length === 0}
    <MarketDiscussionEmpty {isLoggedIn} />
  {:else}
    <!-- Posts -->
    <div>
      {#each posts as post (post.id)}
        {@const reactions = reactionsMap.get(post.id) ?? { upvotes: 0, downvotes: 0 }}
        <MarketDiscussionPost
          event={post}
          upvotes={reactions.upvotes}
          downvotes={reactions.downvotes}
          marketId={market.eventId}
          onReact={handleReact}
        />
      {/each}
    </div>
  {/if}

  <!-- Post form (only when logged in) -->
  {#if isLoggedIn}
    <MarketDiscussionForm
      marketEventId={market.eventId}
      marketCreatorPubkey={market.creatorPubkey}
      onPostPublished={handlePostPublished}
    />
  {/if}
</div>
