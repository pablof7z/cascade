<script lang="ts">
  import type { NDKUser, NDKUserProfile } from '@nostr-dev-kit/ndk';
  import { goto } from '$app/navigation';
  import {
    authUserAvatar,
    authUserInitials,
    authUserLabel,
    authUserMeta
  } from './auth';

  interface Props {
    user: NDKUser;
    profile: NDKUserProfile | undefined;
    profileHref: string;
    shouldFinishOnboarding: boolean;
    onLogout: () => Promise<void>;
  }

  let { user, profile, profileHref, shouldFinishOnboarding, onLogout }: Props = $props();

  const userLabel = $derived(authUserLabel(profile));
  const userMeta = $derived(authUserMeta(profile, user.npub || user.pubkey || ''));
  const userAvatar = $derived(authUserAvatar(profile));
  const userInitials = $derived(authUserInitials(profile));

  function navigateToProfile() {
    void goto(profileHref);
  }

  function navigateToEditProfile() {
    void goto('/profile/edit');
  }

  function navigateToBuilder() {
    void goto('/builder');
  }

  function navigateToOnboarding() {
    void goto('/onboarding');
  }

  function handleLogout() {
    void onLogout();
  }
</script>

<div class="auth-panel auth-panel-user">
  <div class="dropdown dropdown-end">
    <button tabindex="0" class="auth-user-trigger" aria-label="Open account menu">
      <div class="avatar auth-user-avatar" class:avatar-placeholder={!userAvatar}>
        <div class="h-10 w-10 rounded-full bg-base-300 auth-user-avatar-inner">
          {#if userAvatar}
            <img src={userAvatar} alt={userLabel} width="40" height="40" />
          {:else}
            <span class="auth-user-avatar-fallback">{userInitials}</span>
          {/if}
        </div>
      </div>

      <span class="auth-user-copy">
        <span class="auth-user-name">{userLabel}</span>
        <span class="auth-user-meta">{userMeta}</span>
      </span>

      <svg class="auth-user-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.75 9.75 12 15l5.25-5.25" />
      </svg>
    </button>

    <ul tabindex="0" class="menu dropdown-content auth-user-menu-content z-10 mt-2 p-1 shadow">
      <li class="auth-user-menu-header">
        <div class="avatar auth-menu-avatar" class:avatar-placeholder={!userAvatar}>
          <div class="h-12 w-12 rounded-full bg-base-300">
            {#if userAvatar}
              <img src={userAvatar} alt={userLabel} width="48" height="48" />
            {:else}
              <span class="auth-user-avatar-fallback">{userInitials}</span>
            {/if}
          </div>
        </div>

        <div class="auth-menu-copy">
          <span class="auth-menu-name">{userLabel}</span>
          <span class="auth-menu-meta">{userMeta}</span>
        </div>
      </li>

      <div class="divider my-1"></div>

      <li>
        <button onclick={navigateToProfile}>
          <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
          <span>Profile</span>
        </button>
      </li>

      <li>
        <button onclick={navigateToEditProfile}>
          <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
          <span>Edit profile</span>
        </button>
      </li>

      <li>
        <button onclick={navigateToBuilder}>
          <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span>Create market</span>
        </button>
      </li>

      {#if shouldFinishOnboarding}
        <li>
          <button onclick={navigateToOnboarding}>
            <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            <span>Finish setup</span>
          </button>
        </li>
      {/if}

      <li>
        <button class="auth-menu-item-danger" onclick={handleLogout}>
          <svg class="auth-menu-item-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15" />
          </svg>
          <span>Log out</span>
        </button>
      </li>
    </ul>
  </div>
</div>
