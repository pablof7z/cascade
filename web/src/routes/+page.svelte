<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { formatProductAmount } from '$lib/cascade/format';
  import { getCascadeEdition, getAlternateEditionUrl } from '$lib/cascade/config';
  import {
    buildTradeSummary,
    formatRelativeTime,
    getCascadeEventKinds,
    marketDiscussionUrl,
    marketUrl,
    sanitizeMarketCopy,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    truncateText,
    type DiscussionRecord,
    type MarketRecord,
    type MarketTradeSummary,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName } from '$lib/ndk/format';
  import {
    filterHomepageMarkets,
    filterLiveHomepageMarkets,
    formatHomepageMarketMatchCount
  } from './homepage-market-search';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let searchQuery = $state('');
  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const isPracticeEdition = $derived(selectedEdition === 'signet');
  const alternateEditionUrl = $derived(getAlternateEditionUrl(selectedEdition));

  const discussionFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [1111], '#K': [String(eventKinds.market)], limit: 80 }] };
  });

  const marketFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.market], limit: 60 }] };
  });

  const tradeFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.trade], limit: 240 }] };
  });

  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);

  const trades = $derived.by(() => {
    return mergeRawEvents(data.trades, tradeFeed.events)
      .map((event) => parseTradeEvent(event, selectedEdition))
      .filter((trade): trade is TradeRecord => Boolean(trade))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const markets = $derived.by(() => {
    return filterLiveHomepageMarkets(
      mergeRawEvents(data.markets, marketFeed.events)
        .map((event) => parseMarketEvent(event, selectedEdition))
        .filter((market): market is MarketRecord => Boolean(market)),
      trades,
      { skipTradeFilter: isPracticeEdition }
    ).sort((left, right) => right.createdAt - left.createdAt);
  });

  const discussions = $derived.by(() => {
    return mergeRawEvents(data.discussions, discussionFeed.events)
      .map((event) => parseDiscussionEvent(event, selectedEdition))
      .filter((discussion): discussion is DiscussionRecord => Boolean(discussion))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const tradeSummaries = $derived.by(() => {
    const grouped = new Map<string, TradeRecord[]>();

    for (const trade of trades) {
      const bucket = grouped.get(trade.marketId);
      if (bucket) {
        bucket.push(trade);
      } else {
        grouped.set(trade.marketId, [trade]);
      }
    }

    const summaries = new Map<string, MarketTradeSummary>();
    for (const [marketId, bucket] of grouped) {
      summaries.set(marketId, buildTradeSummary(bucket));
    }

    return summaries;
  });

  const discussionCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const discussion of discussions) {
      counts.set(discussion.marketId, (counts.get(discussion.marketId) ?? 0) + 1);
    }
    return counts;
  });

  const marketById = $derived(new Map(markets.map((market) => [market.id, market])));

  const featuredMarket = $derived.by(() => {
    return [...markets].sort(compareByVolumeThenRecency)[0] ?? null;
  });

  const trendingMarkets = $derived.by(() => {
    return [...markets].sort(compareByVolumeThenRecency).slice(0, 6);
  });

  const primaryTrending = $derived(trendingMarkets[0] ?? null);
  const rankedTrending = $derived(trendingMarkets.slice(1, 6));

  const lowVolumeMarkets = $derived.by(() => {
    return [...markets]
      .sort((left, right) => {
        const leftVolume = tradeSummaries.get(left.id)?.grossVolume ?? 0;
        const rightVolume = tradeSummaries.get(right.id)?.grossVolume ?? 0;
        if (leftVolume !== rightVolume) return leftVolume - rightVolume;
        return right.createdAt - left.createdAt;
      })
      .slice(0, 6);
  });

  const disputedMarkets = $derived.by(() => {
    return [...markets]
      .filter((market) => tradeSummaries.get(market.id)?.latestPricePpm != null)
      .sort((left, right) => {
        const leftPrice = tradeSummaries.get(left.id)?.latestPricePpm ?? 500_000;
        const rightPrice = tradeSummaries.get(right.id)?.latestPricePpm ?? 500_000;
        return Math.abs(leftPrice - 500_000) - Math.abs(rightPrice - 500_000);
      })
      .slice(0, 6);
  });

  const newThisWeek = $derived.by(() => {
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    return markets.filter((market) => market.createdAt >= weekAgo).slice(0, 6);
  });

  const latestDiscussions = $derived(
    discussions
      .map((discussion) => ({
        discussion,
        market: marketById.get(discussion.marketId)
      }))
      .filter((entry): entry is { discussion: DiscussionRecord; market: MarketRecord } => Boolean(entry.market))
      .slice(0, 8)
  );

  const tickerMarkets = $derived.by(() => {
    const seen = new Set<string>();
    const combined = [...trendingMarkets, ...newThisWeek, ...markets];
    const deduped: MarketRecord[] = [];

    for (const market of combined) {
      if (seen.has(market.id)) continue;
      seen.add(market.id);
      deduped.push(market);
      if (deduped.length >= 10) break;
    }

    return deduped;
  });

  const filteredMarkets = $derived.by(() => filterHomepageMarkets(markets, searchQuery));
  const hasActiveMarketSearch = $derived(searchQuery.trim().length > 0);
  const searchResultCountLabel = $derived(formatHomepageMarketMatchCount(filteredMarkets.length));

  function compareByVolumeThenRecency(left: MarketRecord, right: MarketRecord): number {
    const leftVolume = tradeSummaries.get(left.id)?.grossVolume ?? 0;
    const rightVolume = tradeSummaries.get(right.id)?.grossVolume ?? 0;
    if (rightVolume !== leftVolume) return rightVolume - leftVolume;
    return right.createdAt - left.createdAt;
  }

  function mergeRawEvents(seed: NostrEvent[], live: NDKEvent[]): NostrEvent[] {
    const map = new Map<string, NostrEvent>();
    for (const event of live) {
      const raw = event.rawEvent() as NostrEvent;
      if (raw.id) map.set(raw.id, raw);
    }
    for (const event of seed) {
      if (event.id && !map.has(event.id)) map.set(event.id, event);
    }
    return [...map.values()];
  }

  function authorLabel(pubkey: string): string {
    return displayName(profiles[pubkey], 'Cascade user');
  }

  function probabilityForMarket(marketId: string): number {
    return (tradeSummaries.get(marketId)?.latestPricePpm ?? 500_000) / 1_000_000;
  }

  function centsForMarket(marketId: string): string {
    return `${Math.round(probabilityForMarket(marketId) * 100)}¢`;
  }

  function spreadForMarket(marketId: string): string {
    return `${Math.round(Math.abs(probabilityForMarket(marketId) - 0.5) * 100)} pt`;
  }
</script>

<!-- ============================================================ -->
<!-- HERO                                                          -->
<!-- ============================================================ -->
<section class="py-16 max-md:py-10">
  <div class="grid gap-12 md:gap-20 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] items-center">
    <div>
      <h1 class="max-w-[16ch] text-5xl font-bold tracking-tighter leading-none md:text-7xl">The crowd has a price. Prove it wrong.</h1>
      <p class="mt-6 max-w-lg text-base-content/60 text-lg leading-relaxed">
        Cascade is a prediction market where positions stay open forever.
        No expiry, no oracle. Create a market, defend your thesis, and trade on your conviction.
      </p>

      <div class="mt-8 flex items-center gap-4 flex-wrap">
        <a class="btn btn-primary btn-lg" href="/join">Start Trading</a>
        <a class="text-sm text-base-content/60 hover:text-base-content transition-colors" href="/how-it-works">How it works →</a>
      </div>
    </div>

    <div class="grid gap-4 content-center">
      <div class="text-xs text-base-content/40 uppercase tracking-widest font-semibold">Featured Thesis</div>

      {#if featuredMarket}
        <a class="card card-border card-side bg-base-200 hover:bg-base-300 border-l-2 border-primary pl-6 grid gap-4 transition-colors" href={marketUrl(featuredMarket.slug)}>
          <h2 class="max-w-[14ch] text-3xl font-bold leading-tight transition-colors group-hover:text-success">{featuredMarket.title}</h2>

          <div class="flex items-baseline gap-3">
            <span class="text-success font-mono text-5xl font-bold tracking-tight">{centsForMarket(featuredMarket.id)}</span>
            <span class="badge badge-success badge-outline">{probabilityForMarket(featuredMarket.id) >= 0.5 ? 'LONG' : 'SHORT'}</span>
          </div>

          <div class="flex flex-wrap gap-5 text-sm text-base-content/40">
            <span>{formatProductAmount(tradeSummaries.get(featuredMarket.id)?.grossVolume ?? 0, 'usd')} vol</span>
            <span>{tradeSummaries.get(featuredMarket.id)?.tradeCount ?? 0} trades</span>
          </div>

          <p class="max-w-prose text-base-content/60 leading-relaxed">{truncateText(sanitizeMarketCopy(featuredMarket.description || featuredMarket.body), 180)}</p>
        </a>
      {:else if isPracticeEdition}
        <div class="border-l-2 border-primary pl-6 grid gap-4">
          <h2 class="max-w-[16ch] text-3xl font-bold leading-tight">Practice mode — paper money, real mechanics</h2>
          <p class="text-base-content/60">No practice markets are live yet. Create one to try the full trading flow with paper funds — nothing real is at stake.</p>
          <div class="flex items-center gap-4 flex-wrap">
            <a class="btn btn-primary" href="/builder">Create a Practice Market</a>
            {#if alternateEditionUrl}
              <a class="btn btn-outline btn-sm" href={alternateEditionUrl}>Switch to Live →</a>
            {/if}
          </div>
        </div>
      {:else}
        <div class="border-l-2 border-primary pl-6 grid gap-4">
          <h2 class="max-w-[12ch] text-3xl font-bold leading-tight">Be the first to create a market</h2>
          <p class="text-base-content/60">No markets yet. Create the first public market and start the book.</p>
          <div class="flex items-center gap-4">
            <a class="btn btn-primary" href="/builder">Create a Market</a>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

<!-- ============================================================ -->
<!-- HOW IT WORKS STRIP                                            -->
<!-- ============================================================ -->
<section class="full-bleed bg-base-200 py-10">
  <div class="shell grid gap-8 sm:grid-cols-3">
    <div class="flex items-start gap-3">
      <span class="font-mono text-sm text-base-content/40">01</span>
      <p class="text-sm text-base-content/70">Pick a question</p>
    </div>
    <div class="flex items-start gap-3">
      <span class="font-mono text-sm text-base-content/40">02</span>
      <p class="text-sm text-base-content/70">Buy LONG or SHORT</p>
    </div>
    <div class="flex items-start gap-3">
      <span class="font-mono text-sm text-base-content/40">03</span>
      <p class="text-sm text-base-content/70">Exit anytime</p>
    </div>
  </div>
</section>

<!-- ============================================================ -->
<!-- VALUE PROPS                                                   -->
<!-- ============================================================ -->
<section class="py-12 grid gap-8">
  <div>
    <h2 class="text-3xl font-bold tracking-tight">Markets that never close.</h2>
    <p class="mt-1 text-sm text-base-content/40">
      Traditional markets end. Cascade stays open. You can publish a market, defend the case in public,
      and exit when the price makes sense for you.
    </p>
  </div>

  <div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
    <article class="grid gap-3 content-start pt-2">
      <span class="text-lg text-base-content/60">∞</span>
      <h3 class="font-semibold">No expiry</h3>
      <p class="text-sm text-base-content/40 leading-relaxed">Take a position today. Trading continues indefinitely, and you can exit whenever the price makes sense for you.</p>
    </article>

    <article class="grid gap-3 content-start pt-2">
      <span class="text-lg text-base-content/60">◆</span>
      <h3 class="font-semibold">Linked beliefs</h3>
      <p class="text-sm text-base-content/40 leading-relaxed">Connect related markets. Build a thesis. Each bet stands on its own.</p>
    </article>

    <article class="grid gap-3 content-start pt-2">
      <span class="text-lg text-base-content/60">→</span>
      <h3 class="font-semibold">On the record</h3>
      <p class="text-sm text-base-content/40 leading-relaxed">Anyone can publish a market. Every trade is public. Your conviction is on record.</p>
    </article>
  </div>

  <div class="flex items-center gap-4 flex-wrap">
    <a class="btn btn-primary" href="/builder">Create market</a>
    <a class="btn btn-outline" href="/how-it-works">How it works</a>
  </div>
</section>

<!-- ============================================================ -->
<!-- LIVE TICKER                                                   -->
<!-- ============================================================ -->
<section class="full-bleed bg-base-200" aria-label="Live market strip">
  <div class="shell marquee-strip">
    <div class="marquee-label">
      <span class="marquee-dot"></span>
      <span>Live</span>
    </div>

    <div class="marquee-shell">
      {#if tickerMarkets.length > 0}
        <div class="marquee-belt">
          {#each [...tickerMarkets, ...tickerMarkets] as market, index (`${market.id}-${index}`)}
            <a class="marquee-item" href={marketUrl(market.slug)}>
              <span class="font-mono text-xs text-base-content/40 uppercase">{market.categories[0] || 'Market'}</span>
              <span class="text-base-content">{market.title}</span>
              <span class:text-success={probabilityForMarket(market.id) >= 0.5} class:text-error={probabilityForMarket(market.id) < 0.5}>
                {centsForMarket(market.id)}
              </span>
            </a>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-base-content/40">Markets appear here as they stream in.</div>
      {/if}
    </div>
  </div>
</section>

<!-- ============================================================ -->
<!-- MARKET DISCOVERY                                              -->
<!-- ============================================================ -->
<div class="grid gap-6 pt-12">
  <div class="grid gap-2 justify-items-start">
    <input
      type="search"
      name="market-search"
      class="input input-bordered w-full max-w-md bg-base-100"
      placeholder="Search markets…"
      aria-label="Search markets"
      bind:value={searchQuery}
    />

    {#if hasActiveMarketSearch}
      <p class="text-sm text-base-content/40">{searchResultCountLabel}</p>
    {/if}
  </div>

  {#if hasActiveMarketSearch}
    <div class="divide-y divide-base-300 border-y border-base-300">
      <div class="hidden sm:grid grid-cols-[minmax(0,1.9fr)_0.55fr_0.6fr_0.55fr_0.55fr_0.7fr] gap-4 items-center py-3 text-xs text-base-content/40 uppercase tracking-wide font-semibold">
        <span>Market</span>
        <span>Price</span>
        <span>Vol</span>
        <span>Trades</span>
        <span>Threads</span>
        <span>Time</span>
      </div>

      {#if filteredMarkets.length > 0}
        {#each filteredMarkets as market (market.id)}
          <a class="grid grid-cols-[minmax(0,1.9fr)_0.55fr_0.6fr_0.55fr_0.55fr_0.7fr] gap-4 items-center py-3 transition-colors duration-150 hover:bg-base-300/50" href={marketUrl(market.slug)}>
            <div class="min-w-0 grid gap-1">
              <span class="truncate text-white font-semibold">{market.title}</span>
              <span class="text-sm text-base-content/40 truncate">
                {truncateText(sanitizeMarketCopy(market.description || market.body), 120)}
              </span>
            </div>
            <span class="font-mono text-sm">{centsForMarket(market.id)}</span>
            <span class="font-mono text-sm">{formatProductAmount(tradeSummaries.get(market.id)?.grossVolume ?? 0, 'usd')}</span>
            <span class="font-mono text-sm">{tradeSummaries.get(market.id)?.tradeCount ?? 0}</span>
            <span class="font-mono text-sm">{discussionCounts.get(market.id) ?? 0}</span>
            <span class="text-sm text-base-content/40 text-right">{formatRelativeTime(market.createdAt)}</span>
          </a>
        {/each}
      {:else}
        <div class="py-4 text-sm text-base-content/40">No markets matched your search.</div>
      {/if}
    </div>
  {:else}
    <!-- ====== MOST ACTIVE ====== -->
    <section class="grid gap-6">
      <div>
        <h2 class="text-3xl font-bold tracking-tight">Most Active</h2>
        <p class="mt-1 text-sm text-base-content/40">Most volume · 24h</p>
      </div>

      {#if primaryTrending}
        <div class="grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] border-y border-base-300">
          <a class="grid gap-4 p-5 pr-6 md:border-r md:border-base-300 transition-colors duration-150 hover:bg-base-200" href={marketUrl(primaryTrending.slug)}>
            <span class="text-xs text-base-content/40 uppercase tracking-wide font-semibold text-success">#1 by volume</span>
            <h3 class="max-w-[14ch] text-3xl font-bold leading-tight">{primaryTrending.title}</h3>

            <div class="flex items-baseline gap-3">
              <span class="text-success font-mono text-5xl font-bold tracking-tight">{centsForMarket(primaryTrending.id)}</span>
              <span class="badge badge-success badge-outline">{probabilityForMarket(primaryTrending.id) >= 0.5 ? 'LONG' : 'SHORT'}</span>
            </div>

            <p class="max-w-prose text-base-content/60 leading-relaxed">{truncateText(sanitizeMarketCopy(primaryTrending.description || primaryTrending.body), 180)}</p>

            <div class="flex flex-wrap gap-5 text-sm text-base-content/40">
              <span>{formatProductAmount(tradeSummaries.get(primaryTrending.id)?.grossVolume ?? 0, 'usd')} vol</span>
              <span>{tradeSummaries.get(primaryTrending.id)?.tradeCount ?? 0} trades</span>
              <span>{discussionCounts.get(primaryTrending.id) ?? 0} posts</span>
            </div>
          </a>

          <div class="grid content-start">
            <div class="hidden sm:grid grid-cols-[minmax(0,1.7fr)_0.55fr_0.6fr_0.55fr_0.55fr] gap-4 items-center pl-6 py-4 text-xs text-base-content/40 uppercase tracking-wide font-semibold">
              <span>Market</span>
              <span>Price</span>
              <span>Vol</span>
              <span>Trades</span>
              <span>Threads</span>
            </div>

            {#if rankedTrending.length > 0}
              {#each rankedTrending as market, index (market.id)}
                <a class="hidden sm:grid grid-cols-[minmax(0,1.7fr)_0.55fr_0.6fr_0.55fr_0.55fr] gap-4 items-center pl-6 py-3 border-t border-base-300 transition-colors duration-150 hover:bg-base-300/50" href={marketUrl(market.slug)}>
                  <div class="min-w-0 flex items-start gap-4">
                    <span class="font-mono text-sm text-base-content/40 leading-relaxed">{String(index + 2).padStart(2, '0')}</span>
                    <div class="min-w-0 grid">
                      <span class="truncate text-white font-semibold">{market.title}</span>
                      <span class="text-sm text-base-content/40">{authorLabel(market.pubkey)}</span>
                    </div>
                  </div>
                  <span class="font-mono text-sm">{centsForMarket(market.id)}</span>
                  <span class="font-mono text-sm">{formatProductAmount(tradeSummaries.get(market.id)?.grossVolume ?? 0, 'usd')}</span>
                  <span class="font-mono text-sm">{tradeSummaries.get(market.id)?.tradeCount ?? 0}</span>
                  <span class="font-mono text-sm">{discussionCounts.get(market.id) ?? 0}</span>
                </a>
              {/each}
            {:else}
              <div class="py-4 text-sm text-base-content/40">No active markets yet. <a class="link link-primary" href="/builder">Create the first one</a></div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="py-4 text-sm text-base-content/40">No markets yet. <a class="link link-primary" href="/builder">Publish the first market from the builder</a></div>
      {/if}
    </section>

    <div class="grid gap-10 md:grid-cols-2">
      <!-- ====== UNDER THE RADAR ====== -->
      <section class="grid gap-6 pt-12">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">Under the radar</h2>
          <p class="mt-1 text-sm text-base-content/40">Less traffic. More opportunity — if you're right.</p>
        </div>

        <div class="overflow-x-auto">
          <table class="table table-sm w-full">
            <thead>
              <tr class="text-xs text-base-content/40 uppercase tracking-wide border-base-300">
                <th class="font-semibold">Market</th>
                <th class="font-semibold text-right">Price</th>
                <th class="font-semibold text-right">Vol</th>
                <th class="font-semibold text-right">Posts</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-base-300">
              {#if lowVolumeMarkets.length > 0}
                {#each lowVolumeMarkets as market (market.id)}
                  <tr class="transition-colors duration-150 hover:bg-base-300/50 hover">
                    <td>
                      <a class="block hover:text-white" href={marketUrl(market.slug)}>
                        <span class="font-semibold text-white">{market.title}</span>
                        <span class="block text-xs text-base-content/40 mt-0.5 truncate max-w-sm">{truncateText(sanitizeMarketCopy(market.description || market.body), 80)}</span>
                      </a>
                    </td>
                    <td class="font-mono text-right">{centsForMarket(market.id)}</td>
                    <td class="font-mono text-right">{formatProductAmount(tradeSummaries.get(market.id)?.grossVolume ?? 0, 'usd')}</td>
                    <td class="font-mono text-right">{discussionCounts.get(market.id) ?? 0}</td>
                  </tr>
                {/each}
              {:else}
                <tr>
                  <td colspan="4" class="text-sm text-base-content/40">No markets in this category yet. <a class="link link-primary" href="/builder">Create the first one</a></td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      </section>

      <!-- ====== MOST CONTESTED ====== -->
      <section class="grid gap-6 pt-12">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">Most Contested</h2>
          <p class="mt-1 text-sm text-base-content/40">The crowd is split. Someone's going to be wrong.</p>
        </div>

        {#if disputedMarkets.length > 0}
          {@const topDisputed = disputedMarkets[0]}
          {@const restDisputed = disputedMarkets.slice(1)}

          <div class="grid gap-4">
            <a class="block border-y border-base-300 py-5 transition-colors duration-150 hover:bg-base-300/50" href={marketUrl(topDisputed.slug)}>
              <h3 class="text-lg font-bold">{topDisputed.title}</h3>
              <div class="mt-2 flex items-baseline gap-3">
                <span class="text-success font-mono text-4xl font-bold tracking-tight">{centsForMarket(topDisputed.id)}</span>
                <span class="text-sm text-base-content/40">Spread {spreadForMarket(topDisputed.id)}</span>
                <span class="badge badge-success badge-outline badge-sm">{probabilityForMarket(topDisputed.id) >= 0.5 ? 'LONG' : 'SHORT'}</span>
              </div>
              <div class="mt-2 flex gap-4 text-sm text-base-content/40">
                <span>{tradeSummaries.get(topDisputed.id)?.tradeCount ?? 0} trades</span>
                <span>{discussionCounts.get(topDisputed.id) ?? 0} posts</span>
              </div>
            </a>

            <div class="divide-y divide-base-300">
              {#each restDisputed as market, index (market.id)}
                <a class="flex items-center justify-between gap-4 py-3 transition-colors duration-150 hover:bg-base-300/50" href={marketUrl(market.slug)}>
                  <div class="flex items-center gap-3 min-w-0">
                    <span class="font-mono text-sm text-base-content/40">{String(index + 2).padStart(2, '0')}</span>
                    <span class="font-semibold truncate">{market.title}</span>
                  </div>
                  <div class="flex items-center gap-3 shrink-0">
                    <span class="font-mono text-sm">{centsForMarket(market.id)}</span>
                    <span class="text-xs text-base-content/40">{spreadForMarket(market.id)}</span>
                  </div>
                </a>
              {/each}
            </div>
          </div>
        {:else}
          <div class="py-4 text-sm text-base-content/40">No disputed markets yet. <a class="link link-primary" href="/builder">Create the first one</a></div>
        {/if}
      </section>
    </div>

    <div class="grid gap-10 md:grid-cols-2">
      <!-- ====== NEW THIS WEEK ====== -->
      <section class="grid gap-6 pt-12">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">New This Week</h2>
          <p class="mt-1 text-sm text-base-content/40">Recently created</p>
        </div>

        <div class="divide-y divide-base-300 border-t border-base-300">
          {#if newThisWeek.length > 0}
            {#each newThisWeek as market, index (market.id)}
              <a class="flex items-baseline gap-3 py-3 transition-colors duration-150 hover:bg-base-300/50" href={marketUrl(market.slug)}>
                <span class="font-mono text-sm text-base-content/40 shrink-0">{String(index + 1).padStart(2, '0')}</span>
                <span class="font-semibold truncate">{market.title}</span>
                <span class="text-xs text-base-content/40 shrink-0 ml-auto whitespace-nowrap">by {authorLabel(market.pubkey)} · {formatRelativeTime(market.createdAt)}</span>
              </a>
            {/each}
          {:else}
            <div class="py-4 text-sm text-base-content/40">No new markets this week. <a class="link link-primary" href="/builder">Create the first one</a></div>
          {/if}
        </div>
      </section>

      <!-- ====== LIVE DEBATE ====== -->
      <section class="grid gap-6 pt-12">
        <div>
          <h2 class="text-3xl font-bold tracking-tight">Live Debate</h2>
          <p class="mt-1 text-sm text-base-content/40">The argument, in real time.</p>
        </div>

        <div class="divide-y divide-base-300 border-t border-base-300">
          {#if latestDiscussions.length > 0}
            {#each latestDiscussions as entry (entry.discussion.id)}
              <a class="block py-3 transition-colors duration-150 hover:bg-base-300/50" href={marketDiscussionUrl(entry.market.slug)}>
                <p class="text-sm text-base-content/70 leading-relaxed">{truncateText(entry.discussion.content, 120)}</p>
                <div class="mt-1 flex items-center gap-2 text-xs text-base-content/40">
                  <span class="text-base-content/60">{authorLabel(entry.discussion.pubkey)}</span>
                  <span>in</span>
                  <span class="text-base-content/60 truncate">{entry.market.title}</span>
                  <span class="ml-auto shrink-0">{formatRelativeTime(entry.discussion.createdAt)}</span>
                </div>
              </a>
            {/each}
          {:else}
            <div class="py-4 text-sm text-base-content/40">No discussion yet. <a class="link link-primary" href="/builder">Create a market to start the debate</a></div>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>

<!-- ============================================================ -->
<!-- BOTTOM CTA                                                    -->
<!-- ============================================================ -->
<section class="full-bleed bg-base-200 py-16 mt-16">
  <div class="shell text-center">
    <h2 class="text-3xl font-bold tracking-tight">Ready to put money behind your beliefs?</h2>
    <p class="mt-2 text-sm text-base-content/40 max-w-md mx-auto">
      Create a market, take a position, and defend it in public. Every trade is on the record.
    </p>
    <div class="mt-8 flex items-center justify-center gap-4 flex-wrap">
      <a class="btn btn-primary btn-lg" href="/join">Start Trading</a>
      <a class="btn btn-outline" href="/builder">Create a Market</a>
    </div>
  </div>
</section>

<style>
  /* ── Full-bleed breakout ────────────────────────────────────── */
  .full-bleed {
    width: 100vw;
    position: relative;
    left: 50%;
    right: 50%;
    margin-left: -50vw;
    margin-right: -50vw;
  }

  /* ── Live ticker strip ─────────────────────────────────────── */
  .marquee-strip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
  }

  .marquee-label {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-base-content);
    opacity: 0.4;
  }

  .marquee-dot {
    width: 0.45rem;
    height: 0.45rem;
    background: var(--color-success);
    border-radius: 999px;
    animation: pulse 1.9s infinite;
  }

  .marquee-shell {
    min-width: 0;
    overflow: hidden;
  }

  .marquee-belt {
    display: flex;
    align-items: center;
    gap: 1.8rem;
    width: max-content;
    animation: ticker 42s linear infinite;
  }

  .marquee-item {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    font-size: 0.875rem;
    white-space: nowrap;
    color: var(--color-base-content);
    opacity: 0.6;
  }

  /* ── Keyframes ─────────────────────────────────────────────── */
  @keyframes ticker {
    from { transform: translateX(0); }
    to { transform: translateX(-50%); }
  }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-success) 50%, transparent); }
    50% { box-shadow: 0 0 0 0.45rem transparent; }
  }
</style>
