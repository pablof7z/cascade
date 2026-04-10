<script lang="ts">
  import NavHeader from '$lib/components/NavHeader.svelte'
  import { nostrStore } from '$lib/stores/nostr'
  import { isReady, fetchMarketPosts, subscribeToMarketPosts } from '../../services/nostrService'
  import { fetchAllMarkets } from '../../services/marketService'
  import { buildThreadHierarchy, convertSingleEventToThread } from '../../lib/threadBuilder'
  import type { DiscussionThread, Reply } from '../../DiscussPage'
  import type { Market } from '../../market'
  import { goto } from '$app/navigation'

  // Types for aggregated discussions with market context
  interface MarketDiscussion {
    thread: DiscussionThread
    market: Market
  }

  // Sort options
  type SortOption = 'newest' | 'oldest' | 'most_replies' | 'most_upvotes' | 'hot' | 'controversial'

  // Auth state
  let pubkey = $state<string | null>(null)

  $effect(() => {
    pubkey = nostrStore.get().pubkey
  })

  // State
  let discussions = $state<MarketDiscussion[]>([])
  let markets = $state<Map<string, Market>>(new Map())
  let nostrReady = $state(false)
  let isLoading = $state(true)

  // Filters and sorting
  let sortBy = $state<SortOption>('newest')
  let searchQuery = $state('')

  // Track unsubscribe functions for memory leak fix (NOT $state - plain variable)
  let activeUnsubscribes: (() => void)[] = []

  // Derived filtered and sorted discussions
  let filteredDiscussions = $derived.by(() => {
    let result = discussions.filter(d => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesTitle = d.thread.title.toLowerCase().includes(query)
        const matchesContent = d.thread.content.toLowerCase().includes(query)
        const matchesMarket = d.market.title?.toLowerCase().includes(query)
        if (!matchesTitle && !matchesContent && !matchesMarket) {
          return false
        }
      }

      return true
    })

    // Sort
    switch (sortBy) {
      case 'newest':
        result.sort((a, b) => b.thread.timestamp - a.thread.timestamp)
        break
      case 'oldest':
        result.sort((a, b) => a.thread.timestamp - b.thread.timestamp)
        break
      case 'most_replies':
        result.sort((a, b) => countReplies(b.thread) - countReplies(a.thread))
        break
      case 'most_upvotes':
        result.sort((a, b) => b.thread.upvotes - a.thread.upvotes)
        break
      case 'hot': {
        const now = Date.now()
        result.sort((a, b) => {
          const aVotes = Math.max(0, a.thread.upvotes - a.thread.downvotes)
          const bVotes = Math.max(0, b.thread.upvotes - b.thread.downvotes)
          const aHours = (now - a.thread.timestamp) / 3600000
          const bHours = (now - b.thread.timestamp) / 3600000
          const aHot = aVotes / Math.pow(aHours + 2, 1.5)
          const bHot = bVotes / Math.pow(bHours + 2, 1.5)
          return bHot - aHot
        })
        break
      }
      case 'controversial':
        result = result.filter(d => d.thread.upvotes > 0 && d.thread.downvotes > 0)
        result.sort((a, b) => {
          const aScore = Math.min(a.thread.upvotes, a.thread.downvotes) / (a.thread.upvotes + a.thread.downvotes)
          const bScore = Math.min(b.thread.upvotes, b.thread.downvotes) / (b.thread.upvotes + b.thread.downvotes)
          return bScore - aScore
        })
        break
    }

    return result
  })

  // Count all replies recursively
  function countReplies(reply: Reply | DiscussionThread): number {
    return (reply.replies?.reduce((sum, r) => sum + 1 + countReplies(r), 0) ?? 0)
  }

  // Format relative time
  function formatRelativeTime(timestamp: number): string {
    const now = Date.now()
    const diff = now - timestamp
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'just now'
  }

  // Navigate to thread
  function goToThread(market: Market, threadId: string): void {
    goto(`/thread/${market.slug}--${market.creatorPubkey.slice(0, 12)}?threadId=${threadId}`)
  }

  // Fetch discussions from all markets
  async function fetchAllDiscussions(): Promise<(() => void)[]> {
    if (!nostrReady) return []

    const unsubscribes: (() => void)[] = []
    try {
      // First fetch all markets
      const allMarkets = await fetchAllMarkets(50)

      // Build market map
      markets = new Map(allMarkets.map(m => [m.eventId, m]))

      // Fetch posts for each market
      const allThreads: MarketDiscussion[] = []
      await Promise.all(
        allMarkets.map(async (market) => {
          if (!market.eventId) return

          try {
            const events = await fetchMarketPosts(market.eventId)
            const threads = await buildThreadHierarchy(events, market.eventId)

            for (const thread of threads) {
              allThreads.push({ thread, market })
            }

            // Subscribe to live updates for this market
            const sub = subscribeToMarket(market.eventId, market)
            if (sub) unsubscribes.push(() => sub.stop())
          } catch (err) {
            console.error(`[Discuss] Error fetching posts for market ${market.slug}:`, err)
          }
        })
      )

      discussions = allThreads
      isLoading = false
      return unsubscribes
    } catch (err) {
      console.error('[Discuss] Error fetching discussions:', err)
      isLoading = false
      return unsubscribes
    }
  }

  // Subscribe to live updates for a market
  function subscribeToMarket(marketEventId: string, market: Market) {
    try {
      const sub = subscribeToMarketPosts(marketEventId, async (event) => {
        // Check if this is a root post (not a reply)
        const tags = event.tags
        const hasReplyTag = tags.some(t => t[0] === 'e' && t[3] === 'reply')

        if (!hasReplyTag) {
          // New root post
          const thread = await convertSingleEventToThread(event)
          const exists = discussions.some(
            d => d.thread.id === thread.id && d.market.eventId === market.eventId
          )
          if (!exists) {
            discussions = [...discussions, { thread, market }]
          }
        }
      })
      return sub
    } catch (err) {
      console.error(`[Discuss] Error subscribing to market ${market.slug}:`, err)
    }
  }

  // Wait for Nostr to be ready, then fetch and subscribe for updates
  // isReady() is not reactive — poll until true
  $effect(() => {
    if (nostrReady) return

    if (isReady()) {
      nostrReady = true
    } else {
      const interval = setInterval(() => {
        if (isReady()) {
          nostrReady = true
          clearInterval(interval)
        }
      }, 100)
      return () => clearInterval(interval)
    }
  })

  $effect(() => {
    if (!nostrReady) return

    // Clean up previous subscriptions before setting up new ones
    activeUnsubscribes.forEach(unsub => unsub())
    activeUnsubscribes = []

    // Initial fetch and subscribe to live updates
    fetchAllDiscussions().then((newUnsubscribes) => {
      activeUnsubscribes = newUnsubscribes
      isLoading = false
    })

    return () => {
      // Cleanup: unsubscribe from all market subscriptions
      activeUnsubscribes.forEach((unsub) => unsub())
      activeUnsubscribes = []
    }
  })
