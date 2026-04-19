<script lang="ts">
  import { page } from '$app/state';
  import { setContext } from 'svelte';
  import type { LayoutProps } from './$types';
  import '../app.css';
  import AuthPanel from '$lib/features/auth/AuthPanel.svelte';
  import EditionSwitch from '$lib/components/cascade/EditionSwitch.svelte';
  import SiteNavigation from '$lib/components/cascade/SiteNavigation.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import type { SeoMetadata } from '$lib/seo';
  import { NDK_CONTEXT_KEY } from '$lib/ndk/utils/ndk';

  let { children }: LayoutProps = $props();
  const seo = $derived((page.data as { seo?: SeoMetadata }).seo);
  const hideRightRail = $derived((page.data as { hideRightRail?: boolean }).hideRightRail === true);
  setContext(NDK_CONTEXT_KEY, ndk);

  $effect(() => {
    if (typeof window === 'undefined') return;
    void ensureClientNdk().catch((error) => {
      console.error('Failed to connect client NDK', error);
    });
  });
</script>

{#if seo}
  <SeoHead {seo} />
{/if}

<div class="site-frame">
  <div class="column-shell" class:column-shell--no-right-rail={hideRightRail}>
    <aside class="column-rail" aria-label="Primary">
      <a class="column-brand" href="/" aria-label="Cascade home">
        <span class="column-logo" aria-hidden="true">C</span>
        <span class="column-wordmark labels">Cascade</span>
      </a>

      <SiteNavigation />

      <a class="rail-cta" href="/builder">
        <span aria-hidden="true">+</span>
        <span class="labels">Publish a claim</span>
      </a>

      <div class="rail-spacer"></div>

      <div class="rail-bottom">
        <EditionSwitch />
        <AuthPanel />
        <a class="rail-more" href="/how-it-works">
          <svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          <span class="labels">More</span>
        </a>
      </div>
    </aside>

    <main class="column-center">
      <div class="page">
        {@render children?.()}
      </div>
    </main>

    {#if !hideRightRail}
      <aside class="column-right" aria-label="Context">
        <label class="column-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
          </svg>
          <input type="search" placeholder="Search Cascade" aria-label="Search Cascade" />
        </label>

        <section class="rail-card" aria-labelledby="column-up-next">
          <div class="rail-card-head">
            <h2 id="column-up-next">Up next</h2>
            <a href="/activity">Activity</a>
          </div>
          <p class="rail-card-empty">Claims from your graph will appear here as live events arrive.</p>
        </section>

        <section class="rail-card" aria-labelledby="column-writers">
          <div class="rail-card-head">
            <h2 id="column-writers">Writers</h2>
            <a href="/profile">Profile</a>
          </div>
          <p class="rail-card-empty">Subscribe suggestions will appear after profile data is available.</p>
        </section>
      </aside>
    {/if}
  </div>
</div>
