<script lang="ts">
  import { browser } from '$app/environment';
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import RelayCard from '$lib/components/RelayCard.svelte';
  import { ndk } from '$lib/ndk/client';

  const currentUser = $derived(ndk.$currentUser);

  // ── My Relays (kind 10012) ────────────────────────────────────
  const myRelaySet = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return {
      filters: [{ kinds: [10012 as number], authors: [currentUser.pubkey], limit: 1 }]
    };
  });

  const myRelayUrls = $derived.by(() => {
    const event = myRelaySet.events[0];
    if (!event) return [];
    return event.tags.filter((tag) => tag[0] === 'relay' && tag[1]).map((tag) => tag[1]);
  });

  async function removeRelay(relayUrl: string) {
    if (!currentUser) return;
    const existing = myRelaySet.events[0];
    if (!existing) return;
    const updated = new NDKEvent(ndk);
    updated.kind = 10012;
    updated.tags = existing.tags.filter((tag) => !(tag[0] === 'relay' && tag[1] === relayUrl));
    await updated.publish();
  }

  async function addRelay(relayUrl: string) {
    if (!currentUser) return;
    const existing = myRelaySet.events[0];
    const updated = new NDKEvent(ndk);
    updated.kind = 10012;
    updated.tags = existing ? [...existing.tags, ['relay', relayUrl]] : [['relay', relayUrl]];
    await updated.publish();
  }

  function isBookmarked(relayUrl: string): boolean {
    return myRelayUrls.includes(relayUrl);
  }

  async function toggleBookmark(relayUrl: string) {
    if (isBookmarked(relayUrl)) {
      await removeRelay(relayUrl);
    } else {
      await addRelay(relayUrl);
    }
  }

  // ── Network relay discovery (kind 10012) ──────────────────────
  const networkRelaySets = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return {
      filters: [{ kinds: [10012 as number], limit: 100 }]
    };
  });

  const trendingRelays = $derived.by(() => {
    const counts = new Map<string, Set<string>>();
    for (const event of networkRelaySets.events) {
      if (currentUser && event.pubkey === currentUser.pubkey) continue;
      for (const tag of event.tags) {
        if (tag[0] === 'relay' && tag[1]) {
          const url = tag[1];
          const existing = counts.get(url);
          if (existing) {
            existing.add(event.pubkey);
          } else {
            counts.set(url, new Set([event.pubkey]));
          }
        }
      }
    }
    return [...counts.entries()]
      .map(([url, users]) => ({ url, userCount: users.size }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 20);
  });
</script>

<svelte:head>
  <title>Relays — Highlighter</title>
</svelte:head>

<div class="bookmarks-layout">
  <div class="bookmarks-main">
    {#if currentUser}
      <section class="bookmarks-section">
        <div class="bookmarks-section-header">
          <h2 class="bookmarks-section-title">My Relays</h2>
          <p class="bookmarks-section-desc">Relays you follow as magazines</p>
        </div>

        {#if myRelayUrls.length > 0}
          <div class="trending-grid">
            {#each myRelayUrls as relayUrl (relayUrl)}
              <RelayCard
                {relayUrl}
                onRemove={() => removeRelay(relayUrl)}
              />
            {/each}
          </div>
        {:else}
          <div class="bookmarks-empty">
            <p>No relays bookmarked yet</p>
            <p class="muted">Explore relays below and bookmark them to follow</p>
          </div>
        {/if}
      </section>
    {:else}
      <section class="bookmarks-section">
        <div class="bookmarks-section-header">
          <h2 class="bookmarks-section-title">My Relays</h2>
          <p class="bookmarks-section-desc">Log in to bookmark and follow relays</p>
        </div>
      </section>
    {/if}

    <section class="bookmarks-section">
      <div class="bookmarks-section-header">
        <h2 class="bookmarks-section-title">Relays Readers Are Exploring</h2>
        <p class="bookmarks-section-desc">Discover relays the community is reading from</p>
      </div>

      {#if trendingRelays.length > 0}
        <div class="trending-grid">
          {#each trendingRelays as { url, userCount } (url)}
            <RelayCard
              relayUrl={url}
              {userCount}
              bookmarked={isBookmarked(url)}
              showBookmarkToggle={!!currentUser}
              onToggleBookmark={() => toggleBookmark(url)}
            />
          {/each}
        </div>
      {:else if networkRelaySets.events.length > 0}
        <p class="muted">Analyzing which relays people follow...</p>
      {:else}
        <p class="muted">Discovering relays from the network...</p>
      {/if}
    </section>
  </div>
</div>
