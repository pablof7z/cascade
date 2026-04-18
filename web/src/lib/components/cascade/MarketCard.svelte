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

<article class="grid gap-3 border-b border-base-300 py-4">
  <div class="flex items-center justify-between gap-4 text-xs text-base-content/50">
    <span>{formatRelativeTime(market.createdAt)}</span>
    <span>{discussionCount} discussion{discussionCount === 1 ? '' : 's'}</span>
  </div>

  <a
    class="text-xl font-heading font-semibold leading-tight text-white hover:text-base-content/90"
    href={marketUrl(market.slug)}
  >
    {market.title}
  </a>
  <p class="text-sm leading-6 text-base-content/50">
    {truncateText(market.description || market.body || 'No market summary yet.', 170)}
  </p>

  <dl class="grid gap-3 sm:grid-cols-3">
    <div class="grid gap-1">
      <dt class="text-xs uppercase tracking-[0.08em] text-base-content/50">Price</dt>
      <dd class="m-0 font-mono text-sm text-white">
        {formatProbability(tradeSummary?.latestPricePpm ? tradeSummary.latestPricePpm / 1_000_000 : null)}
      </dd>
    </div>
    <div class="grid gap-1">
      <dt class="text-xs uppercase tracking-[0.08em] text-base-content/50">Volume</dt>
      <dd class="m-0 font-mono text-sm text-white">{formatProductAmount(tradeSummary?.grossVolume, 'usd')}</dd>
    </div>
    <div class="grid gap-1">
      <dt class="text-xs uppercase tracking-[0.08em] text-base-content/50">Trades</dt>
      <dd class="m-0 font-mono text-sm text-white">{tradeSummary?.tradeCount ?? 0}</dd>
    </div>
  </dl>

  <div class="flex items-center justify-between gap-4 text-xs text-base-content/50">
    <span>by {authorLabel}</span>
    <a class="text-sm font-medium text-white hover:text-base-content/90" href={marketUrl(market.slug)}
      >Open market</a
    >
  </div>
</article>
