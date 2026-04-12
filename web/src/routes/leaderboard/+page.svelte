<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { parseDiscussionEvent, parseMarketEvent, type DiscussionRecord, type MarketRecord } from '$lib/ndk/cascade';
  import { displayName, profileIdentifier, shortPubkey } from '$lib/ndk/format';
  import type { PageProps } from './$types';

  type LeaderboardTab = 'Top Predictors' | 'Top Creators' | 'Most Accurate' | 'Most Bookmarked';

  let { data }: PageProps = $props();
  let activeTab = $state<LeaderboardTab>('Top Predictors');

  const tabs: LeaderboardTab[] = ['Top Predictors', 'Top Creators', 'Most Accurate', 'Most Bookmarked'];
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

  const creatorRows = $derived.by(() => {
    return [...new Set(markets.map((market) => market.pubkey))]
      .map((pubkey) => ({
        pubkey,
        marketCount: markets.filter((market) => market.pubkey === pubkey).length
      }))
      .sort((left, right) => right.marketCount - left.marketCount)
      .slice(0, 20);
  });

  const networkBookmarks = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [10003], limit: 200 }] };
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
    return { filters: [{ kinds: [982], ids: bookmarkedCounts.map(([id]) => id) }] };
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
</script>

<section class="leaderboard-header">
  <div class="leaderboard-copy">
    <div class="leaderboard-kicker">Leaderboard</div>
    <h1>Top performers on Cascade</h1>
    <p>Competitive browsing and social proof, rebuilt around the data that is public today.</p>
  </div>
</section>

<nav class="leaderboard-tabs" aria-label="Leaderboard tabs">
  {#each tabs as tab}
    <button class:active={activeTab === tab} type="button" onclick={() => (activeTab = tab)}>
      {tab}
    </button>
  {/each}
</nav>

{#if activeTab === 'Top Predictors'}
  <section class="leaderboard-empty">
    <p>No trading data yet.</p>
    <p>Anonymous mint-published trade records do not expose a public predictor leaderboard yet.</p>
  </section>
{/if}

{#if activeTab === 'Most Accurate'}
  <section class="leaderboard-empty">
    <p>No trading data yet.</p>
    <p>Accuracy rankings need a public attribution layer beyond anonymous trade publication.</p>
  </section>
{/if}

{#if activeTab === 'Top Creators'}
  <section class="leaderboard-list">
    {#if creatorRows.length > 0}
      {#each creatorRows as row, index (row.pubkey)}
        <a class="leaderboard-row" href={profileHref(row.pubkey)}>
          <span class="rank">{index + 1}</span>
          <div class="leaderboard-main">
            <strong>{label(row.pubkey)}</strong>
            <p>{shortPubkey(row.pubkey)}</p>
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
    color: var(--text-faint);
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
    color: var(--text-muted);
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
    color: var(--text-faint);
    font-size: 0.88rem;
    font-weight: 500;
    cursor: pointer;
  }

  .leaderboard-tabs button.active {
    border-bottom-color: var(--text-strong);
    color: var(--text-strong);
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
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }

  .leaderboard-main strong {
    color: var(--text-strong);
    font-size: 1rem;
  }

  .leaderboard-main p {
    margin-top: 0.25rem;
    color: var(--text-faint);
    font-size: 0.82rem;
    line-height: 1.55;
  }

  .leaderboard-metric {
    display: grid;
    justify-items: end;
  }

  .leaderboard-metric strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 0.92rem;
  }

  .leaderboard-metric span {
    color: var(--text-faint);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .leaderboard-empty,
  .leaderboard-empty-inline {
    padding: 2rem 0;
    color: var(--text-muted);
  }

  .leaderboard-empty p:first-child {
    color: var(--text-strong);
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
