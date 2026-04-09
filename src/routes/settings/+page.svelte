<script lang="ts">
  import { onMount } from 'svelte';
  import {
    loadHumanProfile,
    saveHumanProfile,
    publishHumanProfile,
    type HumanProfile,
  } from '$lib/profileStore';
  import { nostrStore } from '$lib/stores/nostr';
  import NavHeader from '$lib/components/NavHeader.svelte';
  import { getNDK } from '../../services/nostrService';
  import { loadStoredKeys } from '../../nostrKeys';
  import { NDKRelayStatus } from '@nostr-dev-kit/ndk';

  // ── Constants ─────────────────────────────────────────────────────────────────
  const DEFAULT_RELAYS = ['wss://relay.damus.io', 'wss://relay.nostr.band', 'wss://nos.lol'];

  // ── State ────────────────────────────────────────────────────────────────────
  let displayName = $state('');
  let headline = $state('');
  let bio = $state('');
  let avatarUrl = $state('');
  let isSaving = $state(false);
  let isPublishing = $state(false);
  let saveMessage = $state<{ type: 'success' | 'error'; text: string } | null>(null);
  let pubkey = $state<string | null>(null);
  let npub = $state<string | null>(null);

  // Relay configuration state
  let relayUrls = $state<string[]>([]);
  let newRelayUrl = $state('');
  let relayError = $state('');

  // Notification preferences state
  let notifMarketTrades = $state(false);
  let notifPositionChanges = $state(false);
  let notifLargeTrades = $state(false);
  let notifLargeTradesThreshold = $state(10000);
  let notifDiscussionReplies = $state(false);
  let notifMarketMilestones = $state(false);

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
    }

    // Subscribe to Nostr store for pubkey
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
    });

    // Load npub from stored keys
    const keys = loadStoredKeys();
    if (keys) {
      npub = keys.npub;
    }

    // Load relay configuration from localStorage
    const savedRelays = localStorage.getItem('cascade-relays');
    if (savedRelays) {
      try {
        const parsed = JSON.parse(savedRelays);
        relayUrls = Array.isArray(parsed) && parsed.length > 0 ? parsed : [...DEFAULT_RELAYS];
      } catch {
        relayUrls = [...DEFAULT_RELAYS];
      }
    } else {
      relayUrls = [...DEFAULT_RELAYS];
    }

    // Load notification preferences
    notifMarketTrades = localStorage.getItem('notif:market_trades') === 'true';
    notifPositionChanges = localStorage.getItem('notif:position_changes') === 'true';
    notifLargeTrades = localStorage.getItem('notif:large_trades') === 'true';
    const threshold = localStorage.getItem('notif:large_trades_threshold');
    notifLargeTradesThreshold = threshold ? parseInt(threshold, 10) : 10000;
    notifDiscussionReplies = localStorage.getItem('notif:discussion_replies') === 'true';
    notifMarketMilestones = localStorage.getItem('notif:market_milestones') === 'true';

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
    relayError = '';
    if (!url) return;
    if (!url.startsWith('wss://') && !url.startsWith('ws://')) {
      relayError = 'Relay URL must start with wss://';
      return;
    }
    if (relayUrls.includes(url)) {
      relayError = 'Relay already in list';
      return;
    }
    relayUrls = [...relayUrls, url];
    localStorage.setItem('cascade-relays', JSON.stringify(relayUrls));
    const ndk = getNDK();
    if (ndk) {
      ndk.addExplicitRelay(url, undefined, true);
    }
    newRelayUrl = '';
  }

  function handleRemoveRelay(url: string) {
    relayUrls = relayUrls.filter((r) => r !== url);
    localStorage.setItem('cascade-relays', JSON.stringify(relayUrls));
    const ndk = getNDK();
    if (ndk) {
      ndk.pool.removeRelay(url);
    }
  }

  function handleRelayKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      handleAddRelay();
    }
  }

  function getRelayStatus(url: string): 'connected' | 'disconnected' {
    const ndk = getNDK();
    if (!ndk) return 'disconnected';
    const relay = ndk.pool.relays.get(url);
    if (!relay) return 'disconnected';
    return relay.status === NDKRelayStatus.CONNECTED || relay.status === NDKRelayStatus.AUTHENTICATED
      ? 'connected'
      : 'disconnected';
  }

  function setNotif(key: string, value: boolean) {
    localStorage.setItem(key, String(value));
  }

  function setNotifThreshold(value: number) {
    notifLargeTradesThreshold = value;
    localStorage.setItem('notif:large_trades_threshold', String(value));
  }

  let copiedAccountId = $state(false);
  let copiedNpub = $state(false);

  async function copyAccountId() {
    if (!pubkey) return;
    await navigator.clipboard.writeText(pubkey);
    copiedAccountId = true;
    setTimeout(() => { copiedAccountId = false; }, 2000);
  }

  async function copyNpub() {
    if (!npub) return;
    await navigator.clipboard.writeText(npub);
    copiedNpub = true;
    setTimeout(() => { copiedNpub = false; }, 2000);
  }
</script>

<svelte:head>
  <title>Settings — Cascade</title>
</svelte:head>

