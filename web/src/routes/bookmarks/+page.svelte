<script lang="ts">
  import { browser } from '$app/environment';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { parseMarketEvent, type MarketRecord } from '$lib/ndk/cascade';

  const currentUser = $derived(ndk.$currentUser);

  const myBookmarkList = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return { filters: [{ kinds: [10003], authors: [currentUser.pubkey], limit: 1 }] };
  });

  const myMarketIds = $derived.by(() => {
    const bookmarkEvent = myBookmarkList.events[0];
    if (!bookmarkEvent) return [];
    return bookmarkEvent.tags.filter((tag) => tag[0] === 'e' && tag[1]).map((tag) => tag[1]);
  });

  const myMarkets = ndk.$subscribe(() => {
    if (!browser || myMarketIds.length === 0) return undefined;
    return { filters: [{ kinds: [982], ids: myMarketIds }] };
  });

  const networkBookmarks = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [10003], limit: 200 }] };
  });

  const trendingMarketIds = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const bookmarkEvent of networkBookmarks.events) {
      if (currentUser && bookmarkEvent.pubkey === currentUser.pubkey) continue;
      for (const tag of bookmarkEvent.tags) {
        if (tag[0] !== 'e' || !tag[1]) continue;
        counts.set(tag[1], (counts.get(tag[1]) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, 20);
  });

  const trendingMarkets = ndk.$subscribe(() => {
    if (!browser || trendingMarketIds.length === 0) return undefined;
    return { filters: [{ kinds: [982], ids: trendingMarketIds.map(([id]) => id) }] };
  });

  const myMarketLookup = $derived.by(() => {
    const lookup = new Map<string, MarketRecord>();
    for (const event of myMarkets.events) {
      const market = parseMarketEvent(event.rawEvent());
      if (market) lookup.set(market.id, market);
    }
    return lookup;
  });

  const orderedMyMarkets = $derived(myMarketIds.map((id) => myMarketLookup.get(id)).filter(Boolean) as MarketRecord[]);

  const trendingLookup = $derived.by(() => {
    const lookup = new Map<string, MarketRecord>();
    for (const event of trendingMarkets.events) {
      const market = parseMarketEvent(event.rawEvent());
      if (market) lookup.set(market.id, market);
    }
    return lookup;
  });

  const orderedTrending = $derived.by(() => {
    return trendingMarketIds
      .map(([id, count]) => ({ market: trendingLookup.get(id), count }))
      .filter((entry): entry is { market: MarketRecord; count: number } => Boolean(entry.market));
  });

  async function removeBookmark(marketId: string) {
    if (!currentUser) return;
    const bookmarkEvent = myBookmarkList.events[0];
    if (!bookmarkEvent) return;
    const updated = new NDKEvent(ndk);
    updated.kind = 10003;
    updated.tags = bookmarkEvent.tags.filter((tag) => !(tag[0] === 'e' && tag[1] === marketId));
    await updated.publish();
  }
</script>

<section class="section">
  <div class="bookmarks-header">
    <div>
      <div class="eyebrow">Bookmarks</div>
      <h1>My Bookmarks</h1>
      <p>Markets you've saved for later.</p>
    </div>
  </div>
</section>

<div class="bookmarks-grid">
  <section class="bookmarks-panel">
    <div class="bookmarks-panel-header">
      <h2>Saved markets</h2>
      <a href="/">Browse Markets</a>
    </div>

    {#if currentUser}
      <div class="bookmarks-list">
        {#if orderedMyMarkets.length > 0}
          {#each orderedMyMarkets as market (market.id)}
            <div class="bookmark-row">
              <a class="bookmark-link" href="/market/{market.slug}">
                <strong>{market.title}</strong>
                <p>{market.description || market.body || 'No summary yet.'}</p>
              </a>
              <button class="button-ghost" onclick={() => removeBookmark(market.id)}>Remove</button>
            </div>
          {/each}
        {:else if myMarketIds.length > 0}
          <div class="bookmark-empty">Loading saved markets...</div>
        {:else}
          <div class="bookmark-empty">
            <strong>No bookmarks yet</strong>
            <p>Bookmark markets you want to track. Click the bookmark icon on any market card.</p>
            <a class="button-primary" href="/">Browse Markets</a>
          </div>
        {/if}
      </div>
    {:else}
      <div class="bookmark-empty">
        <strong>Sign in to manage your bookmarks.</strong>
        <p>Saved markets stay attached to your account so you can return to them quickly.</p>
      </div>
    {/if}
  </section>

  <section class="bookmarks-panel">
    <div class="bookmarks-panel-header">
      <h2>What others are saving</h2>
    </div>

    <div class="bookmarks-list">
      {#if orderedTrending.length > 0}
        {#each orderedTrending as entry (entry.market.id)}
          <a class="bookmark-row bookmark-row-link" href="/market/{entry.market.slug}">
            <div class="bookmark-link">
              <strong>{entry.market.title}</strong>
              <p>{entry.market.description || entry.market.body || 'No summary yet.'}</p>
            </div>
            <span class="bookmark-count">{entry.count} save{entry.count === 1 ? '' : 's'}</span>
          </a>
        {/each}
      {:else}
        <div class="bookmark-empty">
          <strong>No bookmarks yet</strong>
          <p>As people save markets, the most followed ones will show up here.</p>
        </div>
      {/if}
    </div>
  </section>
</div>

<style>
  .bookmarks-header h1 {
    font-size: 2rem;
    letter-spacing: -0.04em;
  }

  .bookmarks-header p,
  .bookmark-link p,
  .bookmark-empty p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .bookmarks-grid {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(18rem, 1fr);
    gap: 2rem;
  }

  .bookmarks-panel {
    display: grid;
    gap: 1rem;
  }

  .bookmarks-panel-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }

  .bookmarks-panel-header h2 {
    font-size: 1.1rem;
  }

  .bookmarks-panel-header a {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.84rem;
  }

  .bookmarks-list {
    display: grid;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .bookmark-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .bookmark-row-link:hover strong {
    color: var(--color-base-content);
  }

  .bookmark-link {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
  }

  .bookmark-link strong,
  .bookmark-empty strong {
    color: white;
    font-size: 0.98rem;
  }

  .bookmark-link p,
  .bookmark-empty p {
    line-height: 1.6;
  }

  .bookmark-count {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  .bookmark-empty {
    display: grid;
    gap: 0.65rem;
    padding: 1.5rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  @media (max-width: 900px) {
    .bookmarks-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
