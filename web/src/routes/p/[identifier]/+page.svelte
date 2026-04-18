<script lang="ts">
  import { untrack } from 'svelte';
  import {
    buildPublicProfileDiscussionEntries,
    buildPublicProfilePositionStats,
    formatProfilePositionSummary,
    formatProfileProbability
  } from '$lib/cascade/profile';
  import { displayName } from '$lib/ndk/format';
  import {
    formatRelativeTime,
    marketUrl,
    sanitizeMarketCopy,
    type DiscussionRecord,
    type MarketRecord,
    type PositionRecord
  } from '$lib/ndk/cascade';
  import { ndk } from '$lib/ndk/client';
  import { createProfileFetcher } from '$lib/ndk/builders/profile/index.svelte.js';
  import type { PageProps } from './$types';

  let { data }: PageProps = $props();

  const stableNdk = untrack(() => ndk);
  const profileFetcher = createProfileFetcher(
    () => ({ user: data.lookupIdentifier || data.pubkey }),
    stableNdk
  );

  const resolvedUser = $derived(profileFetcher.user ?? null);
  const resolvedProfile = $derived(profileFetcher.profile ?? data.profile ?? undefined);
  const resolvedPubkey = $derived(resolvedUser?.pubkey ?? data.pubkey);
  const currentUser = $derived(ndk.$currentUser);
  const marketList = $derived(data.markets as MarketRecord[]);
  const discussionMarketList = $derived(data.discussionMarkets as MarketRecord[]);
  const positionMarketList = $derived(data.positionMarkets as MarketRecord[]);
  const positionList = $derived(data.positions as PositionRecord[]);
  const discussionList = $derived(data.discussions as DiscussionRecord[]);
  const profileLabel = $derived(displayName(resolvedProfile, 'Cascade user'));
  const relatedMarketList = $derived.by(() => {
    const deduped = new Map<string, MarketRecord>();
    for (const market of [...marketList, ...discussionMarketList]) {
      deduped.set(market.id, market);
    }
    return [...deduped.values()];
  });
  const positionMarketMap = $derived.by(() => {
    const map = new Map<string, MarketRecord>();
    for (const m of positionMarketList) map.set(m.id, m);
    return map;
  });
  const positionStats = $derived(buildPublicProfilePositionStats(positionList));
  const discussionEntries = $derived(buildPublicProfileDiscussionEntries(discussionList, relatedMarketList));
  let avatarLoadFailed = $state(false);
  const avatarPicture = $derived(resolvedProfile?.picture?.trim() || undefined);
  const avatarUrl = $derived(avatarLoadFailed ? undefined : avatarPicture);
  const avatarMonogram = $derived((profileLabel.trim()[0] ?? '?').toUpperCase());

  $effect(() => {
    avatarPicture;
    avatarLoadFailed = false;
  });

  function handleAvatarError(event: Event) {
    avatarLoadFailed = true;

    const image = event.currentTarget;
    if (image instanceof HTMLImageElement) {
      image.onerror = null;
    }
  }

  function positionDirectionLabel(position: Pick<PositionRecord, 'direction'>): 'LONG' | 'SHORT' {
    return position.direction === 'long' ? 'LONG' : 'SHORT';
  }
</script>

