<script lang="ts">
  type SkeletonVariant = 'text' | 'card' | 'avatar' | 'button' | 'chart';
  type SkeletonHeight = 'h-4' | 'h-6' | 'h-8' | 'h-10' | 'h-12';
  type SkeletonWidth = 'w-full' | 'w-3/4' | 'w-1/2' | 'w-1/3' | 'w-2/3' | 'w-1/4' | 'w-auto';

  interface Props {
    variant?: SkeletonVariant;
    height?: SkeletonHeight;
    width?: SkeletonWidth;
    class?: string;
  }

  let { variant = 'text', height = 'h-4', width = 'w-full', class: className = '' }: Props = $props();

  const baseClasses = 'bg-neutral-800 animate-pulse rounded-none';
</script>

{#if variant === 'text'}
  <div class="{height} {width} {baseClasses} {className}"></div>
{:else if variant === 'card'}
  <div class="bg-neutral-900 border border-neutral-800 p-4 {className}">
    <div class="space-y-3">
      <div class="{height} {baseClasses} w-3/4"></div>
      <div class="h-4 {baseClasses} w-full"></div>
      <div class="h-4 {baseClasses} w-5/6"></div>
      <div class="h-4 {baseClasses} w-2/3"></div>
    </div>
  </div>
{:else if variant === 'avatar'}
  <div class="{baseClasses} rounded-none {className}" style="width: 40px; height: 40px;"></div>
{:else if variant === 'button'}
  <div class="{baseClasses} h-9 px-4 {className}" style="width: 100px;"></div>
{:else if variant === 'chart'}
  <div class="bg-neutral-900 border border-neutral-800 p-4 {className}">
    <div class="flex items-end justify-between gap-2 h-32">
      <div class="{baseClasses} flex-1"></div>
      <div class="{baseClasses} flex-1"></div>
      <div class="{baseClasses} flex-1"></div>
      <div class="{baseClasses} flex-1"></div>
      <div class="{baseClasses} flex-1"></div>
      <div class="{baseClasses} flex-1"></div>
      <div class="{baseClasses} flex-1"></div>
    </div>
  </div>
{/if}
