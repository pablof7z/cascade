<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogTitleProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogTitleProps = $props();
</script>

<DialogPrimitive.Title
  {...restProps}
  class={cn('text-xl font-heading font-semibold tracking-tight text-white', className)}
>
  {@render children?.()}
</DialogPrimitive.Title>
