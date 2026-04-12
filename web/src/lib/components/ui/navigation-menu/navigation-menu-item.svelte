<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.Item
  > = $props();
</script>

<NavigationMenuPrimitive.Item {...restProps} class={cn('nav-menu-item', className)}>
  {@render children?.()}
</NavigationMenuPrimitive.Item>
