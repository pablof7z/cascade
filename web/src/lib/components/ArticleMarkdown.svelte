<script lang="ts">
  import { tick } from 'svelte';
  import { ndk } from '$lib/ndk/client';
  import { MarkdownEventContent } from '$lib/ndk/ui/markdown-event-content';
  import '$lib/ndk/components/mention';
  import '$lib/ndk/components/embedded-note';
  import '$lib/ndk/components/embedded-article';
  import type { NDKEvent } from '@nostr-dev-kit/ndk';

  interface Props {
    content: string;
    tags?: string[][];
    highlights?: NDKEvent[];
    class?: string;
  }

  let { content, tags = [], highlights = [], class: className = '' }: Props = $props();
  let containerEl = $state<HTMLElement | null>(null);

  /**
   * Build a flat list of text nodes with their cumulative offset within a container's full text.
   */
  function getTextNodesWithOffsets(container: HTMLElement): { node: Text; start: number }[] {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const result: { node: Text; start: number }[] = [];
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      result.push({ node, start: offset });
      offset += node.textContent?.length ?? 0;
    }
    return result;
  }

  /**
   * Wrap a range of text across potentially multiple text nodes in a <mark>.
   * Uses Range + surroundContents for single-node matches,
   * and a manual approach for cross-node highlights.
   */
  function wrapRange(
    textNodes: { node: Text; start: number }[],
    matchStart: number,
    matchEnd: number
  ) {
    // Find which text nodes overlap [matchStart, matchEnd)
    const overlapping: { node: Text; start: number }[] = [];
    for (const entry of textNodes) {
      const nodeEnd = entry.start + (entry.node.textContent?.length ?? 0);
      if (nodeEnd > matchStart && entry.start < matchEnd) {
        overlapping.push(entry);
      }
    }
    if (overlapping.length === 0) return;

    if (overlapping.length === 1) {
      // Simple case: highlight is within a single text node
      const { node, start } = overlapping[0];
      const localStart = matchStart - start;
      const localEnd = matchEnd - start;
      const range = document.createRange();
      range.setStart(node, localStart);
      range.setEnd(node, localEnd);
      const mark = document.createElement('mark');
      mark.className = 'inline-highlight';
      range.surroundContents(mark);
      return;
    }

    // Cross-node highlight: wrap each overlapping text node segment in a mark
    for (const { node, start } of overlapping) {
      const nodeLen = node.textContent?.length ?? 0;
      const localStart = Math.max(0, matchStart - start);
      const localEnd = Math.min(nodeLen, matchEnd - start);

      if (localStart === 0 && localEnd === nodeLen) {
        // Wrap the entire text node
        const mark = document.createElement('mark');
        mark.className = 'inline-highlight';
        node.parentNode!.insertBefore(mark, node);
        mark.appendChild(node);
      } else {
        // Split and wrap the relevant portion
        const range = document.createRange();
        range.setStart(node, localStart);
        range.setEnd(node, localEnd);
        const mark = document.createElement('mark');
        mark.className = 'inline-highlight';
        range.surroundContents(mark);
      }
    }
  }

  function markHighlightsInDom(container: HTMLElement, texts: string[]) {
    if (!texts.length || !container) return;

    // Remove previous marks
    container.querySelectorAll('mark.inline-highlight').forEach((mark) => {
      const parent = mark.parentNode;
      if (parent) {
        parent.replaceChild(document.createTextNode(mark.textContent ?? ''), mark);
        parent.normalize();
      }
    });

    const fullText = container.textContent ?? '';

    for (const highlightText of texts) {
      if (!highlightText || highlightText.length < 8) continue;

      const idx = fullText.indexOf(highlightText);
      if (idx === -1) continue;

      // Rebuild text node list each time (DOM changes after each wrap)
      const textNodes = getTextNodesWithOffsets(container);
      wrapRange(textNodes, idx, idx + highlightText.length);
    }
  }

  $effect(() => {
    // Track dependencies
    const texts = highlights.map((h) => h.content).filter(Boolean);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    content;
    if (!containerEl) return;
    tick().then(() => {
      markHighlightsInDom(containerEl!, texts);
    });
  });
</script>

<div class={`article-markdown ${className}`} bind:this={containerEl}>
  <MarkdownEventContent {ndk} {content} emojiTags={tags} class="article-markdown__content" />
</div>

<style>
  .article-markdown {
    width: 100%;
  }

  .article-markdown :global(.article-markdown__content) {
    color: var(--text);
  }

  .article-markdown :global(.article-markdown__content > :first-child) {
    margin-top: 0;
  }

  .article-markdown :global(.article-markdown__content h1),
  .article-markdown :global(.article-markdown__content h2),
  .article-markdown :global(.article-markdown__content h3),
  .article-markdown :global(.article-markdown__content h4) {
    margin: 2.2rem 0 1rem;
    color: var(--text-strong);
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
    border-left: 3px solid var(--border);
    color: var(--muted);
    font-style: italic;
  }

  .article-markdown :global(.article-markdown__content pre) {
    margin: 1.5rem 0;
    padding: 1rem;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background: var(--surface-soft);
    overflow-x: auto;
  }

  .article-markdown :global(.article-markdown__content code) {
    padding: 0.12rem 0.32rem;
    border-radius: 4px;
    background: var(--surface-soft);
    font-size: 0.88rem;
    font-family: var(--font-mono);
  }

  .article-markdown :global(.article-markdown__content pre code) {
    padding: 0;
    background: transparent;
  }

  .article-markdown :global(.article-markdown__content a) {
    color: var(--text-strong);
    text-decoration: underline;
    text-decoration-color: rgba(17, 17, 17, 0.28);
    text-underline-offset: 0.18em;
  }

  .article-markdown :global(.article-markdown__content img) {
    max-width: 100%;
    height: auto;
    margin: 1.75rem 0;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
  }

  .article-markdown :global(.article-markdown__content hr) {
    margin: 2rem 0;
    border: 0;
    border-top: 1px solid var(--border);
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
    border: 1px solid var(--border);
    text-align: left;
  }

  .article-markdown :global(.article-markdown__content .nostr-event-ref),
  .article-markdown :global(.article-markdown__content .nostr-mention) {
    display: inline-flex;
    max-width: 100%;
  }
</style>
