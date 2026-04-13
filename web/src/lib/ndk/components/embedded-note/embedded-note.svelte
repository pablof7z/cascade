<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { noteExcerpt, noteTitle } from '../../format';

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
  <a data-embedded-note="" class={`embedded-card ${className}`} href={href}>
    <span class="embedded-kind">Referenced note</span>
    <strong>{noteTitle(event.rawEvent())}</strong>
    <span class="embedded-copy">{noteExcerpt(event.content, 140)}</span>
    <span class="embedded-meta">Open note</span>
  </a>
{:else}
  <span data-embedded-note="" class={`embedded-card ${className}`}>
    {noteTitle(event.rawEvent())}
  </span>
{/if}

<style>
  .embedded-card {
    display: inline-grid;
    gap: 0.35rem;
    width: min(100%, 24rem);
    padding: 0.85rem 0.95rem;
    border: 1px solid var(--color-neutral);
    border-radius: 10px;
    background: var(--color-base-300);
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
    font-size: 0.92rem;
    line-height: 1.55;
  }
</style>
