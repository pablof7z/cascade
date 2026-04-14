<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import {
    CASCADE_BOOKMARK_KIND,
    CASCADE_MARKET_KIND,
    CASCADE_TRADE_KIND,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    type DiscussionRecord,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName, profileIdentifier, shortPubkey } from '$lib/ndk/format';
  import type { PageProps } from './$types';

  type LeaderboardTab = 'Top Creators' | 'Top Traders' | 'Most Bookmarked';

  let { data }: PageProps = $props();
  let activeTab = $state<LeaderboardTab>('Top Creators');

  const tabs: LeaderboardTab[] = ['Top Creators', 'Top Traders', 'Most Bookmarked'];
  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);
  const markets = $derived(
    (data.markets ?? [])
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market))
  );
  const discussions = $derived(
    (data.discussions ?? [])
      .map(parseDiscussionEvent)
      .filter((discussion): discussion is DiscussionRecord => Boolean(discussion))
  );

  const tradeFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [CASCADE_TRADE_KIND], limit: 240 }] };
  });

  const trades = $derived.by(() => {
    return mergeRawEvents(data.trades ?? [], tradeFeed.events)
      .map(parseTradeEvent)
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
    return { filters: [{ kinds: [CASCADE_MARKET_KIND], ids: bookmarkedCounts.map(([id]) => id) }] };
  });

  const bookmarkedLookup = $derived.by(() => {
    const lookup = new Map<string, MarketRecord>();
    for (const event of bookmarkedMarkets.events) {
      const market = parseMarketEvent(event.rawEvent());
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
    return displayName(profiles[pubkey], shortPubkey(pubkey));
  }

  function profileHref(pubkey: string): string {
    return `/p/${profileIdentifier(profiles[pubkey], pubkey)}`;
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

  function mergeRawEvents(seed: NostrEvent[], live: NDKEvent[]): NostrEvent[] {
    const merged = new Map<string, NostrEvent>();

    for (const event of live) {
      const raw = event.rawEvent() as NostrEvent;
      if (raw.id) merged.set(raw.id, raw);
    }

    for (const event of seed) {
      if (event.id && !merged.has(event.id)) merged.set(event.id, event);
    }

    return [...merged.values()];
  }
</script>

<section class="leaderboard-header">
  <div class="leaderboard-copy">
    <div class="leaderboard-kicker">Leaderboard</div>
    <h1>Leaderboard</h1>
    <p>Top market creators and the most-followed questions on Cascade.</p>
  </div>
</section>

<nav class="leaderboard-tabs" aria-label="Leaderboard tabs">
  {#each tabs as tab}
    <button class:active={activeTab === tab} type="button" onclick={() => (activeTab = tab)}>
      {tab}
    </button>
  {/each}
</nav>

{#if activeTab === 'Top Creators'}
  <section class="leaderboard-list">
    {#if creatorRows.length > 0}
      {#each creatorRows as row, index (row.pubkey)}
        <a class="leaderboard-row" href={profileHref(row.pubkey)}>
          <span class="rank">{index + 1}</span>
          <div class="leaderboard-main">
            <strong>{label(row.pubkey)}</strong>
            <p>{row.marketCount} market{row.marketCount === 1 ? '' : 's'} created</p>
          </div>
          <div class="leaderboard-metric">
            <strong>{row.marketCount}</strong>
            <span>Markets</span>
          </div>
        </a>
      {/each}
    {:else}
      <div class="leaderboard-empty-inline">No creator data yet.</div>
    {/if}
  </section>
{/if}

{#if activeTab === 'Top Traders'}
  <section class="leaderboard-list">
    {#if traderRows.length > 0}
      {#each traderRows as row, index (row.pubkey)}
        <a class="leaderboard-row" href={profileHref(row.pubkey)}>
          <span class="rank">{index + 1}</span>
          <div class="leaderboard-main">
            <strong>{label(row.pubkey)}</strong>
            <p>{row.tradeCount} trade{row.tradeCount === 1 ? '' : 's'} placed</p>
          </div>
          <div class="leaderboard-metric">
            <strong>{row.tradeCount}</strong>
            <span>Trades</span>
          </div>
        </a>
      {/each}
    {:else}
      <div class="leaderboard-empty-inline">No trader data yet.</div>
    {/if}
  </section>
{/if}

{#if activeTab === 'Most Bookmarked'}
  {#if bookmarkedRows.length > 0}
    <section class="leaderboard-list">
      {#each bookmarkedRows as row (row.market.id)}
        <a class="leaderboard-row" href="/market/{row.market.slug}">
          <span class="rank">{row.rank}</span>
          <div class="leaderboard-main">
            <strong>{row.market.title}</strong>
            <p>{row.market.description || 'Prediction market'}</p>
          </div>
          <div class="leaderboard-metric">
            <strong>{row.count}</strong>
            <span>Bookmarks</span>
          </div>
          <div class="leaderboard-metric">
            <strong>{row.discussionCount}</strong>
            <span>Posts</span>
          </div>
        </a>
      {/each}
    </section>
  {:else}
    <section class="leaderboard-empty">
      <p>No bookmarked markets yet.</p>
      <p>Bookmark markets to see them ranked here.</p>
    </section>
  {/if}
{/if}

<style>
  .leaderboard-header {
    padding-top: 1rem;
  }

  .leaderboard-copy {
    display: grid;
    gap: 0.9rem;
    max-width: 38rem;
  }

  .leaderboard-kicker {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .leaderboard-copy h1 {
    font-size: clamp(2.4rem, 4vw, 4rem);
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .leaderboard-copy p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.75;
  }

  .leaderboard-tabs {
    display: flex;
    gap: 1rem;
    padding-top: 1.75rem;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
    overflow-x: auto;
  }

  .leaderboard-tabs button {
    margin-bottom: -1px;
    padding: 0.9rem 0;
    border: none;
    border-bottom: 2px solid transparent;
    background: transparent;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
  }

  .leaderboard-tabs button.active {
    border-bottom-color: white;
    color: white;
  }

  .leaderboard-list {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
    margin-top: 1.5rem;
  }

  .leaderboard-row {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr) auto auto;
    gap: 1rem;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }

  .rank {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }

  .leaderboard-main strong {
    color: white;
    font-size: 1rem;
  }

  .leaderboard-main p {
    margin-top: 0.25rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.82rem;
    line-height: 1.55;
  }

  .leaderboard-metric {
    display: grid;
    justify-items: end;
  }

  .leaderboard-metric strong {
    color: white;
    font-family: var(--font-mono);
    font-size: 0.92rem;
  }

  .leaderboard-metric span {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .leaderboard-empty,
  .leaderboard-empty-inline {
    padding: 2rem 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .leaderboard-empty p:first-child {
    color: white;
    font-size: 1rem;
    font-weight: 600;
  }

  .leaderboard-empty p:last-child {
    margin-top: 0.4rem;
    line-height: 1.7;
  }

  @media (max-width: 760px) {
    .leaderboard-row {
      grid-template-columns: 1fr;
    }

    .leaderboard-metric {
      justify-items: start;
    }
  }
</style>
