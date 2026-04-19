<script lang="ts">
  import type { PageProps } from './$types';
  import { goto } from '$app/navigation';
  import {
    NDKBlossomList,
    NDKEvent,
    NDKKind,
    NDKPrivateKeySigner,
    type NDKUser,
    type NDKUserProfile,
    type NostrEvent
  } from '@nostr-dev-kit/ndk';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import { cleanText, displayName } from '$lib/ndk/format';
  import {
    NIP05_REGISTRATION_AUTH_KIND,
    formatManagedNip05Identifier,
    isValidManagedNip05Name,
    managedNip05NameFromIdentifier,
    normalizeManagedNip05Name
  } from '$lib/ndk/nip05';
  import {
    DEFAULT_BLOSSOM_SERVER,
    blossomServerFromEvent,
    mergeBlossomServers,
    parseBlossomServer
  } from '$lib/onboarding';
  import {
    consumeSocialProfileError,
    consumeSocialProfilePrefill,
    socialProviderLabel,
    type SocialProfilePrefill
  } from '$lib/features/auth/social-prefill';
  import { onboardingCompletionTarget } from '$lib/features/auth/onboardingRedirect';

  type Nip05Status = 'idle' | 'checking' | 'available' | 'owned' | 'taken' | 'error';

  let { data }: PageProps = $props();

  let step = $state<1 | 2>(1);

  const FAKE_NAMES = [
    'Milo Vance', 'Sable Quinn', 'Cleo Hartwell', 'Ren Ashford',
    'Piper Strand', 'Callum Wray', 'Indigo Marsh', 'Nox Ellery',
    'Wren Coulter', 'Soren Dahl', 'Lyra Finch', 'Caius Webb',
    'Blythe Rowe', 'Emery Holt', 'Zara Flint', 'Thane Osler'
  ];
  const namePlaceholder = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];

  const DICEBEAR_AVATARS = [
    { style: 'adventurer', seed: 'Felix' },
    { style: 'adventurer', seed: 'Mia' },
    { style: 'adventurer', seed: 'Zara' },
    { style: 'adventurer', seed: 'Cleo' },
    { style: 'lorelei', seed: 'Sable' },
    { style: 'lorelei', seed: 'Ren' },
    { style: 'lorelei', seed: 'Nox' },
    { style: 'lorelei', seed: 'Lyra' },
    { style: 'micah', seed: 'Wren' },
    { style: 'micah', seed: 'Thane' },
    { style: 'micah', seed: 'Emery' },
    { style: 'micah', seed: 'Caius' }
  ].map(({ style, seed }) => ({
    url: `https://api.dicebear.com/9.x/${style}/svg?seed=${seed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`,
    seed,
    style
  }));

  let selectedDicebear = $state<string | null>(null);

  let activePubkey = $state<string | null>(null);
  let resolvedProfile: NDKUserProfile | undefined = $state();
  let name = $state('');
  let display = $state('');
  let about = $state('');
  let website = $state('');
  let managedNip05Name = $state('');
  let blossomServer = $state(DEFAULT_BLOSSOM_SERVER);
  let avatarUrl = $state('');
  let avatarFile: File | null = $state(null);
  let avatarPreviewUrl = $state('');
  let profileTouched = $state(false);
  let managedNip05Touched = $state(false);
  let blossomTouched = $state(false);
  let profileLoading = $state(false);
  let uploadingAvatar = $state(false);
  let saving = $state(false);
  let uploadProgress = $state<number | null>(null);
  let saveError = $state('');
  let uploadError = $state('');
  let managedNip05Status = $state<Nip05Status>('idle');
  let managedNip05StatusPubkey = $state<string | null>(null);
  let fileInput: HTMLInputElement | null = $state(null);
  let importedSocialPrefill: SocialProfilePrefill | null = $state(null);

  const currentUser = $derived(ndk.$currentUser);
  const blossomEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.BlossomList));
  const isReadOnly = $derived(Boolean(ndk.$sessions?.isReadOnly()));
  const avatarDisplayUrl = $derived(avatarPreviewUrl || avatarUrl || selectedDicebear || '');
  const managedNip05Domain = $derived(data.nip05Domain ?? null);
  const managedNip05Enabled = $derived(Boolean(managedNip05Domain));
  const normalizedManagedNip05Name = $derived(normalizeManagedNip05Name(managedNip05Name));
  const managedNip05Valid = $derived(
    !normalizedManagedNip05Name || isValidManagedNip05Name(normalizedManagedNip05Name)
  );
  const currentManagedNip05Name = $derived(
    managedNip05NameFromIdentifier(
      cleanText(currentUser?.profile?.nip05) || cleanText(resolvedProfile?.nip05),
      managedNip05Domain
    )
  );
  const existingExternalNip05 = $derived.by(() => {
    const rawNip05 = cleanText(currentUser?.profile?.nip05) || cleanText(resolvedProfile?.nip05);
    if (!rawNip05 || currentManagedNip05Name) return '';
    return rawNip05;
  });
  const managedNip05Identifier = $derived.by(() => {
    if (!managedNip05Domain || !normalizedManagedNip05Name) return '';
    return formatManagedNip05Identifier(normalizedManagedNip05Name, managedNip05Domain);
  });
  const managedNip05Ready = $derived.by(() => {
    if (!managedNip05Enabled || !normalizedManagedNip05Name) return true;
    if (!managedNip05Valid) return false;
    return managedNip05Status === 'available' || managedNip05Status === 'owned';
  });
  const identityLabel = $derived(
    displayName(
      {
        ...(resolvedProfile ?? {}),
        name: cleanText(name) || resolvedProfile?.name,
        displayName: cleanText(display) || resolvedProfile?.displayName
      },
      'You'
    )
  );
  const identityInitial = $derived(
    (cleanText(display) || cleanText(name) || identityLabel || 'C').trim().slice(0, 1).toUpperCase() || 'C'
  );
  const step1Valid = $derived(Boolean(cleanText(name) || cleanText(display)));
  const canPublish = $derived(!isReadOnly && !saving && !uploadingAvatar && managedNip05Ready);

  function clearMessages() {
    saveError = '';
    uploadError = '';
  }

  function clearAvatarPreview() {
    if (avatarPreviewUrl) {
      URL.revokeObjectURL(avatarPreviewUrl);
      avatarPreviewUrl = '';
    }
  }

  function resetDraft() {
    resolvedProfile = undefined;
    name = '';
    display = '';
    about = '';
    website = '';
    managedNip05Name = '';
    managedNip05Touched = false;
    managedNip05Status = 'idle';
    managedNip05StatusPubkey = null;
    blossomServer = DEFAULT_BLOSSOM_SERVER;
    avatarUrl = '';
    avatarFile = null;
    selectedDicebear = null;
    clearAvatarPreview();
    if (fileInput) fileInput.value = '';
  }

  function seedProfile(profile: NDKUserProfile | undefined) {
    resolvedProfile = profile ? { ...profile } : undefined;
    if (!profileTouched) {
      name = cleanText(profile?.name);
      display = cleanText(profile?.displayName);
      about = cleanText(profile?.about || profile?.bio);
      website = cleanText(profile?.website);
      avatarUrl = cleanText(profile?.picture || profile?.image);
    }

    if (!managedNip05Touched && managedNip05Domain) {
      managedNip05Name = managedNip05NameFromIdentifier(profile?.nip05, managedNip05Domain) ?? '';
    }
  }

  function applySocialPrefill(prefill: SocialProfilePrefill) {
    importedSocialPrefill = prefill;
    profileTouched = true;
    name = cleanText(prefill.username);
    display = cleanText(prefill.displayName);
    about = cleanText(prefill.bio);
    avatarUrl = cleanText(prefill.avatarUrl);
    selectedDicebear = null;
    avatarFile = null;
    clearAvatarPreview();
    if (fileInput) fileInput.value = '';

    if (!managedNip05Touched && managedNip05Domain && prefill.username) {
      managedNip05Name = normalizeManagedNip05Name(prefill.username);
    }
  }

  function handleAvatarClick() {
    fileInput?.click();
  }

  function handleAvatarSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    clearMessages();
    clearAvatarPreview();
    avatarFile = file;
    if (file) avatarPreviewUrl = URL.createObjectURL(file);
    profileTouched = true;
  }

  function removeAvatar() {
    avatarUrl = '';
    avatarFile = null;
    selectedDicebear = null;
    clearAvatarPreview();
    if (fileInput) fileInput.value = '';
    profileTouched = true;
  }

  async function uploadAvatarFile(): Promise<string | null> {
    if (!avatarFile) return avatarUrl || null;

    const hasCustomValue = Boolean(cleanText(blossomServer));
    const parsedServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);
    if (!parsedServer) {
      uploadError = 'Enter a valid storage server URL.';
      return null;
    }

    try {
      clearMessages();
      uploadingAvatar = true;
      uploadProgress = 0;
      await ensureClientNdk();

      const { NDKBlossom } = await import('@nostr-dev-kit/blossom');
      const blossom = new NDKBlossom(ndk);
      const descriptor = await blossom.upload(avatarFile, {
        server: parsedServer,
        onProgress: ({ loaded, total }) => {
          uploadProgress = total > 0 ? Math.round((loaded / total) * 100) : null;
          return 'continue';
        }
      });
      const uploadedUrl = descriptor.url;
      if (!uploadedUrl) throw new Error("The storage server didn't return a file URL.");

      avatarUrl = uploadedUrl;
      avatarFile = null;
      blossomTouched = true;
      blossomServer = parsedServer;
      clearAvatarPreview();
      if (fileInput) fileInput.value = '';
      return uploadedUrl;
    } catch (caught) {
      uploadError = caught instanceof Error ? caught.message : "Couldn't upload that picture.";
      return null;
    } finally {
      uploadingAvatar = false;
      uploadProgress = null;
    }
  }

  async function readResponseError(response: Response, fallback: string): Promise<string> {
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) return payload.error;
    } catch {}

    return fallback;
  }

  async function buildManagedNip05Auth(
    action: 'register' | 'clear',
    domain: string,
    handle?: string
  ): Promise<NostrEvent> {
    await ensureClientNdk();

    const authEvent = new NDKEvent(ndk, {
      kind: NIP05_REGISTRATION_AUTH_KIND,
      content: '',
      tags: [
        ['t', 'nip05-registration'],
        ['action', action],
        ['domain', domain],
        ...(handle ? [['name', handle]] : [])
      ]
    } as NostrEvent);

    await authEvent.sign();
    return authEvent.rawEvent() as NostrEvent;
  }

  async function syncManagedNip05(
    publishingUser: NDKUser,
    previousManagedName: string | undefined
  ): Promise<string | undefined> {
    if (!managedNip05Domain) return undefined;

    if (!normalizedManagedNip05Name) {
      if (!managedNip05Touched || !previousManagedName) return undefined;

      const response = await fetch('/api/nip05', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          auth: await buildManagedNip05Auth('clear', managedNip05Domain)
        })
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Couldn't clear your verified handle."));
      }

      managedNip05Status = 'idle';
      managedNip05StatusPubkey = null;
      return undefined;
    }

    const response = await fetch('/api/nip05', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: normalizedManagedNip05Name,
        auth: await buildManagedNip05Auth('register', managedNip05Domain, normalizedManagedNip05Name)
      })
    });

    if (!response.ok) {
      throw new Error(
        await readResponseError(response, `Couldn't register ${managedNip05Identifier}.`)
      );
    }

    managedNip05Status = 'owned';
    managedNip05StatusPubkey = publishingUser.pubkey;
    return formatManagedNip05Identifier(normalizedManagedNip05Name, managedNip05Domain);
  }

  async function publish() {
    if (!ndk.$sessions || !canPublish) return;

    let publishingUser = currentUser;
    if (!publishingUser) {
      const signer = NDKPrivateKeySigner.generate();
      await ndk.$sessions.login(signer);
      publishingUser = await signer.user();
    }

    if (!publishingUser || isReadOnly) return;

    const nextName = cleanText(name);
    const nextDisplay = cleanText(display);
    const nextAbout = cleanText(about);
    const nextWebsite = cleanText(website);
    const hasCustomValue = Boolean(cleanText(blossomServer));
    const nextServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);

    if (!nextServer) {
      saveError = 'Enter a valid storage server URL.';
      return;
    }

    let nextAvatar = cleanText(avatarUrl) || selectedDicebear || '';
    if (avatarFile) {
      const uploadedUrl = await uploadAvatarFile();
      if (!uploadedUrl) {
        saveError = uploadError || 'Upload failed.';
        return;
      }
      nextAvatar = cleanText(uploadedUrl);
    }

    try {
      clearMessages();
      saving = true;
      await ensureClientNdk();

      const previousProfile = publishingUser.profile ? { ...publishingUser.profile } : undefined;
      const nextProfile: NDKUserProfile = { ...(publishingUser.profile ?? {}) };
      nextProfile.name = nextName || undefined;
      nextProfile.displayName = nextDisplay || undefined;
      nextProfile.about = nextAbout || undefined;
      nextProfile.bio = nextAbout || undefined;
      nextProfile.website = nextWebsite || undefined;
      nextProfile.picture = nextAvatar || undefined;
      nextProfile.image = nextAvatar || undefined;

      if (managedNip05Enabled && managedNip05Domain) {
        const nextManagedNip05 = await syncManagedNip05(publishingUser, currentManagedNip05Name);
        if (managedNip05Touched || currentManagedNip05Name) {
          nextProfile.nip05 = nextManagedNip05 || undefined;
        }
      }

      publishingUser.profile = nextProfile;
      try {
        await publishingUser.publish();
      } catch (caught) {
        publishingUser.profile = previousProfile;
        throw caught;
      }

      const session = ndk.$sessions.current;

      const nextBlossom =
        blossomEvent instanceof NDKBlossomList
          ? blossomEvent
          : blossomEvent
            ? NDKBlossomList.from(blossomEvent as NDKEvent)
            : new NDKBlossomList(ndk);
      nextBlossom.servers = mergeBlossomServers(nextServer, nextBlossom.servers);
      nextBlossom.default = nextServer;
      await nextBlossom.publish();
      session?.events.set(NDKKind.BlossomList, nextBlossom);

      await goto(onboardingCompletionTarget(window.location.search));
    } catch (caught) {
      saveError = caught instanceof Error ? caught.message : "Couldn't publish your profile.";
    } finally {
      saving = false;
    }
  }

  $effect(() => {
    const pubkey = currentUser?.pubkey ?? null;
    if (activePubkey === pubkey) return;
    activePubkey = pubkey;
    profileTouched = false;
    blossomTouched = false;
    profileLoading = false;
    clearMessages();
    resetDraft();
    if (currentUser?.profile) seedProfile(currentUser.profile);
  });

  $effect(() => {
    if (!profileTouched) seedProfile(currentUser?.profile ?? resolvedProfile);
  });

  $effect(() => {
    if (!blossomTouched) {
      blossomServer = blossomServerFromEvent(blossomEvent as NDKEvent | null | undefined);
    }
  });

  $effect(() => {
    if (!managedNip05Domain) {
      managedNip05Name = '';
      managedNip05Touched = false;
      managedNip05Status = 'idle';
      managedNip05StatusPubkey = null;
    }
  });

  $effect(() => {
    if (!currentUser?.pubkey || currentUser.profile || profileLoading) return;

    const targetPubkey = currentUser.pubkey;
    profileLoading = true;

    void currentUser.fetchProfile()
      .then((profile) => {
        if (currentUser?.pubkey !== targetPubkey) return;
        resolvedProfile = profile ?? currentUser.profile ?? undefined;
        if (!profileTouched) seedProfile(profile ?? currentUser.profile ?? undefined);
      })
      .catch(() => {
        if (currentUser?.pubkey !== targetPubkey) return;
        resolvedProfile = currentUser.profile ?? undefined;
      })
      .finally(() => {
        if (currentUser?.pubkey === targetPubkey) profileLoading = false;
      });
  });

  $effect(() => {
    if (typeof window === 'undefined') return;

    const domain = managedNip05Domain;
    const desiredName = normalizedManagedNip05Name;
    const viewerPubkey = currentUser?.pubkey ?? null;

    if (!domain || !desiredName) {
      managedNip05Status = 'idle';
      managedNip05StatusPubkey = null;
      return;
    }

    if (!isValidManagedNip05Name(desiredName)) {
      managedNip05Status = 'idle';
      managedNip05StatusPubkey = null;
      return;
    }

    managedNip05Status = 'checking';
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void fetch(`/api/nip05?name=${encodeURIComponent(desiredName)}`, {
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) throw new Error('lookup failed');

          const payload = (await response.json()) as {
            exists: boolean;
            pubkey: string | null;
          };

          managedNip05StatusPubkey = payload.pubkey;

          if (!payload.exists) {
            managedNip05Status = 'available';
            return;
          }

          managedNip05Status = payload.pubkey && viewerPubkey === payload.pubkey ? 'owned' : 'taken';
        })
        .catch((error) => {
          if (controller.signal.aborted) return;
          console.error('NIP-05 availability lookup failed:', error);
          managedNip05Status = 'error';
          managedNip05StatusPubkey = null;
        });
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  });

  $effect(() => {
    return () => clearAvatarPreview();
  });

  $effect(() => {
    if (typeof window === 'undefined') return;

    const socialError = consumeSocialProfileError();
    if (socialError) {
      saveError = socialError;
    }

    const prefill = consumeSocialProfilePrefill();
    if (prefill) {
      applySocialPrefill(prefill);
    }
  });
