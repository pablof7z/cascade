<script lang="ts">
  import { formatProductAmount } from '$lib/cascade/format';
  import { buildTradeSummary, formatProbability } from '$lib/ndk/cascade';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const summary = $derived(buildTradeSummary(data.trades));
</script>

<svelte:head>
  <meta name="robots" content="index,follow" />
</svelte:head>

<div class="embed-market-shell">
  <article class="embed-market-card" aria-label="Embedded market summary">
    <div class="embed-market-eyebrow">Embedded market</div>
    <h1 class="embed-market-title">{data.market.title}</h1>
    <p class="embed-market-description">{data.market.description}</p>

    <div class="embed-market-metrics" aria-label="Market metrics">
      <div class="embed-market-metric">
        <div class="embed-market-label">Price</div>
        <div class="embed-market-value">{formatProbability(summary.latestPricePpm ? summary.latestPricePpm / 1_000_000 : null)}</div>
      </div>
      <div class="embed-market-metric">
        <div class="embed-market-label">Volume</div>
        <div class="embed-market-value">{formatProductAmount(summary.grossVolume, 'usd')}</div>
      </div>
      <div class="embed-market-metric">
        <div class="embed-market-label">Trades</div>
        <div class="embed-market-value">{summary.tradeCount}</div>
      </div>
    </div>

    <a class="embed-market-link" href="/market/{data.market.slug}">Open full market</a>
  </article>
</div>

<style>
  .embed-market-shell {
    min-height: 100vh;
    box-sizing: border-box;
    padding: clamp(0.75rem, 3vw, 1rem);
    background: var(--color-base-100);
    color: var(--color-base-content);
  }

  .embed-market-shell :global(*) {
    box-sizing: border-box;
  }

  .embed-market-card {
    display: grid;
    gap: 0.75rem;
    width: min(100%, 42rem);
    padding: clamp(0.85rem, 3vw, 1rem);
    border: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    background: var(--color-base-200);
  }

  .embed-market-eyebrow,
  .embed-market-label {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.72rem;
  }

  .embed-market-eyebrow {
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .embed-market-title {
    margin: 0;
    color: var(--color-base-content);
    font-size: clamp(1.15rem, 6vw, 1.35rem);
    line-height: 1.2;
  }

  .embed-market-description {
    margin: 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .embed-market-metrics {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    background: var(--color-base-300);
  }

  .embed-market-metric {
    display: grid;
    gap: 0.35rem;
    min-width: 0;
    padding: 0.75rem;
    background: var(--color-base-200);
  }

  .embed-market-value {
    overflow-wrap: anywhere;
    color: var(--color-base-content);
    font-family: var(--font-mono);
  }

  .embed-market-link {
    color: var(--color-base-content);
    text-decoration: underline;
    text-underline-offset: 0.25rem;
  }

  .embed-market-link:hover,
  .embed-market-link:focus-visible {
    color: var(--color-primary);
  }

  @media (max-width: 420px) {
    .embed-market-metrics {
      grid-template-columns: 1fr;
    }
  }
</style>
