<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', ...restProps }: ComponentProps<typeof DropdownMenuPrimitive.Separator> =
    $props();
</script>

<DropdownMenuPrimitive.Separator {...restProps} class={cn('dropdown-menu-separator', className)} />

<style>
  :global(.dropdown-menu-separator) {
    height: 1px;
    margin: 0.35rem 0.75rem;
    background: rgba(17, 17, 17, 0.08);
  }
</style>
