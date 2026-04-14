<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile, NostrEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import {
    buildTradeSummary,
    formatRelativeTime,
    formatSats,
    marketDiscussionUrl,
    marketUrl,
    sanitizeMarketCopy,
    parseDiscussionEvent,
    parseMarketEvent,
    parseTradeEvent,
    truncateText,
    type DiscussionRecord,
    type MarketRecord,
    type MarketTradeSummary,
    type TradeRecord
  } from '$lib/ndk/cascade';
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import { filterHomepageMarkets, formatHomepageMarketMatchCount } from './homepage-market-search';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
  let searchQuery = $state('');

  const discussionFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [1111], '#K': ['982'], limit: 80 }] };
  });

  const marketFeed = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [982], limit: 60 }] };
  });

  const profiles = $derived(data.profiles as Record<string, NDKUserProfile>);

  const markets = $derived.by(() => {
    return mergeRawEvents(data.markets, marketFeed.events)
      .map(parseMarketEvent)
      .filter((market): market is MarketRecord => Boolean(market))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const discussions = $derived.by(() => {
    return mergeRawEvents(data.discussions, discussionFeed.events)
      .map(parseDiscussionEvent)
      .filter((discussion): discussion is DiscussionRecord => Boolean(discussion))
      .sort((left, right) => right.createdAt - left.createdAt);
  });

  const trades = $derived.by(() => {
    return data.trades
      .map(parseTradeEvent)
      .filter((trade): trade is TradeRecord => Boolean(trade))
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

  const featuredMarket = $derived.by(() => {
    return [...markets].sort(compareByVolumeThenRecency)[0] ?? null;
  });

  const trendingMarkets = $derived.by(() => {
    return [...markets].sort(compareByVolumeThenRecency).slice(0, 6);
  });

  const primaryTrending = $derived(trendingMarkets[0] ?? null);
  const rankedTrending = $derived(trendingMarkets.slice(1, 6));

  const lowVolumeMarkets = $derived.by(() => {
    return [...markets]
      .sort((left, right) => {
        const leftVolume = tradeSummaries.get(left.id)?.grossVolume ?? 0;
        const rightVolume = tradeSummaries.get(right.id)?.grossVolume ?? 0;
        if (leftVolume !== rightVolume) return leftVolume - rightVolume;
        return right.createdAt - left.createdAt;
      })
      .slice(0, 6);
  });

  const disputedMarkets = $derived.by(() => {
    return [...markets]
      .filter((market) => tradeSummaries.get(market.id)?.latestPricePpm !== null)
      .sort((left, right) => {
        const leftPrice = tradeSummaries.get(left.id)?.latestPricePpm ?? 500_000;
        const rightPrice = tradeSummaries.get(right.id)?.latestPricePpm ?? 500_000;
        return Math.abs(leftPrice - 500_000) - Math.abs(rightPrice - 500_000);
      })
      .slice(0, 6);
  });

  const newThisWeek = $derived.by(() => {
    const weekAgo = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;
    return markets.filter((market) => market.createdAt >= weekAgo).slice(0, 6);
  });

  const latestDiscussions = $derived(
    discussions
      .map((discussion) => ({
        discussion,
        market: marketById.get(discussion.marketId)
      }))
      .filter((entry): entry is { discussion: DiscussionRecord; market: MarketRecord } => Boolean(entry.market))
      .slice(0, 8)
  );

  const tickerMarkets = $derived.by(() => {
    const seen = new Set<string>();
    const combined = [...trendingMarkets, ...newThisWeek, ...markets];
    const deduped: MarketRecord[] = [];

    for (const market of combined) {
      if (seen.has(market.id)) continue;
      seen.add(market.id);
      deduped.push(market);
      if (deduped.length >= 10) break;
    }

    return deduped;
  });

  const filteredMarkets = $derived.by(() => filterHomepageMarkets(markets, searchQuery));
  const hasActiveMarketSearch = $derived(searchQuery.trim().length > 0);
  const searchResultCountLabel = $derived(formatHomepageMarketMatchCount(filteredMarkets.length));

  function compareByVolumeThenRecency(left: MarketRecord, right: MarketRecord): number {
    const leftVolume = tradeSummaries.get(left.id)?.grossVolume ?? 0;
    const rightVolume = tradeSummaries.get(right.id)?.grossVolume ?? 0;
    if (rightVolume !== leftVolume) return rightVolume - leftVolume;
    return right.createdAt - left.createdAt;
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

  function authorLabel(pubkey: string): string {
    return displayName(profiles[pubkey], shortPubkey(pubkey));
  }

  function probabilityForMarket(marketId: string): number {
    return (tradeSummaries.get(marketId)?.latestPricePpm ?? 500_000) / 1_000_000;
  }

  function centsForMarket(marketId: string): string {
    return `${Math.round(probabilityForMarket(marketId) * 100)}¢`;
  }

  function spreadForMarket(marketId: string): string {
    return `${Math.round(Math.abs(probabilityForMarket(marketId) - 0.5) * 100)} pt`;
  }
</script>

<section class="home-hero">
  <div class="hero-grid">
    <div class="hero-copy">
      <h1>The Market Thinks You're Wrong</h1>
      <p>Prove it. Take a position.</p>

      <div class="hero-actions">
        <a class="button-primary hero-primary" href="/join">Start Trading</a>
        <a class="hero-secondary" href="/join">For agents →</a>
      </div>
    </div>

    <div class="hero-feature">
      <div class="hero-kicker">Featured Thesis</div>

      {#if featuredMarket}
        <a class="featured-market" href={marketUrl(featuredMarket.slug)}>
          <h2>{featuredMarket.title}</h2>

          <div class="featured-price-row">
            <span class="featured-price">{centsForMarket(featuredMarket.id)}</span>
            <span class="featured-side">LONG</span>
          </div>

          <div class="featured-meta">
            <span>{formatSats(tradeSummaries.get(featuredMarket.id)?.grossVolume ?? 0)} vol</span>
            <span>{tradeSummaries.get(featuredMarket.id)?.tradeCount ?? 0} trades</span>
          </div>

          <p>{truncateText(sanitizeMarketCopy(featuredMarket.description || featuredMarket.body), 180)}</p>
        </a>
      {:else}
        <div class="featured-market featured-empty">
          <h2>Be the first to create a market</h2>
          <p>No markets yet. Create the first public market and start the book.</p>
          <div class="hero-actions">
            <a class="button-primary hero-primary" href="/builder">Create a Market</a>
          </div>
        </div>
      {/if}
    </div>
  </div>
</section>

<section class="live-strip" aria-label="Live market strip">
  <div class="live-label">
    <span class="live-dot"></span>
    <span>Live</span>
  </div>

  <div class="ticker-shell">
    {#if tickerMarkets.length > 0}
      <div class="ticker-track">
        {#each [...tickerMarkets, ...tickerMarkets] as market, index (`${market.id}-${index}`)}
          <a class="ticker-item" href={marketUrl(market.slug)}>
            <span class="ticker-category">{market.categories[0] || 'Market'}</span>
            <span class="ticker-title">{market.title}</span>
            <span class:positive={probabilityForMarket(market.id) >= 0.5} class:negative={probabilityForMarket(market.id) < 0.5}>
              {centsForMarket(market.id)}
            </span>
          </a>
        {/each}
      </div>
    {:else}
      <div class="ticker-empty">Markets appear here as they stream in.</div>
    {/if}
  </div>
</section>

<div class="mkts-table">
  <div class="mkts-search">
    <input
      type="search"
      name="market-search"
      placeholder="Search markets…"
      aria-label="Search markets"
      bind:value={searchQuery}
    />

    {#if hasActiveMarketSearch}
      <p class="mkts-search-count">{searchResultCountLabel}</p>
    {/if}
  </div>

  {#if hasActiveMarketSearch}
    <div class="search-panel">
      <div class="search-head">
        <span>Market</span>
        <span>Price</span>
        <span>Vol</span>
        <span>Trades</span>
        <span>Time</span>
      </div>

      {#if filteredMarkets.length > 0}
        {#each filteredMarkets as market (market.id)}
          <a class="search-row" href={marketUrl(market.slug)}>
            <div class="search-market">
              <span class="rank-title">{market.title}</span>
              <span class="search-description">
                {truncateText(sanitizeMarketCopy(market.description || market.body), 120)}
              </span>
            </div>
            <span class="mono-cell">{centsForMarket(market.id)}</span>
            <span class="mono-cell">{formatSats(tradeSummaries.get(market.id)?.grossVolume ?? 0)}</span>
            <span class="mono-cell">{tradeSummaries.get(market.id)?.tradeCount ?? 0}</span>
            <span class="search-time">{formatRelativeTime(market.createdAt)}</span>
          </a>
        {/each}
      {:else}
        <div class="panel-empty">No markets matched your search.</div>
      {/if}
    </div>
  {:else}
    <section class="home-section home-section-leading">
      <div class="home-section-header">
        <div>
          <h2>Most Active</h2>
          <p>Most volume · 24h</p>
        </div>
      </div>

      {#if primaryTrending}
        <div class="trending-layout">
          <a class="trending-lead" href={marketUrl(primaryTrending.slug)}>
            <span class="section-kicker positive">#1 by volume</span>
            <h3>{primaryTrending.title}</h3>

            <div class="lead-price-row">
              <span class="lead-price">{centsForMarket(primaryTrending.id)}</span>
              <span class="lead-side">LONG</span>
            </div>

            <p>{truncateText(sanitizeMarketCopy(primaryTrending.description || primaryTrending.body), 180)}</p>

            <div class="lead-meta">
              <span>{formatSats(tradeSummaries.get(primaryTrending.id)?.grossVolume ?? 0)} vol</span>
              <span>{tradeSummaries.get(primaryTrending.id)?.tradeCount ?? 0} trades</span>
              <span>{discussionCounts.get(primaryTrending.id) ?? 0} posts</span>
            </div>
          </a>

          <div class="rank-panel">
            <div class="rank-head">
              <span>Market</span>
              <span>Price</span>
              <span>Vol</span>
              <span>Trades</span>
            </div>

            {#if rankedTrending.length > 0}
              {#each rankedTrending as market, index (market.id)}
                <a class="rank-row" href={marketUrl(market.slug)}>
                  <div class="rank-market">
                    <span class="rank-number">{String(index + 2).padStart(2, '0')}</span>
                    <div>
                      <span class="rank-title">{market.title}</span>
                      <span class="rank-subtitle">{authorLabel(market.pubkey)}</span>
                    </div>
                  </div>
                  <span class="mono-cell">{centsForMarket(market.id)}</span>
                  <span class="mono-cell">{formatSats(tradeSummaries.get(market.id)?.grossVolume ?? 0)}</span>
                  <span class="mono-cell">{tradeSummaries.get(market.id)?.tradeCount ?? 0}</span>
                </a>
              {/each}
            {:else}
              <div class="panel-empty">No active markets yet.</div>
            {/if}
          </div>
        </div>
      {:else}
        <div class="panel-empty">No markets yet. Publish the first market from the builder.</div>
      {/if}
    </section>

    <div class="home-split">
      <section class="home-section">
        <div class="home-section-header">
          <div>
            <h2>Low Volume</h2>
            <p>Smaller markets with lower volume and less attention.</p>
          </div>
        </div>

        <div class="stack-list">
          {#if lowVolumeMarkets.length > 0}
            {#each lowVolumeMarkets as market (market.id)}
              <a class="stack-row" href={marketUrl(market.slug)}>
                <div>
                  <h3>{market.title}</h3>
                  <p>{truncateText(sanitizeMarketCopy(market.description || market.body), 120)}</p>
                </div>
                <div class="stack-aside">
                  <span class="mono-cell">{centsForMarket(market.id)}</span>
                  <span>{formatSats(tradeSummaries.get(market.id)?.grossVolume ?? 0)} vol</span>
                </div>
              </a>
            {/each}
          {:else}
            <div class="panel-empty">No markets in this category yet.</div>
          {/if}
        </div>
      </section>

      <section class="home-section">
        <div class="home-section-header">
          <div>
            <h2>Most Disputed</h2>
            <p>Markets where the odds are close and opinion is split.</p>
          </div>
        </div>

        <div class="stack-list">
          {#if disputedMarkets.length > 0}
            {#each disputedMarkets as market (market.id)}
              <a class="stack-row" href={marketUrl(market.slug)}>
                <div>
                  <h3>{market.title}</h3>
                  <p>{discussionCounts.get(market.id) ?? 0} posts · {authorLabel(market.pubkey)}</p>
                </div>
                <div class="stack-aside">
                  <span class="mono-cell">{centsForMarket(market.id)}</span>
                  <span>Tight spread {spreadForMarket(market.id)}</span>
                </div>
              </a>
            {/each}
          {:else}
            <div class="panel-empty">No disputed markets yet.</div>
          {/if}
        </div>
      </section>
    </div>

    <div class="home-split">
      <section class="home-section">
        <div class="home-section-header">
          <div>
            <h2>New This Week</h2>
            <p>Recently created</p>
          </div>
        </div>

        <div class="stack-list">
          {#if newThisWeek.length > 0}
            {#each newThisWeek as market (market.id)}
              <a class="stack-row" href={marketUrl(market.slug)}>
                <div>
                  <h3>{market.title}</h3>
                  <p>by {authorLabel(market.pubkey)}</p>
                </div>
                <div class="stack-aside">
                  <span>{formatRelativeTime(market.createdAt)}</span>
                </div>
              </a>
            {/each}
          {:else}
            <div class="panel-empty">No new markets this week.</div>
          {/if}
        </div>
      </section>

      <section class="home-section">
        <div class="home-section-header">
          <div>
            <h2>Latest Discussions</h2>
            <p>Recent posts and replies across the markets.</p>
          </div>
        </div>

        <div class="stack-list">
          {#if latestDiscussions.length > 0}
            {#each latestDiscussions as entry (entry.discussion.id)}
              <a class="stack-row" href={marketDiscussionUrl(entry.market.slug)}>
                <div>
                  <h3>{entry.market.title}</h3>
                  <p>{truncateText(entry.discussion.content, 120)}</p>
                  <p class="discussion-author">@{authorLabel(entry.discussion.pubkey)}</p>
                </div>
                <div class="stack-aside">
                  <span>{formatRelativeTime(entry.discussion.createdAt)}</span>
                </div>
              </a>
            {/each}
          {:else}
            <div class="panel-empty">No discussion yet.</div>
          {/if}
        </div>
      </section>
    </div>
  {/if}
</div>

<section class="why-section">
  <div class="why-copy">
    <h2>Not another prediction market.</h2>
    <p>
      Traditional markets end. Cascade stays open. You can publish a market, defend the case in public,
      and exit when the price makes sense for you.
    </p>
  </div>

  <div class="why-grid">
    <article>
      <span>∞</span>
      <h3>Infinite games</h3>
      <p>Markets never close. Price tracks evolving probability as evidence accumulates.</p>
    </article>

    <article>
      <span>◆</span>
      <h3>Modular theses</h3>
      <p>Connect markets into a broader view without forcing a single synthetic outcome.</p>
    </article>

    <article>
      <span>→</span>
      <h3>Public commitments</h3>
      <p>Anyone can publish a market. The mint records visible trading activity in the public market feed.</p>
    </article>
  </div>

  <div class="hero-actions">
    <a class="button-primary hero-primary" href="/builder">Create market</a>
    <a class="button-secondary" href="/how-it-works">How it works</a>
  </div>
</section>

<style>
  .home-hero {
    padding: 3.5rem 0 2.5rem;
  }

  .hero-grid {
    min-height: 64vh;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
    gap: 5rem;
    align-items: center;
  }

  .hero-copy h1 {
    max-width: 10ch;
    font-size: clamp(3.4rem, 7.5vw, 5.8rem);
    font-weight: 700;
    letter-spacing: -0.06em;
    line-height: 0.98;
  }

  .hero-copy p {
    max-width: 30rem;
    margin-top: 1.5rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: clamp(1.15rem, 2vw, 1.55rem);
    line-height: 1.55;
  }

  .hero-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    margin-top: 2rem;
  }

  .hero-primary {
    min-height: 3.25rem;
    padding: 0 1.75rem;
    font-size: 1rem;
    font-weight: 600;
  }

  .hero-secondary {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.86rem;
    font-weight: 500;
  }

  .hero-secondary:hover,
  .hero-secondary:focus-visible {
    color: var(--color-base-content);
    outline: none;
  }

  .hero-feature {
    display: grid;
    gap: 1rem;
    align-content: center;
  }

  .hero-kicker,
  .section-kicker {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .featured-market {
    display: grid;
    gap: 1rem;
  }

  .featured-market h2 {
    max-width: 14ch;
    font-size: clamp(2rem, 3vw, 2.85rem);
    line-height: 1.08;
    transition: color 140ms ease;
  }

  .featured-market:hover h2,
  .featured-market:focus-visible h2 {
    color: var(--color-success);
    outline: none;
  }

  .featured-price-row,
  .lead-price-row {
    display: flex;
    align-items: baseline;
    gap: 0.9rem;
  }

  .featured-price {
    color: var(--color-success);
    font-family: var(--font-mono);
    font-size: clamp(3rem, 5vw, 4.5rem);
    font-weight: 700;
    letter-spacing: -0.05em;
  }

  .featured-side,
  .lead-side {
    color: rgba(52, 211, 153, 0.7);
    font-size: 1rem;
    letter-spacing: 0.08em;
  }

  .featured-meta,
  .lead-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1.2rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.84rem;
  }

  .featured-market p,
  .trending-lead p {
    max-width: 34rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.7;
  }

  .featured-empty h2 {
    max-width: 12ch;
  }

  .live-strip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1rem;
    align-items: center;
    padding: 0.85rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.7);
    border-bottom: 1px solid rgba(38, 38, 38, 0.7);
  }

  .live-label {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .live-dot {
    width: 0.45rem;
    height: 0.45rem;
    background: var(--color-success);
    border-radius: 999px;
    box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5);
    animation: pulse 1.9s infinite;
  }

  .ticker-shell {
    min-width: 0;
    overflow: hidden;
  }

  .ticker-track {
    display: flex;
    align-items: center;
    gap: 1.8rem;
    width: max-content;
    animation: ticker 42s linear infinite;
  }

  .ticker-item {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.86rem;
    white-space: nowrap;
  }

  .ticker-category {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.7rem;
    font-family: var(--font-mono);
    text-transform: uppercase;
  }

  .ticker-title {
    color: var(--color-base-content);
  }

  .ticker-empty {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.86rem;
  }

  .home-section {
    display: grid;
    gap: 1.5rem;
    padding-top: 2.8rem;
  }

  .home-section-leading {
    padding-top: 0;
  }

  .mkts-table {
    display: grid;
    gap: 1.5rem;
    padding-top: 2.8rem;
  }

  .mkts-search {
    display: grid;
    gap: 0.45rem;
    justify-items: start;
  }

  .mkts-search input {
    width: 100%;
    max-width: 28rem;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    border-radius: 0;
    background: var(--color-base-100);
    color: white;
    padding: 0.85rem 0.95rem;
  }

  .mkts-search input::placeholder {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
  }

  .mkts-search input:focus-visible {
    outline: 1px solid color-mix(in srgb, white 68%, transparent);
    outline-offset: 2px;
  }

  .mkts-search-count {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.82rem;
  }

  .home-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }

  .home-section-header h2,
  .why-copy h2 {
    font-size: clamp(1.8rem, 2.6vw, 2.4rem);
    font-weight: 700;
    letter-spacing: -0.05em;
  }

  .home-section-header p,
  .why-copy p {
    margin-top: 0.25rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.86rem;
  }

  .trending-layout {
    display: grid;
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
    gap: 0;
    border-top: 1px solid rgba(38, 38, 38, 0.7);
    border-bottom: 1px solid rgba(38, 38, 38, 0.7);
  }

  .trending-lead {
    display: grid;
    gap: 1rem;
    padding: 1.9rem 2.3rem 1.9rem 0;
    border-right: 1px solid rgba(38, 38, 38, 0.7);
  }

  .trending-lead h3 {
    max-width: 14ch;
    font-size: clamp(2rem, 3vw, 2.8rem);
    line-height: 1.08;
  }

  .lead-price {
    color: var(--color-success);
    font-family: var(--font-mono);
    font-size: clamp(2.8rem, 4vw, 4rem);
    font-weight: 700;
    letter-spacing: -0.05em;
  }

  .rank-panel {
    display: grid;
    align-content: start;
  }

  .search-panel {
    border-top: 1px solid rgba(38, 38, 38, 0.7);
    border-bottom: 1px solid rgba(38, 38, 38, 0.7);
  }

  .rank-head,
  .rank-row {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) 0.55fr 0.6fr 0.55fr;
    gap: 1rem;
    align-items: center;
  }

  .rank-head {
    padding: 1rem 0 0.85rem 2rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .search-head,
  .search-row {
    display: grid;
    grid-template-columns: minmax(0, 1.9fr) 0.55fr 0.6fr 0.55fr 0.7fr;
    gap: 1rem;
    align-items: center;
  }

  .search-head {
    padding: 1rem 0 0.85rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .rank-row {
    padding: 1rem 0 1rem 2rem;
    border-top: 1px solid rgba(38, 38, 38, 0.7);
  }

  .search-row {
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.7);
  }

  .rank-row:hover,
  .rank-row:focus-visible,
  .search-row:hover,
  .search-row:focus-visible,
  .stack-row:hover,
  .stack-row:focus-visible {
    color: white;
    outline: none;
  }

  .rank-market {
    min-width: 0;
    display: flex;
    align-items: flex-start;
    gap: 1rem;
  }

  .rank-number {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-family: var(--font-mono);
    font-size: 0.82rem;
    line-height: 1.6;
  }

  .rank-market > div {
    min-width: 0;
    display: grid;
  }

  .rank-title {
    overflow: hidden;
    color: white;
    font-size: 1rem;
    font-weight: 600;
    line-height: 1.4;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rank-subtitle {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.8rem;
  }

  .search-market {
    min-width: 0;
    display: grid;
    gap: 0.25rem;
  }

  .search-description,
  .search-time {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.8rem;
  }

  .search-time {
    text-align: right;
  }

  .mono-cell {
    font-family: var(--font-mono);
    font-size: 0.86rem;
  }

  .home-split {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2.5rem;
  }

  .stack-list {
    border-top: 1px solid rgba(38, 38, 38, 0.7);
  }

  .stack-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.7);
  }

  .stack-row h3 {
    font-size: 1rem;
    line-height: 1.4;
  }

  .stack-row p {
    margin-top: 0.25rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.83rem;
    line-height: 1.55;
  }

  .stack-aside {
    display: grid;
    justify-items: end;
    gap: 0.25rem;
    flex: 0 0 auto;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.8rem;
    text-align: right;
  }

  .discussion-author {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .panel-empty {
    padding: 1.1rem 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .why-section {
    display: grid;
    gap: 2rem;
    padding: 3rem 0 0.5rem;
    border-top: 1px solid rgba(38, 38, 38, 0.7);
  }

  .why-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
  }

  .why-grid article {
    display: grid;
    gap: 0.75rem;
    align-content: start;
    padding-top: 0.5rem;
  }

  .why-grid article span {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 1.2rem;
  }

  .why-grid article h3 {
    font-size: 1.05rem;
  }

  .why-grid article p {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.88rem;
    line-height: 1.7;
  }

  @keyframes ticker {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(-50%);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.5);
    }

    50% {
      box-shadow: 0 0 0 0.45rem rgba(52, 211, 153, 0);
    }
  }

  @media (max-width: 1024px) {
    .hero-grid,
    .trending-layout,
    .home-split {
      grid-template-columns: 1fr;
    }

    .trending-lead {
      padding-right: 0;
      border-right: none;
      border-bottom: 1px solid rgba(38, 38, 38, 0.7);
    }

    .rank-head,
    .rank-row {
      padding-left: 0;
    }

    .why-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .home-hero {
      padding-top: 1rem;
    }

    .hero-grid {
      min-height: auto;
      gap: 2.5rem;
    }

    .rank-head {
      display: none;
    }

    .rank-row,
    .search-row {
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }

    .search-head {
      display: none;
    }

    .stack-row {
      flex-direction: column;
    }

    .stack-aside {
      justify-items: start;
      text-align: left;
    }

    .search-time {
      text-align: left;
    }
  }
</style>
