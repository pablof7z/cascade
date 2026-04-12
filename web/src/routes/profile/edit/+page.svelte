<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    NDKBlossomList,
    NDKEvent,
    NDKKind,
    type NDKUserProfile,
    type NostrEvent
  } from '@nostr-dev-kit/ndk';
  import { onDestroy } from 'svelte';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import { cleanText, displayName, profileIdentifier } from '$lib/ndk/format';
  import {
    DEFAULT_BLOSSOM_SERVER,
    blossomServerFromEvent,
    mergeBlossomServers,
    parseBlossomServer
  } from '$lib/onboarding';
  import ProfilePreview from '$lib/features/profile/ProfilePreview.svelte';

  // ── profile fields ─────────────────────────────────────────────
  let activePubkey = $state<string | null>(null);
  let resolvedProfile: NDKUserProfile | undefined = $state();
  let name = $state('');
  let display = $state('');
  let about = $state('');
  let website = $state('');
  let nip05 = $state('');
  let lud16 = $state('');
  let avatarUrl = $state('');
  let bannerUrl = $state('');
  let avatarFile: File | null = $state(null);
  let bannerFile: File | null = $state(null);
  let avatarPreviewUrl = $state('');
  let bannerPreviewUrl = $state('');
  let profileTouched = $state(false);
  let profileLoading = $state(false);
  let blossomServer = $state(DEFAULT_BLOSSOM_SERVER);
  let blossomTouched = $state(false);
  let saving = $state(false);
  let uploadingAvatar = $state(false);
  let uploadingBanner = $state(false);
  let saveError = $state('');
  let uploadError = $state('');
  let avatarFileInput: HTMLInputElement | null = $state(null);
  let bannerFileInput: HTMLInputElement | null = $state(null);

  // ── NIP-F1 fields ──────────────────────────────────────────────
  let backgroundColor = $state('');
  let foregroundColor = $state('');
  let backgroundMusic = $state('');
  let priorityKinds = $state<number[]>([]);
  let customFields = $state<Array<{ key: string; value: string }>>([]);
  let nipF1Touched = $state(false);
  let nipF1Loading = $state(false);

  // ── preview collapsed state ────────────────────────────────────
  let previewOpen = $state(false);

  // ── derived ────────────────────────────────────────────────────
  const currentUser = $derived(ndk.$currentUser);
  const blossomEvent = $derived(ndk.$sessions?.getSessionEvent(NDKKind.BlossomList));
  const isReadOnly = $derived(Boolean(ndk.$sessions?.isReadOnly()));
  const avatarDisplayUrl = $derived(avatarPreviewUrl || avatarUrl || '');
  const bannerDisplayUrl = $derived(bannerPreviewUrl || bannerUrl || '');
  const previewName = $derived(cleanText(display) || cleanText(name) || '');
  const canPublish = $derived(!isReadOnly && !saving && !uploadingAvatar && !uploadingBanner);

  const PRIORITY_KIND_OPTIONS = [
    { kind: 1, label: 'Notes' },
    { kind: 30023, label: 'Articles' },
    { kind: 30024, label: 'Drafts' }
  ];

  // ── helpers ────────────────────────────────────────────────────
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

  function clearBannerPreview() {
    if (bannerPreviewUrl) {
      URL.revokeObjectURL(bannerPreviewUrl);
      bannerPreviewUrl = '';
    }
  }

  function seedProfile(profile: NDKUserProfile | undefined) {
    resolvedProfile = profile ? { ...profile } : undefined;
    if (!profileTouched) {
      name = cleanText(profile?.name);
      display = cleanText(profile?.displayName);
      about = cleanText(profile?.about || profile?.bio);
      website = cleanText(profile?.website);
      nip05 = cleanText(profile?.nip05);
      lud16 = cleanText(profile?.lud16);
      avatarUrl = cleanText(profile?.picture || profile?.image);
      bannerUrl = cleanText(profile?.banner);
    }
  }

  function seedNipF1(event: NDKEvent) {
    if (nipF1Touched) return;
    const tags = event.tags;

    backgroundColor = tags.find((t) => t[0] === 'background-color')?.[1] ?? '';
    foregroundColor = tags.find((t) => t[0] === 'foreground-color')?.[1] ?? '';
    backgroundMusic = tags.find((t) => t[0] === 'background-music')?.[1] ?? '';

    const kindsTag = tags.find((t) => t[0] === 'priority_kinds')?.[1];
    priorityKinds = kindsTag
      ? kindsTag.split(',').map(Number).filter((n) => !isNaN(n))
      : [];

    customFields = tags
      .filter((t) => t[0] === 'custom' && t[1] && t[2])
      .map((t) => ({ key: t[1], value: t[2] }));
  }

  function handleAvatarClick() {
    avatarFileInput?.click();
  }

  function handleBannerClick() {
    bannerFileInput?.click();
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

  function handleBannerSelection(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    clearMessages();
    clearBannerPreview();
    bannerFile = file;
    if (file) bannerPreviewUrl = URL.createObjectURL(file);
    profileTouched = true;
  }

  async function uploadFile(file: File): Promise<string | null> {
    const hasCustomValue = Boolean(cleanText(blossomServer));
    const parsedServer = parseBlossomServer(blossomServer) ?? (hasCustomValue ? null : DEFAULT_BLOSSOM_SERVER);
    if (!parsedServer) {
      uploadError = 'Enter a valid storage server URL.';
      return null;
    }

    await ensureClientNdk();
    const { NDKBlossom } = await import('@nostr-dev-kit/blossom');
    const blossom = new NDKBlossom(ndk);
    const descriptor = await blossom.upload(file, { server: parsedServer });
    const uploadedUrl = descriptor.url;
    if (!uploadedUrl) throw new Error("The storage server didn't return a file URL.");

    blossomTouched = true;
    blossomServer = parsedServer;
    return uploadedUrl;
  }

  async function uploadAvatarFile(): Promise<string | null> {
    if (!avatarFile) return avatarUrl || null;
    try {
      clearMessages();
      uploadingAvatar = true;
      const url = await uploadFile(avatarFile);
      if (url) {
        avatarUrl = url;
        avatarFile = null;
        clearAvatarPreview();
        if (avatarFileInput) avatarFileInput.value = '';
      }
      return url;
    } catch (caught) {
      uploadError = caught instanceof Error ? caught.message : "Couldn't upload the avatar.";
      return null;
    } finally {
      uploadingAvatar = false;
    }
  }

  async function uploadBannerFile(): Promise<string | null> {
    if (!bannerFile) return bannerUrl || null;
    try {
      clearMessages();
      uploadingBanner = true;
      const url = await uploadFile(bannerFile);
      if (url) {
        bannerUrl = url;
        bannerFile = null;
        clearBannerPreview();
        if (bannerFileInput) bannerFileInput.value = '';
      }
      return url;
    } catch (caught) {
      uploadError = caught instanceof Error ? caught.message : "Couldn't upload the banner.";
      return null;
    } finally {
      uploadingBanner = false;
    }
  }

  function togglePriorityKind(kind: number) {
    nipF1Touched = true;
    priorityKinds = priorityKinds.includes(kind)
      ? priorityKinds.filter((k) => k !== kind)
      : [...priorityKinds, kind];
  }

  function addCustomField() {
    nipF1Touched = true;
    customFields = [...customFields, { key: '', value: '' }];
  }

  function removeCustomField(index: number) {
    nipF1Touched = true;
    customFields = customFields.filter((_, i) => i !== index);
  }

  // ── publish ────────────────────────────────────────────────────
  async function publish() {
    if (!currentUser || !canPublish) return;

    let nextAvatar = cleanText(avatarUrl);
    let nextBanner = cleanText(bannerUrl);

    if (avatarFile) {
      const url = await uploadAvatarFile();
      if (!url) { saveError = uploadError || 'Avatar upload failed.'; return; }
      nextAvatar = cleanText(url);
    }

    if (bannerFile) {
      const url = await uploadBannerFile();
      if (!url) { saveError = uploadError || 'Banner upload failed.'; return; }
      nextBanner = cleanText(url);
    }

    try {
      clearMessages();
      saving = true;
      await ensureClientNdk();

      // ── kind 0: profile ──────────────────────────────────────
      const previousProfile = currentUser.profile ? { ...currentUser.profile } : undefined;
      const nextProfile: NDKUserProfile = { ...(currentUser.profile ?? {}) };
      nextProfile.name = cleanText(name) || undefined;
      nextProfile.displayName = cleanText(display) || undefined;
      nextProfile.about = cleanText(about) || undefined;
      nextProfile.bio = cleanText(about) || undefined;
      nextProfile.website = cleanText(website) || undefined;
      nextProfile.picture = nextAvatar || undefined;
      nextProfile.image = nextAvatar || undefined;
      nextProfile.banner = nextBanner || undefined;
      nextProfile.nip05 = cleanText(nip05) || undefined;
      nextProfile.lud16 = cleanText(lud16) || undefined;

      currentUser.profile = nextProfile;
      try {
        await currentUser.publish();
      } catch (caught) {
        currentUser.profile = previousProfile;
        throw caught;
      }

      // ── blossom list ─────────────────────────────────────────
      if (blossomTouched) {
        const parsedServer = parseBlossomServer(blossomServer);
        if (parsedServer) {
          const session = ndk.$sessions?.current;
          const nextBlossom =
            blossomEvent instanceof NDKBlossomList
              ? blossomEvent
              : blossomEvent
                ? NDKBlossomList.from(blossomEvent as NDKEvent)
                : new NDKBlossomList(ndk);
          nextBlossom.servers = mergeBlossomServers(parsedServer, nextBlossom.servers);
          nextBlossom.default = parsedServer;
          await nextBlossom.publish();
          session?.events.set(NDKKind.BlossomList, nextBlossom);
        }
      }

      // ── kind 19999: NIP-F1 ───────────────────────────────────
      const nipF1Tags: string[][] = [];
      if (cleanText(backgroundColor)) nipF1Tags.push(['background-color', cleanText(backgroundColor)]);
      if (cleanText(foregroundColor)) nipF1Tags.push(['foreground-color', cleanText(foregroundColor)]);
      if (cleanText(backgroundMusic)) nipF1Tags.push(['background-music', cleanText(backgroundMusic)]);
      if (priorityKinds.length > 0) nipF1Tags.push(['priority_kinds', priorityKinds.join(',')]);
      for (const field of customFields) {
        const k = cleanText(field.key);
        const v = cleanText(field.value);
        if (k && v) nipF1Tags.push(['custom', k, v]);
      }

      if (nipF1Tags.length > 0) {
        const nipF1Event = new NDKEvent(ndk, {
          kind: 19999,
          content: '',
          tags: nipF1Tags
        } as NostrEvent);
        await nipF1Event.publish();
      }

      await goto(`/p/${profileIdentifier(nextProfile, currentUser.npub)}`);
    } catch (caught) {
      saveError = caught instanceof Error ? caught.message : "Couldn't publish your profile.";
    } finally {
      saving = false;
    }
  }

  // ── effects ────────────────────────────────────────────────────
  $effect(() => {
    const pubkey = currentUser?.pubkey ?? null;
    if (activePubkey === pubkey) return;
    activePubkey = pubkey;
    profileTouched = false;
    nipF1Touched = false;
    blossomTouched = false;
    profileLoading = false;
    clearMessages();
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

  // ── fetch NIP-F1 event ─────────────────────────────────────────
  $effect(() => {
    if (!currentUser?.pubkey || nipF1Loading) return;

    const targetPubkey = currentUser.pubkey;
    nipF1Loading = true;

    void ndk.fetchEvent({ kinds: [19999 as NDKKind], authors: [targetPubkey] })
      .then((event) => {
        if (!event || currentUser?.pubkey !== targetPubkey) return;
        seedNipF1(event);
      })
      .catch(() => {})
      .finally(() => {
        if (currentUser?.pubkey === targetPubkey) nipF1Loading = false;
      });
  });

  onDestroy(() => {
    clearAvatarPreview();
    clearBannerPreview();
  });
</script>

{#if !currentUser}
  <section class="profile-container">
    <p class="muted">Log in to edit your profile.</p>
  </section>
{:else}
  <div class="pe-shell">
    <div class="pe-form">
      <h1 class="pe-title">Edit profile</h1>

      <!-- Section: Identity -->
      <div class="pe-section">
        <div class="pe-section-label">Identity</div>

        <div class="pe-banner-zone" role="button" tabindex="0" onclick={handleBannerClick} onkeydown={(e) => e.key === 'Enter' && handleBannerClick()}>
          {#if bannerDisplayUrl}
            <img src={bannerDisplayUrl} alt="Banner" class="pe-banner-img" />
          {:else}
            <div class="pe-banner-placeholder">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span>Upload banner</span>
            </div>
          {/if}
          <input bind:this={bannerFileInput} type="file" accept="image/*" onchange={handleBannerSelection} class="ob-file-input" tabindex="-1" />
        </div>

        <div class="pe-avatar-row">
          <button class="ob-avatar-btn" type="button" onclick={handleAvatarClick} aria-label="Upload avatar">
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
          <input bind:this={avatarFileInput} type="file" accept="image/*" onchange={handleAvatarSelection} class="ob-file-input" tabindex="-1" />

          {#if avatarDisplayUrl}
            <button class="ob-avatar-remove" type="button" onclick={() => {
              avatarUrl = '';
              avatarFile = null;
              clearAvatarPreview();
              if (avatarFileInput) avatarFileInput.value = '';
              profileTouched = true;
            }}>Remove avatar</button>
          {/if}
          {#if bannerDisplayUrl}
            <button class="ob-avatar-remove" type="button" onclick={() => {
              bannerUrl = '';
              bannerFile = null;
              clearBannerPreview();
              if (bannerFileInput) bannerFileInput.value = '';
              profileTouched = true;
            }}>Remove banner</button>
          {/if}
        </div>

        {#if uploadError}
          <p class="ob-error">{uploadError}</p>
        {/if}

        <div class="ob-fields">
          <div class="ob-field-row">
            <label class="ob-field">
              <span>Display name</span>
              <input bind:value={display} oninput={() => { profileTouched = true; }} placeholder="Your full name" />
            </label>
            <label class="ob-field">
              <span>Username</span>
              <input bind:value={name} oninput={() => { profileTouched = true; }} placeholder="username" />
            </label>
          </div>

          <label class="ob-field">
            <span>Bio</span>
            <textarea bind:value={about} oninput={() => { profileTouched = true; }} placeholder="Tell people about yourself" rows="3"></textarea>
          </label>
        </div>
      </div>

      <!-- Section: Links & Verification -->
      <div class="pe-section">
        <div class="pe-section-label">Links & Verification</div>

        <div class="ob-fields">
          <label class="ob-field">
            <span>NIP-05</span>
            <input bind:value={nip05} oninput={() => { profileTouched = true; }} placeholder="you@example.com" />
          </label>

          <label class="ob-field">
            <span>Lightning address</span>
            <input bind:value={lud16} oninput={() => { profileTouched = true; }} placeholder="you@wallet.com" />
          </label>

          <label class="ob-field">
            <span>Website</span>
            <input bind:value={website} oninput={() => { profileTouched = true; }} placeholder="https://yoursite.com" type="url" />
          </label>
        </div>
      </div>

      <!-- Section: Appearance (NIP-F1) -->
      <div class="pe-section">
        <div class="pe-section-label">Appearance</div>

        <div class="ob-fields">
          <div class="ob-field-row">
            <label class="ob-field">
              <span>Background color</span>
              <div class="pe-color-field">
                <input type="color" value={backgroundColor || '#ffffff'} oninput={(e) => { backgroundColor = (e.currentTarget as HTMLInputElement).value; nipF1Touched = true; }} />
                <input type="text" bind:value={backgroundColor} oninput={() => { nipF1Touched = true; }} placeholder="#ffffff" />
              </div>
            </label>
            <label class="ob-field">
              <span>Text color</span>
              <div class="pe-color-field">
                <input type="color" value={foregroundColor || '#000000'} oninput={(e) => { foregroundColor = (e.currentTarget as HTMLInputElement).value; nipF1Touched = true; }} />
                <input type="text" bind:value={foregroundColor} oninput={() => { nipF1Touched = true; }} placeholder="#000000" />
              </div>
            </label>
          </div>

          <label class="ob-field">
            <span>Background music URL</span>
            <input bind:value={backgroundMusic} oninput={() => { nipF1Touched = true; }} placeholder="https://example.com/ambient.mp3" type="url" />
          </label>

          <div class="ob-field">
            <span>Priority kinds</span>
            <div class="pe-kind-checks">
              {#each PRIORITY_KIND_OPTIONS as opt (opt.kind)}
                <label class="pe-kind-check">
                  <input
                    type="checkbox"
                    checked={priorityKinds.includes(opt.kind)}
                    onchange={() => togglePriorityKind(opt.kind)}
                  />
                  <span>{opt.label} <em class="muted">(kind:{opt.kind})</em></span>
                </label>
              {/each}
            </div>
          </div>
        </div>
      </div>

      <!-- Section: Custom Fields (NIP-F1) -->
      <div class="pe-section">
        <div class="pe-section-label">Custom Fields</div>

        <div class="pe-custom-fields">
          {#each customFields as field, index (index)}
            <div class="pe-custom-field-row">
              <input
                type="text"
                placeholder="Key"
                bind:value={field.key}
                oninput={() => { nipF1Touched = true; }}
                class="pe-custom-key-input"
              />
              <input
                type="text"
                placeholder="Value"
                bind:value={field.value}
                oninput={() => { nipF1Touched = true; }}
                class="pe-custom-value-input"
              />
              <button type="button" class="pe-custom-remove" onclick={() => removeCustomField(index)} aria-label="Remove field">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          {/each}
          <button type="button" class="button-secondary" onclick={addCustomField}>
            Add field
          </button>
        </div>
      </div>

      <!-- Sticky footer -->
      <div class="pe-footer">
        {#if saveError}
          <p class="ob-error">{saveError}</p>
        {/if}
        <div class="pe-footer-actions">
          <button class="button" type="button" disabled={!canPublish} onclick={() => void publish()}>
            {saving ? 'Saving…' : uploadingAvatar || uploadingBanner ? 'Uploading…' : 'Save profile'}
          </button>
          <a href="/p/{profileIdentifier(currentUser.profile, currentUser.npub)}" class="button-secondary">
            View profile
          </a>
        </div>
      </div>
    </div>

    <!-- Live Preview -->
    <div class="pe-preview-wrap">
      <button class="pe-preview-toggle" type="button" onclick={() => { previewOpen = !previewOpen; }}>
        {previewOpen ? 'Hide preview' : 'Show preview'}
      </button>
      <div class="pe-preview" class:pe-preview-open={previewOpen}>
        <ProfilePreview
          name={previewName}
          bio={cleanText(about)}
          avatarUrl={avatarDisplayUrl}
          bannerUrl={bannerDisplayUrl}
          nip05={cleanText(nip05)}
          website={cleanText(website)}
          backgroundColor={cleanText(backgroundColor)}
          foregroundColor={cleanText(foregroundColor)}
          customFields={customFields.filter((f) => f.key && f.value)}
        />
      </div>
    </div>
  </div>
{/if}
