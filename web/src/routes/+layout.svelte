<script lang="ts">
  import { page } from '$app/state';
  import { setContext } from 'svelte';
  import type { LayoutProps } from './$types';
  import '../app.css';
  import AuthPanel from '$lib/features/auth/AuthPanel.svelte';
  import EditionSwitch from '$lib/components/cascade/EditionSwitch.svelte';
  import SiteNavigation from '$lib/components/cascade/SiteNavigation.svelte';
  import Footer from '$lib/components/cascade/Footer.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import type { SeoMetadata } from '$lib/seo';
  import { NDK_CONTEXT_KEY } from '$lib/ndk/utils/ndk';

  let { children }: LayoutProps = $props();
  const seo = $derived((page.data as { seo?: SeoMetadata }).seo);
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
  <header class="site-header">
    <div class="shell site-header-inner">
      <a class="site-brand" href="/">Cascade</a>

      <SiteNavigation />

      <div class="flex min-w-0 items-center justify-end gap-3">
        <EditionSwitch />
        <AuthPanel />
      </div>
    </div>
  </header>

  <main class="site-main">
    <div class="shell page">
      {@render children?.()}
    </div>
  </main>

  <Footer />
</div>
