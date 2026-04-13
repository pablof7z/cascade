<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', ...restProps }: ComponentProps<typeof DropdownMenuPrimitive.Separator> =
    $props();
</script>

<DropdownMenuPrimitive.Separator
  {...restProps}
  class={cn('my-1 h-px bg-neutral-800', className)}
/>