<main class="min-h-[calc(100vh-80px)] bg-neutral-950 text-white">
  <NavHeader />
  <div class="max-w-2xl mx-auto px-6 py-12">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl">Settings</h1>
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
            class="w-16 h-16 object-cover border border-neutral-700"
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
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
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
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
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
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors resize-none"
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
            class="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
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

    <!-- Relay Configuration Section -->
    <section class="space-y-4 mb-12">
      <h2 class="text-lg font-medium border-b border-neutral-800 pb-3">Relays</h2>

      <div class="space-y-1.5">
        {#each relayUrls as url}
          <div class="flex items-center justify-between px-3 py-2 bg-neutral-900 border border-neutral-800">
            <div class="flex items-center gap-2.5 min-w-0">
              <span
                class="w-2 h-2 rounded-full flex-shrink-0 {getRelayStatus(url) === 'connected'
                  ? 'bg-emerald-500'
                  : 'bg-neutral-600'}"
              ></span>
              <span class="text-sm text-neutral-300 font-mono truncate">{url}</span>
            </div>
            <button
              type="button"
              onclick={() => handleRemoveRelay(url)}
              class="ml-4 text-xs text-neutral-500 hover:text-rose-400 transition-colors flex-shrink-0"
            >
              Remove
            </button>
          </div>
        {/each}
      </div>

      <!-- Add relay input -->
      <div class="flex gap-2">
        <input
          type="text"
          bind:value={newRelayUrl}
          onkeydown={handleRelayKeydown}
          placeholder="wss://relay.example.com"
          class="flex-1 px-3 py-2 bg-neutral-900 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors text-sm font-mono"
        />
        <button
          type="button"
          onclick={handleAddRelay}
          class="px-4 py-2 text-sm font-medium bg-white text-neutral-950 hover:bg-neutral-200 transition-colors"
        >
          Add
        </button>
      </div>
      {#if relayError}
        <p class="text-sm text-rose-400">{relayError}</p>
      {/if}
    </section>

    <!-- Notification Preferences Section -->
    <section class="space-y-1 mb-12">
      <h2 class="text-lg font-medium border-b border-neutral-800 pb-3 mb-4">Notifications</h2>

      <!-- New trades on my markets -->
      <div class="flex items-center justify-between py-2.5">
        <span class="text-sm text-neutral-300">New trades on my markets</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={notifMarketTrades}
            onchange={() => setNotif('notif:market_trades', notifMarketTrades)}
            class="sr-only peer"
          />
          <div class="w-9 h-5 rounded-full peer bg-neutral-700 peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
        </label>
      </div>

      <!-- Position changes -->
      <div class="flex items-center justify-between py-2.5">
        <span class="text-sm text-neutral-300">Position changes</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={notifPositionChanges}
            onchange={() => setNotif('notif:position_changes', notifPositionChanges)}
            class="sr-only peer"
          />
          <div class="w-9 h-5 rounded-full peer bg-neutral-700 peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
        </label>
      </div>

      <!-- Large trades -->
      <div class="flex items-center justify-between py-2.5">
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-sm text-neutral-300">Large trades</span>
          {#if notifLargeTrades}
            <div class="flex items-center gap-1.5">
              <input
                type="number"
                value={notifLargeTradesThreshold}
                min="1"
                oninput={(e) => setNotifThreshold(parseInt((e.target as HTMLInputElement).value, 10) || 10000)}
                class="w-24 px-2 py-0.5 bg-neutral-900 border border-neutral-700 text-white text-sm focus:outline-none focus:border-neutral-500 transition-colors"
              />
              <span class="text-xs text-neutral-500">sats</span>
            </div>
          {/if}
        </div>
        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0 ml-4">
          <input
            type="checkbox"
            bind:checked={notifLargeTrades}
            onchange={() => setNotif('notif:large_trades', notifLargeTrades)}
            class="sr-only peer"
          />
          <div class="w-9 h-5 rounded-full peer bg-neutral-700 peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
        </label>
      </div>

      <!-- New discussion replies -->
      <div class="flex items-center justify-between py-2.5">
        <span class="text-sm text-neutral-300">New discussion replies</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={notifDiscussionReplies}
            onchange={() => setNotif('notif:discussion_replies', notifDiscussionReplies)}
            class="sr-only peer"
          />
          <div class="w-9 h-5 rounded-full peer bg-neutral-700 peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
        </label>
      </div>

      <!-- Market milestones -->
      <div class="flex items-center justify-between py-2.5">
        <span class="text-sm text-neutral-300">Market milestones</span>
        <label class="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            bind:checked={notifMarketMilestones}
            onchange={() => setNotif('notif:market_milestones', notifMarketMilestones)}
            class="sr-only peer"
          />
          <div class="w-9 h-5 rounded-full peer bg-neutral-700 peer-checked:bg-emerald-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4"></div>
        </label>
      </div>
    </section>

    <!-- Account Display -->
    {#if npub || pubkey}
      <section class="mt-12 pt-8 border-t border-neutral-800">
        <h2 class="text-lg font-medium mb-4">Your Account</h2>

        {#if npub}
          <div class="mb-3">
            <p class="text-xs text-neutral-500 mb-1.5">Your public key (npub)</p>
            <div class="flex items-center justify-between px-3 py-2 bg-neutral-900 border border-neutral-700">
              <span class="text-xs text-neutral-300 font-mono truncate">{npub}</span>
              <button
                onclick={copyNpub}
                class="ml-4 text-xs text-neutral-400 hover:text-white transition-colors flex-shrink-0"
              >
                {copiedNpub ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        {/if}

        {#if pubkey}
          <div>
            <p class="text-xs text-neutral-500 mb-1.5">Account ID (hex)</p>
            <div class="flex items-center justify-between px-3 py-2 bg-neutral-900 border border-neutral-700">
              <span class="text-xs text-neutral-500 font-mono truncate">{pubkey}</span>
              <button
                onclick={copyAccountId}
                class="ml-4 text-xs text-neutral-400 hover:text-white transition-colors flex-shrink-0"
              >
                {copiedAccountId ? '✓ Copied' : 'Copy'}
              </button>
            </div>
          </div>
        {/if}
      </section>
    {/if}
  </div>
</main>
