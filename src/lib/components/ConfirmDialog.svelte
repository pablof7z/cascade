<script lang="ts">
  let {
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = false,
    onConfirm,
    onCancel
  }: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } = $props();

  let confirmBtn = $state<HTMLButtonElement | null>(null);
  let dialogEl = $state<HTMLElement | null>(null);

  $effect(() => {
    confirmBtn?.focus();
  });

  $effect(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onCancel();
        return;
      }
      if (event.key === 'Tab') {
        const focusable = dialogEl?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey) {
          if (document.activeElement === first) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    }
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center">
  <div class="absolute inset-0 bg-black/60"></div>
  <div
    bind:this={dialogEl}
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    class="relative z-10 bg-neutral-900 border border-neutral-700 p-6 w-full max-w-sm mx-4"
  >
    <h2 id="confirm-dialog-title" class="text-base font-medium text-white mb-2">{title}</h2>
    <p class="text-sm text-neutral-400 mb-6">{message}</p>
    <div class="flex gap-3 justify-end">
      <button
        onclick={onCancel}
        class="px-4 py-2 text-sm font-medium text-neutral-300 border border-neutral-700 hover:border-neutral-500 transition-colors"
      >
        {cancelLabel}
      </button>
      {#if danger}
        <button
          bind:this={confirmBtn}
          onclick={onConfirm}
          class="px-4 py-2 text-sm font-medium bg-rose-600 text-white hover:bg-rose-700 transition-colors"
        >
          {confirmLabel}
        </button>
      {:else}
        <button
          bind:this={confirmBtn}
          onclick={onConfirm}
          class="px-4 py-2 text-sm font-medium bg-white text-neutral-950 hover:bg-neutral-200 transition-colors"
        >
          {confirmLabel}
        </button>
      {/if}
    </div>
  </div>
</div>
