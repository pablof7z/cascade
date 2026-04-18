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
        throw new Error(await readResponseError(response, "Couldn't clear your verified handle."));
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

      await goto(onboardingCompletionTarget(window.location.search));
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

<div class="mx-auto w-full max-w-4xl space-y-8">
  <!-- Stepper Navigation -->
  <ul class="steps w-full">
    <li class={`step ${step >= 1 ? 'step-primary' : ''}`}>
      <button
        type="button"
        class="text-sm font-medium"
        onclick={() => { step = 1; }}
      >
        About you
      </button>
    </li>
    <li class={`step ${step >= 2 ? 'step-primary' : ''}`}>
      <button
        type="button"
        class="text-sm font-medium"
        onclick={() => {
          if (step1Valid) step = 2;
        }}
        disabled={!step1Valid}
      >
        Public profile
      </button>
    </li>
  </ul>

  {#if step === 1}
    <div class="space-y-8">
      <!-- Header -->
      <div class="space-y-2">
        <h1 class="text-2xl font-bold">Tell people who you are</h1>
        <p class="text-base text-base-content/50">
          Set the basics for the public profile other traders and agents will see.
        </p>
      </div>

      {#if importedSocialPrefill}
        <div role="alert" class="alert bg-base-200">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="h-6 w-6 shrink-0 stroke-info">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <div class="font-bold">Imported from {socialProviderLabel(importedSocialPrefill.provider)}</div>
            <div class="text-sm">Everything here is editable before you publish your Cascade profile.</div>
          </div>
        </div>
      {/if}

      <!-- Form Grid -->
      <div class="grid gap-8 lg:grid-cols-[auto_1fr]">
        <!-- Avatar Section -->
        <div class="space-y-4">
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">Profile photo</span>
            </label>
            <button
              class="avatar placeholder group relative h-48 w-48"
              type="button"
              onclick={handleAvatarClick}
              aria-label="Upload your own photo"
            >
              <div class="w-48 overflow-hidden rounded-lg bg-base-200 ring-1 ring-neutral-700">
                {#if avatarDisplayUrl}
                  <img src={avatarDisplayUrl} alt="Your avatar" class="h-full w-full object-cover" />
                {:else}
                  <div class="flex h-full w-full items-center justify-center">
                    <svg class="h-16 w-16 text-base-content/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                      <circle cx="12" cy="8" r="4" />
                      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                    </svg>
                  </div>
                {/if}
                <div class="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                  <svg class="h-8 w-8 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                  </svg>
                </div>
              </div>
            </button>
            <input bind:this={fileInput} type="file" accept="image/*" onchange={handleAvatarSelection} class="hidden" tabindex="-1" />
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text text-xs font-medium uppercase tracking-wider text-base-content/50">Or pick one</span>
            </label>
            <div class="grid grid-cols-4 gap-2">
              {#each DICEBEAR_AVATARS as avatar (avatar.url)}
                <button
                  class={`avatar placeholder ${
                    selectedDicebear === avatar.url
                      ? 'ring-2 ring-primary'
                      : 'ring-1 ring-neutral-700 hover:ring-neutral-500'
                  }`}
                  type="button"
                  onclick={() => {
                    selectedDicebear = avatar.url;
                    avatarUrl = '';
                    avatarFile = null;
                    clearAvatarPreview();
                    if (fileInput) fileInput.value = '';
                    profileTouched = true;
                  }}
                >
                  <div class="w-12 rounded-lg bg-base-100">
                    <img src={avatar.url} alt={avatar.seed} loading="lazy" />
                  </div>
                </button>
              {/each}
            </div>
          </div>

          {#if avatarDisplayUrl}
            <button
              class="btn btn-ghost btn-sm"
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
            <div role="alert" class="alert alert-error">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{uploadError}</span>
            </div>
          {/if}
        </div>

        <!-- Profile Fields -->
        <div class="space-y-4">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Username</span>
              </label>
              <input
                class="input input-bordered"
                bind:value={name}
                oninput={() => {
                  profileTouched = true;
                }}
                placeholder={namePlaceholder}
                autocomplete="username"
              />
            </div>

            <div class="form-control">
              <label class="label">
                <span class="label-text font-medium">Name <span class="text-base-content/50">(optional)</span></span>
              </label>
              <input
                class="input input-bordered"
                bind:value={display}
                oninput={() => {
                  profileTouched = true;
                }}
                placeholder="Your full name"
                autocomplete="name"
              />
            </div>
          </div>

          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">Bio <span class="text-base-content/50">(optional)</span></span>
            </label>
            <textarea
              class="textarea textarea-bordered h-32"
              bind:value={about}
              oninput={() => {
                profileTouched = true;
              }}
              placeholder="What do you write about?"
            ></textarea>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap items-center justify-between gap-4 border-t border-base-300 pt-6">
        <button
          class="btn btn-primary"
          type="button"
          disabled={!step1Valid}
          onclick={() => {
            step = 2;
          }}
        >
          Next — public profile details
        </button>
        {#if !step1Valid}
          <p class="text-sm text-base-content/50">Add a username or name to continue</p>
        {/if}
      </div>
    </div>
  {:else if step === 2}
    <div class="space-y-8">
      <!-- Header -->
      <div class="space-y-2">
        <h1 class="text-2xl font-bold">Finish your public profile</h1>
        <p class="text-base text-base-content/50">
          Add a site or claim a verified handle. Both are optional.
        </p>
      </div>

      <!-- Profile Summary Card -->
      <div class="card bg-base-200">
        <div class="card-body">
          <div class="space-y-1">
            <p class="text-xs font-medium uppercase tracking-wider text-base-content/50">Public name</p>
            <p class="text-xl font-semibold">{writerLabel}</p>
            <p class="text-sm text-base-content/50">This is the identity people will see when they open your public profile.</p>
          </div>
        </div>
      </div>

      <!-- Form Fields -->
      <div class="space-y-4">
        <div class="form-control">
          <label class="label">
            <span class="label-text font-medium">Website <span class="text-base-content/50">(optional)</span></span>
          </label>
          <input
            class="input input-bordered"
            bind:value={website}
            oninput={() => {
              profileTouched = true;
            }}
            placeholder="https://yoursite.com"
            type="url"
          />
        </div>

        {#if managedNip05Enabled && managedNip05Domain}
          <div class="form-control">
            <label class="label">
              <span class="label-text font-medium">Verified handle <span class="text-base-content/50">(optional)</span></span>
            </label>
            <div class="join w-full">
              <input
                class="input input-bordered join-item flex-1"
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
              <span class="join-item flex items-center bg-base-200 px-4 text-sm text-base-content/50">@{managedNip05Domain}</span>
            </div>
            <label class="label">
              <span class="label-text-alt text-base-content/50">
                Reserve a verified handle on @{managedNip05Domain}. Leave it blank to skip.
              </span>
            </label>

            {#if existingExternalNip05}
              <label class="label">
                <span class="label-text-alt text-base-content/50">
                  Your current profile already advertises {existingExternalNip05}. Leaving this blank keeps that value.
                </span>
              </label>
            {/if}

            {#if normalizedManagedNip05Name && !managedNip05Valid}
              <div role="alert" class="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Use 1-64 lowercase letters, numbers, hyphens, or underscores.</span>
              </div>
            {:else if managedNip05Status === 'checking'}
              <div role="alert" class="alert">
                <span class="loading loading-spinner loading-sm"></span>
                <span>Checking {managedNip05Identifier}…</span>
              </div>
            {:else if managedNip05Status === 'available'}
              <div role="alert" class="alert alert-success">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{managedNip05Identifier} is available</span>
              </div>
            {:else if managedNip05Status === 'owned'}
              <div role="alert" class="alert alert-success">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{managedNip05Identifier} is already linked to this session</span>
              </div>
            {:else if managedNip05Status === 'taken'}
              <div role="alert" class="alert alert-warning">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>That handle is already registered</span>
              </div>
            {:else if managedNip05Status === 'error'}
              <div role="alert" class="alert alert-error">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Couldn't check that handle right now</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="flex flex-wrap items-center gap-3 border-t border-base-300 pt-6">
        <button class="btn btn-outline" type="button" onclick={() => { step = 1; }}>
          Back
        </button>
        <button
          class="btn btn-primary"
          type="button"
          disabled={!canPublish}
          onclick={() => void publish()}
        >
          {#if saving}
            <span class="loading loading-spinner loading-sm"></span>
            Saving…
          {:else}
            Open profile
          {/if}
        </button>
      </div>

      {#if saveError}
        <div role="alert" class="alert alert-error">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 shrink-0 stroke-current" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{saveError}</span>
        </div>
      {/if}
    </div>
  {/if}
</div>

