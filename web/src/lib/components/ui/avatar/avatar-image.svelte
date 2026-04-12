<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import type { ComponentProps } from 'svelte';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', ...restProps }: ComponentProps<typeof AvatarPrimitive.Image> =
    $props();
</script>

<AvatarPrimitive.Image {...restProps} class={cn('avatar-image', className)} />

<style>
  :global(.avatar-image) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
