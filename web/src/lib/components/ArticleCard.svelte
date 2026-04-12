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

<a class="article-feed-item" href={`/note/${event.encode()}`}>
  <div class="article-feed-copy">
    <h3 class="article-feed-title">{articleTitle(event.rawEvent())}</h3>
    <p class="article-feed-summary">{articleSummary(event.rawEvent(), 180)}</p>
    <div class="article-feed-meta">
      {#if showAuthor}
        <StoryAuthor
          {ndk}
          pubkey={event.pubkey}
          profile={authorProfile}
          avatarClass="article-author-avatar article-author-avatar-compact"
          compact
        />
      {/if}
      <span class="story-pub-meta">
        <span>{formatDisplayDate(articlePublishedAt(event.rawEvent()))}</span>
        <span>{articleReadTimeMinutes(event.content)} min read</span>
        {#if comments.events.length > 0}
          <span class="story-comment-count">{comments.events.length} comments</span>
        {/if}
      </span>
    </div>
  </div>

  {#if articleImageUrl(event.rawEvent())}
    <img class="article-feed-thumb" src={articleImageUrl(event.rawEvent())} alt="" loading="lazy" />
  {/if}
</a>

<style>
  .article-feed-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 1.5rem;
    align-items: start;
    padding: 1.5rem 0;
    border-bottom: 1px solid var(--border-light);
    color: inherit;
    text-decoration: none;
  }

  .article-feed-item:first-child {
    border-top: 1px solid var(--border-light);
  }

  .article-feed-copy {
    display: grid;
    gap: 0.5rem;
  }

  .article-feed-title {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--text-strong);
    line-height: 1.2;
    letter-spacing: -0.01em;
    transition: color 160ms ease;
  }

  .article-feed-item:hover .article-feed-title {
    color: var(--accent);
  }

  .article-feed-summary {
    margin: 0;
    color: var(--muted);
    font-size: 0.95rem;
    line-height: 1.5;
    max-width: 48ch;
  }

  .article-feed-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    padding-top: 0.25rem;
  }

  .story-comment-count {
    color: var(--accent);
  }

  .article-feed-thumb {
    width: 8rem;
    aspect-ratio: 4 / 3;
    object-fit: cover;
    border-radius: var(--radius-sm);
  }

  @media (max-width: 720px) {
    .article-feed-item {
      grid-template-columns: 1fr;
    }

    .article-feed-thumb {
      width: 100%;
      aspect-ratio: 3 / 2;
    }
  }
</style>
