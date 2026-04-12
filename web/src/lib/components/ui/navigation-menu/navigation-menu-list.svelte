<script lang="ts">
  import { NavigationMenu as NavigationMenuPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', child, children, ...restProps }: ComponentProps<
    typeof NavigationMenuPrimitive.List
  > = $props();
</script>

<NavigationMenuPrimitive.List {...restProps}>
  {#snippet child({ props, wrapperProps })}
    <div {...wrapperProps} class="nav-menu-list-wrap">
      <ul {...props} class={cn('nav-menu-list', className)}>
        {@render children?.()}
      </ul>
    </div>
  {/snippet}
</NavigationMenuPrimitive.List>
