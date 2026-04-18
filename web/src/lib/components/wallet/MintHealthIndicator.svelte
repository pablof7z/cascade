<script lang="ts">
  let {
    mintUrl,
    mintHealthy = $bindable(false)
  }: { mintUrl: string; mintHealthy?: boolean } = $props();

  let status = $state<'checking' | 'connected' | 'degraded' | 'disconnected'>('checking');

  $effect(() => {
    let controller = new AbortController();

    async function checkHealth() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`${mintUrl}/v1/info`, { signal: controller.signal });
        clearTimeout(timeout);
        status = response.ok ? 'connected' : 'degraded';
      } catch {
        status = 'disconnected';
      }
      mintHealthy = status === 'connected';
    }

    void checkHealth();
    const interval = setInterval(() => {
      void checkHealth();
    }, 30000);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  });

  const label = $derived(
    status === 'connected'
      ? 'Mint connected'
      : status === 'degraded'
        ? 'Mint degraded'
        : status === 'disconnected'
          ? 'Mint offline'
          : 'Checking mint...'
  );
</script>

<div class="flex items-center gap-2">
  <span class="size-[0.45rem] rounded-full {status === 'connected' ? 'bg-success' : status !== 'checking' ? 'bg-error' : 'bg-base-content/50'}"></span>
  <small class="text-base-content/50 text-xs">{label}</small>
</div>
