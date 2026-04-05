<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { browser } from '$app/environment';

  interface Props {
    marketId: string;
    marketTitle: string;
    isOpen: boolean;
    onClose: () => void;
  }

  let { marketId, marketTitle, isOpen, onClose }: Props = $props();

  let theme = $state<'dark' | 'light'>('dark');
  let copied = $state(false);

  let baseUrl = $derived(browser ? window.location.origin : 'https://cascade.bet');
  let embedUrl = $derived(`${baseUrl}/embed/market/${marketId}${theme === 'light' ? '?theme=light' : ''}`);
  let iframeCode = $derived(`<iframe src="${embedUrl}" width="380" height="200" frameborder="0" style="border-radius: 12px; max-width: 100%;"></iframe>`);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(iframeCode);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = iframeCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      copied = true;
      setTimeout(() => copied = false, 2000);
    }
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center" transition:fade={{ duration: 200 }}>
    <!-- Backdrop -->
    <div 
      class="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onclick={onClose}
      role="button"
      tabindex="-1"
      aria-label="Close modal"
      onkeydown={(e) => e.key === 'Escape' && onClose()}
    />

    <!-- Modal -->
    <div 
      class="relative bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg mx-4 p-6 shadow-2xl"
      transition:scale={{ duration: 200, easing: cubicOut }}
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-lg font-semibold text-white">Embed Market</h2>
        <button
          onclick={onClose}
          class="text-neutral-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5L15 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <!-- Market title -->
      <p class="text-sm text-neutral-400 mb-4 line-clamp-2">
        {marketTitle}
      </p>

      <!-- Theme selector -->
      <div class="mb-4">
        <label class="block text-sm text-neutral-500 mb-2">Theme</label>
        <div class="flex gap-2">
          <button
            onclick={() => theme = 'dark'}
            class="px-4 py-2 text-sm font-medium transition-colors {
              theme === 'dark'
                ? 'bg-neutral-700 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }"
          >
            Dark
          </button>
          <button
            onclick={() => theme = 'light'}
            class="px-4 py-2 text-sm font-medium transition-colors {
              theme === 'light'
                ? 'bg-neutral-700 text-white'
                : 'bg-neutral-800 text-neutral-400 hover:text-white'
            }"
          >
            Light
          </button>
        </div>
      </div>

      <!-- Preview -->
      <div class="mb-4">
        <label class="block text-sm text-neutral-500 mb-2">Preview</label>
        <div class="overflow-hidden border {theme === 'dark' ? 'border-neutral-700 bg-neutral-950' : 'border-neutral-200 bg-white'} p-3">
          <iframe
            src={embedUrl}
            width="100%"
            height="180"
            frameBorder="0"
            style="border-radius: 12px;"
            title="Embed preview"
          />
        </div>
      </div>

      <!-- Code -->
      <div class="mb-6">
        <label class="block text-sm text-neutral-500 mb-2">Embed Code</label>
        <div class="relative">
          <pre class="bg-neutral-800 border border-neutral-700 p-3 text-xs text-neutral-300 overflow-x-auto whitespace-pre-wrap break-all">
            {iframeCode}
          </pre>
        </div>
      </div>

      <!-- Copy button -->
      <button
        onclick={handleCopy}
        class="w-full py-3 font-medium transition-all {
          copied
            ? 'bg-emerald-600 text-white'
            : 'bg-emerald-600 hover:bg-emerald-500 text-white'
        }"
      >
        {copied ? '✓ Copied!' : 'Copy Embed Code'}
      </button>
    </div>
  </div>
{/if}
