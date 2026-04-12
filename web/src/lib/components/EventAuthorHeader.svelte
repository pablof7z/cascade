<script lang="ts">
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { User } from '$lib/ndk/ui/user';

  interface Props {
    ndk: NDKSvelte;
    pubkey: string;
    timestamp?: number;
    fallbackName?: string;
    avatarClass?: string;
  }

  let {
    ndk,
    pubkey,
    timestamp,
    fallbackName = 'Someone',
    avatarClass = 'article-author-avatar article-author-avatar-compact'
  }: Props = $props();

  const dateLabel = $derived(
    timestamp ? new Date(timestamp * 1000).toLocaleString() : 'Undated'
  );
</script>

<div class="event-author-header">
  <User.Root {ndk} {pubkey}>
    <a class="event-author-avatar-link" href={`/profile/${pubkey}`}>
      <User.Avatar class={avatarClass} />
    </a>
    <div class="event-author-header-copy">
      <a class="event-author-name" href={`/profile/${pubkey}`}>
        <User.Name fallback={fallbackName} />
      </a>
      <span class="event-author-date">{dateLabel}</span>
    </div>
  </User.Root>
</div>

<style>
  .event-author-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
  }

  .event-author-avatar-link {
    flex-shrink: 0;
  }

  .event-author-header-copy {
    display: flex;
    align-items: baseline;
    gap: 0.55rem;
    flex-wrap: wrap;
    min-width: 0;
  }

  .event-author-name {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--text-strong);
    text-decoration: none;
  }

  .event-author-name:hover {
    color: var(--accent);
  }

  .event-author-date {
    font-size: 0.78rem;
    color: var(--muted);
  }
</style>
