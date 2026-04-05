<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import NavHeader from '$lib/components/NavHeader.svelte';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';
  import Footer from '$lib/components/Footer.svelte';

  // ─── Types ─────────────────────────────────────────────────────────────────────

  type MarketTab = 'overview' | 'charts' | 'discussion' | 'positions';
  type Side = 'LONG' | 'SHORT';

  // ─── Props ─────────────────────────────────────────────────────────────────────

  let { data } = $props();

  // ─── Route params (kept for navigation) ─────────────────────────────────────

  let marketId = $derived($page.params.marketId);

  // ─── State ───────────────────────────────────────────────────────────────────

  let activeTab = $state<MarketTab>('overview');
  let selectedSide = $state<Side>('LONG');
  let amount = $state(100);
  let tradeLoading = $state(false);
  let tradeError = $state<string | null>(null);
  let isBookmarked = $state(false);
  let mintName = $state('Cascade Mint');

  // ─── Derived data ─────────────────────────────────────────────────────────────

  let market = $derived(data.market);

  // Price calculations (simplified LMSR)
  let yesPrice = $derived(market ? market.qLong / (market.qLong + market.qShort + market.b) : 0);
  let noPrice = $derived(market ? market.qShort / (market.qLong + market.qShort + market.b) : 0);
  let probability = $derived(yesPrice);

  // Consensus analysis
  let tiltLabel = $derived(() => {
    if (probability >= 0.65) return { label: 'Strong YES consensus', detail: 'Most capital is positioned long. Price moves require new information or a catalyst for reversal.', accent: 'text-emerald-400' };
    if (probability <= 0.35) return { label: 'Strong NO consensus', detail: 'Most capital is positioned short. A reversal requires new evidence, not sentiment.', accent: 'text-rose-400' };
    return { label: 'No clear consensus', detail: 'Neither side dominates. The next material update is likely to move the price.', accent: 'text-neutral-400' };
  });

  // Format helpers
  function formatCurrency(value: number) {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function formatPercent(value: number) {
    return `${(value * 100).toFixed(1)}%`;
  }

  function formatCompactCurrency(value: number) {
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  }

  function formatTimestamp(value: number) {
    return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  // ─── Tab definitions ──────────────────────────────────────────────────────────

  const tabs: { key: MarketTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'charts', label: 'Charts' },
    { key: 'discussion', label: 'Discussion' },
    { key: 'positions', label: 'Positions' },
  ];

  // ─── Actions ─────────────────────────────────────────────────────────────────

  function setTab(tab: MarketTab) {
    activeTab = tab;
  }

  function setSide(side: Side) {
    selectedSide = side;
  }

  function setAmount(value: number) {
    amount = value;
  }

  function handleBookmark() {
    isBookmarked = !isBookmarked;
  }

  async function handleTrade() {
    if (!market) return;

    tradeLoading = true;
    tradeError = null;

    // Simulate trade execution
    // In production, this would call the trading service
    await new Promise(resolve => setTimeout(resolve, 1000));

    tradeLoading = false;
    // Trade would be executed here
  }

  function navigateToThread(threadId: string) {
    goto(`/market/${marketId}/thread/${threadId}`);
  }

  function navigateToDiscussion() {
    goto(`/thread/${marketId}`);
  }

  // ─── Sparkline component ─────────────────────────────────────────────────────

  function Sparkline({ data, positive, width = 80, height = 24 }: { data: number[]; positive: boolean; width?: number; height?: number }) {
    if (data.length < 2) return '';

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    const points = data.map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    return `<svg width="${width}" height="${height}" class="inline-block"><polyline fill="none" stroke="${positive ? '#22c55e' : '#ef4444'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}"/></svg>`;
  }
</script>

<svelte:head>
  <title>{market?.title || 'Market'} | Cascade</title>
</svelte:head>

<div class="min-h-screen bg-neutral-950 text-white">
  <NavHeader />

  {#if !market}
    <div class="max-w-5xl mx-auto px-4 py-24 text-center">
      <h1 class="text-2xl font-semibold text-white">Market not found</h1>
      <p class="mt-2 text-neutral-500">The market you're looking for doesn't exist.</p>
      <a href="/" class="mt-6 inline-block text-sm text-emerald-500 hover:text-emerald-400">
        ← Back to home
      </a>
    </div>
  {:else}
    <main class="max-w-6xl mx-auto px-4 pb-32">
      <!-- Header -->
      <header class="pt-8 pb-6 border-b border-neutral-800">
        <div class="flex items-start justify-between gap-4">
          <div class="flex-1">
            <!-- Breadcrumb -->
            <div class="flex items-center gap-2 text-sm text-neutral-500 mb-3">
              <a href="/" class="hover:text-neutral-300">Markets</a>
              <span>›</span>
              <span class="text-neutral-400">{market.title}</span>
            </div>

            <!-- Title -->
            <h1 class="text-2xl font-semibold text-white">{market.title}</h1>

            <!-- Meta info -->
            <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-neutral-500">
              <span>Created {formatTimestamp(market.createdAt)}</span>
              {#if market.endDate}
                <span>·</span>
                <span>Ends {formatTimestamp(market.endDate)}</span>
              {/if}
              <span>·</span>
              <span>Mint: {mintName}</span>
            </div>
          </div>

          <!-- Bookmark -->
          <BookmarkButton
            {isBookmarked}
            onToggle={handleBookmark}
            size="md"
          />
        </div>
      </header>

      <!-- Tabs -->
      <nav class="flex gap-1 border-b border-neutral-800 mt-6">
        {#each tabs as tab}
          <button
            onclick={() => setTab(tab.key)}
            class="px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px {
              activeTab === tab.key
                ? 'border-white text-white'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            }"
          >
            {tab.label}
          </button>
        {/each}
      </nav>

      <!-- Content Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 mt-6">
        <!-- Main Content -->
        <div>
          {#if activeTab === 'overview'}
            <!-- Overview Tab -->
            <section class="space-y-8">
              <!-- Consensus -->
              <div class="bg-neutral-900/50 border border-neutral-800 rounded-none p-6">
                <h2 class={`text-2xl font-semibold ${tiltLabel().accent}`}>
                  {tiltLabel().label}
                </h2>
                <p class="mt-2 text-neutral-300">{tiltLabel().detail}</p>

                <!-- Quick stats -->
                <div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-500">YES</div>
                    <div class="mt-1 text-2xl font-semibold text-emerald-400">
                      {(yesPrice * 100).toFixed(0)}¢
                    </div>
                  </div>
                  <div>
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-500">NO</div>
                    <div class="mt-1 text-2xl font-semibold text-rose-400">
                      {(noPrice * 100).toFixed(0)}¢
                    </div>
                  </div>
                  <div>
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-500">Reserve</div>
                    <div class="mt-1 text-2xl font-semibold text-white">
                      {formatCompactCurrency(market.reserve)}
                    </div>
                  </div>
                  <div>
                    <div class="text-xs uppercase tracking-[0.18em] text-neutral-500">Volume</div>
                    <div class="mt-1 text-2xl font-semibold text-white">
                      {market.receipts.length > 0 ? '$12.5K' : '$0'}
                    </div>
                  </div>
                </div>
              </div>

              <!-- Price History -->
              <div>
                <h3 class="text-lg font-semibold text-white">Price history</h3>
                <div class="mt-4 h-48 bg-neutral-900/50 border border-neutral-800 rounded-none p-4 flex items-center justify-center">
                  <div class="text-center">
                    {@html Sparkline({
                      data: market.history.map(h => h.price),
                      positive: market.history.length > 1 && market.history[market.history.length - 1].price >= market.history[0].price,
                      width: 200,
                      height: 60
                    })}
                    <div class="mt-2 text-sm text-neutral-500">
                      {formatPercent(probability)} YES probability
                    </div>
                  </div>
                </div>

                <!-- Probability bars -->
                <div class="mt-4 space-y-3">
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-neutral-400">Implied probability</span>
                      <span class="text-white">{formatPercent(yesPrice)} YES</span>
                    </div>
                    <div class="h-2 bg-neutral-900 rounded-none overflow-hidden">
                      <div class="h-full bg-emerald-500" style="width: {yesPrice * 100}%"></div>
                    </div>
                  </div>
                  <div>
                    <div class="flex justify-between text-sm mb-1">
                      <span class="text-neutral-400">Committed capital</span>
                      <span class="text-white">{formatPercent(yesPrice)} YES</span>
                    </div>
                    <div class="h-2 bg-neutral-900 rounded-none overflow-hidden">
                      <div class="h-full bg-emerald-500" style="width: {yesPrice * 100}%"></div>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Description -->
              <div>
                <h3 class="text-lg font-semibold text-white">About this market</h3>
                <p class="mt-3 text-neutral-300 leading-relaxed">
                  {market.description}
                </p>
              </div>
            </section>
          {:else if activeTab === 'charts'}
            <!-- Charts Tab -->
            <section class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-white">Price chart</h3>
                <div class="mt-4 h-80 bg-neutral-900/50 border border-neutral-800 rounded-none p-4 flex items-center justify-center">
                  <div class="text-center text-neutral-500">
                    Price chart visualization
                  </div>
                </div>
              </div>

              <!-- Events timeline -->
              <div>
                <h3 class="text-lg font-semibold text-white">Market events</h3>
                <div class="mt-4 divide-y divide-neutral-800">
                  {#if market.events.length > 0}
                    {#each market.events as event}
                      <div class="py-4">
                        <div class="text-sm text-neutral-300">{event.description}</div>
                        <div class="mt-1 text-xs text-neutral-500">{formatTimestamp(event.createdAt)}</div>
                      </div>
                    {/each}
                  {:else}
                    <div class="py-4 text-sm text-neutral-500">No events yet.</div>
                  {/if}
                </div>
              </div>
            </section>
          {:else if activeTab === 'discussion'}
            <!-- Discussion Tab -->
            <section>
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-semibold text-white">Discussion</h3>
                <button
                  onclick={navigateToDiscussion}
                  class="text-sm text-emerald-500 hover:text-emerald-400"
                >
                  View all →
                </button>
              </div>
              <div class="bg-neutral-900/50 border border-neutral-800 rounded-none p-8 text-center">
                <div class="text-neutral-500">No discussions yet</div>
                <p class="mt-2 text-sm text-neutral-600">Be the first to start a discussion about this market.</p>
              </div>
            </section>
          {:else if activeTab === 'positions'}
            <!-- Positions Tab -->
            <section class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-white">Your positions</h3>
                <div class="mt-4 bg-neutral-900/50 border border-neutral-800 rounded-none p-8 text-center">
                  <div class="text-neutral-500">No positions yet</div>
                  <p class="mt-2 text-sm text-neutral-600">Trade on this market to see your positions here.</p>
                </div>
              </div>

              <div>
                <h3 class="text-lg font-semibold text-white">Recent trades</h3>
                <div class="mt-4 divide-y divide-neutral-800">
                  {#if market.receipts.length > 0}
                    {#each market.receipts as receipt}
                      <div class="flex items-start justify-between gap-4 py-4">
                        <div>
                          <div class="font-medium text-white">
                            {receipt.actor} {receipt.kind}
                          </div>
                          <div class="mt-1 text-sm text-neutral-400">
                            {receipt.side} · {receipt.tokens.toFixed(3)} tokens
                          </div>
                        </div>
                        <div class="text-right text-sm">
                          <div class="text-white">{formatCurrency(receipt.sats)}</div>
                          <div class="mt-1 text-xs text-neutral-500">
                            {formatTimestamp(receipt.createdAt)}
                          </div>
                        </div>
                      </div>
                    {/each}
                  {:else}
                    <div class="py-4 text-sm text-neutral-500">No trades yet.</div>
                  {/if}
                </div>
              </div>
            </section>
          {/if}
        </div>

        <!-- Sidebar: Trade Form -->
        <aside class="lg:col-span-1">
          <div class="sticky top-24 border-l border-neutral-800 pl-6">
            {#if market.status === 'resolved'}
              <div>
                <span class={`text-xs font-medium px-2 py-0.5 ${
                  market.resolutionOutcome === 'YES'
                    ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-800'
                    : 'bg-rose-900/30 text-rose-400 border border-rose-800'
                }`}>
                  RESOLVED {market.resolutionOutcome}
                </span>
                <p class="mt-4 text-sm text-neutral-500">
                  This market has been resolved. Trading is closed.
                </p>
              </div>
            {:else}
              <!-- Trade Header -->
              <div class="flex items-start justify-between gap-4">
                <div>
                  <h3 class="text-lg font-semibold text-white">
                    {selectedSide === 'LONG' ? 'Add YES exposure' : 'Add NO exposure'}
                  </h3>
                  <p class="mt-2 text-sm text-neutral-500">
                    Trades execute instantly via LMSR pricing.
                  </p>
                </div>
                <div class={`px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                  selectedSide === 'LONG'
                    ? 'border border-emerald-500/30 text-emerald-400'
                    : 'border border-rose-500/30 text-rose-400'
                }`}>
                  {selectedSide === 'LONG' ? 'YES' : 'NO'}
                </div>
              </div>

              <!-- Side selector -->
              <div class="mt-5 grid grid-cols-2 gap-px overflow-hidden border border-neutral-800 bg-neutral-800 rounded-none">
                <button
                  onclick={() => setSide('LONG')}
                  class="px-4 py-4 text-left transition-colors {
                    selectedSide === 'LONG'
                      ? 'bg-emerald-500/10 text-white'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white'
                  }"
                >
                  <div class="text-xs uppercase tracking-[0.2em] text-neutral-500">Buy YES</div>
                  <div class="mt-2 text-2xl font-semibold text-emerald-400">
                    {(yesPrice * 100).toFixed(0)}¢
                  </div>
                </button>
                <button
                  onclick={() => setSide('SHORT')}
                  class="px-4 py-4 text-left transition-colors {
                    selectedSide === 'SHORT'
                      ? 'bg-rose-500/10 text-white'
                      : 'bg-neutral-950 text-neutral-400 hover:text-white'
                  }"
                >
                  <div class="text-xs uppercase tracking-[0.2em] text-neutral-500">Buy NO</div>
                  <div class="mt-2 text-2xl font-semibold text-rose-400">
                    {(noPrice * 100).toFixed(0)}¢
                  </div>
                </button>
              </div>

              <!-- Amount input -->
              <div class="mt-5 border-t border-neutral-800 pt-5">
                <div class="mb-2 flex items-center justify-between text-sm">
                  <label for="amount" class="text-neutral-500">Size (sats)</label>
                  <div class="text-neutral-600">Quick sizes</div>
                </div>
                <div class="flex gap-2">
                  <button
                    onclick={() => setAmount(50)}
                    class="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-none transition-colors"
                  >
                    50
                  </button>
                  <button
                    onclick={() => setAmount(100)}
                    class="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-none transition-colors {amount === 100 ? 'ring-1 ring-emerald-500' : ''}"
                  >
                    100
                  </button>
                  <button
                    onclick={() => setAmount(500)}
                    class="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-none transition-colors"
                  >
                    500
                  </button>
                  <button
                    onclick={() => setAmount(1000)}
                    class="px-3 py-1.5 text-xs text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 rounded-none transition-colors"
                  >
                    1K
                  </button>
                </div>
                <input
                  id="amount"
                  type="number"
                  bind:value={amount}
                  min="1"
                  class="mt-3 w-full px-3 py-2 bg-neutral-900 border border-neutral-800 rounded-none text-white text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Enter amount in sats"
                />
              </div>

              <!-- Trade preview -->
              <div class="mt-5 space-y-2 text-sm">
                <div class="flex justify-between">
                  <span class="text-neutral-500">Price</span>
                  <span class="text-white">
                    {selectedSide === 'LONG' ? `${(yesPrice * 100).toFixed(2)}¢` : `${(noPrice * 100).toFixed(2)}¢`}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-neutral-500">You'll receive</span>
                  <span class="text-white">
                    {selectedSide === 'LONG'
                      ? `${(amount / (yesPrice * 100)).toFixed(3)} YES tokens`
                      : `${(amount / (noPrice * 100)).toFixed(3)} NO tokens`
                    }
                  </span>
                </div>
              </div>

              <!-- Error message -->
              {#if tradeError}
                <div class="mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-none text-sm text-rose-400">
                  {tradeError}
                </div>
              {/if}

              <!-- Trade button -->
              <button
                onclick={handleTrade}
                disabled={tradeLoading || amount <= 0}
                class="mt-5 w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 rounded-none font-medium text-white transition-colors"
              >
                {#if tradeLoading}
                  Processing...
                {:else}
                  {selectedSide === 'LONG' ? 'Buy YES' : 'Buy NO'} · {amount} sats
                {/if}
              </button>

              <!-- Disclaimer -->
              <p class="mt-4 text-xs text-neutral-600">
                Trade execution is subject to mint availability. Funds are held in escrow until market resolution.
              </p>
            {/if}
          </div>
        </aside>
      </div>
    </main>
  {/if}

  <Footer />
</div>
