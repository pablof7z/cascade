<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import NavHeader from '$lib/components/NavHeader.svelte'
  import ErrorMessage from '$lib/components/ui/ErrorMessage.svelte'
  import { fetchAllMarketsTransport, publishMarket, getPubkey, fetchEvents, extractMarketEventId } from '../services/nostrService'
  import { parseMarketEvent } from '../services/marketService'
  import { priceLong, createEmptyMarket } from '../market'
  import type { Market } from '../market'
  import { getCurrentPubkey } from '$lib/stores/nostr.svelte'

  type DisplayMarket = {
    slug: string
    pubkeyPrefix: string
    title: string
    category: string
    description: string
    prob: number
    volume: string
    traders: number
    createdAt: number
    timeAgo: string
    spread: number
    comments: number
    mcap: string
  }

  type DiscussionItem = {
    id: string
    content: string
    pubkey: string
    pubkeyPrefix: string
    createdAt: number
    marketSlug: string
    marketTitle: string
  }

  // ─── Auth ───────────────────────────────────────────────────────────────────

  let pubkey = $derived(getCurrentPubkey())

  // ─── State ──────────────────────────────────────────────────────────────────

  let markets = $state<Market[]>([])
  let discussions = $state<DiscussionItem[]>([])
  let error = $state<string | null>(null)
  let showCreateModal = $state(false)
  let title = $state('')
  let description = $state('')
  let createLoading = $state(false)
  let createError = $state<string | null>(null)
  let createSuccess = $state(false)

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function slugify(text: string): string {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
  }

  function formatSats(sats: number): string {
    if (sats >= 1000000) {
      return `${(sats / 1000000).toFixed(1)}M`
    }
    if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}K`
    }
    return `${sats}`
  }

  function formatTimeAgo(timestamp: number): string {
    const now = Date.now() / 1000
    const diff = now - timestamp
    const minute = 60
    const hour = 60 * minute
    const day = 24 * hour
    const week = 7 * day

    if (diff < minute) return 'just now'
    if (diff < hour) return `${Math.floor(diff / minute)}m ago`
    if (diff < day) return `${Math.floor(diff / hour)}h ago`
    if (diff < week) return `${Math.floor(diff / day)}d ago`
    return `${Math.floor(diff / week)}w ago`
  }

  function getCategory(market: Market): string {
    if (market.kind === 'thesis') return 'Thesis'
    // Try to infer category from title keywords
    const lower = market.title.toLowerCase()
    if (lower.includes('ai') || lower.includes('agi') || lower.includes('llm')) return 'AI'
    if (lower.includes('space') || lower.includes('mars')) return 'Space'
    if (lower.includes('bitcoin') || lower.includes('crypto')) return 'Crypto'
    if (lower.includes('bio') || lower.includes('health') || lower.includes('fda')) return 'Biotech'
    if (lower.includes('energy') || lower.includes('fusion')) return 'Energy'
    if (lower.includes('governance') || lower.includes('regulation')) return 'Governance'
    if (lower.includes('economy') || lower.includes('recession')) return 'Economics'
    return 'General'
  }

  function calculateSpread(prob: number): number {
    // Spread as percentage - higher when probability is closer to 50%
    return Math.round(Math.abs(prob - 0.5) * 20)
  }

  function toDisplayMarket(market: Market): DisplayMarket {
    const prob = priceLong(market.qLong, market.qShort, market.b)
    const traderCount = Object.keys(market.participants).length
    const volume = market.reserve
    const mcap = market.qLong + market.qShort
    const pubkeyPrefix = market.creatorPubkey?.slice(0, 12) ?? ''

    return {
      slug: market.slug,
      pubkeyPrefix,
      title: market.title,
      category: getCategory(market),
      description: market.description,
      prob,
      volume: formatSats(volume),
      traders: traderCount,
      createdAt: market.createdAt,
      timeAgo: formatTimeAgo(market.createdAt),
      spread: calculateSpread(prob),
      comments: 0,
      mcap: formatSats(mcap),
    }
  }

  // ─── Derived market lists ───────────────────────────────────────────────────

  let activeMarkets = $derived(
    markets
      .filter(m => m.status === 'active')
      .map(toDisplayMarket)
  )

  let trendingMarkets = $derived(
    [...activeMarkets]
      .sort((a, b) => {
        // Sort by trader count descending
        return b.traders - a.traders
      })
      .slice(0, 6)
  )

  let lowVolumeMarkets = $derived(
    [...activeMarkets]
      .sort((a, b) => a.traders - b.traders)
      .slice(0, 8)
  )

  let disputedMarkets = $derived(
    [...activeMarkets]
      .sort((a, b) => {
        // Sort by spread descending (most disputed = closest to 50%)
        return b.spread - a.spread
      })
      .slice(0, 3)
  )

  let newThisWeek = $derived(
    [...activeMarkets]
      .filter(m => m.createdAt > (Date.now() / 1000) - 7 * 24 * 60 * 60)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8)
  )

  let latestDiscussions = $derived(discussions.slice(0, 6))

  let featuredMarket = $derived(trendingMarkets[0] ?? null)

  // ─── Data fetching ──────────────────────────────────────────────────────────

  onMount(() => {
    let cancelled = false

    async function loadMarkets() {
      try {
        const events = await fetchAllMarketsTransport(50)
        if (cancelled) return

        const parsed: Market[] = []
        for (const event of events) {
          const result = parseMarketEvent(event)
          if (result.ok && result.market) {
            parsed.push(result.market)
          }
        }

        if (!cancelled) {
          markets = parsed
          if (parsed.length === 0) {
            error = "No markets found — check your connection"
          }
        }

        // Load discussions after markets so we can resolve market titles
        if (!cancelled) {
          loadDiscussions(parsed).catch(() => { /* silent */ })
        }
      } catch (err) {
        if (!cancelled) {
          error = err instanceof Error ? err.message : "Couldn't connect to server — check your connection"
        }
      }
    }

    async function loadDiscussions(loadedMarkets: Market[]) {
      try {
        const eventsSet = await fetchEvents({ kinds: [1111], limit: 30 })
        if (cancelled) return

        const eventArr = Array.from(eventsSet).sort(
          (a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)
        )

        const items: DiscussionItem[] = []
        for (const event of eventArr) {
          const marketEventId = extractMarketEventId(event)
          if (!marketEventId) continue

          const market = loadedMarkets.find(m => m.eventId === marketEventId)
          if (!market) continue

          const pubkeyPrefix = market.creatorPubkey?.slice(0, 12) ?? ''
          items.push({
            id: event.id ?? '',
            content: (event.content ?? '').slice(0, 120),
            pubkey: event.pubkey ?? '',
            pubkeyPrefix: (event.pubkey ?? '').slice(0, 8),
            createdAt: event.created_at ?? 0,
            marketSlug: `${market.slug}--${pubkeyPrefix}`,
            marketTitle: market.title,
          })

          if (items.length >= 6) break
        }

        if (!cancelled) {
          discussions = items
        }
      } catch {
        // Silent — section just won't show
      }
    }

    loadMarkets()

    return () => {
      cancelled = true
    }
  })

  // ─── Form handlers ──────────────────────────────────────────────────────────

  async function handleCreateMarket(e: Event) {
    e.preventDefault()
    createLoading = true
    createError = null
    createSuccess = false

    try {
      const pubkey = getPubkey()
      if (!pubkey) {
        createError = 'Please sign in to create markets.'
        createLoading = false
        return
      }

      const slug = slugify(title)
      if (!slug) {
        createError = 'Please enter a valid market title.'
        createLoading = false
        return
      }

      const market = createEmptyMarket({
        slug,
        title: title.trim(),
        description: description.trim(),
        creatorPubkey: pubkey,
      })

      // Markdown content for the event body
      const markdown = `# ${title.trim()}\n\n${description.trim()}`

      await publishMarket(market, markdown)

      // Success — close modal, reset, navigate
      createSuccess = true
      showCreateModal = false
      title = ''
      description = ''
      goto('/discuss')

      // Refresh markets list after short delay
      setTimeout(async () => {
        try {
          const events = await fetchAllMarketsTransport()
          const parsed: Market[] = []
          for (const event of events) {
            const result = parseMarketEvent(event)
            if (result.ok) parsed.push(result.market)
          }
          markets = parsed
        } catch { /* silent refresh failure */ }
        createSuccess = false
      }, 2000)
    } catch (err) {
      createError = err instanceof Error ? err.message : 'Failed to create market. Please try again.'
    } finally {
      createLoading = false
    }
  }

  function loadRandomMarket() {
    const specs = [
      { title: 'Will a major tech company go bankrupt by 2030?', description: 'Any Fortune 500 tech company filing for Chapter 11 bankruptcy protection.' },
      { title: 'First human on Mars by 2035?', description: 'A human boots on Mars surface and survives for at least 24 hours.' },
      { title: 'AI writes a bestseller by 2027?', description: 'An AI-authored book reaches the New York Times bestseller list.' },
    ]
    const spec = specs[Math.floor(Math.random() * specs.length)]
    title = spec.title
    description = spec.description
  }
