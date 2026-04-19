<script lang="ts">
  import { browser } from '$app/environment';

  const fallbackOrigin = 'https://cascade.f7z.io';
  const embedOrigin = browser ? window.location.origin : fallbackOrigin;
</script>

<div class="page">
  <div class="eyebrow">Embed</div>
  <h1 class="text-2xl font-bold mt-2">Put a live market inside another site.</h1>
  <p class="text-base-content/70 mt-2">
    The embed route renders outside the main shell and is meant to carry a compact market view into another context.
  </p>
</div>

<div class="page">
  <div class="bg-base-200 rounded-lg border border-base-300 p-5">
    <div class="eyebrow">How it works</div>
    <div class="mt-4 space-y-3">
      <p>Use the standalone route under <code class="font-mono">/embed/market/[slug]</code>.</p>
      <p>That route keeps the surface compact and avoids the main application shell.</p>
      <p>Choose a market slug and drop the iframe into your page.</p>
    </div>
    <pre class="mt-4 p-4 bg-base-100 rounded-lg border border-base-300 overflow-auto font-mono text-sm">{`<iframe
  src="${embedOrigin}/embed/market/YOUR_MARKET_SLUG"
  width="100%"
  height="540"
  style="border:0"
></iframe>`}</pre>
  </div>
</div>
