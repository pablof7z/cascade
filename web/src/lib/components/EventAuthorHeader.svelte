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
    fallbackName = 'Someone'
  }: Props = $props();

  const dateLabel = $derived(
    timestamp
      ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(timestamp * 1000)
        )
      : 'Undated'
  );
</script>

<div class="flex items-center gap-2">
  <User.Root {ndk} {pubkey}>
    <a class="flex-shrink-0" href={`/p/${pubkey}`}>
      <div class="avatar">
        <div class="h-8 w-8 rounded-full">
          <User.Avatar />
        </div>
      </div>
    </a>
    <div class="flex flex-wrap items-baseline gap-1.5 min-w-0">
      <a class="text-sm font-bold text-white hover:text-primary" href={`/p/${pubkey}`}>
        <User.Name fallback={fallbackName} />
      </a>
      <span class="text-xs text-base-content/60">{dateLabel}</span>
    </div>
  </User.Root>
</div>