</script>

<svelte:head>
  <title>Cascade — Prediction Markets That Never Close</title>
  <meta name="description" content="Take positions on the ideas that matter. AI timelines, geopolitics, economic trends — markets that stay open as long as the question does." />
  
  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Cascade" />
  <meta property="og:title" content="Cascade — Prediction Markets That Never Close" />
  <meta property="og:description" content="Take positions on the ideas that matter. AI timelines, geopolitics, economic trends — markets that stay open as long as the question does." />
  <meta property="og:image" content="https://cascade.markets/og/home.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:url" content="https://cascade.markets" />
  
  <!-- Twitter/X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:site" content="@cascademarkets" />
  <meta name="twitter:title" content="Cascade — Prediction Markets That Never Close" />
  <meta name="twitter:description" content="Take positions on the ideas that matter. AI timelines, geopolitics, economic trends — markets that stay open as long as the question does." />
  <meta name="twitter:image" content="https://cascade.markets/og/home.png" />
</svelte:head>

<div class="min-h-screen bg-neutral-950">
  <NavHeader />

  <!-- ═══════════════════════════════════════════════════════════════════════════
      LOGGED-OUT INTRO — Minimal, information-dense, logged-out users only
  ═══════════════════════════════════════════════════════════════════════════ -->
  {#if !pubkey}
    <div class="border-b border-neutral-800/50 bg-neutral-950">
      <div class="max-w-7xl mx-auto px-6 py-8">
        <p class="text-neutral-100 text-lg font-semibold leading-snug mb-1">
          Prediction markets that never close. Mint long or short positions on any topic.
        </p>
        <p class="text-neutral-500 text-sm mb-5">
          Markets never close. Trade in and out any time.
        </p>
        <a href="/join" class="text-sm font-medium text-neutral-300 hover:text-white">
          Start Trading →
        </a>
      </div>
    </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════════════
      HERO — Provocative statement + Featured Market
  ═══════════════════════════════════════════════════════════════════════════ -->
  {#if pubkey}
  <section class="relative min-h-[80vh] flex flex-col">
    <div class="absolute inset-0 bg-neutral-950"></div>

    <div class="relative z-10 flex-1 flex items-center">
      <div class="max-w-7xl mx-auto w-full px-6 py-16">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div class="space-y-8">
            <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05]">
              The Market Thinks You're Wrong
            </h1>
            <p class="text-xl md:text-2xl text-neutral-400 max-w-lg leading-relaxed">
              Not just "will it happen?" — but "if it does, then what?" Build a thesis, trade on your conviction.
            </p>
            <div class="flex flex-wrap items-center gap-4 pt-4">
              <a
                href="/join"
                class="px-8 py-4 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 transition-colors text-lg"
              >
                Start Trading
              </a>
              <a
                href="#markets"
                onclick={(e) => { e.preventDefault(); document.getElementById('markets')?.scrollIntoView({ behavior: 'smooth' }) }}
                class="text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
              >
                Browse markets →
              </a>
            </div>
          </div>

          <!-- Right — Featured market -->
          {#if featuredMarket}
            <div class="space-y-6">
              <span class="text-xs font-medium text-neutral-500">
                Featured Thesis
              </span>
              <a href="/mkt/{featuredMarket.slug}--{featuredMarket.pubkeyPrefix}" class="block space-y-4">
                <h2 class="text-3xl md:text-4xl font-bold text-white leading-snug hover:text-emerald-400 transition-colors">
                  {featuredMarket.title}
                </h2>
                <div class="flex items-baseline gap-4">
                  <span class="text-6xl font-black text-emerald-500 tabular-nums">
                    {Math.round(featuredMarket.prob * 100)}¢
                  </span>
                  <span class="text-lg text-emerald-500/70">YES</span>
                </div>
                <div class="flex gap-8 text-sm text-neutral-500">
                  <span>{featuredMarket.volume} vol</span>
                  <span>{featuredMarket.traders} traders</span>
                </div>
              </a>
            </div>
          {:else}
            <div class="space-y-6">
              <span class="text-xs font-medium text-neutral-500 uppercase tracking-widest">
                Example Theses
              </span>
              <div class="grid grid-cols-2 gap-x-8 gap-y-2">
                <!-- Chain 1: The AI Supercycle -->
                <div>
                  <p class="text-xs font-mono text-neutral-600 uppercase mb-3">The AI Supercycle</p>
                  <!-- IF -->
                  <div class="flex items-start gap-2 pb-3">
                    <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">IF</span>
                    <div>
                      <p class="text-neutral-300 text-sm leading-snug">AGI before 2027</p>
                      <span class="text-2xl font-black tabular-nums text-emerald-500">73¢</span>
                    </div>
                  </div>
                  <!-- THEN chain -->
                  <div class="ml-2 border-l border-neutral-700">
                    <div class="flex items-start gap-2 pl-3 pb-3">
                      <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">THEN</span>
                      <div>
                        <p class="text-neutral-300 text-sm leading-snug">AI replaces 20% of jobs</p>
                        <span class="text-2xl font-black tabular-nums text-emerald-500">61¢</span>
                      </div>
                    </div>
                    <div class="flex items-start gap-2 pl-3">
                      <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">THEN</span>
                      <div>
                        <p class="text-neutral-300 text-sm leading-snug">UBI passes in G7</p>
                        <span class="text-2xl font-black tabular-nums text-rose-500">38¢</span>
                      </div>
                    </div>
                  </div>
                </div>
                <!-- Chain 2: The BTC Supercycle -->
                <div>
                  <p class="text-xs font-mono text-neutral-600 uppercase mb-3">The BTC Supercycle</p>
                  <!-- IF -->
                  <div class="flex items-start gap-2 pb-3">
                    <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">IF</span>
                    <div>
                      <p class="text-neutral-300 text-sm leading-snug">BTC breaks $200k</p>
                      <span class="text-2xl font-black tabular-nums text-emerald-500">67¢</span>
                    </div>
                  </div>
                  <!-- THEN chain -->
                  <div class="ml-2 border-l border-neutral-700">
                    <div class="flex items-start gap-2 pl-3 pb-3">
                      <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">THEN</span>
                      <div>
                        <p class="text-neutral-300 text-sm leading-snug">ETH outperforms BTC</p>
                        <span class="text-2xl font-black tabular-nums text-emerald-500">55¢</span>
                      </div>
                    </div>
                    <div class="flex items-start gap-2 pl-3 pb-3">
                      <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">THEN</span>
                      <div>
                        <p class="text-neutral-300 text-sm leading-snug">L2 TVL doubles</p>
                        <span class="text-2xl font-black tabular-nums text-rose-500">48¢</span>
                      </div>
                    </div>
                    <div class="flex items-start gap-2 pl-3">
                      <span class="text-xs font-mono text-neutral-500 w-10 shrink-0 pt-1">THEN</span>
                      <div>
                        <p class="text-neutral-300 text-sm leading-snug">Coinbase stock rallies</p>
                        <span class="text-2xl font-black tabular-nums text-rose-500">44¢</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <a href="/join" class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors block pt-2">
                Build your own →
              </a>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════════════
      LIVE TRADES TICKER
  ═══════════════════════════════════════════════════════════════════════════ -->
  <div class="border-y border-neutral-800/50 bg-neutral-950">
    <div class="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
      <div class="flex items-center gap-2 shrink-0">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
        </span>
        <span class="text-xs text-neutral-500 font-medium">Live</span>
      </div>
      <div class="overflow-hidden text-sm text-neutral-400 flex-1">
        {#if markets.length > 0}
          <div class="flex gap-8 animate-ticker">
            <div class="contents" aria-hidden="true">
              {#each markets as market}
                {@const prob = Math.round(priceLong(market.qLong, market.qShort, market.b) * 100)}
                <span class="inline-flex items-center gap-2 shrink-0">
                  <span class="text-xs text-neutral-600 font-mono">{getCategory(market)}</span>
                  <span class="text-neutral-300 max-w-[200px] truncate">{market.title}</span>
                  <span class={prob >= 50 ? 'text-emerald-500 font-mono text-xs' : 'text-rose-500 font-mono text-xs'}>{prob}%</span>
                </span>
              {/each}
            </div>
            {#each markets as market}
              {@const prob = Math.round(priceLong(market.qLong, market.qShort, market.b) * 100)}
              <span class="inline-flex items-center gap-2 shrink-0">
                <span class="text-xs text-neutral-600 font-mono">{getCategory(market)}</span>
                <span class="text-neutral-300 max-w-[200px] truncate">{market.title}</span>
                <span class={prob >= 50 ? 'text-emerald-500 font-mono text-xs' : 'text-rose-500 font-mono text-xs'}>{prob}%</span>
              </span>
            {/each}
          </div>
        {:else}
          <span class="text-neutral-600">Connecting to markets...</span>
        {/if}
      </div>
    </div>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════════════════
      HOW IT WORKS — 3-step explanation
  ═══════════════════════════════════════════════════════════════════════════ -->
  <section id="how-it-works" class="max-w-7xl mx-auto px-6 py-20 border-t border-neutral-800/30">
    <div class="mb-12">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-3">
        You have opinions. Now trade on them.
      </h2>
      <p class="text-neutral-500 text-sm">Cascade trades on theses, not just bets.</p>
    </div>

    <div class="grid md:grid-cols-3 gap-12">
      <!-- Step 1 -->
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-neutral-600">Step 1</span>
          <div class="h-px flex-1 bg-neutral-800"></div>
        </div>
        <h3 class="text-lg font-semibold text-white">Find or create a prediction</h3>
        <p class="text-sm text-neutral-500 leading-relaxed">
          Browse existing markets or create your own. Each market is a simple question: will this outcome happen?
        </p>
        <p class="text-xs text-neutral-600 font-mono">
          e.g. "Will BTC break $100k by end of 2025?"
        </p>
      </div>

      <!-- Step 2 -->
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-neutral-600">Step 2</span>
          <div class="h-px flex-1 bg-neutral-800"></div>
        </div>
        <h3 class="text-lg font-semibold text-white">Connect predictions into a thesis</h3>
        <p class="text-sm text-neutral-500 leading-relaxed">
          Link predictions together. If one outcome happens, what follows? Build conditional chains.
        </p>
        <p class="text-xs text-neutral-600 font-mono">
          e.g. "If BTC breaks $100k → ETH outperforms → Coinbase benefits"
        </p>
      </div>

      <!-- Step 3 -->
      <div class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono text-neutral-600">Step 3</span>
          <div class="h-px flex-1 bg-neutral-800"></div>
        </div>
        <h3 class="text-lg font-semibold text-white">Trade on your conviction</h3>
        <p class="text-sm text-neutral-500 leading-relaxed">
          Buy YES or NO shares. The market prices your thesis in real-time as new information arrives.
        </p>
        <p class="text-xs text-neutral-600 font-mono">
          e.g. 73¢ YES — market thinks you're wrong, prove it.
        </p>
      </div>
    </div>
  </section>

  {#if error}
    <div class="max-w-7xl mx-auto px-6 pt-12">
      <ErrorMessage {error} />
    </div>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════════════
      SECTION 1: TRENDING MARKETS — Sidebar layout
  ═══════════════════════════════════════════════════════════════════════════ -->
  <section class="max-w-7xl mx-auto px-6 pt-20 pb-16">
    <div class="flex items-baseline gap-4 mb-10">
      <h2 id="markets" class="text-3xl font-black text-white">Trending</h2>
      <span class="text-sm text-neutral-600">Most volume · 24h</span>
    </div>

    <div class="grid lg:grid-cols-12 gap-0">
      <!-- Left — Dominant market -->
      <div class="lg:col-span-5 lg:pr-12 lg:border-r border-neutral-800/50 pb-8 lg:pb-0">
        {#if trendingMarkets.length > 0}
          {@const entry = trendingMarkets[0]}
          <a href="/mkt/{entry.slug}--{entry.pubkeyPrefix}" class="block cursor-pointer group">
            <span class="text-xs text-emerald-500 font-medium">#1 by volume</span>
            <h3 class="text-2xl md:text-3xl font-bold text-white mt-2 mb-4 group-hover:text-emerald-400 transition-colors leading-snug">
              {entry.title}
            </h3>
            <div class="flex items-baseline gap-3 mb-3">
              <span class="text-5xl font-black text-emerald-500 tabular-nums">
                {Math.round(entry.prob * 100)}¢
              </span>

            </div>
            <div class="flex gap-6 text-sm text-neutral-500">
              <span>{entry.volume} vol</span>
              <span>{entry.traders} trades</span>
            </div>
          </a>
        {:else}
          <div class="text-sm text-neutral-500 italic">No trending markets yet</div>
        {/if}
      </div>

      <!-- Right — Compact ranked list -->
      <div class="lg:col-span-7 lg:pl-12">
        <div class="space-y-0">
          {#each trendingMarkets.slice(1) as entry, i}
            <a
              href="/mkt/{entry.slug}--{entry.pubkeyPrefix}"
              class="flex items-center gap-4 py-3 border-b border-neutral-800/30 last:border-0 cursor-pointer hover:bg-neutral-900/30 -mx-2 px-2 transition-colors"
            >
              <span class="text-2xl font-black text-neutral-700 w-8 tabular-nums">{i + 2}</span>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-white truncate block">{entry.title}</span>
              </div>
              <div class="flex items-center gap-4 shrink-0">
                <span class="text-xs text-neutral-600">{entry.category}</span>

                <span class="text-sm font-mono font-bold text-white w-12 text-right tabular-nums">
                  {Math.round(entry.prob * 100)}¢
                </span>
                <span class="text-xs text-neutral-600 w-16 text-right hidden sm:block">{entry.volume}</span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════════════════════════════════════════
      SECTION 2: LOW VOLUME MARKETS — Bloomberg data-table style
  ═══════════════════════════════════════════════════════════════════════════ -->
  <section class="bg-neutral-900/40 border-y border-neutral-800/30">
    <div class="max-w-7xl mx-auto px-6 py-16">
      <div class="flex items-baseline justify-between mb-8">
        <div class="flex items-baseline gap-4">
          <h2 class="text-3xl font-black text-white">Low Volume</h2>
          <span class="text-sm text-neutral-600">Smaller markets with lower volume.</span>
        </div>
        <span class="text-xs text-neutral-600 hidden sm:block">Updated live</span>
      </div>

      <!-- Table header -->
      <div class="grid grid-cols-12 gap-2 px-3 pb-2 text-xs text-neutral-600 font-medium border-b border-neutral-700/50">
        <div class="col-span-5 sm:col-span-4">Market</div>
        <div class="col-span-2 text-right">Price</div>
        <div class="col-span-2 text-right hidden sm:block">Traders</div>
        <div class="col-span-2 text-right hidden md:block">Vol</div>
        <div class="col-span-3 sm:col-span-2 text-right">Mkt Cap</div>
      </div>

      <!-- Table rows -->
      {#each lowVolumeMarkets as row, i}
        <a
          href="/mkt/{row.slug}--{row.pubkeyPrefix}"
          class="grid grid-cols-12 gap-2 px-3 py-3 text-sm cursor-pointer transition-colors hover:bg-neutral-800/30 {i % 2 === 0 ? 'bg-neutral-800/10' : ''}"
        >
          <div class="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
            <span class="text-[10px] text-neutral-600 shrink-0">{row.category}</span>
            <span class="text-white truncate font-medium">{row.title}</span>
          </div>
          <div class="col-span-2 text-right font-mono font-bold text-neutral-200 tabular-nums">
            {Math.round(row.prob * 100)}¢
          </div>
          <div class="col-span-2 text-right font-mono tabular-nums hidden sm:block text-neutral-500">
            {row.traders}
          </div>
          <div class="col-span-2 text-right font-mono text-neutral-500 tabular-nums hidden md:block">
            {row.volume}
          </div>
          <div class="col-span-3 sm:col-span-2 text-right font-mono text-neutral-400 tabular-nums">
            {row.mcap}
          </div>
        </a>
      {/each}
    </div>
  </section>

  <!-- ═══════════════════════════════════════════════════════════════════════════
      SECTION 3: MARKETS IN DISPUTE
  ═══════════════════════════════════════════════════════════════════════════ -->
  {#if disputedMarkets.length >= 3}
    <section class="max-w-7xl mx-auto px-6 py-20">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end mb-10 border-b border-neutral-800/40 pb-6">
        <div class="flex items-baseline gap-4">
          <h2 class="text-3xl font-black text-white">Most Disputed</h2>
          <span class="text-sm text-neutral-600">Markets where the odds are close.</span>
        </div>
      </div>

      <div class="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:gap-12">
        <!-- Market list -->
        <div>
          <div class="grid grid-cols-[minmax(0,1.4fr)_76px_72px_88px] gap-3 pb-3 text-[10px] text-neutral-600 border-b border-neutral-800/40">
            <div>Market</div>
            <div class="text-right">Yes</div>
            <div class="text-right">Spread</div>
            <div class="text-right hidden sm:block">Volume</div>
          </div>

          {#each disputedMarkets as entry}
            <a
              href="/mkt/{entry.slug}--{entry.pubkeyPrefix}"
              class="grid grid-cols-[minmax(0,1.4fr)_76px_72px_88px] gap-3 py-3 border-b border-neutral-800/20 last:border-0 cursor-pointer hover:bg-neutral-900/30 -mx-2 px-2 transition-colors items-center"
            >
              <div class="min-w-0">
                <span class="text-sm font-medium text-white truncate block">{entry.title}</span>
                <span class="text-[10px] text-neutral-600">{entry.category}</span>
              </div>
              <div class="text-right font-mono font-bold text-white tabular-nums">
                {Math.round(entry.prob * 100)}¢
              </div>
              <div class="text-right font-mono tabular-nums text-neutral-500">
                {entry.spread}
              </div>
              <div class="text-right font-mono text-neutral-400 tabular-nums hidden sm:block">
                {entry.volume}
              </div>
            </a>
          {/each}
        </div>

      </div>
    </section>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════════════
      SECTION 4: NEW THIS WEEK — Magazine layout
  ═══════════════════════════════════════════════════════════════════════════ -->
  {#if newThisWeek.length > 0}
    {@const featured = newThisWeek[0]}
    <section class="bg-neutral-900/20 border-t border-neutral-800/30">
      <div class="max-w-7xl mx-auto px-6 py-16">
        <div class="flex items-baseline gap-4 mb-10 border-b border-neutral-800/30 pb-6">
          <h2 class="text-3xl font-black text-white">New This Week</h2>
        </div>

        <div class="grid lg:grid-cols-3 gap-12">
          <!-- Column 1: Featured -->
          <div class="lg:col-span-1">
            <a href="/mkt/{featured.slug}--{featured.pubkeyPrefix}" class="block cursor-pointer group">
              <span class="text-[10px] text-emerald-500/70 font-medium">
                {featured.category} · {featured.timeAgo}
              </span>
              <h3 class="text-xl font-bold text-white mt-2 mb-3 leading-snug group-hover:text-emerald-400 transition-colors">
                {featured.title}
              </h3>
              <p class="text-sm text-neutral-500 leading-relaxed mb-4 line-clamp-3">
                {featured.description}
              </p>
              <span class="text-3xl font-black text-emerald-500 tabular-nums">
                {Math.round(featured.prob * 100)}¢
              </span>
            </a>
          </div>

          <!-- Column 2: Medium items -->
          <div class="space-y-0">
            {#each newThisWeek.slice(1, 4) as item}
              <a
                href="/mkt/{item.slug}--{item.pubkeyPrefix}"
                class="block py-5 border-b border-neutral-800/20 last:border-0 cursor-pointer group"
              >
                <div class="flex items-start justify-between gap-4 mb-1">
                  <h4 class="text-sm font-semibold text-white leading-snug group-hover:text-emerald-400 transition-colors">
                    {item.title}
                  </h4>
                  <span class="text-sm font-mono font-bold text-white tabular-nums shrink-0">
                    {Math.round(item.prob * 100)}¢
                  </span>
                </div>
                <span class="text-[10px] text-neutral-700">
                  {item.category} · {item.timeAgo}
                </span>
              </a>
            {/each}
          </div>

          <!-- Column 3: Compact list -->
          <div>
            <span class="text-[10px] text-neutral-600 font-medium block mb-4">
              Also new
            </span>
            {#each newThisWeek.slice(4) as item, i}
              <a
                href="/mkt/{item.slug}--{item.pubkeyPrefix}"
                class="flex items-baseline gap-3 py-2 cursor-pointer group"
              >
                <span class="text-xs font-mono text-neutral-700 tabular-nums w-4 text-right shrink-0">
                  {i + 1}
                </span>
                <div class="flex-1 min-w-0">
                  <span class="text-sm text-neutral-300 group-hover:text-emerald-400 transition-colors leading-snug">
                    {item.title}
                  </span>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs font-mono text-neutral-500 tabular-nums">{Math.round(item.prob * 100)}¢</span>
                    <span class="text-[10px] text-neutral-700">{item.category}</span>
                  </div>
                </div>
              </a>
            {/each}
          </div>
        </div>
      </div>
    </section>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════════════
      SECTION 5: LATEST DISCUSSIONS — Dense newspaper list
  ═══════════════════════════════════════════════════════════════════════════ -->
  {#if latestDiscussions.length > 0}
    <section class="max-w-7xl mx-auto px-6 py-16 border-t border-neutral-800/30">
      <div class="flex items-baseline gap-4 mb-8">
        <h2 class="text-3xl font-black text-white">Latest Discussions</h2>
        <span class="text-sm text-neutral-600">Recent posts across all markets</span>
      </div>

      <div class="divide-y divide-neutral-800/40">
        {#each latestDiscussions as post}
          <div class="py-3 flex items-start gap-4">
            <span class="text-[10px] font-mono text-neutral-600 shrink-0 w-14 pt-0.5 tabular-nums">
              {formatTimeAgo(post.createdAt)}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-neutral-300 leading-snug mb-1 line-clamp-2">
                {post.content}{post.content.length >= 120 ? '…' : ''}
              </p>
              <div class="flex items-center gap-3 text-[10px] text-neutral-600">
                <a href="/mkt/{post.marketSlug}" class="hover:text-neutral-400 transition-colors truncate max-w-[240px]">
                  {post.marketTitle}
                </a>
                <span class="shrink-0 font-mono">{post.pubkeyPrefix}…</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    </section>
  {/if}

  <!-- ═══════════════════════════════════════════════════════════════════════════
      DIFFERENTIATOR — Why Cascade Markets is different
  ═══════════════════════════════════════════════════════════════════════════ -->
  <section class="max-w-7xl mx-auto px-6 py-20 border-t border-neutral-800/30">
    <div class="grid lg:grid-cols-12 gap-12 items-start">
      <div class="lg:col-span-5">
        <h2 class="text-4xl md:text-5xl font-bold text-white leading-tight mb-6">
          Not another
          <span class="block text-neutral-600">prediction market.</span>
        </h2>
        <p class="text-lg text-neutral-400 leading-relaxed">
          Traditional markets resolve to YES or NO. Cascade trades on evolving truth —
          questions that compound, theses that grow, arguments that sharpen.
        </p>
      </div>

      <div class="lg:col-span-7 grid sm:grid-cols-2 gap-8">
        <div class="space-y-3">
          <div class="text-xs font-mono text-neutral-600 mb-1">Binary markets</div>
          <h3 class="text-lg font-semibold text-neutral-400">"Will X happen?"</h3>
          <p class="text-sm text-neutral-600 leading-relaxed">
            YES or NO. One question, one answer. Resolves when the question is settled.
          </p>
          <p class="text-xs text-neutral-700 font-mono mt-2">
            e.g. "Will Fed cut rates in 2025?"
          </p>
        </div>
        <div class="space-y-3">
          <div class="text-xs font-mono text-emerald-500 mb-1">Conditional markets</div>
          <h3 class="text-lg font-semibold text-white">"If X, then what?"</h3>
          <p class="text-sm text-neutral-500 leading-relaxed">
            Build a thesis. Connect predictions into chains. The market prices your entire argument.
          </p>
          <p class="text-xs text-neutral-600 font-mono mt-2">
            e.g. "If Fed cuts → BTC rallies → ETH outperforms → Coinbase benefits"
          </p>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════════════════════════════════════════
      CTA — Create a market
  ═══════════════════════════════════════════════════════════════════════════ -->
  <section class="max-w-7xl mx-auto px-6 py-20">
    <div class="text-center max-w-2xl mx-auto">
      <h2 class="text-3xl md:text-4xl font-bold text-white mb-4">
        Have a thesis?
      </h2>
      <p class="text-lg text-neutral-400 mb-8">
        Turn your conviction into a market. Let the crowd price your prediction.
      </p>
      <div class="flex justify-center gap-4 flex-wrap">
        <button
          onclick={() => showCreateModal = true}
          class="px-8 py-4 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 transition-colors text-lg"
        >
          Create market
        </button>
        <a
          href="/thesis/new"
          class="px-8 py-4 border border-neutral-700 text-white font-medium hover:border-neutral-500 transition-colors text-lg"
        >
          Build thesis
        </a>
      </div>
    </div>
  </section>

  <!-- ═══════════════════════════════════════════════════════════════════════════
      FOOTER
  ═══════════════════════════════════════════════════════════════════════════ -->
  <footer class="border-t border-neutral-800/30 py-12">
    <div class="max-w-7xl mx-auto px-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="text-sm text-neutral-500">
          Cascade Markets
        </div>
        <div class="flex gap-6 text-sm text-neutral-600">
          <a href="/help" class="hover:text-neutral-400 transition-colors">Help</a>
          <a href="/legal/terms" class="hover:text-neutral-400 transition-colors">Terms</a>
          <a href="/legal/privacy" class="hover:text-neutral-400 transition-colors">Privacy</a>
        </div>
      </div>
    </div>
  </footer>
</div>

<!-- Create market modal -->
{#if showCreateModal}
  <div
    class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80"
    onclick={() => showCreateModal = false}
    onkeydown={(e) => e.key === 'Escape' && (showCreateModal = false)}
    role="presentation"
  >
    <div
      class="w-full max-w-lg p-6 bg-neutral-900 border border-neutral-800"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-market-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
    >
      <div class="flex justify-between items-center mb-6">
        <h2 id="create-market-title" class="text-xl font-semibold text-white">New market</h2>
        <button
          type="button"
          class="text-sm text-neutral-500 hover:text-white"
          onclick={() => showCreateModal = false}
        >
          Close
        </button>
      </div>
      <form class="space-y-4" onsubmit={handleCreateMarket}>
        <label class="block">
          <span class="text-sm text-neutral-400">Title</span>
          <input
            bind:value={title}
            type="text"
            placeholder="Will AGI emerge before 2030?"
            class="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-600 transition-all"
          />
        </label>
        <label class="block">
          <span class="text-sm text-neutral-400">Description</span>
          <textarea
            bind:value={description}
            rows="3"
            placeholder="Describe what this market is about."
            class="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-600 transition-all resize-y min-h-[88px]"
          ></textarea>
        </label>
        {#if createError}
          <div class="p-3 bg-rose-500/10 border border-rose-500/30 text-sm text-rose-400">
            {createError}
          </div>
        {/if}
        <div class="flex gap-3 pt-2">
          <button
            class="flex-1 px-4 py-3 bg-white text-neutral-950 font-medium hover:bg-neutral-100 transition-colors disabled:bg-neutral-700 disabled:text-neutral-400"
            type="submit"
            disabled={createLoading || !title.trim()}
          >
            {createLoading ? 'Publishing...' : 'Create market'}
          </button>
          <button
            class="px-4 py-3 border border-neutral-700 text-neutral-300 hover:border-neutral-600 hover:text-white transition-colors"
            type="button"
            onclick={loadRandomMarket}
          >
            Random
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if createSuccess}
  <div class="fixed bottom-6 right-6 z-50 px-4 py-3 bg-emerald-600 text-white text-sm font-medium shadow-lg">
    ✓ Market published
  </div>
{/if}

<style>
@keyframes ticker {
  0% { transform: translateX(0); }
  100% { transform: translateX(calc(-50% + 1rem)); }
}
.animate-ticker {
  width: max-content;
  animation: ticker 40s linear infinite;
}
.animate-ticker:hover {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .animate-ticker {
    animation: none;
  }
}
</style>
