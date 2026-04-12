<script lang="ts">
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { Marked } from 'marked';
  import { getContext, mount, onMount, setContext, unmount } from 'svelte';
  import { createNostrMarkdownExtensions } from '../../builders/markdown-nostr-extensions/index.js';
  import EmbeddedEvent from '../embedded-event.svelte';
  import { defaultContentRenderer, type ContentRenderer } from '../content-renderer';
  import {
    CONTENT_RENDERER_CONTEXT_KEY,
    type ContentRendererContext
  } from '../content-renderer/content-renderer.context.js';

  export interface MarkdownEventContentProps {
    ndk?: NDKSvelte;
    content: string;
    emojiTags?: string[][];
    renderer?: ContentRenderer;
    class?: string;
  }

  let {
    ndk = getContext<NDKSvelte>('ndk'),
    content,
    emojiTags,
    renderer: providedRenderer,
    class: className = ''
  }: MarkdownEventContentProps = $props();

  const parentContext = getContext<ContentRendererContext | undefined>(CONTENT_RENDERER_CONTEXT_KEY);
  const renderer = $derived(providedRenderer ?? parentContext?.renderer ?? defaultContentRenderer);

  setContext(CONTENT_RENDERER_CONTEXT_KEY, {
    get renderer() {
      return renderer;
    }
  });

  let contentElement: HTMLDivElement;
  let mountedComponents: Array<{ unmount: () => void }> = [];

  const htmlContent = $derived.by(() => {
    const markedInstance = new Marked();
    markedInstance.use({
      extensions: createNostrMarkdownExtensions({
        emojiTags
      })
    });

    return markedInstance.parse(content) as string;
  });

  function clearMountedComponents() {
    for (const mounted of mountedComponents) {
      mounted.unmount();
    }

    mountedComponents = [];
  }

  function hydrateNostrComponents() {
    if (!contentElement) return;

    clearMountedComponents();

    const mentions = contentElement.querySelectorAll('.nostr-mention');
    mentions.forEach((placeholder) => {
      const bech32 = placeholder.getAttribute('data-bech32');
      if (!bech32) return;

      if (!renderer.mentionComponent) {
        placeholder.textContent = `nostr:${bech32}`;
        return;
      }

      placeholder.replaceChildren();

      const mounted = mount(renderer.mentionComponent, {
        target: placeholder,
        props: {
          ndk,
          bech32,
          onclick: renderer.onUserClick
        }
      });

      mountedComponents.push({
        unmount: () => unmount(mounted)
      });
    });

    const eventRefs = contentElement.querySelectorAll('.nostr-event-ref');
    eventRefs.forEach((placeholder) => {
      const bech32 = placeholder.getAttribute('data-bech32');
      if (!bech32) return;

      placeholder.replaceChildren();

      const mounted = mount(EmbeddedEvent, {
        target: placeholder,
        props: {
          ndk,
          bech32,
          renderer,
          onclick: renderer.onEventClick
        }
      });

      mountedComponents.push({
        unmount: () => unmount(mounted)
      });
    });

    const hashtags = contentElement.querySelectorAll('.nostr-hashtag');
    hashtags.forEach((placeholder) => {
      const tag = placeholder.getAttribute('data-tag');
      if (!tag) return;

      if (!renderer.hashtagComponent) {
        placeholder.textContent = `#${tag}`;
        return;
      }

      placeholder.replaceChildren();

      const mounted = mount(renderer.hashtagComponent, {
        target: placeholder,
        props: {
          ndk,
          tag,
          onclick: renderer.onHashtagClick
        }
      });

      mountedComponents.push({
        unmount: () => unmount(mounted)
      });
    });
  }

  onMount(() => {
    hydrateNostrComponents();

    return () => {
      clearMountedComponents();
    };
  });

  $effect(() => {
    htmlContent;

    if (contentElement) {
      hydrateNostrComponents();
    }
  });
</script>

<div bind:this={contentElement} class={className} data-markdown-event-content="">
  {@html htmlContent}
</div>

<style>
  [data-markdown-event-content] {
    line-height: 1.7;
  }

  [data-markdown-event-content] :global(.nostr-emoji) {
    display: inline-block;
    width: auto;
    height: 1.2em;
    vertical-align: middle;
  }
</style>
