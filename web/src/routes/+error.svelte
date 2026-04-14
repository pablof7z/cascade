<script lang="ts">
  import { page } from '$app/state';
</script>

<section class="section">
  <div class="page-header">
    <div class="eyebrow">404</div>
    <h1 class="page-title">Page not found.</h1>
    <p class="page-subtitle">No route matched <span class="mono">{page.url.pathname}</span>.</p>
    <div class="button-row">
      <a class="btn btn-primary" href="/">Back to markets</a>
    </div>
  </div>
</section>
