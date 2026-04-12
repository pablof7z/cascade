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

<article class="market-card">
  <div class="market-card-topline">
    <span>{formatRelativeTime(market.createdAt)}</span>
    <span>{discussionCount} discussion{discussionCount === 1 ? '' : 's'}</span>
  </div>

  <a class="market-card-title" href={marketUrl(market.slug)}>{market.title}</a>
  <p class="market-card-summary">{truncateText(market.description || market.body || 'No market summary yet.', 170)}</p>

  <dl class="market-card-metrics">
    <div>
      <dt>Price</dt>
      <dd>{formatProbability(tradeSummary?.latestPricePpm ? tradeSummary.latestPricePpm / 1_000_000 : null)}</dd>
    </div>
    <div>
      <dt>Volume</dt>
      <dd>{formatSats(tradeSummary?.grossVolume)}</dd>
    </div>
    <div>
      <dt>Trades</dt>
      <dd>{tradeSummary?.tradeCount ?? 0}</dd>
    </div>
  </dl>

  <div class="market-card-footer">
    <span>by {authorLabel}</span>
    <a href={marketUrl(market.slug)}>Open market</a>
  </div>
</article>

<style>
  .market-card {
    display: grid;
    gap: 0.85rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .market-card-topline,
  .market-card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .market-card-title {
    color: var(--text-strong);
    font-size: 1.18rem;
    font-weight: 600;
    line-height: 1.2;
  }

  .market-card-title:hover,
  .market-card-title:focus-visible {
    color: var(--text);
    outline: none;
  }

  .market-card-summary {
    margin: 0;
    color: var(--text-muted);
    font-size: 0.95rem;
    line-height: 1.6;
  }

  .market-card-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  .market-card-metrics div {
    display: grid;
    gap: 0.2rem;
  }

  .market-card-metrics dt {
    color: var(--text-faint);
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .market-card-metrics dd {
    margin: 0;
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 0.94rem;
  }

  .market-card-footer a {
    color: var(--text-strong);
    font-size: 0.85rem;
  }

  @media (max-width: 640px) {
    .market-card-metrics {
      grid-template-columns: 1fr;
    }
  }
</style>
