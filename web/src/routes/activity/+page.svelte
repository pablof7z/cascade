<script lang="ts">
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { isPaperEdition } from '$lib/cascade/config';
  import { formatProductAmount, productUnitLabel } from '$lib/cascade/format';
  import {
    formatProbability,
    formatRelativeTime,
    formatSats,
    marketUrl,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    type DiscussionRecord,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import type { PageProps } from './$types';

  type Filter = 'All' | 'New Markets' | 'Trades' | 'Discussion';

  let { data }: PageProps = $props();
  let activeFilter = $state<Filter>('All');
  const paperEdition = isPaperEdition();

  const filters: Filter[] = ['All', 'New Markets', 'Trades', 'Discussion'];
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
  const trades = $derived(
    (data.trades ?? [])
      .map(parseTradeEvent)
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
      subtitle: displayName(profiles[market.pubkey], shortPubkey(market.pubkey)),
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
        label: trade.type === 'buy' ? 'Minted' : 'Withdrew',
        title: market ? sanitizeMarketCopy(market.title) : trade.marketId,
        subtitle: `${trade.direction === 'yes' ? 'YES' : 'NO'} · ${formatProductAmount(trade.amount, trade.unit)} ${productUnitLabel(trade.unit)} · ${formatProbability(trade.probability)}`,
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
        subtitle: `${market ? sanitizeMarketCopy(market.title) : discussion.marketId} · ${displayName(profiles[discussion.pubkey], shortPubkey(discussion.pubkey))}`,
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
</script>

<section class="activity-header">
  <div class="activity-copy">
    <div class="activity-kicker">Activity</div>
    <h1>Recent activity across all markets</h1>
    <p>Market creation, mint-published trade records, and discussion updates in one live feed.</p>
  </div>
</section>

<section class="activity-stats">
  <div>
    <span>Markets</span>
    <strong>{markets.length}</strong>
  </div>
  <div>
    <span>Trades</span>
    <strong>{trades.length}</strong>
  </div>
  <div>
    <span>Discussion</span>
    <strong>{discussions.length}</strong>
  </div>
  <div>
    <span>Visible Volume</span>
    <strong>{paperEdition ? formatProductAmount(trades.reduce((sum, trade) => sum + trade.amount, 0), 'usd') : `${formatSats(trades.reduce((sum, trade) => sum + trade.amount, 0))} sats`}</strong>
  </div>
</section>

<nav class="activity-tabs" aria-label="Activity filters">
  {#each filters as filter}
    <button class:active={activeFilter === filter} type="button" onclick={() => (activeFilter = filter)}>
      {filter}
    </button>
  {/each}
</nav>

<section class="activity-list">
  {#if visibleEntries.length > 0}
    {#each visibleEntries as entry (entry.id)}
      <a class="activity-row" href={entry.href}>
        <div class="row-main">
          <span class="row-label">{entry.label}</span>
          <strong>{entry.title}</strong>
          <p>{entry.subtitle}</p>
        </div>
        <span class="row-time">{formatRelativeTime(entry.createdAt)}</span>
      </a>
    {/each}
  {:else}
    <div class="activity-empty">No activity found.</div>
  {/if}
</section>

<style>
  .activity-header {
    padding-top: 1rem;
  }

  .activity-copy {
    display: grid;
    gap: 0.9rem;
    max-width: 40rem;
  }

  .activity-kicker {
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .activity-copy h1 {
    font-size: clamp(2.4rem, 4vw, 4rem);
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .activity-copy p {
    color: var(--text-muted);
    line-height: 1.75;
  }

  .activity-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    padding-top: 2rem;
  }

  .activity-stats div {
    display: grid;
    gap: 0.35rem;
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .activity-stats span {
    color: var(--text-faint);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .activity-stats strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .activity-tabs {
    display: flex;
    gap: 1rem;
    padding-top: 1.5rem;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
    overflow-x: auto;
  }

  .activity-tabs button {
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

  .activity-tabs button.active {
    border-bottom-color: var(--text-strong);
    color: var(--text-strong);
  }

  .activity-list {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
    margin-top: 1.5rem;
  }

  .activity-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }

  .row-main {
    display: grid;
    gap: 0.25rem;
  }

  .row-label {
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .row-main strong {
    color: var(--text-strong);
    font-size: 1rem;
  }

  .row-main p,
  .row-time {
    color: var(--text-faint);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .row-time {
    flex: 0 0 auto;
    font-family: var(--font-mono);
  }

  .activity-empty {
    padding: 1rem 0;
    color: var(--text-muted);
  }

  @media (max-width: 900px) {
    .activity-stats {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .activity-stats {
      grid-template-columns: 1fr;
    }

    .activity-row {
      flex-direction: column;
    }
  }
</style>
