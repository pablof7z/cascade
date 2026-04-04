<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { nip19 } from 'nostr-tools';
  import { NDKKind } from '@nostr-dev-kit/ndk';
  import { getNDK, fetchKind0Metadata } from '../../../services/nostrService';
  import { fetchPositions } from '../../../services/positionService';

  interface ProfileData {
    pubkey: string;
    name: string;
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
    side: 'yes' | 'no';
    amount: number;
    createdAt: number;
    resolved: boolean;
  }

  let normalizedPubkey = $state<string | null>(null);
  let profile = $state<ProfileData | null>(null);
  let markets = $state<Market[]>([]);
  let positions = $state<Position[]>([]);
  let loadingMarkets = $state(true);
  let loadingPositions = $state(true);
  let loadingProfile = $state(true);

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

    setLoadingProfile(true);
    fetchKind0Metadata(ndk, normalizedPubkey).then((metadata) => {
      if (metadata) {
        profile = {
          pubkey: normalizedPubkey,
          name: metadata.name || 'Unknown',
          about: metadata.about || '',
          picture: metadata.picture || '',
          banner: metadata.banner || '',
          website: metadata.website || '',
          nip05: metadata.nip05 || '',
        };
      } else {
        profile = {
          pubkey: normalizedPubkey,
          name: 'Unknown',
          about: '',
          picture: '',
          banner: '',
          website: '',
          nip05: '',
        };
      }
      setLoadingProfile(false);
    });
  });

  // Fetch kind 982 markets (authored by this user)
  $effect(() => {
    if (!normalizedPubkey) return;
    const ndk = getNDK();
    if (!ndk) return;

    setLoadingMarkets(true);
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
        setLoadingMarkets(false);
      })
      .catch((error) => {
        console.error('Error fetching markets:', error);
        markets = [];
        setLoadingMarkets(false);
      });
  });

  // Fetch kind 30078 positions
  $effect(() => {
    if (!normalizedPubkey) return;
    const ndk = getNDK();
    if (!ndk) return;

    setLoadingPositions(true);
    fetchPositions(ndk, normalizedPubkey)
      .then((fetchedPositions) => {
        const positionList = fetchedPositions.map((pos) => ({
          id: pos.id,
          marketTitle: pos.marketTitle || 'Unknown Market',
          side: pos.direction,
          amount: pos.quantity,
          createdAt: pos.timestamp,
          resolved: false,
        }));
        positions = positionList;
        setLoadingPositions(false);
      })
      .catch((error) => {
        console.error('Error fetching positions:', error);
        positions = [];
        setLoadingPositions(false);
      });
  });

  function setLoadingProfile(val: boolean) {
    loadingProfile = val;
  }
  function setLoadingMarkets(val: boolean) {
    loadingMarkets = val;
  }
  function setLoadingPositions(val: boolean) {
    loadingPositions = val;
  }

  function navigateToMarket(slug: string) {
    goto(`/market/${slug}`);
  }

  function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleDateString();
  }
</script>

<div class="max-w-4xl mx-auto">
  <!-- Banner & Avatar -->
  <div class="relative h-32 bg-neutral-900">
    {#if profile?.banner}
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url({profile.banner})"></div>
      <div class="absolute inset-0 bg-neutral-950/50"></div>
    {/if}
    {#if profile?.picture}
      <div class="absolute -bottom-8 left-6 w-16 h-16 rounded-sm overflow-hidden border-2 border-neutral-950">
        <img src={profile.picture} alt={profile.name} class="w-full h-full object-cover" />
      </div>
    {:else}
      <div class="absolute -bottom-8 left-6 w-16 h-16 rounded-sm bg-neutral-800 border-2 border-neutral-950 flex items-center justify-center">
        <span class="text-xl text-neutral-400">{profile?.name?.[0] ?? '?'}</span>
      </div>
    {/if}
  </div>

  <!-- Profile Header -->
  <div class="bg-neutral-950 px-6 pt-10 pb-6">
    <div class="flex justify-between items-start">
      <div>
        <h1 class="text-xl font-sans text-white">
          {loadingProfile ? 'Loading...' : profile?.name ?? 'Unknown'}
        </h1>
        {#if profile?.about}
          <p class="text-neutral-400 mt-2">{profile.about}</p>
        {/if}
        {#if profile?.website}
          <a href={profile.website} class="text-emerald-400 hover:underline mt-2 block text-sm">
            {profile.website}
          </a>
        {/if}
        {#if profile?.nip05}
          <p class="text-neutral-500 text-sm mt-1">{profile.nip05}</p>
        {/if}
        {#if normalizedPubkey}
          <p class="text-neutral-500 text-sm mt-3">
            {normalizedPubkey.slice(0, 4)}…{normalizedPubkey.slice(-4)}
          </p>
        {/if}
      </div>
    </div>
  </div>

  <!-- Credibility Strip -->
  <div class="grid gap-4 border-b border-neutral-800 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4">
    <div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Markets</p>
      <p class="text-lg font-semibold text-white mt-1">{markets.length}</p>
    </div>
    <div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Positions</p>
      <p class="text-lg font-semibold text-white mt-1">{positions.length}</p>
    </div>
    <div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Followers</p>
      <p class="text-neutral-500 text-sm mt-1">Coming soon</p>
    </div>
    <div>
      <p class="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Following</p>
      <p class="text-neutral-500 text-sm mt-1">Coming soon</p>
    </div>
  </div>

  <!-- Tabs -->
  <div class="border-b border-neutral-800 px-6">
    <div class="flex gap-1">
      <button
        type="button"
        onclick={() => {}}
        class="py-4 px-1 text-sm font-medium text-white border-b-2 border-white -mb-px"
      >
        Markets
      </button>
      <button
        type="button"
        onclick={() => {}}
        class="py-4 px-1 text-sm font-medium text-neutral-500 hover:text-neutral-300"
      >
        Positions
      </button>
    </div>
  </div>

  <!-- Tab Content -->
  <div class="px-6 py-8">
    {#if loadingMarkets}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border border-neutral-600 border-t-white"></div>
      </div>
    {:else if markets.length === 0}
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
  </div>

  <!-- Positions Tab -->
  <div class="border-b border-neutral-800 px-6">
    <div class="flex gap-1">
      <button
        type="button"
        onclick={() => {}}
        class="py-4 px-1 text-sm font-medium text-neutral-500 hover:text-neutral-300"
      >
        Markets
      </button>
      <button
        type="button"
        onclick={() => {}}
        class="py-4 px-1 text-sm font-medium text-white border-b-2 border-white -mb-px"
      >
        Positions
      </button>
    </div>
  </div>

  <div class="px-6 py-8">
    {#if loadingPositions}
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border border-neutral-600 border-t-white"></div>
      </div>
    {:else if positions.length === 0}
      <p class="text-center text-neutral-400 py-12">No positions held yet</p>
    {:else}
      <div class="space-y-4">
        {#each positions as position (position.id)}
          <div class="border-b border-neutral-800 pb-4">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-neutral-300">{position.marketTitle}</p>
                <p class="font-semibold mt-1 {position.side === 'yes' ? 'text-emerald-400' : 'text-rose-400'}">
                  {position.side.toUpperCase()} — {position.amount}
                </p>
              </div>
              {#if position.resolved}
                <span class="text-[11px] uppercase tracking-[0.2em] text-neutral-500 ml-2">Resolved</span>
              {:else}
                <span class="text-[11px] uppercase tracking-[0.2em] text-emerald-500 ml-2">Open</span>
              {/if}
            </div>
            <p class="text-neutral-500 text-xs mt-2">Created {formatDate(position.createdAt)}</p>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>