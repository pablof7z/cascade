<script lang="ts">
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import { invalidateAll } from '$app/navigation';
  import type { DiscussionThread } from '$lib/ndk/cascade';
  import { formatRelativeTime, marketDiscussionUrl, truncateText } from '$lib/ndk/cascade';
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const currentUser = $derived(ndk.$currentUser);

  function authorLabel(pubkey: string): string {
    return displayName(data.profiles[pubkey], shortPubkey(pubkey));
  }

  let replyBody = $state('');
  let replySubmitting = $state(false);
  let replyError = $state('');

  async function postReply() {
    if (!replyBody.trim()) return;
    replySubmitting = true;
    replyError = '';
    try {
      const event = new NDKEvent(ndk);
      event.kind = 1111;
      event.content = replyBody.trim();
      event.tags = [
        ['E', data.thread.post.id, '', 'root'],
        ['K', '1111'],
        ['e', data.thread.post.id, '', 'root'],
        ['k', '1111'],
        ['e', data.thread.post.id, '', 'reply']
      ];
      await event.publish();
      replyBody = '';
      await invalidateAll();
    } catch (err) {
      replyError = err instanceof Error ? err.message : 'Failed to publish. Please try again.';
    } finally {
      replySubmitting = false;
    }
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
      <div class="section" style="margin-top: 1rem; padding-left: 1rem; border-left: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);">
        {#each node.replies as reply (reply.post.id)}
          {@render renderThread(reply)}
        {/each}
      </div>
    {/if}
  </article>
{/snippet}

<section class="section">
  {#if currentUser}
    <div class="reply-compose">
      <textarea
        class="reply-body"
        rows={4}
        placeholder="Write a reply…"
        bind:value={replyBody}
        disabled={replySubmitting}
      ></textarea>
      {#if replyError}
        <p class="reply-error">{replyError}</p>
      {/if}
      <div class="reply-actions">
        <button class="button-primary" onclick={postReply} disabled={replySubmitting || !replyBody.trim()}>
          {replySubmitting ? 'Posting…' : 'Post reply'}
        </button>
      </div>
    </div>
  {:else}
    <p class="reply-signin">
      <a href="/join">Sign in</a> to reply.
    </p>
  {/if}
</section>

<style>
  .reply-compose {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .reply-body {
    width: 100%;
    border: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    border-radius: 2px;
    background: var(--color-base-200);
    color: var(--color-base-content);
    font-family: inherit;
    font-size: 0.9rem;
    padding: 0.4rem 0.6rem;
    box-sizing: border-box;
    resize: vertical;
  }

  .reply-body:focus {
    outline: none;
    border-color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .reply-actions {
    display: flex;
    justify-content: flex-end;
  }

  .reply-error {
    color: var(--color-error);
    font-size: 0.85rem;
    margin: 0;
  }

  .reply-signin {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.875rem;
  }
</style>