<div class="flex flex-wrap items-end gap-6 pt-4">
  {#if avatarUrl}
    <img
      class="size-20 shrink-0 rounded-full object-cover bg-base-300"
      src={avatarUrl}
      alt={`${profileLabel} avatar`}
      loading="lazy"
      decoding="async"
      onerror={handleAvatarError}
    />
  {:else}
    <div class="size-20 shrink-0 rounded-full bg-base-300 grid place-items-center text-[1.75rem] font-semibold text-white" aria-hidden="true">{avatarMonogram}</div>
  {/if}

  <div class="grid gap-4 flex-1 min-w-0 max-w-[42rem]">
    <h1 class="text-[clamp(2.4rem,4vw,4rem)] leading-none tracking-[-0.05em]">{profileLabel}</h1>
    <p class="text-base-content/70 leading-[1.75]">{resolvedProfile?.about || resolvedProfile?.bio || 'No profile summary yet.'}</p>

    {#if resolvedProfile?.nip05}
      <div class="flex flex-wrap gap-4 text-base-content/50 text-sm">
        <span>{resolvedProfile.nip05}</span>
      </div>
    {/if}
  </div>

  <div class="flex gap-3 flex-wrap ml-auto">
    {#if currentUser?.pubkey === resolvedPubkey}
      <a class="btn btn-primary" href="/profile/edit">Edit profile</a>
    {/if}
  </div>
</div>

<div class="grid grid-cols-2 gap-4 pt-8 sm:grid-cols-4">
  <div class="grid gap-1 py-4 border-t border-base-300">
    <span class="eyebrow">Markets created</span>
    <strong class="text-white font-mono">{marketList.length}</strong>
  </div>
  <div class="grid gap-1 py-4 border-t border-base-300">
    <span>Positions</span>
    <strong class="text-white font-mono">{positionStats.total}</strong>
  </div>
  <div class="grid gap-1 py-4 border-t border-base-300">
    <span>LONG/SHORT split</span>
    <strong class="text-white font-mono">{positionStats.splitLabel}</strong>
  </div>
  <div class="grid gap-1 py-4 border-t border-base-300">
    <span>Avg entry</span>
    <strong class="text-white font-mono">{formatProfileProbability(positionStats.averageEntryPrice)}</strong>
  </div>
</div>

<div class="grid gap-10 pt-8 md:grid-cols-3">
  <article class="grid gap-4">
    <div>
      <div class="eyebrow">Markets</div>
      <h2 class="mt-1 text-xl tracking-[-0.03em]">Markets Created</h2>
    </div>

    <div class="divide-y divide-base-300 border-t border-base-300">
      {#if marketList.length > 0}
        {#each marketList as market (market.id)}
          <a class="flex items-start justify-between gap-4 py-4 hover:text-white" href={marketUrl(market.slug)}>
            <div class="min-w-0">
              <strong class="text-white text-base leading-[1.45] block">{market.title}</strong>
              <p class="mt-1 text-base-content/50 text-sm leading-[1.65]">{sanitizeMarketCopy(market.description) || 'No market summary yet.'}</p>
            </div>
            <span class="shrink-0 text-base-content/50 text-xs">{formatRelativeTime(market.createdAt)}</span>
          </a>
        {/each}
      {:else}
        <div class="py-4 text-base-content/70">No markets created yet.</div>
      {/if}
    </div>
  </article>

  <article class="grid gap-4">
    <div>
      <div class="eyebrow">Trading Activity</div>
      <h2 class="mt-1 text-xl tracking-[-0.03em]">Public Positions</h2>
    </div>

    <div class="divide-y divide-base-300 border-t border-base-300">
      {#if positionList.length > 0}
        {#each positionList as position (position.id)}
          {@const positionMarket = positionMarketMap.get(position.marketId)}
          <a class="profile-row" href={positionMarket ? marketUrl(positionMarket.slug) : undefined}>
            <div class="min-w-0">
              <strong class="text-white text-base leading-[1.45] block" title={positionDirectionLabel(position)}>{position.marketTitle || position.marketId}</strong>
              <p class="mt-1 text-base-content/50 text-sm leading-[1.65]">{formatProfilePositionSummary(position)}</p>
            </div>
            <span class="shrink-0 text-base-content/50 text-xs">{formatRelativeTime(Math.floor(position.createdAt / 1000))}</span>
          </a>
        {/each}
      {:else}
        <div class="py-4 text-base-content/70">No public position records yet.</div>
      {/if}
    </div>
  </article>

  <article class="grid gap-4">
    <div>
      <div class="eyebrow">Discussion</div>
      <h2>Discussions</h2>
    </div>

    <div class="divide-y divide-base-300 border-t border-base-300">
      {#if discussionEntries.length > 0}
        {#each discussionEntries as discussion (discussion.id)}
          <div class="flex items-start justify-between gap-4 py-4">
            <div class="min-w-0">
              <strong class="text-white text-base leading-[1.45] block">
                {#if discussion.threadHref}
                  <a class="hover:text-white" href={discussion.threadHref}>{discussion.title}</a>
                {:else}
                  {discussion.title}
                {/if}
              </strong>
              <p class="mt-1 text-base-content/50 text-sm leading-[1.65]">
                {#if discussion.marketHref}
                  <a class="underline underline-offset-2 hover:text-white" href={discussion.marketHref}>
                    {discussion.marketLabel}
                  </a>
                {:else}
                  {discussion.marketLabel}
                {/if}
                {#if discussion.preview}
                  · {discussion.preview}
                {/if}
              </p>
            </div>
            <span class="shrink-0 text-base-content/50 text-xs">{formatRelativeTime(discussion.createdAt)}</span>
          </div>
        {/each}
      {:else}
        <div class="py-4 text-base-content/70">No discussion threads started yet.</div>
      {/if}
    </div>
  </article>
</div>
