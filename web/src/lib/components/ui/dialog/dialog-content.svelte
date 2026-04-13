<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogContentProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogContentProps = $props();
</script>

<DialogPrimitive.Portal>
  <DialogPrimitive.Overlay class="dialog-overlay" />
  <DialogPrimitive.Content {...restProps} class={cn('dialog-content', className)}>
    {@render children?.()}
  </DialogPrimitive.Content>
</DialogPrimitive.Portal>

<style>
  :global(.dialog-overlay) {
    position: fixed;
    inset: 0;
    z-index: 50;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(2px);
  }

  :global(.dialog-overlay[data-state='open']) {
    animation: dialog-overlay-in 180ms ease;
  }

  :global(.dialog-overlay[data-state='closed']) {
    animation: dialog-overlay-out 150ms ease forwards;
  }

  :global(.dialog-content) {
    position: fixed;
    left: 50%;
    top: 50%;
    z-index: 50;
    transform: translate(-50%, -50%);
    width: min(calc(100vw - 2rem), 30rem);
    max-height: calc(100dvh - 2rem);
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 1rem;
    background: var(--surface);
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.5),
      0 4px 16px rgba(0, 0, 0, 0.3);
  }

  :global(.dialog-content[data-state='open']) {
    animation: dialog-content-in 200ms cubic-bezier(0.21, 1, 0.32, 1);
  }

  :global(.dialog-content[data-state='closed']) {
    animation: dialog-content-out 150ms ease forwards;
  }

  :global(.dialog-close) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    border-radius: 0.4rem;
    background: transparent;
    color: var(--text-faint);
    cursor: pointer;
    transition: color 150ms ease, background-color 150ms ease;
  }

  :global(.dialog-close:hover) {
    background: var(--surface-hover);
    color: var(--text);
  }

  :global(.dialog-close svg) {
    width: 1rem;
    height: 1rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
  }

  @keyframes dialog-overlay-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes dialog-overlay-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }

  @keyframes dialog-content-in {
    from { opacity: 0; transform: translate(-50%, calc(-50% + 0.5rem)) scale(0.97); }
    to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes dialog-content-out {
    from { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    to { opacity: 0; transform: translate(-50%, calc(-50% + 0.25rem)) scale(0.98); }
  }

  @media (max-width: 600px) {
    :global(.dialog-content) {
      left: 0;
      top: auto;
      bottom: 0;
      transform: none;
      width: 100%;
      max-height: 90dvh;
      border-bottom-left-radius: 0;
      border-bottom-right-radius: 0;
    }

    :global(.dialog-content[data-state='open']) {
      animation: dialog-content-slide-up 220ms cubic-bezier(0.21, 1, 0.32, 1);
    }

    :global(.dialog-content[data-state='closed']) {
      animation: dialog-content-slide-down 160ms ease forwards;
    }

    @keyframes dialog-content-slide-up {
      from { opacity: 0; transform: translateY(100%); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes dialog-content-slide-down {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(100%); }
    }
  }
</style>
