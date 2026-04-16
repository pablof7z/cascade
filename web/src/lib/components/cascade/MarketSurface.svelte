<script lang="ts">
  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import type { NostrEvent } from 'nostr-tools';
  import BookmarkIcon from '$lib/components/BookmarkIcon.svelte';
  import SharePopover from '$lib/components/SharePopover.svelte';
  import PaperTradePanel from '$lib/components/cascade/PaperTradePanel.svelte';
  import { isPaperEdition } from '$lib/cascade/config';
  import { formatProductAmount } from '$lib/cascade/format';
  import TabNav from '$lib/components/cascade/TabNav.svelte';
  import {
    buildDiscussionThreads,
    buildTradeSummary,
    formatProbability,
    formatRelativeTime,
    marketActivityUrl,
    marketChartsUrl,
    marketDiscussionUrl,
    marketUrl,
    parseDiscussionEvent,
    sanitizeMarketCopy,
    threadUrl,
    truncateText,
    type DiscussionRecord,
    type MarketRecord,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';

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
  const currentUser = $derived(ndk.$currentUser);
  const myBookmarkList = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return { filters: [{ kinds: [10003], authors: [currentUser.pubkey], limit: 1 }] };
  });
  const isBookmarked = $derived.by(() => {
    const event = myBookmarkList.events[0];
    if (!event) return false;
    return event.tags.some((tag) => tag[0] === 'e' && tag[1] === market.id);
  });
  const paperEdition = isPaperEdition();
  const valueUnitLabel = 'USD';
  const discussionFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [1111], '#e': [market.id], limit: 200 }] };
  });
  const mergedDiscussions = $derived.by(() => {
    return mergeRawEvents(
      discussions.map((discussion) => discussion.rawEvent as NostrEvent),
      discussionFeed.events
    )
      .map(parseDiscussionEvent)
      .filter((discussion): discussion is DiscussionRecord => Boolean(discussion))
      .sort((left, right) => right.createdAt - left.createdAt);
  });
  const discussionThreads = $derived(buildDiscussionThreads(mergedDiscussions, market.id));
  const author = $derived(displayName(profiles[market.pubkey], 'Cascade user'));
  const tabs = $derived([
    { href: marketUrl(market.slug), label: 'Overview', active: tab === 'overview' },
    { href: marketDiscussionUrl(market.slug), label: 'Discussion', active: tab === 'discussion' },
    { href: marketChartsUrl(market.slug), label: 'Charts', active: tab === 'charts' },
    { href: marketActivityUrl(market.slug), label: 'Activity', active: tab === 'activity' }
  ]);

  const orderedTrades = $derived([...trades].sort((left, right) => right.createdAt - left.createdAt));
  const chronologicalTrades = $derived([...orderedTrades].reverse());
  const latestTrade = $derived(orderedTrades[0] ?? null);
  const earliestTrade = $derived([...trades].sort((left, right) => left.createdAt - right.createdAt)[0] ?? null);
  const impliedProbability = $derived((tradeSummary.latestPricePpm ?? 500_000) / 1_000_000);
  const oppositeProbability = $derived(1 - impliedProbability);
  const openingProbability = $derived(earliestTrade?.probability ?? 0.5);
  const visibleAccounts = $derived(new Set(trades.map((trade) => trade.pubkey)).size);
  const averageTradeSize = $derived(tradeSummary.tradeCount > 0 ? tradeSummary.grossVolume / tradeSummary.tradeCount : 0);
  const flowLong = $derived(
    tradeSummary.grossVolume > 0 ? tradeSummary.longVolume / tradeSummary.grossVolume : impliedProbability
  );
  const flowShort = $derived(1 - flowLong);
  const chartWidth = 640;
  const chartHeight = 320;
  const chartMargin = { top: 16, right: 12, bottom: 20, left: 52 };
  const chartGridLevels = [0, 0.25, 0.5, 0.75, 1];
  const chartPlotWidth = chartWidth - chartMargin.left - chartMargin.right;
  const chartPlotHeight = chartHeight - chartMargin.top - chartMargin.bottom;
  const chartStartTrade = $derived(chronologicalTrades[0] ?? null);
  const chartEndTrade = $derived(chronologicalTrades[chronologicalTrades.length - 1] ?? null);
  const chartTrendClass = $derived((chartEndTrade?.probability ?? impliedProbability) >= 0.5 ? 'positive' : 'negative');
  const chartPoints = $derived.by(() => {
    if (chronologicalTrades.length === 0) {
      return [];
    }

    const startTime = chartStartTrade?.createdAt ?? 0;
    const endTime = chartEndTrade?.createdAt ?? startTime;
    const timeSpan = endTime - startTime;

    return chronologicalTrades.map((trade, index) => {
      const fallbackRatio = chronologicalTrades.length === 1 ? 0.5 : index / (chronologicalTrades.length - 1);
      const timeRatio = timeSpan === 0 ? fallbackRatio : (trade.createdAt - startTime) / timeSpan;
      const x = chartMargin.left + timeRatio * chartPlotWidth;
      const y = chartMargin.top + (1 - trade.probability) * chartPlotHeight;

      return {
        id: trade.id,
        x: Number(x.toFixed(2)),
        y: Number(y.toFixed(2))
      };
    });
  });
  const chartPolylinePoints = $derived(chartPoints.map((point) => `${point.x},${point.y}`).join(' '));

  const bodyParagraphs = $derived(
    (market.body ?? '')
      .split(/\n+/)
      .map((chunk) => sanitizeMarketCopy(chunk.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim()))
      .filter(Boolean)
  );
  const tradingContext = $derived(
    bodyParagraphs
      .map((chunk) => chunk.match(/^(?:trading context|market context|market criteria):\s*(.+)$/i)?.[1]?.trim())
      .filter((chunk): chunk is string => Boolean(chunk))
  );
  const caseParagraphs = $derived(
    bodyParagraphs
      .filter((chunk) => !/^(trading context|market context|market criteria):/i.test(chunk))
  );

  const activityEntries = $derived.by(() => {
    return [
      ...trades.map((trade) => ({
        id: trade.id,
        kind: 'trade' as const,
        createdAt: trade.createdAt,
        headline: `${trade.type === 'buy' ? 'Bought' : 'Sold'} ${trade.direction === 'long' ? 'LONG' : 'SHORT'}`,
        detail: `${formatProductAmount(trade.amount, 'usd')} at ${formatProbability(trade.probability)}`
      })),
      ...mergedDiscussions.map((discussion) => ({
        id: discussion.id,
        kind: 'discussion' as const,
        createdAt: discussion.createdAt,
        headline: discussion.subject || 'Discussion update',
        detail: truncateText(discussion.content, 120)
      }))
    ].sort((left, right) => right.createdAt - left.createdAt);
  });

  const marketState = $derived.by(() => {
    const priceLabel = priceCents(impliedProbability);
    const accentClass = impliedProbability >= 0.5 ? 'positive' : 'negative';

    // Simple data: just price and volume split
    const longPct = Math.round(flowLong * 100);
    const shortPct = Math.round(flowShort * 100);
    const summary = `${longPct}% LONG • ${shortPct}% SHORT`;

    return { label: priceLabel, summary, accentClass };
  });

  const recentSignals = $derived.by(() => {
    // Latest trade - just the data
    const latestFlow = latestTrade
      ? `${latestTrade.direction.toUpperCase()} ${latestTrade.type} ${formatProductAmount(latestTrade.amount, 'usd')} • ${formatRelativeTime(latestTrade.createdAt)}`
      : 'No trades yet';

    // Volume split - just percentages
    const volumeSplit = `${Math.round(flowLong * 100)}% LONG • ${Math.round(flowShort * 100)}% SHORT`;

    // Discussion - just counts
    const totalReplies = discussionThreads.reduce((sum, t) => sum + t.replyCount, 0);
    const discussionActivity = discussionThreads.length > 0
      ? `${discussionThreads.length} thread${discussionThreads.length === 1 ? '' : 's'} • ${totalReplies} repl${totalReplies === 1 ? 'y' : 'ies'}`
      : 'No discussion yet';

    return [latestFlow, volumeSplit, discussionActivity];
  });

  function authorLabel(pubkey: string): string {
    return displayName(profiles[pubkey], 'Cascade user');
  }

  function mergeRawEvents(seed: NostrEvent[], live: NDKEvent[]): NostrEvent[] {
    const map = new Map<string, NostrEvent>();
    for (const event of live) {
      const raw = event.rawEvent() as NostrEvent;
      if (raw.id) map.set(raw.id, raw);
    }
    for (const event of seed) {
      if (event.id && !map.has(event.id)) map.set(event.id, event);
    }
    return [...map.values()];
  }

  function priceCents(probability: number): string {
    return `${Math.round(probability * 100)}¢`;
  }

  function chartLevelY(level: number): number {
    return Number((chartMargin.top + (1 - level) * chartPlotHeight).toFixed(2));
  }

  let composeSubject = $state('');
  let composeBody = $state('');
  let composeSubmitting = $state(false);
  let composeError = $state('');

  async function postThread() {
    if (!composeBody.trim()) return;
    composeSubmitting = true;
    composeError = '';
    try {
      const event = new NDKEvent(ndk);
      event.kind = 1111;
      event.content = composeBody.trim();
      const tags: string[][] = [
        ['E', market.id, '', 'root'],
        ['K', '982'],
        ['e', market.id, '', 'root'],
        ['k', '982']
      ];
      if (composeSubject.trim()) {
        tags.push(['subject', composeSubject.trim()]);
      }
      event.tags = tags;
      await event.publish();
      composeSubject = '';
      composeBody = '';
      await invalidateAll();
    } catch (err) {
      composeError = err instanceof Error ? err.message : 'Failed to publish. Please try again.';
    } finally {
      composeSubmitting = false;
    }
  }

  async function toggleBookmark() {
    if (!currentUser) return;
    const existing = myBookmarkList.events[0];
    const updated = new NDKEvent(ndk);
    updated.kind = 10003;

    if (existing) {
      if (isBookmarked) {
        updated.tags = existing.tags.filter((tag) => !(tag[0] === 'e' && tag[1] === market.id));
      } else {
        updated.tags = [...existing.tags, ['e', market.id]];
      }
    } else {
      updated.tags = [['e', market.id]];
    }

    await updated.publish();
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

      <div class="market-header-actions">
        <SharePopover url={$page.url.href} title={market.title} />
        {#if currentUser}
          <button
            class="market-bookmark-button"
            class:bookmarked={isBookmarked}
            title={isBookmarked ? 'Remove bookmark' : 'Save market'}
            type="button"
            onclick={toggleBookmark}
          >
            <BookmarkIcon size={14} filled={isBookmarked} />
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
        {/if}
      </div>
    </div>

    <div class="market-header-side">
      <div class="market-header-price">
        <span class="market-header-probability">{priceCents(impliedProbability)}</span>
        <span class="market-header-side-label">LONG</span>
      </div>

      <div class="market-header-stats">
        <span>{formatProductAmount(tradeSummary.grossVolume, 'usd')} vol</span>
        <span>{tradeSummary.tradeCount} trades</span>
        <span>{discussionThreads.length} threads</span>
      </div>

    </div>
  </div>
</section>

<section class="market-tabs">
  <TabNav items={tabs} />
</section>

{#if tab === 'overview'}
  <!-- MARKET CONTEXT -->
  <section class="market-context">
    <p class="market-state-summary">
      <strong class={marketState.accentClass}>{marketState.label}</strong> • {marketState.summary}
    </p>

    <div class="overview-metrics">
      <div>
        <span>Price move since open</span>
        <strong class:positive={impliedProbability - openingProbability >= 0} class:negative={impliedProbability - openingProbability < 0}>
          {impliedProbability - openingProbability >= 0 ? '+' : ''}{((impliedProbability - openingProbability) * 100).toFixed(1)}¢
        </strong>
      </div>
      <div>
        <span>Traders</span>
        <strong>{visibleAccounts}</strong>
      </div>
      <div>
        <span>Average size</span>
        <strong>{formatProductAmount(Math.round(averageTradeSize), 'usd')} {valueUnitLabel}</strong>
      </div>
      <div>
        <span>Discussion</span>
        <strong>{discussionThreads.length} threads</strong>
      </div>
    </div>

    <div class="bar-stack">
      <div>
        <div class="bar-label">
          <span>LONG share</span>
          <span>{formatProbability(flowLong)} LONG</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill positive-fill" style:width={`${flowLong * 100}%`}></div>
        </div>
      </div>

      <div>
        <div class="bar-label">
          <span>SHORT share</span>
          <span>{formatProbability(flowShort)} SHORT</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill negative-fill" style:width={`${flowShort * 100}%`}></div>
        </div>
      </div>
    </div>
  </section>

  <!-- MARKET BODY -->
  <section class="market-body">
    <article class="detail-section">
      <div class="detail-header">
        <h3>The case</h3>
      </div>

      <div class="case-copy">
        {#if caseParagraphs.length > 0}
          {#each caseParagraphs as paragraph}
            <p>{paragraph}</p>
          {/each}
        {:else}
          <p>No written case yet.</p>
        {/if}
      </div>

      {#if tradingContext.length > 0}
        <div class="detail-header detail-header-tight">
          <h3>Trading context</h3>
        </div>

        <div class="case-copy">
          {#each tradingContext as criteria}
            <p>{criteria}</p>
          {/each}
        </div>
      {/if}

      <div class="detail-header detail-header-spaced">
        <h3>Market signals</h3>
      </div>

      <div class="signal-list">
        {#each recentSignals as signal}
          <p>{signal}</p>
        {/each}
      </div>
    </article>

    <article class="detail-section">
      <div class="detail-header">
        <h3>Recent activity</h3>
      </div>

      <div class="dense-list">
        {#if activityEntries.length > 0}
          {#each activityEntries.slice(0, 8) as entry (entry.id)}
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
          <div class="panel-empty">No activity yet.</div>
        {/if}
      </div>
    </article>
  </section>

  <!-- MARKET TRADING -->
  <section class="market-trading">
    <div class="detail-header">
      <h2>Take a position</h2>
      <span>Mint LONG or SHORT</span>
    </div>

    <div class="price-grid">
      <div>
        <span>LONG</span>
        <strong class="positive">{priceCents(impliedProbability)}</strong>
      </div>
      <div>
        <span>SHORT</span>
        <strong class="negative">{priceCents(oppositeProbability)}</strong>
      </div>
    </div>

    {#if paperEdition}
      <PaperTradePanel
        marketId={market.id}
        marketSlug={market.slug}
        yesProbability={impliedProbability}
        noProbability={oppositeProbability}
      />
    {:else if currentUser}
      <a class="btn btn-primary w-fit" href="/portfolio">Add funds to trade</a>
      <a href={marketActivityUrl(market.slug)}>See all trades on this market →</a>
      <p class="trade-focus-copy"><small>Add funds to your portfolio to take a position.</small></p>
    {:else}
      <a class="btn btn-primary w-fit" href="/join?from=/market/{market.slug}">Take a position</a>
    {/if}

    <dl class="summary-list">
      <div>
        <dt>Volume</dt>
        <dd>{formatProductAmount(tradeSummary.grossVolume, 'usd')} {valueUnitLabel}</dd>
      </div>
      <div>
        <dt>LONG flow</dt>
        <dd>{formatProductAmount(tradeSummary.longVolume, 'usd')} {valueUnitLabel}</dd>
      </div>
      <div>
        <dt>SHORT flow</dt>
        <dd>{formatProductAmount(tradeSummary.shortVolume, 'usd')} {valueUnitLabel}</dd>
      </div>
      <div>
        <dt>Last trade</dt>
        <dd>
          {#if latestTrade}
            {latestTrade.direction === 'long' ? 'LONG' : 'SHORT'} {latestTrade.type === 'buy' ? 'Buy' : 'Sell'}
          {:else}
            None
          {/if}
        </dd>
      </div>
    </dl>
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
              <span>{formatRelativeTime(thread.lastActivityAt)}</span>
            </div>
          </a>
        {/each}
      {:else}
        {#if currentUser}
          <div class="discussion-empty-state">
            <p class="discussion-empty-prompt">No threads yet — be first to make a case.</p>
          </div>
        {:else}
          <div class="discussion-empty-state">
            <p class="discussion-empty-prompt">No threads yet.</p>
            <p class="discussion-empty-detail">
              Discussion is where traders put their reasoning on record — the argument behind the bet.
              <a href="/join?from=/market/{market.slug}/discussion">Sign in</a>
              to start one.
            </p>
          </div>
        {/if}
      {/if}
    </div>

    {#if currentUser}
      <div class="compose-area">
        <input
          class="input input-bordered compose-subject"
          type="text"
          placeholder="Subject (optional)"
          bind:value={composeSubject}
          disabled={composeSubmitting}
        />
        <textarea
          class="textarea textarea-bordered compose-body"
          rows={4}
          placeholder="Start a thread…"
          bind:value={composeBody}
          disabled={composeSubmitting}
        ></textarea>
        {#if composeError}
          <p class="compose-error">{composeError}</p>
        {/if}
        <div class="compose-actions">
          <button class="btn btn-primary" onclick={postThread} disabled={composeSubmitting || !composeBody.trim()}>
            {composeSubmitting ? 'Posting…' : 'Post thread'}
          </button>
        </div>
      </div>
    {:else}
      <p class="compose-signin">
        <a href="/join?from=/market/{market.slug}/discussion">Sign in</a> to join the discussion.
      </p>
    {/if}
  </section>
{/if}

{#if tab === 'charts'}
  <section class="overview-grid">
    <article class="detail-section">
      <div class="detail-header">
        <h3>Price curve</h3>
        <span>Based on public trade history</span>
      </div>

      {#if chronologicalTrades.length > 0}
        <div class="price-chart">
          <svg
            class="price-chart-svg"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Probability over time based on public trade history"
          >
            {#each chartGridLevels as level (level)}
              {@const y = chartLevelY(level)}
              <line
                class="price-chart-gridline"
                x1={chartMargin.left}
                x2={chartWidth - chartMargin.right}
                y1={y}
                y2={y}
              ></line>
              <text class="price-chart-axis-label" x={chartMargin.left - 10} y={y + 4} text-anchor="end">
                {formatProbability(level)}
              </text>
            {/each}

            <polyline
              class={`price-chart-line ${chartTrendClass}`}
              fill="none"
              points={chartPolylinePoints}
            ></polyline>

            {#each chartPoints as point (point.id)}
              <circle class={`price-chart-point ${chartTrendClass}`} cx={point.x} cy={point.y} r="3.5"></circle>
            {/each}
          </svg>

          <div class="price-chart-timestamps">
            <span>{formatRelativeTime(chartStartTrade.createdAt)}</span>
            <span>{formatRelativeTime(chartEndTrade.createdAt)}</span>
          </div>
        </div>
        {:else}
          <div class="panel-empty">No trade history has been published for this market yet.</div>
      {/if}
    </article>

    <article class="detail-section">
      <div class="detail-header">
        <h3>Last executed trade</h3>
      </div>

      {#if latestTrade}
        <dl class="summary-list">
          <div>
            <dt>Direction</dt>
            <dd>{latestTrade.direction === 'long' ? 'LONG' : 'SHORT'} {latestTrade.type === 'buy' ? 'Buy' : 'Sell'}</dd>
          </div>
          <div>
            <dt>Price</dt>
            <dd>{priceCents(latestTrade.probability)}</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>{formatProductAmount(latestTrade.amount, 'usd')} {valueUnitLabel}</dd>
          </div>
          <div>
            <dt>When</dt>
            <dd>{formatRelativeTime(latestTrade.createdAt)}</dd>
          </div>
        </dl>
      {:else}
        <div class="panel-empty">No trades yet.</div>
      {/if}
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
            <span class="positive">{priceCents((related.latestPricePpm ?? 500_000) / 1_000_000)} LONG</span>
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
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
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
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 1.02rem;
    line-height: 1.75;
  }

  .market-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem 1rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
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
    color: var(--color-success);
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
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.82rem;
  }

  .market-header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .market-bookmark-button {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid rgba(38, 38, 38, 0.8);
    background: transparent;
    color: color-mix(in srgb, var(--color-neutral-content) 68%, transparent);
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: color 140ms ease, border-color 140ms ease, background-color 140ms ease;
  }

  .market-bookmark-button:hover,
  .market-bookmark-button:focus-visible {
    color: white;
    border-color: color-mix(in srgb, white 18%, transparent);
    background: color-mix(in srgb, white 4%, transparent);
    outline: none;
  }

  .market-bookmark-button.bookmarked {
    color: white;
    border-color: color-mix(in srgb, white 16%, transparent);
    background: color-mix(in srgb, white 7%, transparent);
  }

  .market-tabs {
    padding-top: 1rem;
  }

  .market-context {
    max-width: 48rem;
    margin: 0 auto;
    padding-top: 2rem;
  }

  .market-state-summary {
    margin: 0 0 1.5rem;
    color: color-mix(in srgb, var(--color-neutral-content) 88%, transparent);
    font-size: 1.05rem;
    line-height: 1.7;
  }

  .market-body {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(320px, 0.8fr);
    gap: 2.5rem;
    padding-top: 2rem;
  }

  .market-trading {
    max-width: 40rem;
    margin: 2rem auto 0;
    padding: 2rem;
    border: 1px solid rgba(38, 38, 38, 0.8);
    background: var(--color-base-200);
  }

  .detail-section {
    display: grid;
    gap: 1.35rem;
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
  .detail-header span {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.78rem;
  }

  .overview-metrics strong,
  .summary-list dd,
  .price-grid strong {
    color: white;
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
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
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
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
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

  .trade-focus-copy {
    margin: 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.75;
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
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.82rem;
  }

  .bar-track {
    height: 0.4rem;
    background: var(--color-base-200);
  }

  .bar-fill {
    height: 100%;
    background: var(--color-success);
  }

  .positive-fill {
    background: var(--color-success);
  }

  .negative-fill {
    background: var(--color-error);
  }

  .case-copy {
    padding-top: 0.5rem;
  }

  .case-copy p,
  .signal-list p,
  .dense-row p {
    margin: 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.9rem;
    line-height: 1.7;
  }

  .signal-list,
  .dense-list {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .dense-row,
  .dense-row-link {
    padding: 0.95rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }

  .signal-list p {
    margin: 0;
    padding: 0.95rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.92rem;
    line-height: 1.65;
  }

  .dense-row strong {
    color: white;
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
    color: white;
    outline: none;
  }

  .dense-aside {
    display: grid;
    justify-items: end;
    gap: 0.3rem;
    flex: 0 0 auto;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.78rem;
    text-align: right;
  }


  .price-chart {
    display: grid;
    gap: 0.85rem;
  }

  .price-chart-svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }

  .price-chart-gridline {
    stroke: color-mix(in srgb, var(--color-neutral-content) 16%, transparent);
    stroke-width: 1;
    shape-rendering: crispEdges;
  }

  .price-chart-axis-label {
    fill: color-mix(in srgb, var(--color-neutral-content) 64%, transparent);
    font-family: var(--font-mono);
    font-size: 11px;
  }

  .price-chart-line {
    stroke: currentColor;
    stroke-width: 2.5;
    stroke-linecap: square;
    stroke-linejoin: miter;
    vector-effect: non-scaling-stroke;
  }

  .price-chart-point {
    fill: currentColor;
    stroke: var(--color-base-100);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .price-chart-timestamps {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.78rem;
    font-family: var(--font-mono);
  }

  .negative {
    color: var(--color-error);
  }

  .positive {
    color: var(--color-success);
  }

  .panel-empty {
    padding: 1rem 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .discussion-empty-state {
    padding: 1rem 0;
  }

  .discussion-empty-prompt {
    margin: 0 0 0.25rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.9rem;
  }

  .discussion-empty-detail {
    margin: 0;
    color: color-mix(in srgb, var(--color-neutral-content) 60%, transparent);
    font-size: 0.85rem;
  }

  @media (max-width: 1024px) {
    .market-header,
    .market-body {
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
    .dense-row-link {
      grid-template-columns: 1fr;
      flex-direction: column;
    }

    .dense-aside {
      justify-items: start;
      text-align: left;
    }
  }

  .compose-area {
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    padding-top: 1rem;
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .compose-subject,
  .compose-body {
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    border-radius: 2px;
    background: var(--color-base-200);
    color: var(--color-base-content);
    font-family: inherit;
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    box-sizing: border-box;
    resize: vertical;
  }

  .compose-subject:focus,
  .compose-body:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .compose-actions {
    display: flex;
    justify-content: flex-end;
  }

  .compose-error {
    color: var(--color-error);
    font-size: 0.85rem;
    margin: 0;
  }

  .compose-signin {
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    padding-top: 1rem;
    margin-top: 0.5rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.875rem;
  }
</style>
