<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
  import { formatProductAmount } from '$lib/cascade/format';
  import { getCascadeEdition } from '$lib/cascade/config';
  import { ndk } from '$lib/ndk/client';
  import {
    buildTradeSummary,
    formatRelativeTime,
    getCascadeEventKinds,
    marketUrl,
    parseMarketEvent,
    parseTradeEvent,
    sanitizeMarketCopy,
    truncateText,
    type MarketRecord,
    type MarketTradeSummary,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName } from '$lib/ndk/format';
  import { filterLiveHomepageMarkets } from '../homepage-market-search';
  import type { PageProps } from './$types';

  type TabId = 'unread' | 'all' | 'revisions' | 'saved';

  type SubscriptionItem = {
    market: MarketRecord;
    summary?: MarketTradeSummary;
    firstTrade?: TradeRecord;
    isNewThisWeek: boolean;
  };

  let { data }: PageProps = $props();
  let activeTab = $state<TabId>('all');

  const currentUser = $derived(ndk.$currentUser);
  const selectedEdition = $derived(getCascadeEdition(data.cascadeEdition ?? null));
  const eventKinds = $derived(getCascadeEventKinds(selectedEdition));
  const isPracticeEdition = $derived(selectedEdition === 'signet');
  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);

  const followFeed = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return { filters: [{ kinds: [3], authors: [currentUser.pubkey], limit: 1 }] };
  });

  const followedPubkeys = $derived.by(() => {
    const latestFollowEvent = followFeed.events
      .map((event) => event.rawEvent() as NostrEvent)
      .sort((left, right) => right.created_at - left.created_at)[0];
    const pubkeys = new Set<string>();

    for (const tag of latestFollowEvent?.tags ?? []) {
      if (tag[0] === 'p' && tag[1]) pubkeys.add(tag[1]);
    }

    return pubkeys;
  });

  const followedAuthorList = $derived([...followedPubkeys].slice(0, 80));

  const followedMarketFeed = ndk.$subscribe(() => {
    if (!browser || followedAuthorList.length === 0) return undefined;
    return { filters: [{ kinds: [eventKinds.market], authors: followedAuthorList, limit: 160 }] };
  });

  const tradeFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [eventKinds.trade], limit: 480 }] };
  });

  const trades = $derived.by(() => {
    return mergeRawEvents(data.trades, tradeFeed.events)
      .map((event) => parseTradeEvent(event, selectedEdition))
      .filter((trade): trade is TradeRecord => Boolean(trade))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const tradeSummaries = $derived.by(() => {
    const grouped = new Map<string, TradeRecord[]>();
    for (const trade of trades) {
      const bucket = grouped.get(trade.marketId);
      if (bucket) bucket.push(trade);
      else grouped.set(trade.marketId, [trade]);
    }

    const summaries = new Map<string, MarketTradeSummary>();
    for (const [marketId, bucket] of grouped) {
      summaries.set(marketId, buildTradeSummary(bucket));
    }
    return summaries;
  });

  const firstTrades = $derived.by(() => {
    const first = new Map<string, TradeRecord>();
    for (const trade of [...trades].sort((left, right) => left.createdAt - right.createdAt)) {
      if (!first.has(trade.marketId)) first.set(trade.marketId, trade);
    }
    return first;
  });

  const followedMarkets = $derived.by(() => {
    if (followedAuthorList.length === 0) return [];

    return filterLiveHomepageMarkets(
      mergeRawEvents(data.markets, followedMarketFeed.events)
        .map((event) => parseMarketEvent(event, selectedEdition))
        .filter((market): market is MarketRecord => Boolean(market))
        .filter((market) => followedPubkeys.has(market.pubkey)),
      trades,
      { skipTradeFilter: isPracticeEdition }
    ).sort((left, right) => right.createdAt - left.createdAt);
  });

  const subscriptionItems = $derived.by(() => {
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    return followedMarkets.map<SubscriptionItem>((market) => ({
      market,
      summary: tradeSummaries.get(market.id),
      firstTrade: firstTrades.get(market.id),
      isNewThisWeek: market.createdAt >= weekAgo
    }));
  });

  const visibleItems = $derived.by(() => {
    if (activeTab === 'unread') return subscriptionItems.filter((item) => item.isNewThisWeek);
    if (activeTab === 'revisions') return [];
    if (activeTab === 'saved') return [];
    return subscriptionItems;
  });

  const groupedItems = $derived.by(() => {
    const groups = new Map<string, SubscriptionItem[]>();
    for (const item of visibleItems) {
      const label = groupLabel(item.market.createdAt);
      groups.set(label, [...(groups.get(label) ?? []), item]);
    }

    return [...groups.entries()].map(([label, items]) => ({ label, items }));
  });

  const unreadCount = $derived(subscriptionItems.filter((item) => item.isNewThisWeek).length);
  const summaryLine = $derived(
    `${followedPubkeys.size} followed writers · ${unreadCount} new this week · 0 case revisions`
  );

  const tabs = $derived([
    { id: 'unread' as const, label: `Unread ${unreadCount}` },
    { id: 'all' as const, label: 'All' },
    { id: 'revisions' as const, label: 'Case revisions 0' },
    { id: 'saved' as const, label: 'Saved' }
  ]);

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

  function categoryLabel(market: MarketRecord): string {
    return market.categories[0] || market.topics[0] || 'General';
  }

  function marketExcerpt(market: MarketRecord): string {
    return truncateText(
      sanitizeMarketCopy(market.description || market.body || 'A live claim priced by trading activity.'),
      190
    );
  }

  function longCents(item: SubscriptionItem): number {
    return Math.round((item.summary?.latestPricePpm ?? item.market.latestPricePpm ?? 500_000) / 10_000);
  }

  function leadingSide(item: SubscriptionItem): { label: 'LONG' | 'SHORT'; cents: number } {
    const long = longCents(item);
    return long >= 50 ? { label: 'LONG', cents: long } : { label: 'SHORT', cents: 100 - long };
  }

  function seedCopy(item: SubscriptionItem): string {
    if (!item.firstTrade) return 'New claim';
    return `New claim · first trade ${formatProductAmount(item.firstTrade.amount, item.firstTrade.unit)} ${sideLabel(item.firstTrade.direction)}`;
  }

  function sideLabel(direction: TradeRecord['direction']): 'LONG' | 'SHORT' {
    return direction === 'long' ? 'LONG' : 'SHORT';
  }

  function readTime(market: MarketRecord): string {
    const words = `${market.description} ${market.body}`.trim().split(/\s+/).filter(Boolean).length;
    const minutes = Math.max(1, Math.ceil(words / 220));
    return `${minutes} min`;
  }

  function groupLabel(createdAt: number): string {
    const date = new Date(createdAt * 1000);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

    if (createdAt >= startOfToday) {
      return `Today · ${date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
    }

    if (createdAt >= weekAgo) return 'This week';

    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
      return `Earlier in ${date.toLocaleDateString(undefined, { month: 'long' })}`;
    }

    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
</script>

<section class="grid gap-8">
  <header class="grid gap-4 border-b border-base-300 pb-5">
    <div class="grid gap-2">
      <h1 class="font-serif text-4xl font-semibold leading-none sm:text-5xl">Subscriptions</h1>
      <p class="max-w-2xl text-sm leading-6 text-base-content/65">
        Claims from the writers you follow. Long-form only - notes, trades, and replies live on Home.
      </p>
      <p class="font-mono text-xs text-base-content/45">{summaryLine}</p>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-4 border-b border-base-300 text-sm" role="tablist" aria-label="Subscription filters">
        {#each tabs as tab}
          <button
            class={activeTab === tab.id
              ? 'border-b-2 border-primary pb-2 font-semibold text-base-content'
              : 'border-b-2 border-transparent pb-2 text-base-content/55 hover:text-base-content'}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onclick={() => {
              activeTab = tab.id;
            }}
          >
            {tab.label}
          </button>
        {/each}
      </div>

      <button class="btn btn-ghost btn-sm" type="button" disabled>Mark all read</button>
    </div>
  </header>

  {#if !currentUser}
    <section class="grid gap-4 rounded-md border border-base-300 p-8 text-center">
      <h2 class="font-tight text-xl font-bold">Sign in to see your subscriptions.</h2>
      <p class="mx-auto max-w-md text-sm leading-6 text-base-content/60">
        Subscriptions are built from the writers you follow, then filtered against live claim events.
      </p>
      <div class="flex justify-center gap-3">
        <a class="btn btn-primary btn-sm" href="/join?from=/subscriptions">Join Cascade</a>
        <a class="btn btn-outline btn-sm" href="/markets">Browse markets</a>
      </div>
    </section>
  {:else if followedPubkeys.size === 0}
    <section class="grid gap-4 rounded-md border border-base-300 p-8 text-center">
      <h2 class="font-tight text-xl font-bold">You're not following anyone yet.</h2>
      <p class="mx-auto max-w-md text-sm leading-6 text-base-content/60">
        Follow writers from their profiles; their published claims will appear here as a focused reading list.
      </p>
      <div>
        <a class="btn btn-outline btn-sm" href="/markets">Discover writers</a>
      </div>
    </section>
  {:else if visibleItems.length === 0}
    <section class="grid gap-3 rounded-md border border-base-300 p-8 text-center">
      <h2 class="font-tight text-xl font-bold">Caught up.</h2>
      <p class="mx-auto max-w-md text-sm leading-6 text-base-content/60">
        No claim dispatches match this filter right now.
      </p>
      {#if activeTab !== 'all'}
        <button class="btn btn-outline btn-sm justify-self-center" type="button" onclick={() => { activeTab = 'all'; }}>
          View all
        </button>
      {/if}
    </section>
  {:else}
    <div class="grid gap-8">
      {#each groupedItems as group}
        <section class="grid gap-3" aria-label={group.label}>
          <div class="flex items-center justify-between gap-4 border-b border-base-300 pb-2">
            <h2 class="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-base-content/45">
              {group.label}
            </h2>
            <span class="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-base-content/35">
              {group.items.length} new
            </span>
          </div>

          <div class="grid gap-0">
            {#each group.items as item (item.market.id)}
              {@const side = leadingSide(item)}
              <article class="relative grid gap-3 border-b border-base-300 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)]">
                {#if item.isNewThisWeek}
                  <span class="absolute left-0 top-7 hidden h-1.5 w-1.5 rounded-full bg-primary sm:block" aria-hidden="true"></span>
                {/if}

                <span class="grid h-10 w-10 place-items-center rounded-full bg-base-200 font-tight text-sm font-bold text-primary">
                  {authorInitial(item.market.pubkey)}
                </span>

                <div class="grid gap-2">
                  <div class="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                    <span class="font-semibold text-base-content">{authorLabel(item.market.pubkey)}</span>
                    <span class="text-base-content/30">·</span>
                    <span class="font-serif italic text-base-content/55">{categoryLabel(item.market)}</span>
                    <span class="text-base-content/35">{formatRelativeTime(item.market.createdAt)}</span>
                  </div>

                  <div class="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-base-content/45">
                    {categoryLabel(item.market)} · {seedCopy(item)}
                  </div>

                  <a class="group grid gap-2" href={marketUrl(item.market.slug)}>
                    <h3 class="font-serif text-2xl font-semibold leading-tight group-hover:text-primary sm:text-3xl">
                      {item.market.title}
                    </h3>
                    <p class="font-serif text-base leading-7 text-base-content/68">{marketExcerpt(item.market)}</p>
                  </a>

                  <div class="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 font-mono text-xs text-base-content/45">
                    <span class={side.label === 'LONG' ? 'text-success' : 'text-error'}>
                      {side.cents}¢<small class="ml-1 text-base-content/40">{side.label} · current</small>
                    </span>
                    <span>·</span>
                    <a class="text-base-content/70 hover:text-primary" href={marketUrl(item.market.slug)}>Read the case</a>
                    <a class="hover:text-primary" href="/bookmarks">Save</a>
                    <span>{readTime(item.market)}</span>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/if}
</section>
