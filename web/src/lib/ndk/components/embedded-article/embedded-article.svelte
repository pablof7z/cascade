<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    formatDisplayDate
  } from '../../format';

  interface Props {
    ndk: NDKSvelte;
    event: NDKEvent;
    class?: string;
  }

  let { event, class: className = '' }: Props = $props();

  const href = $derived.by(() => {
    try {
      return `/note/${event.encode()}`;
    } catch {
      return undefined;
    }
  });
</script>

{#if href}
  <a data-embedded-article="" class={`embedded-article ${className}`} href={href}>
    <span class="embedded-kind">Referenced article</span>
    <strong>{articleTitle(event.rawEvent())}</strong>
    <span class="embedded-copy">{articleSummary(event.rawEvent(), 160)}</span>
    <span class="embedded-meta">
      {formatDisplayDate(articlePublishedAt(event.rawEvent()))} · {articleReadTimeMinutes(event.content)} min read
    </span>
  </a>
{:else}
  <span data-embedded-article="" class={`embedded-article ${className}`}>
    {articleTitle(event.rawEvent())}
  </span>
{/if}

<style>
  .embedded-article {
    display: inline-grid;
    gap: 0.35rem;
    width: min(100%, 28rem);
    padding: 0.95rem 1rem;
    border: 1px solid var(--color-neutral);
    border-radius: 10px;
    background: var(--color-base-200);
    color: var(--color-base-content);
    text-decoration: none;
    vertical-align: middle;
  }

  .embedded-kind,
  .embedded-meta {
    color: var(--color-neutral-content);
    font-size: 0.78rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .embedded-copy {
    color: var(--color-base-content);
    font-size: 0.94rem;
    line-height: 1.6;
  }
</style>
