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
      return `/p/${user.npub}`;
    } catch {
      return `/p/${user.pubkey}`;
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
  <a
    data-mention=""
    class={`inline-flex items-center text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary/70 ${className}`}
    href={href}
    onclick={handleClick}
  >
    <User.Root {ndk} {user}>
      @<User.Name class="inline" field="name" fallback="someone" />
    </User.Root>
  </a>
{:else}
  <span data-mention="" class={`inline-flex items-center text-primary ${className}`}>@someone</span>
{/if}
