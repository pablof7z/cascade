<script lang="ts">
  import { Link } from '$app/navigation';
  import { nip19 } from 'nostr-tools';
  import { getActorDisplayName, CROWD_PUBKEYS } from '../../market';

  interface Props {
    pubkey: string;
    size?: 'sm' | 'md' | 'lg';
    showName?: boolean;
    class?: string;
  }

  let { pubkey, size = 'md', showName = false, class: className = '' }: Props = $props();

  const SIZE_CLASSES = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-8 h-8 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  function getAvatarColor(pubkey: string): string {
    const colors = [
      'bg-emerald-500',
      'bg-neutral-600',
      'bg-rose-500',
      'bg-neutral-700',
      'bg-neutral-800',
      'bg-neutral-900',
    ];
    let hash = 0;
    for (let i = 0; i < pubkey.length; i++) {
      hash = pubkey.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  }

  function getInitials(name: string): string {
    const parts = name.split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  function pubkeyToNpub(pubkey: string): string {
    if (pubkey.startsWith('sim_')) {
      return pubkey;
    }
    try {
      return nip19.npubEncode(pubkey);
    } catch {
      return pubkey;
    }
  }

  function isSimulatedActor(pubkey: string): boolean {
    return (
      pubkey.startsWith('sim_') ||
      pubkey === CROWD_PUBKEYS.alice ||
      pubkey === CROWD_PUBKEYS.bob ||
      pubkey === CROWD_PUBKEYS.carol
    );
  }

  let displayName = $derived(getActorDisplayName(pubkey));
  let initials = $derived(getInitials(displayName));
  let colorClass = $derived(getAvatarColor(pubkey));
  let sizeClass = $derived(SIZE_CLASSES[size]);
  let npub = $derived(pubkeyToNpub(pubkey));
  let isSimulated = $derived(isSimulatedActor(pubkey));
</script>

{#if showName}
  <div class="flex items-center gap-2">
    <div
      class="{sizeClass} {colorClass} rounded-full flex items-center justify-center text-white font-medium {className}"
      title={displayName}
    >
      {initials}
    </div>
    <span class="text-sm text-neutral-300">{displayName}</span>
  </div>
{:else}
  {#if isSimulated}
    <div
      class="{sizeClass} {colorClass} rounded-full flex items-center justify-center text-white font-medium {className}"
      title={displayName}
    >
      {initials}
    </div>
  {:else}
    <Link
      to="/profile/{npub}"
      class="hover:opacity-80 transition-opacity"
    >
      <div
        class="{sizeClass} {colorClass} rounded-full flex items-center justify-center text-white font-medium {className}"
        title={displayName}
      >
        {initials}
      </div>
    </Link>
  {/if}
{/if}
