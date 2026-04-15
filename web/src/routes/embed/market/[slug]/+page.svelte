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

<div style="padding: 1rem; background: #0a0a0a; color: #fff; min-height: 100vh; box-sizing: border-box;">
  <div style="border: 1px solid #262626; background: #171717; padding: 1rem; display: grid; gap: 0.75rem;">
    <div style="font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: #737373;">Embedded market</div>
    <h1 style="margin: 0; font-size: 1.35rem; line-height: 1.2;">{data.market.title}</h1>
    <p style="margin: 0; color: #a3a3a3;">{data.market.description}</p>
    <div style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; background: #262626;">
      <div style="background: #171717; padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: #737373;">Price</div>
        <div style="font-family: 'JetBrains Mono', monospace;">{formatProbability(summary.latestPricePpm ? summary.latestPricePpm / 1_000_000 : null)}</div>
      </div>
      <div style="background: #171717; padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: #737373;">Volume</div>
        <div style="font-family: 'JetBrains Mono', monospace;">{formatProductAmount(summary.grossVolume, 'usd')}</div>
      </div>
      <div style="background: #171717; padding: 0.75rem;">
        <div style="font-size: 0.72rem; color: #737373;">Trades</div>
        <div style="font-family: 'JetBrains Mono', monospace;">{summary.tradeCount}</div>
      </div>
    </div>
    <a href="/market/{data.market.slug}" style="color: #fff; text-decoration: underline; text-underline-offset: 0.25rem;">Open full market</a>
  </div>
</div>
