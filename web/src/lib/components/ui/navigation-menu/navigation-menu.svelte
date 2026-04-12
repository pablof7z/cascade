<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Root
  > = $props();
</script>

<NavigationMenuPrimitive.Root {...restProps} class={cn('nav-menu-root', className)}>
  {@render children?.()}
</NavigationMenuPrimitive.Root>
