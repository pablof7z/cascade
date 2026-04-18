<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Viewport
  > = $props();
</script>

<NavigationMenuPrimitive.Viewport
  {...restProps}
  class={cn('rounded-md border border-base-300 bg-base-200 shadow-none', className)}
>
  {@render children?.()}
</NavigationMenuPrimitive.Viewport>
