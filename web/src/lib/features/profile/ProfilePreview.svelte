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
  class="card card-border bg-base-200 overflow-hidden"
  style:background-color={backgroundColor || undefined}
  style:color={foregroundColor || undefined}
>
  {#if bannerUrl}
    <figure class="aspect-[3/1] overflow-hidden bg-base-300">
      <img src={bannerUrl} alt="" class="w-full h-full object-cover" width="300" height="100" />
    </figure>
  {:else}
    <div class="aspect-[3/1] bg-base-300"></div>
  {/if}

  <div class="card-body gap-2 items-center text-center pt-0">
    <div class="-mt-8">
      {#if avatarUrl}
        <div class="avatar">
          <div class="h-16 w-16 rounded-full border-4 border-base-200">
            <img src={avatarUrl} alt={name || 'Avatar'} width="64" height="64" class="object-cover" />
          </div>
        </div>
      {:else}
        <div class="avatar avatar-placeholder">
          <div class="h-16 w-16 rounded-full border-4 border-base-200 bg-base-300 text-base-content/60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="w-7 h-7">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </div>
        </div>
      {/if}
    </div>

    <h2 class="text-lg font-bold font-serif">{name || 'Your Name'}</h2>
    <p class="text-sm opacity-80 max-w-[36ch]">{bio || 'Your bio will appear here.'}</p>

    <div class="flex flex-wrap justify-center gap-2 text-xs opacity-60">
      {#if nip05}
        <span>{nip05}</span>
      {/if}
      {#if website}
        <span>{websiteLabel(website)}</span>
      {/if}
    </div>

    {#if customFields.length > 0}
      <div class="w-full border-t border-base-300 mt-2 pt-2 grid gap-1">
        {#each customFields as field (field.key)}
          {#if field.key && field.value}
            <div class="grid grid-cols-[5rem_1fr] gap-2 text-left text-xs">
              <span class="opacity-60 uppercase tracking-[0.04em] text-[0.72rem]">{field.key}</span>
              <span>{field.value}</span>
            </div>
          {/if}
        {/each}
      </div>
    {/if}
  </div>
</div>
