<script lang="ts">
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import { invalidateAll } from '$app/navigation';
  import type { DiscussionThread } from '$lib/ndk/cascade';
  import { buildThreadReplyTags, buildTradeSummary, formatProbability, formatRelativeTime, marketDiscussionUrl } from '$lib/ndk/cascade';
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const currentUser = $derived(ndk.$currentUser);
  const tradeSummary = $derived(buildTradeSummary(data.trades));
  const impliedProbability = $derived((tradeSummary.latestPricePpm ?? 500_000) / 1_000_000);

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
      event.tags = buildThreadReplyTags(data.market.id, data.thread.post.id);
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
      <a class="btn btn-outline" href={marketDiscussionUrl(data.market.slug)}>Back to discussion</a>
    </div>
  </div>

  <div class="market-context-bar">
    <a href="/market/{data.market.slug}" class="market-context-market">{data.market.title}</a>
    <span class:positive={impliedProbability >= 0.5} class:negative={impliedProbability < 0.5}>
      {formatProbability(impliedProbability)} YES
    </span>
    <a class="btn btn-outline" href="/market/{data.market.slug}">Buy YES / Buy NO</a>
  </div>
</section>

<section class="section">
  {@render renderThread(data.thread, true)}
</section>

{#snippet renderThread(node: DiscussionThread, isRoot: boolean = false)}
  <article class="surface panel">
    <div class="eyebrow">{authorLabel(node.post.pubkey)} · {formatRelativeTime(node.post.createdAt)}</div>
    {#if isRoot && node.post.subject}
      <h2 class="section-title">{node.post.subject}</h2>
    {/if}
    <p class="page-subtitle">{node.post.content}</p>

    {#if node.replies.length > 0}
      <div class="section" style="margin-top: 1rem; padding-left: 1rem; border-left: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);">
        {#each node.replies as reply (reply.post.id)}
          {@render renderThread(reply, false)}
        {/each}
      </div>
    {/if}
  </article>
{/snippet}

<section class="section">
  {#if currentUser}
    <div class="reply-compose">
      <textarea
        class="textarea textarea-bordered reply-body"
        rows={4}
        placeholder="Write a reply…"
        bind:value={replyBody}
        disabled={replySubmitting}
      ></textarea>
      {#if replyError}
        <p class="reply-error">{replyError}</p>
      {/if}
      <div class="reply-actions">
        <button class="btn btn-primary" onclick={postReply} disabled={replySubmitting || !replyBody.trim()}>
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
  .market-context-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .market-context-market {
    color: white;
    font-size: 0.95rem;
    font-weight: 600;
    text-decoration: none;
  }

  .market-context-market:hover,
  .market-context-market:focus-visible {
    color: white;
    outline: none;
  }

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

  @media (max-width: 720px) {
    .market-context-bar {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
