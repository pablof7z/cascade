<script lang="ts">
  import { browser } from '$app/environment';

  const fallbackOrigin = 'https://cascade.f7z.io';
  const embedOrigin = browser ? window.location.origin : fallbackOrigin;
</script>

<section class="section">
  <div class="page-header">
    <div class="eyebrow">Embed</div>
    <h1 class="page-title">Put a live market inside another site.</h1>
    <p class="page-subtitle">
      The embed route renders outside the main shell and is meant to carry a compact market view into another context.
    </p>
  </div>
</section>

<section class="surface panel section">
  <div class="eyebrow">How it works</div>
  <div class="content-prose">
    <p>Use the standalone route under <code>/embed/market/[slug]</code>.</p>
    <p>That route keeps the surface compact and avoids the main application shell.</p>
    <p>Choose a market slug and drop the iframe into your page.</p>
  </div>
  <pre class="surface panel mono" style="overflow:auto;"><code>{`<iframe
  src="${embedOrigin}/embed/market/YOUR_MARKET_SLUG"
  width="100%"
  height="540"
  style="border:0"
></iframe>`}</code></pre>
</section>
