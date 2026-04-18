<script lang="ts">
  import { goto } from '$app/navigation';
  import { NDKNip07Signer, NDKNip46Signer, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';
  import ExtensionLoginForm from './ExtensionLoginForm.svelte';
  import PrivateKeyLoginForm from './PrivateKeyLoginForm.svelte';
  import RemoteLoginForm from './RemoteLoginForm.svelte';
  import { requireAuthSessions } from './sessionBootstrap';
  import {
    hasNostrExtension,
    prepareRemoteSignerPairing,
    stopNostrConnectSigner,
    type LoginMode
  } from './auth';

  let open = $state(false);
  let mode = $state<LoginMode>('extension');
  let pending = $state(false);
  let preparingRemoteSigner = $state(false);
  let connectingBunker = $state(false);
  let privateKey = $state('');
  let bunkerUri = $state('');
  let qrCodeDataUrl = $state('');
  let nostrConnectUri = $state('');
  let nostrConnectSigner: NDKNip46Signer | null = $state(null);
  let error = $state('');

  const extensionAvailable = $derived(hasNostrExtension());
  const remoteSignerReady = $derived(Boolean(qrCodeDataUrl && nostrConnectUri));

  function clearRemoteSigner() {
    bunkerUri = '';
    qrCodeDataUrl = '';
    nostrConnectUri = '';
    connectingBunker = false;
    stopNostrConnectSigner(nostrConnectSigner);
    nostrConnectSigner = null;
  }

  function resetDialogState() {
    error = '';
    pending = false;
    privateKey = '';
    mode = 'extension';
    preparingRemoteSigner = false;
    clearRemoteSigner();
  }

  $effect(() => {
    if (!open) {
      resetDialogState();
    }
  });

  $effect(() => {
    if (mode !== 'remote') {
      preparingRemoteSigner = false;
      clearRemoteSigner();
    }
  });

  function finishLogin() {
    open = false;
  }

  function startJoin() {
    void goto('/join');
  }

  async function loginWithExtension() {
    if (pending || !extensionAvailable) return;

    try {
      pending = true;
      error = '';
      const sessions = await requireAuthSessions();
      await sessions.login(new NDKNip07Signer());
      finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't sign in in this browser.";
    } finally {
      pending = false;
    }
  }

  async function loginWithPrivateKey() {
    if (pending || !privateKey.trim()) return;

    try {
      pending = true;
      error = '';
      const sessions = await requireAuthSessions();
      await sessions.login(new NDKPrivateKeySigner(privateKey.trim()));
      finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't sign in with that recovery key.";
    } finally {
      pending = false;
    }
  }

  async function startRemoteSigner() {
    if (preparingRemoteSigner || connectingBunker) return;

    try {
      error = '';
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
        .then(async () => {
          if (nostrConnectSigner !== activeSigner) return;
          finishLogin();
        })
        .catch((caught) => {
          if (nostrConnectSigner !== activeSigner) return;
          error = caught instanceof Error ? caught.message : "Couldn't finish connecting to that app.";
        });
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't start pairing with another app.";
      clearRemoteSigner();
    } finally {
      preparingRemoteSigner = false;
    }
  }

  async function loginWithBunker() {
    if (connectingBunker || !bunkerUri.trim().startsWith('bunker://')) return;

    try {
      error = '';
      connectingBunker = true;
      stopNostrConnectSigner(nostrConnectSigner);
      nostrConnectSigner = null;
      const sessions = await requireAuthSessions();
      await sessions.login(new NDKNip46Signer(ndk, bunkerUri.trim()));
      finishLogin();
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "Couldn't use that pairing link.";
    } finally {
      connectingBunker = false;
    }
  }

  $effect(() => {
    return () => stopNostrConnectSigner(nostrConnectSigner);
  });
</script>

<div class="auth-panel">
  <div class="auth-guest-actions">
    <button class="btn btn-primary auth-join" type="button" onclick={startJoin}>Join</button>
    <button class="btn btn-outline auth-trigger" type="button" onclick={() => (open = true)}>Log in</button>
  </div>

  <dialog class="modal" class:modal-open={open}>
    <div class="modal-box bg-base-200 auth-dialog">
      <div class="auth-dialog-chrome">
        <div class="auth-dialog-handle" aria-hidden="true"></div>

        <div class="auth-dialog-header pt-1">
          <h3 class="text-lg font-semibold">Log in</h3>
          <p class="text-sm text-base-content/60">
            Choose how you want to log in. Your session stays on this device.
          </p>
        </div>

        <button
          class="btn btn-ghost btn-sm rounded-md px-0 text-base-content/50 hover:bg-base-300 hover:text-white"
          aria-label="Close login"
          onclick={() => (open = false)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      <div class="auth-dialog-body">
        <div role="tablist" class="tabs tabs-bordered auth-switcher" aria-label="Login methods">
          <button role="tab" class="tab auth-switcher-button" class:tab-active={mode === 'extension'} onclick={() => (mode = 'extension')}>This browser</button>
          <button role="tab" class="tab auth-switcher-button" class:tab-active={mode === 'private-key'} onclick={() => (mode = 'private-key')}>Recovery key</button>
          <button role="tab" class="tab auth-switcher-button" class:tab-active={mode === 'remote'} onclick={() => (mode = 'remote')}>Pair app</button>
        </div>

        {#if mode === 'extension'}
          <div class="auth-mode-panel">
            <ExtensionLoginForm
              hasExtension={extensionAvailable}
              {pending}
              onLogin={loginWithExtension}
            />
          </div>
        {/if}

        {#if mode === 'private-key'}
          <div class="auth-mode-panel">
            <PrivateKeyLoginForm
              bind:secretKey={privateKey}
              {pending}
              onLogin={loginWithPrivateKey}
            />
          </div>
        {/if}

        {#if mode === 'remote'}
          <div class="auth-mode-panel">
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
          </div>
        {/if}

        {#if error}
          <p class="error" style="margin: 0;">{error}</p>
        {/if}
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button onclick={() => (open = false)} aria-label="Close dialog">close</button>
    </form>
  </dialog>
</div>
