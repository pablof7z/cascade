<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: ComponentProps<
    typeof AvatarPrimitive.Root
  > = $props();
</script>

<AvatarPrimitive.Root {...restProps} class={cn('avatar-root', className)}>
  {@render children?.()}
</AvatarPrimitive.Root>

<style>
  :global(.avatar-root) {
    position: relative;
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border-radius: 9999px;
    background: rgba(17, 17, 17, 0.06);
  }
</style>
