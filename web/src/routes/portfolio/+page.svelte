<script lang="ts">
  import { browser } from '$app/environment';
  import { ndk } from '$lib/ndk/client';
  import {
    buildTradeSummary,
    formatProbability,
    formatRelativeTime,
    formatSats,
    marketUrl,
    parseMarketEvent,
    parsePositionEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    type MarketRecord,
    type PositionRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';

  const currentUser = $derived(ndk.$currentUser);

  const positionFeed = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return { filters: [{ kinds: [30078], authors: [currentUser.pubkey], limit: 120 }] };
  });

  const positions = $derived.by(() => {
    return positionFeed.events
      .map((event) => parsePositionEvent(event.rawEvent()))
      .filter((position): position is PositionRecord => Boolean(position))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const positionMarketIds = $derived([...new Set(positions.map((position) => position.marketId))]);

  const marketFeed = ndk.$subscribe(() => {
    if (!browser || positionMarketIds.length === 0) return undefined;
    return { filters: [{ kinds: [982], ids: positionMarketIds }] };
  });

  const tradeFeed = ndk.$subscribe(() => {
    if (!browser || positionMarketIds.length === 0) return undefined;
    return { filters: [{ kinds: [983], '#e': positionMarketIds, limit: 400 }] };
  });

  const marketLookup = $derived.by(() => {
    const lookup = new Map<string, MarketRecord>();
    for (const event of marketFeed.events) {
      const market = parseMarketEvent(event.rawEvent());
      if (market) lookup.set(market.id, market);
    }
    return lookup;
  });

  const tradeSummaryByMarket = $derived.by(() => {
    const grouped = new Map<string, TradeRecord[]>();

    for (const event of tradeFeed.events) {
      const trade = parseTradeEvent(event.rawEvent());
      if (!trade) continue;
      const bucket = grouped.get(trade.marketId);
      if (bucket) bucket.push(trade);
      else grouped.set(trade.marketId, [trade]);
    }

    const summaries = new Map<string, ReturnType<typeof buildTradeSummary>>();
    for (const [marketId, trades] of grouped) {
      summaries.set(marketId, buildTradeSummary(trades));
    }
    return summaries;
  });

  const enrichedPositions = $derived.by(() => {
    return positions.map((position) => {
      const market = marketLookup.get(position.marketId);
      const summary = tradeSummaryByMarket.get(position.marketId);
      const currentPrice = summary?.latestPricePpm ? summary.latestPricePpm / 1_000_000 : position.entryPrice;
      const totalInvested = position.stakeSats || Math.round(position.quantity * position.entryPrice);
      const currentValue = Math.round(position.quantity * currentPrice);
      const pnl = currentValue - totalInvested;
      const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0;

      return {
        ...position,
        market,
        currentPrice,
        totalInvested,
        currentValue,
        pnl,
        pnlPercent
      };
    });
  });

  const totalInvested = $derived(enrichedPositions.reduce((sum, position) => sum + position.totalInvested, 0));
  const currentValue = $derived(enrichedPositions.reduce((sum, position) => sum + position.currentValue, 0));
  const totalPnl = $derived(currentValue - totalInvested);
  const totalPnlPercent = $derived(totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0);
  const winners = $derived(enrichedPositions.filter((position) => position.pnl > 0).length);
  const winRate = $derived(enrichedPositions.length > 0 ? (winners / enrichedPositions.length) * 100 : 0);
</script>

<section class="portfolio-header">
  <div class="portfolio-copy">
    <div class="portfolio-kicker">Portfolio</div>
    <h1>Track your positions and performance</h1>
    <p>This route reads your public position records and compares them to the latest visible market pricing.</p>
  </div>
</section>

{#if currentUser}
  <section class="portfolio-stats">
    <div>
      <span>Total Invested</span>
      <strong>{formatSats(totalInvested)} sats</strong>
    </div>
    <div>
      <span>Current Value</span>
      <strong>{formatSats(currentValue)} sats</strong>
    </div>
    <div>
      <span>Total P&amp;L</span>
      <strong class:positive={totalPnl >= 0} class:negative={totalPnl < 0}>
        {totalPnl >= 0 ? '+' : ''}{formatSats(totalPnl)} sats ({totalPnlPercent.toFixed(1)}%)
      </strong>
    </div>
    <div>
      <span>Positions / Win Rate</span>
      <strong>{enrichedPositions.length} / {winRate.toFixed(0)}%</strong>
    </div>
  </section>

  <section class="portfolio-section">
    <div class="section-header">
      <div>
        <div class="section-kicker">Open Positions</div>
        <h2>Current holdings</h2>
      </div>
    </div>

    {#if enrichedPositions.length > 0}
      <div class="portfolio-table">
        <div class="portfolio-head">
          <div>Market</div>
          <div>Shares</div>
          <div>Avg Price</div>
          <div>Current</div>
          <div>P&amp;L</div>
          <div></div>
        </div>

        {#each enrichedPositions as position (position.id)}
          <div class="portfolio-row">
            <div class="market-cell">
              {#if position.market}
                <a href={marketUrl(position.market.slug)}>{position.marketTitle || sanitizeMarketCopy(position.market.title)}</a>
              {:else}
                <span>{position.marketTitle || position.marketId}</span>
              {/if}
              <p>{position.direction === 'yes' ? 'YES' : 'NO'} · {formatRelativeTime(Math.floor(position.createdAt / 1000))}</p>
            </div>
            <div class="mono-cell">{position.quantity}</div>
            <div class="mono-cell">{formatProbability(position.entryPrice)}</div>
            <div class="mono-cell">{formatProbability(position.currentPrice)}</div>
            <div class="mono-cell" class:positive={position.pnl >= 0} class:negative={position.pnl < 0}>
              {position.pnl >= 0 ? '+' : ''}{formatSats(position.pnl)}
            </div>
            <div class="action-cell">
              <a class="button-secondary" href="/wallet">Withdraw</a>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <div class="portfolio-empty">
        <p>No positions yet</p>
        <p>Place your first trade on any market to see it here.</p>
        <a class="button-primary" href="/">Browse Markets</a>
      </div>
    {/if}
  </section>

  <section class="portfolio-section">
    <div class="section-header">
      <div>
        <div class="section-kicker">Closed Positions</div>
        <h2>Withdrawal history</h2>
      </div>
    </div>

    <div class="portfolio-empty portfolio-empty-inline">
      <p>Loading payout history…</p>
      <p>Closed-position history returns with the mint bridge port.</p>
    </div>
  </section>
{:else}
  <section class="portfolio-empty">
    <p>No positions yet</p>
    <p>Sign in to load your public position records.</p>
    <a class="button-primary" href="/join">Join Cascade</a>
  </section>
{/if}

<style>
  .portfolio-header {
    padding-top: 1rem;
  }

  .portfolio-copy {
    display: grid;
    gap: 0.9rem;
    max-width: 40rem;
  }

  .portfolio-kicker,
  .section-kicker {
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .portfolio-copy h1 {
    font-size: clamp(2.4rem, 4vw, 4rem);
    letter-spacing: -0.05em;
    line-height: 1;
  }

  .portfolio-copy p {
    color: var(--text-muted);
    line-height: 1.75;
  }

  .portfolio-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    padding-top: 2rem;
  }

  .portfolio-stats div {
    display: grid;
    gap: 0.4rem;
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .portfolio-stats span {
    color: var(--text-faint);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .portfolio-stats strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .portfolio-section {
    display: grid;
    gap: 1rem;
    padding-top: 2rem;
  }

  .section-header h2 {
    margin-top: 0.25rem;
    font-size: 1.18rem;
    letter-spacing: -0.03em;
  }

  .portfolio-table {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .portfolio-head,
  .portfolio-row {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 0.65fr 0.8fr 0.8fr 0.9fr auto;
    gap: 1rem;
    align-items: center;
  }

  .portfolio-head {
    padding: 0.9rem 0;
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .portfolio-row {
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .market-cell a,
  .market-cell span {
    color: var(--text-strong);
    font-size: 1rem;
    font-weight: 600;
  }

  .market-cell p {
    margin-top: 0.2rem;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .mono-cell {
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }

  .action-cell {
    display: flex;
    justify-content: flex-end;
  }

  .portfolio-empty {
    display: grid;
    gap: 0.55rem;
    justify-items: start;
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .portfolio-empty p:first-child {
    color: var(--text-strong);
    font-size: 1rem;
    font-weight: 600;
  }

  .portfolio-empty p:last-child {
    color: var(--text-muted);
    line-height: 1.7;
  }

  .portfolio-empty-inline {
    justify-items: start;
  }

  @media (max-width: 1024px) {
    .portfolio-stats {
      grid-template-columns: 1fr 1fr;
    }

    .portfolio-head,
    .portfolio-row {
      grid-template-columns: minmax(0, 1.6fr) 0.8fr 0.8fr 0.8fr 0.9fr auto;
    }
  }

  @media (max-width: 760px) {
    .portfolio-stats,
    .portfolio-head,
    .portfolio-row {
      grid-template-columns: 1fr;
    }

    .portfolio-head {
      display: none;
    }

    .action-cell {
      justify-content: start;
    }
  }
</style>