</script>

<svelte:head>
  <title>Discussion | Cascade</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950">
  <NavHeader />
  <!-- Header -->
  <div class="border-b border-neutral-800">
    <div class="max-w-5xl mx-auto px-4 py-6">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-sans text-white">Discussions</h1>
        <a
          href={pubkey ? '/thesis/new' : '/join'}
          class="text-sm text-neutral-400 hover:text-white border border-neutral-700 px-3 py-1.5"
        >
          Create market
        </a>
      </div>

      <!-- Filters and Sorting -->
      <div class="flex flex-wrap gap-4 items-center">
        <!-- Search -->
        <div class="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search discussions..."
            bind:value={searchQuery}
            class="w-full bg-neutral-800 border border-neutral-700 text-neutral-200 placeholder-neutral-500 px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
          />
        </div>

        <!-- Sort -->
        <div class="flex items-center gap-1 flex-wrap">
          <span class="text-neutral-500 text-xs mr-1">Sort:</span>
          {#each [['newest', 'New'], ['most_upvotes', 'Top'], ['hot', 'Hot'], ['controversial', 'Controversial']] as [val, label]}
            <button
              onclick={() => sortBy = val as SortOption}
              class={sortBy === val
                ? 'text-xs text-white border-b border-white px-2 py-1'
                : 'text-xs text-neutral-500 hover:text-neutral-300 px-2 py-1'}
            >{label}</button>
          {/each}
        </div>

      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-5xl mx-auto px-4 py-6">
    {#if isLoading}
      <div class="py-20 text-center text-neutral-600 text-sm">Loading discussions…</div>
    {:else if filteredDiscussions.length === 0}
      <div class="flex flex-col items-center justify-center py-20">
        <span class="text-neutral-500 text-sm mb-4">No discussions found</span>
        {#if searchQuery}
          <button
            onclick={() => { searchQuery = ''; }}
            class="text-neutral-400 hover:text-white text-sm"
          >
            Clear filters
          </button>
        {/if}
      </div>
    {:else}
      <div class="divide-y divide-neutral-800">
        {#each filteredDiscussions as { thread, market } (thread.id)}
          <button
            onclick={() => goToThread(market, thread.id)}
            class="w-full text-left py-4 hover:bg-neutral-900/50 transition-colors"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <!-- Thread title -->
                <h3 class="text-white font-medium mb-1 line-clamp-2">
                  {thread.title}
                </h3>

                <!-- Market name -->
                <div class="text-neutral-500 text-xs mb-2">
                  in {market.title || 'Unknown Market'}
                </div>

                <!-- Content preview -->
                <p class="text-neutral-400 text-sm line-clamp-2 mb-3">
                  {thread.content.replace(/\n.+$/, '...')}
                </p>

                <!-- Meta info -->
                <div class="flex items-center gap-3 text-xs text-neutral-500">
                  <span>{thread.author}</span>
                  <span>·</span>
                  <span>{formatRelativeTime(thread.timestamp)}</span>
                  <span>·</span>
                  <span>{countReplies(thread)} {countReplies(thread) === 1 ? 'reply' : 'replies'}</span>
                </div>
              </div>

              <!-- Upvotes -->
              <div class="flex items-center gap-1 text-xs text-neutral-500">
                <span>▲</span>
                <span>{thread.upvotes}</span>
              </div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  </div>
</div>
