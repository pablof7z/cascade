<script lang="ts">
  import { onMount } from 'svelte'
  import NavHeader from '$lib/components/NavHeader.svelte'

  // ─── Sample market data ───────────────────────────────────────────────────────

  type MarketSpec = {
    title: string
    category: string
    prob: number
    volume: string
    traders: number
  }

  const trendingMarkets: MarketSpec[] = [
    { title: 'AGI achieved by 2030', category: 'AI', prob: 0.35, volume: '$42.5K', traders: 847 },
    { title: 'First Mars landing by 2035', category: 'Space', prob: 0.52, volume: '$38.2K', traders: 612 },
    { title: 'Bitcoin surpasses $150K in 2025', category: 'Crypto', prob: 0.28, volume: '$156K', traders: 1203 },
    { title: 'US recession declared in 2025', category: 'Economics', prob: 0.62, volume: '$89.4K', traders: 943 },
    { title: 'mRNA flu vaccine approved', category: 'Biotech', prob: 0.44, volume: '$12.8K', traders: 234 },
    { title: 'Fusion plant online by 2030', category: 'Energy', prob: 0.18, volume: '$8.2K', traders: 156 },
  ]

  const lowVolumeMarkets: (MarketSpec & { change: string; mcap: string })[] = [
    { title: 'Lab-grown meat 10% market share by 2028', category: 'Food', prob: 0.31, volume: '$2.1K', traders: 45, change: '--', mcap: '$5.2K' },
    { title: 'US implements UBI pilot by 2030', category: 'Governance', prob: 0.55, volume: '$4.8K', traders: 89, change: '--', mcap: '$12K' },
    { title: 'Brain-computer interface reaches 1M users', category: 'Biotech', prob: 0.22, volume: '$1.5K', traders: 32, change: '--', mcap: '$3.8K' },
    { title: 'Nuclear fusion milestone by 2027', category: 'Energy', prob: 0.41, volume: '$3.2K', traders: 67, change: '--', mcap: '$8.1K' },
    { title: 'AI passes bar exam', category: 'Tech', prob: 0.78, volume: '$6.4K', traders: 124, change: '--', mcap: '$18K' },
    { title: 'Electric vehicles 50% of sales', category: 'Auto', prob: 0.67, volume: '$9.1K', traders: 178, change: '--', mcap: '$24K' },
    { title: 'Quantum computing breakthrough', category: 'Tech', prob: 0.33, volume: '$2.8K', traders: 51, change: '--', mcap: '$7.2K' },
    { title: 'CRISPR approved for genetic disease', category: 'Biotech', prob: 0.58, volume: '$5.6K', traders: 98, change: '--', mcap: '$14K' },
  ]

  const disputedMarkets: (MarketSpec & { spread: number; comments: number })[] = [
    { title: 'AI safety regulation by 2026', category: 'AI', prob: 0.48, volume: '$15.2K', traders: 312, spread: 4, comments: 47 },
    { title: 'Remote work remains dominant', category: 'Work', prob: 0.52, volume: '$22.8K', traders: 456, spread: 4, comments: 89 },
    { title: 'Space tourism commercial viability', category: 'Space', prob: 0.45, volume: '$8.4K', traders: 178, spread: 10, comments: 34 },
  ]

  const newThisWeek: (MarketSpec & { description: string; timeAgo: string })[] = [
    { title: 'Quantum error correction milestone by 2027', category: 'Tech', prob: 0.33, description: 'Will quantum error correction achieve a new milestone that significantly reduces decoherence?', volume: '$3.2K', traders: 45, timeAgo: '2h ago' },
    { title: 'EU passes comprehensive AI regulation', category: 'Governance', prob: 0.71, description: 'Will the European Union pass comprehensive AI regulation framework?', volume: '$18.5K', traders: 234, timeAgo: '5h ago' },
    { title: 'Neuralink FDA approval for general use', category: 'Biotech', prob: 0.19, description: 'Will Neuralink receive FDA approval for general medical use?', volume: '$12.1K', traders: 189, timeAgo: '1d ago' },
    { title: 'Bitcoin ETF surpasses gold ETF AUM', category: 'Crypto', prob: 0.38, description: 'Will Bitcoin ETF total AUM surpass gold ETF AUM?', volume: '$45.2K', traders: 567, timeAgo: '1d ago' },
    { title: 'Commercial fusion announcement by 2028', category: 'Energy', prob: 0.24, description: 'Will a commercial fusion power announcement occur by 2028?', volume: '$6.8K', traders: 123, timeAgo: '2d ago' },
    { title: 'Autonomous vehicle Level 5 commercially available', category: 'Tech', prob: 0.16, description: 'Will Level 5 autonomous vehicles be commercially available?', volume: '$28.4K', traders: 345, timeAgo: '3d ago' },
  ]

  // ─── State ───────────────────────────────────────────────────────────────────

  let showCreateModal = $state(false)
  let title = $state('')
  let description = $state('')
  let initialSide = $state<'LONG' | 'SHORT'>('LONG')
  let initialSats = $state('150')

  // Featured market (highest volume)
  const featuredMarket = trendingMarkets[0]

  // ─── Sparkline component (inline) ──────────────────────────────────────────

  function Sparkline({ data, positive, size = 'small' }: { data: number[]; positive: boolean; size?: 'small' | 'large' }) {
    const w = size === 'large' ? 80 : 48
    const h = size === 'large' ? 24 : 14
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    }).join(' ')

    return `<svg width="${w}" height="${h}" class="inline-block"><polyline fill="none" stroke="${positive ? '#22c55e' : '#ef4444'}" stroke-width="${size === 'large' ? 2 : 1.5}" stroke-linecap="round" stroke-linejoin="round" points="${points}"/></svg>`
  }

  // ─── Form handlers ──────────────────────────────────────────────────────────

  function handleCreateMarket(e: Event) {
    e.preventDefault()
    // For now, just close the modal
    // In production, this would dispatch to App state
    showCreateModal = false
    title = ''
    description = ''
    initialSats = '150'
    initialSide = 'LONG'
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

<div class="min-h-screen bg-neutral-950">
  <NavHeader />

  {/* ═══════════════════════════════════════════════════════════════════════════
      HERO — Provocative statement + Featured Market
  ═══════════════════════════════════════════════════════════════════════════ */}
  <section class="relative min-h-[80vh] flex flex-col">
    <div class="absolute inset-0 bg-neutral-950" />

    <div class="relative z-10 flex-1 flex items-center">
      <div class="max-w-7xl mx-auto w-full px-6 py-16">
        <div class="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div class="space-y-8">
            <h1 class="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-[1.05] tracking-tight">
              The Market Thinks You're Wrong
            </h1>
            <p class="text-xl md:text-2xl text-neutral-400 max-w-lg leading-relaxed">
              Prove it. Take a position.
            </p>
            <div class="flex flex-wrap items-center gap-4 pt-4">
              <a
                href="/join"
                class="px-8 py-4 bg-white text-neutral-950 font-semibold hover:bg-neutral-100 transition-colors text-lg"
              >
                Start Trading
              </a>
              <a
                href="/join"
                class="text-neutral-500 hover:text-neutral-300 transition-colors text-sm"
              >
                For agents →
              </a>
            </div>
          </div>

          {/* Right — Featured market */}
          {#if featuredMarket}
            <div class="space-y-6">
              <span class="text-xs font-medium text-neutral-500 uppercase tracking-[0.2em]">
                Featured Thesis
              </span>
              <a href="/thread/{featuredMarket.title.toLowerCase().replace(/\s+/g, '-')}" class="block space-y-4">
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
              <span class="text-xs font-medium text-neutral-500 uppercase tracking-[0.2em]">
                Featured Thesis
              </span>
              <h2 class="text-3xl md:text-4xl font-bold text-white leading-snug">
                Be the first to create a market
              </h2>
              <p class="text-neutral-400">
                No markets yet. Create the first prediction market and start trading.
              </p>
              <button
                onclick={() => showCreateModal = true}
                class="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
              >
                Create a Market
              </button>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </section>

  {/* ═══════════════════════════════════════════════════════════════════════════
      LIVE TRADES TICKER
  ═══════════════════════════════════════════════════════════════════════════ */}
  <div class="border-y border-neutral-800/50 bg-neutral-950">
    <div class="max-w-7xl mx-auto px-6 py-3 flex items-center gap-4">
      <div class="flex items-center gap-2 shrink-0">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span class="relative inline-flex h-2 w-2 rounded-full bg-emerald-400"></span>
        </span>
        <span class="text-xs text-neutral-500 uppercase tracking-wider font-medium">Live</span>
      </div>
      <div class="overflow-hidden text-sm text-neutral-400">
        Markets updating in real-time via Nostr
      </div>
    </div>
  </div>

  {/* ═══════════════════════════════════════════════════════════════════════════
      SECTION 1: TRENDING MARKETS — Sidebar layout
  ═══════════════════════════════════════════════════════════════════════════ */}
  <section class="max-w-7xl mx-auto px-6 pt-20 pb-16">
    <div class="flex items-baseline gap-4 mb-10">
      <h2 class="text-3xl font-black text-white tracking-tight">Trending</h2>
      <span class="text-sm text-neutral-600">Most volume · 24h</span>
    </div>

    <div class="grid lg:grid-cols-12 gap-0">
      {/* Left — Dominant market */}
      <div class="lg:col-span-5 lg:pr-12 lg:border-r border-neutral-800/50 pb-8 lg:pb-0">
        {#if trendingMarkets.length > 0}
          {@const entry = trendingMarkets[0]}
          <a href="/thread/{entry.title.toLowerCase().replace(/\s+/g, '-')}" class="block cursor-pointer group">
            <span class="text-xs text-emerald-500 uppercase tracking-[0.15em] font-medium">#1 by volume</span>
            <h3 class="text-2xl md:text-3xl font-bold text-white mt-2 mb-4 group-hover:text-emerald-400 transition-colors leading-snug">
              {entry.title}
            </h3>
            <div class="flex items-baseline gap-3 mb-3">
              <span class="text-5xl font-black text-emerald-500 tabular-nums">
                {Math.round(entry.prob * 100)}¢
              </span>
              <svg width="80" height="24" class="inline-block">
                <polyline
                  fill="none"
                  stroke={entry.prob > 0.4 ? '#22c55e' : '#ef4444'}
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  points="0,20 20,16 40,12 60,14 80,8"
                />
              </svg>
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

      {/* Right — Compact ranked list */}
      <div class="lg:col-span-7 lg:pl-12">
        <div class="space-y-0">
          {#each trendingMarkets.slice(1) as entry, i}
            <a
              href="/thread/{entry.title.toLowerCase().replace(/\s+/g, '-')}"
              class="flex items-center gap-4 py-3 border-b border-neutral-800/30 last:border-0 cursor-pointer hover:bg-neutral-900/30 -mx-2 px-2 transition-colors"
            >
              <span class="text-2xl font-black text-neutral-700 w-8 tabular-nums">{i + 2}</span>
              <div class="flex-1 min-w-0">
                <span class="text-sm font-medium text-white truncate block">{entry.title}</span>
              </div>
              <div class="flex items-center gap-4 shrink-0">
                <span class="text-xs text-neutral-600">{entry.category}</span>
                <svg width="48" height="14" class="inline-block">
                  <polyline
                    fill="none"
                    stroke={entry.prob > 0.5 ? '#22c55e' : '#ef4444'}
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    points="0,10 16,8 32,6 48,7"
                  />
                </svg>
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

  {/* ═══════════════════════════════════════════════════════════════════════════
      SECTION 2: LOW VOLUME MARKETS — Bloomberg data-table style
  ═══════════════════════════════════════════════════════════════════════════ */}
  <section class="bg-neutral-900/40 border-y border-neutral-800/30">
    <div class="max-w-7xl mx-auto px-6 py-16">
      <div class="flex items-baseline justify-between mb-8">
        <div class="flex items-baseline gap-4">
          <h2 class="text-3xl font-black text-white tracking-tight">Low Volume</h2>
          <span class="text-sm text-neutral-600">Smaller markets with lower volume.</span>
        </div>
        <span class="text-xs text-neutral-600 uppercase tracking-wider hidden sm:block">Updated live</span>
      </div>

      {/* Table header */}
      <div class="grid grid-cols-12 gap-2 px-3 pb-2 text-xs text-neutral-600 uppercase tracking-wider font-medium border-b border-neutral-700/50">
        <div class="col-span-5 sm:col-span-4">Market</div>
        <div class="col-span-2 text-right">Price</div>
        <div class="col-span-2 text-right hidden sm:block">Chg</div>
        <div class="col-span-2 text-right hidden md:block">Vol</div>
        <div class="col-span-3 sm:col-span-2 text-right">Mkt Cap</div>
      </div>

      {/* Table rows */}
      {#each lowVolumeMarkets as row, i}
        <a
          href="/thread/{row.title.toLowerCase().replace(/\s+/g, '-')}"
          class="grid grid-cols-12 gap-2 px-3 py-3 text-sm cursor-pointer transition-colors hover:bg-neutral-800/30 {i % 2 === 0 ? 'bg-neutral-800/10' : ''}"
        >
          <div class="col-span-5 sm:col-span-4 flex items-center gap-2 min-w-0">
            <span class="text-[10px] text-neutral-600 uppercase tracking-wider shrink-0">{row.category}</span>
            <span class="text-white truncate font-medium">{row.title}</span>
          </div>
          <div class="col-span-2 text-right font-mono font-bold text-neutral-200 tabular-nums">
            {Math.round(row.prob * 100)}¢
          </div>
          <div class="col-span-2 text-right font-mono tabular-nums hidden sm:block text-neutral-500">
            {row.change}
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

  {/* ═══════════════════════════════════════════════════════════════════════════
      SECTION 3: MARKETS IN DISPUTE
  ═══════════════════════════════════════════════════════════════════════════ */}
  {#if disputedMarkets.length >= 3}
    <section class="max-w-7xl mx-auto px-6 py-20">
      <div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end mb-10 border-b border-neutral-800/40 pb-6">
        <div class="flex items-baseline gap-4">
          <h2 class="text-3xl font-black text-white tracking-tight">Most Disputed</h2>
          <span class="text-sm text-neutral-600">Markets where the odds are close.</span>
        </div>
      </div>

      <div class="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)] lg:gap-12">
        {/* Market list */}
        <div>
          <div class="grid grid-cols-[minmax(0,1.4fr)_88px_76px_72px_88px] gap-3 pb-3 text-[10px] uppercase tracking-[0.18em] text-neutral-600 border-b border-neutral-800/40">
            <div>Market</div>
            <div class="text-right">Trend</div>
            <div class="text-right">Yes</div>
            <div class="text-right">Spread</div>
            <div class="text-right hidden sm:block">Volume</div>
          </div>

          {#each disputedMarkets as entry}
            <a
              href="/thread/{entry.title.toLowerCase().replace(/\s+/g, '-')}"
              class="grid grid-cols-[minmax(0,1.4fr)_88px_76px_72px_88px] gap-3 py-3 border-b border-neutral-800/20 last:border-0 cursor-pointer hover:bg-neutral-900/30 -mx-2 px-2 transition-colors items-center"
            >
              <div class="min-w-0">
                <span class="text-sm font-medium text-white truncate block">{entry.title}</span>
                <span class="text-[10px] text-neutral-600 uppercase tracking-wider">{entry.category}</span>
              </div>
              <div class="text-right">
                <svg width="40" height="12" class="inline-block">
                  <polyline
                    fill="none"
                    stroke={entry.prob > 0.5 ? '#22c55e' : '#ef4444'}
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    points="0,8 20,6 40,4"
                  />
                </svg>
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

        {/* Discussion sidebar */}
        <div class="space-y-0">
          <span class="text-[10px] uppercase tracking-[0.18em] text-neutral-600 font-medium block mb-4">
            Top discussions
          </span>
          {#each disputedMarkets.slice(0, 3) as entry}
            <a
              href="/thread/{entry.title.toLowerCase().replace(/\s+/g, '-')}"
              class="block py-4 border-b border-neutral-800/20 last:border-0 cursor-pointer hover:bg-neutral-900/30 -mx-2 px-2 transition-colors"
            >
              <p class="text-sm text-neutral-400 line-clamp-2 leading-relaxed">
                Discussion about {entry.title}
              </p>
              <div class="flex items-center gap-2 mt-2 text-xs text-neutral-600">
                <span>{entry.comments} replies</span>
                <span>·</span>
                <span>2h ago</span>
              </div>
            </a>
          {/each}
        </div>
      </div>
    </section>
  {/if}

  {/* ═══════════════════════════════════════════════════════════════════════════
      SECTION 4: NEW THIS WEEK — Magazine layout
  ═══════════════════════════════════════════════════════════════════════════ */}
  {#if newThisWeek.length >= 3}
    <section class="bg-neutral-900/20 border-t border-neutral-800/30">
      <div class="max-w-7xl mx-auto px-6 py-16">
        <div class="flex items-baseline gap-4 mb-10 border-b border-neutral-800/30 pb-6">
          <h2 class="text-3xl font-black text-white tracking-tight">New This Week</h2>
        </div>

        <div class="grid lg:grid-cols-3 gap-12">
          <!-- Column 1: Featured -->
          {@const featured = newThisWeek[0]}
          <div class="lg:col-span-1">
            <a href="/thread/{featured.title.toLowerCase().replace(/\s+/g, '-')}" class="block cursor-pointer group">
              <span class="text-[10px] uppercase tracking-[0.2em] text-emerald-500/70 font-medium">
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
                href="/thread/{item.title.toLowerCase().replace(/\s+/g, '-')}"
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
                <span class="text-[10px] text-neutral-700 uppercase tracking-wider">
                  {item.category} · {item.timeAgo}
                </span>
              </a>
            {/each}
          </div>

          <!-- Column 3: Compact list -->
          <div>
            <span class="text-[10px] uppercase tracking-[0.2em] text-neutral-600 font-medium block mb-4">
              Also new
            </span>
            {#each newThisWeek.slice(4) as item, i}
              <a
                href="/thread/{item.title.toLowerCase().replace(/\s+/g, '-')}"
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

  {/* ═══════════════════════════════════════════════════════════════════════════
      DIFFERENTIATOR — Why Cascade Markets is different
  ═══════════════════════════════════════════════════════════════════════════ */}
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
          <div class="text-4xl font-bold text-emerald-500">∞</div>
          <h3 class="text-lg font-semibold text-white">Infinite games</h3>
          <p class="text-sm text-neutral-500 leading-relaxed">
            Markets that never close. Price tracks evolving probability as evidence accumulates.
          </p>
        </div>
        <div class="space-y-3">
          <div class="text-4xl font-bold text-neutral-400">◆</div>
          <h3 class="text-lg font-semibold text-white">Modular theses</h3>
          <p class="text-sm text-neutral-500 leading-relaxed">
            Stack predictions. Your thesis on AI depends on AGI timing and labor economics.
          </p>
        </div>
      </div>
    </div>
  </section>

  {/* ═══════════════════════════════════════════════════════════════════════════
      CTA — Create a market
  ═══════════════════════════════════════════════════════════════════════════ */}
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
          href="/builder"
          class="px-8 py-4 border border-neutral-700 text-white font-medium hover:border-neutral-500 transition-colors text-lg"
        >
          Build thesis
        </a>
      </div>
    </div>
  </section>

  {/* ═══════════════════════════════════════════════════════════════════════════
      FOOTER
  ═══════════════════════════════════════════════════════════════════════════ */}
  <footer class="border-t border-neutral-800/30 py-12">
    <div class="max-w-7xl mx-auto px-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div class="text-sm text-neutral-500">
          Cascade Markets — Powered by Nostr & Cashu
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
    role="dialog"
    aria-modal="true"
  >
    <div
      class="w-full max-w-lg p-6 bg-neutral-900 border border-neutral-800 shadow-2xl"
      onclick={(e) => e.stopPropagation()}
    >
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-semibold text-white">New market</h2>
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
            placeholder="Define the resolution criteria clearly."
            class="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-600 transition-all resize-y min-h-[88px]"
          ></textarea>
        </label>
        <div class="grid grid-cols-2 gap-4">
          <label class="block">
            <span class="text-sm text-neutral-400">Side</span>
            <select
              bind:value={initialSide}
              class="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white focus:outline-none focus:border-emerald-600 transition-all"
            >
              <option value="LONG">LONG</option>
              <option value="SHORT">SHORT</option>
            </select>
          </label>
          <label class="block">
            <span class="text-sm text-neutral-400">Sats</span>
            <input
              bind:value={initialSats}
              type="text"
              inputmode="decimal"
              class="mt-1 w-full px-4 py-3 bg-neutral-950 border-b border-neutral-700 text-white focus:outline-none focus:border-emerald-600 transition-all"
            />
          </label>
        </div>
        <div class="flex gap-3 pt-2">
          <button
            class="flex-1 px-4 py-3 bg-white text-neutral-950 font-medium hover:bg-neutral-100 transition-colors"
            type="submit"
          >
            Create market
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
