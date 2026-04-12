<script lang="ts">
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import PaperTradePanel from '$lib/components/cascade/PaperTradePanel.svelte';
  import { isPaperEdition } from '$lib/cascade/config';
  import { formatProductAmount, productUnitLabel } from '$lib/cascade/format';
  import TabNav from '$lib/components/cascade/TabNav.svelte';
  import {
    buildDiscussionThreads,
    buildTradeSummary,
    formatProbability,
    formatRelativeTime,
    formatSats,
    marketActivityUrl,
    marketChartsUrl,
    marketDiscussionUrl,
    marketUrl,
    sanitizeMarketCopy,
    threadUrl,
    truncateText,
    type DiscussionRecord,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName, shortPubkey } from '$lib/ndk/format';

  let {
    market,
    trades,
    discussions,
    relatedMarkets,
    profiles,
    tab = 'overview'
  }: {
    market: MarketRecord;
    trades: TradeRecord[];
    discussions: DiscussionRecord[];
    relatedMarkets: MarketRecord[];
    profiles: Record<string, NDKUserProfile>;
    tab?: 'overview' | 'discussion' | 'charts' | 'activity';
  } = $props();

  const tradeSummary = $derived(buildTradeSummary(trades));
  const paperEdition = isPaperEdition();
  const valueUnitLabel = paperEdition ? 'USD' : 'sats';
  const discussionThreads = $derived(buildDiscussionThreads(discussions, market.id));
  const author = $derived(displayName(profiles[market.pubkey], shortPubkey(market.pubkey)));
  const tabs = $derived([
    { href: marketUrl(market.slug), label: 'Overview', active: tab === 'overview' },
    { href: marketDiscussionUrl(market.slug), label: 'Discussion', active: tab === 'discussion' },
    { href: marketChartsUrl(market.slug), label: 'Charts', active: tab === 'charts' },
    { href: marketActivityUrl(market.slug), label: 'Activity', active: tab === 'activity' }
  ]);

  const orderedTrades = $derived([...trades].sort((left, right) => right.createdAt - left.createdAt));
  const latestTrade = $derived(orderedTrades[0] ?? null);
  const earliestTrade = $derived([...trades].sort((left, right) => left.createdAt - right.createdAt)[0] ?? null);
  const impliedProbability = $derived((tradeSummary.latestPricePpm ?? 500_000) / 1_000_000);
  const oppositeProbability = $derived(1 - impliedProbability);
  const openingProbability = $derived(earliestTrade?.probability ?? 0.5);
  const visibleAccounts = $derived(new Set(trades.map((trade) => trade.pubkey)).size);
  const averageTradeSize = $derived(tradeSummary.tradeCount > 0 ? tradeSummary.grossVolume / tradeSummary.tradeCount : 0);
  const flowYes = $derived(
    tradeSummary.grossVolume > 0 ? tradeSummary.yesVolume / tradeSummary.grossVolume : impliedProbability
  );
  const flowNo = $derived(1 - flowYes);

  const caseParagraphs = $derived(
    market.body
      .split(/\n+/)
      .map((chunk) => sanitizeMarketCopy(chunk.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()))
      .filter(Boolean)
      .filter((chunk) => !/^(resolution criteria|market criteria):/i.test(chunk))
  );

  const activityEntries = $derived.by(() => {
    return [
      ...trades.map((trade) => ({
        id: trade.id,
        kind: 'trade' as const,
        createdAt: trade.createdAt,
        headline: `${trade.type === 'buy' ? 'Minted' : 'Withdrew'} ${trade.direction === 'yes' ? 'LONG' : 'SHORT'}`,
        detail: `${formatProductAmount(trade.amount, trade.unit)} at ${formatProbability(trade.probability)}`
      })),
      ...discussions.map((discussion) => ({
        id: discussion.id,
        kind: 'discussion' as const,
        createdAt: discussion.createdAt,
        headline: discussion.subject || 'Discussion update',
        detail: truncateText(discussion.content, 120)
      }))
    ].sort((left, right) => right.createdAt - left.createdAt);
  });

  const tilt = $derived.by(() => {
    if (impliedProbability >= 0.65) {
      return {
        label: 'Strong LONG consensus',
        detail: 'Most visible capital leans LONG. New flow needs fresh evidence rather than repetition.',
        accentClass: 'positive'
      };
    }

    if (impliedProbability <= 0.35) {
      return {
        label: 'Strong SHORT consensus',
        detail: 'Most visible capital leans SHORT. A reversal needs a catalyst, not sentiment alone.',
        accentClass: 'negative'
      };
    }

    return {
      label: 'No clear consensus',
      detail: 'Neither side dominates. Timing and evidence matter more than momentum here.',
      accentClass: ''
    };
  });

  const tradeFrame = $derived.by(() => {
    if (impliedProbability >= 0.65) {
      return [
        'LONG is crowded. New buyers need information the market has not absorbed yet.',
        'SHORT becomes more attractive if the current thesis is overstated.',
        'Check the discussion for the strongest counter-argument before sizing up.'
      ];
    }

    if (impliedProbability <= 0.35) {
      return [
        'SHORT is crowded. Further downside requires genuinely new evidence.',
        'LONG offers value only if the current skepticism is wrong.',
        'Look for what would force traders to reprice quickly.'
      ];
    }

    return [
      'Neither side has taken control. Edge comes from the next material update.',
      'LONG works if the case is underpriced relative to current debate.',
      'SHORT works if the visible enthusiasm is getting ahead of itself.'
    ];
  });

  const signalCards = $derived.by(() => {
    return [
      {
        eyebrow: 'Crowding',
        title: impliedProbability >= 0.5 ? `${priceCents(impliedProbability)} LONG leaning` : `${priceCents(oppositeProbability)} SHORT leaning`,
        detail:
          impliedProbability >= 0.5
            ? 'Visible pricing favors LONG right now.'
            : 'Visible pricing favors SHORT right now.'
      },
      {
        eyebrow: 'Flow',
        title: latestTrade
          ? `${latestTrade.type === 'buy' ? 'Mint' : 'Withdraw'} on ${latestTrade.direction === 'yes' ? 'LONG' : 'SHORT'}`
          : 'No visible fills yet',
        detail: latestTrade
          ? `${formatProductAmount(latestTrade.amount, latestTrade.unit)} moved ${formatRelativeTime(latestTrade.createdAt)}.`
          : 'This will update as soon as the mint publishes trade records.'
      },
      {
        eyebrow: 'Debate',
        title: discussionThreads[0]?.post.subject || 'No live debate yet',
        detail: discussionThreads[0]
          ? `${discussionThreads[0].replyCount} repl${discussionThreads[0].replyCount === 1 ? 'y' : 'ies'} so far.`
          : 'Start a thread from the discussion tab when you want to challenge the market.'
      }
    ];
  });

  function authorLabel(pubkey: string): string {
    return displayName(profiles[pubkey], shortPubkey(pubkey));
  }

  function priceCents(probability: number): string {
    return `${Math.round(probability * 100)}¢`;
  }
