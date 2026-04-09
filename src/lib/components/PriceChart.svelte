<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, AreaSeries, LineSeries } from 'lightweight-charts';
  import type { IChartApi } from 'lightweight-charts';

  interface Props {
    marketSlug: string;
  }

  let { marketSlug }: Props = $props();

  interface PricePoint {
    timestamp: number;
    yes_price: number;
    no_price: number;
  }

  let container = $state<HTMLDivElement | undefined>(undefined);
  let chart: IChartApi | null = null;
  let empty = $state(false);

  async function fetchPriceHistory(): Promise<PricePoint[]> {
    try {
      const res = await fetch(`/api/market/${marketSlug}/price-history`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  onMount(async () => {
    if (!container) return;

    const data = await fetchPriceHistory();

    if (data.length === 0) {
      empty = true;
      return;
    }

    chart = createChart(container, {
      layout: {
        background: { color: '#0a0a0a' },
        textColor: '#737373',
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        vertLine: { color: '#404040' },
        horzLine: { color: '#404040' },
      },
      rightPriceScale: {
        borderColor: '#262626',
      },
      timeScale: {
        borderColor: '#262626',
        timeVisible: true,
      },
      width: container.clientWidth,
      height: 280,
    });

    const yesSeries = chart.addSeries(AreaSeries, {
      lineColor: '#10b981',
      topColor: 'rgba(16, 185, 129, 0.2)',
      bottomColor: 'rgba(16, 185, 129, 0)',
      lineWidth: 2,
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    const noSeries = chart.addSeries(LineSeries, {
      color: '#f43f5e',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    const yesData = data.map((p) => ({ time: p.timestamp as any, value: p.yes_price }));
    const noData = data.map((p) => ({ time: p.timestamp as any, value: p.no_price }));

    yesSeries.setData(yesData);
    noSeries.setData(noData);

    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chart && container) {
        chart.resize(container.clientWidth, 280);
      }
    });
    ro.observe(container);

    return () => ro.disconnect();
  });

  onDestroy(() => {
    chart?.remove();
    chart = null;
  });
</script>

<div class="w-full">
  {#if empty}
    <div class="flex items-center justify-center h-[280px] text-neutral-600 text-sm">
      No price history yet
    </div>
  {:else}
    <div bind:this={container} class="w-full h-[280px]"></div>
  {/if}
</div>
