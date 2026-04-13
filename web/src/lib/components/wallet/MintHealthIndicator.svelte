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

<div class="wallet-health">
  <span class:connected={status === 'connected'} class:offline={status !== 'connected'}></span>
  <small>{label}</small>
</div>

<style>
  .wallet-health {
    display: flex;
    align-items: center;
    gap: 0.45rem;
  }

  .wallet-health span {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
  }

  .wallet-health span.connected {
    background: var(--color-success);
  }

  .wallet-health span.offline {
    background: var(--color-error);
  }

  .wallet-health small {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.76rem;
  }
</style>
