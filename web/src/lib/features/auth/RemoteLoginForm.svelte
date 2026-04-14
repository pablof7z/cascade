<script lang="ts">
  interface Props {
    connectingBunker: boolean;
    bunkerUri?: string;
    nostrConnectUri: string;
    preparingRemoteSigner: boolean;
    qrCodeDataUrl: string;
    remoteSignerReady: boolean;
    onLoginWithBunker?: () => void | Promise<void>;
    onStartRemoteSigner?: () => void | Promise<void>;
  }

  let {
    connectingBunker,
    bunkerUri = $bindable(''),
    nostrConnectUri,
    preparingRemoteSigner,
    qrCodeDataUrl,
    remoteSignerReady,
    onLoginWithBunker,
    onStartRemoteSigner
  }: Props = $props();
</script>

<div class="grid gap-4">
  <p class="text-sm leading-6 text-neutral-400">
    Pair with another app. Show a QR code to approve this session, or paste a connection link.
  </p>

  {#if remoteSignerReady}
    <div class="grid justify-items-center gap-3 rounded-md border border-neutral-800 bg-base-100 p-4">
      <a
        class="inline-flex rounded-md border border-neutral-800 bg-white p-4 transition hover:border-neutral-700"
        href={nostrConnectUri}
        title="Open in app"
      >
        <img class="block h-auto w-full max-w-60 rounded-md" src={qrCodeDataUrl} alt="Connection QR code" />
      </a>
      <div class="badge badge-outline border-primary/40 px-3 py-3 text-xs font-medium text-primary">
        Waiting for approval
      </div>
      <p class="m-0 text-center text-xs leading-5 text-neutral-400">
        Open the QR in another app on this device, or scan it from another one.
      </p>
    </div>
  {:else}
    <div class="grid gap-2">
      <button
        class="btn btn-primary w-full justify-center"
        type="button"
        onclick={() => void onStartRemoteSigner?.()}
        disabled={preparingRemoteSigner || connectingBunker}
      >
        {preparingRemoteSigner ? 'Preparing QR...' : 'Show QR code'}
      </button>
      <p class="m-0 text-center text-xs leading-5 text-neutral-400">
        This starts a one-time pairing request and waits for approval.
      </p>
    </div>
  {/if}

  <div class="flex items-center gap-3 text-xs font-medium tracking-[0.08em] text-neutral-500 uppercase before:h-px before:flex-1 before:bg-neutral-800 after:h-px after:flex-1 after:bg-neutral-800">
    <span>Or paste a link</span>
  </div>

  <label class="grid gap-2">
    <span class="text-xs font-medium tracking-[0.08em] text-neutral-500 uppercase">Connection link</span>
    <input
      class="input input-bordered"
      bind:value={bunkerUri}
      placeholder="Paste a connection link"
    />
  </label>
  <button
    class="btn btn-primary w-full justify-center"
    type="button"
    onclick={() => void onLoginWithBunker?.()}
    disabled={connectingBunker || !bunkerUri.trim().startsWith('bunker://')}
  >
    {connectingBunker ? 'Connecting...' : 'Continue with link'}
  </button>
</div>
