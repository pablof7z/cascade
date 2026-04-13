<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Link
  > = $props();
</script>

<NavigationMenuPrimitive.Link
  {...restProps}
  class={cn('block rounded-md px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-base-300 hover:text-white', className)}
>
  {@render children?.()}
</NavigationMenuPrimitive.Link>
