<script lang="ts">
  import './auth.css';
  import { goto } from '$app/navigation';
  import type { NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import AuthenticatedUserMenu from './AuthenticatedUserMenu.svelte';
  import LoginDialog from './LoginDialog.svelte';
  import { authProfileHref, fetchResolvedProfile, needsOnboarding } from './auth';

  let resolvedProfile: NDKUserProfile | undefined = $state();
  let loadingProfile = $state(false);

  const currentUser = $derived(ndk.$currentUser);
  const currentProfile = $derived(resolvedProfile ?? currentUser?.profile ?? undefined);
  const isReadOnly = $derived(Boolean(ndk.$sessions?.isReadOnly()));
  const shouldFinishOnboarding = $derived(
    needsOnboarding({
      user: currentUser,
      profile: currentProfile,
      isReadOnly
    })
  );
  const currentProfileHref = $derived(
    currentUser ? authProfileHref(currentProfile, currentUser.npub) : '/'
  );

  $effect(() => {
    if (!currentUser?.pubkey) {
      resolvedProfile = undefined;
      loadingProfile = false;
      return;
    }

    if (currentUser.profile) {
      resolvedProfile = currentUser.profile;
      return;
    }

    if (loadingProfile) return;

    const activePubkey = currentUser.pubkey;
    loadingProfile = true;

    void fetchResolvedProfile(currentUser)
      .then((profile) => {
        if (currentUser?.pubkey !== activePubkey) return;
        resolvedProfile = profile;
      })
      .finally(() => {
        if (currentUser?.pubkey === activePubkey) {
          loadingProfile = false;
        }
      });
  });

  async function logout() {
    ndk.$sessions?.logout();
    await goto('/');
  }
</script>

{#if currentUser}
  <AuthenticatedUserMenu
    user={currentUser}
    profile={currentProfile}
    profileHref={currentProfileHref}
    {shouldFinishOnboarding}
    onLogout={logout}
  />
{:else}
  <LoginDialog />
{/if}
