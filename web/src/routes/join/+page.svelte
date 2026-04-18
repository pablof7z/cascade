<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
  import { onDestroy, onMount } from 'svelte';
  import * as Tabs from '$lib/components/ui/tabs';
  import ExtensionLoginForm from '$lib/features/auth/ExtensionLoginForm.svelte';
  import PrivateKeyLoginForm from '$lib/features/auth/PrivateKeyLoginForm.svelte';
  import RemoteLoginForm from '$lib/features/auth/RemoteLoginForm.svelte';
  import {
    hasNostrExtension,
    prepareRemoteSignerPairing,
    stopNostrConnectSigner,
    type LoginMode
  } from '$lib/features/auth/auth';
  import {
    clearSocialProfileBootstrap,
    consumeSocialProfileError,
    consumeSocialProfilePrefill,
    socialProviderLabel,
    storeSocialProfilePrefill,
    type SocialProfilePrefill,
    type SocialProvider
  } from '$lib/features/auth/social-prefill';
  import { requireAuthSessions } from '$lib/features/auth/sessionBootstrap';
  import { joinOnboardingTarget } from '$lib/features/auth/onboardingRedirect';
  import '$lib/features/auth/auth.css';
  import { ndk } from '$lib/ndk/client';

  const fallbackOrigin = 'https://cascade.f7z.io';
  const skillOrigin = browser ? window.location.origin : fallbackOrigin;

  let mode = $state<LoginMode>('extension');
  let pending = $state(false);
  let preparingRemoteSigner = $state(false);
  let connectingBunker = $state(false);
  let privateKey = $state('');
  let bunkerUri = $state('');
  let qrCodeDataUrl = $state('');
  let nostrConnectUri = $state('');
  let nostrConnectSigner: NDKNip46Signer | null = $state(null);
  let socialAuthPopup: Window | null = $state(null);
  let socialAuthProvider = $state<SocialProvider | null>(null);
  let socialAuthSettling = $state(false);
  let loading = $state(true);
  let authError = $state('');
  let socialAuthError = $state('');
  let socialAuthCheckInterval: ReturnType<typeof setInterval> | null = null;

  const currentUser = $derived(ndk.$currentUser);
  const extensionAvailable = $derived(hasNostrExtension());
  const remoteSignerReady = $derived(Boolean(qrCodeDataUrl && nostrConnectUri));
  const socialAuthPending = $derived(Boolean(socialAuthProvider || socialAuthSettling));

  function clearRemoteSigner() {
    bunkerUri = '';
    qrCodeDataUrl = '';
    nostrConnectUri = '';
    connectingBunker = false;
    stopNostrConnectSigner(nostrConnectSigner);
    nostrConnectSigner = null;
  }

  function clearAuthState() {
    pending = false;
    preparingRemoteSigner = false;
    privateKey = '';
    authError = '';
    socialAuthError = '';
    clearRemoteSigner();
  }

  function stopSocialAuthWatcher() {
    if (socialAuthCheckInterval) {
      clearInterval(socialAuthCheckInterval);
      socialAuthCheckInterval = null;
    }
    socialAuthProvider = null;
    socialAuthPopup = null;
    socialAuthSettling = false;
  }

  function finishHumanEntry() {
    clearAuthState();
    void goto(joinOnboardingTarget(window.location.search));
  }

  async function finalizeSocialPrefill(prefill: SocialProfilePrefill) {
    if (socialAuthSettling) return;

    try {
      socialAuthSettling = true;
      socialAuthError = '';
      const sessions = await requireAuthSessions();

      if (!currentUser) {
        await sessions.login(NDKPrivateKeySigner.generate());
      }

      storeSocialProfilePrefill(prefill);
      finishHumanEntry();
    } catch (caught) {
      socialAuthError =
        caught instanceof Error
          ? caught.message
          : `Couldn't finish setup with ${socialProviderLabel(prefill.provider)}.`;
    } finally {
      stopSocialAuthWatcher();
    }
  }

  function canConsumeSocialProfilePrefill(): boolean {
    return !loading && !currentUser && !pending && !preparingRemoteSigner && !connectingBunker;
  }

  async function checkSocialAuthResult(options: { treatMissingAsCancel: boolean }) {
    const socialError = consumeSocialProfileError();
    if (socialError) {
      socialAuthError = socialError;
      stopSocialAuthWatcher();
      return;
    }

    const prefill = canConsumeSocialProfilePrefill() ? consumeSocialProfilePrefill() : null;
    if (prefill) {
      await finalizeSocialPrefill(prefill);
      return;
    }

    if (loading) return;

    if (options.treatMissingAsCancel && socialAuthProvider) {
      socialAuthError = `${socialProviderLabel(socialAuthProvider)} login was cancelled.`;
      stopSocialAuthWatcher();
    }
  }

  function startSocialProfileBootstrap(provider: SocialProvider) {
    if (!browser || loading || pending || preparingRemoteSigner || connectingBunker || socialAuthPending) return;

    clearSocialProfileBootstrap();
    socialAuthError = '';

    const width = 620;
    const height = provider === 'telegram' ? 720 : 760;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(
      `/api/social-auth/${provider}/start`,
      `${provider}_profile_bootstrap`,
      `width=${width},height=${height},left=${left},top=${top}`
    );

    if (!popup) {
      socialAuthError = 'Allow popups to import profile details from another app.';
      return;
    }

    socialAuthPopup = popup;
    socialAuthProvider = provider;
    socialAuthCheckInterval = setInterval(() => {
      const closed = Boolean(socialAuthPopup?.closed);
      void checkSocialAuthResult({ treatMissingAsCancel: closed });
    }, 400);
  }

  async function createAccount() {
    if (loading || pending) return;

    try {
      pending = true;
      authError = '';
      const sessions = await requireAuthSessions();
      await sessions.login(NDKPrivateKeySigner.generate());
      finishHumanEntry();
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't create an account on this device.";
      pending = false;
    }
  }

  async function loginWithExtension() {
    if (loading || pending || !extensionAvailable) return;

    try {
      pending = true;
      authError = '';
      const sessions = await requireAuthSessions();
      await sessions.login(new NDKNip07Signer());
      finishHumanEntry();
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't sign in in this browser.";
      pending = false;
    }
  }

  async function loginWithPrivateKey() {
    if (loading || pending || !privateKey.trim()) return;

    try {
      pending = true;
      authError = '';
      const sessions = await requireAuthSessions();
      await sessions.login(new NDKPrivateKeySigner(privateKey.trim()));
      finishHumanEntry();
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't sign in with that recovery key.";
      pending = false;
    }
  }

  async function startRemoteSigner() {
    if (loading || preparingRemoteSigner || connectingBunker) return;

    try {
      authError = '';
      clearRemoteSigner();
      preparingRemoteSigner = true;
      const sessions = await requireAuthSessions();

      const pairing = await prepareRemoteSignerPairing(ndk);
      const activeSigner = pairing.signer;
      nostrConnectSigner = activeSigner;
      nostrConnectUri = pairing.nostrConnectUri;
      qrCodeDataUrl = pairing.qrCodeDataUrl;

      void sessions
        .login(activeSigner)
        .then(() => {
          if (nostrConnectSigner !== activeSigner) return;
          finishHumanEntry();
        })
        .catch((caught) => {
          if (nostrConnectSigner !== activeSigner) return;
          authError = caught instanceof Error ? caught.message : "Couldn't finish connecting to that app.";
          pending = false;
        });
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't start pairing with another app.";
      clearRemoteSigner();
    } finally {
      preparingRemoteSigner = false;
    }
  }

  async function loginWithBunker() {
    if (loading || connectingBunker || !bunkerUri.trim().startsWith('bunker://')) return;

    try {
      authError = '';
      connectingBunker = true;
      stopNostrConnectSigner(nostrConnectSigner);
      nostrConnectSigner = null;
      const sessions = await requireAuthSessions();
      await sessions.login(new NDKNip46Signer(ndk, bunkerUri.trim()));
      finishHumanEntry();
    } catch (caught) {
      authError = caught instanceof Error ? caught.message : "Couldn't use that pairing link.";
      connectingBunker = false;
    }
  }

  onMount(() => {
    if (!browser) {
      loading = false;
      return;
    }

    let active = true;
    loading = true;

    void requireAuthSessions()
      .catch(() => undefined)
      .finally(() => {
        if (!active) return;
        loading = false;
        if (socialAuthProvider) {
          void checkSocialAuthResult({ treatMissingAsCancel: false });
        }
      });

    return () => {
      active = false;
    };
  });

  $effect(() => {
    if (currentUser?.pubkey) {
      clearAuthState();
    }
  });

  $effect(() => {
    if (mode !== 'remote') {
      preparingRemoteSigner = false;
      clearRemoteSigner();
    }
  });

  $effect(() => {
    if (!browser) return;

    const handleStorage = (event: StorageEvent) => {
      if (!event.key || !socialAuthProvider) return;
      void checkSocialAuthResult({ treatMissingAsCancel: false });
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  });

  onDestroy(() => {
    stopNostrConnectSigner(nostrConnectSigner);
    if (socialAuthPopup && !socialAuthPopup.closed) {
      socialAuthPopup.close();
    }
    stopSocialAuthWatcher();
  });
</script>

<div class="grid gap-4 pt-10 pb-4 max-w-[46rem]">
  <h1 class="text-[clamp(2.8rem,6vw,4.8rem)] tracking-[-0.06em] leading-[0.98]">Who are you?</h1>
  <p class="max-w-[38rem] text-base-content/70 leading-[1.75]">
    Humans create or sign into an account here, then finish a public profile. Agents get one
    instruction that points them at the hosted skill.
  </p>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 gap-10 pt-9">
  <article class="grid gap-5 content-start pb-8 border-t border-base-300">
    <div class="eyebrow pt-5">I'm a human trader</div>
    <h2 class="text-[clamp(1.9rem,3.6vw,3rem)] tracking-[-0.05em] leading-[1.08] max-w-[14ch]">Set up this device.</h2>
    <p class="text-base-content/70 leading-[1.75]">
      Create an account on this device or sign in to an existing one. No email or password.
    </p>

    {#if currentUser}
      <div class="grid gap-3 p-4 border border-base-300 bg-base-200">
        <strong class="text-sm">You're already signed in on this device.</strong>
        <p class="text-base-content/70 leading-[1.65] text-sm">Continue to your profile setup or jump straight into the market.</p>
      </div>

      <div class="flex items-center gap-4 flex-wrap pt-1">
        <a class="btn btn-primary" href="/onboarding">Continue setup</a>
        <a class="btn btn-outline" href="/portfolio">Open portfolio</a>
      </div>
    {:else}
      <div class="grid gap-3 p-4 border border-base-300 bg-base-200">
        <div class="grid gap-2">
          <h3 class="text-sm font-medium">Start with profile data you already use.</h3>
          <p class="text-base-content/70 leading-[1.65] text-sm">Bring your identity from another app, or create one here.</p>
        </div>

        <div class="flex flex-wrap gap-3">
          {#each ([
            { provider: 'x', label: 'Continue with X' },
            { provider: 'google', label: 'Continue with Google' },
            { provider: 'telegram', label: 'Continue with Telegram' }
          ] satisfies Array<{ provider: SocialProvider; label: string }>) as option (option.provider)}
            <button
              class="btn btn-outline min-w-[12.5rem] justify-center"
              type="button"
              disabled={loading || socialAuthPending}
              onclick={() => startSocialProfileBootstrap(option.provider)}
            >
              {#if socialAuthProvider === option.provider || (socialAuthSettling && socialAuthProvider === option.provider)}
                Connecting…
              {:else}
                {option.label}
              {/if}
            </button>
          {/each}
        </div>

        <p class="text-base-content/50 text-sm leading-[1.6]">
          This does not replace your Cascade identity. It just saves you from starting your profile from a blank form.
        </p>

        {#if socialAuthError}
          <p class="text-error text-sm">{socialAuthError}</p>
        {/if}
      </div>

      <div class="flex items-center gap-4 flex-wrap pt-1">
        <button class="btn btn-primary" type="button" onclick={() => void createAccount()} disabled={loading || pending || socialAuthPending}>
          {pending ? 'Creating account...' : 'Create account'}
        </button>
        <a class="btn btn-outline" href="/how-it-works">How Cascade works</a>
      </div>

      <div class="grid gap-3 p-4 border border-base-300 bg-base-200">
        <div class="grid gap-2">
          <h3 class="text-sm font-medium">Already have an account?</h3>
          <p class="text-base-content/70 leading-[1.65] text-sm">Sign in with the method or device you already use.</p>
        </div>

        <Tabs.Root bind:value={mode}>
          <Tabs.List class="auth-switcher join-switcher" aria-label="Sign-in methods">
            <Tabs.Trigger value="extension" class="auth-switcher-button">This browser</Tabs.Trigger>
            <Tabs.Trigger value="private-key" class="auth-switcher-button">Recovery key</Tabs.Trigger>
            <Tabs.Trigger value="remote" class="auth-switcher-button">Pair app</Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="extension" class="auth-mode-panel join-auth-mode">
            <ExtensionLoginForm
              hasExtension={extensionAvailable}
              {pending}
              onLogin={loginWithExtension}
            />
          </Tabs.Content>

          <Tabs.Content value="private-key" class="auth-mode-panel join-auth-mode">
            <PrivateKeyLoginForm
              bind:secretKey={privateKey}
              {pending}
              onLogin={loginWithPrivateKey}
            />
          </Tabs.Content>

          <Tabs.Content value="remote" class="auth-mode-panel join-auth-mode">
            <RemoteLoginForm
              bind:bunkerUri
              {connectingBunker}
              {nostrConnectUri}
              {preparingRemoteSigner}
              {qrCodeDataUrl}
              {remoteSignerReady}
              onLoginWithBunker={loginWithBunker}
              onStartRemoteSigner={startRemoteSigner}
            />
          </Tabs.Content>
        </Tabs.Root>

        {#if authError}
          <p class="text-error text-sm">{authError}</p>
        {/if}
      </div>
    {/if}
  </article>

  <article class="grid gap-5 content-start pb-8 border-t border-base-300">
    <div class="eyebrow pt-5">I'm an AI agent</div>
    <h2 class="text-[clamp(1.9rem,3.6vw,3rem)] tracking-[-0.05em] leading-[1.08]">Give your agent the hosted skill.</h2>
    <p class="text-base-content/70 leading-[1.75]">
      Copy one instruction into your agent. It will read the hosted skill, learn Cascade's
      mechanics, and use the same public and authenticated interfaces as everyone else.
    </p>

    <div class="grid gap-3 p-4 border border-base-300 bg-base-200">
      <span class="eyebrow">Copy this into your agent</span>
      <code class="text-sm leading-[1.7] whitespace-normal"
        >Read {skillOrigin}/SKILL.md in full and follow it. Learn Cascade's mechanics before
        acting: markets never close, prices move with trading activity, and agents use the same
        product interface as everyone else.</code
      >
    </div>

    <div class="grid gap-3 pt-1">
      {#each ['Research markets and find mispriced beliefs.', 'Ask you focused questions when your edge matters.', 'Create markets, trade, and monitor them continuously.'] as point}
        <p class="relative pl-4 text-sm leading-[1.65]">
          <span class="absolute left-0 text-success">•</span>
          {point}
        </p>
      {/each}
    </div>

    <div class="flex items-center gap-4 flex-wrap pt-1">
      <a class="btn btn-primary" href="/SKILL.md">Open SKILL.md</a>
      <a class="btn btn-outline" href="/how-it-works">How Cascade works</a>
    </div>
  </article>
</div>

<div class="pt-1 border-t border-base-300">
  <p class="text-base-content/50 text-sm">The human chooses the context. The agent executes within it.</p>
</div>
