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
    <div {...wrapperProps} class="w-full">
      <ul {...props} class={cn('menu menu-horizontal min-h-0 gap-1 bg-transparent p-0', className)}>
        {@render children?.()}
      </ul>
    </div>
  {/snippet}
</NavigationMenuPrimitive.List>
