<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Link
  > = $props();
</script>

<NavigationMenuPrimitive.Link {...restProps} class={cn('nav-menu-link', className)}>
  {@render children?.()}
</NavigationMenuPrimitive.Link>
