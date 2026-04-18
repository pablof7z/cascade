<script lang="ts">
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { getCascadeEdition } from '$lib/cascade/config';
  import { formatProductAmount } from '$lib/cascade/format';
  import {
    formatProbability,
    formatRelativeTime,
    marketUrl,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    type DiscussionRecord,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName } from '$lib/ndk/format';
  import type { PageProps } from './$types';

  type Filter = 'All' | 'New Markets' | 'Trades' | 'Discussion';

  let { data }: PageProps = $props();
  let activeFilter = $state<Filter>('All');
  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));

  const filters: Filter[] = ['All', 'New Markets', 'Trades', 'Discussion'];
  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);
  const markets = $derived(
    (data.markets ?? [])
      .map((event) => parseMarketEvent(event, selectedEdition))
      .filter((market): market is MarketRecord => Boolean(market))
  );
  const discussions = $derived(
    (data.discussions ?? [])
      .map((event) => parseDiscussionEvent(event, selectedEdition))
      .filter((discussion): discussion is DiscussionRecord => Boolean(discussion))
  );
  const trades = $derived(
    (data.trades ?? [])
      .map((event) => parseTradeEvent(event, selectedEdition))
      .filter((trade): trade is TradeRecord => Boolean(trade))
  );
  const marketById = $derived(new Map(markets.map((market) => [market.id, market])));

  const marketEntries = $derived.by(() => {
    return markets.map((market) => ({
      id: market.id,
      kind: 'market' as const,
      createdAt: market.createdAt,
      label: 'Opened',
      title: sanitizeMarketCopy(market.title),
      subtitle: displayName(profiles[market.pubkey], 'Cascade user'),
      href: marketUrl(market.slug)
    }));
  });

  const tradeEntries = $derived.by(() => {
    return trades.map((trade) => {
      const market = marketById.get(trade.marketId);
      return {
        id: trade.id,
        kind: 'trade' as const,
        createdAt: trade.createdAt,
        label: trade.type === 'buy' ? 'Bought' : 'Sold',
        title: market ? sanitizeMarketCopy(market.title) : trade.marketId,
        subtitle: `${trade.direction === 'long' ? 'LONG' : 'SHORT'} · ${formatProductAmount(trade.amount, 'usd')} · ${formatProbability(trade.probability)}`,
        href: market ? marketUrl(market.slug) : '/activity'
      };
    });
  });

  const discussionEntries = $derived.by(() => {
    return discussions.map((discussion) => {
      const market = marketById.get(discussion.marketId);
      return {
        id: discussion.id,
        kind: 'discussion' as const,
        createdAt: discussion.createdAt,
        label: 'Discussion',
        title: discussion.subject || (market ? sanitizeMarketCopy(market.title) : discussion.marketId),
        subtitle: `${market ? sanitizeMarketCopy(market.title) : discussion.marketId} · ${displayName(profiles[discussion.pubkey], 'Cascade user')}`,
        href: market ? `${marketUrl(market.slug)}/discussion` : '/activity'
      };
    });
  });

  const visibleEntries = $derived.by(() => {
    switch (activeFilter) {
      case 'New Markets':
        return marketEntries;
      case 'Trades':
        return tradeEntries;
      case 'Discussion':
        return discussionEntries;
      default:
        return [...marketEntries, ...tradeEntries, ...discussionEntries].sort((left, right) => right.createdAt - left.createdAt);
    }
  });

  const totalVolume = $derived(trades.reduce((sum, trade) => sum + trade.amount, 0));
</script>

<div class="grid gap-4 max-w-[40rem] pt-4">
  <div class="eyebrow">Activity</div>
  <h1 class="text-[clamp(2.4rem,4vw,4rem)] tracking-[-0.05em] leading-none">What's moving</h1>
  <p class="text-base-content/70 leading-[1.75]">New markets, trades, and debate — live.</p>
</div>

<div class="grid grid-cols-2 gap-4 pt-8 sm:grid-cols-4">
  {#each [
    { label: 'Markets', value: String(markets.length) },
    { label: 'Trades', value: String(trades.length) },
    { label: 'Discussion', value: String(discussions.length) },
    { label: 'Volume', value: formatProductAmount(totalVolume, 'usd') },
  ] as stat}
    <div class="grid gap-1 py-4 border-t border-base-300">
      <span class="eyebrow">{stat.label}</span>
      <strong class="text-white font-mono">{stat.value}</strong>
    </div>
  {/each}
</div>

<nav class="flex gap-4 pt-6 border-b border-base-300 overflow-x-auto" aria-label="Activity filters">
  {#each filters as filter}
    <button
      class="mb-[-1px] py-[0.9rem] border-b-2 border-transparent bg-transparent text-sm font-medium cursor-pointer transition-colors {activeFilter === filter ? 'border-white text-white' : 'text-base-content/50 hover:text-base-content/80'}"
      type="button"
      onclick={() => (activeFilter = filter)}
    >
      {filter}
    </button>
  {/each}
</nav>

<div class="border-t border-base-300 mt-6">
  {#if visibleEntries.length > 0}
    {#each visibleEntries as entry (entry.id)}
      <a class="flex items-start justify-between gap-4 py-4 border-b border-base-300 hover:text-white" href={entry.href}>
        <div class="grid gap-1 min-w-0">
          <span class="eyebrow">{entry.label}</span>
          <strong class="text-white text-base">{entry.title}</strong>
          <p class="text-base-content/50 text-sm leading-[1.6]">{entry.subtitle}</p>
        </div>
        <span class="text-base-content/50 font-mono text-sm shrink-0">{formatRelativeTime(entry.createdAt)}</span>
      </a>
    {/each}
  {:else}
    <div class="py-4 text-base-content/70">No activity found.</div>
  {/if}
</div>