</script>

<section class="market-shell">
  <div class="market-header">
    <div class="market-copy">
      <div class="market-kicker">Market</div>
      <h1>{market.title}</h1>
      <p>{sanitizeMarketCopy(market.description) || 'No summary provided yet.'}</p>

      <div class="market-meta">
        <span>by {author}</span>
        <span>{formatRelativeTime(market.createdAt)}</span>
        {#if market.categories.length > 0}
          <span>{market.categories.join(', ')}</span>
        {/if}
      </div>
    </div>

    <div class="market-header-side">
      <div class="market-header-price">
        <span class="market-header-probability">{priceCents(impliedProbability)}</span>
        <span class="market-header-side-label">LONG</span>
      </div>

      <div class="market-header-stats">
        <span>{formatProductAmount(tradeSummary.grossVolume, paperEdition ? 'usd' : 'sat')} vol</span>
        <span>{tradeSummary.tradeCount} trades</span>
        <span>{discussionThreads.length} threads</span>
      </div>

      <div class="market-header-actions">
        <a class="button-primary" href="/portfolio">Open portfolio</a>
        <a class="button-secondary" href="/embed/market/{market.slug}">Embed market</a>
      </div>

      {#if paperEdition}
        <PaperTradePanel
          marketId={market.id}
          marketSlug={market.slug}
          yesProbability={impliedProbability}
          noProbability={oppositeProbability}
        />
      {/if}
    </div>
  </div>
</section>

<section class="market-tabs">
  <TabNav items={tabs} />
</section>

{#if tab === 'overview'}
  <section class="overview-top">
    <article class="tilt-panel">
      <h2 class={tilt.accentClass}>{tilt.label}</h2>
      <p>{tilt.detail}</p>

      <div class="overview-metrics">
        <div>
          <span>Move since first visible fill</span>
          <strong class:positive={impliedProbability - openingProbability >= 0} class:negative={impliedProbability - openingProbability < 0}>
            {impliedProbability - openingProbability >= 0 ? '+' : ''}{((impliedProbability - openingProbability) * 100).toFixed(1)}¢
          </strong>
        </div>
        <div>
          <span>Visible accounts</span>
          <strong>{visibleAccounts}</strong>
        </div>
        <div>
          <span>Average size</span>
          <strong>{formatProductAmount(Math.round(averageTradeSize), paperEdition ? 'usd' : 'sat')} {valueUnitLabel}</strong>
        </div>
        <div>
          <span>Discussion</span>
          <strong>{discussionThreads.length} threads</strong>
        </div>
      </div>
    </article>

    <aside class="summary-rail">
      <div class="price-grid">
        <div>
          <span>Yes</span>
          <strong class="positive">{priceCents(impliedProbability)}</strong>
        </div>
        <div>
          <span>No</span>
          <strong class="negative">{priceCents(oppositeProbability)}</strong>
        </div>
      </div>

      <dl class="summary-list">
        <div>
          <dt>Visible volume</dt>
          <dd>{formatProductAmount(tradeSummary.grossVolume, paperEdition ? 'usd' : 'sat')} {valueUnitLabel}</dd>
        </div>
        <div>
          <dt>Buy flow</dt>
          <dd>{formatProductAmount(tradeSummary.buyVolume, paperEdition ? 'usd' : 'sat')} {valueUnitLabel}</dd>
        </div>
        <div>
          <dt>Withdraw flow</dt>
          <dd>{formatProductAmount(tradeSummary.sellVolume, paperEdition ? 'usd' : 'sat')} {valueUnitLabel}</dd>
        </div>
        <div>
          <dt>Latest fill</dt>
          <dd>
            {#if latestTrade}
              {latestTrade.direction === 'yes' ? 'LONG' : 'SHORT'} {latestTrade.type === 'buy' ? 'mint' : 'withdraw'}
            {:else}
              None
            {/if}
          </dd>
        </div>
      </dl>
    </aside>
  </section>

  <section class="overview-grid">
    <article class="detail-section">
      <div class="detail-header">
        <h3>Price and positioning</h3>
        <span>Visible flow only</span>
      </div>

      <div class="bar-stack">
        <div>
          <div class="bar-label">
            <span>Implied probability</span>
            <span>{formatProbability(impliedProbability)} LONG</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill positive-fill" style:width={`${impliedProbability * 100}%`}></div>
          </div>
        </div>

        <div>
          <div class="bar-label">
            <span>LONG flow share</span>
            <span>{formatProbability(flowYes)} LONG</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill positive-fill" style:width={`${flowYes * 100}%`}></div>
          </div>
        </div>

        <div>
          <div class="bar-label">
            <span>SHORT flow share</span>
            <span>{formatProbability(flowNo)} SHORT</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill negative-fill" style:width={`${flowNo * 100}%`}></div>
          </div>
        </div>
      </div>

      <div class="case-copy">
        <div class="detail-header detail-header-tight">
          <h3>Market case</h3>
        </div>

        {#if caseParagraphs.length > 0}
          {#each caseParagraphs as paragraph}
            <p>{paragraph}</p>
          {/each}
        {:else}
          <p>No long-form case has been attached to this market yet.</p>
        {/if}
      </div>
    </article>

    <article class="detail-section">
      <div class="detail-header">
        <h3>Trading considerations</h3>
      </div>

      <div class="bullet-list">
        {#each tradeFrame as item}
          <p>{item}</p>
        {/each}
      </div>

      <div class="detail-header detail-header-spaced">
        <h3>Market signals</h3>
      </div>

      <div class="signal-list">
        {#each signalCards as card}
          <div>
            <span>{card.eyebrow}</span>
            <strong>{card.title}</strong>
            <p>{card.detail}</p>
          </div>
        {/each}
      </div>
    </article>
  </section>

  <section class="overview-grid overview-grid-reverse">
    <article class="detail-section">
      <div class="detail-header">
        <h3>Recent fills</h3>
        <a href={marketActivityUrl(market.slug)}>Full activity</a>
      </div>

      <div class="dense-list">
        {#if orderedTrades.length > 0}
          {#each orderedTrades.slice(0, 6) as trade (trade.id)}
            <div class="dense-row">
              <div>
                <strong>{trade.type === 'buy' ? 'Mint' : 'Withdraw'} · {trade.direction === 'yes' ? 'LONG' : 'SHORT'}</strong>
                <p>{formatRelativeTime(trade.createdAt)}</p>
              </div>
              <div class="dense-aside">
                <span>{formatProductAmount(trade.amount, trade.unit)} {productUnitLabel(trade.unit)}</span>
                <span>{formatProbability(trade.probability)}</span>
              </div>
            </div>
          {/each}
        {:else}
          <div class="panel-empty">No visible fills yet.</div>
        {/if}
      </div>
    </article>

    <article class="detail-section">
      <div class="detail-header">
        <h3>Discussion</h3>
        <a href={marketDiscussionUrl(market.slug)}>Open discussion</a>
      </div>

      <div class="dense-list">
        {#if discussionThreads.length > 0}
          {#each discussionThreads.slice(0, 4) as thread (thread.post.id)}
            <a class="dense-row dense-row-link" href={threadUrl(market.slug, thread.post.id)}>
              <div>
                <strong>{thread.post.subject || 'Untitled thread'}</strong>
                <p>{truncateText(thread.post.content, 120)}</p>
              </div>
              <div class="dense-aside">
                <span>{thread.replyCount} repl{thread.replyCount === 1 ? 'y' : 'ies'}</span>
                <span>{formatRelativeTime(thread.post.createdAt)}</span>
              </div>
            </a>
          {/each}
        {:else}
          <div class="panel-empty">No live discussion yet.</div>
        {/if}
      </div>
    </article>
  </section>
{/if}

{#if tab === 'discussion'}
  <section class="detail-section">
    <div class="detail-header">
      <h3>Discussion</h3>
      <span>{discussionThreads.length} threads</span>
    </div>

    <div class="dense-list">
      {#if discussionThreads.length > 0}
        {#each discussionThreads as thread (thread.post.id)}
          <a class="dense-row dense-row-link" href={threadUrl(market.slug, thread.post.id)}>
            <div>
              <strong>{thread.post.subject || 'Untitled thread'}</strong>
              <p>{truncateText(thread.post.content, 160)}</p>
              <p>by {authorLabel(thread.post.pubkey)}</p>
            </div>
            <div class="dense-aside">
              <span>{thread.replyCount} repl{thread.replyCount === 1 ? 'y' : 'ies'}</span>
              <span>{formatRelativeTime(thread.post.createdAt)}</span>
            </div>
          </a>
        {/each}
      {:else}
        <div class="panel-empty">No discussion threads yet.</div>
      {/if}
    </div>
  </section>
{/if}

{#if tab === 'charts'}
  <section class="overview-grid">
    <article class="detail-section">
      <div class="detail-header">
        <h3>Price curve</h3>
        <span>Derived from visible mint trade records</span>
      </div>

      <div class="chart-shell">
        {#if orderedTrades.length > 0}
          {#each [...orderedTrades].reverse() as trade (trade.id)}
            <div class="chart-step">
              <span>{formatRelativeTime(trade.createdAt)}</span>
              <div class="chart-line">
                <div class="chart-dot" class:negative-dot={trade.direction === 'no'}></div>
                <div class="chart-bar">
                  <div
                    class="chart-fill"
                    class:negative-fill={trade.direction === 'no'}
                    style:width={`${trade.probability * 100}%`}
                  ></div>
                </div>
              </div>
              <strong>{formatProbability(trade.probability)}</strong>
            </div>
          {/each}
        {:else}
          <div class="panel-empty">No trade history has been published for this market yet.</div>
        {/if}
      </div>
    </article>

    <article class="detail-section">
      <div class="detail-header">
        <h3>Latest execution</h3>
      </div>

      <dl class="summary-list">
        <div>
          <dt>Current LONG</dt>
          <dd>{priceCents(impliedProbability)}</dd>
        </div>
        <div>
          <dt>Current SHORT</dt>
          <dd>{priceCents(oppositeProbability)}</dd>
        </div>
        <div>
          <dt>Trade records</dt>
          <dd>{tradeSummary.tradeCount}</dd>
        </div>
        <div>
          <dt>Latest visible price</dt>
          <dd>{formatProbability(impliedProbability)}</dd>
        </div>
      </dl>
    </article>
  </section>
{/if}

{#if tab === 'activity'}
  <section class="detail-section">
    <div class="detail-header">
      <h3>Activity</h3>
      <span>Recent activity across this market</span>
    </div>

    <div class="dense-list">
      {#if activityEntries.length > 0}
        {#each activityEntries as entry (entry.id)}
          <div class="dense-row">
            <div>
              <strong>{entry.headline}</strong>
              <p>{entry.detail}</p>
            </div>
            <div class="dense-aside">
              <span>{entry.kind}</span>
              <span>{formatRelativeTime(entry.createdAt)}</span>
            </div>
          </div>
        {/each}
      {:else}
        <div class="panel-empty">No visible activity yet.</div>
      {/if}
    </div>
  </section>
{/if}

{#if relatedMarkets.length > 0}
  <section class="detail-section">
    <div class="detail-header">
      <h3>More markets</h3>
      <span>Related reading</span>
    </div>

    <div class="dense-list">
      {#each relatedMarkets as related (related.id)}
        <a class="dense-row dense-row-link" href={marketUrl(related.slug)}>
          <div>
            <strong>{related.title}</strong>
            <p>{truncateText(sanitizeMarketCopy(related.description || related.body), 120)}</p>
          </div>
          <div class="dense-aside">
            <span>{formatRelativeTime(related.createdAt)}</span>
            <span>{authorLabel(related.pubkey)}</span>
          </div>
        </a>
      {/each}
    </div>
  </section>
{/if}

<style>
  .market-shell {
    padding-top: 1rem;
  }

  .market-header {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(260px, 0.85fr);
    gap: 3rem;
    align-items: start;
  }

  .market-copy {
    display: grid;
    gap: 1rem;
  }

  .market-kicker {
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .market-copy h1 {
    font-size: clamp(2.4rem, 4.6vw, 4.2rem);
    line-height: 1;
    letter-spacing: -0.06em;
  }

  .market-copy > p {
    max-width: 38rem;
    color: var(--text-muted);
    font-size: 1.02rem;
    line-height: 1.75;
  }

  .market-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem 1rem;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .market-header-side {
    display: grid;
    gap: 1rem;
    align-content: start;
    padding-top: 0.25rem;
  }

  .market-header-price {
    display: flex;
    align-items: baseline;
    gap: 0.8rem;
  }

  .market-header-probability {
    color: var(--positive);
    font-family: var(--font-mono);
    font-size: clamp(2.8rem, 4.8vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.05em;
  }

  .market-header-side-label {
    color: rgba(52, 211, 153, 0.7);
    font-size: 0.96rem;
    letter-spacing: 0.08em;
  }

  .market-header-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 0.9rem 1rem;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .market-header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .market-tabs {
    padding-top: 1rem;
  }

  .overview-top,
  .overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
    gap: 2.5rem;
    padding-top: 2rem;
  }

  .tilt-panel,
  .detail-section,
  .summary-rail {
    display: grid;
    gap: 1.35rem;
  }

  .tilt-panel h2 {
    font-size: clamp(1.85rem, 3vw, 2.7rem);
    letter-spacing: -0.05em;
  }

  .tilt-panel p {
    max-width: 42rem;
    color: var(--text-muted);
    line-height: 1.75;
  }

  .overview-metrics {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    padding-top: 0.75rem;
  }

  .overview-metrics div {
    display: grid;
    gap: 0.35rem;
  }

  .overview-metrics span,
  .detail-header span,
  .signal-list span {
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .overview-metrics strong,
  .summary-list dd,
  .price-grid strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .price-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    padding-bottom: 0.2rem;
  }

  .price-grid div {
    display: grid;
    gap: 0.55rem;
  }

  .price-grid span {
    color: var(--text-faint);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .price-grid strong {
    font-size: clamp(2.1rem, 3vw, 3rem);
    letter-spacing: -0.05em;
  }

  .summary-list {
    display: grid;
    gap: 0;
    margin: 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .summary-list div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.95rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }

  .summary-list dt {
    color: var(--text-faint);
    font-size: 0.84rem;
  }

  .detail-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .detail-header-tight {
    padding-top: 0.4rem;
  }

  .detail-header-spaced {
    padding-top: 0.35rem;
  }

  .detail-header h3 {
    font-size: 1.1rem;
    letter-spacing: -0.03em;
  }

  .detail-header a {
    color: var(--text);
    font-size: 0.84rem;
    font-weight: 500;
  }

  .detail-header a:hover,
  .detail-header a:focus-visible {
    color: var(--text-strong);
    outline: none;
  }

  .bar-stack,
  .case-copy,
  .bullet-list,
  .signal-list,
  .dense-list {
    display: grid;
    gap: 1rem;
  }

  .bar-label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 0.45rem;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .bar-track {
    height: 0.4rem;
    background: var(--surface);
  }

  .bar-fill {
    height: 100%;
    background: var(--positive);
  }

  .positive-fill {
    background: var(--positive);
  }

  .negative-fill {
    background: var(--negative);
  }

  .case-copy {
    padding-top: 0.5rem;
  }

  .case-copy p,
  .bullet-list p,
  .signal-list p,
  .dense-row p {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.9rem;
    line-height: 1.7;
  }

  .bullet-list,
  .signal-list,
  .dense-list {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .bullet-list p,
  .signal-list > div,
  .dense-row,
  .dense-row-link {
    padding: 0.95rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }

  .signal-list > div {
    display: grid;
    gap: 0.4rem;
  }

  .signal-list strong,
  .dense-row strong {
    color: var(--text-strong);
    font-size: 0.98rem;
    font-weight: 600;
  }

  .dense-row,
  .dense-row-link {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .dense-row-link:hover,
  .dense-row-link:focus-visible {
    color: var(--text-strong);
    outline: none;
  }

  .dense-aside {
    display: grid;
    justify-items: end;
    gap: 0.3rem;
    flex: 0 0 auto;
    color: var(--text-faint);
    font-size: 0.78rem;
    text-align: right;
  }

  .overview-grid-reverse {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .chart-shell {
    display: grid;
    gap: 0.85rem;
  }

  .chart-step {
    display: grid;
    grid-template-columns: 5.5rem minmax(0, 1fr) auto;
    gap: 1rem;
    align-items: center;
  }

  .chart-step span {
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .chart-step strong {
    font-family: var(--font-mono);
    font-size: 0.9rem;
  }

  .chart-line {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .chart-dot {
    width: 0.5rem;
    height: 0.5rem;
    background: var(--positive);
    border-radius: 999px;
  }

  .negative-dot {
    background: var(--negative);
  }

  .chart-bar {
    flex: 1;
    height: 0.35rem;
    background: var(--surface);
  }

  .chart-fill {
    height: 100%;
    background: var(--positive);
  }

  .negative {
    color: var(--negative);
  }

  .positive {
    color: var(--positive);
  }

  .panel-empty {
    padding: 1rem 0;
    color: var(--text-muted);
  }

  @media (max-width: 1024px) {
    .market-header,
    .overview-top,
    .overview-grid,
    .overview-grid-reverse {
      grid-template-columns: 1fr;
    }

    .overview-metrics {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 720px) {
    .market-header-actions,
    .market-meta {
      flex-direction: column;
      align-items: flex-start;
    }

    .overview-metrics {
      grid-template-columns: 1fr;
    }

    .dense-row,
    .dense-row-link,
    .chart-step {
      grid-template-columns: 1fr;
      flex-direction: column;
    }

    .dense-aside {
      justify-items: start;
      text-align: left;
    }
  }
</style>
