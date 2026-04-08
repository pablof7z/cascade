<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadHumanProfile,
    saveHumanProfile,
    publishHumanProfile,
    type HumanProfile,
  } from '$lib/profileStore';
  import { nostrStore } from '$lib/stores/nostr';

  // ── State ────────────────────────────────────────────────────────────────────
  let displayName = $state('');
  let headline = $state('');
  let bio = $state('');
  let avatarUrl = $state('');
  let isSaving = $state(false);
  let isPublishing = $state(false);
  let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  let pubkey = $state<string | null>(null);

  // Relay configuration state
  let relayUrls = $state<string[]>([]);
  let newRelayUrl = $state('');

  // ── Derived ────────────────────────────────────────────────────────────────────
  let hasUnsavedChanges = $derived(
    displayName !== '' || headline !== '' || bio !== '' || avatarUrl !== ''
  );

  // ── Effects ────────────────────────────────────────────────────────────────────
  onMount(() => {
    // Load profile from store
    const profile = loadHumanProfile();
    if (profile) {
      displayName = profile.displayName;
      headline = profile.headline;
      bio = profile.bio;
      // Extract avatar from bio if it's an image URL
      if (profile.bio.startsWith('https://')) {
        // Simple heuristic - check if bio contains an image URL
      }
    }

    // Subscribe to Nostr store for pubkey
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
    });

    // Load relay configuration from localStorage
    const savedRelays = localStorage.getItem('cascade-relays');
    if (savedRelays) {
      try {
        relayUrls = JSON.parse(savedRelays);
      } catch {
        relayUrls = [];
      }
    }

    return unsubscribe;
  });

  // ── Functions ────────────────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    isSaving = true;
    saveMessage = null;

    try {
      const profile: HumanProfile = {
        displayName,
        headline,
        bio,
        focusAreas: ['AI & Compute'], // Keep existing or update
        cadence: 'Several times a week',
        participationModes: ['Trade mispricings', 'Seed fresh markets'],
        edge: '',
        agentBrief: '',
        updatedAt: '',
      };

      saveHumanProfile(profile);
      saveMessage = { type: 'success', text: 'Profile saved successfully' };

      // Clear message after 3 seconds
      setTimeout(() => {
        saveMessage = null;
      }, 3000);
    } catch (error) {
      saveMessage = { type: 'error', text: 'Failed to save profile' };
    } finally {
      isSaving = false;
    }
  }

  async function handlePublishProfile() {
    isPublishing = true;
    saveMessage = null;

    try {
      const profile: HumanProfile = {
        displayName,
        headline,
        bio,
        focusAreas: ['AI & Compute'],
        cadence: 'Several times a week',
        participationModes: ['Trade mispricings', 'Seed fresh markets'],
        edge: '',
        agentBrief: '',
        updatedAt: '',
      };

      // Save first
      saveHumanProfile(profile);
      // Then publish to Nostr
      await publishHumanProfile(profile);
      saveMessage = { type: 'success', text: 'Profile published' };

      setTimeout(() => {
        saveMessage = null;
      }, 3000);
    } catch (error) {
      saveMessage = { type: 'error', text: 'Failed to publish profile' };
    } finally {
      isPublishing = false;
    }
  }

  function handleAddRelay() {
    const url = newRelayUrl.trim();
    if (url && !relayUrls.includes(url)) {
      relayUrls = [...relayUrls, url];
      localStorage.setItem('cascade-relays', JSON.stringify(relayUrls));
      newRelayUrl = '';
    }
  }

  function handleRemoveRelay(url: string) {
    relayUrls = relayUrls.filter((r) => r !== url);
    localStorage.setItem('cascade-relays', JSON.stringify(relayUrls));
  }

  function handleRelayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddRelay();
    }
  }
</script>

<svelte:head>
  <title>Settings — Cascade</title>
</svelte:head>

<main class="min-h-[calc(100vh-80px)] bg-neutral-950 text-white">
  <div class="max-w-2xl mx-auto px-6 py-12">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl font-semibold">Settings</h1>
      <p class="text-neutral-400 mt-1">Manage your profile and preferences</p>
    </div>

    <!-- Profile Section -->
    <section class="space-y-6 mb-12">
      <h2 class="text-lg font-medium border-b border-neutral-800 pb-3">Profile</h2>

      <!-- Avatar Preview -->
      {#if avatarUrl}
        <div class="flex items-center gap-4">
          <img
            src={avatarUrl}
            alt="Profile avatar"
            class="w-16 h-16 rounded-full object-cover border border-neutral-700"
            onerror={() => (avatarUrl = '')}
          />
          <button
            type="button"
            onclick={() => (avatarUrl = '')}
            class="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Remove
          </button>
        </div>
      {/if}

      <div class="space-y-4">
        <!-- Display Name -->
        <div>
          <label for="displayName" class="block text-sm font-medium text-neutral-300 mb-1.5">
            Display Name
          </label>
          <input
            id="displayName"
            type="text"
            bind:value={displayName}
            placeholder="Your name"
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        <!-- Headline -->
        <div>
          <label for="headline" class="block text-sm font-medium text-neutral-300 mb-1.5">
            Headline
          </label>
          <input
            id="headline"
            type="text"
            bind:value={headline}
            placeholder="A brief description of yourself"
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        <!-- Bio -->
        <div>
          <label for="bio" class="block text-sm font-medium text-neutral-300 mb-1.5">
            Bio
          </label>
          <textarea
            id="bio"
            bind:value={bio}
            placeholder="Tell us about yourself"
            rows="4"
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors resize-none"
          ></textarea>
        </div>

        <!-- Avatar URL -->
        <div>
          <label for="avatarUrl" class="block text-sm font-medium text-neutral-300 mb-1.5">
            Avatar URL
          </label>
          <input
            id="avatarUrl"
            type="url"
            bind:value={avatarUrl}
            placeholder="https://example.com/avatar.jpg"
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
          />
        </div>

        <!-- Save Actions -->
        <div class="flex items-center gap-3 pt-2">
          <button
            type="button"
            onclick={handleSaveProfile}
            disabled={isSaving}
            class="px-4 py-2 text-sm font-medium bg-white text-neutral-950 hover:bg-neutral-200 disabled:bg-neutral-600 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>

          <button
            type="button"
            onclick={handlePublishProfile}
            disabled={isPublishing || !pubkey}
            class="px-4 py-2 text-sm font-medium text-white border border-neutral-600 hover:border-neutral-400 disabled:border-neutral-800 disabled:text-neutral-600 disabled:cursor-not-allowed transition-colors"
          >
            {isPublishing ? 'Publishing...' : 'Update Profile'}
          </button>

          {#if !pubkey}
            <span class="text-xs text-neutral-500">Sign in to publish</span>
          {/if}
        </div>

        <!-- Status Message -->
        {#if saveMessage}
          <p
            class="text-sm {saveMessage.type === 'success'
              ? 'text-emerald-400'
              : 'text-rose-400'}"
          >
            {saveMessage.text}
          </p>
        {/if}
      </div>
    </section>

    <!-- Account Display -->
    {#if pubkey}
      <section class="mt-12 pt-8 border-t border-neutral-800">
        <h2 class="text-lg font-medium mb-4">Your Account</h2>
        <div class="px-3 py-2 bg-neutral-900 border border-neutral-700 rounded">
          <code class="text-sm font-mono text-emerald-400">{pubkey.slice(0, 8)}...{pubkey.slice(-4)}</code>
        </div>
      </section>
    {/if}
  </div>
</main>
