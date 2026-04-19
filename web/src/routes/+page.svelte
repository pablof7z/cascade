<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import { trackEvent } from '$lib/analytics';
  import { formatProductAmount } from '$lib/cascade/format';
  import { getAlternateEditionUrl, getCascadeEdition } from '$lib/cascade/config';
  import {
    buildTradeSummary,
    formatRelativeTime,
    getCascadeEventKinds,
    marketDiscussionUrl,
    marketUrl,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    threadUrl,
    truncateText,
    type DiscussionRecord,
    type MarketRecord,
    type MarketTradeSummary,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName } from '$lib/ndk/format';
  import { filterLiveHomepageMarkets } from './homepage-market-search';
  import type { PageProps } from './$types';

  type FeedItem =
    | {
        id: string;
        type: 'claim';
        createdAt: number;
        market: MarketRecord;
        context: string;
      }
    | {
        id: string;
        type: 'trade';
        createdAt: number;
        market: MarketRecord;
        trade: TradeRecord;
        context: string;
      }
    | {
        id: string;
        type: 'discussion';
        createdAt: number;
        market: MarketRecord;
        discussion: DiscussionRecord;
        context: string;
      };

  let { data }: PageProps = $props();
  let noteDraft = $state('');
  let audienceFilter = $state('for-you');
  let contentFilter = $state('all');
  let visibleFeedLimit = $state(18);
  let viewedFeedHeadId = $state('');
  let lastFeedFilterKey = $state('');

  const initialFeedLimit = 18;
  const feedLimitStep = 12;

  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const isPracticeEdition = $derived(selectedEdition === 'signet');
  const alternateEditionUrl = $derived(getAlternateEditionUrl(selectedEdition));
  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);

  const discussionFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [1111], '#K': [String(eventKinds.market)], limit: 80 }] };
  });

  const marketFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.market], limit: 60 }] };
  });

  const tradeFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.trade], limit: 240 }] };
  });

  const trades = $derived.by(() => {
    return mergeRawEvents(data.trades, tradeFeed.events)
      .map((event) => parseTradeEvent(event, selectedEdition))
      .filter((trade): trade is TradeRecord => Boolean(trade))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const markets = $derived.by(() => {
    return filterLiveHomepageMarkets(
      mergeRawEvents(data.markets, marketFeed.events)
        .map((event) => parseMarketEvent(event, selectedEdition))
        .filter((market): market is MarketRecord => Boolean(market)),
      trades,
      { skipTradeFilter: isPracticeEdition }
    ).sort((left, right) => right.createdAt - left.createdAt);
  });

  const discussions = $derived.by(() => {
    return mergeRawEvents(data.discussions, discussionFeed.events)
      .map((event) => parseDiscussionEvent(event, selectedEdition))
      .filter((discussion): discussion is DiscussionRecord => Boolean(discussion))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const tradeSummaries = $derived.by(() => {
    const grouped = new Map<string, TradeRecord[]>();

    for (const trade of trades) {
      const bucket = grouped.get(trade.marketId);
      if (bucket) {
        bucket.push(trade);
      } else {
        grouped.set(trade.marketId, [trade]);
      }
    }

    const summaries = new Map<string, MarketTradeSummary>();
    for (const [marketId, bucket] of grouped) {
      summaries.set(marketId, buildTradeSummary(bucket));
    }

    return summaries;
  });

  const discussionCounts = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const discussion of discussions) {
      counts.set(discussion.marketId, (counts.get(discussion.marketId) ?? 0) + 1);
    }
    return counts;
  });

  const marketById = $derived(new Map(markets.map((market) => [market.id, market])));

  const feedItems = $derived.by(() => {
    const items: FeedItem[] = [];

    for (const market of markets.slice(0, 24)) {
      items.push({
        id: `claim-${market.id}`,
        type: 'claim',
        createdAt: market.createdAt,
        market,
        context: `${authorLabel(market.pubkey)} published a claim in ${categoryLabel(market)}`
      });
    }

    for (const trade of trades.slice(0, 60)) {
      const market = marketById.get(trade.marketId);
      if (!market) continue;

      items.push({
        id: `trade-${trade.id}`,
        type: 'trade',
        createdAt: trade.createdAt,
        market,
        trade,
        context: `${formatProductAmount(trade.amount, trade.unit)} moved ${sideLabel(trade.direction)} on a claim you can watch`
      });
    }

    for (const discussion of discussions.slice(0, 40)) {
      const market = marketById.get(discussion.marketId);
      if (!market) continue;

      items.push({
        id: `discussion-${discussion.id}`,
        type: 'discussion',
        createdAt: discussion.createdAt,
        market,
        discussion,
        context: `Thread heating up in ${categoryLabel(market)}`
      });
    }

    return items.sort((left, right) => right.createdAt - left.createdAt).slice(0, 48);
  });

  const filteredFeedItems = $derived.by(() => {
    if (contentFilter === 'publications') return feedItems.filter((item) => item.type === 'claim');
    if (contentFilter === 'notes') return feedItems.filter((item) => item.type === 'discussion');
    return feedItems;
  });

  const visibleFeedItems = $derived(filteredFeedItems.slice(0, visibleFeedLimit));
  const hasMoreFeedItems = $derived(filteredFeedItems.length > visibleFeedLimit);
  const feedFilterKey = $derived(`${audienceFilter}:${contentFilter}`);
  const newestFilteredFeedItemId = $derived(filteredFeedItems[0]?.id ?? '');
  const newFeedItemsCount = $derived.by(() => {
    if (!viewedFeedHeadId) return 0;
    const viewedIndex = filteredFeedItems.findIndex((item) => item.id === viewedFeedHeadId);
    return viewedIndex > 0 ? viewedIndex : 0;
  });

  const upNextMarkets = $derived(
    [...markets]
      .sort((left, right) => {
        const leftTradeAt = tradeSummaries.get(left.id)?.latestTradeAt ?? 0;
        const rightTradeAt = tradeSummaries.get(right.id)?.latestTradeAt ?? 0;
        if (rightTradeAt !== leftTradeAt) return rightTradeAt - leftTradeAt;
        return right.createdAt - left.createdAt;
      })
      .slice(0, 3)
  );

  const canPost = $derived(noteDraft.trim().length > 0);

  $effect(() => {
    trackEvent('page_view', { path: '/' });
  });

  $effect(() => {
    if (lastFeedFilterKey !== feedFilterKey) {
      lastFeedFilterKey = feedFilterKey;
      visibleFeedLimit = initialFeedLimit;
      viewedFeedHeadId = newestFilteredFeedItemId;
    }
  });

  $effect(() => {
    if (!viewedFeedHeadId && newestFilteredFeedItemId) {
      viewedFeedHeadId = newestFilteredFeedItemId;
    }
  });

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

  function authorLabel(pubkey: string): string {
    return displayName(profiles[pubkey], 'Cascade user');
  }

  function authorInitial(pubkey: string): string {
    return authorLabel(pubkey).trim().slice(0, 1).toUpperCase() || 'C';
  }

  function authorProfileUrl(pubkey: string): string {
    return `/p/${encodeURIComponent(pubkey)}`;
  }

  function categoryLabel(market: MarketRecord): string {
    return market.categories[0] || market.topics[0] || 'General';
  }

  function marketSummary(marketId: string): MarketTradeSummary | undefined {
    return tradeSummaries.get(marketId);
  }

  function longCents(market: MarketRecord): number {
    return Math.round((marketSummary(market.id)?.latestPricePpm ?? market.latestPricePpm ?? 500_000) / 10_000);
  }

  function leadingSide(market: MarketRecord): { label: 'LONG' | 'SHORT'; cents: number } {
    const long = longCents(market);
    return long >= 50 ? { label: 'LONG', cents: long } : { label: 'SHORT', cents: 100 - long };
  }

  function leadingSideLabel(market: MarketRecord): 'LONG' | 'SHORT' {
    return leadingSide(market).label;
  }

  function leadingSideCents(market: MarketRecord): number {
    return leadingSide(market).cents;
  }

  function sideLabel(direction: TradeRecord['direction']): 'LONG' | 'SHORT' {
    return direction === 'long' ? 'LONG' : 'SHORT';
  }

  function tradeActionLabel(trade: TradeRecord): string {
    return trade.type === 'buy' ? 'Backed' : 'Exited';
  }

  function tradePriceCents(trade: TradeRecord): string {
    return `${Math.round(trade.pricePpm / 10_000)}¢`;
  }

  function tradeCountForMarket(market: MarketRecord): number {
    return marketSummary(market.id)?.tradeCount ?? 0;
  }

  function marketDescription(market: MarketRecord): string {
    return truncateText(market.description || market.body || 'A live claim priced by trading activity.', 190);
  }

  function discussionPreview(discussion: DiscussionRecord): string {
    return truncateText(discussion.content || discussion.subject || 'New discussion activity on this claim.', 220);
  }

  function showNewestFeedItems() {
    viewedFeedHeadId = newestFilteredFeedItemId;
    visibleFeedLimit = Math.max(initialFeedLimit, visibleFeedLimit);
    if (browser) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function loadMoreFeedItems() {
    visibleFeedLimit += feedLimitStep;
  }
</script>

<section class="grid gap-5">
  <form class="grid gap-4 rounded-lg border border-base-300 bg-base-100 p-4" onsubmit={(event) => event.preventDefault()}>
    <div class="flex gap-3">
      <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-base-200 font-tight text-sm font-bold text-primary">
        C
      </span>
      <textarea
        class="textarea min-h-24 flex-1 resize-none border-base-300 bg-base-100 text-base leading-7 focus:border-primary"
        placeholder="What's on your mind?"
        bind:value={noteDraft}
        aria-label="What's on your mind?"
      ></textarea>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3 pl-0 sm:pl-13">
      <div class="flex flex-wrap gap-2">
        <button class="btn btn-ghost btn-sm gap-2 text-base-content/55" type="button">
          <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 5h16v14H4zM8 13l2.5-2.5L14 14l2-2 4 4M8.5 8.5h.01" />
          </svg>
          Add image
        </button>
        <button class="btn btn-ghost btn-sm gap-2 text-base-content/55" type="button">
          <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.5 13.5 13.5 10M8.5 16A4.95 4.95 0 0 1 8.5 9l1.25-1.25a4.95 4.95 0 0 1 7 7L15.5 16M15.5 8a4.95 4.95 0 0 1 0 7l-1.25 1.25a4.95 4.95 0 0 1-7-7L8.5 8" />
          </svg>
          Link market
        </button>
        <button class="btn btn-ghost btn-sm gap-2 text-base-content/55" type="button">
          <svg class="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 3v18M7 7.5h7.5a3 3 0 0 1 0 6H9.5a3 3 0 0 0 0 6H17" />
          </svg>
          Attach stake
        </button>
      </div>

      <button class="btn btn-outline btn-sm" type="submit" disabled={!canPost}>Post</button>
    </div>
  </form>

  <header class="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-3">
    <label class="flex items-center gap-2 text-sm text-base-content/55">
      <span class="sr-only">Feed source</span>
      <select class="select select-sm border-base-300 bg-base-100" bind:value={audienceFilter} aria-label="Feed source">
        <option value="for-you">For you</option>
        <option value="following">Following</option>
        <option value="subscribed">Subscribed</option>
        <option value="watchlist">Watchlist</option>
      </select>
    </label>

    <nav class="flex gap-5" aria-label="Feed type">
      <button
        type="button"
        class={contentFilter === 'all'
          ? 'border-b-2 border-primary pb-2 text-sm font-semibold text-primary'
          : 'border-b-2 border-transparent pb-2 text-sm text-base-content/45 hover:text-base-content'}
        aria-pressed={contentFilter === 'all'}
        onclick={() => {
          contentFilter = 'all';
        }}
      >
        All
      </button>
      <button
        type="button"
        class={contentFilter === 'notes'
          ? 'border-b-2 border-primary pb-2 text-sm font-semibold text-primary'
          : 'border-b-2 border-transparent pb-2 text-sm text-base-content/45 hover:text-base-content'}
        aria-pressed={contentFilter === 'notes'}
        onclick={() => {
          contentFilter = 'notes';
        }}
      >
        Notes
      </button>
      <button
        type="button"
        class={contentFilter === 'publications'
          ? 'border-b-2 border-primary pb-2 text-sm font-semibold text-primary'
          : 'border-b-2 border-transparent pb-2 text-sm text-base-content/45 hover:text-base-content'}
        aria-pressed={contentFilter === 'publications'}
        onclick={() => {
          contentFilter = 'publications';
        }}
      >
        Publications
      </button>
    </nav>
  </header>

  {#if newFeedItemsCount > 0}
    <div class="flex justify-center">
      <button class="btn btn-outline btn-sm rounded-full" type="button" onclick={showNewestFeedItems}>
        {newFeedItemsCount} new post{newFeedItemsCount === 1 ? '' : 's'} · click to update
      </button>
    </div>
  {/if}

  {#if visibleFeedItems.length > 0}
    <div class="divide-y divide-base-300">
      {#each visibleFeedItems as item (item.id)}
        <article class="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-3 py-6">
          <a
            class="grid h-10 w-10 place-items-center rounded-full bg-base-200 font-tight text-sm font-bold text-primary"
            href={authorProfileUrl(item.market.pubkey)}
            aria-label={authorLabel(item.market.pubkey)}
          >
            {authorInitial(item.market.pubkey)}
          </a>

          <div class="grid min-w-0 gap-3">
            <p class="flex items-center gap-2 text-sm text-base-content/45">
              <svg class="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 12h16M12 4l8 8-8 8" />
              </svg>
              <span>{item.context}</span>
            </p>

            <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <a class="font-semibold text-base-content hover:text-primary" href={authorProfileUrl(item.market.pubkey)}>
                {authorLabel(item.market.pubkey)}
              </a>
              <span class="text-base-content/35">·</span>
              <span class="text-base-content/45">{categoryLabel(item.market)}</span>
              <span class="text-base-content/35">·</span>
              <time class="text-base-content/45" datetime={new Date(item.createdAt * 1000).toISOString()}>
                {formatRelativeTime(item.createdAt)}
              </time>
            </div>

            {#if item.type === 'claim'}
              <p class="text-base leading-7 text-base-content/70">
                New claim now live. The crowd is pricing the argument as trades arrive.
              </p>
              <a class="grid gap-3 rounded-lg border border-base-300 p-4 hover:border-primary" href={marketUrl(item.market.slug)}>
                <div class="flex flex-wrap items-center gap-3 font-mono text-[0.68rem] uppercase text-base-content/40">
                  <span>{categoryLabel(item.market)}</span>
                  <span>New claim</span>
                  <span>{discussionCounts.get(item.market.id) ?? 0} replies</span>
                </div>
                <h2 class="font-serif text-2xl font-medium leading-tight text-base-content">{item.market.title}</h2>
                <p class="text-sm leading-6 text-base-content/55">{marketDescription(item.market)}</p>
                <div class="flex flex-wrap items-center gap-4 border-t border-base-300 pt-3 font-mono text-xs">
                  <span class={leadingSideLabel(item.market) === 'LONG' ? 'text-success' : 'text-error'}>
                    {leadingSideLabel(item.market)} {leadingSideCents(item.market)}¢
                  </span>
                  <span class="text-base-content/45">{formatProductAmount(marketSummary(item.market.id)?.grossVolume ?? 0, 'usd')} volume</span>
                </div>
              </a>
            {:else if item.type === 'trade'}
              <p class="text-base leading-7 text-base-content/70">
                {tradeActionLabel(item.trade)} {sideLabel(item.trade.direction)} at {tradePriceCents(item.trade)} on a live claim.
              </p>
              <a class="grid gap-2 rounded-lg border border-base-300 p-4 hover:border-primary" href={marketUrl(item.market.slug)}>
                <span class="font-mono text-[0.68rem] uppercase text-base-content/40">Trade alert</span>
                <h2 class="font-serif text-xl font-medium leading-tight">{item.market.title}</h2>
                <div class="flex flex-wrap items-center gap-4 font-mono text-xs">
                  <span class={item.trade.direction === 'long' ? 'text-success' : 'text-error'}>
                    {sideLabel(item.trade.direction)} · {formatProductAmount(item.trade.amount, item.trade.unit)}
                  </span>
                  <span class="text-base-content/45">{tradeCountForMarket(item.market)} trades</span>
                </div>
              </a>
            {:else}
              <p class="text-base leading-7 text-base-content/70">{discussionPreview(item.discussion)}</p>
              <a class="grid gap-2 rounded-lg border border-base-300 p-4 hover:border-primary" href={threadUrl(item.market.slug, item.discussion.id)}>
                <span class="font-mono text-[0.68rem] uppercase text-base-content/40">Discussion</span>
                <h2 class="font-serif text-xl font-medium leading-tight">{item.market.title}</h2>
                <span class="font-mono text-xs text-base-content/45">Open thread</span>
              </a>
            {/if}

            <div class="flex flex-wrap items-center gap-5 text-sm text-base-content/45">
              <a class="hover:text-base-content" href={marketDiscussionUrl(item.market.slug)}>Reply</a>
              <a class="hover:text-base-content" href={marketUrl(item.market.slug)}>
                Back {leadingSideLabel(item.market)} {leadingSideCents(item.market)}¢
              </a>
              <a class="hover:text-base-content" href="/bookmarks">Save</a>
              <a class="hover:text-base-content" href={marketUrl(item.market.slug)}>Share</a>
            </div>
          </div>
        </article>
      {/each}
    </div>

    {#if hasMoreFeedItems}
      <div class="flex justify-center border-t border-base-300 pt-5">
        <button class="btn btn-outline btn-sm" type="button" onclick={loadMoreFeedItems}>
          Load more
        </button>
      </div>
    {/if}
  {:else}
    <section class="grid gap-4 border-b border-base-300 py-10">
      <h1 class="font-tight text-2xl font-semibold">You're not following anyone yet.</h1>
      <p class="max-w-lg text-sm leading-6 text-base-content/60">
        Subscribe to a writer to start getting claims in your inbox, or head to Markets to see what's live.
      </p>
      <div class="flex flex-wrap gap-3">
        <a class="btn btn-outline btn-sm" href="/markets">Browse markets</a>
        {#if alternateEditionUrl}
          <a class="btn btn-ghost btn-sm" href={alternateEditionUrl}>Switch edition</a>
        {/if}
      </div>
    </section>
  {/if}

  {#if upNextMarkets.length > 0}
    <footer class="grid gap-3 border-t border-base-300 pt-6">
      <h2 class="font-tight text-lg font-bold">Up next</h2>
      <div class="grid gap-3">
        {#each upNextMarkets as market}
          <a class="flex items-center justify-between gap-4 border-b border-base-300 pb-3 text-sm hover:text-primary" href={marketUrl(market.slug)}>
            <span class="line-clamp-2">{market.title}</span>
            <span class={leadingSideLabel(market) === 'LONG' ? 'font-mono text-success' : 'font-mono text-error'}>
              {leadingSideLabel(market)} {leadingSideCents(market)}¢
            </span>
          </a>
        {/each}
      </div>
    </footer>
  {/if}
</section>
