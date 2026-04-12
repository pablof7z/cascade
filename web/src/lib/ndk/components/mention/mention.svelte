<script lang="ts">
  import { NDKUser } from '@nostr-dev-kit/ndk';
  import type { NDKSvelte } from '@nostr-dev-kit/svelte';
  import { User } from '../../ui/user';

  export interface MentionProps {
    ndk: NDKSvelte;
    bech32: string;
    onclick?: (user: NDKUser) => void;
    class?: string;
  }

  let { ndk, bech32, onclick, class: className = '' }: MentionProps = $props();

  let user = $state<NDKUser | null>(null);

  const href = $derived.by(() => {
    if (!user) return undefined;

    try {
      return `/profile/${user.npub}`;
    } catch {
      return `/profile/${user.pubkey}`;
    }
  });

  $effect(() => {
    let cancelled = false;

    ndk
      .fetchUser(bech32)
      .then((resolved) => {
        if (!cancelled) {
          user = resolved ?? null;
        }
      })
      .catch(() => {
        if (!cancelled) {
          user = null;
        }
      });

    return () => {
      cancelled = true;
    };
  });

  function handleClick(e: MouseEvent) {
    if (onclick && user) {
      e.preventDefault();
      onclick(user);
    }
  }
</script>

{#if user && href}
  <a data-mention="" class={`mention ${className}`} href={href} onclick={handleClick}>
    <User.Root {ndk} {user}>
      @<User.Name class="mention-name" field="name" fallback="someone" />
    </User.Root>
  </a>
{:else}
  <span data-mention="" class={`mention ${className}`}>@someone</span>
{/if}

<style>
  .mention {
    display: inline-flex;
    align-items: center;
    color: var(--text-strong);
    text-decoration: underline;
    text-decoration-color: rgba(17, 17, 17, 0.25);
    text-underline-offset: 0.16em;
  }

  .mention:hover {
    text-decoration-color: rgba(17, 17, 17, 0.5);
  }

  .mention-name {
    display: inline;
  }
</style>
