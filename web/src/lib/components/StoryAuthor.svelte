<script lang="ts">
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { createProfileFetcher } from '$lib/ndk/builders/profile/index.svelte.js';
  import { displayName, displayNip05, profileIdentifier } from '$lib/ndk/format';
  import { User } from '$lib/ndk/ui/user';
  import { untrack } from 'svelte';

  interface Props {
    ndk: NDKSvelte;
    pubkey: string;
    profile?: NDKUserProfile;
    compact?: boolean;
  }

  let { ndk, pubkey, profile: initialProfile, compact = false }: Props = $props();

  const stableNdk = untrack(() => ndk);
  const profileFetcher = createProfileFetcher(
    () => ({ user: initialProfile ? null : pubkey }),
    stableNdk
  );
  const resolvedProfile = $derived(initialProfile ?? profileFetcher.profile ?? undefined);

  const primaryLabel = $derived.by(() => {
    return displayName(resolvedProfile, 'Author');
  });

  const secondaryLabel = $derived.by(() => {
    const nip05 = displayNip05(resolvedProfile);
    return nip05 && nip05 !== primaryLabel ? nip05 : '';
  });

  const href = $derived(`/p/${profileIdentifier(resolvedProfile, pubkey)}`);
</script>

<User.Root {ndk} {pubkey} profile={resolvedProfile}>
  <a class="inline-flex items-center gap-2 hover:opacity-80 transition-opacity" href={href}>
    <div class="avatar">
      <div class={compact ? 'h-6 w-6 rounded-full' : 'h-8 w-8 rounded-full'}>
        <User.Avatar />
      </div>
    </div>
    <div class="grid gap-px">
      <strong class="text-sm font-semibold text-white leading-tight">{primaryLabel}</strong>
      {#if secondaryLabel && !compact}
        <span class="text-xs text-base-content/60">{secondaryLabel}</span>
      {/if}
    </div>
  </a>
</User.Root>
