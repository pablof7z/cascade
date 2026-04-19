<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="site-frame flex items-center justify-center min-h-[60vh]">
  <div class="text-center max-w-md mx-auto px-6">
    <div class="eyebrow">404</div>
    <h1 class="text-3xl font-bold tracking-tight mt-3">Page not found.</h1>
    <p class="text-base-content/60 mt-3">
      No route matched <span class="font-mono">{page.url.pathname}</span>.
    </p>
    <div class="mt-6">
      <a class="btn btn-primary" href="/">Back to markets</a>
    </div>
  </div>
</div>
