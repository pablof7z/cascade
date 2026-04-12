<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  interface Props extends ComponentProps<typeof DropdownMenuPrimitive.Item> {
    inset?: boolean;
  }

  let { class: className = '', children, inset = false, ...restProps }: Props = $props();
</script>

<DropdownMenuPrimitive.Item
  {...restProps}
  class={cn('dropdown-menu-item', inset && 'dropdown-menu-item-inset', className)}
>
  {@render children?.()}
</DropdownMenuPrimitive.Item>

<style>
  :global(.dropdown-menu-item) {
    display: flex;
    width: calc(100% - 0.7rem);
    margin: 0.1rem 0.35rem;
    align-items: center;
    gap: 0.65rem;
    border-radius: 0.7rem;
    padding: 0.6rem 0.8rem;
    color: var(--text);
    font-size: 0.9rem;
    cursor: pointer;
    user-select: none;
    transition:
      background-color 160ms ease,
      color 160ms ease;
  }

  :global(.dropdown-menu-item-inset) {
    padding-left: 2.5rem;
  }

  :global(.dropdown-menu-item[data-highlighted]) {
    background: rgba(17, 17, 17, 0.05);
    color: var(--text-strong);
    outline: none;
  }

  :global(.dropdown-menu-item[data-disabled]) {
    opacity: 0.45;
    cursor: not-allowed;
    transform: none;
  }
</style>
