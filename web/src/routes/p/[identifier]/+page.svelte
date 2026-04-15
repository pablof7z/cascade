<script lang="ts">
  import { untrack } from 'svelte';
  import {
    buildPublicProfileDiscussionEntries,
    buildPublicProfilePositionStats,
    formatProfilePositionSummary,
    formatProfileProbability
  } from '$lib/cascade/profile';
  import { displayName, shortPubkey } from '$lib/ndk/format';
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
  const profileLabel = $derived(displayName(resolvedProfile, shortPubkey(resolvedPubkey)));
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

<section class="profile-header">
  {#if avatarUrl}
    <img
      class="profile-avatar profile-avatar-image"
      src={avatarUrl}
      alt={`${profileLabel} avatar`}
      loading="lazy"
      decoding="async"
      onerror={handleAvatarError}
    />
  {:else}
    <div class="profile-avatar profile-avatar-fallback" aria-hidden="true">{avatarMonogram}</div>
  {/if}

  <div class="profile-copy">
    <h1>{profileLabel}</h1>
    <p>{resolvedProfile?.about || resolvedProfile?.bio || 'No profile summary yet.'}</p>

    <div class="profile-meta">
      {#if resolvedProfile?.nip05}
        <span>{resolvedProfile.nip05}</span>
      {/if}
    </div>
  </div>

  <div class="profile-actions">
    {#if currentUser?.pubkey === resolvedPubkey}
      <a class="btn btn-primary" href="/profile/edit">Edit profile</a>
    {/if}
  </div>
</section>

<section class="profile-stats">
  <div>
    <span>Markets created</span>
    <strong>{marketList.length}</strong>
  </div>
  <div>
    <span>Positions</span>
    <strong>{positionStats.total}</strong>
  </div>
  <div>
    <span>LONG/SHORT split</span>
    <strong>{positionStats.splitLabel}</strong>
  </div>
  <div>
    <span>Avg entry</span>
    <strong>{formatProfileProbability(positionStats.averageEntryPrice)}</strong>
  </div>
</section>

<section class="profile-grid">
  <article class="profile-section">
    <div class="section-header">
      <div>
        <div class="section-kicker">Markets</div>
        <h2>Markets Created</h2>
      </div>
    </div>

    <div class="profile-list">
      {#if marketList.length > 0}
        {#each marketList as market (market.id)}
          <a class="profile-row" href={marketUrl(market.slug)}>
            <div>
              <strong>{market.title}</strong>
              <p>{sanitizeMarketCopy(market.description) || 'No market summary yet.'}</p>
            </div>
            <span>{formatRelativeTime(market.createdAt)}</span>
          </a>
        {/each}
      {:else}
        <div class="profile-empty">No markets created yet.</div>
      {/if}
    </div>
  </article>

  <article class="profile-section">
    <div class="section-header">
      <div>
        <div class="section-kicker">Trading Activity</div>
        <h2>Public Positions</h2>
      </div>
    </div>

    <div class="profile-list">
      {#if positionList.length > 0}
        {#each positionList as position (position.id)}
          {@const positionMarket = positionMarketMap.get(position.marketId)}
          <a class="profile-row" href={positionMarket ? marketUrl(positionMarket.slug) : undefined}>
            <div>
              <strong title={positionDirectionLabel(position)}>{position.marketTitle || position.marketId}</strong>
              <p>{formatProfilePositionSummary(position)}</p>
            </div>
            <span>{formatRelativeTime(Math.floor(position.createdAt / 1000))}</span>
          </a>
        {/each}
      {:else}
        <div class="profile-empty">No public position records yet.</div>
      {/if}
    </div>
  </article>

  <article class="profile-section">
    <div class="section-header">
      <div>
        <div class="section-kicker">Discussion</div>
        <h2>Discussions</h2>
      </div>
    </div>

    <div class="profile-list">
      {#if discussionEntries.length > 0}
        {#each discussionEntries as discussion (discussion.id)}
          <div class="profile-row">
            <div>
              <strong>
                {#if discussion.threadHref}
                  <a class="profile-link" href={discussion.threadHref}>{discussion.title}</a>
                {:else}
                  {discussion.title}
                {/if}
              </strong>
              <p>
                {#if discussion.marketHref}
                  <a class="profile-link profile-inline-link" href={discussion.marketHref}>
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
            <span>{formatRelativeTime(discussion.createdAt)}</span>
          </div>
        {/each}
      {:else}
        <div class="profile-empty">No discussion threads started yet.</div>
      {/if}
    </div>
  </article>
</section>

<style>
  .profile-header {
    display: flex;
    align-items: flex-end;
    gap: 1.5rem 2rem;
    padding-top: 1rem;
  }

  .profile-avatar,
  .profile-avatar-image,
  .profile-avatar-fallback {
    width: 5rem;
    height: 5rem;
    border-radius: 50%;
    flex: 0 0 auto;
  }

  .profile-avatar-image {
    display: block;
    object-fit: cover;
    background: rgba(38, 38, 38, 0.8);
  }

  .profile-avatar-fallback {
    display: grid;
    place-items: center;
    background: rgba(38, 38, 38, 0.8);
    color: white;
    font-size: 1.75rem;
    font-weight: 600;
    line-height: 1;
  }

  .profile-copy {
    display: grid;
    gap: 0.9rem;
    flex: 1 1 auto;
    min-width: 0;
    max-width: 42rem;
  }

  .section-kicker {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .profile-copy h1 {
    font-size: clamp(2.4rem, 4vw, 4rem);
    line-height: 1;
    letter-spacing: -0.05em;
  }

  .profile-copy p {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.75;
  }

  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem 1rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.82rem;
  }

  .profile-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
    margin-left: auto;
  }

  .profile-stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1rem;
    padding-top: 2rem;
  }

  .profile-stats div {
    display: grid;
    gap: 0.4rem;
    padding: 1rem 0;
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .profile-stats span {
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .profile-stats strong {
    color: white;
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 2.5rem;
    padding-top: 2rem;
  }

  .profile-section {
    display: grid;
    gap: 1rem;
  }

  .section-header h2 {
    margin-top: 0.25rem;
    font-size: 1.2rem;
    letter-spacing: -0.03em;
  }

  .profile-list {
    border-top: 1px solid rgba(38, 38, 38, 0.8);
  }

  .profile-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid rgba(38, 38, 38, 0.8);
  }

  .profile-row strong {
    color: white;
    font-size: 1rem;
    line-height: 1.45;
  }

  .profile-row p {
    margin-top: 0.25rem;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.86rem;
    line-height: 1.65;
  }

  .profile-row span {
    flex: 0 0 auto;
    color: color-mix(in srgb, var(--color-neutral-content) 58%, transparent);
    font-size: 0.78rem;
  }

  .profile-link {
    color: inherit;
    text-decoration: none;
  }

  .profile-link:hover {
    color: white;
  }

  .profile-inline-link {
    text-decoration: underline;
    text-underline-offset: 0.14em;
  }

  .profile-empty {
    padding: 1rem 0;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  @media (max-width: 1100px) {
    .profile-grid {
      grid-template-columns: 1fr 1fr;
    }

    .profile-section:last-child {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 900px) {
    .profile-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .profile-avatar,
    .profile-avatar-image,
    .profile-avatar-fallback {
      width: 3.75rem;
      height: 3.75rem;
    }

    .profile-avatar-fallback {
      font-size: 1.35rem;
    }

    .profile-actions {
      margin-left: 0;
    }

    .profile-grid {
      grid-template-columns: 1fr;
    }

    .profile-stats {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .profile-avatar,
    .profile-avatar-image,
    .profile-avatar-fallback {
      width: 3.25rem;
      height: 3.25rem;
    }

    .profile-avatar-fallback {
      font-size: 1.1rem;
    }

    .profile-stats {
      grid-template-columns: 1fr;
    }

    .profile-row {
      flex-direction: column;
    }
  }
</style>
