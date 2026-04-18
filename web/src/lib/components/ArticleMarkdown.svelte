<script lang="ts">
  import { ndk } from '$lib/ndk/client';
  import { MarkdownEventContent } from '$lib/ndk/ui/markdown-event-content';
  import '$lib/ndk/components/mention';
  import '$lib/ndk/components/embedded-note';
  import '$lib/ndk/components/embedded-article';

  interface Props {
    content: string;
    tags?: string[][];
    class?: string;
  }

  let { content, tags = [], class: className = '' }: Props = $props();
</script>

<div class={`article-markdown ${className}`}>
  <MarkdownEventContent {ndk} {content} emojiTags={tags} class="article-markdown__content" />
</div>

<style>
  .article-markdown {
    width: 100%;
  }

  .article-markdown :global(.article-markdown__content) {
    color: var(--color-base-content);
  }

  .article-markdown :global(.article-markdown__content > :first-child) {
    margin-top: 0;
  }

  .article-markdown :global(.article-markdown__content h1),
  .article-markdown :global(.article-markdown__content h2),
  .article-markdown :global(.article-markdown__content h3),
  .article-markdown :global(.article-markdown__content h4) {
    margin: 2.2rem 0 1rem;
    color: white;
    font-family: var(--font-serif);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.1;
  }

  .article-markdown :global(.article-markdown__content h1) {
    font-size: clamp(2rem, 4vw, 2.8rem);
  }

  .article-markdown :global(.article-markdown__content h2) {
    font-size: clamp(1.6rem, 3vw, 2.1rem);
  }

  .article-markdown :global(.article-markdown__content h3) {
    font-size: 1.35rem;
  }

  .article-markdown :global(.article-markdown__content p),
  .article-markdown :global(.article-markdown__content li) {
    font-family: var(--font-serif);
    font-size: 1.08rem;
    line-height: 1.9;
  }

  .article-markdown :global(.article-markdown__content p) {
    margin: 0 0 1.2rem;
  }

  .article-markdown :global(.article-markdown__content ul),
  .article-markdown :global(.article-markdown__content ol) {
    margin: 0 0 1.4rem;
    padding-left: 1.5rem;
  }

  .article-markdown :global(.article-markdown__content blockquote) {
    margin: 2rem 0;
    padding-left: 1.2rem;
    border-left: 3px solid var(--color-neutral);
    color: var(--color-neutral-content);
    font-style: italic;
  }

  .article-markdown :global(.article-markdown__content pre) {
    margin: 1.5rem 0;
    padding: 1rem;
    border: 1px solid var(--color-neutral);
    border-radius: var(--radius-sm);
    background: var(--color-base-300);
    overflow-x: auto;
  }

  .article-markdown :global(.article-markdown__content code) {
    padding: 0.12rem 0.32rem;
    border-radius: 4px;
    background: var(--color-base-300);
    font-size: 0.88rem;
    font-family: var(--font-mono);
  }

  .article-markdown :global(.article-markdown__content pre code) {
    padding: 0;
    background: transparent;
  }

  .article-markdown :global(.article-markdown__content a) {
    color: white;
    text-decoration: underline;
    text-decoration-color: rgba(17, 17, 17, 0.28);
    text-underline-offset: 0.18em;
  }

  .article-markdown :global(.article-markdown__content img) {
    max-width: 100%;
    height: auto;
    margin: 1.75rem 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-neutral);
  }

  .article-markdown :global(.article-markdown__content hr) {
    margin: 2rem 0;
    border: 0;
    border-top: 1px solid var(--color-neutral);
  }

  .article-markdown :global(.article-markdown__content table) {
    width: 100%;
    margin: 1.5rem 0;
    border-collapse: collapse;
    font-size: 0.96rem;
  }

  .article-markdown :global(.article-markdown__content th),
  .article-markdown :global(.article-markdown__content td) {
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--color-neutral);
    text-align: left;
  }

  .article-markdown :global(.article-markdown__content .nostr-event-ref),
  .article-markdown :global(.article-markdown__content .nostr-mention) {
    display: inline-flex;
    max-width: 100%;
  }
</style>
