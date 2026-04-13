<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogTitleProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogTitleProps = $props();
</script>

<DialogPrimitive.Title {...restProps} class={cn('dialog-title', className)}>
  {@render children?.()}
</DialogPrimitive.Title>

<style>
  :global(.dialog-title) {
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-strong);
    line-height: 1.2;
    letter-spacing: -0.02em;
  }
</style>
