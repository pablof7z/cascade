<script lang="ts">
  import { getContext } from 'svelte';
  import { USER_CONTEXT_KEY, type UserContext } from './user.context.js';
  import { deterministicPubkeyGradient } from '@nostr-dev-kit/svelte';
  import { cn } from '../../utils/cn.js';
  import type { Snippet } from 'svelte';

  interface Props {
    class?: string;

    fallback?: string;

    alt?: string;

    customFallback?: Snippet;
  }

  let {
    class: className = '',
    fallback,
    alt,
    customFallback
  }: Props = $props();

  const context = getContext<UserContext>(USER_CONTEXT_KEY);
  if (!context) {
    throw new Error('User.Avatar must be used within User.Root');
  }

  const imageUrl = $derived(context.profile?.picture || fallback);

  const avatarGradient = $derived(
    context.ndkUser?.pubkey
      ? deterministicPubkeyGradient(context.ndkUser.pubkey)
      : 'var(--primary)'
  );
  const avatarInitials = $derived.by(() => {
    const rawName =
      context.profile?.displayName ||
      context.profile?.name ||
      context.profile?.nip05?.split('@')[0] ||
      'Author';

    const parts = rawName
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) return 'A';

    return parts.map((part) => part[0]?.toUpperCase() ?? '').join('').slice(0, 2) || 'A';
  });

  let imageLoaded = $state(false);
  let imageError = $state(false);

  function handleImageLoad() {
    imageLoaded = true;
    imageError = false;
  }

  function handleImageError() {
    imageLoaded = false;
    imageError = true;
  }

  $effect(() => {
    // Reset loading state when imageUrl changes
    imageLoaded = false;
    imageError = false;
  });
</script>

<div data-user-avatar="" class={cn('registry-user-avatar', className)}>
  <!-- Fallback layer (always visible until image loads) -->
  {#if !imageLoaded || !imageUrl}
    {#if customFallback}
      {@render customFallback()}
    {:else}
      <div class="registry-user-avatar-fallback" style="background: {avatarGradient};">
        {avatarInitials}
      </div>
    {/if}
  {/if}

  <!-- Image layer (only visible when loaded) -->
  {#if imageUrl}
    <img
      data-user-avatar--img=""
      src={imageUrl}
      {alt}
      class={cn(
        'registry-user-avatar-image',
        imageLoaded ? 'registry-user-avatar-image-visible' : undefined
      )}
      onload={handleImageLoad}
      onerror={handleImageError}
    />
  {/if}
</div>
