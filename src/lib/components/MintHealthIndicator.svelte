<script lang="ts">
  let {
    mintUrl,
    mintHealthy = $bindable(true)
  }: { mintUrl: string; mintHealthy?: boolean } = $props();

  let status = $state<'checking' | 'connected' | 'degraded' | 'disconnected'>('checking');

  $effect(() => {
    let controller = new AbortController();

    async function checkHealth() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${mintUrl}/v1/info`, { signal: controller.signal });
        clearTimeout(timeout);
        if (res.ok) {
          status = 'connected';
        } else {
          status = 'degraded';
        }
      } catch {
        status = 'disconnected';
      }
      mintHealthy = status === 'connected';
    }

    checkHealth();
    const interval = setInterval(checkHealth, 30000);

    return () => {
      clearInterval(interval);
      controller.abort();
    };
  });

  const dotClass = $derived(
    status === 'connected'
      ? 'bg-emerald-500'
      : status === 'degraded'
        ? 'bg-rose-500'
        : status === 'disconnected'
          ? 'bg-rose-500'
          : 'bg-neutral-500 animate-pulse'
  );

  const label = $derived(
    status === 'connected'
      ? 'Mint connected'
      : status === 'degraded'
        ? 'Mint degraded'
        : status === 'disconnected'
          ? 'Mint offline'
          : 'Checking mint…'
  );
</script>

<div class="flex items-center gap-1.5">
  <span class="w-2 h-2 rounded-full {dotClass}"></span>
  <span class="text-xs text-neutral-500">{label}</span>
</div>
