<script lang="ts">
  import qrcode from 'qrcode';

  let { value, size = 192 }: { value: string; size?: number } = $props();

  let dataUrl = $state<string | null>(null);

  $effect(() => {
    qrcode
      .toDataURL(value, {
        width: size,
        margin: 1,
        color: { dark: '#000000', light: '#00000000' }
      })
      .then((url) => {
        dataUrl = url;
      })
      .catch(() => {
        dataUrl = null;
      });
  });
</script>

{#if dataUrl}
  <img alt="QR code" src={dataUrl} style="width:{size}px;height:{size}px" />
{:else}
  <div class="wallet-qr-fallback" style="width:{size}px;height:{size}px"></div>
{/if}

<style>
  .wallet-qr-fallback {
    background: #262626;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.55; }
    50% { opacity: 1; }
  }
</style>
