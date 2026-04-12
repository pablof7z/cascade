<script lang="ts">
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import { createRelayInfo } from '@nostr-dev-kit/svelte';
  import ArticleCard from '$lib/components/ArticleCard.svelte';
  import BookmarkIcon from '$lib/components/BookmarkIcon.svelte';
  import { ndk } from '$lib/ndk/client';

  const currentUser = $derived(ndk.$currentUser);

  const hostname = $derived(page.params.hostname);
  const relayUrl = $derived(`wss://${hostname}`);

  // ── NIP-11 metadata ──────────────────────────────────────────
  const relayInfo = createRelayInfo(() => ({ relayUrl }), ndk);

  // ── Bookmark state (kind 10012) ──────────────────────────────
  const myRelaySet = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return {
      filters: [{ kinds: [10012 as number], authors: [currentUser.pubkey], limit: 1 }]
    };
  });

  const isBookmarked = $derived.by(() => {
    const event = myRelaySet.events[0];
    if (!event) return false;
    return event.tags.some((tag) => tag[0] === 'relay' && tag[1] === relayUrl);
  });

  async function toggleBookmark() {
    if (!currentUser) return;
    const existing = myRelaySet.events[0];
    const updated = new NDKEvent(ndk);
    updated.kind = 10012;
    if (isBookmarked) {
      updated.tags = existing
        ? existing.tags.filter((tag) => !(tag[0] === 'relay' && tag[1] === relayUrl))
        : [];
    } else {
      updated.tags = existing ? [...existing.tags, ['relay', relayUrl]] : [['relay', relayUrl]];
    }
    await updated.publish();
  }

  // ── Articles from this relay ─────────────────────────────────
  const articles = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return {
      filters: [{ kinds: [30023 as number], limit: 50 }],
      relayUrls: [relayUrl]
    };
  });

  const sortedArticles = $derived(
    [...articles.events].sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0))
  );
</script>

<svelte:head>
  <title>{relayInfo.nip11?.name || hostname} — Highlighter</title>
</svelte:head>

<div class="relay-banner">
  <a class="relay-banner-back" href="/relays" aria-label="Back to relays">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  </a>
  <div class="relay-banner-info">
    <h1 class="relay-banner-name">{relayInfo.nip11?.name || hostname}</h1>
    {#if relayInfo.nip11?.description}
      <p class="relay-banner-desc">{relayInfo.nip11.description}</p>
    {/if}
  </div>
  {#if currentUser}
    <button
      class="relay-bookmark-btn"
      title={isBookmarked ? 'Remove from relays' : 'Bookmark relay'}
      onclick={toggleBookmark}
    >
      <BookmarkIcon size={18} filled={isBookmarked} />
    </button>
  {/if}
</div>

<div class="bookmarks-layout">
  <div class="bookmarks-main">
    {#if sortedArticles.length > 0}
      <div class="article-feed" style="max-width: var(--content-width);">
        {#each sortedArticles as event (event.id)}
          <ArticleCard {event} showAuthor />
        {/each}
      </div>
    {:else if articles.events.length === 0}
      <p class="muted">Loading articles from {hostname}...</p>
    {/if}
  </div>
</div>
