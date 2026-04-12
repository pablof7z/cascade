<script lang="ts">
  import {
    buildTradeSummary,
    formatProbability,
    formatRelativeTime,
    formatSats,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const markets = $derived(
    (data.markets ?? [])
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market))
  );
  const discussions = $derived((data.discussions ?? []).map(parseDiscussionEvent).filter(Boolean));
  const trades = $derived(
    (data.trades ?? [])
      .map(parseTradeEvent)
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
        detail: `${trade.direction === 'yes' ? 'LONG' : 'SHORT'} · ${formatSats(trade.amount)} ${trade.unit}`
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

<section class="analytics-header">
  <div class="analytics-copy">
    <div class="analytics-kicker">Analytics</div>
    <h1>Network monitoring</h1>
    <p>A dense read of the visible market, trade, and discussion graph.</p>
  </div>
</section>

<section class="analytics-stats">
  <div>
    <span>Markets</span>
    <strong>{markets.length}</strong>
  </div>
  <div>
    <span>Trade Records</span>
    <strong>{trades.length}</strong>
  </div>
  <div>
    <span>Discussion Opens</span>
    <strong>{discussions.length}</strong>
  </div>
  <div>
    <span>Visible Volume</span>
    <strong>{formatSats(visibleVolume)} sats</strong>
  </div>
  <div>
    <span>Active Markets</span>
    <strong>{activeMarketCount}</strong>
  </div>
  <div>
    <span>Visible Authors</span>
    <strong>{uniqueAuthors}</strong>
  </div>
</section>

<section class="analytics-grid">
  <article class="analytics-panel">
    <div class="panel-header">
      <h2>Most active markets</h2>
      <span>Visible volume</span>
    </div>

    <div class="analytics-table">
      <div class="analytics-head">
        <div>Market</div>
        <div>Volume</div>
        <div>Price</div>
        <div>Discussion</div>
      </div>

      {#if marketRows.length > 0}
        {#each marketRows as row (row.market.id)}
          <a class="analytics-row" href="/market/{row.market.slug}">
            <div class="market-cell">
              <strong>{sanitizeMarketCopy(row.market.title)}</strong>
              <p>{formatRelativeTime(row.market.createdAt)}</p>
            </div>
            <div class="mono-cell">{formatSats(row.summary.grossVolume)}</div>
            <div class="mono-cell">{formatProbability(row.summary.latestPricePpm ? row.summary.latestPricePpm / 1_000_000 : null)}</div>
            <div class="mono-cell">{row.discussionCount}</div>
          </a>
        {/each}
      {:else}
        <div class="analytics-empty">No market activity yet.</div>
      {/if}
    </div>
  </article>

  <article class="analytics-panel">
    <div class="panel-header">
      <h2>Category distribution</h2>
      <span>Market count</span>
    </div>

    <div class="stack-list">
      {#if categoryRows.length > 0}
        {#each categoryRows as row}
          <div class="stack-row">
            <div>
              <strong>{row.name}</strong>
              <p>{row.markets} markets · {row.trades} trade records</p>
            </div>
          </div>
        {/each}
      {:else}
        <div class="analytics-empty">No categories yet.</div>
      {/if}
    </div>
  </article>
</section>

<section class="analytics-panel analytics-panel-wide">
  <div class="panel-header">
    <h2>Recent network events</h2>
    <span>Generated now</span>
  </div>

  <div class="stack-list">
    {#if activityRows.length > 0}
      {#each activityRows as row (row.id)}
        <div class="stack-row stack-row-wide">
          <div>
            <span class="event-kind">{row.kind}</span>
            <strong>{row.detail}</strong>
          </div>
          <span class="mono-cell">{formatRelativeTime(row.createdAt)}</span>
        </div>
      {/each}
    {:else}
      <div class="analytics-empty">No network events yet.</div>
    {/if}
  </div>
</section>

<style>
  .analytics-header {
    padding-top: 1rem;
  }

  .analytics-copy {
    display: grid;
    gap: 0.9rem;
    max-width: 36rem;
  }

  .analytics-kicker,
  .event-kind {
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .analytics-copy h1 {
    font-size: clamp(2.4rem, 4vw, 4rem);
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .analytics-copy p {
    color: var(--text-muted);
    line-height: 1.75;
  }

  .analytics-stats {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 1rem;
    padding-top: 2rem;
  }

  .analytics-stats div {
    display: grid;
    gap: 0.35rem;
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .analytics-stats span {
    color: var(--text-faint);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .analytics-stats strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .analytics-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
    gap: 2.5rem;
    padding-top: 2rem;
  }

  .analytics-panel {
    display: grid;
    gap: 1rem;
  }

  .analytics-panel-wide {
    padding-top: 2rem;
  }

  .panel-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .panel-header h2 {
    font-size: 1.18rem;
    letter-spacing: -0.03em;
  }

  .panel-header span {
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .analytics-table,
  .stack-list {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .analytics-head,
  .analytics-row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 0.75fr 0.8fr 0.7fr;
    gap: 1rem;
    align-items: center;
  }

  .analytics-head {
    padding: 0.9rem 0;
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .analytics-row,
  .stack-row {
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .market-cell strong,
  .stack-row strong {
    color: var(--text-strong);
    font-size: 1rem;
  }

  .market-cell p,
  .stack-row p {
    margin-top: 0.25rem;
    color: var(--text-faint);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .mono-cell {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 0.84rem;
  }

  .stack-row-wide {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .analytics-empty {
    padding: 1rem 0;
    color: var(--text-muted);
  }

  @media (max-width: 1100px) {
    .analytics-stats {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .analytics-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .analytics-stats,
    .analytics-head,
    .analytics-row {
      grid-template-columns: 1fr;
    }

    .analytics-head {
      display: none;
    }

    .stack-row-wide {
      flex-direction: column;
    }
  }
</style>
