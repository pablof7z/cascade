<script lang="ts">
  import type { DiscussionThread } from '$lib/ndk/cascade';
  import { formatRelativeTime, marketDiscussionUrl, truncateText } from '$lib/ndk/cascade';
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  function authorLabel(pubkey: string): string {
    return displayName(data.profiles[pubkey], shortPubkey(pubkey));
  }
</script>

<section class="section">
  <div class="page-header">
    <div class="eyebrow">Thread</div>
    <h1 class="page-title">{data.thread.post.subject || 'Discussion thread'}</h1>
    <p class="page-subtitle">
      Attached to <a href="/market/{data.market.slug}" class="positive">{data.market.title}</a>.
    </p>
    <div class="button-row">
      <a class="button-secondary" href={marketDiscussionUrl(data.market.slug)}>Back to discussion</a>
    </div>
  </div>
</section>

<section class="section">
  {@render renderThread(data.thread)}
</section>

{#snippet renderThread(node: DiscussionThread)}
  <article class="surface panel">
    <div class="eyebrow">{authorLabel(node.post.pubkey)} · {formatRelativeTime(node.post.createdAt)}</div>
    <h2 class="section-title">{node.post.subject || 'Reply'}</h2>
    <p class="page-subtitle">{truncateText(node.post.content, 400)}</p>

    {#if node.replies.length > 0}
      <div class="section" style="margin-top: 1rem; padding-left: 1rem; border-left: 1px solid var(--border-subtle);">
        {#each node.replies as reply (reply.post.id)}
          {@render renderThread(reply)}
        {/each}
      </div>
    {/if}
  </article>
{/snippet}
