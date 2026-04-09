<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { createChart, AreaSeries } from 'lightweight-charts';
  import type { IChartApi } from 'lightweight-charts';

  interface Props {
    slug: string;
    height?: number;
  }

  let { slug, height = 40 }: Props = $props();

  interface PricePoint {
    timestamp: number;
    yes_price: number;
    no_price: number;
  }

  let container = $state<HTMLDivElement | undefined>(undefined);
  let chart: IChartApi | null = null;
  let hasData = $state(false);

  async function fetchPriceHistory(): Promise<PricePoint[]> {
    try {
      const res = await fetch(`/api/market/${slug}/price-history?limit=50`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  onMount(async () => {
    if (!container) return;

    const data = await fetchPriceHistory();
    if (data.length === 0) return;

    hasData = true;

    chart = createChart(container, {
      width: container.clientWidth,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: 'transparent',
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { visible: false },
      },
      crosshair: { mode: 0 },
      rightPriceScale: { visible: false },
      leftPriceScale: { visible: false },
      timeScale: { visible: false },
      handleScroll: false,
      handleScale: false,
    });

    const yesSeries = chart.addSeries(AreaSeries, {
      lineColor: '#10b981',
      topColor: 'rgba(16, 185, 129, 0.15)',
      bottomColor: 'rgba(16, 185, 129, 0)',
      lineWidth: 1,
      priceFormat: { type: 'price', precision: 3, minMove: 0.001 },
    });

    yesSeries.setData(data.map((p) => ({ time: p.timestamp as any, value: p.yes_price })));
    chart.timeScale().fitContent();

    const ro = new ResizeObserver(() => {
      if (chart && container) {
        chart.resize(container.clientWidth, height);
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

<div
  bind:this={container}
  style="height: {hasData ? height : 0}px; overflow: hidden;"
></div>
