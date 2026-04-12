<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof DropdownMenuPrimitive.Trigger
  > = $props();
</script>

<DropdownMenuPrimitive.Trigger {...restProps} class={cn('dropdown-menu-trigger', className)}>
  {@render children?.()}
</DropdownMenuPrimitive.Trigger>

<style>
  :global(.dropdown-menu-trigger) {
    appearance: none;
    border: 0;
    cursor: pointer;
  }

  :global(.dropdown-menu-trigger:focus-visible) {
    outline: 2px solid rgba(17, 17, 17, 0.18);
    outline-offset: 3px;
  }

  :global(.dropdown-menu-trigger[data-state='open']) {
    transform: translateY(-1px);
  }
</style>
