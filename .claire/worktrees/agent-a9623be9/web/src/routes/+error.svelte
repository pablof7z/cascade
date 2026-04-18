<script lang="ts">
  import { page } from '$app/state';
</script>

<div class="hero min-h-[60vh]">
  <div class="hero-content text-center">
    <div class="grid gap-4">
      <div class="eyebrow">404</div>
      <h1 class="text-4xl font-bold tracking-tight">Page not found.</h1>
      <p class="text-base-content/60">No route matched <span class="font-mono">{page.url.pathname}</span>.</p>
      <div class="mt-4">
        <a class="btn btn-primary" href="/">Back to markets</a>
      </div>
    </div>
  </div>
</div>
