<script lang="ts">
  import { browser } from '$app/environment';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/state';
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import type { NostrEvent } from 'nostr-tools';
  import BookmarkIcon from '$lib/components/BookmarkIcon.svelte';
  import SharePopover from '$lib/components/SharePopover.svelte';
  import PaperTradePanel from '$lib/components/cascade/PaperTradePanel.svelte';
  import { getCascadeEdition, isPaperEdition } from '$lib/cascade/config';
  import { formatProductAmount } from '$lib/cascade/format';
  import TabNav from '$lib/components/cascade/TabNav.svelte';
  import {
    buildDiscussionThreads,
    buildTradeSummary,
    formatProbability,
    formatRelativeTime,
    getCascadeEventKinds,
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
  const selectedEdition = $derived(getCascadeEdition(page.data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const myBookmarkList = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return { filters: [{ kinds: [10003], authors: [currentUser.pubkey], limit: 1 }] };
  });
  const isBookmarked = $derived.by(() => {
    const event = myBookmarkList.events[0];
    if (!event) return false;
    return event.tags.some((tag) => tag[0] === 'e' && tag[1] === market.id);
  });
  const paperEdition = $derived(isPaperEdition(selectedEdition));
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
      .map((event) => parseDiscussionEvent(event, selectedEdition))
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
  const chartTrendClass = $derived((chartEndTrade?.probability ?? impliedProbability) >= 0.5 ? 'text-success' : 'text-error');
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
    const accentClass = impliedProbability >= 0.5 ? 'text-success' : 'text-error';

    const longPct = Math.round(flowLong * 100);
    const shortPct = Math.round(flowShort * 100);
    const summary = `${longPct}% LONG • ${shortPct}% SHORT`;

    return { label: priceLabel, summary, accentClass };
  });

  const recentSignals = $derived.by(() => {
    const latestFlow = latestTrade
      ? `${latestTrade.direction.toUpperCase()} ${latestTrade.type} ${formatProductAmount(latestTrade.amount, 'usd')} • ${formatRelativeTime(latestTrade.createdAt)}`
      : 'No trades yet';

    const volumeSplit = `${Math.round(flowLong * 100)}% LONG • ${Math.round(flowShort * 100)}% SHORT`;

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
      const marketKind = String(eventKinds.market);
      const tags: string[][] = [
        ['E', market.id, '', 'root'],
        ['K', marketKind],
        ['e', market.id, '', 'root'],
        ['k', marketKind]
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

<!-- Market header -->
<section class="pt-4">
  <header class="grid gap-4 pb-6 border-b border-base-300 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
    <div class="flex flex-col gap-4 max-w-prose">
      <div class="eyebrow">Market</div>
      <h1 class="text-3xl sm:text-5xl font-bold tracking-tight leading-none">{market.title}</h1>
      <p class="text-base-content/70 text-base leading-relaxed max-w-xl">
        {sanitizeMarketCopy(market.description) || 'No summary provided yet.'}
      </p>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/50">
        <span>by {author}</span>
        <span>{formatRelativeTime(market.createdAt)}</span>
        {#if market.categories.length > 0}
          <span>{market.categories.join(', ')}</span>
        {/if}
      </div>

      <div class="flex items-center gap-3 flex-wrap">
        <SharePopover url={page.url.href} title={market.title} />
        {#if currentUser}
          <button
            class="btn btn-ghost btn-sm gap-2"
            class:btn-outline={isBookmarked}
            aria-label={isBookmarked ? 'Remove bookmark' : 'Save market'}
            type="button"
            onclick={toggleBookmark}
          >
            <BookmarkIcon size={14} filled={isBookmarked} />
            <span>{isBookmarked ? 'Saved' : 'Save'}</span>
          </button>
        {/if}
      </div>
    </div>

    <div class="grid gap-4 content-start pt-1">
      <div class="flex items-baseline gap-3">
        <span class="font-mono text-success text-5xl font-bold tracking-tight">{priceCents(impliedProbability)}</span>
        <span class="text-success/70 text-base tracking-wide">LONG</span>
      </div>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-base-content/50">
        <span>{formatProductAmount(tradeSummary.grossVolume, 'usd')} vol</span>
        <span>{tradeSummary.tradeCount} trades</span>
        <span>{discussionThreads.length} threads</span>
      </div>
    </div>
  </header>
</section>

<section class="pt-4">
  <TabNav items={tabs} />
</section>

{#if tab === 'overview'}
  <!-- Market context -->
  <section class="max-w-3xl mx-auto pt-8">
    <p class="text-base-content/80 text-base leading-relaxed mb-6">
      <strong class={marketState.accentClass}>{marketState.label}</strong> • {marketState.summary}
    </p>

    <div class="stats stats-vertical sm:stats-horizontal w-full bg-base-200 mb-6">
      <div class="stat">
        <div class="stat-title">Price change</div>
        <div class="stat-value text-lg font-mono" class:text-success={impliedProbability - openingProbability >= 0} class:text-error={impliedProbability - openingProbability < 0}>
          {impliedProbability - openingProbability >= 0 ? '+' : ''}{((impliedProbability - openingProbability) * 100).toFixed(1)}¢
        </div>
        <div class="stat-desc">Since open</div>
      </div>
      <div class="stat">
        <div class="stat-title">Traders</div>
        <div class="stat-value text-lg font-mono">{visibleAccounts}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Avg size</div>
        <div class="stat-value text-lg font-mono">{formatProductAmount(Math.round(averageTradeSize), 'usd')}</div>
        <div class="stat-desc">{valueUnitLabel}</div>
      </div>
      <div class="stat">
        <div class="stat-title">Discussion</div>
        <div class="stat-value text-lg font-mono">{discussionThreads.length}</div>
        <div class="stat-desc">threads</div>
      </div>
    </div>

    <div class="grid gap-4">
      <div>
        <div class="flex items-center justify-between gap-4 mb-2 text-sm text-base-content/50">
          <span>LONG share</span>
          <span>{formatProbability(flowLong)} LONG</span>
        </div>
        <div class="h-1.5 rounded-full bg-base-300">
          <div class="h-full rounded-full bg-success" style:width={`${flowLong * 100}%`}></div>
        </div>
      </div>

      <div>
        <div class="flex items-center justify-between gap-4 mb-2 text-sm text-base-content/50">
          <span>SHORT share</span>
          <span>{formatProbability(flowShort)} SHORT</span>
        </div>
        <div class="h-1.5 rounded-full bg-base-300">
          <div class="h-full rounded-full bg-error" style:width={`${flowShort * 100}%`}></div>
        </div>
      </div>
    </div>
  </section>

  <!-- Trading section -->
  <section class="max-w-xl mx-auto mt-8 card card-border bg-base-200">
    <div class="card-body gap-4">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="card-title">Take a position</h2>
        <span class="text-sm text-base-content/50">Mint LONG or SHORT</span>
      </div>

      <div class="grid grid-cols-2 gap-5">
        <div class="grid gap-2">
          <span class="text-xs font-semibold tracking-widest uppercase text-base-content/50">LONG</span>
          <strong class="text-success font-mono text-3xl font-bold tracking-tight">{priceCents(impliedProbability)}</strong>
        </div>
        <div class="grid gap-2">
          <span class="text-xs font-semibold tracking-widest uppercase text-base-content/50">SHORT</span>
          <strong class="text-error font-mono text-3xl font-bold tracking-tight">{priceCents(oppositeProbability)}</strong>
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
        <a href={marketActivityUrl(market.slug)} class="text-sm text-base-content/60">See all trades on this market →</a>
        <p class="text-sm text-base-content/60">Add funds to your portfolio to take a position.</p>
      {:else}
        <a class="btn btn-primary w-fit" href="/join?from=/market/{market.slug}">Take a position</a>
      {/if}

      <dl class="grid gap-0 border-t border-base-300 mt-2">
        <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
          <dt class="text-sm text-base-content/50">Volume</dt>
          <dd class="font-mono text-sm">{formatProductAmount(tradeSummary.grossVolume, 'usd')} {valueUnitLabel}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
          <dt class="text-sm text-base-content/50">LONG flow</dt>
          <dd class="font-mono text-sm">{formatProductAmount(tradeSummary.longVolume, 'usd')} {valueUnitLabel}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
          <dt class="text-sm text-base-content/50">SHORT flow</dt>
          <dd class="font-mono text-sm">{formatProductAmount(tradeSummary.shortVolume, 'usd')} {valueUnitLabel}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
          <dt class="text-sm text-base-content/50">Last trade</dt>
          <dd class="font-mono text-sm">
            {#if latestTrade}
              {latestTrade.direction === 'long' ? 'LONG' : 'SHORT'} {latestTrade.type === 'buy' ? 'Buy' : 'Sell'}
            {:else}
              None
            {/if}
          </dd>
        </div>
      </dl>
    </div>
  </section>

  <!-- Market body -->
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
    <article class="grid gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-lg font-semibold tracking-tight">Market case</h3>
      </div>

      <div class="grid gap-4 pt-2">
        {#if caseParagraphs.length > 0}
          {#each caseParagraphs as paragraph}
            <p class="text-sm text-base-content/70 leading-relaxed">{paragraph}</p>
          {/each}
        {:else}
          <p class="text-sm text-base-content/70">No written case yet.</p>
        {/if}
      </div>

      {#if tradingContext.length > 0}
        <div class="flex items-baseline justify-between gap-4 pt-1">
          <h3 class="text-lg font-semibold tracking-tight">Trading context</h3>
        </div>

        <div class="grid gap-4">
          {#each tradingContext as criteria}
            <p class="text-sm text-base-content/70 leading-relaxed">{criteria}</p>
          {/each}
        </div>
      {/if}

      <div class="flex items-baseline justify-between gap-4 pt-1">
        <h3 class="text-lg font-semibold tracking-tight">Market signals</h3>
      </div>

      <div class="grid gap-0 border-t border-base-300">
        {#each recentSignals as signal}
          <p class="py-3 border-b border-base-300 text-sm text-base-content/70 leading-relaxed">{signal}</p>
        {/each}
      </div>
    </article>

    <article class="grid gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-lg font-semibold tracking-tight">Recent activity</h3>
      </div>

      <div class="grid gap-0 border-t border-base-300">
        {#if activityEntries.length > 0}
          {#each activityEntries.slice(0, 8) as entry (entry.id)}
            <div class="flex items-start justify-between gap-4 py-3 border-b border-base-300">
              <div>
                <strong class="text-sm font-semibold">{entry.headline}</strong>
                <p class="text-sm text-base-content/60 mt-0.5">{entry.detail}</p>
              </div>
              <div class="grid justify-items-end gap-1 flex-none text-xs text-base-content/50">
                <span>{entry.kind}</span>
                <span>{formatRelativeTime(entry.createdAt)}</span>
              </div>
            </div>
          {/each}
        {:else}
          <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No activity yet.</div>
        {/if}
      </div>
    </article>
  </section>
{/if}

{#if tab === 'discussion'}
  <section class="grid gap-5">
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="text-lg font-semibold tracking-tight">Discussion</h3>
      <span class="text-sm text-base-content/50">{discussionThreads.length} threads</span>
    </div>

    <div class="grid gap-0 border-t border-base-300">
      {#if discussionThreads.length > 0}
        {#each discussionThreads as thread (thread.post.id)}
          <a class="flex items-start justify-between gap-4 py-3 border-b border-base-300 hover:text-base-content" href={threadUrl(market.slug, thread.post.id)}>
            <div>
              <strong class="text-sm font-semibold">{thread.post.subject || 'Untitled thread'}</strong>
              <p class="text-sm text-base-content/60 mt-0.5">{truncateText(thread.post.content, 160)}</p>
              <p class="text-xs text-base-content/40 mt-1">by {authorLabel(thread.post.pubkey)}</p>
            </div>
            <div class="grid justify-items-end gap-1 flex-none text-xs text-base-content/50">
              <span>{thread.replyCount} repl{thread.replyCount === 1 ? 'y' : 'ies'}</span>
              <span>{formatRelativeTime(thread.lastActivityAt)}</span>
            </div>
          </a>
        {/each}
      {:else}
        {#if currentUser}
          <div class="py-4">
            <p class="text-sm text-base-content/70">No threads yet — be first to make a case.</p>
          </div>
        {:else}
          <div class="py-4 grid gap-2">
            <p class="text-sm text-base-content/70">No threads yet.</p>
            <p class="text-sm text-base-content/50">
              Discussion is where traders put their reasoning on record — the argument behind the bet.
              <a href="/join?from=/market/{market.slug}/discussion" class="text-primary">Sign in</a>
              to start one.
            </p>
          </div>
        {/if}
      {/if}
    </div>

    {#if currentUser}
      <div class="grid gap-3 border-t border-base-300 pt-4 mt-2">
        <input
          class="input input-bordered w-full"
          type="text"
          placeholder="Subject (optional)"
          bind:value={composeSubject}
          disabled={composeSubmitting}
        />
        <textarea
          class="textarea textarea-bordered w-full"
          rows={4}
          placeholder="Start a thread…"
          bind:value={composeBody}
          disabled={composeSubmitting}
        ></textarea>
        {#if composeError}
          <p class="text-error text-sm">{composeError}</p>
        {/if}
        <div class="flex justify-end">
          <button class="btn btn-primary" onclick={postThread} disabled={composeSubmitting || !composeBody.trim()}>
            {composeSubmitting ? 'Posting…' : 'Post thread'}
          </button>
        </div>
      </div>
    {:else}
      <p class="border-t border-base-300 pt-4 mt-2 text-sm text-base-content/70">
        <a href="/join?from=/market/{market.slug}/discussion" class="text-primary">Sign in</a> to join the discussion.
      </p>
    {/if}
  </section>
{/if}

{#if tab === 'charts'}
  <section class="grid gap-8 lg:grid-cols-2">
    <article class="grid gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-lg font-semibold tracking-tight">Price curve</h3>
        <span class="text-sm text-base-content/50">Based on public trade history</span>
      </div>

      {#if chronologicalTrades.length > 0}
        <div class="grid gap-3">
          <svg
            class="w-full h-auto block overflow-visible"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Probability over time based on public trade history"
          >
            {#each chartGridLevels as level (level)}
              {@const y = chartLevelY(level)}
              <line
                stroke="currentColor"
                stroke-opacity="0.16"
                stroke-width="1"
                shape-rendering="crispEdges"
                x1={chartMargin.left}
                x2={chartWidth - chartMargin.right}
                y1={y}
                y2={y}
              ></line>
              <text
                fill="currentColor"
                fill-opacity="0.64"
                font-family="var(--font-mono)"
                font-size="11"
                x={chartMargin.left - 10}
                y={y + 4}
                text-anchor="end"
              >
                {formatProbability(level)}
              </text>
            {/each}

            <polyline
              class={chartTrendClass}
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="square"
              stroke-linejoin="miter"
              vector-effect="non-scaling-stroke"
              points={chartPolylinePoints}
            ></polyline>

            {#each chartPoints as point (point.id)}
              <circle
                class={chartTrendClass}
                fill="currentColor"
                stroke="var(--color-base-100)"
                stroke-width="1.5"
                vector-effect="non-scaling-stroke"
                cx={point.x}
                cy={point.y}
                r="3.5"
              ></circle>
            {/each}
          </svg>

          <div class="flex justify-between gap-4 text-xs text-base-content/50 font-mono">
            <span>{formatRelativeTime(chartStartTrade.createdAt)}</span>
            <span>{formatRelativeTime(chartEndTrade.createdAt)}</span>
          </div>
        </div>
      {:else}
        <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">
          No trade history has been published for this market yet.
        </div>
      {/if}
    </article>

    <article class="grid gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="text-lg font-semibold tracking-tight">Last executed trade</h3>
      </div>

      {#if latestTrade}
        <dl class="grid gap-0 border-t border-base-300">
          <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
            <dt class="text-sm text-base-content/50">Direction</dt>
            <dd class="font-mono text-sm">{latestTrade.direction === 'long' ? 'LONG' : 'SHORT'} {latestTrade.type === 'buy' ? 'Buy' : 'Sell'}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
            <dt class="text-sm text-base-content/50">Price</dt>
            <dd class="font-mono text-sm">{priceCents(latestTrade.probability)}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
            <dt class="text-sm text-base-content/50">Size</dt>
            <dd class="font-mono text-sm">{formatProductAmount(latestTrade.amount, 'usd')} {valueUnitLabel}</dd>
          </div>
          <div class="flex items-center justify-between gap-4 py-3 border-b border-base-300">
            <dt class="text-sm text-base-content/50">When</dt>
            <dd class="font-mono text-sm">{formatRelativeTime(latestTrade.createdAt)}</dd>
          </div>
        </dl>
      {:else}
        <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No trades yet.</div>
      {/if}
    </article>
  </section>
{/if}

{#if tab === 'activity'}
  <section class="grid gap-5">
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="text-lg font-semibold tracking-tight">Activity</h3>
      <span class="text-sm text-base-content/50">Recent activity across this market</span>
    </div>

    <div class="grid gap-0 border-t border-base-300">
      {#if activityEntries.length > 0}
        {#each activityEntries as entry (entry.id)}
          <div class="flex items-start justify-between gap-4 py-3 border-b border-base-300">
            <div>
              <strong class="text-sm font-semibold">{entry.headline}</strong>
              <p class="text-sm text-base-content/60 mt-0.5">{entry.detail}</p>
            </div>
            <div class="grid justify-items-end gap-1 flex-none text-xs text-base-content/50">
              <span>{entry.kind}</span>
              <span>{formatRelativeTime(entry.createdAt)}</span>
            </div>
          </div>
        {/each}
      {:else}
        <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No visible activity yet.</div>
      {/if}
    </div>
  </section>
{/if}

{#if relatedMarkets.length > 0}
  <section class="grid gap-5">
    <div class="flex items-baseline justify-between gap-4">
      <h3 class="text-lg font-semibold tracking-tight">More markets</h3>
      <span class="text-sm text-base-content/50">Related reading</span>
    </div>

    <div class="grid gap-0 border-t border-base-300">
      {#each relatedMarkets as related (related.id)}
        <a class="flex items-start justify-between gap-4 py-3 border-b border-base-300 hover:text-base-content" href={marketUrl(related.slug)}>
          <div>
            <strong class="text-sm font-semibold">{related.title}</strong>
            <p class="text-sm text-base-content/60 mt-0.5">{truncateText(sanitizeMarketCopy(related.description || related.body), 120)}</p>
          </div>
          <div class="grid justify-items-end gap-1 flex-none text-xs">
            <span class="text-success">{priceCents((related.latestPricePpm ?? 500_000) / 1_000_000)} LONG</span>
          </div>
        </a>
      {/each}
    </div>
  </section>
{/if}
