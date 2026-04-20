<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { getCascadeEdition } from '$lib/cascade/config';
  import {
    CASCADE_BOOKMARK_KIND,
    getCascadeEventKinds,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    type DiscussionRecord,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName, profileHref as buildProfileHref } from '$lib/ndk/format';
  import type { PageProps } from './$types';

  type LeaderboardTab = 'Top Creators' | 'Top Traders' | 'Most Bookmarked';

  let { data }: PageProps = $props();
  let activeTab = $state<LeaderboardTab>('Top Creators');
  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));

  const tabs: LeaderboardTab[] = ['Top Creators', 'Top Traders', 'Most Bookmarked'];
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

  const trades = $derived.by(() => {
    return (data.trades ?? [])
      .map((event) => parseTradeEvent(event, selectedEdition))
      .filter((trade): trade is TradeRecord => Boolean(trade))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const creatorRows = $derived.by(() => {
    return rankPubkeysByCount(markets)
      .map((row) => ({
        pubkey: row.pubkey,
        marketCount: row.count
      }))
      .sort((left, right) => right.marketCount - left.marketCount)
      .slice(0, 20);
  });

  const traderRows = $derived.by(() => {
    return rankPubkeysByCount(trades)
      .map((row) => ({
        pubkey: row.pubkey,
        tradeCount: row.count
      }))
      .sort((left, right) => right.tradeCount - left.tradeCount)
      .slice(0, 20);
  });

  const networkBookmarks = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [CASCADE_BOOKMARK_KIND], limit: 200 }] };
  });

  const bookmarkedCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const event of networkBookmarks.events) {
      for (const tag of event.tags) {
        if (tag[0] !== 'e' || !tag[1]) continue;
        counts.set(tag[1], (counts.get(tag[1]) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 12);
  });

  const bookmarkedMarkets = ndk.$subscribe(() => {
    if (!browser || bookmarkedCounts.length === 0) return undefined;
    return { filters: [{ kinds: [eventKinds.market], ids: bookmarkedCounts.map(([id]) => id) }] };
  });

  const bookmarkedLookup = $derived.by(() => {
    const lookup = new Map<string, MarketRecord>();
    for (const event of bookmarkedMarkets.events) {
      const market = parseMarketEvent(event.rawEvent(), selectedEdition);
      if (market) lookup.set(market.id, market);
    }
    return lookup;
  });

  const bookmarkedRows = $derived.by(() => {
    return bookmarkedCounts
      .map(([id, count], index) => {
        const market = bookmarkedLookup.get(id);
        if (!market) return null;
        const discussionCount = discussions.filter((discussion) => discussion.marketId === market.id).length;
        return {
          rank: index + 1,
          market,
          count,
          discussionCount
        };
      })
      .filter(Boolean) as Array<{ rank: number; market: MarketRecord; count: number; discussionCount: number }>;
  });

  function label(pubkey: string): string {
    return displayName(profiles[pubkey], 'Cascade user');
  }

  function profileHref(pubkey: string): string {
    return buildProfileHref(profiles[pubkey], pubkey);
  }

  function rankPubkeysByCount(records: Array<{ pubkey: string }>): Array<{ pubkey: string; count: number }> {
    const counts = new Map<string, number>();

    for (const record of records) {
      counts.set(record.pubkey, (counts.get(record.pubkey) ?? 0) + 1);
    }

    return [...counts.entries()]
      .map(([pubkey, count]) => ({ pubkey, count }))
      .sort((left, right) => right.count - left.count);
  }
</script>

<div class="grid gap-2 border-b border-base-300 pb-6">
  <h1 class="font-serif text-4xl font-semibold leading-none sm:text-5xl">Leaderboard</h1>
  <p class="max-w-2xl text-sm leading-6 text-base-content/65">Top market creators and the most-followed questions on Cascade.</p>
</div>

<nav class="flex gap-4 pt-7 border-b border-base-300 overflow-x-auto" aria-label="Leaderboard tabs">
  {#each tabs as tab}
    <button
      class="mb-[-1px] py-[0.9rem] border-b-2 border-transparent bg-transparent text-sm font-medium cursor-pointer transition-colors {activeTab === tab ? 'border-primary text-base-content' : 'text-base-content/50 hover:text-base-content/80'}"
      type="button"
      onclick={() => (activeTab = tab)}
    >
      {tab}
    </button>
  {/each}
</nav>

{#if activeTab === 'Top Creators'}
  <div class="border-t border-base-300 mt-6">
    {#if creatorRows.length > 0}
      {#each creatorRows as row, index (row.pubkey)}
        <a class="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] gap-4 items-center py-4 border-b border-base-300 hover:text-primary" href={profileHref(row.pubkey)}>
          <span class="font-mono text-sm text-base-content/40">{index + 1}</span>
          <div>
            <strong class="text-base-content text-base">{label(row.pubkey)}</strong>
            <p class="mt-1 text-base-content/50 text-sm">{row.marketCount} market{row.marketCount === 1 ? '' : 's'} created</p>
          </div>
          <div class="grid justify-items-end">
            <strong class="font-mono text-sm text-base-content">{row.marketCount}</strong>
            <span class="text-base-content/40 text-xs uppercase tracking-wide">Markets</span>
          </div>
        </a>
      {/each}
    {:else}
      <div class="py-8 text-base-content/70">No creator data yet.</div>
    {/if}
  </div>
{/if}

{#if activeTab === 'Top Traders'}
  <div class="border-t border-base-300 mt-6">
    {#if traderRows.length > 0}
      {#each traderRows as row, index (row.pubkey)}
        <a class="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] gap-4 items-center py-4 border-b border-base-300 hover:text-primary" href={profileHref(row.pubkey)}>
          <span class="font-mono text-sm text-base-content/40">{index + 1}</span>
          <div>
            <strong class="text-base-content text-base">{label(row.pubkey)}</strong>
            <p class="mt-1 text-base-content/50 text-sm">{row.tradeCount} trade{row.tradeCount === 1 ? '' : 's'} placed</p>
          </div>
          <div class="grid justify-items-end">
            <strong class="font-mono text-sm text-base-content">{row.tradeCount}</strong>
            <span class="text-base-content/40 text-xs uppercase tracking-wide">Trades</span>
          </div>
        </a>
      {/each}
    {:else}
      <div class="py-8 text-base-content/70">No trader data yet.</div>
    {/if}
  </div>
{/if}

{#if activeTab === 'Most Bookmarked'}
  {#if bookmarkedRows.length > 0}
    <div class="border-t border-base-300 mt-6">
      {#each bookmarkedRows as row (row.market.id)}
        <a class="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] gap-4 items-center py-4 border-b border-base-300 hover:text-primary" href="/market/{row.market.slug}">
          <span class="font-mono text-sm text-base-content/40">{row.rank}</span>
          <div>
            <strong class="text-base-content text-base">{row.market.title}</strong>
            <p class="mt-1 text-base-content/50 text-sm">{row.market.description || 'Prediction market'}</p>
          </div>
          <div class="grid justify-items-end">
            <strong class="font-mono text-sm text-base-content">{row.count}</strong>
            <span class="text-base-content/40 text-xs uppercase tracking-wide">Bookmarks</span>
          </div>
          <div class="grid justify-items-end">
            <strong class="font-mono text-sm text-base-content">{row.discussionCount}</strong>
            <span class="text-base-content/40 text-xs uppercase tracking-wide">Posts</span>
          </div>
        </a>
      {/each}
    </div>
  {:else}
    <div class="grid gap-2 py-8 border-t border-base-300 mt-6">
      <strong class="text-base-content">No bookmarked markets yet.</strong>
      <p class="text-base-content/70">Bookmark markets to see them ranked here.</p>
    </div>
  {/if}
{/if}
