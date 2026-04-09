<script lang="ts">
  import { page } from '$app/stores';
  import { nip19 } from 'nostr-tools';
  import { NDKKind } from '@nostr-dev-kit/ndk';
  import { getNDK, fetchKind0Metadata, publishEvent } from '../../../services/nostrService';
  import { getCurrentPubkey } from '$lib/stores/nostr.svelte';
  import { fetchPositions } from '../../../services/positionService';
  import NavHeader from '$lib/components/NavHeader.svelte';
  import { goto } from '$app/navigation';

  interface ProfileData {
    pubkey: string;
    name: string;
    displayName: string;
    about: string;
    picture: string;
    banner: string;
    website: string;
    nip05: string;
  }

  interface Market {
    eventId: string;
    slug: string;
    title: string;
    description: string;
    createdAt: number;
  }

  interface Position {
    id: string;
    marketTitle: string;
    direction: 'yes' | 'no';
    amount: number;
    createdAt: number;
  }

  let normalizedPubkey = $state<string | null>(null);
  let profile = $state<ProfileData | null>(null);
  let markets = $state<Market[]>([]);
  let positions = $state<Position[]>([]);
  let activeTab = $state<'markets' | 'positions'>('markets');

  // Edit profile state
  let showEditForm = $state(false);
  let editName = $state('');
  let editDisplayName = $state('');
  let editAbout = $state('');
  let editPicture = $state('');
  let editWebsite = $state('');
  let editNip05 = $state('');
  let saveStatus = $state<'idle' | 'saving' | 'saved' | 'error'>('idle');

  let currentUserPubkey = $derived(getCurrentPubkey());
  let isOwnProfile = $derived(normalizedPubkey !== null && normalizedPubkey === currentUserPubkey);

  // Normalize pubkey: accept both npub and hex
  $effect(() => {
    const routePubkey = $page.params.pubkey;
    if (!routePubkey) {
      normalizedPubkey = null;
      return;
    }

    let hex = routePubkey;
    if (routePubkey.startsWith('npub1')) {
      try {
        const decoded = nip19.decode(routePubkey);
        if (decoded.type === 'npub') {
          hex = decoded.data as string;
        } else {
          console.error('Invalid npub type');
          normalizedPubkey = null;
          return;
        }
      } catch {
        console.error('Invalid npub format');
        normalizedPubkey = null;
        return;
      }
    }
    normalizedPubkey = hex;
  });

  // Fetch kind 0 metadata
  $effect(() => {
    if (!normalizedPubkey) return;
    const ndk = getNDK();
    if (!ndk) return;

    fetchKind0Metadata(ndk, normalizedPubkey).then((metadata) => {
      if (metadata) {
        profile = {
          pubkey: normalizedPubkey!,
          name: metadata.name || '',
          displayName: metadata.displayName || '',
          about: metadata.about || '',
          picture: metadata.picture || '',
          banner: metadata.banner || '',
          website: metadata.website || '',
          nip05: metadata.nip05 || '',
        };
      } else {
        profile = {
          pubkey: normalizedPubkey!,
          name: '',
          displayName: '',
          about: '',
          picture: '',
          banner: '',
          website: '',
          nip05: '',
        };
      }
    });
  });

  // Fetch kind 982 markets (authored by this user)
  $effect(() => {
    if (!normalizedPubkey) return;
    const ndk = getNDK();
    if (!ndk) return;

    ndk
      .fetchEvents({
        kinds: [982 as NDKKind],
        authors: [normalizedPubkey],
      })
      .then((events) => {
        const marketList = Array.from(events)
          .filter((event) => event.id != null)
          .map((event) => {
            const slug = event.getMatchingTags('d')[0]?.[1] ?? '';
            const title = event.getMatchingTags('title')[0]?.[1] ?? 'Untitled Market';
            const description = event.getMatchingTags('description')[0]?.[1] ?? '';
            return {
              eventId: event.id as string,
              slug,
              title,
              description,
              createdAt: event.created_at ?? Date.now() / 1000,
            };
          });
        markets = marketList.sort((a, b) => b.createdAt - a.createdAt);
      })
      .catch((error) => {
        console.error('Error fetching markets:', error);
        markets = [];
      });
  });

  // Fetch kind 30078 positions
  $effect(() => {
    if (!normalizedPubkey) return;
    const ndk = getNDK();
    if (!ndk) return;

    fetchPositions(ndk, normalizedPubkey)
      .then((fetchedPositions) => {
        positions = fetchedPositions.map((pos) => ({
          id: pos.id,
          marketTitle: pos.marketTitle || 'Unknown Market',
          direction: pos.direction,
          amount: pos.quantity,
          createdAt: pos.timestamp,
        }));
      })
      .catch((error) => {
        console.error('Error fetching positions:', error);
        positions = [];
      });
  });

  function navigateToMarket(slug: string) {
    goto(`/mkt/${slug}`);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }

  function displayedName(): string {
    if (!profile) return normalizedPubkey?.slice(0, 8) ?? '...';
    return profile.displayName || profile.name || (normalizedPubkey?.slice(0, 8) ?? '...');
  }

  function openEditForm() {
    if (!profile) return;
    editDisplayName = profile.displayName;
    editName = profile.name;
    editAbout = profile.about;
    editPicture = profile.picture;
    editWebsite = profile.website;
    editNip05 = profile.nip05;
    saveStatus = 'idle';
    showEditForm = true;
  }

  async function saveProfile() {
    saveStatus = 'saving';
    try {
      const metadata: Record<string, string> = {};
      if (editDisplayName) metadata.display_name = editDisplayName;
      if (editName) metadata.name = editName;
      if (editAbout) metadata.about = editAbout;
      if (editPicture) metadata.picture = editPicture;
      if (editWebsite) metadata.website = editWebsite;
      if (editNip05) metadata.nip05 = editNip05;

      await publishEvent(JSON.stringify(metadata), [], 0);

      // Update local profile state
      profile = {
        pubkey: normalizedPubkey!,
        displayName: editDisplayName,
        name: editName,
        about: editAbout,
        picture: editPicture,
        banner: profile?.banner ?? '',
        website: editWebsite,
        nip05: editNip05,
      };

      saveStatus = 'saved';
      setTimeout(() => {
        saveStatus = 'idle';
        showEditForm = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to publish profile:', err);
      saveStatus = 'error';
    }
  }
</script>

<svelte:head>
  {#if profile}
    <title>{displayedName()} on Cascade</title>
    <meta name="description" content="{displayedName()} is trading prediction markets on Cascade.{profile.about ? ' ' + profile.about.slice(0, 100) : ''}" />

    <!-- Open Graph -->
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Cascade" />
    <meta property="og:title" content="{displayedName()} on Cascade" />
    <meta property="og:description" content="{profile.about?.slice(0, 155) || displayedName() + ' is trading predictions on Cascade.'}" />
    {#if profile.picture}
      <meta property="og:image" content={profile.picture} />
    {:else}
      <meta property="og:image" content="https://cascade.markets/og/profile.svg" />
    {/if}
    <meta property="og:url" content="https://cascade.markets/profile/{$page.params.pubkey}" />

    <!-- Twitter/X -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:site" content="@cascademarkets" />
    <meta name="twitter:title" content="{displayedName()} on Cascade" />
    <meta name="twitter:description" content="{profile.about?.slice(0, 155) || 'Trading predictions on Cascade.'}" />
    {#if profile.picture}
      <meta name="twitter:image" content={profile.picture} />
    {:else}
      <meta name="twitter:image" content="https://cascade.markets/og/profile.svg" />
    {/if}
  {:else}
    <title>Profile | Cascade</title>
    <meta name="twitter:card" content="summary" />
  {/if}
</svelte:head>

<div class="max-w-4xl mx-auto">
  <NavHeader />

  <!-- Banner & Avatar -->
  <div class="relative h-32 bg-neutral-900">
    {#if profile?.banner}
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url({profile.banner})"></div>
      <div class="absolute inset-0 bg-neutral-950/50"></div>
    {/if}
    {#if profile?.picture}
      <div class="absolute -bottom-8 left-6 w-16 h-16 rounded-full overflow-hidden border-2 border-neutral-950">
        <img src={profile.picture} alt={displayedName()} class="w-full h-full object-cover" />
      </div>
    {:else}
      <div class="absolute -bottom-8 left-6 w-16 h-16 rounded-full bg-neutral-800 border-2 border-neutral-950 flex items-center justify-center">
        <span class="text-xl text-neutral-400">{displayedName()[0] ?? '?'}</span>
      </div>
    {/if}
  </div>

  <!-- Profile Header -->
  <div class="bg-neutral-950 px-6 pt-10 pb-6">
    <div class="flex justify-between items-start">
      <div>
        <h1 class="text-xl font-sans text-white">
          {displayedName()}
        </h1>
        {#if profile?.displayName && profile?.name && profile.displayName !== profile.name}
          <p class="text-neutral-500 text-sm">@{profile.name}</p>
        {/if}
        {#if profile?.about}
          <p class="text-neutral-400 mt-2 max-w-prose">{profile.about.length > 200 ? profile.about.slice(0, 200) + '…' : profile.about}</p>
        {/if}
        {#if profile?.website}
          <a href={profile.website} target="_blank" rel="noopener noreferrer" class="text-emerald-400 hover:underline mt-2 block text-sm">
            {profile.website}
          </a>
        {/if}
        {#if profile?.nip05}
          <p class="text-neutral-500 text-sm mt-1">{profile.nip05}</p>
        {/if}
      </div>

      {#if isOwnProfile}
        <button
          type="button"
          onclick={openEditForm}
          class="text-sm px-3 py-1.5 border border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:text-white transition-colors"
        >
          Edit profile
        </button>
      {/if}
    </div>
  </div>

  <!-- Edit Profile Form (own profile only) -->
  {#if showEditForm}
    <div class="bg-neutral-900 border-b border-neutral-800 px-6 py-6">
      <h2 class="text-sm font-medium text-white mb-4">Edit Profile</h2>
      <div class="space-y-3 max-w-lg">
        <div>
          <label class="block text-xs text-neutral-500 mb-1" for="edit-display-name">Display name</label>
          <input
            id="edit-display-name"
            type="text"
            bind:value={editDisplayName}
            placeholder="Your display name"
            class="w-full bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label class="block text-xs text-neutral-500 mb-1" for="edit-name">Username</label>
          <input
            id="edit-name"
            type="text"
            bind:value={editName}
            placeholder="username"
            class="w-full bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label class="block text-xs text-neutral-500 mb-1" for="edit-about">About</label>
          <textarea
            id="edit-about"
            bind:value={editAbout}
            placeholder="Tell people about yourself"
            rows="3"
            class="w-full bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500 resize-none"
          ></textarea>
        </div>
        <div>
          <label class="block text-xs text-neutral-500 mb-1" for="edit-picture">Avatar URL</label>
          <input
            id="edit-picture"
            type="url"
            bind:value={editPicture}
            placeholder="https://..."
            class="w-full bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label class="block text-xs text-neutral-500 mb-1" for="edit-website">Website</label>
          <input
            id="edit-website"
            type="url"
            bind:value={editWebsite}
            placeholder="https://..."
            class="w-full bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div>
          <label class="block text-xs text-neutral-500 mb-1" for="edit-nip05">NIP-05</label>
          <input
            id="edit-nip05"
            type="text"
            bind:value={editNip05}
            placeholder="you@yourdomain.com"
            class="w-full bg-neutral-800 border border-neutral-700 text-white text-sm px-3 py-2 focus:outline-none focus:border-neutral-500"
          />
        </div>
        <div class="flex items-center gap-3 pt-1">
          <button
            type="button"
            onclick={saveProfile}
            disabled={saveStatus === 'saving'}
            class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onclick={() => { showEditForm = false; saveStatus = 'idle'; }}
            class="px-4 py-2 text-neutral-400 hover:text-white text-sm transition-colors"
          >
            Cancel
          </button>
          {#if saveStatus === 'saved'}
            <span class="text-emerald-400 text-sm">Profile updated</span>
          {:else if saveStatus === 'error'}
            <span class="text-rose-400 text-sm">Failed to save — check your signer</span>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- Credibility Strip -->
  <div class="grid gap-4 border-b border-neutral-800 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
    <div>
      <p class="text-[11px] text-neutral-500">Markets</p>
      <p class="text-lg font-semibold text-white mt-1">{markets.length}</p>
    </div>
    <div>
      <p class="text-[11px] text-neutral-500">Positions</p>
      <p class="text-lg font-semibold text-white mt-1">{positions.length}</p>
    </div>
    <div>
      <p class="text-[11px] text-neutral-500">Followers</p>
      <p class="text-lg font-semibold text-white mt-1">—</p>
    </div>
    <div>
      <p class="text-[11px] text-neutral-500">Following</p>
      <p class="text-lg font-semibold text-white mt-1">—</p>
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 border-b border-neutral-800">
    <button
      type="button"
      onclick={() => activeTab = 'markets'}
      class="py-4 px-1 text-sm font-medium {activeTab === 'markets'
        ? '-mb-px border-b-2 border-white text-white'
        : 'text-neutral-500 hover:text-neutral-300'}"
    >
      Markets
    </button>
    <button
      type="button"
      onclick={() => activeTab = 'positions'}
      class="py-4 px-1 text-sm font-medium {activeTab === 'positions'
        ? '-mb-px border-b-2 border-white text-white'
        : 'text-neutral-500 hover:text-neutral-300'}"
    >
      Positions
    </button>
  </div>

  <!-- Tab Content -->
  <div class="px-6 py-8">
    {#if activeTab === 'markets'}
      {#if markets.length === 0}
        <p class="text-center text-neutral-400 py-12">No markets created yet</p>
      {:else}
        <div class="space-y-4">
          {#each markets as market (market.eventId)}
            <div class="border-b border-neutral-800 pb-4">
              <button
                type="button"
                onclick={() => navigateToMarket(market.slug)}
                class="w-full text-left"
              >
                <h3 class="font-semibold text-white">{market.title}</h3>
                {#if market.description}
                  <p class="text-neutral-400 text-sm mt-1">{market.description}</p>
                {/if}
                <p class="text-neutral-500 text-xs mt-2">Created {formatDate(market.createdAt)}</p>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {:else}
      {#if positions.length === 0}
        <p class="text-center text-neutral-400 py-12">No open positions</p>
      {:else}
        <div class="space-y-4">
          {#each positions as position (position.id)}
            <div class="border-b border-neutral-800 pb-4 flex items-start justify-between">
              <div>
                <p class="text-neutral-300">{position.marketTitle}</p>
                <p class="text-neutral-500 text-xs mt-2">{formatDate(position.createdAt)}</p>
              </div>
              <div class="flex items-center gap-3 ml-4">
                <span class="text-sm font-medium text-neutral-300">{position.amount}</span>
                <span class="text-xs font-semibold px-2 py-0.5 {position.direction === 'yes' ? 'bg-emerald-900/60 text-emerald-400' : 'bg-rose-900/60 text-rose-400'}">
                  {position.direction === 'yes' ? 'LONG' : 'SHORT'}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
  </div>
</div>
