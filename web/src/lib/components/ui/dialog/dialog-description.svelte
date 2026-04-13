<script lang="ts">
  import { Dialog as DialogPrimitive, type DialogDescriptionProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let { class: className = '', children, ...restProps }: DialogDescriptionProps = $props();
</script>

<DialogPrimitive.Description {...restProps} class={cn('dialog-description', className)}>
  {@render children?.()}
</DialogPrimitive.Description>

<style>
  :global(.dialog-description) {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin-top: 0.25rem;
  }
</style>