</script>

<div class="ob-wrap">
  <header class="ob-top">
    <div class="ob-eyebrow">
      <span class="ob-step-label">Step {step} of 2</span>
      <span class="ob-step-sep" aria-hidden="true">·</span>
      <span>{step === 1 ? 'You' : 'Handle'}</span>
    </div>
    <h1 class="ob-hed">
      {#if step === 1}
        Tell people who you are.
      {:else}
        A handle and a home on the web.
      {/if}
    </h1>
    <p class="ob-lede">
      {#if step === 1}
        This is the identity other traders, writers, and agents will see next to your replies,
        claims, and trades. You can edit any of it later.
      {:else}
        Optional. Reserve a verified handle on Cascade, and point at a site you already have.
      {/if}
    </p>
  </header>

  <nav class="ob-progress" aria-label="Onboarding progress">
    <button
      type="button"
      class="ob-progress-step"
      class:ob-progress-step--on={step >= 1}
      onclick={() => { step = 1; }}
    >
      <span class="ob-progress-num">1</span>
      <span class="ob-progress-label">You</span>
    </button>
    <span class="ob-progress-rule" aria-hidden="true"></span>
    <button
      type="button"
      class="ob-progress-step"
      class:ob-progress-step--on={step >= 2}
      onclick={() => {
        if (step1Valid) step = 2;
      }}
      disabled={!step1Valid}
    >
      <span class="ob-progress-num">2</span>
      <span class="ob-progress-label">Handle</span>
    </button>
  </nav>

  {#if importedSocialPrefill && step === 1}
    <div class="ob-imported" role="status">
      <span class="ob-imported-eyebrow">Imported</span>
      <p>
        Pulled name, handle, and picture from
        <strong>{socialProviderLabel(importedSocialPrefill.provider)}</strong>. Everything is
        editable.
      </p>
    </div>
  {/if}

  {#if step === 1}
    <section class="ob-step ob-step-one">
      <div class="ob-avatar-col">
        <span class="ob-field-eyebrow">Profile picture</span>
        <button
          type="button"
          class="ob-avatar"
          onclick={handleAvatarClick}
          aria-label="Upload your own picture"
        >
          {#if avatarDisplayUrl}
            <img src={avatarDisplayUrl} alt="Your avatar" />
          {:else}
            <span class="ob-avatar-initial">{identityInitial}</span>
          {/if}
          <span class="ob-avatar-hint" aria-hidden="true">Upload</span>
        </button>
        <input
          bind:this={fileInput}
          type="file"
          accept="image/*"
          onchange={handleAvatarSelection}
          class="ob-file-input"
          tabindex="-1"
        />

        <div class="ob-avatar-options">
          <div class="ob-field-eyebrow ob-avatar-options-head">Or pick one</div>
          <div class="ob-avatar-grid">
            {#each DICEBEAR_AVATARS as avatar (avatar.url)}
              <button
                type="button"
                class="ob-avatar-preset"
                class:ob-avatar-preset--on={selectedDicebear === avatar.url}
                onclick={() => {
                  selectedDicebear = avatar.url;
                  avatarUrl = '';
                  avatarFile = null;
                  clearAvatarPreview();
                  if (fileInput) fileInput.value = '';
                  profileTouched = true;
                }}
              >
                <img src={avatar.url} alt={avatar.seed} loading="lazy" />
              </button>
            {/each}
          </div>
        </div>

        {#if avatarDisplayUrl}
          <button class="ob-ghost-link" type="button" onclick={removeAvatar}>Remove picture</button>
        {/if}

        {#if uploadingAvatar && uploadProgress != null}
          <p class="ob-field-meta">Uploading… {uploadProgress}%</p>
        {/if}

        {#if uploadError}
          <p class="ob-field-error" role="alert">{uploadError}</p>
        {/if}
      </div>

      <div class="ob-fields">
        <label class="ob-field">
          <span class="ob-field-eyebrow">Username</span>
          <input
            class="ob-input"
            bind:value={name}
            oninput={() => { profileTouched = true; }}
            placeholder={namePlaceholder}
            autocomplete="username"
          />
          <span class="ob-field-help">Lowercase, unique-ish. Used in mentions and your profile URL.</span>
        </label>

        <label class="ob-field">
          <span class="ob-field-eyebrow">Name <span class="ob-field-optional">Optional</span></span>
          <input
            class="ob-input"
            bind:value={display}
            oninput={() => { profileTouched = true; }}
            placeholder="Your full name"
            autocomplete="name"
          />
        </label>

        <label class="ob-field">
          <span class="ob-field-eyebrow">Bio <span class="ob-field-optional">Optional</span></span>
          <textarea
            class="ob-input ob-textarea"
            bind:value={about}
            oninput={() => { profileTouched = true; }}
            placeholder="What do you write about?"
          ></textarea>
          <span class="ob-field-help">
            One or two sentences. The bio appears under your name in the author rail and on the discussion page.
          </span>
        </label>
      </div>
    </section>

    <div class="ob-nav">
      <div class="ob-nav-message">
        {#if !step1Valid}
          <p>Add a username or name to continue.</p>
        {/if}
      </div>
      <button
        class="ob-btn-ink"
        type="button"
        disabled={!step1Valid}
        onclick={() => { step = 2; }}
      >
        Continue →
      </button>
    </div>
  {:else if step === 2}
    <section class="ob-step ob-step-two">
      <article class="ob-preview" aria-label="Identity preview">
        <div class="ob-preview-av">
          {#if avatarDisplayUrl}
            <img src={avatarDisplayUrl} alt="Your avatar" />
          {:else}
            <span>{identityInitial}</span>
          {/if}
        </div>
        <div class="ob-preview-body">
          <span class="ob-field-eyebrow">Public identity</span>
          <p class="ob-preview-name">{identityLabel}</p>
          {#if cleanText(about)}
            <p class="ob-preview-bio">{cleanText(about)}</p>
          {:else}
            <p class="ob-preview-bio ob-preview-bio--empty">No bio yet — that&rsquo;s fine.</p>
          {/if}
        </div>
      </article>

      <div class="ob-fields">
        <label class="ob-field">
          <span class="ob-field-eyebrow">Website <span class="ob-field-optional">Optional</span></span>
          <input
            class="ob-input"
            type="url"
            bind:value={website}
            oninput={() => { profileTouched = true; }}
            placeholder="https://yoursite.com"
          />
        </label>

        {#if managedNip05Enabled && managedNip05Domain}
          <div class="ob-field">
            <span class="ob-field-eyebrow">Verified handle <span class="ob-field-optional">Optional</span></span>
            <div class="ob-handle">
              <input
                class="ob-input ob-input--handle"
                bind:value={managedNip05Name}
                oninput={() => { managedNip05Touched = true; }}
                placeholder="yourhandle"
                autocomplete="off"
                autocapitalize="none"
                autocorrect="off"
                spellcheck="false"
              />
              <span class="ob-handle-domain">@{managedNip05Domain}</span>
            </div>

            <div class="ob-handle-status" aria-live="polite">
              {#if normalizedManagedNip05Name && !managedNip05Valid}
                <span class="ob-status ob-status--error">
                  Use 1–64 lowercase letters, numbers, hyphens, or underscores.
                </span>
              {:else if managedNip05Status === 'checking'}
                <span class="ob-status ob-status--muted">Checking {managedNip05Identifier}…</span>
              {:else if managedNip05Status === 'available'}
                <span class="ob-status ob-status--yes">{managedNip05Identifier} is available.</span>
              {:else if managedNip05Status === 'owned'}
                <span class="ob-status ob-status--yes">
                  {managedNip05Identifier} is already linked to this session.
                </span>
              {:else if managedNip05Status === 'taken'}
                <span class="ob-status ob-status--no">That handle is already registered.</span>
              {:else if managedNip05Status === 'error'}
                <span class="ob-status ob-status--error">Couldn&rsquo;t check that handle right now.</span>
              {:else if existingExternalNip05}
                <span class="ob-status ob-status--muted">
                  Your profile already advertises {existingExternalNip05}. Leaving this blank keeps it.
                </span>
              {:else}
                <span class="ob-status ob-status--muted">
                  Reserve a verified handle on @{managedNip05Domain}. Leave blank to skip.
                </span>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </section>

    <div class="ob-nav">
      <button class="ob-btn-ghost" type="button" onclick={() => { step = 1; }}>← Back</button>
      <button
        class="ob-btn-ink"
        type="button"
        disabled={!canPublish}
        onclick={() => void publish()}
      >
        {#if saving}
          Publishing…
        {:else}
          Publish profile
        {/if}
      </button>
    </div>

    {#if saveError}
      <p class="ob-save-error" role="alert">{saveError}</p>
    {/if}
  {/if}
</div>

<style>
  .ob-wrap {
    display: grid;
    gap: 2.2rem;
    max-width: 44rem;
    padding-top: 2rem;
    padding-bottom: 3rem;
  }

  .ob-top {
    display: grid;
    gap: 0.75rem;
  }

  .ob-eyebrow,
  .ob-field-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--color-neutral-content);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .ob-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  .ob-step-sep {
    color: var(--color-base-300);
  }

  .ob-hed {
    font-family: var(--font-tight);
    font-size: clamp(2.1rem, 4.2vw, 3rem);
    font-weight: 700;
    letter-spacing: -0.045em;
    line-height: 1.04;
    color: var(--color-base-content);
  }

  .ob-lede {
    max-width: 36rem;
    color: color-mix(in srgb, var(--color-base-content) 66%, transparent);
    font-size: 1rem;
    line-height: 1.7;
  }

  .ob-progress {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.9rem;
    padding: 0.3rem 0 0.6rem;
  }

  .ob-progress-step {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    padding: 0.1rem 0;
    background: transparent;
    border: 0;
    color: var(--color-neutral-content);
    font-family: inherit;
    font-size: 0.85rem;
    letter-spacing: 0;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .ob-progress-step:disabled {
    cursor: not-allowed;
  }

  .ob-progress-step--on {
    color: var(--color-base-content);
  }

  .ob-progress-num {
    display: grid;
    width: 1.6rem;
    height: 1.6rem;
    place-items: center;
    border: 1px solid var(--color-base-300);
    border-radius: 999px;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    font-weight: 600;
    color: var(--color-neutral-content);
    background: transparent;
  }

  .ob-progress-step--on .ob-progress-num {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border-color: var(--color-primary);
  }

  .ob-progress-rule {
    height: 1px;
    background: var(--color-base-300);
  }

  .ob-imported {
    display: grid;
    gap: 0.3rem;
    padding: 0.95rem 1.1rem;
    border: 1px solid var(--color-base-300);
    border-left: 2px solid var(--color-primary);
    border-radius: 6px;
    background: var(--color-base-200);
  }

  .ob-imported-eyebrow {
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-primary);
  }

  .ob-imported p {
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .ob-imported strong {
    color: var(--color-base-content);
    font-weight: 600;
  }

  .ob-step-one {
    display: grid;
    grid-template-columns: minmax(12rem, 15rem) minmax(0, 1fr);
    gap: 2.2rem;
    padding-top: 0.4rem;
  }

  .ob-step-two {
    display: grid;
    gap: 1.6rem;
    padding-top: 0.4rem;
  }

  .ob-avatar-col {
    display: grid;
    gap: 0.85rem;
    align-content: start;
  }

  .ob-avatar {
    position: relative;
    display: grid;
    width: 11rem;
    height: 11rem;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--color-neutral);
    border-radius: 999px;
    background: var(--color-base-200);
    cursor: pointer;
    transition: border-color 120ms ease;
  }

  .ob-avatar:hover {
    border-color: var(--color-primary);
  }

  .ob-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ob-avatar-initial {
    font-family: var(--font-serif);
    font-size: 3.8rem;
    font-weight: 500;
    color: var(--color-primary);
    letter-spacing: -0.02em;
  }

  .ob-avatar-hint {
    position: absolute;
    inset: auto 0 0 0;
    padding: 0.45rem 0;
    background: color-mix(in srgb, #000 62%, transparent);
    color: var(--color-base-content);
    font-family: var(--font-mono);
    font-size: 0.66rem;
    font-weight: 600;
    text-align: center;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .ob-avatar:hover .ob-avatar-hint {
    opacity: 1;
  }

  .ob-file-input {
    display: none;
  }

  .ob-avatar-options {
    display: grid;
    gap: 0.6rem;
    padding-top: 0.4rem;
  }

  .ob-avatar-options-head {
    font-size: 0.62rem;
  }

  .ob-avatar-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .ob-avatar-preset {
    position: relative;
    display: grid;
    width: 100%;
    aspect-ratio: 1 / 1;
    overflow: hidden;
    padding: 0;
    place-items: center;
    border: 1px solid var(--color-base-300);
    border-radius: 999px;
    background: var(--color-base-100);
    cursor: pointer;
    transition: border-color 120ms ease, transform 120ms ease;
  }

  .ob-avatar-preset:hover {
    border-color: var(--color-neutral-content);
  }

  .ob-avatar-preset--on {
    border-color: var(--color-primary);
  }

  .ob-avatar-preset img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ob-ghost-link {
    justify-self: start;
    padding: 0;
    background: transparent;
    border: 0;
    color: var(--color-neutral-content);
    font-family: inherit;
    font-size: 0.82rem;
    cursor: pointer;
    transition: color 120ms ease;
  }

  .ob-ghost-link:hover {
    color: var(--color-base-content);
  }

  .ob-fields {
    display: grid;
    gap: 1.2rem;
    align-content: start;
  }

  .ob-field {
    display: grid;
    gap: 0.4rem;
  }

  .ob-field-optional {
    font-weight: 500;
    color: var(--color-neutral-content);
    letter-spacing: 0.12em;
    margin-left: 0.45rem;
  }

  .ob-field-help {
    color: color-mix(in srgb, var(--color-neutral-content) 85%, transparent);
    font-size: 0.82rem;
    line-height: 1.55;
  }

  .ob-field-meta {
    color: var(--color-neutral-content);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    letter-spacing: 0.06em;
  }

  .ob-field-error {
    color: var(--color-error);
    font-size: 0.86rem;
    line-height: 1.55;
    margin: 0;
  }

  .ob-input {
    width: 100%;
    padding: 0.7rem 0.9rem;
    border: 1px solid var(--color-neutral);
    border-radius: 6px;
    background: var(--color-base-200);
    color: var(--color-base-content);
    font-family: inherit;
    font-size: 0.98rem;
    line-height: 1.45;
    transition: border-color 120ms ease, background 120ms ease;
  }

  .ob-input::placeholder {
    color: color-mix(in srgb, var(--color-neutral-content) 80%, transparent);
  }

  .ob-input:focus {
    outline: none;
    border-color: var(--color-primary);
    background: var(--color-base-100);
  }

  .ob-textarea {
    min-height: 7rem;
    resize: vertical;
  }

  .ob-handle {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    border: 1px solid var(--color-neutral);
    border-radius: 6px;
    background: var(--color-base-200);
    overflow: hidden;
    transition: border-color 120ms ease;
  }

  .ob-handle:focus-within {
    border-color: var(--color-primary);
    background: var(--color-base-100);
  }

  .ob-input--handle {
    border: 0;
    border-radius: 0;
    background: transparent;
  }

  .ob-input--handle:focus {
    background: transparent;
  }

  .ob-handle-domain {
    display: grid;
    place-items: center;
    padding: 0 0.95rem;
    color: var(--color-neutral-content);
    font-family: var(--font-mono);
    font-size: 0.88rem;
    letter-spacing: 0;
    background: color-mix(in srgb, var(--color-base-300) 70%, transparent);
    border-left: 1px solid var(--color-base-300);
  }

  .ob-handle-status {
    min-height: 1.3rem;
    padding-top: 0.25rem;
  }

  .ob-status {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    letter-spacing: 0.04em;
    line-height: 1.5;
  }

  .ob-status--muted {
    color: var(--color-neutral-content);
  }

  .ob-status--yes {
    color: var(--color-success);
  }

  .ob-status--no {
    color: var(--color-error);
  }

  .ob-status--error {
    color: var(--color-error);
  }

  .ob-preview {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 1.1rem;
    padding: 1.1rem 1.15rem;
    border: 1px solid var(--color-base-300);
    border-radius: 8px;
    background: var(--color-base-200);
  }

  .ob-preview-av {
    display: grid;
    width: 3.4rem;
    height: 3.4rem;
    place-items: center;
    overflow: hidden;
    border: 1px solid var(--color-neutral);
    border-radius: 999px;
    background: var(--color-base-300);
    color: var(--color-primary);
    font-family: var(--font-serif);
    font-size: 1.3rem;
    font-weight: 500;
  }

  .ob-preview-av img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .ob-preview-body {
    display: grid;
    gap: 0.25rem;
  }

  .ob-preview-name {
    font-family: var(--font-tight);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: -0.015em;
    color: var(--color-base-content);
  }

  .ob-preview-bio {
    color: color-mix(in srgb, var(--color-base-content) 70%, transparent);
    font-size: 0.95rem;
    line-height: 1.55;
  }

  .ob-preview-bio--empty {
    color: var(--color-neutral-content);
    font-style: italic;
  }

  .ob-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    padding-top: 1.2rem;
    border-top: 1px solid var(--color-base-300);
  }

  .ob-nav-message {
    color: var(--color-neutral-content);
    font-size: 0.86rem;
  }

  .ob-btn-ink,
  .ob-btn-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 2.6rem;
    padding-inline: 1.2rem;
    border-radius: 6px;
    font-size: 0.92rem;
    font-weight: 600;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
    cursor: pointer;
  }

  .ob-btn-ink {
    background: var(--color-primary);
    color: var(--color-primary-content);
    border: 1px solid var(--color-primary);
  }

  .ob-btn-ink:hover:not(:disabled) {
    background: #fff8ec;
    border-color: #fff8ec;
  }

  .ob-btn-ink:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .ob-btn-ghost {
    background: transparent;
    color: var(--color-base-content);
    border: 1px solid var(--color-neutral);
  }

  .ob-btn-ghost:hover {
    border-color: var(--color-neutral-content);
    background: color-mix(in srgb, var(--color-base-200) 80%, transparent);
  }

  .ob-save-error {
    color: var(--color-error);
    font-size: 0.9rem;
    line-height: 1.55;
    margin: 0;
  }

  @media (max-width: 720px) {
    .ob-step-one {
      grid-template-columns: minmax(0, 1fr);
      gap: 1.6rem;
    }

    .ob-avatar {
      width: 9rem;
      height: 9rem;
    }

    .ob-avatar-initial {
      font-size: 3rem;
    }

    .ob-nav {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .ob-nav-message {
      text-align: center;
    }

    .ob-btn-ink,
    .ob-btn-ghost {
      width: 100%;
    }
  }
</style>
