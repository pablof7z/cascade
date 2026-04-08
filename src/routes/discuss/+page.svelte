<script lang="ts">
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
  type SortOption = 'newest' | 'oldest' | 'most_replies' | 'most_upvotes'

  // Filter options
  type StanceFilter = 'all' | 'bullish' | 'bearish' | 'neutral'
  type TypeFilter = 'all' | 'argument' | 'prediction' | 'question' | 'evidence' | 'rebuttal' | 'analysis'

  // State
  let discussions = $state<MarketDiscussion[]>([])
  let markets = $state<Map<string, Market>>(new Map())
  let nostrReady = $state(false)

  // Filters and sorting
  let sortBy = $state<SortOption>('newest')
  let stanceFilter = $state<StanceFilter>('all')
  let typeFilter = $state<TypeFilter>('all')
  let searchQuery = $state('')

  // Track unsubscribe functions for memory leak fix (NOT $state - plain variable)
  let activeUnsubscribes: (() => void)[] = []

  // Derived filtered and sorted discussions
  let filteredDiscussions = $derived.by(() => {
    let result = discussions.filter(d => {
      // Stance filter
      if (stanceFilter !== 'all') {
        const stance = d.thread.stance
        if (stanceFilter === 'bullish' && stance !== 'bullish' && stance !== 'bull') return false
        if (stanceFilter === 'bearish' && stance !== 'bearish' && stance !== 'bear') return false
        if (stanceFilter === 'neutral' && stance !== 'neutral') return false
      }

      // Type filter
      if (typeFilter !== 'all' && d.thread.type !== typeFilter) {
        return false
      }

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
    }

    return result
  })

  // Count all replies recursively
  function countReplies(reply: Reply | DiscussionThread): number {
    return 1 + (reply.replies?.reduce((sum, r) => sum + countReplies(r), 0) ?? 0)
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

  // Get stance badge class
  function getStanceClass(stance: string): string {
    switch (stance) {
      case 'bullish':
      case 'bull':
        return 'bg-emerald-900/50 text-emerald-400'
      case 'bearish':
      case 'bear':
        return 'bg-rose-900/50 text-rose-400'
      default:
        return 'bg-neutral-700 text-neutral-300'
    }
  }

  // Get type label
  function getTypeLabel(type: string): string {
    switch (type) {
      case 'argument': return 'Argument'
      case 'prediction': return 'Prediction'
      case 'question': return 'Question'
      case 'evidence': return 'Evidence'
      case 'rebuttal': return 'Rebuttal'
      case 'analysis': return 'Analysis'
      default: return type
    }
  }

  // Navigate to thread
  function goToThread(market: Market, threadId: string): void {
    const slug = `${market.slug}--${market.creatorPubkey.slice(0, 12)}`
    goto(`/thread/${market.slug}?marketId=${market.slug}&threadId=${threadId}`)
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
            const unsub = subscribeToMarket(market.eventId, market)
            unsubscribes.push(unsub)
          } catch (err) {
            console.error(`[Discuss] Error fetching posts for market ${market.slug}:`, err)
          }
        })
      )

      discussions = allThreads
      return unsubscribes
    } catch (err) {
      console.error('[Discuss] Error fetching discussions:', err)
      return unsubscribes
    } finally {
    }
  }

  // Subscribe to live updates for a market
  function subscribeToMarket(marketEventId: string, market: Market): void {
    try {
      subscribeToMarketPosts(marketEventId, async (event) => {
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
    } catch (err) {
      console.error(`[Discuss] Error subscribing to market ${market.slug}:`, err)
    }
  }

  // Wait for Nostr to be ready, then fetch and subscribe for updates
  $effect(() => {
    if (!isReady()) return

    nostrReady = true

    // Clean up previous subscriptions before setting up new ones
    activeUnsubscribes.forEach(unsub => unsub())
    activeUnsubscribes = []

    // Initial fetch and subscribe to live updates
    fetchAllDiscussions().then((newUnsubscribes) => {
      activeUnsubscribes = newUnsubscribes
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
  <!-- Header -->
  <div class="border-b border-neutral-800">
    <div class="max-w-5xl mx-auto px-4 py-6">
      <h1 class="text-2xl font-semibold text-white mb-6">Market Discussions</h1>

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
        <div class="flex items-center gap-2">
          <span class="text-neutral-500 text-sm">Sort:</span>
          <select
            bind:value={sortBy}
            class="bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm px-2 py-2 focus:outline-none focus:border-neutral-600"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="most_replies">Most Replies</option>
            <option value="most_upvotes">Most Upvotes</option>
          </select>
        </div>

        <!-- Stance Filter -->
        <div class="flex items-center gap-2">
          <span class="text-neutral-500 text-sm">Stance:</span>
          <select
            bind:value={stanceFilter}
            class="bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm px-2 py-2 focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All</option>
            <option value="bullish">Bullish</option>
            <option value="bearish">Bearish</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>

        <!-- Type Filter -->
        <div class="flex items-center gap-2">
          <span class="text-neutral-500 text-sm">Type:</span>
          <select
            bind:value={typeFilter}
            class="bg-neutral-800 border border-neutral-700 text-neutral-300 text-sm px-2 py-2 focus:outline-none focus:border-neutral-600"
          >
            <option value="all">All</option>
            <option value="argument">Argument</option>
            <option value="prediction">Prediction</option>
            <option value="question">Question</option>
            <option value="evidence">Evidence</option>
            <option value="rebuttal">Rebuttal</option>
            <option value="analysis">Analysis</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- Content -->
  <div class="max-w-5xl mx-auto px-4 py-6">
    {#if filteredDiscussions.length === 0}
      <div class="flex flex-col items-center justify-center py-20">
        <span class="text-neutral-500 text-sm mb-4">No discussions found</span>
        {#if searchQuery || stanceFilter !== 'all' || typeFilter !== 'all'}
          <button
            onclick={() => { searchQuery = ''; stanceFilter = 'all'; typeFilter = 'all'; }}
            class="text-neutral-400 hover:text-white text-sm"
          >
            Clear filters
          </button>
        {/if}
      </div>
    {:else}
      <div class="space-y-4">
        {#each filteredDiscussions as { thread, market } (thread.id)}
          <button
            onclick={() => goToThread(market, thread.id)}
            class="w-full text-left bg-neutral-900 border border-neutral-800 p-4 hover:border-neutral-700 transition-colors"
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
                  <span>{countReplies(thread) - 1} {countReplies(thread) === 2 ? 'reply' : 'replies'}</span>
                </div>
              </div>

              <!-- Badges -->
              <div class="flex flex-col items-end gap-2">
                <!-- Stance badge -->
                <span class="px-2 py-0.5 text-xs font-medium {getStanceClass(thread.stance)}">
                  {thread.stance === 'bull' ? 'bull' : thread.stance === 'bear' ? 'bear' : thread.stance}
                </span>

                <!-- Type badge -->
                <span class="px-2 py-0.5 text-xs bg-neutral-800 text-neutral-400 rounded-sm">
                  {getTypeLabel(thread.type)}
                </span>

                <!-- Upvotes -->
                <div class="flex items-center gap-1 text-xs text-neutral-500">
                  <span>▲</span>
                  <span>{thread.upvotes}</span>
                </div>
              </div>
            </div>
          </button>
        {/each}
      </div>

      <!-- Result count -->
      <div class="mt-6 text-center text-neutral-500 text-xs">
        Showing {filteredDiscussions.length} of {discussions.length} discussions
      </div>
    {/if}
  </div>
</div>
