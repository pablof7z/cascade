<script lang="ts">
  import { page } from '$app/state';
  import { onMount, setContext } from 'svelte';
  import type { LayoutProps } from './$types';
  import '../app.css';
  import AuthPanel from '$lib/features/auth/AuthPanel.svelte';
  import SiteNavigation from '$lib/components/cascade/SiteNavigation.svelte';
  import Footer from '$lib/components/cascade/Footer.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import {
    getAlternateEditionUrl,
    getCascadeEditionDescription,
    getCascadeEditionLabel
  } from '$lib/cascade/config';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import type { SeoMetadata } from '$lib/seo';
  import { NDK_CONTEXT_KEY } from '$lib/ndk/utils/ndk';

  let { children }: LayoutProps = $props();
  const seo = $derived((page.data as { seo?: SeoMetadata }).seo);
  const editionLabel = getCascadeEditionLabel();
  const editionDescription = getCascadeEditionDescription();
  const alternateEditionUrl = getAlternateEditionUrl();
  const alternateEditionLabel = editionLabel.startsWith('Signet') ? 'Open mainnet' : 'Open signet';

  setContext(NDK_CONTEXT_KEY, ndk);

  onMount(() => {
    void ensureClientNdk().catch((error) => {
      console.error('Failed to connect client NDK', error);
    });
  });
</script>

{#if seo}
  <SeoHead {seo} />
{/if}

<div class="site-frame">
  <header class="site-header">
    <div class="shell site-header-inner">
      <a class="site-brand" href="/">Cascade</a>

      <SiteNavigation />

      <div class="auth-panel-shell">
        <AuthPanel />
      </div>
    </div>
  </header>

  <div class="edition-banner">
    <div class="shell edition-banner-inner">
      <div class="edition-copy">
        <strong>{editionLabel}</strong>
        <span>{editionDescription}</span>
      </div>

      {#if alternateEditionUrl}
        <a class="edition-link" href={alternateEditionUrl}>{alternateEditionLabel}</a>
      {/if}
    </div>
  </div>

  <main class="site-main">
    <div class="shell page">
      {@render children?.()}
    </div>
  </main>

  <Footer />
</div>

<style>
  .auth-panel-shell {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    min-width: 0;
  }

  .edition-banner {
    border-bottom: 1px solid var(--border-subtle);
    background: rgba(23, 23, 23, 0.92);
  }

  .edition-banner-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.85rem 0;
  }

  .edition-copy {
    display: grid;
    gap: 0.18rem;
  }

  .edition-copy strong {
    color: var(--text-strong);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .edition-copy span {
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  .edition-link {
    flex: 0 0 auto;
    color: var(--text-strong);
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: underline;
    text-underline-offset: 0.16em;
  }

  @media (max-width: 900px) {
    .edition-banner-inner {
      align-items: flex-start;
      flex-direction: column;
    }
  }
</style>
