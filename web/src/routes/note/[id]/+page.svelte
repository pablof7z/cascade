<script lang="ts">
  import type { PageProps } from './$types';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { createFetchEvent, createFetchUser } from '@nostr-dev-kit/svelte';
  import { NDKEvent, type NDKFilter, type NostrEvent } from '@nostr-dev-kit/ndk';
  import ArticleMarkdown from '$lib/components/ArticleMarkdown.svelte';
  import * as Tabs from '$lib/components/ui/tabs';
  import { User } from '$lib/ndk/ui/user';
  import {
    articlePublishedAt,
    articleReadTimeMinutes,
    articleSummary,
    articleTitle,
    displayNip05,
    displayName,
    formatDisplayDate,
    noteExcerpt,
    noteTitle,
    profileIdentifier
  } from '$lib/ndk/format';
  import { ndk } from '$lib/ndk/client';
  import { safeUserIdentifier } from '$lib/ndk/user';
  import { MarkdownEventContent } from '$lib/ndk/ui/markdown-event-content';
  import '$lib/ndk/components/mention';
  import '$lib/ndk/components/embedded-note';
  import '$lib/ndk/components/embedded-article';
  import EventAuthorHeader from '$lib/components/EventAuthorHeader.svelte';
  import BookmarkIcon from '$lib/components/BookmarkIcon.svelte';
  import HighlightPopover from '$lib/components/HighlightPopover.svelte';
  import SharePopover from '$lib/components/SharePopover.svelte';
  import { mergeUniqueEvents } from '$lib/ndk/events';

  let { data }: PageProps = $props();
  let activeTab = $state<'article' | 'comments' | 'highlights'>('article');
  let replyingTo = $state<string | null>(null); // event id being replied to, null = top-level
  let replyText = $state('');
  let submitting = $state(false);
  let bookmarking = $state(false);
  let articleContentEl = $state<HTMLElement | null>(null);

  const currentUser = $derived(ndk.$currentUser);

  const bookmarkList = ndk.$subscribe(() => {
    if (!browser || !currentUser) return undefined;
    return {
      filters: [{ kinds: [10003], authors: [currentUser.pubkey], limit: 1 }]
    };
  });

  const isBookmarked = $derived.by(() => {
    if (!event || !bookmarkList.events[0]) return false;
    const addr = event.tagId();
    return bookmarkList.events[0].tags.some((tag) => tag[0] === 'a' && tag[1] === addr);
  });

  async function toggleBookmark() {
    if (!currentUser || !event || bookmarking) return;
    bookmarking = true;
    try {
      const addr = event.tagId();
      const existing = bookmarkList.events[0];
      const updated = new NDKEvent(ndk);
      updated.kind = 10003;

      if (existing && isBookmarked) {
        updated.tags = existing.tags.filter((tag) => !(tag[0] === 'a' && tag[1] === addr));
      } else {
        updated.tags = [...(existing?.tags ?? []), ['a', addr]];
      }

      await updated.publish();
    } finally {
      bookmarking = false;
    }
  }

  const routeIdentifier = $derived(page.params.id || '');
  const seedEvent = $derived(data.event ? new NDKEvent(ndk, data.event) : undefined);
  const fetchedEvent = createFetchEvent(ndk, () => ({
    bech32: routeIdentifier,
    opts: { closeOnEose: true }
  }));
  const event = $derived(fetchedEvent.event ?? seedEvent);
  const isArticle = $derived(event?.kind === 30023);
  const authorPubkey = $derived(event?.pubkey ?? data.authorPubkey ?? '');
  const author = createFetchUser(ndk, () => authorPubkey || data.authorNpub || '');
  const authorProfile = $derived(author.profile ?? data.profile);
  const authorLinkIdentifier = $derived(
    profileIdentifier(
      authorProfile,
      data.authorIdentifier ||
        safeUserIdentifier(author, data.authorNpub || authorPubkey || 'author')
    )
  );
  const seedComments = $derived(
    (data.comments ?? []).map((comment: NostrEvent) => new NDKEvent(ndk, comment))
  );
  const seedHighlights = $derived(
    (data.highlights ?? []).map((highlight: NostrEvent) => new NDKEvent(ndk, highlight))
  );
  const liveComments = ndk.$subscribe(() => {
    if (!browser || !event || event.kind !== 30023) return undefined;

    const filters = buildReferenceFilters(targetReferences(event), [1111], {
      addressTag: 'A',
      idTag: 'E',
      limit: 120
    });

    return filters.length > 0 ? { filters } : undefined;
  });
  const liveHighlights = ndk.$subscribe(() => {
    if (!browser || !event || event.kind !== 30023) return undefined;

    const filters = buildReferenceFilters(targetReferences(event), [9802], {
      addressTag: 'a',
      idTag: 'e',
      limit: 80
    });

    return filters.length > 0 ? { filters } : undefined;
  });
  const commentEvents = $derived(
    mergeUniqueEvents(
      liveComments.events.filter((comment) => comment.kind === 1111),
      seedComments
    )
  );
  const highlightEvents = $derived(
    mergeUniqueEvents(
      liveHighlights.events.filter((highlight) => highlight.kind === 9802),
      seedHighlights
    )
  );
  const missing = $derived(!event && (browser ? !fetchedEvent.loading : data.missing));
  const authorName = $derived(displayName(authorProfile, authorPubkey ? `${authorPubkey.slice(0, 8)}...` : 'Author'));
  const authorIdentity = $derived.by(() => {
    const nip05 = displayNip05(authorProfile);
    return nip05 && nip05 !== authorName ? nip05 : '';
  });
  const articleAddress = $derived(isArticle && event ? event.tagId() : '');
  const shareUrl = $derived(browser ? page.url.href : '');
  const articleEventId = $derived(event?.id ?? '');
  const commentCount = $derived(commentEvents.length);
  const highlightCount = $derived(highlightEvents.length);

  type CommentNode = {
    event: NDKEvent;
    children: CommentNode[];
  };

  const commentTree = $derived.by(() => {
    const rootReferences = new Set([articleAddress, articleEventId].filter(Boolean));
    const nodes = commentEvents.map((comment) => ({
      event: comment,
      parentReference: commentParentReference(comment),
      children: [] as CommentNode[]
    }));
    const nodesByReference = new Map<string, CommentNode>();

    for (const node of nodes) {
      nodesByReference.set(node.event.id, node);
      nodesByReference.set(node.event.tagId(), node);
    }

    const roots: CommentNode[] = [];

    for (const node of nodes) {
      if (!node.parentReference || rootReferences.has(node.parentReference)) {
        roots.push(node);
        continue;
      }

      const parent = nodesByReference.get(node.parentReference);
      if (!parent || parent === node) {
        roots.push(node);
        continue;
      }

      parent.children.push(node);
    }

    return sortCommentNodes(roots, 'desc');
  });

  function tagValue(tags: string[][], name: string): string {
    return tags.find((tag) => tag[0] === name)?.[1]?.trim() ?? '';
  }

  function commentParentReference(comment: NDKEvent): string {
    return tagValue(comment.tags, 'a') || tagValue(comment.tags, 'e') || tagValue(comment.tags, 'i');
  }

  function sortCommentNodes(nodes: CommentNode[], direction: 'asc' | 'desc'): CommentNode[] {
    const sorted = [...nodes].sort((left, right) =>
      direction === 'asc'
        ? (left.event.created_at ?? 0) - (right.event.created_at ?? 0)
        : (right.event.created_at ?? 0) - (left.event.created_at ?? 0)
    );

    for (const node of sorted) {
      node.children = sortCommentNodes(node.children, 'asc');
    }

    return sorted;
  }

  function targetReferences(target: NDKEvent): Set<string> {
    const references = new Set<string>();
    const tagId = target.tagId();

    if (tagId) references.add(tagId);
    if (target.id) references.add(target.id);

    return references;
  }

  function buildReferenceFilters(
    references: Set<string>,
    kinds: number[],
    options: {
      addressTag: string;
      idTag: string;
      limit: number;
    }
  ): NDKFilter[] {
    const ids: string[] = [];
    const addresses: string[] = [];

    for (const reference of references) {
      if (reference.includes(':')) addresses.push(reference);
      else ids.push(reference);
    }

    const filters: NDKFilter[] = [];

    if (addresses.length > 0) {
      const filter = { kinds, limit: options.limit } as NDKFilter & Record<`#${string}`, string[]>;
      filter[`#${options.addressTag}`] = addresses;
      filters.push(filter);
    }

    if (ids.length > 0) {
      const filter = { kinds, limit: options.limit } as NDKFilter & Record<`#${string}`, string[]>;
      filter[`#${options.idTag}`] = ids;
      filters.push(filter);
    }

    return filters;
  }

  async function submitComment(parentEvent: NDKEvent | null) {
    if (!currentUser || !replyText.trim() || !event) return;

    submitting = true;
    try {
      const root = event;
      let reply: NDKEvent;

      if (parentEvent) {
        reply = parentEvent.reply();
      } else {
        reply = root.reply();
      }

      reply.content = replyText.trim();
      await reply.publish();

      replyText = '';
      replyingTo = null;
    } finally {
      submitting = false;
    }
  }
