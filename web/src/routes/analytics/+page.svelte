<script lang="ts">
  import { getCascadeEdition } from '$lib/cascade/config';
  import { formatProductAmount } from '$lib/cascade/format';
  import {
    buildTradeSummary,
    formatProbability,
    formatRelativeTime,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));

  const markets = $derived(
    (data.markets ?? [])
      .map((event) => parseMarketEvent(event, selectedEdition))
      .filter((market): market is MarketRecord => Boolean(market))
  );
  const discussions = $derived(
    (data.discussions ?? [])
      .map((event) => parseDiscussionEvent(event, selectedEdition))
      .filter(Boolean)
  );
  const trades = $derived(
    (data.trades ?? [])
      .map((event) => parseTradeEvent(event, selectedEdition))
      .filter((trade): trade is TradeRecord => Boolean(trade))
  );

  const tradeBuckets = $derived.by(() => {
    const buckets = new Map<string, TradeRecord[]>();
    for (const trade of trades) {
      const bucket = buckets.get(trade.marketId);
      if (bucket) bucket.push(trade);
      else buckets.set(trade.marketId, [trade]);
    }
    return buckets;
  });

  const marketRows = $derived.by(() => {
    return markets
      .map((market) => ({
        market,
        summary: buildTradeSummary(tradeBuckets.get(market.id) ?? []),
        discussionCount: discussions.filter((discussion) => discussion?.marketId === market.id).length
      }))
      .sort((left, right) => right.summary.grossVolume - left.summary.grossVolume || right.discussionCount - left.discussionCount)
      .slice(0, 12);
  });

  const categoryRows = $derived.by(() => {
    const counts = new Map<string, { markets: number; trades: number }>();
    for (const market of markets) {
      const key = market.categories[0] || 'Uncategorized';
      const current = counts.get(key) ?? { markets: 0, trades: 0 };
      current.markets += 1;
      current.trades += tradeBuckets.get(market.id)?.length ?? 0;
      counts.set(key, current);
    }
    return [...counts.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((left, right) => right.markets - left.markets || right.trades - left.trades)
      .slice(0, 8);
  });

  const activityRows = $derived.by(() => {
    return [
      ...markets.slice(0, 8).map((market) => ({
        id: market.id,
        createdAt: market.createdAt,
        kind: 'Market',
        detail: sanitizeMarketCopy(market.title)
      })),
      ...trades.slice(0, 8).map((trade) => ({
        id: trade.id,
        createdAt: trade.createdAt,
        kind: 'Trade',
        detail: `${trade.direction === 'long' ? 'LONG' : 'SHORT'} · ${formatProductAmount(trade.amount, 'usd')}`
      })),
      ...discussions.slice(0, 8).map((discussion) => ({
        id: discussion?.id ?? '',
        createdAt: discussion?.createdAt ?? 0,
        kind: 'Discussion',
        detail: discussion?.subject || 'Discussion update'
      }))
    ]
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, 12);
  });

  const visibleVolume = $derived(trades.reduce((sum, trade) => sum + trade.amount, 0));
  const activeMarketCount = $derived(marketRows.filter((row) => row.summary.tradeCount > 0).length);
  const uniqueAuthors = $derived(new Set([...markets.map((market) => market.pubkey), ...discussions.map((discussion) => discussion?.pubkey)]).size);
</script>

<div class="grid gap-4 max-w-[36rem] pt-4">
  <div class="eyebrow">Analytics</div>
  <h1 class="text-[clamp(2.4rem,4vw,4rem)] tracking-[-0.05em] leading-none">Market activity</h1>
  <p class="text-base-content/70 leading-[1.75]">Trades, markets, and debate — everything happening across Cascade.</p>
</div>

<div class="grid grid-cols-2 gap-4 pt-8 sm:grid-cols-3 lg:grid-cols-6">
  {#each [
    { label: 'Markets', value: String(markets.length) },
    { label: 'Trades', value: String(trades.length) },
    { label: 'Discussion Opens', value: String(discussions.length) },
    { label: 'Volume', value: formatProductAmount(visibleVolume, 'usd') },
    { label: 'Active Markets', value: String(activeMarketCount) },
    { label: 'Active users', value: String(uniqueAuthors) },
  ] as stat}
    <div class="grid gap-1 py-4 border-t border-base-300">
      <span class="eyebrow">{stat.label}</span>
      <strong class="text-white font-mono">{stat.value}</strong>
    </div>
  {/each}
</div>

<div class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
  <article class="grid gap-4">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="text-[1.18rem] tracking-[-0.03em]">Most active markets</h2>
      <span class="text-base-content/50 text-sm">Volume</span>
    </div>

    <div class="border-t border-base-300">
      <div class="hidden sm:grid grid-cols-[minmax(0,2fr)_0.75fr_0.8fr_0.7fr] items-center gap-4 py-4 eyebrow">
        <div>Market</div>
        <div>Volume</div>
        <div>Price</div>
        <div>Discussion</div>
      </div>

      {#if marketRows.length > 0}
        {#each marketRows as row (row.market.id)}
          <a class="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_0.75fr_0.8fr_0.7fr] items-center gap-4 border-t border-base-300 py-4 hover:bg-base-300/30" href="/market/{row.market.slug}">
            <div>
              <strong class="text-white">{sanitizeMarketCopy(row.market.title)}</strong>
              <p class="mt-1 text-base-content/50 text-sm leading-[1.6]">{formatRelativeTime(row.market.createdAt)}</p>
            </div>
            <div class="text-white font-mono text-sm">{formatProductAmount(row.summary.grossVolume, 'usd')}</div>
            <div class="text-white font-mono text-sm">{formatProbability(row.summary.latestPricePpm ? row.summary.latestPricePpm / 1_000_000 : null)}</div>
            <div class="text-white font-mono text-sm">{row.discussionCount}</div>
          </a>
        {/each}
      {:else}
        <div class="py-4 text-base-content/70">No market activity yet.</div>
      {/if}
    </div>
  </article>

  <article class="grid gap-4">
    <div class="flex items-baseline justify-between gap-4">
      <h2 class="text-[1.18rem] tracking-[-0.03em]">Category distribution</h2>
      <span class="text-base-content/50 text-sm">Market count</span>
    </div>

    <div class="divide-y divide-base-300 border-t border-base-300">
      {#if categoryRows.length > 0}
        {#each categoryRows as row}
          <div class="py-4">
            <strong class="text-white">{row.name}</strong>
            <p class="mt-1 text-base-content/50 text-sm leading-[1.6]">{row.markets} markets · {row.trades} trades</p>
          </div>
        {/each}
      {:else}
        <div class="py-4 text-base-content/70">No categories yet.</div>
      {/if}
    </div>
  </article>
</div>

<article class="grid gap-4 pt-8">
  <div class="flex items-baseline justify-between gap-4">
    <h2 class="text-[1.18rem] tracking-[-0.03em]">Recent activity</h2>
    <span class="text-base-content/50 text-sm">Generated now</span>
  </div>

  <div class="divide-y divide-base-300 border-t border-base-300">
    {#if activityRows.length > 0}
      {#each activityRows as row (row.id)}
        <div class="flex items-start justify-between gap-4 py-4">
          <div>
            <span class="eyebrow">{row.kind}</span>
            <strong class="text-white block mt-1">{row.detail}</strong>
          </div>
          <span class="text-white font-mono text-sm shrink-0">{formatRelativeTime(row.createdAt)}</span>
        </div>
      {/each}
    {:else}
      <div class="py-4 text-base-content/70">No network events yet.</div>
    {/if}
  </div>
</article>
