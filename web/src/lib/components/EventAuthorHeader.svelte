<script lang="ts">
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { User } from '$lib/ndk/ui/user';
  import { formatDateTime } from '$lib/cascade/format';

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

  const dateLabel = $derived(timestamp ? formatDateTime(timestamp) : 'Undated');
</script>

<div class="flex items-center gap-2">
  <User.Root {ndk} {pubkey}>
    <a class="shrink-0" href={`/p/${pubkey}`}>
      <User.Avatar class={avatarClass} />
    </a>
    <div class="flex items-baseline gap-2 flex-wrap min-w-0">
      <a class="text-sm font-bold text-white hover:text-primary transition-colors" href={`/p/${pubkey}`}>
        <User.Name fallback={fallbackName} />
      </a>
      <span class="text-xs text-base-content/60">{dateLabel}</span>
    </div>
  </User.Root>
</div>
