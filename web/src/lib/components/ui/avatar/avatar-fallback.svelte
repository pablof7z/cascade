<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof AvatarPrimitive.Fallback
  > = $props();
</script>

<AvatarPrimitive.Fallback {...restProps} class={cn('avatar-fallback', className)}>
  {@render children?.()}
</AvatarPrimitive.Fallback>

<style>
  :global(.avatar-fallback) {
    display: inline-flex;
    width: 100%;
    height: 100%;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    line-height: 1;
  }
</style>
