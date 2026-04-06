<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { goto } from '$app/navigation';
  import { nostrStore } from '$lib/stores/nostr';
  import { getNDK, fetchMarketByEventId } from '../../services/nostrService';
  import { parseMarketEvent } from '../../services/marketService';
  import { formatMarketSlug } from '$lib/marketSlug';
  import {
    getBookmarks,
    isBookmarked,
    addBookmark,
    removeBookmark,
    onBookmarksChanged,
    initializeBookmarks,
  } from '../../bookmarkStore';
  import BookmarkButton from '$lib/components/BookmarkButton.svelte';

  let bookmarkedIds = $state<string[]>([]);
  let pubkey = $state<string | null>(null);
  let marketSlugs = $state<Map<string, string>>(new Map());
  let unsubscribeNostr: (() => void) | null = null;
  let unsubscribeBookmarks: (() => void) | null = null;

  function updateBookmarks() {
    bookmarkedIds = getBookmarks();
    // Fetch slugs for all bookmarked IDs
    for (const id of bookmarkedIds) {
      if (!marketSlugs.has(id)) {
        fetchMarketSlug(id).then((slug) => {
          marketSlugs.set(id, slug);
        });
      }
    }
  }

  function getMarketSlug(marketId: string): string {
    return marketSlugs.get(marketId) || marketId;
  }

  function toggle(marketId: string) {
    if (isBookmarked(marketId)) {
      removeBookmark(marketId, pubkey, getNDK());
    } else {
      addBookmark(marketId, pubkey, getNDK());
    }
  }

  async function fetchMarketSlug(eventId: string): Promise<string> {
    if (marketSlugs.has(eventId)) {
      return marketSlugs.get(eventId)!;
    }
    try {
      const ndk = getNDK();
      if (!ndk) return eventId;
      const event = await fetchMarketByEventId(eventId);
      if (!event) return eventId;
      const parsed = parseMarketEvent(event);
      if (!parsed.ok) return eventId;
      const slug = formatMarketSlug(event);
      marketSlugs.set(eventId, slug);
      return slug;
    } catch {
      return eventId;
    }
  }

  onMount(() => {
    // Subscribe to nostrStore for pubkey
    unsubscribeNostr = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
      // Initialize bookmarks when we have the pubkey
      initializeBookmarks(pubkey, getNDK()).then(() => {
        updateBookmarks();
      });
    });

    // Subscribe to bookmark changes
    unsubscribeBookmarks = onBookmarksChanged(() => {
      updateBookmarks();
    });

    // Initial sync
    updateBookmarks();
  });

  onDestroy(() => {
    if (unsubscribeNostr) unsubscribeNostr();
    if (unsubscribeBookmarks) unsubscribeBookmarks();
  });
</script>

<div class="min-h-screen bg-neutral-950">
  <div class="max-w-4xl mx-auto px-4 py-6">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-white">My Bookmarks</h1>
      <p class="text-neutral-400 mt-1">
        Markets you've saved for later
      </p>
    </div>

    {#if bookmarkedIds.length === 0}
      <!-- Empty State -->
      <div class="text-center py-16 border-b border-neutral-800/40">
        <svg
          class="w-12 h-12 mx-auto text-neutral-600 mb-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <h2 class="text-lg font-medium text-white mb-2">No bookmarks yet</h2>
        <p class="text-neutral-500 mb-6 max-w-sm mx-auto">
          Bookmark markets you want to track. Click the bookmark icon on any market card.
        </p>
        <a
          href="/"
          class="inline-block px-4 py-2 bg-white text-neutral-950 font-medium hover:bg-neutral-100 transition-colors"
        >
          Browse Markets
        </a>
      </div>
    {:else}
      <!-- Bookmarked Markets List -->
      <div>
        {#each bookmarkedIds as marketId (marketId)}
          <div class="flex items-center justify-between py-3 px-1 border-b border-neutral-800/40 hover:bg-neutral-900/30 transition-colors">
            <a
              href="/mkt/{getMarketSlug(marketId)}"
              class="flex-1 min-w-0 text-white font-medium hover:text-neutral-300 transition-colors truncate"
            >
              {marketId}
            </a>
            <div class="flex items-center gap-3 ml-4">
              <BookmarkButton
                isBookmarked={true}
                count={1}
                onToggle={() => toggle(marketId)}
                showCount={false}
              />
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
