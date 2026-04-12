<script lang="ts">
  import { untrack } from 'svelte';
  import { displayName, shortPubkey } from '$lib/ndk/format';
  import {
    formatRelativeTime,
    marketUrl,
    sanitizeMarketCopy,
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
  const resolvedNpub = $derived(resolvedUser?.npub ?? data.npub);
  const marketList = $derived(data.markets as MarketRecord[]);
  const positionList = $derived(data.positions as PositionRecord[]);
  const profileLabel = $derived(displayName(resolvedProfile, shortPubkey(resolvedPubkey)));
  const longCount = $derived(positionList.filter((position) => position.direction === 'yes').length);
  const shortCount = $derived(positionList.filter((position) => position.direction === 'no').length);
</script>

<section class="profile-header">
  <div class="profile-copy">
    <div class="profile-kicker">Profile</div>
    <h1>{profileLabel}</h1>
    <p>{resolvedProfile?.about || resolvedProfile?.bio || 'No profile summary yet.'}</p>

    <div class="profile-meta">
      <span>{resolvedNpub}</span>
      {#if resolvedProfile?.nip05}
        <span>{resolvedProfile.nip05}</span>
      {/if}
    </div>
  </div>

  <div class="profile-actions">
    <a class="button-primary" href="/onboarding">Edit profile</a>
  </div>
</section>

<section class="profile-stats">
  <div>
    <span>Markets created</span>
    <strong>{marketList.length}</strong>
  </div>
  <div>
    <span>Public positions</span>
    <strong>{positionList.length}</strong>
  </div>
  <div>
    <span>LONG positions</span>
    <strong>{longCount}</strong>
  </div>
  <div>
    <span>SHORT positions</span>
    <strong>{shortCount}</strong>
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
          <div class="profile-row">
            <div>
              <strong>{position.marketTitle || position.marketId}</strong>
              <p>{position.direction === 'yes' ? 'LONG' : 'SHORT'} · {position.quantity} units</p>
            </div>
            <span>{formatRelativeTime(Math.floor(position.createdAt / 1000))}</span>
          </div>
        {/each}
      {:else}
        <div class="profile-empty">No public position records yet.</div>
      {/if}
    </div>
  </article>
</section>

<style>
  .profile-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2rem;
    padding-top: 1rem;
  }

  .profile-copy {
    display: grid;
    gap: 0.9rem;
    max-width: 42rem;
  }

  .profile-kicker,
  .section-kicker {
    color: var(--text-faint);
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
    color: var(--text-muted);
    line-height: 1.75;
  }

  .profile-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.85rem 1rem;
    color: var(--text-faint);
    font-size: 0.82rem;
  }

  .profile-actions {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
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
    color: var(--text-faint);
    font-size: 0.76rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .profile-stats strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
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
    color: var(--text-strong);
    font-size: 1rem;
    line-height: 1.45;
  }

  .profile-row p {
    margin-top: 0.25rem;
    color: var(--text-faint);
    font-size: 0.86rem;
    line-height: 1.65;
  }

  .profile-row span {
    flex: 0 0 auto;
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .profile-empty {
    padding: 1rem 0;
    color: var(--text-muted);
  }

  @media (max-width: 900px) {
    .profile-header,
    .profile-grid {
      flex-direction: column;
      grid-template-columns: 1fr;
    }

    .profile-stats {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .profile-stats {
      grid-template-columns: 1fr;
    }

    .profile-row {
      flex-direction: column;
    }
  }
</style>
