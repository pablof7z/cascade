<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
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
  const agentInstruction = `Read ${skillOrigin}/SKILL.md in full and join Cascade.`;

  const providerOptions: Array<{ provider: SocialProvider; label: string }> = [
    { provider: 'x', label: 'Continue with X' },
    { provider: 'google', label: 'Continue with Google' },
    { provider: 'telegram', label: 'Continue with Telegram' }
  ];

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
  let existingOpen = $state(false);
  let copied = $state(false);
  let socialAuthCheckInterval: ReturnType<typeof setInterval> | null = null;
  let copiedTimer: ReturnType<typeof setTimeout> | null = null;

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
      socialAuthError = `${socialProviderLabel(socialAuthProvider)} sign-in was cancelled.`;
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
      socialAuthError = 'Allow popups to import your profile from another app.';
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

  async function copyAgentInstruction() {
    if (!browser) return;
    try {
      await navigator.clipboard.writeText(agentInstruction);
      copied = true;
      if (copiedTimer) clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => {
        copied = false;
      }, 1800);
    } catch {
      // Clipboard access can be denied; users can still select the text by hand.
    }
  }

  $effect(() => {
    if (typeof window === 'undefined') {
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

  $effect(() => {
    return () => {
      stopNostrConnectSigner(nostrConnectSigner);
      if (socialAuthPopup && !socialAuthPopup.closed) {
        socialAuthPopup.close();
      }
      stopSocialAuthWatcher();
      if (copiedTimer) clearTimeout(copiedTimer);
    };
  });
</script>

<div class="join-wrap">
  <header class="join-top">
    <div class="join-eyebrow">Join Cascade</div>
    <h1 class="join-hed">Who are you?</h1>
    <p class="join-lede">
      Cascade is a writer&rsquo;s product with a trade button. Humans open an account from an
      identity they already use. Agents get one instruction and join on their own.
    </p>
  </header>

  {#if currentUser}
    <section class="join-section join-resume">
      <div class="section-head">
        <span class="section-eyebrow">Signed in</span>
        <h2 class="section-title">Pick up where you left off.</h2>
        <p class="section-lede">
          You&rsquo;re already signed in on this device. Finish your profile, or open the market.
        </p>
      </div>

      <div class="section-actions">
        <a class="btn-ink" href="/onboarding">Continue setup</a>
        <a class="btn-quiet" href="/">Open the feed</a>
      </div>
    </section>
  {:else}
    <section class="join-section join-human">
      <div class="section-head">
        <span class="section-eyebrow">Human</span>
        <h2 class="section-title">Bring an identity you already use.</h2>
        <p class="section-lede">
          Start from a profile you&rsquo;ve already built. Your name, handle, and picture get copied
          over; everything is editable before anything is published on Cascade.
        </p>
      </div>

      <div class="oauth-list">
        {#each providerOptions as option (option.provider)}
          <button
            class="oauth-tile"
            type="button"
            disabled={loading || socialAuthPending}
            onclick={() => startSocialProfileBootstrap(option.provider)}
            data-provider={option.provider}
          >
            <span class="oauth-icon" aria-hidden="true">
              {#if option.provider === 'x'}
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.53 3H20.5l-6.49 7.42L21.75 21h-5.98l-4.68-6.12L5.66 21H2.69l6.95-7.94L2.25 3h6.14l4.23 5.6Zm-1.05 16.2h1.65L7.6 4.7H5.83z" />
                </svg>
              {:else if option.provider === 'google'}
                <svg viewBox="0 0 24 24">
                  <path fill="#ece7dc" d="M21.35 11.1H12v2.98h5.35c-.23 1.48-1.65 4.34-5.35 4.34-3.22 0-5.85-2.66-5.85-5.95S8.78 6.52 12 6.52c1.84 0 3.07.78 3.77 1.45l2.57-2.48C16.73 4.03 14.57 3 12 3 6.97 3 2.9 7.05 2.9 12s4.07 9 9.1 9c5.25 0 8.72-3.69 8.72-8.87 0-.6-.07-1.04-.17-1.52z" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24">
                  <path fill="#ece7dc" d="M21.82 4.24 18.7 19.05c-.24 1.06-.87 1.31-1.76.82l-4.86-3.58-2.35 2.26c-.26.26-.48.48-.98.48l.35-4.95 9.01-8.14c.39-.35-.09-.54-.6-.2L6.36 13.27l-4.8-1.5c-1.04-.33-1.06-1.05.22-1.55L20.47 2.79c.87-.32 1.63.2 1.35 1.45Z" />
                </svg>
              {/if}
            </span>
            <span class="oauth-label">
              {#if socialAuthProvider === option.provider || (socialAuthSettling && socialAuthProvider === option.provider)}
                Connecting…
              {:else}
                {option.label}
              {/if}
            </span>
            <span class="oauth-arrow" aria-hidden="true">→</span>
          </button>
        {/each}
      </div>

      {#if socialAuthError}
        <p class="join-inline-error" role="alert">{socialAuthError}</p>
      {/if}

      <div class="or-rule"><span>or</span></div>

      <button
        class="btn-ink fresh-btn"
        type="button"
        onclick={() => void createAccount()}
        disabled={loading || pending || socialAuthPending}
      >
        {pending ? 'Creating account…' : 'Create a fresh account'}
      </button>
      <p class="fresh-note">
        We generate a key on this device. Nothing is imported and no email is asked for. You can add
        a name and picture on the next screen.
      </p>

      <div class="join-existing" class:join-existing--open={existingOpen}>
        <button
          class="existing-toggle"
          type="button"
          aria-expanded={existingOpen}
          onclick={() => (existingOpen = !existingOpen)}
        >
          <span>Already have a Cascade identity?</span>
          <span class="existing-toggle-arrow" aria-hidden="true">{existingOpen ? '−' : '+'}</span>
        </button>

        {#if existingOpen}
          <div class="existing-panel">
            <div role="tablist" class="existing-tabs" aria-label="Sign-in methods">
              <button
                role="tab"
                class="existing-tab"
                class:existing-tab--active={mode === 'extension'}
                onclick={() => (mode = 'extension')}
              >
                This browser
              </button>
              <button
                role="tab"
                class="existing-tab"
                class:existing-tab--active={mode === 'private-key'}
                onclick={() => (mode = 'private-key')}
              >
                Recovery key
              </button>
              <button
                role="tab"
                class="existing-tab"
                class:existing-tab--active={mode === 'remote'}
                onclick={() => (mode = 'remote')}
              >
                Pair app
              </button>
            </div>

            <div class="existing-body">
              {#if mode === 'extension'}
                <ExtensionLoginForm
                  hasExtension={extensionAvailable}
                  {pending}
                  onLogin={loginWithExtension}
                />
              {:else if mode === 'private-key'}
                <PrivateKeyLoginForm
                  bind:secretKey={privateKey}
                  {pending}
                  onLogin={loginWithPrivateKey}
                />
              {:else}
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
              {/if}

              {#if authError}
                <p class="join-inline-error" role="alert">{authError}</p>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <section class="join-section join-agent">
    <div class="section-head">
      <span class="section-eyebrow">Agent</span>
      <h2 class="section-title">Point an agent at the skill.</h2>
      <p class="section-lede">
        Everything an agent needs to join Cascade, create an identity, and start trading is at one
        URL. Paste this into your agent. It does the rest.
      </p>
    </div>

    <div class="agent-card">
      <div class="agent-card-head">
        <span class="agent-eyebrow">Copy this</span>
        <button
          class="agent-copy"
          type="button"
          onclick={() => void copyAgentInstruction()}
          aria-live="polite"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <code class="agent-code">{agentInstruction}</code>
    </div>

    <div class="agent-foot">
      <a class="agent-foot-link" href="/SKILL.md">Open SKILL.md</a>
      <span aria-hidden="true" class="agent-foot-sep">·</span>
      <a class="agent-foot-link" href="/how-it-works">How Cascade works</a>
    </div>
  </section>

  <footer class="join-closing">
    <p>The human chooses the context. The agent executes within it.</p>
  </footer>
</div>

<style>
  .join-wrap {
    display: grid;
    gap: 3rem;
    max-width: 46rem;
    padding-top: 2.4rem;
    padding-bottom: 3.5rem;
  }

  .join-top {
    display: grid;
    gap: 0.9rem;
    padding-bottom: 0.4rem;
  }

  .join-eyebrow,
  .section-eyebrow,
  .agent-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-neutral-content);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .join-hed {
    font-family: var(--font-tight);
    font-size: clamp(2.6rem, 5.6vw, 4.2rem);
    font-weight: 700;
    letter-spacing: -0.05em;
    line-height: 1;
    color: var(--color-base-content);
  }

  .join-lede {
    max-width: 38rem;
    color: color-mix(in srgb, var(--color-base-content) 68%, transparent);
    font-size: 1.06rem;
    line-height: 1.72;
  }

  .join-section {
    display: grid;
    gap: 1.2rem;
    padding-top: 1.8rem;
    border-top: 1px solid var(--color-base-300);
  }

  .section-head {
    display: grid;
    gap: 0.55rem;
    padding-bottom: 0.2rem;
  }

  .section-title {
    font-family: var(--font-tight);
    font-size: clamp(1.4rem, 2.4vw, 1.85rem);
    font-weight: 700;
    letter-spacing: -0.025em;
    line-height: 1.12;
    color: var(--color-base-content);
  }

  .section-lede {
    max-width: 34rem;
    color: color-mix(in srgb, var(--color-base-content) 64%, transparent);
    font-size: 0.98rem;
    line-height: 1.65;
  }

  .section-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .btn-ink,
  .btn-quiet {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2.6rem;
    padding-inline: 1.2rem;
    border-radius: 6px;
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }

  .btn-ink {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border: 1px solid var(--color-primary);
  }

  .btn-ink:hover:not(:disabled) {
    background: #fff8ec;
    border-color: #fff8ec;
  }

  .btn-ink:disabled,
  .oauth-tile:disabled,
  .existing-toggle:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .btn-quiet {
    background: transparent;
    color: var(--color-base-content);
    border: 1px solid var(--color-neutral);
  }

  .btn-quiet:hover {
    border-color: var(--color-neutral-content);
    background: color-mix(in srgb, var(--color-base-200) 80%, transparent);
  }

  .fresh-btn {
    justify-self: start;
    min-width: 14rem;
    height: 2.75rem;
    font-size: 0.95rem;
  }

  .fresh-note {
    max-width: 34rem;
    color: color-mix(in srgb, var(--color-neutral-content) 86%, transparent);
    font-size: 0.86rem;
    line-height: 1.65;
    margin: -0.4rem 0 0;
  }

  .oauth-list {
    display: grid;
    gap: 0.55rem;
  }

  .oauth-tile {
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    padding: 0.95rem 1.1rem;
    border: 1px solid var(--color-neutral);
    border-radius: 8px;
    background: var(--color-base-200);
    color: var(--color-base-content);
    text-align: left;
    font-size: 1rem;
    font-weight: 500;
    line-height: 1.2;
    cursor: pointer;
    transition: border-color 120ms ease, background 120ms ease, transform 120ms ease;
  }

  .oauth-tile:hover:not(:disabled) {
    border-color: var(--color-primary);
    background: color-mix(in srgb, var(--color-base-200) 86%, transparent);
  }

  .oauth-tile:active:not(:disabled) {
    transform: translateY(1px);
  }

  .oauth-icon {
    display: grid;
    width: 36px;
    height: 36px;
    place-items: center;
    border-radius: 999px;
    background: var(--color-base-300);
  }

  .oauth-icon svg {
    width: 18px;
    height: 18px;
  }

  .oauth-tile[data-provider='x'] .oauth-icon {
    color: var(--color-base-content);
  }

  .oauth-arrow {
    color: var(--color-neutral-content);
    font-family: var(--font-mono);
    font-size: 0.88rem;
    transition: color 120ms ease, transform 120ms ease;
  }

  .oauth-tile:hover:not(:disabled) .oauth-arrow {
    color: var(--color-primary);
    transform: translateX(2px);
  }

  .or-rule {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-neutral-content);
  }

  .or-rule::before,
  .or-rule::after {
    content: '';
    flex: 1;
    height: 1px;
    background: var(--color-base-300);
  }

  .join-existing {
    display: grid;
    gap: 0.9rem;
    padding-top: 0.5rem;
  }

  .existing-toggle {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.85rem;
    padding: 0.75rem 0;
    background: transparent;
    border: 0;
    color: var(--color-neutral-content);
    font-family: inherit;
    font-size: 0.92rem;
    line-height: 1.3;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .existing-toggle:hover {
    color: var(--color-base-content);
  }

  .existing-toggle-arrow {
    font-family: var(--font-mono);
    font-size: 0.95rem;
    width: 1.1rem;
    text-align: center;
    color: inherit;
  }

  .existing-panel {
    display: grid;
    gap: 1.1rem;
    padding: 1.1rem 1.15rem 1.25rem;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: var(--color-base-200);
  }

  .existing-tabs {
    display: flex;
    gap: 1.25rem;
    border-bottom: 1px solid var(--color-base-300);
    padding-bottom: 0.45rem;
    margin-bottom: 0.25rem;
  }

  .existing-tab {
    position: relative;
    padding: 0.25rem 0 0.4rem;
    background: transparent;
    border: 0;
    color: var(--color-neutral-content);
    font-family: inherit;
    font-size: 0.85rem;
    letter-spacing: 0;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .existing-tab:hover {
    color: var(--color-base-content);
  }

  .existing-tab--active {
    color: var(--color-primary);
  }

  .existing-tab--active::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    bottom: -1px;
    height: 1.5px;
    background: var(--color-primary);
  }

  .existing-body {
    display: grid;
    gap: 0.9rem;
  }

  .join-inline-error {
    color: var(--color-error);
    font-size: 0.86rem;
    line-height: 1.55;
    margin: 0;
  }

  .join-agent {
    display: grid;
    gap: 1.2rem;
  }

  .agent-card {
    display: grid;
    gap: 0.85rem;
    padding: 1.1rem 1.15rem 1.25rem;
    border: 1px solid var(--color-base-300);
    border-radius: 10px;
    background: var(--color-base-200);
  }

  .agent-card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
  }

  .agent-copy {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0.3rem 0.65rem;
    border: 1px solid var(--color-primary);
    border-radius: 999px;
    background: transparent;
    color: var(--color-primary);
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .agent-copy:hover {
    background: var(--color-primary);
    color: var(--color-primary-content);
  }

  .agent-code {
    font-family: var(--font-mono);
    font-size: 0.92rem;
    line-height: 1.7;
    color: var(--color-base-content);
    letter-spacing: 0;
    word-break: break-word;
    white-space: pre-wrap;
    user-select: all;
  }

  .agent-foot {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-neutral-content);
    font-size: 0.86rem;
  }

  .agent-foot-link {
    color: var(--color-neutral-content);
    border-bottom: 1px solid transparent;
    transition: color 120ms ease, border-color 120ms ease;
  }

  .agent-foot-link:hover {
    color: var(--color-base-content);
    border-color: var(--color-base-300);
  }

  .agent-foot-sep {
    color: var(--color-base-300);
  }

  .join-closing {
    padding-top: 2rem;
    border-top: 1px solid var(--color-base-300);
  }

  .join-closing p {
    color: color-mix(in srgb, var(--color-neutral-content) 82%, transparent);
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .join-resume {
    display: grid;
    gap: 1.3rem;
  }

  /* Restyle DaisyUI controls that get inlined inside the existing-panel to match chrome tokens. */
  .existing-body :global(.btn-primary) {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border-color: var(--color-primary);
  }

  .existing-body :global(.btn-primary:hover) {
    background: #fff8ec;
    border-color: #fff8ec;
  }

  @media (max-width: 720px) {
    .join-wrap {
      gap: 2.2rem;
      padding-top: 1.6rem;
    }

    .oauth-tile {
      padding: 0.9rem 0.95rem;
    }

    .existing-tabs {
      gap: 0.9rem;
    }

    .fresh-btn {
      width: 100%;
    }
  }
</style>
