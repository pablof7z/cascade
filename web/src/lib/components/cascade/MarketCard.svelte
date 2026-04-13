<script lang="ts">
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import {
    formatProbability,
    formatRelativeTime,
    formatSats,
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
  const authorLabel = $derived(displayName(profile, shortPubkey(market.pubkey)));
</script>

<article class="grid gap-3 border-b border-neutral-800 py-4">
  <div class="flex items-center justify-between gap-4 text-xs text-neutral-500">
    <span>{formatRelativeTime(market.createdAt)}</span>
    <span>{discussionCount} discussion{discussionCount === 1 ? '' : 's'}</span>
  </div>

  <a
    class="text-xl font-heading font-semibold leading-tight text-white hover:text-neutral-200"
    href={marketUrl(market.slug)}
  >
    {market.title}
  </a>
  <p class="text-sm leading-6 text-neutral-400">
    {truncateText(market.description || market.body || 'No market summary yet.', 170)}
  </p>

  <dl class="grid gap-3 sm:grid-cols-3">
    <div class="grid gap-1">
      <dt class="text-xs uppercase tracking-[0.08em] text-neutral-500">Price</dt>
      <dd class="m-0 font-mono text-sm text-white">
        {formatProbability(tradeSummary?.latestPricePpm ? tradeSummary.latestPricePpm / 1_000_000 : null)}
      </dd>
    </div>
    <div class="grid gap-1">
      <dt class="text-xs uppercase tracking-[0.08em] text-neutral-500">Volume</dt>
      <dd class="m-0 font-mono text-sm text-white">{formatSats(tradeSummary?.grossVolume)}</dd>
    </div>
    <div class="grid gap-1">
      <dt class="text-xs uppercase tracking-[0.08em] text-neutral-500">Trades</dt>
      <dd class="m-0 font-mono text-sm text-white">{tradeSummary?.tradeCount ?? 0}</dd>
    </div>
  </dl>

  <div class="flex items-center justify-between gap-4 text-xs text-neutral-500">
    <span>by {authorLabel}</span>
    <a class="text-sm font-medium text-white hover:text-neutral-200" href={marketUrl(market.slug)}
      >Open market</a
    >
  </div>
</article>