</script>

{#if missing}
  <section class="article-container">
    <h1>{browser && fetchedEvent.loading ? 'Loading this post...' : 'This post is not available right now'}</h1>
    <p class="muted" style="margin: 0;">
      {browser && fetchedEvent.loading
        ? 'Trying to load it directly from relays.'
        : 'It may have moved, been deleted, or not synced yet.'}
    </p>
  </section>
{:else if event}
  <section class="article-container">
    <article>
      <h1>{isArticle ? articleTitle(event.rawEvent()) : noteTitle(event.rawEvent())}</h1>

      <div class="article-byline">
        <User.Root {ndk} pubkey={authorPubkey} profile={authorProfile}>
          <a class="article-author-link" href={`/profile/${authorLinkIdentifier}`}>
            <User.Avatar class="article-author-avatar" />
          </a>
          <div class="article-author-copy">
            <div class="feed-meta">
              <a class="article-author-name" href={`/profile/${authorLinkIdentifier}`}>{authorName}</a>
              <span>
                {#if isArticle}
                  {formatDisplayDate(articlePublishedAt(event.rawEvent()))}
                {:else if event.created_at}
                  {new Date(event.created_at * 1000).toLocaleString()}
                {/if}
              </span>
              {#if isArticle}
                <span>{articleReadTimeMinutes(event.content)} min read</span>
              {/if}
            </div>
            {#if authorIdentity}
              <div class="feed-meta">
                <span class="article-author-handle">{authorIdentity}</span>
              </div>
            {/if}
          </div>
        </User.Root>

        <div class="article-actions">
          {#if isArticle}
            <SharePopover
              url={shareUrl}
              title={isArticle ? articleTitle(event.rawEvent()) : noteTitle(event.rawEvent())}
            />
          {/if}
          {#if currentUser && isArticle}
            <button
              class="bookmark-btn"
              class:bookmarked={isBookmarked}
              disabled={bookmarking}
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this article'}
              onclick={toggleBookmark}
            >
              <BookmarkIcon filled={isBookmarked} />
            </button>
          {/if}
        </div>
      </div>

      <p class="lede" style="margin: 0;">
        {isArticle ? articleSummary(event.rawEvent(), 320) : noteExcerpt(event.content, 320)}
      </p>

      {#if isArticle}
        <Tabs.Root bind:value={activeTab} activationMode="manual">
          <Tabs.List class="article-tabs-list" aria-label="Article views">
            <Tabs.Trigger value="article">Article</Tabs.Trigger>
            <Tabs.Trigger value="comments">
              <span>Comments</span>
              <span class="article-tab-count">{commentCount}</span>
            </Tabs.Trigger>
            <Tabs.Trigger value="highlights">
              <span>Highlights</span>
              <span class="article-tab-count">{highlightCount}</span>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="article" class="article-tab-panel">
            <div bind:this={articleContentEl}>
              <ArticleMarkdown content={event.content} tags={event.tags} highlights={highlightEvents} />
            </div>
            <div class="share-footer">
              <p class="share-footer-label">Share this article</p>
              <div class="share-footer-actions">
                <a
                  class="share-footer-btn"
                  href="https://x.com/intent/tweet?text={encodeURIComponent(articleTitle(event.rawEvent()))}&url={encodeURIComponent(shareUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  X / Twitter
                </a>
                <a
                  class="share-footer-btn"
                  href="https://www.facebook.com/sharer/sharer.php?u={encodeURIComponent(shareUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Facebook
                </a>
                <a
                  class="share-footer-btn"
                  href="https://www.linkedin.com/sharing/share-offsite/?url={encodeURIComponent(shareUrl)}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  LinkedIn
                </a>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="comments" class="article-tab-panel">
            <!-- Top-level comment form -->
            {#if currentUser}
              {#if replyingTo === null}
                <div class="comment-compose">
                  <textarea
                    class="comment-compose-input"
                    placeholder="Write a comment…"
                    bind:value={replyText}
                    rows="3"
                  ></textarea>
                  <div class="comment-compose-actions">
                    <button
                      class="button"
                      disabled={submitting || !replyText.trim()}
                      onclick={() => submitComment(null)}
                    >
                      {submitting ? 'Publishing…' : 'Comment'}
                    </button>
                  </div>
                </div>
              {/if}
            {:else}
              <p class="muted comment-login-prompt">Log in to leave a comment.</p>
            {/if}

            {#if commentTree.length > 0}
              <div class="comment-thread">
                {#snippet renderComments(nodes: CommentNode[], depth = 0)}
                  {#each nodes as node (node.event.id)}
                    <div class="comment-node" class:comment-node-nested={depth > 0}>
                      <div class="comment-header">
                        <EventAuthorHeader
                          {ndk}
                          pubkey={node.event.pubkey}
                          timestamp={node.event.created_at}
                          fallbackName="Commenter"
                          avatarClass="article-author-avatar comment-avatar"
                        />
                      </div>

                      <div class="comment-body-wrap">
                        <MarkdownEventContent
                          {ndk}
                          content={node.event.content}
                          emojiTags={node.event.tags}
                          class="comment-body"
                        />

                        <div class="comment-actions">
                          {#if currentUser}
                            <button
                              class="comment-reply-btn"
                              onclick={() => {
                                replyingTo = replyingTo === node.event.id ? null : node.event.id;
                                replyText = '';
                              }}
                            >
                              {replyingTo === node.event.id ? 'Cancel' : 'Reply'}
                            </button>
                          {/if}
                        </div>

                        {#if replyingTo === node.event.id}
                          <div class="comment-compose comment-compose-inline">
                            <textarea
                              class="comment-compose-input"
                              placeholder="Write a reply…"
                              bind:value={replyText}
                              rows="3"
                            ></textarea>
                            <div class="comment-compose-actions">
                              <button
                                class="button"
                                disabled={submitting || !replyText.trim()}
                                onclick={() => submitComment(node.event)}
                              >
                                {submitting ? 'Publishing…' : 'Reply'}
                              </button>
                            </div>
                          </div>
                        {/if}

                        {#if node.children.length > 0}
                          <div class="comment-children">
                            {@render renderComments(node.children, depth + 1)}
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}
                {/snippet}

                {@render renderComments(commentTree)}
              </div>
            {:else if currentUser === undefined}
              <!-- still loading -->
            {:else}
              <p class="muted" style="margin: 0;">No comments yet. Be the first.</p>
            {/if}
          </Tabs.Content>

          <Tabs.Content value="highlights" class="article-tab-panel">
            {#if highlightEvents.length > 0}
              <div class="highlight-stack">
                {#each highlightEvents as highlight (highlight.id)}
                  <article class="highlight-card">
                    <EventAuthorHeader
                      {ndk}
                      pubkey={highlight.pubkey}
                      timestamp={highlight.created_at}
                      fallbackName="Reader"
                    />

                    <blockquote class="highlight-quote">
                      {highlight.content || 'This highlight has no text excerpt.'}
                    </blockquote>

                    {#if tagValue(highlight.tags, 'comment')}
                      <p class="highlight-note">{tagValue(highlight.tags, 'comment')}</p>
                    {/if}

                    {#if tagValue(highlight.tags, 'context')}
                      <p class="caption" style="margin: 0;">Context: {tagValue(highlight.tags, 'context')}</p>
                    {/if}
                  </article>
                {/each}
              </div>
            {/if}
          </Tabs.Content>
        </Tabs.Root>
      {:else}
        <pre class="document-copy">{event.content}</pre>
      {/if}
    </article>

    {#if isArticle}
      <HighlightPopover articleEvent={event} containerEl={articleContentEl} />
    {/if}
  </section>
{/if}

<style>
  .article-container {
    max-width: var(--content-width);
    margin: 0 auto;
    display: grid;
    gap: 1.35rem;
  }

  /* ── article actions (share + bookmark) ──────────────────── */

  .article-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  /* ── bookmark button ──────────────────────────────────────── */

  .bookmark-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .bookmark-btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .bookmark-btn.bookmarked {
    color: var(--accent);
    border-color: var(--accent);
    background: rgba(255, 103, 25, 0.06);
  }

  .bookmark-btn:active {
    transform: scale(0.92);
  }

  .bookmark-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  /* ── comment compose ───────────────────────────────────────── */

  .comment-compose {
    display: grid;
    gap: 0.65rem;
    margin-bottom: 1.5rem;
  }

  .comment-compose-inline {
    margin-top: 0.75rem;
    margin-bottom: 0;
  }

  .comment-compose-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface);
    color: var(--text);
    font-size: 0.95rem;
    line-height: 1.5;
    resize: vertical;
    transition: border-color 160ms ease;
  }

  .comment-compose-input:focus {
    outline: none;
    border-color: var(--text);
  }

  .comment-compose-actions {
    display: flex;
    justify-content: flex-end;
  }

  .comment-login-prompt {
    margin-bottom: 1.5rem;
  }

  /* ── comment thread ────────────────────────────────────────── */

  .comment-thread {
    display: grid;
    gap: 0;
  }

  .comment-node {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0 0.75rem;
    padding: 1rem 0;
    border-top: 1px solid var(--border-light);
  }

  .comment-node:first-child {
    border-top: none;
  }

  .comment-node-nested {
    border-top: none;
    padding-top: 0.75rem;
  }

  .comment-header {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 0.6rem;
    margin-bottom: 0.5rem;
  }

  :global(.comment-avatar) {
    width: 2rem !important;
    height: 2rem !important;
  }

  .comment-body-wrap {
    grid-column: 1 / -1;
    padding-left: 2.75rem;
    display: grid;
    gap: 0.5rem;
  }

  :global(.comment-body) {
    color: var(--text);
    font-size: 0.95rem;
    line-height: 1.6;
    overflow-wrap: anywhere;
  }

  :global(.comment-body p) {
    margin: 0 0 0.5rem;
  }

  :global(.comment-body p:last-child) {
    margin-bottom: 0;
  }

  .comment-actions {
    display: flex;
    gap: 0.75rem;
  }

  .comment-reply-btn {
    background: none;
    border: none;
    padding: 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--muted);
    cursor: pointer;
    letter-spacing: 0.02em;
    transition: color 120ms ease;
  }

  .comment-reply-btn:hover {
    color: var(--accent);
  }

  /* nested indentation via left border line */
  .comment-children {
    margin-top: 0.25rem;
    padding-left: 0;
    border-left: 2px solid var(--border-light);
    padding-left: 1rem;
  }

  .comment-children .comment-node {
    padding-top: 0.75rem;
    padding-bottom: 0.75rem;
    border-top: none;
  }

  .comment-children .comment-node + .comment-node {
    border-top: 1px solid var(--border-light);
  }

  /* ── share footer ──────────────────────────────────────────── */

  .share-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    padding: 2.5rem 0 1rem;
    border-top: 1px solid var(--border-light);
    margin-top: 2.5rem;
  }

  .share-footer-label {
    margin: 0;
    font-size: 0.78rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .share-footer-actions {
    display: flex;
    gap: 0.65rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .share-footer-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 1.1rem;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: var(--surface);
    color: var(--text);
    font-size: 0.85rem;
    font-weight: 500;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 120ms ease;
    white-space: nowrap;
  }

  .share-footer-btn:hover {
    border-color: var(--text);
    background: var(--surface-hover, rgba(0, 0, 0, 0.03));
  }

  .share-footer-btn:active {
    transform: scale(0.97);
  }
</style>
