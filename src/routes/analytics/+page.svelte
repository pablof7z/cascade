<script lang="ts">
  import { onMount } from 'svelte'
  import { trackEvent, initAnalytics, destroyAnalytics } from '../../analytics'
  import { isReady, fetchEvents, fetchAllMarketsTransport, getNDK } from '../../services/nostrService'
  import { parseMarketEvent } from '../../services/marketService'
  import { fetchAllPositions } from '../../services/positionService'
  import type { NDKEvent, NDKKind } from '@nostr-dev-kit/ndk'

  // ─── Analytics session tracking ─────────────────────────────────────────────

  onMount(() => {
    initAnalytics()
    trackEvent('page_view', { path: '/analytics' })
    return () => destroyAnalytics()
  })

  // ─── Types ──────────────────────────────────────────────────────────────────

  type MarketRow = {
    title: string
    slug: string
    discussionCount: number
    createdAt: number
  }

  type ActivityItem = {
    kind: 'market' | 'post' | 'reply'
    title: string
    pubkey: string
    createdAt: number
    marketTitle?: string
  }

  // ─── State ──────────────────────────────────────────────────────────────────

  let totalMarkets = $state(0)
  let weeklyMarkets = $state(0)
  let totalDiscussions = $state(0)
  let uniqueTraders = $state(0)
  let marketRows = $state<MarketRow[]>([])
  let activityFeed = $state<ActivityItem[]>([])
  let marketsAtCap = $state(false)
  let discussionsAtCap = $state(false)

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function timeAgo(ts: number): string {
    const diff = Math.floor(Date.now() / 1000) - ts
    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  function shortDate(ts: number): string {
    return new Date(ts * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  function shortPubkey(pk: string): string {
    return pk.slice(0, 8) + '…'
  }

  // ─── Platform data loading ──────────────────────────────────────────────────

  $effect(() => {
    if (!isReady()) return
    loadPlatformData()
  })

  async function loadPlatformData() {
    const now = Math.floor(Date.now() / 1000)
    const weekAgo = now - 7 * 24 * 3600

    // Fetch markets (kind 982)
    const marketSet = await fetchAllMarketsTransport(100)
    const marketArr = Array.from(marketSet)
    marketsAtCap = marketArr.length >= 100

    const marketTitleById = new Map<string, string>()
    let weeklyCount = 0

    for (const event of marketArr) {
      if (!event.id) continue
      const result = parseMarketEvent(event)
      if (result.ok && result.market) {
        marketTitleById.set(event.id, result.market.title)
        if ((event.created_at ?? 0) >= weekAgo) weeklyCount++
      }
    }

    totalMarkets = marketTitleById.size
    weeklyMarkets = weeklyCount

    // Fetch ALL kind 1111 events — no #e filter so replies are included.
    // Replies tag their parent post, not the market, so relay-side #e filtering
    // would silently drop them.
    const allDiscussionSet = await fetchEvents({
      kinds: [1111 as NDKKind],
      limit: 500,
    })
    const allDiscussions = Array.from(allDiscussionSet)
    discussionsAtCap = allDiscussions.length >= 500

    const marketIdSet = new Set(marketTitleById.keys())

    // Pass 1: identify top-level posts — events with an e-tag pointing to a market event ID
    const postToMarket = new Map<string, string>() // top-level post event ID → market event ID
    for (const event of allDiscussions) {
      if (!event.id) continue
      for (const tag of event.tags) {
        if (tag[0] === 'e' && tag[1] && marketIdSet.has(tag[1])) {
          postToMarket.set(event.id, tag[1])
          break
        }
      }
    }

    // Pass 2: identify replies — events whose e-tag references a known top-level post
    const replyToMarket = new Map<string, string>() // reply event ID → market event ID
    for (const event of allDiscussions) {
      if (!event.id || postToMarket.has(event.id)) continue
      for (const tag of event.tags) {
        if (tag[0] === 'e' && tag[1] && postToMarket.has(tag[1])) {
          replyToMarket.set(event.id, postToMarket.get(tag[1])!)
          break
        }
      }
    }

    const topLevelPosts = allDiscussions.filter((e) => e.id && postToMarket.has(e.id))
    const replies = allDiscussions.filter((e) => e.id && replyToMarket.has(e.id))
    totalDiscussions = topLevelPosts.length + replies.length

    // Unique traders: discussion authors + platform position holders
    const traderPubkeys = new Set<string>()
    for (const event of topLevelPosts) {
      if (event.pubkey) traderPubkeys.add(event.pubkey)
    }
    for (const event of replies) {
      if (event.pubkey) traderPubkeys.add(event.pubkey)
    }

    const ndk = getNDK()
    if (ndk) {
      try {
        const positions = await fetchAllPositions(ndk)
        for (const position of positions) {
          if (position.ownerPubkey) traderPubkeys.add(position.ownerPubkey)
        }
      } catch {
        // non-fatal — trader count may be partial
      }
    }
    uniqueTraders = traderPubkeys.size

    // Discussion count per market — top-level posts and replies both counted
    const discussByMarket = new Map<string, number>()
    for (const event of topLevelPosts) {
      if (!event.id) continue
      const marketId = postToMarket.get(event.id)
      if (marketId) discussByMarket.set(marketId, (discussByMarket.get(marketId) ?? 0) + 1)
    }
    for (const event of replies) {
      if (!event.id) continue
      const marketId = replyToMarket.get(event.id)
      if (marketId) discussByMarket.set(marketId, (discussByMarket.get(marketId) ?? 0) + 1)
    }

    // Build most-active market rows
    const rows: MarketRow[] = []
    for (const event of marketArr) {
      if (!event.id) continue
      const result = parseMarketEvent(event)
      if (!result.ok || !result.market) continue
      rows.push({
        title: result.market.title,
        slug: result.market.slug,
        discussionCount: discussByMarket.get(event.id) ?? 0,
        createdAt: event.created_at ?? 0,
      })
    }
    rows.sort((a, b) => b.discussionCount - a.discussionCount)
    marketRows = rows.slice(0, 10)

    // Recent activity feed — markets + discussions combined, sorted by created_at desc
    const activity: ActivityItem[] = []

    for (const event of marketArr) {
      if (!event.id || !event.pubkey) continue
      const titleTag = event.tags.find((t) => t[0] === 'title')
      const title = titleTag?.[1] ?? 'Untitled Market'
      activity.push({
        kind: 'market',
        title,
        pubkey: event.pubkey,
        createdAt: event.created_at ?? 0,
      })
    }

    for (const event of topLevelPosts) {
      if (!event.pubkey) continue
      const marketId = event.id ? postToMarket.get(event.id) : undefined
      const marketTitle = marketId ? marketTitleById.get(marketId) : undefined
      const subjectTag = event.tags.find((t) => t[0] === 'subject')
      const title = subjectTag?.[1] ?? event.content.slice(0, 60)
      activity.push({
        kind: 'post',
        title,
        pubkey: event.pubkey,
        createdAt: event.created_at ?? 0,
        marketTitle,
      })
    }

    for (const event of replies) {
      if (!event.pubkey) continue
      const marketId = event.id ? replyToMarket.get(event.id) : undefined
      const marketTitle = marketId ? marketTitleById.get(marketId) : undefined
      const title = event.content.slice(0, 60)
      activity.push({
        kind: 'reply',
        title,
        pubkey: event.pubkey,
        createdAt: event.created_at ?? 0,
        marketTitle,
      })
    }

    activity.sort((a, b) => b.createdAt - a.createdAt)
    activityFeed = activity.slice(0, 10)
  }

  function handleReset() {
    if (confirm('Reset analytics session? This will clear your current session data.')) {
      destroyAnalytics()
      initAnalytics()
      trackEvent('analytics_reset', {})
      window.location.reload()
    }
  }
</script>

<svelte:head>
  <title>Analytics | Cascade</title>
</svelte:head>

<div class="max-w-5xl mx-auto px-4 py-8">

  <!-- Header -->
  <div class="flex items-center justify-between mb-8">
    <div>
      <h1 class="text-2xl font-sans text-white">Platform Briefing</h1>
      <p class="text-xs text-neutral-500 mt-1">Live platform data</p>
    </div>
    <button
      type="button"
      onclick={handleReset}
      class="px-3 py-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-300 transition-colors"
    >
      Reset Session
    </button>
  </div>

  <!-- Platform Stats -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-px bg-neutral-800 mb-10">
    <div class="bg-neutral-950 px-5 py-4">
      <div class="font-mono text-3xl font-medium text-white tabular-nums">{totalMarkets}{#if marketsAtCap}+{/if}</div>
      <div class="text-xs text-neutral-500 mt-1">Total markets{#if marketsAtCap}<span class="text-neutral-500"> · recent 100</span>{/if}</div>
    </div>
    <div class="bg-neutral-950 px-5 py-4">
      <div class="font-mono text-3xl font-medium text-emerald-400 tabular-nums">{weeklyMarkets}</div>
      <div class="text-xs text-neutral-500 mt-1">New this week</div>
    </div>
    <div class="bg-neutral-950 px-5 py-4">
      <div class="font-mono text-3xl font-medium text-white tabular-nums">{totalDiscussions}{#if discussionsAtCap}+{/if}</div>
      <div class="text-xs text-neutral-500 mt-1">Total discussions{#if discussionsAtCap}<span class="text-neutral-500"> · recent 500</span>{/if}</div>
    </div>
    <div class="bg-neutral-950 px-5 py-4">
      <div class="font-mono text-3xl font-medium text-white tabular-nums">{uniqueTraders}</div>
      <div class="text-xs text-neutral-500 mt-1">Unique participants</div>
    </div>
  </div>

  <div class="grid md:grid-cols-2 gap-10">

    <!-- Most Active Markets -->
    <div>
      <h2 class="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Most Active Markets</h2>
      {#if marketRows.length === 0}
        <p class="text-sm text-neutral-500 py-4">No markets loaded yet.</p>
      {:else}
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-neutral-800">
              <th class="text-left py-2 font-medium text-neutral-500 text-xs w-full">Market</th>
              <th class="text-right py-2 font-medium text-neutral-500 text-xs whitespace-nowrap pl-4">Posts</th>
              <th class="text-right py-2 font-medium text-neutral-500 text-xs whitespace-nowrap pl-4">Created</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-neutral-800">
            {#each marketRows as row}
              <tr>
                <td class="py-2.5 pr-4">
                  <a
                    href="/market/{row.slug}"
                    class="text-neutral-300 hover:text-white transition-colors line-clamp-1"
                  >{row.title}</a>
                </td>
                <td class="py-2.5 pl-4 text-right font-mono text-neutral-400 text-xs tabular-nums">
                  {row.discussionCount}
                </td>
                <td class="py-2.5 pl-4 text-right text-neutral-500 text-xs whitespace-nowrap">
                  {shortDate(row.createdAt)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>

    <!-- Recent Activity -->
    <div>
      <h2 class="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">Recent Activity</h2>
      {#if activityFeed.length === 0}
        <p class="text-sm text-neutral-500 py-4">No activity loaded yet.</p>
      {:else}
        <ul class="divide-y divide-neutral-800">
          {#each activityFeed as item}
            <li class="py-2.5">
              {#if item.kind === 'market'}
                <div class="text-xs text-neutral-500 mb-0.5">New market</div>
                <div class="text-sm text-neutral-300 line-clamp-1">{item.title}</div>
              {:else if item.kind === 'post'}
                <div class="text-xs text-neutral-500 mb-0.5">
                  New discussion{item.marketTitle ? ` on ${item.marketTitle}` : ''}
                </div>
                <div class="text-sm text-neutral-300 line-clamp-1">{item.title}</div>
              {:else}
                <div class="text-xs text-neutral-500 mb-0.5">
                  Reply{item.marketTitle ? ` on ${item.marketTitle}` : ''}
                </div>
                <div class="text-sm text-neutral-300 line-clamp-1">{item.title}</div>
              {/if}
              <div class="flex gap-2 mt-0.5">
                <span class="text-xs text-neutral-500 font-mono">{shortPubkey(item.pubkey)}</span>
                <span class="text-xs text-neutral-500">·</span>
                <span class="text-xs text-neutral-500">{timeAgo(item.createdAt)}</span>
              </div>
            </li>
          {/each}
        </ul>
      {/if}
    </div>

  </div>
</div>
