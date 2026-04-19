<script lang="ts">
  import { createRelayInfo } from '@nostr-dev-kit/svelte';
  import BookmarkIcon from '$lib/components/BookmarkIcon.svelte';
  import { ndk } from '$lib/ndk/client';

  let {
    relayUrl,
    bookmarked = false,
    userCount,
    onToggleBookmark,
    onRemove,
    showBookmarkToggle = false
  }: {
    relayUrl: string;
    bookmarked?: boolean;
    userCount?: number;
    onToggleBookmark?: () => void;
    onRemove?: () => void;
    showBookmarkToggle?: boolean;
  } = $props();

  const relayInfo = createRelayInfo(() => ({ relayUrl }), ndk);

  function hostnameFromUrl(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url.replace(/^wss?:\/\//, '');
    }
  }

  const hostname = $derived(hostnameFromUrl(relayUrl));
  const hasNip11 = $derived(!relayInfo.loading && relayInfo.nip11?.name);
</script>

{#if hasNip11}
<a class="bg-surface rounded-lg border border-base-300 hover:bg-base-300 transition-colors" href={`/relay/${hostname}`}>
  <div class="flex flex-row gap-3 items-start p-4">
    <div class="flex-shrink-0 w-10 h-10 rounded-full bg-base-300 flex items-center justify-center overflow-hidden">
      {#if relayInfo.nip11?.icon}
        <img src={relayInfo.nip11.icon} alt="" width="40" height="40" class="w-full h-full object-cover" />
      {:else}
        <span class="text-sm font-bold text-base-content/60">{hostname.charAt(0).toUpperCase()}</span>
      {/if}
    </div>
    <div class="flex-1 min-w-0 grid gap-1">
      <h3 class="font-semibold text-sm truncate">{relayInfo.nip11?.name || hostname}</h3>
      {#if relayInfo.nip11?.description}
        <p class="text-xs text-base-content/60 line-clamp-2">{relayInfo.nip11.description}</p>
      {/if}
      {#if userCount !== undefined || showBookmarkToggle}
        <div class="flex items-center gap-3 mt-1">
          {#if userCount !== undefined}
            <span class="text-xs text-base-content/50">
              {userCount} {userCount === 1 ? 'reader' : 'readers'}
            </span>
          {/if}
          {#if showBookmarkToggle && onToggleBookmark}
            <button
              class="btn btn-ghost btn-xs btn-square"
              aria-label={bookmarked ? 'Remove from relays' : 'Bookmark relay'}
              onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); onToggleBookmark(); }}
            >
              <BookmarkIcon size={14} filled={bookmarked} />
            </button>
          {/if}
        </div>
      {/if}
    </div>
    {#if onRemove}
      <button
        class="btn btn-ghost btn-xs btn-square flex-shrink-0"
        aria-label="Remove relay"
        onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
      >
        <BookmarkIcon size={16} filled />
      </button>
    {/if}
  </div>
</a>
{/if}
