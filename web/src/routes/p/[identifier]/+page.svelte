<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { ndk } from '$lib/ndk/client';
  import { createProfileFetcher } from '$lib/ndk/builders/profile/index.svelte.js';
  import { displayName, displayNip05, profileHref } from '$lib/ndk/format';
  import {
    formatRelativeTime,
    marketUrl,
    sanitizeMarketCopy,
    threadUrl,
    truncateText,
    type DiscussionRecord,
    type MarketRecord,
    type PositionRecord
  } from '$lib/ndk/cascade';
  import type { PageProps } from './$types';

  type ProfileNote = { id: string; content: string; createdAt: number };

  type ActivityItem =
    | { kind: 'note'; createdAt: number; id: string; note: ProfileNote }
    | {
        kind: 'reply';
        createdAt: number;
        id: string;
        discussion: DiscussionRecord;
        market?: MarketRecord;
      }
    | { kind: 'claim'; createdAt: number; id: string; market: MarketRecord }
    | {
        kind: 'stake';
        createdAt: number;
        id: string;
        position: PositionRecord;
        market?: MarketRecord;
      };

  type TabKey = 'all' | 'notes' | 'replies' | 'trades' | 'claims';

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
  const currentUser = $derived(ndk.$currentUser);
  const isSelf = $derived(
    Boolean(currentUser?.pubkey && resolvedPubkey && currentUser.pubkey === resolvedPubkey)
  );

  const npubShort = $derived(shortenNpub(resolvedNpub));
  const profileLabel = $derived(displayName(resolvedProfile, npubShort));
  const handleForCopy = $derived(profileLabel.startsWith('@') ? profileLabel : `@${profileLabel}`);
  const nip05Label = $derived(displayNip05(resolvedProfile));
  const bioText = $derived(cleanBio(resolvedProfile?.about));
  const avatarMonogram = $derived((profileLabel.trim()[0] ?? '?').toUpperCase());
  const avatarPalette = $derived(avatarPaletteFor(resolvedPubkey ?? ''));

  const avatarPicture = $derived(resolvedProfile?.picture?.trim() || undefined);
  let avatarLoadFailed = $state(false);
  $effect(() => {
    avatarPicture;
    avatarLoadFailed = false;
  });
  const avatarUrlResolved = $derived(avatarLoadFailed ? undefined : avatarPicture);

  const markets = $derived((data.markets ?? []) as MarketRecord[]);
  const positions = $derived((data.positions ?? []) as PositionRecord[]);
  const discussions = $derived((data.discussions ?? []) as DiscussionRecord[]);
  const notes = $derived((data.notes ?? []) as ProfileNote[]);
  const discussionMarkets = $derived((data.discussionMarkets ?? []) as MarketRecord[]);
  const positionMarkets = $derived((data.positionMarkets ?? []) as MarketRecord[]);

  const marketByIdForReplies = $derived.by(() => {
    const map = new Map<string, MarketRecord>();
    for (const market of [...markets, ...discussionMarkets]) map.set(market.id, market);
    return map;
  });
  const marketByIdForPositions = $derived.by(() => {
    const map = new Map<string, MarketRecord>();
    for (const market of positionMarkets) map.set(market.id, market);
    return map;
  });

  const joinedAt = $derived.by(() => deriveJoinedAt(markets, positions, discussions));

  const noteCount = $derived(notes.length);
  const replyCount = $derived(discussions.length);
  const tradeCount = $derived(positions.length);
  const claimCount = $derived(markets.length);
  const investedInCount = $derived(new Set(positions.map((position) => position.marketId)).size);

  const activeTab: TabKey = $derived(parseTabFromHash(page.url.hash));

  const allActivity = $derived.by<ActivityItem[]>(() => {
    const items: ActivityItem[] = [];

    for (const note of notes) {
      items.push({ kind: 'note', createdAt: note.createdAt, id: `note-${note.id}`, note });
    }

    for (const discussion of discussions) {
      items.push({
        kind: 'reply',
        createdAt: discussion.createdAt,
        id: `reply-${discussion.id}`,
        discussion,
        market: marketByIdForReplies.get(discussion.marketId)
      });
    }

    for (const market of markets) {
      items.push({ kind: 'claim', createdAt: market.createdAt, id: `claim-${market.id}`, market });
    }

    for (const position of positions) {
      if (!isNotablePosition(position)) continue;
      items.push({
        kind: 'stake',
        createdAt: Math.floor(position.createdAt / 1000),
        id: `stake-${position.id}`,
        position,
        market: marketByIdForPositions.get(position.marketId)
      });
    }

    return items.sort((left, right) => right.createdAt - left.createdAt);
  });

  const visibleItems = $derived.by<ActivityItem[]>(() => {
    switch (activeTab) {
      case 'notes':
        return allActivity.filter((item) => item.kind === 'note');
      case 'replies':
        return allActivity.filter((item) => item.kind === 'reply');
      case 'trades':
        return positions
          .map<ActivityItem>((position) => ({
            kind: 'stake',
            createdAt: Math.floor(position.createdAt / 1000),
            id: `stake-${position.id}`,
            position,
            market: marketByIdForPositions.get(position.marketId)
          }))
          .sort((left, right) => right.createdAt - left.createdAt);
      case 'claims':
        return allActivity.filter((item) => item.kind === 'claim');
      case 'all':
      default:
        return allActivity;
    }
  });

  const openPositions = $derived.by(() =>
    [...positions]
      .sort((left, right) => Math.abs(right.quantity) - Math.abs(left.quantity))
      .slice(0, 5)
      .map((position) => ({
        position,
        market: marketByIdForPositions.get(position.marketId)
      }))
  );
  const totalOpenPositions = $derived(positions.length);

  function selectTab(tab: TabKey) {
    const hash = tab === 'all' ? '' : `#${tab}`;
    void goto(`${page.url.pathname}${hash}`, {
      replaceState: false,
      keepFocus: true,
      noScroll: true
    });
  }

  function tabIsDisabled(tab: TabKey): boolean {
    switch (tab) {
      case 'notes':
        return noteCount === 0;
      case 'replies':
        return replyCount === 0;
      case 'trades':
        return tradeCount === 0;
      case 'claims':
        return claimCount === 0;
      case 'all':
      default:
        return allActivity.length === 0;
    }
  }

  let copyFlash = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyNpub() {
    if (!resolvedNpub) return;
    try {
      await navigator.clipboard.writeText(resolvedNpub);
      copyFlash = true;
      if (copyTimer) clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copyFlash = false), 1500);
    } catch (err) {
      console.warn('npub copy failed', err);
    }
  }

  let shareFlash = $state(false);
  let shareTimer: ReturnType<typeof setTimeout> | undefined;
  async function copyProfileLink() {
    const href = profileHref(resolvedProfile, resolvedNpub ?? '');
    try {
      const absolute = new URL(href, window.location.origin).toString();
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ title: profileLabel, url: absolute });
        return;
      }
      await navigator.clipboard.writeText(absolute);
      shareFlash = true;
      if (shareTimer) clearTimeout(shareTimer);
      shareTimer = setTimeout(() => (shareFlash = false), 1500);
    } catch (err) {
      console.warn('profile share failed', err);
    }
  }

  function handleAvatarError(event: Event) {
    avatarLoadFailed = true;
    const image = event.currentTarget;
    if (image instanceof HTMLImageElement) image.onerror = null;
  }

  function shortenNpub(npub: string | undefined): string {
    if (!npub) return 'Cascade user';
    if (npub.length <= 16) return npub;
    return `${npub.slice(0, 8)}…${npub.slice(-4)}`;
  }

  function cleanBio(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  function avatarPaletteFor(seed: string): string {
    if (!seed) return 'av-N';
    const palettes = ['av-N', 'av-G', 'av-K', 'av-S'];
    const code = seed.charCodeAt(0) + seed.charCodeAt(seed.length - 1);
    return palettes[code % palettes.length] ?? 'av-N';
  }

  function isNotablePosition(position: PositionRecord): boolean {
    return position.quantity >= 250;
  }

  function deriveJoinedAt(
    ms: MarketRecord[],
    ps: PositionRecord[],
    ds: DiscussionRecord[]
  ): number | null {
    // Cascade-specific events only — notes are general Nostr activity, not
    // a signal about when this person joined Cascade.
    const candidates: number[] = [];
    for (const market of ms) candidates.push(market.createdAt);
    for (const position of ps) candidates.push(Math.floor(position.createdAt / 1000));
    for (const discussion of ds) candidates.push(discussion.createdAt);
    if (candidates.length === 0) return null;
    return Math.min(...candidates);
  }

  function formatJoinedDate(seconds: number | null): string {
    if (!seconds) return '';
    return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' }).format(
      new Date(seconds * 1000)
    );
  }

  function parseTabFromHash(hash: string): TabKey {
    const value = hash.replace(/^#/, '').toLowerCase();
    if (value === 'notes' || value === 'replies' || value === 'trades' || value === 'claims') {
      return value;
    }
    return 'all';
  }

  function sideOf(direction: 'long' | 'short'): 'YES' | 'NO' {
    return direction === 'long' ? 'YES' : 'NO';
  }

  function notePreview(content: string): string {
    return truncateText(content.replace(/\s+/g, ' ').trim(), 280);
  }

  function emptyCopyFor(tab: TabKey): string {
    switch (tab) {
      case 'notes':
        return 'Nothing posted yet.';
      case 'replies':
        return 'No replies in any discussion yet.';
      case 'trades':
        return 'No trades on record.';
      case 'claims':
        return 'No claims published yet.';
      case 'all':
      default:
        return `${handleForCopy} hasn't posted, replied, or traded yet.`;
    }
  }
</script>

<svelte:head>
  <title>{profileLabel} · Cascade</title>
</svelte:head>

<div class="profile-page">
  <header class="profile-hero">
    <div class="hero-id">
      {#if avatarUrlResolved}
        <img
          class="hero-av"
          src={avatarUrlResolved}
          alt={`${profileLabel} avatar`}
          loading="lazy"
          decoding="async"
          onerror={handleAvatarError}
        />
      {:else}
        <span class="hero-av av-mono {avatarPalette}" aria-hidden="true">{avatarMonogram}</span>
      {/if}

      <div class="hero-who">
        <div class="hero-name-line">
          <span class="hero-name">{profileLabel}</span>
          {#if nip05Label}
            <span class="hero-check" title={nip05Label} aria-label="NIP-05 declared">◉</span>
            <span class="hero-nip">{nip05Label}</span>
          {/if}
        </div>

        {#if bioText}
          <p class="hero-bio">{bioText}</p>
        {/if}

        <div class="hero-counts">
          <span><em>{claimCount}</em> markets created</span>
          <span class="sep">·</span>
          <span><em>{investedInCount}</em> markets invested in</span>
          {#if joinedAt}
            <span class="sep">·</span>
            <span>joined <em>{formatJoinedDate(joinedAt)}</em></span>
          {/if}
          {#if resolvedNpub}
            <span class="sep">·</span>
            <button
              type="button"
              class="copy-npub"
              onclick={copyNpub}
              title={copyFlash ? 'Copied' : 'Copy npub'}
            >
              {copyFlash ? 'copied' : npubShort}
            </button>
          {/if}
        </div>
      </div>
    </div>

    <div class="hero-actions">
      <button
        type="button"
        class="hero-icon-btn"
        onclick={copyProfileLink}
        title={shareFlash ? 'Link copied' : 'Copy profile link'}
        aria-label="Copy profile link"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5" />
          <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5" />
        </svg>
      </button>
      {#if isSelf}
        <a class="hero-cta" href="/profile/edit">Edit profile</a>
      {:else}
        <button type="button" class="hero-cta" disabled title="Follow coming next">+ Follow</button>
      {/if}
    </div>
  </header>

  <nav class="tab-strip" aria-label="Profile activity">
    {#each [
      { key: 'all', label: 'All', count: allActivity.length },
      { key: 'notes', label: 'Notes', count: noteCount },
      { key: 'replies', label: 'Replies', count: replyCount },
      { key: 'trades', label: 'Trades', count: tradeCount },
      { key: 'claims', label: 'Claims', count: claimCount }
    ] as tab (tab.key)}
      {@const disabled = tabIsDisabled(tab.key as TabKey)}
      <button
        type="button"
        class="tab-item"
        class:on={activeTab === tab.key}
        class:disabled
        aria-current={activeTab === tab.key ? 'page' : undefined}
        aria-disabled={disabled ? 'true' : undefined}
        onclick={() => !disabled && selectTab(tab.key as TabKey)}
      >
        <span>{tab.label}</span><span class="tab-count">{tab.count}</span>
      </button>
    {/each}
  </nav>

  <div class="profile-shell">
    <main class="profile-feed">
      {#if visibleItems.length === 0}
        <p class="feed-empty">{emptyCopyFor(activeTab)}</p>
      {:else}
        {#each visibleItems as item (item.id)}
          {#if item.kind === 'note'}
            <article class="feed-item feed-note">
              <div class="feed-meta">
                <span class="feed-kind">Note</span>
                <span class="feed-time">{formatRelativeTime(item.createdAt)}</span>
              </div>
              <p class="feed-note-body">{notePreview(item.note.content)}</p>
            </article>
          {:else if item.kind === 'reply'}
            <article class="feed-item feed-reply">
              <div class="feed-meta">
                <span class="feed-kind">Reply</span>
                <span class="feed-time">{formatRelativeTime(item.createdAt)}</span>
              </div>
              {#if item.market}
                <a class="feed-quoted-claim" href={marketUrl(item.market.slug)}>
                  {sanitizeMarketCopy(item.market.title)}
                </a>
              {/if}
              <p class="feed-reply-body">
                {#if item.market}
                  <a
                    class="feed-reply-link"
                    href={threadUrl(item.market.slug, item.discussion.id)}
                  >
                    {truncateText(item.discussion.content, 320) || 'Reply'}
                  </a>
                {:else}
                  {truncateText(item.discussion.content, 320) || 'Reply'}
                {/if}
              </p>
            </article>
          {:else if item.kind === 'claim'}
            <a class="feed-item feed-claim" href={marketUrl(item.market.slug)}>
              <div class="feed-meta">
                <span class="feed-kind">Published a claim</span>
                <span class="feed-time">{formatRelativeTime(item.createdAt)}</span>
              </div>
              <h3 class="feed-claim-title">{sanitizeMarketCopy(item.market.title)}</h3>
              {#if item.market.description}
                <p class="feed-claim-sub">
                  {truncateText(sanitizeMarketCopy(item.market.description), 220)}
                </p>
              {/if}
            </a>
          {:else if item.kind === 'stake'}
            {@const side = sideOf(item.position.direction)}
            <article class="feed-item feed-stake side-{side.toLowerCase()}">
              <div class="feed-meta">
                <span class="feed-kind">Took <span class="feed-side">{side}</span></span>
                {#if item.market}
                  <a class="feed-meta-link" href={marketUrl(item.market.slug)}>
                    {sanitizeMarketCopy(item.market.title)}
                  </a>
                {/if}
                <span class="feed-time">{formatRelativeTime(item.createdAt)}</span>
              </div>
              <div class="feed-stake-body">
                <span class="stake-side stake-side-{side.toLowerCase()}">{side}</span>
                <span class="stake-amount">
                  {item.position.quantity.toLocaleString()} units · entry {(item.position.entryPrice * 100).toFixed(0)}¢
                </span>
              </div>
            </article>
          {/if}
        {/each}
      {/if}
    </main>

    <aside class="profile-rail">
      <label class="rail-search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
        </svg>
        <input type="search" placeholder="Search Cascade" aria-label="Search Cascade" />
      </label>

      <section class="rail-card profile-rail-card" aria-labelledby="profile-positions-head">
        <header class="rail-card-head">
          <h2 id="profile-positions-head">Open positions</h2>
          {#if totalOpenPositions > openPositions.length}
            <span class="rail-card-count">{totalOpenPositions}</span>
          {/if}
        </header>
        {#if openPositions.length === 0}
          <p class="rail-card-empty">No open positions.</p>
        {:else}
          <ol class="positions">
            {#each openPositions as entry (entry.position.id)}
              {@const side = sideOf(entry.position.direction)}
              <li class="position">
                <span class="pos-side pos-side-{side.toLowerCase()}">{side}</span>
                <div class="pos-body">
                  {#if entry.market}
                    <a class="pos-title" href={marketUrl(entry.market.slug)}>
                      {sanitizeMarketCopy(entry.market.title)}
                    </a>
                  {:else}
                    <span class="pos-title pos-title-fallback">
                      {entry.position.marketTitle || entry.position.marketId}
                    </span>
                  {/if}
                  <span class="pos-sub">
                    {entry.position.quantity.toLocaleString()} units · entry {(entry.position.entryPrice * 100).toFixed(0)}¢
                  </span>
                </div>
              </li>
            {/each}
          </ol>
        {/if}
      </section>
    </aside>
  </div>
</div>

<style>
  .profile-page {
    display: grid;
    gap: 1.4rem;
    padding: 1.4rem 1.6rem 3rem;
    min-width: 0;
  }

  .profile-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 1.2rem;
    align-items: flex-start;
    padding-bottom: 1.2rem;
    border-bottom: 1px solid var(--color-base-300);
  }

  .hero-id {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 1.1rem;
    align-items: flex-start;
    min-width: 0;
  }

  .hero-av {
    width: 96px;
    height: 96px;
    border-radius: 8px;
    object-fit: cover;
    background: var(--color-base-300);
    flex-shrink: 0;
  }

  .av-mono {
    display: grid;
    place-items: center;
    font-family: var(--font-mono);
    font-size: 2.2rem;
    font-weight: 600;
    color: #1a1610;
    letter-spacing: -0.04em;
  }

  .av-N { background: linear-gradient(135deg, #a88a6e 0%, #6b4f3c 100%); }
  .av-G { background: linear-gradient(135deg, #d4b97a 0%, #8a6b3e 100%); }
  .av-K { background: linear-gradient(135deg, #6a8a7e 0%, #3e5248 100%); }
  .av-S { background: linear-gradient(135deg, #7a6ca4 0%, #4a4068 100%); }

  .hero-who {
    display: grid;
    gap: 0.55rem;
    min-width: 0;
  }

  .hero-name-line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.55rem;
    min-width: 0;
  }

  .hero-name {
    font-family: var(--font-tight);
    font-size: 1.4rem;
    font-weight: 600;
    color: var(--color-base-content);
    letter-spacing: -0.015em;
    line-height: 1.15;
    word-break: break-word;
  }

  .hero-check {
    font-size: 0.8em;
    color: var(--color-neutral-content);
    line-height: 1;
  }

  .hero-nip {
    font-size: 0.86rem;
    color: var(--color-neutral-content);
    word-break: break-all;
  }

  .hero-bio {
    font-size: 0.96rem;
    line-height: 1.55;
    color: var(--color-base-content);
    opacity: 0.85;
    max-width: 56ch;
  }

  .hero-counts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem 0.65rem;
    align-items: baseline;
    font-family: var(--font-mono);
    font-size: 0.74rem;
    color: var(--color-neutral-content);
    letter-spacing: 0.04em;
  }

  .hero-counts em {
    color: var(--color-base-content);
    font-style: normal;
  }

  .hero-counts .sep { opacity: 0.6; }

  .copy-npub {
    background: transparent;
    border: 0;
    padding: 0;
    color: var(--color-neutral-content);
    font-family: var(--font-mono);
    font-size: 0.74rem;
    letter-spacing: 0.04em;
    cursor: pointer;
  }

  .copy-npub:hover { color: var(--color-base-content); }

  .hero-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .hero-icon-btn {
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border-radius: 999px;
    border: 1px solid var(--color-base-300);
    background: transparent;
    color: var(--color-neutral-content);
    cursor: pointer;
  }

  .hero-icon-btn:hover {
    color: var(--color-base-content);
    border-color: var(--color-neutral-content);
  }

  .hero-icon-btn svg {
    width: 16px;
    height: 16px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .hero-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    border-radius: 999px;
    border: 0;
    background: var(--color-primary);
    color: var(--color-primary-content);
    padding: 0.55rem 1.1rem;
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    line-height: 1.2;
  }

  .hero-cta:hover { background: #fff8ec; }

  .hero-cta:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .tab-strip {
    display: flex;
    gap: 1.4rem;
    border-bottom: 1px solid var(--color-base-300);
    overflow-x: auto;
  }

  .tab-item {
    display: inline-flex;
    align-items: baseline;
    gap: 0.35rem;
    padding: 0.65rem 0;
    background: transparent;
    border: 0;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    color: var(--color-neutral-content);
    font-size: 0.92rem;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
  }

  .tab-item:hover {
    color: var(--color-base-content);
  }

  .tab-item.on {
    color: var(--color-base-content);
    border-bottom-color: var(--color-base-content);
  }

  .tab-item.disabled {
    opacity: 0.4;
    cursor: default;
  }

  .tab-item.disabled:hover {
    color: var(--color-neutral-content);
  }

  .tab-count {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--color-neutral-content);
    letter-spacing: 0.04em;
  }

  .profile-shell {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 2rem;
    align-items: flex-start;
  }

  .profile-feed {
    display: grid;
    gap: 1.2rem;
    min-width: 0;
  }

  .feed-empty {
    padding: 2.5rem 0;
    color: var(--color-neutral-content);
    font-style: italic;
    text-align: left;
  }

  .feed-item {
    display: grid;
    gap: 0.55rem;
    padding: 1rem 1.1rem;
    border: 1px solid var(--color-base-300);
    border-radius: 10px;
    background: transparent;
    color: var(--color-base-content);
  }

  a.feed-item:hover {
    border-color: var(--color-neutral-content);
  }

  .feed-meta {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
    font-family: var(--font-mono);
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-neutral-content);
  }

  .feed-meta .sep { opacity: 0.6; }

  .feed-kind {
    color: var(--color-base-content);
    opacity: 0.9;
  }

  .feed-meta-link {
    font-family: var(--font-tight);
    font-size: 0.78rem;
    text-transform: none;
    letter-spacing: -0.005em;
    color: var(--color-neutral-content);
  }

  .feed-meta-link:hover { color: var(--color-base-content); }

  .feed-time {
    margin-left: auto;
    color: var(--color-neutral-content);
    font-size: 0.66rem;
    text-transform: none;
    letter-spacing: 0.04em;
  }

  .feed-note-body,
  .feed-reply-body {
    font-size: 0.98rem;
    line-height: 1.6;
    color: var(--color-base-content);
  }

  .feed-quoted-claim {
    display: block;
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 1.05rem;
    line-height: 1.3;
    color: var(--color-base-content);
    border-left: 2px solid var(--color-base-300);
    padding: 0.2rem 0 0.2rem 0.85rem;
  }

  .feed-quoted-claim:hover { border-left-color: var(--color-neutral-content); }

  .feed-reply-link {
    color: inherit;
  }

  .feed-claim-title {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 1.45rem;
    line-height: 1.2;
    color: var(--color-base-content);
    letter-spacing: -0.01em;
  }

  .feed-claim-sub {
    font-size: 0.95rem;
    color: var(--color-base-content);
    opacity: 0.75;
    line-height: 1.55;
  }

  .feed-stake-body {
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
  }

  .stake-side {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    padding: 0.18rem 0.5rem;
    border: 1px solid currentColor;
    border-radius: 999px;
  }

  .stake-side-yes { color: var(--color-yes); }
  .stake-side-no { color: var(--color-no); }

  .stake-amount {
    font-family: var(--font-mono);
    font-size: 0.86rem;
    color: var(--color-base-content);
    opacity: 0.85;
  }

  .feed-side { font-weight: 600; }
  .side-yes .feed-side { color: var(--color-yes); }
  .side-no .feed-side { color: var(--color-no); }

  .profile-rail {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    position: sticky;
    top: 1.1rem;
    align-self: flex-start;
    max-height: calc(100vh - 1.4rem);
    overflow-y: auto;
  }

  .rail-search {
    display: flex;
    height: 40px;
    align-items: center;
    gap: 0.55rem;
    border: 1px solid var(--color-base-300);
    border-radius: 999px;
    background: var(--color-base-200);
    padding: 0 0.95rem;
  }

  .rail-search svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    fill: none;
    stroke: var(--color-neutral-content);
    stroke-width: 1.7;
  }

  .rail-search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--color-base-content);
    font-size: 0.88rem;
    outline: none;
  }

  .profile-rail-card {
    overflow: hidden;
    border: 1px solid var(--color-base-300);
    border-radius: 10px;
  }

  .profile-rail-card .rail-card-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 0.85rem 1.05rem 0.5rem;
  }

  .profile-rail-card .rail-card-head h2 {
    font-family: var(--font-tight);
    font-size: 0.96rem;
    font-weight: 700;
  }

  .rail-card-count {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-neutral-content);
    letter-spacing: 0.04em;
  }

  .rail-card-empty {
    border-top: 1px solid var(--color-base-300);
    padding: 0.85rem 1.05rem;
    color: var(--color-neutral-content);
    font-size: 0.86rem;
  }

  .positions {
    list-style: none;
    margin: 0;
    padding: 0;
    border-top: 1px solid var(--color-base-300);
  }

  .position {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 0.6rem;
    padding: 0.65rem 1.05rem;
    border-bottom: 1px solid var(--color-base-300);
    align-items: flex-start;
  }

  .position:last-child { border-bottom: 0; }

  .pos-side {
    font-family: var(--font-mono);
    font-size: 0.62rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    padding: 0.15rem 0.4rem;
    border: 1px solid currentColor;
    border-radius: 4px;
    margin-top: 0.15rem;
  }

  .pos-side-yes { color: var(--color-yes); }
  .pos-side-no { color: var(--color-no); }

  .pos-body { display: grid; gap: 0.15rem; min-width: 0; }

  .pos-title {
    font-family: var(--font-serif);
    font-weight: 500;
    font-size: 0.92rem;
    line-height: 1.25;
    color: var(--color-base-content);
    word-break: break-word;
  }

  .pos-title:hover { color: var(--color-primary); }

  .pos-title-fallback { opacity: 0.75; }

  .pos-sub {
    font-family: var(--font-mono);
    font-size: 0.68rem;
    color: var(--color-neutral-content);
  }

  @media (max-width: 880px) {
    .profile-shell {
      grid-template-columns: minmax(0, 1fr);
    }

    .profile-rail {
      position: static;
      max-height: none;
    }
  }

  @media (max-width: 640px) {
    .profile-page {
      padding: 1rem 1rem 2rem;
    }

    .hero-id {
      grid-template-columns: 64px minmax(0, 1fr);
      gap: 0.85rem;
    }

    .hero-av {
      width: 64px;
      height: 64px;
    }

    .av-mono { font-size: 1.6rem; }

    .hero-name { font-size: 1.2rem; }
  }
</style>
