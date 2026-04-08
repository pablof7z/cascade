<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { isReady, fetchMarketPosts, publishMarketReply, fetchReactions, subscribeToReactions } from '../../../services/nostrService';
  import { buildThreadHierarchy } from '../../../lib/threadBuilder';
  import { trackDiscussionInteraction } from '../../../analytics';
  import { priceLong } from '../../../market';
  import OriginalPost from '../../../lib/components/OriginalPost.svelte';
  import ReplyThread from '../../../lib/components/ReplyThread.svelte';
  
  // Types
  interface Reply {
    id: string
    author: string
    pubkey: string
    isAgent: boolean
    content: string
    timestamp: number
    upvotes: number
    downvotes: number
    replies: Reply[]
  }
  
  interface DiscussionThread {
    id: string
    author: string
    pubkey: string
    isAgent: boolean
    content: string
    timestamp: number
    upvotes: number
    downvotes: number
    title: string
    stance: 'bull' | 'bear' | 'neutral'
    type: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    evidence?: string[]
    replies: Reply[]
  }

  // Props from loader
  let { data } = $props();
  let market = $derived(data.market);

  // Route params
  let marketId = $derived($page.params.marketId);
  let threadId = $derived($page.params.threadId);

  // State
  let threads = $state<DiscussionThread[]>([]);
  let nostrReady = $state(false);

  // Recursively collect all event IDs
  function collectEventIds(thread: DiscussionThread): string[] {
    const ids: string[] = [thread.id];
    function collectFromReplies(replies: Reply[]) {
      for (const r of replies) {
        ids.push(r.id);
        collectFromReplies(r.replies);
      }
    }
    collectFromReplies(thread.replies);
    return ids;
  }

  // Apply reaction counts
  function applyReactionCounts(
    threads: DiscussionThread[],
    counts: Map<string, { upvotes: number; downvotes: number }>,
  ): DiscussionThread[] {
    function applyToReplies(replies: Reply[]): Reply[] {
      return replies.map((r) => {
        const c = counts.get(r.id);
        return {
          ...r,
          upvotes: c ? c.upvotes : r.upvotes,
          downvotes: c ? c.downvotes : r.downvotes,
          replies: applyToReplies(r.replies),
        };
      });
    }
    return threads.map((t) => {
      const c = counts.get(t.id);
      return {
        ...t,
        upvotes: c ? c.upvotes : t.upvotes,
        downvotes: c ? c.downvotes : t.downvotes,
        replies: applyToReplies(t.replies),
      };
    });
  }

  // Track interaction on mount
  $effect(() => {
    if (marketId && threadId) {
      trackDiscussionInteraction(marketId, 'view_thread');
    }
  });

  // Fetch thread data
  $effect(() => {
    if (!nostrReady || !marketId) return;
    
    if (!market) return;
    
    const marketEventId = market.eventId;
    if (!marketEventId) return;
    
    let cancelled = false;

    fetchMarketPosts(marketEventId)
      .then((events) => buildThreadHierarchy(events, marketEventId))
      .then(async (built) => {
        if (cancelled) return;
        threads = built;
        
        const allIds = built.flatMap(collectEventIds);
        if (allIds.length === 0) return;
        
        try {
          const counts = await fetchReactions(allIds);
          if (!cancelled) {
            threads = applyReactionCounts(threads, counts);
          }
        } catch (err) {
          console.error('[ThreadPage] fetchReactions error:', err);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  });

  // Subscribe to reaction updates
  $effect(() => {
    if (!nostrReady || !marketId) return;
    if (threads.length === 0) return;

    const allIds = threads.flatMap(collectEventIds);
    if (allIds.length === 0) return;

    let sub: ReturnType<typeof subscribeToReactions> | null = null;
    try {
      sub = subscribeToReactions(allIds, (eventId, content) => {
        threads = threads.map(t => {
          function findAndUpdate(replies: Reply[]): Reply[] {
            return replies.map(r => {
              if (r.id === eventId) {
                return {
                  ...r,
                  upvotes: content === '+' ? r.upvotes + 1 : r.upvotes,
                  downvotes: content === '-' ? r.downvotes + 1 : r.downvotes,
                  replies: findAndUpdate(r.replies),
                };
              }
              return { ...r, replies: findAndUpdate(r.replies) };
            });
          }
          
          if (t.id === eventId) {
            return {
              ...t,
              upvotes: content === '+' ? t.upvotes + 1 : t.upvotes,
              downvotes: content === '-' ? t.downvotes + 1 : t.downvotes,
            };
          }
          return { ...t, replies: findAndUpdate(t.replies) };
        });
      });
    } catch (err) {
      console.error('[ThreadPage] subscribeToReactions error:', err);
    }

    return () => {
      sub?.stop();
    };
  });

  // Wait for Nostr to be ready
  $effect(() => {
    if (isReady()) {
      nostrReady = true;
    }
  });

  // Get probability, thread, and market URL
  let probability = $derived(market ? priceLong(market.qLong, market.qShort, market.b) : 0);
  let thread = $derived(threads.find((t) => t.id === threadId));
  let marketSlug = $derived(market ? `${market.slug}--${market.creatorPubkey.slice(0, 12)}` : marketId);
</script>

<svelte:head>
  <title>Discussion | Cascade</title>
</svelte:head>

{#if !market}
  <div class="min-h-screen bg-neutral-950 flex items-center justify-center">
    <span class="text-neutral-500 text-sm">Market not found...</span>
  </div>
{:else if !thread}
  <div class="min-h-screen bg-neutral-950 flex items-center justify-center">
    <span class="text-neutral-500 text-sm">Thread not found...</span>
    <button onclick={() => goto(market ? `/mkt/${marketSlug}/discussion` : `/mkt/${marketId}`)} class="ml-4 text-neutral-400 hover:text-white">
      Back to discussion
    </button>
  </div>
{:else}
  <div class="min-h-screen bg-neutral-950">
    <div class="max-w-4xl mx-auto px-4 pb-32">
      <!-- Breadcrumb -->
      <div class="py-4 border-b border-neutral-800">
        <div class="flex items-center gap-2 text-sm text-neutral-500">
          <a href={`/mkt/${marketSlug}`} class="hover:text-neutral-300">
            {market?.title?.slice(0, 40) || 'Market'}{market?.title && market.title.length > 40 ? '...' : ''}
          </a>
          <span>›</span>
          <a href={`/mkt/${marketSlug}/discussion`} class="hover:text-neutral-300">
            Discussion
          </a>
          <span>›</span>
          <span class="text-neutral-400">Thread</span>
        </div>
      </div>
      
      <!-- Original Post -->
      <div class="py-6">
        <OriginalPost {thread} marketId={marketId!} />
      </div>
      
      <!-- Replies section -->
      <div class="border-t border-neutral-800 pt-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-sm font-medium text-neutral-400">
            {thread.replies.length} {thread.replies.length === 1 ? 'Reply' : 'Replies'}
          </h2>
          <select class="bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs px-2 py-1">
            <option>Best</option>
            <option>New</option>
            <option>Old</option>
            <option>Controversial</option>
          </select>
        </div>
        
        <!-- Threaded replies -->
        <div class="space-y-1">
          {#each thread.replies as reply (reply.id)}
            <ReplyThread {reply} depth={0} marketId={marketId!} rootId={thread.id} />
          {/each}
        </div>
        
        {#if thread.replies.length === 0}
          <div class="py-8 text-center text-neutral-500">
            <p>No replies yet. Be the first to respond!</p>
          </div>
        {/if}
      </div>
    </div>
    
    <!-- Sticky betting footer -->
    <div class="fixed bottom-0 left-0 right-0 bg-neutral-900/95 backdrop-blur border-t border-neutral-800 z-50">
      <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div class="flex items-center gap-6">
          <div>
            <div class="text-xs text-neutral-500">Current probability</div>
            <div class="flex items-baseline gap-2">
              <span class="text-2xl font-bold text-emerald-500">{Math.round(probability * 100)}%</span>
              <span class="text-sm text-neutral-500">YES</span>
            </div>
          </div>
          <div class="hidden sm:block">
            <div class="text-xs text-neutral-500">Volume</div>
            <div class="text-sm text-white">${market?.reserve?.toFixed(0) || '0'}</div>
          </div>
        </div>
        <div class="flex gap-2">
          <a
            href={`/mkt/${formatMarketSlug(market)}`}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
          >
            Buy YES
          </a>
          <a
            href={`/mkt/${formatMarketSlug(market)}`}
            class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-medium"
          >
            Buy NO
          </a>
        </div>
      </div>
    </div>
  </div>
{/if}
