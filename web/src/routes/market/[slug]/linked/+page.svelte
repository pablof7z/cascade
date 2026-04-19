<script lang="ts">
  import MarketSurface from '$lib/components/cascade/MarketSurface.svelte';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();
</script>

<MarketSurface
  market={data.market}
  trades={data.trades}
  discussions={data.discussions}
  relatedMarkets={data.relatedMarkets}
  profiles={data.profiles}
  tab="linked"
/>
