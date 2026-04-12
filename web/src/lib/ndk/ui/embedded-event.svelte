<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import { createFetchEvent, type NDKSvelte } from '@nostr-dev-kit/svelte';
  import { getContext, setContext, untrack } from 'svelte';
  import { defaultContentRenderer, type ContentRenderer } from './content-renderer';
  import {
    CONTENT_RENDERER_CONTEXT_KEY,
    type ContentRendererContext
  } from './content-renderer/content-renderer.context.js';

  export interface EmbeddedEventProps {
    ndk: NDKSvelte;
    bech32: string;
    renderer?: ContentRenderer;
    onclick?: (event: NDKEvent) => void;
    class?: string;
  }

  let {
    ndk,
    bech32,
    renderer: rendererProp,
    onclick,
    class: className = ''
  }: EmbeddedEventProps = $props();

  const parentContext = getContext<ContentRendererContext | undefined>(CONTENT_RENDERER_CONTEXT_KEY);
  const renderer = $derived(rendererProp ?? parentContext?.renderer ?? defaultContentRenderer);

  setContext(CONTENT_RENDERER_CONTEXT_KEY, {
    get renderer() {
      return renderer;
    }
  });

  // Embedded references intentionally use the current NDK instance as a stable fetch source.
  const stableNdk = untrack(() => ndk);
  const eventFetcher = createFetchEvent(stableNdk, () => ({ bech32 }));

  const handlerInfo = $derived(renderer.getKindHandler(eventFetcher.event?.kind));
  const KindHandler = $derived(handlerInfo?.component);
  const FallbackHandler = $derived(renderer.fallbackComponent);
  const wrappedEvent = $derived(
    eventFetcher.event && handlerInfo?.wrapper?.from
      ? handlerInfo.wrapper.from(eventFetcher.event)
      : eventFetcher.event
  );

  function handleClick(e: MouseEvent | KeyboardEvent) {
    if (onclick && wrappedEvent) {
      e.stopPropagation();
      onclick(wrappedEvent);
    }
  }
</script>

{#if eventFetcher.loading}
  <span class={`embedded-status ${className}`}>Loading reference…</span>
{:else if eventFetcher.error}
  <span class={`embedded-status embedded-status-error ${className}`}>Reference unavailable</span>
{:else if KindHandler && wrappedEvent}
  {#if onclick}
    <span
      class="embedded-clickable"
      role="button"
      tabindex="0"
      onclick={handleClick}
      onkeydown={(e) => e.key === 'Enter' && handleClick(e)}
    >
      <KindHandler {ndk} event={wrappedEvent} />
    </span>
  {:else}
    <KindHandler {ndk} event={wrappedEvent} />
  {/if}
{:else if FallbackHandler && wrappedEvent}
  <FallbackHandler {ndk} event={wrappedEvent} class={className} />
{:else if wrappedEvent}
  Referenced post
{/if}

<style>
  .embedded-status {
    display: inline-flex;
    align-items: center;
    min-height: 1.8rem;
    padding: 0 0.6rem;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: var(--surface-soft);
    color: var(--muted);
    font-size: 0.8rem;
  }

  .embedded-status-error {
    color: var(--pale-red-text);
    background: var(--pale-red);
  }

  .embedded-clickable {
    display: inline-flex;
    max-width: 100%;
  }
</style>
