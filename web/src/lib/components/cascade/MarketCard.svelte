<script lang="ts">
  import { displayName } from '$lib/ndk/format';
  import { formatProductAmount } from '$lib/cascade/format';
  import {
    formatProbability,
    formatRelativeTime,
    marketUrl,
    truncateText,
    type MarketRecord,
    type MarketTradeSummary
  } from '$lib/ndk/cascade';
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';

  let {
    market,
    tradeSummary,
    discussionCount = 0,
    profiles = {}
  }: {
    market: MarketRecord;
    tradeSummary?: MarketTradeSummary;
    discussionCount?: number;
    profiles?: Record<string, NDKUserProfile>;
  } = $props();

  const profile = $derived(profiles[market.pubkey]);
  const authorLabel = $derived(displayName(profile, 'Cascade user'));
</script>

<article class="card card-border bg-base-200 transition-colors hover:bg-base-300">
  <div class="card-body gap-3">
    <div class="flex items-center justify-between gap-4 text-xs text-base-content/50">
      <span>{formatRelativeTime(market.createdAt)}</span>
      <span>{discussionCount} discussion{discussionCount === 1 ? '' : 's'}</span>
    </div>

    <a class="card-title text-xl font-semibold leading-tight hover:text-base-content/80" href={marketUrl(market.slug)}>
      {market.title}
    </a>

    <p class="text-sm leading-6 text-base-content/60">
      {truncateText(market.description || market.body || 'No market summary yet.', 170)}
    </p>

    <div class="stats stats-horizontal w-full bg-base-300">
      <div class="stat py-2 px-3">
        <div class="stat-title text-xs">Price</div>
        <div class="stat-value font-mono text-sm">
          {formatProbability(tradeSummary?.latestPricePpm ? tradeSummary.latestPricePpm / 1_000_000 : null)}
        </div>
      </div>
      <div class="stat py-2 px-3">
        <div class="stat-title text-xs">Volume</div>
        <div class="stat-value font-mono text-sm">{formatProductAmount(tradeSummary?.grossVolume, 'usd')}</div>
      </div>
      <div class="stat py-2 px-3">
        <div class="stat-title text-xs">Trades</div>
        <div class="stat-value font-mono text-sm">{tradeSummary?.tradeCount ?? 0}</div>
      </div>
    </div>

    <div class="flex items-center justify-between gap-4 text-xs text-base-content/50">
      <span>by {authorLabel}</span>
      <a class="text-sm font-medium text-base-content hover:text-base-content/80" href={marketUrl(market.slug)}>Open market</a>
    </div>
  </div>
</article>
