<script lang="ts">
  import MarketSurface from '$lib/components/cascade/MarketSurface.svelte';
  import { trackEvent } from '$lib/analytics';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  $effect(() => {
    trackEvent('market_view', { marketId: data.market?.id, slug: data.market?.slug });
  });
</script>

<MarketSurface
  market={data.market}
  trades={data.trades}
  discussions={data.discussions}
  relatedMarkets={data.relatedMarkets}
  profiles={data.profiles}
  tab="overview"
/>
