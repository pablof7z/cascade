<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { formatProductAmount } from '$lib/cascade/format';
  import { getCascadeEdition } from '$lib/cascade/config';
  import {
    buildTradeSummary,
    formatRelativeTime,
    getCascadeEventKinds,
    marketUrl,
    parseMarketEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    truncateText,
    type MarketRecord,
    type MarketTradeSummary,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName } from '$lib/ndk/format';
  import { filterLiveHomepageMarkets } from '../homepage-market-search';
  import type { PageProps } from './$types';

  const CATEGORY_NAMES = ['Geopolitics', 'Macro', 'AI', 'Crypto', 'Tech', 'Sports', 'Culture', 'Policy', 'Nostr'];

  let { data }: PageProps = $props();
  let selectedCategory = $state('All');

  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const isPracticeEdition = $derived(selectedEdition === 'signet');
  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);

  const marketFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.market], limit: 120 }] };
  });

  const tradeFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.trade], limit: 480 }] };
  });

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

  const dayAgo = $derived(Math.floor(Date.now() / 1000) - 24 * 60 * 60);

  const movedTodayCount = $derived(
    markets.filter((market) => (tradeSummaries.get(market.id)?.latestTradeAt ?? 0) >= dayAgo).length
  );

  const todayVolume = $derived(
    trades
      .filter((trade) => trade.createdAt >= dayAgo)
      .reduce((total, trade) => total + trade.amount, 0)
  );

  const categoryOptions = $derived.by(() => {
    return [
      { name: 'All', count: markets.length },
      ...CATEGORY_NAMES.map((name) => ({
        name,
        count: markets.filter((market) => marketMatchesCategory(market, name)).length
      }))
    ];
  });

  const filteredMarkets = $derived.by(() => {
    if (selectedCategory === 'All') return markets;
    return markets.filter((market) => marketMatchesCategory(market, selectedCategory));
  });

  const railSections = $derived.by(() => {
    const sections = [
      {
        title: 'Most active',
        detail: 'by total public volume',
        markets: [...markets].sort(compareByVolumeThenRecency).slice(0, 6)
      },
      {
        title: 'New',
        detail: 'recently published',
        markets: [...markets].sort((left, right) => right.createdAt - left.createdAt).slice(0, 6)
      },
      {
        title: 'Contested',
        detail: 'closest to 50¢',
        markets: [...markets].sort(compareByContestedThenVolume).slice(0, 6)
      },
      {
        title: 'Moving today',
        detail: 'freshest trading activity',
        markets: [...markets].sort(compareByLatestTradeThenVolume).slice(0, 6)
      },
      {
        title: 'Under the radar',
        detail: 'lower volume claims',
        markets: [...markets].sort(compareByLowVolumeThenRecency).slice(0, 6)
      }
    ];

    return sections.filter((section) => section.markets.length > 0);
  });

  const summaryLine = $derived(
    `${markets.length} live · ${movedTodayCount} moved today · ${formatProductAmount(todayVolume, 'usd')} in 24h volume`
  );

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

  function marketSummary(marketId: string): MarketTradeSummary | undefined {
    return tradeSummaries.get(marketId);
  }

  function latestPricePpm(market: MarketRecord): number {
    return marketSummary(market.id)?.latestPricePpm ?? market.latestPricePpm ?? 500_000;
  }

  function centsForMarket(market: MarketRecord): string {
    return `${Math.round(latestPricePpm(market) / 10_000)}¢`;
  }

  function directionForMarket(market: MarketRecord): 'LONG' | 'SHORT' {
    return latestPricePpm(market) >= 500_000 ? 'LONG' : 'SHORT';
  }

  function volumeForMarket(market: MarketRecord): string {
    return formatProductAmount(marketSummary(market.id)?.grossVolume ?? 0, 'usd');
  }

  function tradeCountForMarket(market: MarketRecord): number {
    return marketSummary(market.id)?.tradeCount ?? 0;
  }

  function authorLabel(pubkey: string): string {
    return displayName(profiles[pubkey], 'Cascade user');
  }

  function categoryLabel(market: MarketRecord): string {
    return market.categories[0] || market.topics[0] || 'General';
  }

  function searchableCategories(market: MarketRecord): string[] {
    return [...market.categories, ...market.topics].map((value) => value.toLocaleLowerCase());
  }

  function marketMatchesCategory(market: MarketRecord, category: string): boolean {
    const normalized = category.toLocaleLowerCase();
    return searchableCategories(market).some((value) => value === normalized || value.includes(normalized));
  }

  function compareByVolumeThenRecency(left: MarketRecord, right: MarketRecord): number {
    const leftVolume = marketSummary(left.id)?.grossVolume ?? 0;
    const rightVolume = marketSummary(right.id)?.grossVolume ?? 0;
    if (rightVolume !== leftVolume) return rightVolume - leftVolume;
    return right.createdAt - left.createdAt;
  }

  function compareByContestedThenVolume(left: MarketRecord, right: MarketRecord): number {
    const leftDistance = Math.abs(latestPricePpm(left) - 500_000);
    const rightDistance = Math.abs(latestPricePpm(right) - 500_000);
    if (leftDistance !== rightDistance) return leftDistance - rightDistance;
    return compareByVolumeThenRecency(left, right);
  }

  function compareByLatestTradeThenVolume(left: MarketRecord, right: MarketRecord): number {
    const leftLatest = marketSummary(left.id)?.latestTradeAt ?? 0;
    const rightLatest = marketSummary(right.id)?.latestTradeAt ?? 0;
    if (rightLatest !== leftLatest) return rightLatest - leftLatest;
    return compareByVolumeThenRecency(left, right);
  }

  function compareByLowVolumeThenRecency(left: MarketRecord, right: MarketRecord): number {
    const leftVolume = marketSummary(left.id)?.grossVolume ?? 0;
    const rightVolume = marketSummary(right.id)?.grossVolume ?? 0;
    if (leftVolume !== rightVolume) return leftVolume - rightVolume;
    return right.createdAt - left.createdAt;
  }
