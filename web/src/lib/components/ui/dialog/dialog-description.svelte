<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogDescriptionProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogDescriptionProps = $props();
</script>

<DialogPrimitive.Description
  {...restProps}
  class={cn('mt-1 text-sm leading-6 text-neutral-400', className)}
>
  {@render children?.()}
</DialogPrimitive.Description>
