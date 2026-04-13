<script lang="ts">
  import { page } from '$app/state';
  import { onMount, setContext } from 'svelte';
  import type { LayoutProps } from './$types';
  import '../app.css';
  import AuthPanel from '$lib/features/auth/AuthPanel.svelte';
  import SiteNavigation from '$lib/components/cascade/SiteNavigation.svelte';
  import Footer from '$lib/components/cascade/Footer.svelte';
  import SeoHead from '$lib/components/SeoHead.svelte';
  import { ndk, ensureClientNdk } from '$lib/ndk/client';
  import type { SeoMetadata } from '$lib/seo';
  import { NDK_CONTEXT_KEY } from '$lib/ndk/utils/ndk';

  let { children }: LayoutProps = $props();
  const seo = $derived((page.data as { seo?: SeoMetadata }).seo);
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

</style>
