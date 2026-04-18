<script lang="ts">
  import { browser } from '$app/environment';
  import type { NDKEvent, NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import StoryAuthor from '$lib/components/StoryAuthor.svelte';
  import {
    articleImageUrl,
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    formatDisplayDate
  } from '$lib/ndk/format';

  let {
    event,
    showAuthor = false,
    authorProfile
  }: {
    event: NDKEvent;
    showAuthor?: boolean;
    authorProfile?: NDKUserProfile;
  } = $props();

  const comments = ndk.$subscribe(() => {
    if (!browser) return undefined;
    return { filters: [{ kinds: [1111], '#A': [event.tagId()], limit: 100 }] };
  });
</script>

<a
  class="card card-border bg-base-200 hover:bg-base-300 transition-colors"
  href={`/note/${event.encode()}`}
>
  {#if articleImageUrl(event.rawEvent())}
    <figure class="aspect-[16/9] overflow-hidden">
      <img
        src={articleImageUrl(event.rawEvent())}
        alt=""
        loading="lazy"
        width="640"
        height="360"
        class="w-full h-full object-cover"
      />
    </figure>
  {/if}
  <div class="card-body gap-2">
    <h3 class="card-title text-base font-bold font-serif leading-snug">{articleTitle(event.rawEvent())}</h3>
    <p class="text-sm text-base-content/70 line-clamp-3 max-w-[48ch]">{articleSummary(event.rawEvent(), 180)}</p>
    <div class="flex flex-wrap items-center gap-3 pt-1">
      {#if showAuthor}
        <StoryAuthor
          {ndk}
          pubkey={event.pubkey}
          profile={authorProfile}
          compact
        />
      {/if}
      <span class="flex flex-wrap gap-2 text-xs text-base-content/50">
        <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
        <span>{articleReadTimeMinutes(event.content)} min read</span>
        {#if comments.events.length > 0}
          <span class="text-primary">{comments.events.length} comments</span>
        {/if}
      </span>
    </div>
  </div>
</a>
