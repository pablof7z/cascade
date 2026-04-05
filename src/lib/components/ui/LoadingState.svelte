<script lang="ts">
  type LoadingSize = 'sm' | 'md' | 'lg';

  interface Props {
    size?: LoadingSize;
    message?: string;
    class?: string;
  }

  let { size = 'md', message = 'Loading...', class: className = '' }: Props = $props();

  const sizeClasses = {
    sm: 'w-4 h-4 border',
    md: 'w-6 h-6 border-2',
    lg: 'w-8 h-8 border-2'
  };
</script>

<div class="flex flex-col items-center justify-center gap-3 {className}">
  <div class="{sizeClasses[size]} border-neutral-700 border-t-emerald-500 rounded-full animate-spin"></div>
  {#if message}
    <p class="text-sm text-neutral-500">{message}</p>
  {/if}
</div>