</script>

<section class="grid gap-8">
  <header class="grid gap-2 border-b border-base-300 pb-6">
    <h1 class="font-tight text-3xl font-bold text-base-content">Markets</h1>
    <p class="max-w-xl text-base text-base-content/65">
      Every live claim, across every category. Browse without following anyone.
    </p>
    <p class="font-mono text-xs text-base-content/45">{summaryLine}</p>
  </header>

  {#if markets.length === 0}
    <section class="grid gap-3 border-b border-base-300 py-10">
      <p class="font-tight text-2xl font-semibold">No live claims yet</p>
      <p class="max-w-lg text-sm leading-6 text-base-content/55">
        The first publicly traded claim will appear here. Use the persistent rail CTA to publish one.
      </p>
    </section>
  {:else}
    {#each railSections as section}
      <section class="grid gap-3" aria-label={section.title}>
        <header class="flex items-baseline justify-between gap-4">
          <h2 class="font-tight text-lg font-bold text-base-content">
            {section.title}
            <span class="ml-2 font-mono text-[0.68rem] font-normal text-base-content/40">{section.detail}</span>
          </h2>
          <a class="text-sm text-base-content/45 hover:text-base-content" href="#all-markets">All markets</a>
        </header>

        <div class="flex snap-x gap-4 overflow-x-auto pb-2">
          {#each section.markets as market}
            <a
              class="group grid w-[196px] shrink-0 snap-start overflow-hidden rounded-lg border border-base-300 bg-base-100 hover:border-primary"
              href={marketUrl(market.slug)}
            >
              <div class="grid aspect-[4/5] place-items-end bg-base-200 p-3">
                <span class="font-mono text-[0.64rem] uppercase text-base-content/45">{categoryLabel(market)}</span>
              </div>
              <div class="grid gap-3 p-3">
                <div class="grid gap-1">
                  <p class="font-mono text-[0.64rem] text-base-content/40">{formatRelativeTime(market.createdAt)}</p>
                  <h3 class="line-clamp-3 font-serif text-base font-medium leading-snug text-base-content group-hover:text-primary">
                    {market.title}
                  </h3>
                  <p class="truncate font-mono text-[0.66rem] text-base-content/45">{authorLabel(market.pubkey)}</p>
                </div>
                <div class="flex items-center justify-between border-t border-base-300 pt-3 font-mono text-[0.68rem]">
                  <span class={directionForMarket(market) === 'LONG' ? 'text-success' : 'text-error'}>
                    {centsForMarket(market)}
                  </span>
                  <span class="text-base-content/40">{volumeForMarket(market)}</span>
                </div>
              </div>
            </a>
          {/each}
        </div>
      </section>
    {/each}

    <section id="all-markets" class="grid gap-4 pt-2">
      <header class="grid gap-4 border-b border-base-300 pb-3">
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="font-tight text-xl font-bold">All markets</h2>
          <span class="font-mono text-xs text-base-content/40">{filteredMarkets.length} shown</span>
        </div>

        <nav class="flex flex-wrap gap-x-5 gap-y-2" aria-label="Market categories">
          {#each categoryOptions as option}
            <button
              type="button"
              class={selectedCategory === option.name
                ? 'border-b-2 border-primary pb-2 text-sm font-semibold text-primary'
                : 'border-b-2 border-transparent pb-2 text-sm text-base-content/45 hover:text-base-content'}
              aria-pressed={selectedCategory === option.name}
              onclick={() => {
                selectedCategory = option.name;
              }}
            >
              {option.name}
              <span class="ml-1 font-mono text-[0.68rem] text-base-content/35">{option.count}</span>
            </button>
          {/each}
        </nav>
      </header>

      {#if filteredMarkets.length === 0}
        <div class="grid gap-2 py-8">
          <p class="font-tight text-xl font-semibold">No live claims in {selectedCategory} yet</p>
          <p class="max-w-lg text-sm leading-6 text-base-content/55">
            Use the persistent rail CTA when you are ready to publish the first one.
          </p>
        </div>
      {:else}
        <div class="divide-y divide-base-300">
          {#each filteredMarkets as market}
            <a class="group grid gap-2 py-5" href={marketUrl(market.slug)}>
              <div class="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[0.68rem] uppercase text-base-content/40">
                <span>{categoryLabel(market)}</span>
                <span>{formatRelativeTime(market.createdAt)}</span>
                <span>{tradeCountForMarket(market)} trades</span>
              </div>

              <h3 class="font-serif text-2xl font-medium leading-tight text-base-content group-hover:text-primary">
                {market.title}
              </h3>

              <p class="max-w-2xl text-sm leading-6 text-base-content/55">
                {truncateText(sanitizeMarketCopy(market.description || market.body), 180)}
              </p>

              <div class="flex flex-wrap items-center gap-4 font-mono text-xs">
                <span class={directionForMarket(market) === 'LONG' ? 'text-success' : 'text-error'}>
                  {directionForMarket(market)} {centsForMarket(market)}
                </span>
                <span class="text-base-content/45">{volumeForMarket(market)} volume</span>
                <span class="text-base-content/45">{authorLabel(market.pubkey)}</span>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</section>
