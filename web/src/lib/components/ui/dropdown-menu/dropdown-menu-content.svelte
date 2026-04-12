<script lang="ts">
  import { DropdownMenu as DropdownMenuPrimitive, type DropdownMenuContentProps } from 'bits-ui';
  import { cn } from '$lib/ndk/utils/cn';

  let {
    class: className = '',
    children,
    align = 'end',
    sideOffset = 10,
    collisionPadding = 12,
    ...restProps
  }: DropdownMenuContentProps = $props();
</script>

<DropdownMenuPrimitive.Portal>
  <DropdownMenuPrimitive.Content
    {...restProps}
    {align}
    {sideOffset}
    {collisionPadding}
    class={cn('dropdown-menu-content', className)}
  >
    {@render children?.()}
  </DropdownMenuPrimitive.Content>
</DropdownMenuPrimitive.Portal>

<style>
  :global(.dropdown-menu-content) {
    z-index: 40;
    min-width: 14rem;
    border: 1px solid rgba(17, 17, 17, 0.08);
    border-radius: 1.1rem;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 246, 243, 0.96)),
      rgba(255, 255, 255, 0.96);
    box-shadow:
      0 24px 60px rgba(17, 17, 17, 0.16),
      inset 0 1px 0 rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(18px);
    animation: dropdown-menu-enter 180ms cubic-bezier(0.21, 1, 0.32, 1);
  }

  :global(.dropdown-menu-content[data-state='closed']) {
    animation: dropdown-menu-exit 120ms ease-in forwards;
  }

  @keyframes dropdown-menu-enter {
    from {
      opacity: 0;
      transform: translateY(-0.35rem) scale(0.98);
    }

    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes dropdown-menu-exit {
    from {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    to {
      opacity: 0;
      transform: translateY(-0.2rem) scale(0.985);
    }
  }
</style>
