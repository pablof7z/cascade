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
<a class="relay-card" href={`/relay/${hostname}`}>
  <div class="relay-card-icon">
    {#if relayInfo.nip11?.icon}
      <img src={relayInfo.nip11.icon} alt="" />
    {:else}
      <span>{hostname.charAt(0).toUpperCase()}</span>
    {/if}
  </div>
  <div class="trending-card-body">
    <h3 class="trending-card-title">{relayInfo.nip11?.name || hostname}</h3>
    {#if relayInfo.nip11?.description}
      <p class="trending-card-summary">{relayInfo.nip11.description}</p>
    {/if}
    {#if userCount !== undefined || showBookmarkToggle}
      <div class="trending-card-meta">
        {#if userCount !== undefined}
          <span class="trending-save-count">
            {userCount} {userCount === 1 ? 'reader' : 'readers'}
          </span>
        {/if}
        {#if showBookmarkToggle && onToggleBookmark}
          <button
            class="relay-bookmark-btn"
            title={bookmarked ? 'Remove from relays' : 'Bookmark relay'}
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
      class="relay-bookmark-btn relay-bookmark-btn-remove"
      title="Remove relay"
      onclick={(e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); onRemove(); }}
    >
      <BookmarkIcon size={16} filled />
    </button>
  {/if}
</a>
{/if}
