<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof TabsPrimitive.Trigger
  > = $props();
</script>

<TabsPrimitive.Trigger {...restProps} class={cn('tabs-trigger', className)}>
  {@render children?.()}
</TabsPrimitive.Trigger>

<style>
  :global(.tabs-trigger) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.45rem;
    padding: 0.3rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    transition:
      color 150ms ease,
      background-color 150ms ease;
  }

  :global(.tabs-trigger:hover) {
    color: var(--text);
  }

  :global(.tabs-trigger[data-state='active']) {
    background: var(--surface-hover);
    color: var(--text-strong);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
  }

  :global(.tabs-trigger:focus-visible) {
    outline: 2px solid var(--border);
    outline-offset: 2px;
  }

  :global(.tabs-trigger[disabled]) {
    opacity: 0.45;
    cursor: not-allowed;
  }
</style>
