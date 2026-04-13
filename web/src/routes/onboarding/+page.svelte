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
  import { onDestroy } from 'svelte';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import { cleanText, displayName, profileIdentifier } from '$lib/ndk/format';
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

  type Nip05Status = 'idle' | 'checking' | 'available' | 'owned' | 'taken' | 'error';

  let { data }: PageProps = $props();

  // ── wizard step ────────────────────────────────────────────────
  let step = $state<1 | 2>(1);

  // ── fake name placeholders ──────────────────────────────────────
  const FAKE_NAMES = [
    'Milo Vance', 'Sable Quinn', 'Cleo Hartwell', 'Ren Ashford',
    'Piper Strand', 'Callum Wray', 'Indigo Marsh', 'Nox Ellery',
    'Wren Coulter', 'Soren Dahl', 'Lyra Finch', 'Caius Webb',
    'Blythe Rowe', 'Emery Holt', 'Zara Flint', 'Thane Osler'
  ];
  const namePlaceholder = FAKE_NAMES[Math.floor(Math.random() * FAKE_NAMES.length)];

  // ── dicebear avatar presets ─────────────────────────────────────
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

  // ── profile fields ─────────────────────────────────────────────
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

  // ── derived ─────────────────────────────────────────────────────
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
  const writerLabel = $derived(
    displayName(
      {
        ...(resolvedProfile ?? {}),
        name: cleanText(name) || resolvedProfile?.name,
        displayName: cleanText(display) || resolvedProfile?.displayName
      },
      'You'
    )
  );
  const step1Valid = $derived(
    Boolean(cleanText(name) || cleanText(display))
  );
  const canPublish = $derived(!isReadOnly && !saving && !uploadingAvatar && managedNip05Ready);

  // ── profile helpers ─────────────────────────────────────────────
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
    name?: string
  ): Promise<NostrEvent> {
    await ensureClientNdk();

    const authEvent = new NDKEvent(ndk, {
      kind: NIP05_REGISTRATION_AUTH_KIND,
      content: '',
      tags: [
        ['t', 'nip05-registration'],
        ['action', action],
        ['domain', domain],
        ...(name ? [['name', name]] : [])
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
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          auth: await buildManagedNip05Auth('clear', managedNip05Domain)
        })
      });

      if (!response.ok) {
        throw new Error(await readResponseError(response, "Couldn't clear your NIP-05 handle."));
      }

      managedNip05Status = 'idle';
      managedNip05StatusPubkey = null;
      return undefined;
    }

    const response = await fetch('/api/nip05', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
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

  // ── publish ─────────────────────────────────────────────────────
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

      await goto(`/p/${profileIdentifier(nextProfile, publishingUser.npub)}`);
    } catch (caught) {
      saveError = caught instanceof Error ? caught.message : "Couldn't publish your profile.";
    } finally {
      saving = false;
    }
  }

  // ── effects ─────────────────────────────────────────────────────
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

  onDestroy(() => {
    clearAvatarPreview();
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

<div class="ob-shell">
  <nav class="ob-progress" aria-label="Setup steps">
    {#each [1, 2] as s (s)}
      <button
        class="ob-progress-step"
        class:active={step === s}
        class:done={step > s}
        type="button"
        onclick={() => {
          if (s < step || (s === 2 && step1Valid)) step = s as 1 | 2;
        }}
        aria-current={step === s ? 'step' : undefined}
      >
        <span class="ob-progress-dot"></span>
        <span class="ob-progress-label">{['About you', 'Public profile'][s - 1]}</span>
      </button>
    {/each}
  </nav>

  {#if step === 1}
    <div class="ob-step reveal">
      <div class="ob-step-head">
        <h1>Tell people who you are.</h1>
        <p>Set the basics for the public profile other traders and agents will see.</p>
        {#if importedSocialPrefill}
          <div class="ob-prefill-note">
            <strong>Imported from {socialProviderLabel(importedSocialPrefill.provider)}.</strong>
            <p>Everything here is editable before you publish your Cascade profile.</p>
          </div>
        {/if}
      </div>

      <div class="ob-step-body">
        <div class="ob-avatar-zone">
          <button class="ob-avatar-btn" type="button" onclick={handleAvatarClick} aria-label="Upload your own photo">
            {#if avatarDisplayUrl}
              <img src={avatarDisplayUrl} alt="Your avatar" class="ob-avatar-img" />
            {:else}
              <div class="ob-avatar-placeholder">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
            {/if}
            <div class="ob-avatar-overlay" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
              </svg>
            </div>
          </button>
          <input bind:this={fileInput} type="file" accept="image/*" onchange={handleAvatarSelection} class="ob-file-input" tabindex="-1" />

          <div class="ob-dicebear-wrap">
            <p class="ob-dicebear-label">Or pick one</p>
            <div class="ob-dicebear-track" role="listbox" aria-label="Avatar options">
              {#each DICEBEAR_AVATARS as avatar (avatar.url)}
                <button
                  class="ob-dicebear-item"
                  class:selected={selectedDicebear === avatar.url}
                  type="button"
                  role="option"
                  aria-selected={selectedDicebear === avatar.url}
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
            <button
              class="ob-avatar-remove"
              type="button"
              onclick={() => {
                avatarUrl = '';
                avatarFile = null;
                selectedDicebear = null;
                clearAvatarPreview();
                if (fileInput) fileInput.value = '';
              }}
            >
              Remove photo
            </button>
          {/if}
          {#if uploadError}
            <p class="ob-error">{uploadError}</p>
          {/if}
        </div>

        <div class="ob-fields">
          <div class="ob-field-row">
            <label class="ob-field">
              <span>Username</span>
              <input
                bind:value={name}
                oninput={() => {
                  profileTouched = true;
                }}
                placeholder={namePlaceholder}
                autocomplete="username"
              />
            </label>
            <label class="ob-field">
              <span>Name <em>(optional)</em></span>
              <input
                bind:value={display}
                oninput={() => {
                  profileTouched = true;
                }}
                placeholder="Your full name"
                autocomplete="name"
              />
            </label>
          </div>

          <label class="ob-field">
            <span>Bio <em>(optional)</em></span>
            <textarea
              bind:value={about}
              oninput={() => {
                profileTouched = true;
              }}
              placeholder="What do you write about?"
              rows="3"
            ></textarea>
          </label>
        </div>
      </div>

      <div class="ob-step-footer">
        <button
          class="button ob-next"
          type="button"
          disabled={!step1Valid}
          onclick={() => {
            step = 2;
          }}
        >
          Next — public profile details
        </button>
        {#if !step1Valid}
          <p class="ob-hint">Add a username or name to continue.</p>
        {/if}
      </div>
    </div>
  {:else if step === 2}
    <div class="ob-step reveal">
      <div class="ob-step-head">
        <h1>Finish your public profile.</h1>
        <p>Add a site or claim a verified handle. Both are optional.</p>
      </div>

      <div class="ob-step-body">
        <div class="ob-fields">
          <div class="ob-profile-summary">
            <span>Public name</span>
            <strong>{writerLabel}</strong>
            <p>This is the identity people will see when they open your public profile.</p>
          </div>

          <label class="ob-field">
            <span>Website <em>(optional)</em></span>
            <input
              bind:value={website}
              oninput={() => {
                profileTouched = true;
              }}
              placeholder="https://yoursite.com"
              type="url"
            />
          </label>

          {#if managedNip05Enabled && managedNip05Domain}
            <label class="ob-field">
              <span>Verified handle <em>(optional)</em></span>
              <div class="ob-managed-nip05-input">
                <input
                  bind:value={managedNip05Name}
                  oninput={() => {
                    managedNip05Touched = true;
                  }}
                  placeholder="writer"
                  autocomplete="off"
                  autocapitalize="none"
                  autocorrect="off"
                  spellcheck="false"
                />
                <span class="ob-managed-nip05-domain">@{managedNip05Domain}</span>
              </div>
              <p class="ob-managed-nip05-note">
                Reserve a verified handle on @{managedNip05Domain}. Leave it blank to skip.
              </p>
              {#if existingExternalNip05}
                <p class="ob-managed-nip05-note">
                  Your current profile already advertises {existingExternalNip05}. Leaving this blank keeps that value.
                </p>
              {/if}
              {#if normalizedManagedNip05Name && !managedNip05Valid}
                <p class="ob-error">Use 1-64 lowercase letters, numbers, hyphens, or underscores.</p>
              {:else if managedNip05Status === 'checking'}
                <p class="ob-managed-nip05-status">Checking {managedNip05Identifier}…</p>
              {:else if managedNip05Status === 'available'}
                <p class="ob-managed-nip05-status success">{managedNip05Identifier} is available.</p>
              {:else if managedNip05Status === 'owned'}
                <p class="ob-managed-nip05-status success">{managedNip05Identifier} is already linked to this session.</p>
              {:else if managedNip05Status === 'taken'}
                <p class="ob-managed-nip05-status">That handle is already registered.</p>
              {:else if managedNip05Status === 'error'}
                <p class="ob-error">Couldn't check that handle right now.</p>
              {/if}
            </label>
          {/if}
        </div>
      </div>

      <div class="ob-step-footer">
        <div class="ob-footer-row">
          <button class="button-secondary" type="button" onclick={() => { step = 1; }}>Back</button>
          <button
            class="button ob-next"
            type="button"
            disabled={!canPublish}
            onclick={() => void publish()}
          >
            {saving ? 'Saving…' : 'Open profile'}
          </button>
        </div>
        {#if saveError}
          <p class="ob-error">{saveError}</p>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .ob-prefill-note {
    display: grid;
    gap: 0.35rem;
    padding: 0.9rem 1rem;
    border: 1px solid rgba(64, 64, 64, 0.9);
    background: rgba(23, 23, 23, 0.88);
  }

  .ob-prefill-note strong {
    font-size: 0.95rem;
  }

  .ob-prefill-note p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.6;
  }

  .ob-profile-summary {
    display: grid;
    gap: 0.45rem;
    padding: 1rem 1.1rem;
    border: 1px solid rgba(64, 64, 64, 0.9);
    background: rgba(23, 23, 23, 0.6);
  }

  .ob-profile-summary span {
    color: rgba(255, 255, 255, 0.62);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .ob-profile-summary strong {
    color: #ffffff;
    font-size: 1.15rem;
    letter-spacing: -0.03em;
  }

  .ob-profile-summary p {
    color: rgba(255, 255, 255, 0.72);
    line-height: 1.6;
    margin: 0;
  }

  .ob-managed-nip05-input {
    align-items: center;
    display: grid;
    gap: 0.75rem;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .ob-managed-nip05-domain {
    color: rgba(255, 255, 255, 0.62);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace;
    font-size: 0.95rem;
    white-space: nowrap;
  }

  .ob-managed-nip05-note,
  .ob-managed-nip05-status {
    color: rgba(255, 255, 255, 0.68);
    font-size: 0.92rem;
    line-height: 1.5;
    margin: 0.55rem 0 0;
  }

  .ob-managed-nip05-status.success {
    color: #9ed0ad;
  }

  @media (max-width: 720px) {
    .ob-managed-nip05-input {
      gap: 0.5rem;
      grid-template-columns: 1fr;
    }
  }
</style>
