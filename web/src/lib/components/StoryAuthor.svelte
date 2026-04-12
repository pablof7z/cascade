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
    avatarClass?: string;
    compact?: boolean;
  }

  let { ndk, pubkey, profile: initialProfile, avatarClass = '', compact = false }: Props = $props();

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

  const href = $derived(`/profile/${profileIdentifier(resolvedProfile, pubkey)}`);
</script>

<User.Root {ndk} {pubkey} profile={resolvedProfile}>
  <a class="story-author-link" href={href}>
    <User.Avatar class={avatarClass} />
    <div class={`story-byline-copy${compact ? ' compact' : ''}`}>
      <strong class="story-author-name">{primaryLabel}</strong>
      {#if secondaryLabel}
        <span class="story-author-handle">{secondaryLabel}</span>
      {/if}
    </div>
  </a>
</User.Root>
