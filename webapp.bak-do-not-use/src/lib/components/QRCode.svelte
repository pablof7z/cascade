<script lang="ts">
  import qrcode from 'qrcode';

  let { value, size = 200 }: { value: string; size?: number } = $props();

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
  <img src={dataUrl} alt="QR Code" class="block" style="width:{size}px;height:{size}px" />
{:else}
  <div class="bg-neutral-800 animate-pulse" style="width:{size}px;height:{size}px"></div>
{/if}
