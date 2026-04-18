<script lang="ts">
  import { browser } from '$app/environment';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import {
    getCascadeEventKinds,
    parseMarketEvent,
    type MarketRecord
  } from '$lib/ndk/cascade';

  const NETWORK_BOOKMARK_LIMIT = 40;
  const TRENDING_MARKET_LIMIT = 12;

  const currentUser = $derived(ndk.$currentUser);
  const eventKinds = $derived(getCascadeEventKinds());

  const bookmarkLists = ndk.$subscribe(() => {
    if (!browser) return undefined;
    const networkBookmarkFilter = { kinds: [10003], limit: NETWORK_BOOKMARK_LIMIT };
    if (!currentUser) return { filters: [networkBookmarkFilter] };
    return {
      filters: [
        { kinds: [10003], authors: [currentUser.pubkey], limit: 1 },
        networkBookmarkFilter
      ]
    };
  });

  const myBookmarkEvent = $derived.by(() => {
    if (!currentUser) return null;
    return bookmarkLists.events.find((bookmarkEvent) => bookmarkEvent.pubkey === currentUser.pubkey) ?? null;
  });

  const myMarketIds = $derived.by(() => {
    if (!myBookmarkEvent) return [];
    return myBookmarkEvent.tags.filter((tag) => tag[0] === 'e' && tag[1]).map((tag) => tag[1]);
  });

  const trendingMarketIds = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const bookmarkEvent of bookmarkLists.events) {
      if (currentUser && bookmarkEvent.pubkey === currentUser.pubkey) continue;
      for (const tag of bookmarkEvent.tags) {
        if (tag[0] !== 'e' || !tag[1]) continue;
        counts.set(tag[1], (counts.get(tag[1]) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, TRENDING_MARKET_LIMIT);
  });

  const subscribedMarketIds = $derived.by(() => {
    const ids = new Set<string>();
    for (const id of myMarketIds) ids.add(id);
    for (const [id] of trendingMarketIds) ids.add(id);
    return [...ids];
  });

  const bookmarkedMarkets = ndk.$subscribe(() => {
    if (!browser || subscribedMarketIds.length === 0) return undefined;
    return { filters: [{ kinds: [eventKinds.market], ids: subscribedMarketIds }] };
  });

  const marketLookup = $derived.by(() => {
    const lookup = new Map<string, MarketRecord>();
    for (const event of bookmarkedMarkets.events) {
      const market = parseMarketEvent(event.rawEvent());
      if (market) lookup.set(market.id, market);
    }
    return lookup;
  });

  const orderedMyMarkets = $derived(myMarketIds.map((id) => marketLookup.get(id)).filter(Boolean) as MarketRecord[]);

  const orderedTrending = $derived.by(() => {
    return trendingMarketIds
      .map(([id, count]) => ({ market: marketLookup.get(id), count }))
      .filter((entry): entry is { market: MarketRecord; count: number } => Boolean(entry.market));
  });

  async function removeBookmark(marketId: string) {
    if (!currentUser) return;
    const bookmarkEvent = myBookmarkEvent;
    if (!bookmarkEvent) return;
    const updated = new NDKEvent(ndk);
    updated.kind = 10003;
    updated.tags = bookmarkEvent.tags.filter((tag) => !(tag[0] === 'e' && tag[1] === marketId));
    await updated.publish();
  }
</script>

<div class="grid gap-2 pb-6">
  <div class="eyebrow">Bookmarks</div>
  <h1 class="text-[2rem] tracking-[-0.04em]">My Bookmarks</h1>
  <p class="text-base-content/70">Markets you've saved for later.</p>
</div>

<div class="grid gap-8 md:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
  <section class="grid gap-4">
    <div class="flex items-end justify-between gap-4">
      <h2 class="text-[1.1rem] font-semibold">Saved markets</h2>
      <a class="text-base-content/50 text-sm hover:text-white" href="/">Browse Markets</a>
    </div>

    {#if currentUser}
      <div class="divide-y divide-base-300 border-t border-base-300">
        {#if orderedMyMarkets.length > 0}
          {#each orderedMyMarkets as market (market.id)}
            <div class="flex items-start justify-between gap-4 py-4">
              <a class="grid gap-1 min-w-0 hover:text-white" href="/market/{market.slug}">
                <strong class="text-white text-base">{market.title}</strong>
                <p class="text-base-content/70 leading-[1.6]">{market.description || market.body || 'No summary yet.'}</p>
              </a>
              <button class="btn btn-ghost btn-sm shrink-0" onclick={() => removeBookmark(market.id)}>Remove</button>
            </div>
          {/each}
        {:else if myMarketIds.length > 0}
          <div class="py-6 text-base-content/70">Loading saved markets...</div>
        {:else}
          <div class="grid gap-2 py-6 border-b border-base-300">
            <strong class="text-white">No bookmarks yet</strong>
            <p class="text-base-content/70 leading-[1.6]">Bookmark markets you want to track. Click the bookmark icon on any market card.</p>
            <a class="btn btn-primary w-fit mt-1" href="/">Browse Markets</a>
          </div>
        {/if}
      </div>
    {:else}
      <div class="grid gap-2 py-6 border-t border-base-300 border-b border-base-300">
        <strong class="text-white">Sign in to manage your bookmarks.</strong>
        <p class="text-base-content/70 leading-[1.6]">Saved markets stay attached to your account so you can return to them quickly.</p>
      </div>
    {/if}
  </section>

  <section class="grid gap-4">
    <h2 class="text-[1.1rem] font-semibold">What others are saving</h2>

    <div class="divide-y divide-base-300 border-t border-base-300">
      {#if orderedTrending.length > 0}
        {#each orderedTrending as entry (entry.market.id)}
          <a class="flex items-start justify-between gap-4 py-4 hover:text-white" href="/market/{entry.market.slug}">
            <div class="grid gap-1 min-w-0">
              <strong class="text-white text-base">{entry.market.title}</strong>
              <p class="text-base-content/70 leading-[1.6]">{entry.market.description || entry.market.body || 'No summary yet.'}</p>
            </div>
            <span class="text-base-content/50 font-mono text-sm whitespace-nowrap shrink-0">{entry.count} save{entry.count === 1 ? '' : 's'}</span>
          </a>
        {/each}
      {:else}
        <div class="grid gap-2 py-6 border-b border-base-300">
          <strong class="text-white">No bookmarks yet</strong>
          <p class="text-base-content/70 leading-[1.6]">As people save markets, the most followed ones will show up here.</p>
        </div>
      {/if}
    </div>
  </section>
</div>
