<script lang="ts">
  interface Props {
    name: string;
    bio: string;
    avatarUrl: string;
    bannerUrl: string;
    nip05: string;
    website: string;
    backgroundColor: string;
    foregroundColor: string;
    customFields: Array<{ key: string; value: string }>;
  }

  let {
    name,
    bio,
    avatarUrl,
    bannerUrl,
    nip05,
    website,
    backgroundColor,
    foregroundColor,
    customFields
  }: Props = $props();

  function websiteLabel(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }
</script>

<div
  class="pp-card"
  style:background-color={backgroundColor || undefined}
  style:color={foregroundColor || undefined}
>
  {#if bannerUrl}
    <div class="pp-banner">
      <img src={bannerUrl} alt="" />
    </div>
  {:else}
    <div class="pp-banner pp-banner-empty"></div>
  {/if}

  <div class="pp-body">
    <div class="pp-avatar-wrap">
      {#if avatarUrl}
        <img class="pp-avatar" src={avatarUrl} alt={name || 'Avatar'} />
      {:else}
        <div class="pp-avatar pp-avatar-placeholder">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        </div>
      {/if}
    </div>

    <h2 class="pp-name">{name || 'Your Name'}</h2>
    <p class="pp-bio">{bio || 'Your bio will appear here.'}</p>

    <div class="pp-meta">
      {#if nip05}
        <span>{nip05}</span>
      {/if}
      {#if website}
        <span>{websiteLabel(website)}</span>
      {/if}
    </div>

    {#if customFields.length > 0}
      <div class="pp-custom-fields">
        {#each customFields as field (field.key)}
          {#if field.key && field.value}
            <div class="pp-custom-row">
              <span class="pp-custom-key">{field.key}</span>
              <span class="pp-custom-value">{field.value}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .pp-card {
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    overflow: hidden;
    background: var(--surface);
  }

  .pp-banner {
    aspect-ratio: 3 / 1;
    overflow: hidden;
    background: var(--surface-soft);
  }

  .pp-banner img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pp-banner-empty {
    background: linear-gradient(135deg, var(--surface-soft) 0%, var(--border-light) 100%);
  }

  .pp-body {
    display: grid;
    gap: 0.5rem;
    padding: 0 1rem 1.25rem;
    text-align: center;
    justify-items: center;
  }

  .pp-avatar-wrap {
    margin-top: -2rem;
  }

  .pp-avatar {
    width: 4rem;
    height: 4rem;
    border-radius: 9999px;
    border: 3px solid var(--surface);
    object-fit: cover;
    background: var(--surface-soft);
  }

  .pp-avatar-placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
  }

  .pp-avatar-placeholder svg {
    width: 1.75rem;
    height: 1.75rem;
  }

  .pp-name {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 700;
    color: inherit;
    font-family: var(--font-serif);
  }

  .pp-bio {
    margin: 0;
    font-size: 0.88rem;
    color: inherit;
    opacity: 0.8;
    max-width: 36ch;
  }

  .pp-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.6rem;
    font-size: 0.78rem;
    opacity: 0.6;
  }

  .pp-custom-fields {
    width: 100%;
    border-top: 1px solid var(--border);
    margin-top: 0.5rem;
    padding-top: 0.5rem;
  }

  .pp-custom-row {
    display: grid;
    grid-template-columns: 5rem 1fr;
    gap: 0.5rem;
    padding: 0.3rem 0;
    text-align: left;
    font-size: 0.78rem;
  }

  .pp-custom-key {
    opacity: 0.6;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-size: 0.72rem;
  }

  .pp-custom-value {
    color: inherit;
  }
</style>
