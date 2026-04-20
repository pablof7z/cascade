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
    tab?: 'overview' | 'discussion' | 'charts' | 'activity' | 'trades' | 'linked';
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
    { href: marketUrl(market.slug), label: 'Case', active: tab === 'overview' },
    { href: marketDiscussionUrl(market.slug), label: 'Discussion', active: tab === 'discussion', count: totalReplyCount },
    { href: marketChartsUrl(market.slug), label: 'Charts', active: tab === 'charts' },
    { href: marketActivityUrl(market.slug), label: 'Activity', active: tab === 'activity' },
    { href: marketUrl(market.slug) + '/trades/', label: 'Trades', active: tab === 'trades', count: tradeSummary.tradeCount },
    { href: marketUrl(market.slug) + '/linked/', label: 'Linked', active: tab === 'linked', count: relatedMarkets.length }
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
  const categoryLabel = $derived(market.categories[0] ?? 'Market');
  const categoryTrail = $derived(market.categories.length > 0 ? market.categories.join(' / ') : 'Claim');
  const authorInitial = $derived((author.trim().charAt(0) || 'C').toUpperCase());
  const movementCents = $derived((impliedProbability - openingProbability) * 100);
  const movementLabel = $derived(`${movementCents >= 0 ? '+' : ''}${movementCents.toFixed(1)}¢`);
  const movementClass = $derived(movementCents >= 0 ? 'text-success' : 'text-error');
  const recentTradeRows = $derived(orderedTrades.slice(0, 5));
  const discussionPreviewThreads = $derived(discussionThreads.slice(0, 3));
  const relatedPreviewMarkets = $derived(relatedMarkets.slice(0, 4));
  const totalReplyCount = $derived(discussionThreads.reduce((sum, thread) => sum + thread.replyCount, 0));

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

