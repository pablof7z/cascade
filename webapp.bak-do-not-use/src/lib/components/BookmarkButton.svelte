<script lang="ts">
  interface Props {
    isBookmarked: boolean;
    count?: number;
    onToggle: () => void;
    size?: 'sm' | 'md';
    showCount?: boolean;
  }

  let { isBookmarked, count = 0, onToggle, size = 'sm', showCount = true }: Props = $props();

  let sizeClasses = $derived(size === 'md' ? 'w-5 h-5' : 'w-4 h-4');

  function handleClick() {
    onToggle();
  }
</script>

<button
  type="button"
  onclick={handleClick}
  class="flex items-center gap-1.5 px-2 py-1 transition-all {
    isBookmarked
      ? 'text-emerald-500 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20'
      : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
  }"
  title={isBookmarked ? 'Remove bookmark' : 'Bookmark this market'}
>
  {#if isBookmarked}
    <svg
      class={sizeClasses}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  {:else}
    <svg
      class={sizeClasses}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
      />
    </svg>
  {/if}
  {#if showCount && count > 0}
    <span class="text-xs font-medium">{count}</span>
  {/if}
</button>