{#snippet tradeRail()}
  <aside class="grid gap-5 lg:sticky lg:top-6 lg:self-start">
    <section class="rounded-md border border-base-300 bg-base-200/70 p-5">
      <div class="flex items-baseline justify-between gap-4">
        <h2 class="font-tight text-xl font-semibold tracking-tight">Back a side</h2>
        <span class="text-xs font-semibold uppercase tracking-widest text-base-content/50">{valueUnitLabel}</span>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-4">
        <div class="grid gap-1 border-r border-base-300 pr-4">
          <span>LONG</span>
          <strong class="font-mono text-3xl font-bold tracking-tight text-success">{priceCents(impliedProbability)}</strong>
        </div>
        <div class="grid gap-1">
          <span>SHORT</span>
          <strong class="font-mono text-3xl font-bold tracking-tight text-error">{priceCents(oppositeProbability)}</strong>
        </div>
      </div>

      <div class="mt-5 grid gap-4">
        {#if paperEdition}
          <PaperTradePanel
            marketId={market.id}
            marketSlug={market.slug}
            yesProbability={impliedProbability}
            noProbability={oppositeProbability}
          />
        {:else if currentUser}
          <a class="btn btn-primary w-full" href="/portfolio">Add funds to trade</a>

        {:else}
          <a class="btn btn-primary w-full" href="/join?from=/market/{market.slug}">Join to back a side</a>
          <p class="text-sm leading-relaxed text-base-content/60">Read the case first, then sign in when you are ready to spend USD.</p>
        {/if}
      </div>
    </section>

    <section class="rounded-md border border-base-300 p-5">
      <h3 class="text-sm font-semibold uppercase tracking-widest text-base-content/50">Market tape</h3>
      <dl class="mt-3 grid gap-0 border-t border-base-300">
        <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
          <dt class="text-sm text-base-content/50">Volume</dt>
          <dd class="font-mono text-sm">{formatProductAmount(tradeSummary.grossVolume, 'usd')}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
          <dt class="text-sm text-base-content/50">LONG flow</dt>
          <dd class="font-mono text-sm">{formatProductAmount(tradeSummary.longVolume, 'usd')}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
          <dt class="text-sm text-base-content/50">SHORT flow</dt>
          <dd class="font-mono text-sm">{formatProductAmount(tradeSummary.shortVolume, 'usd')}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
          <dt class="text-sm text-base-content/50">Average size</dt>
          <dd class="font-mono text-sm">{formatProductAmount(Math.round(averageTradeSize), 'usd')}</dd>
        </div>
        <div class="flex items-center justify-between gap-4 py-3">
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
    </section>
  </aside>
{/snippet}

<section class="pt-4">
  <nav class="mb-5 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-base-content/40" aria-label="Breadcrumb">
    <a class="hover:text-base-content" href="/">Home</a>
    <span>/</span>
    <a class="hover:text-base-content" href="/markets">Markets</a>
    <span>/</span>
    <span>{categoryLabel}</span>
  </nav>

  <header class="grid gap-6 border-b border-base-300 pb-6">
    <div class="grid gap-4">
      <div class="eyebrow">{categoryLabel} claim</div>
      <h1 class="font-serif text-4xl font-semibold leading-[1.04] tracking-normal sm:text-5xl">{market.title}</h1>
      <p class="max-w-[62ch] line-clamp-2 overflow-hidden text-lg leading-relaxed text-base-content/70">
        {sanitizeMarketCopy(market.description) || 'No summary provided yet.'}
      </p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <div class="grid h-10 w-10 flex-none place-items-center rounded-full border border-base-300 bg-base-200 font-serif text-lg text-base-content/80">
          {authorInitial}
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm font-semibold text-base-content">{author}</p>
          <p class="text-xs text-base-content/50">{formatRelativeTime(market.createdAt)} / {categoryTrail}</p>
        </div>
      </div>

      <div class="flex items-center gap-2">
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

    <dl class="grid gap-0 border-y border-base-300 sm:grid-cols-4">
      <div class="grid gap-1 border-b border-base-300 py-3 sm:border-b-0 sm:border-r sm:px-4 sm:first:pl-0">
        <dt class="text-xs uppercase tracking-widest text-base-content/40">Current LONG</dt>
        <dd class="font-mono text-2xl font-bold text-success">{priceCents(impliedProbability)}</dd>
      </div>
      <div class="grid gap-1 border-b border-base-300 py-3 sm:border-b-0 sm:border-r sm:px-4">
        <dt class="text-xs uppercase tracking-widest text-base-content/40">Move</dt>
        <dd class="font-mono text-2xl font-bold {movementClass}">{movementLabel}</dd>
      </div>
      <div class="grid gap-1 border-b border-base-300 py-3 sm:border-b-0 sm:border-r sm:px-4">
        <dt class="text-xs uppercase tracking-widest text-base-content/40">Volume</dt>
        <dd class="font-mono text-2xl font-bold">{formatProductAmount(tradeSummary.grossVolume, 'usd')}</dd>
      </div>
      <div class="grid gap-1 py-3 sm:px-4 sm:last:pr-0">
        <dt class="text-xs uppercase tracking-widest text-base-content/40">Traders</dt>
        <dd class="font-mono text-2xl font-bold">{visibleAccounts}</dd>
      </div>
    </dl>
  </header>
</section>

<section class="pt-4">
  <TabNav items={tabs} />
</section>

{#if tab === 'overview'}
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,320px)]">
    <div class="grid min-w-0 gap-10">
      <article class="max-w-[56ch] font-serif text-[1.08rem] leading-8 text-base-content/80">
        <h2 class="mb-5 font-serif text-2xl font-semibold leading-tight text-base-content">The case</h2>

        {#if caseParagraphs.length > 0}
          <div class="grid gap-5">
            {#each caseParagraphs as paragraph, index}
              <p class={index === 0 ? 'text-xl leading-9 text-base-content' : ''}>{paragraph}</p>
            {/each}
          </div>
        {:else}
          <p>No written case yet.</p>
        {/if}
      </article>

      {#if tradingContext.length > 0}
        <section class="grid max-w-[56ch] gap-4 border-t border-base-300 pt-6">
          <h3 class="font-tight text-lg font-semibold tracking-tight">Trading context</h3>
          <div class="grid gap-4">
            {#each tradingContext as criteria}
              <p class="text-sm leading-relaxed text-base-content/70">{criteria}</p>
            {/each}
          </div>
        </section>
      {/if}

      <section class="grid gap-5 border-t border-base-300 pt-6">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="font-tight text-lg font-semibold tracking-tight">Market signals</h3>
          <span class="text-sm text-base-content/50">{marketState.summary}</span>
        </div>

        <div class="grid gap-4">
          <div>
            <div class="mb-2 flex items-center justify-between gap-4 text-sm text-base-content/50">
              <span>LONG share</span>
              <span>{formatProbability(flowLong)} LONG</span>
            </div>
            <div class="h-1.5 rounded-full bg-base-300">
              <div class="h-full rounded-full bg-success" style:width={`${flowLong * 100}%`}></div>
            </div>
          </div>

          <div>
            <div class="mb-2 flex items-center justify-between gap-4 text-sm text-base-content/50">
              <span>SHORT share</span>
              <span>{formatProbability(flowShort)} SHORT</span>
            </div>
            <div class="h-1.5 rounded-full bg-base-300">
              <div class="h-full rounded-full bg-error" style:width={`${flowShort * 100}%`}></div>
            </div>
          </div>
        </div>

        <div class="grid gap-0 border-t border-base-300">
          {#each recentSignals as signal}
            <p class="border-b border-base-300 py-3 text-sm leading-relaxed text-base-content/70">{signal}</p>
          {/each}
        </div>
      </section>

      <section class="grid gap-5 border-t border-base-300 pt-6">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="font-tight text-lg font-semibold tracking-tight">From the discussion</h3>
          <a class="text-sm text-base-content/60 hover:text-base-content" href={marketDiscussionUrl(market.slug)}>Read all</a>
        </div>

        <div class="grid gap-0 border-t border-base-300">
          {#if discussionPreviewThreads.length > 0}
            {#each discussionPreviewThreads as thread (thread.post.id)}
              <a class="grid gap-1 border-b border-base-300 py-3 hover:text-base-content" href={threadUrl(market.slug, thread.post.id)}>
                <div class="flex items-baseline justify-between gap-4">
                  <strong class="text-sm font-semibold">{thread.post.subject || 'Untitled thread'}</strong>
                  <span class="flex-none text-xs text-base-content/50">{thread.replyCount} repl{thread.replyCount === 1 ? 'y' : 'ies'}</span>
                </div>
                <p class="text-sm leading-relaxed text-base-content/60">{truncateText(thread.post.content, 150)}</p>
                <p class="text-xs text-base-content/40">by {authorLabel(thread.post.pubkey)} / {formatRelativeTime(thread.lastActivityAt)}</p>
              </a>
            {/each}
          {:else}
            <p class="border-b border-base-300 py-3 text-sm text-base-content/60">No discussion yet. Start with the case and add your view from the Discussion tab.</p>
          {/if}
        </div>
      </section>

      <section class="grid gap-5 border-t border-base-300 pt-6">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="font-tight text-lg font-semibold tracking-tight">Recent trades</h3>
          <a class="text-sm text-base-content/60 hover:text-base-content" href={marketActivityUrl(market.slug)}>See activity</a>
        </div>

        <div class="grid gap-0 border-t border-base-300">
          {#if recentTradeRows.length > 0}
            {#each recentTradeRows as trade (trade.id)}
              <div class="flex items-start justify-between gap-4 border-b border-base-300 py-3">
                <div>
                  <strong class="text-sm font-semibold">{trade.direction === 'long' ? 'LONG' : 'SHORT'} {trade.type === 'buy' ? 'Buy' : 'Sell'}</strong>
                  <p class="mt-0.5 text-sm text-base-content/60">{formatProductAmount(trade.amount, 'usd')} at {formatProbability(trade.probability)}</p>
                </div>
                <span class="flex-none font-mono text-xs text-base-content/50">{formatRelativeTime(trade.createdAt)}</span>
              </div>
            {/each}
          {:else}
            <p class="border-b border-base-300 py-3 text-sm text-base-content/60">No trades yet.</p>
          {/if}
        </div>
      </section>

      {#if relatedMarkets.length > 0}
        <section class="grid gap-5 border-t border-base-300 pt-6">
          <div class="flex items-baseline justify-between gap-4">
            <h3 class="font-tight text-lg font-semibold tracking-tight">Linked markets</h3>
            <span class="text-sm text-base-content/50">Informational context</span>
          </div>

          <div class="grid gap-0 border-t border-base-300">
            {#each relatedPreviewMarkets as related (related.id)}
              <a class="flex items-start justify-between gap-4 border-b border-base-300 py-3 hover:text-base-content" href={marketUrl(related.slug)}>
                <div>
                  <strong class="text-sm font-semibold">{related.title}</strong>
                  <p class="mt-0.5 text-sm text-base-content/60">{truncateText(sanitizeMarketCopy(related.description || related.body), 120)}</p>
                </div>
                <div class="grid flex-none justify-items-end gap-1 text-xs">
                  <span class="text-success">{priceCents((related.latestPricePpm ?? 500_000) / 1_000_000)} LONG</span>
                </div>
              </a>
            {/each}
          </div>
        </section>
      {/if}
    </div>

    {@render tradeRail()}
  </section>
{/if}

{#if tab === 'discussion'}
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,320px)]">
    <div class="grid min-w-0 gap-6">
      <div class="grid gap-4 border-b border-base-300 pb-5">
        <div class="flex items-baseline justify-between gap-4">
          <h2 class="font-serif text-2xl font-semibold tracking-normal">Discussion</h2>
          <span class="text-sm text-base-content/50">{discussionThreads.length} threads / {totalReplyCount} replies</span>
        </div>

        <div class="grid gap-3">
          <div class="flex items-center justify-between gap-4 text-sm text-base-content/50">
            <span>LONG discussion share</span>
            <span>{formatProbability(flowLong)} LONG / {formatProbability(flowShort)} SHORT</span>
          </div>
          <div class="flex h-1.5 overflow-hidden rounded-full bg-base-300">
            <div class="bg-success" style:width={`${flowLong * 100}%`}></div>
            <div class="bg-error" style:width={`${flowShort * 100}%`}></div>
          </div>
        </div>

        <div class="flex gap-4 text-sm">
          <button class="border-b border-primary pb-1 text-base-content" type="button">Top</button>
          <button class="border-b border-transparent pb-1 text-base-content/50" type="button">Newest</button>
          <button class="border-b border-transparent pb-1 text-base-content/50" type="button">Positioned</button>
        </div>
      </div>

      {#if currentUser}
        <div class="grid gap-3 border-b border-base-300 pb-5">
          <input
            class="input input-bordered w-full"
            type="text"
            placeholder="Subject (optional)"
            bind:value={composeSubject}
            disabled={composeSubmitting}
          />
          <textarea
            class="textarea textarea-bordered w-full"
            rows={5}
            placeholder="Add your view on this claim."
            bind:value={composeBody}
            disabled={composeSubmitting}
          ></textarea>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap gap-2 text-xs text-base-content/50">
              <span class="rounded-full border border-base-300 px-2.5 py-1">Quote passage</span>
              <span class="rounded-full border border-base-300 px-2.5 py-1">Link market</span>
              <span class="rounded-full border border-base-300 px-2.5 py-1">Image</span>
            </div>
            <button class="btn btn-primary" onclick={postThread} disabled={composeSubmitting || !composeBody.trim()}>
              {composeSubmitting ? 'Posting...' : 'Post reply'}
            </button>
          </div>
          {#if composeError}
            <p class="text-sm text-error">{composeError}</p>
          {/if}

        </div>
      {:else}
        <p class="border-b border-base-300 pb-5 text-sm text-base-content/70">
          <a href="/join?from=/market/{market.slug}/discussion" class="text-primary">Sign in</a> to join the discussion.
        </p>
      {/if}

      <div class="grid gap-0 border-t border-base-300">
        {#if discussionThreads.length > 0}
          {#each discussionThreads as thread (thread.post.id)}
            <a class="flex items-start justify-between gap-4 border-b border-base-300 py-4 hover:text-base-content" href={threadUrl(market.slug, thread.post.id)}>
              <div>
                <strong class="text-sm font-semibold">{thread.post.subject || 'Untitled thread'}</strong>
                <p class="mt-1 text-sm leading-relaxed text-base-content/60">{truncateText(thread.post.content, 180)}</p>
                <p class="mt-1 text-xs text-base-content/40">by {authorLabel(thread.post.pubkey)}</p>
              </div>
              <div class="grid flex-none justify-items-end gap-1 text-xs text-base-content/50">
                <span>{thread.replyCount} repl{thread.replyCount === 1 ? 'y' : 'ies'}</span>
                <span>{formatRelativeTime(thread.lastActivityAt)}</span>
              </div>
            </a>
          {/each}
        {:else}
          <div class="grid gap-2 border-b border-base-300 py-4">
            <p class="text-sm text-base-content/70">No threads yet.</p>
            <p class="text-sm text-base-content/50">Be first to put reasoning on the record.</p>
          </div>
        {/if}
      </div>
    </div>

    {@render tradeRail()}
  </section>
{/if}

{#if tab === 'charts'}
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,320px)]">
    <div class="grid min-w-0 gap-8">
      <article class="grid gap-5">
        <div class="flex items-baseline justify-between gap-4">
          <h3 class="font-tight text-lg font-semibold tracking-tight">Price curve</h3>
        </div>

        {#if chronologicalTrades.length > 0}
          <div class="grid gap-3">
            <svg
              class="block h-auto w-full overflow-visible"
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

            <div class="flex justify-between gap-4 font-mono text-xs text-base-content/50">
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
          <h3 class="font-tight text-lg font-semibold tracking-tight">Last executed trade</h3>
        </div>

        {#if latestTrade}
          <dl class="grid gap-0 border-t border-base-300">
            <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
              <dt class="text-sm text-base-content/50">Direction</dt>
              <dd class="font-mono text-sm">{latestTrade.direction === 'long' ? 'LONG' : 'SHORT'} {latestTrade.type === 'buy' ? 'Buy' : 'Sell'}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
              <dt class="text-sm text-base-content/50">Price</dt>
              <dd class="font-mono text-sm">{priceCents(latestTrade.probability)}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
              <dt class="text-sm text-base-content/50">Size</dt>
              <dd class="font-mono text-sm">{formatProductAmount(latestTrade.amount, 'usd')} {valueUnitLabel}</dd>
            </div>
            <div class="flex items-center justify-between gap-4 border-b border-base-300 py-3">
              <dt class="text-sm text-base-content/50">When</dt>
              <dd class="font-mono text-sm">{formatRelativeTime(latestTrade.createdAt)}</dd>
            </div>
          </dl>
        {:else}
          <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No trades yet.</div>
        {/if}
      </article>
    </div>

    {@render tradeRail()}
  </section>
{/if}

{#if tab === 'activity'}
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,320px)]">
    <div class="grid min-w-0 gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="font-tight text-lg font-semibold tracking-tight">Activity</h3>
        <span class="text-sm text-base-content/50">Recent activity across this market</span>
      </div>

      <div class="grid gap-0 border-t border-base-300">
        {#if activityEntries.length > 0}
          {#each activityEntries as entry (entry.id)}
            <div class="flex items-start justify-between gap-4 border-b border-base-300 py-3">
              <div>
                <strong class="text-sm font-semibold">{entry.headline}</strong>
                <p class="mt-0.5 text-sm text-base-content/60">{entry.detail}</p>
              </div>
              <div class="grid flex-none justify-items-end gap-1 text-xs text-base-content/50">
                <span>{entry.kind}</span>
                <span>{formatRelativeTime(entry.createdAt)}</span>
              </div>
            </div>
          {/each}
        {:else}
          <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No visible activity yet.</div>
        {/if}
      </div>
    </div>

    {@render tradeRail()}
  </section>
{/if}

{#if tab === 'trades'}
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,320px)]">
    <div class="grid min-w-0 gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="font-tight text-lg font-semibold tracking-tight">Trades</h3>
        <span class="text-sm text-base-content/50">{tradeSummary.tradeCount.toLocaleString()} trades</span>
      </div>

      <div class="grid gap-0 border-t border-base-300">
        {#if orderedTrades.length > 0}
          {#each orderedTrades as trade (trade.id)}
            <div class="flex items-start justify-between gap-4 border-b border-base-300 py-3">
              <div>
                <strong class="text-sm font-semibold">{trade.direction === 'long' ? 'LONG' : 'SHORT'} {trade.type === 'buy' ? 'Buy' : 'Sell'}</strong>
                <p class="mt-0.5 text-sm text-base-content/60">{formatProductAmount(trade.amount, 'usd')} at {formatProbability(trade.probability)}</p>
                <p class="mt-0.5 text-xs text-base-content/40">by {authorLabel(trade.pubkey)}</p>
              </div>
              <div class="grid flex-none justify-items-end gap-1 text-xs text-base-content/50">
                <span class={trade.direction === 'long' ? 'text-success' : 'text-error'}>{trade.direction === 'long' ? 'LONG' : 'SHORT'}</span>
                <span>{formatRelativeTime(trade.createdAt)}</span>
              </div>
            </div>
          {/each}
        {:else}
          <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No trades yet.</div>
        {/if}
      </div>
    </div>

    {@render tradeRail()}
  </section>
{/if}

{#if tab === 'linked'}
  <section class="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_minmax(290px,320px)]">
    <div class="grid min-w-0 gap-5">
      <div class="flex items-baseline justify-between gap-4">
        <h3 class="font-tight text-lg font-semibold tracking-tight">Linked markets</h3>
      </div>

      <div class="grid gap-0 border-t border-base-300">
        {#if relatedMarkets.length > 0}
          {#each relatedMarkets as related (related.id)}
            <a class="flex items-start justify-between gap-4 border-b border-base-300 py-4 hover:text-base-content" href={marketUrl(related.slug)}>
              <div>
                <strong class="text-sm font-semibold">{related.title}</strong>
                <p class="mt-1 text-sm leading-relaxed text-base-content/60">{truncateText(sanitizeMarketCopy(related.description || related.body), 150)}</p>
                <p class="mt-1 text-xs text-base-content/40">by {authorLabel(related.pubkey)}</p>
              </div>
              <div class="grid flex-none justify-items-end gap-1 text-xs">
                <span class={related.latestPricePpm && related.latestPricePpm >= 500_000 ? 'text-success' : 'text-error'}>{priceCents((related.latestPricePpm ?? 500_000) / 1_000_000)} LONG</span>
                <span class="text-base-content/50">{formatRelativeTime(related.createdAt)}</span>
              </div>
            </a>
          {/each}
        {:else}
          <div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No linked markets.</div>
        {/if}
      </div>
    </div>

    {@render tradeRail()}
  </section>
{/if}
