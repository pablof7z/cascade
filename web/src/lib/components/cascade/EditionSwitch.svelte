<script lang="ts">
  import { page } from '$app/state';
  import { getCascadeEdition, type CascadeEdition } from '$lib/cascade/config';

  const edition = $derived(getCascadeEdition(page.data.cascadeEdition ?? null));

  function hrefFor(target: CascadeEdition): string {
    const next = new URL(page.url);
    next.searchParams.set('edition', target);
    return `${next.pathname}${next.search}${next.hash}`;
  }
</script>

<div class="join" role="radiogroup" aria-label="Trading mode">
  <a
    class="btn btn-sm join-item"
    class:btn-neutral={edition === 'mainnet'}
    class:btn-ghost={edition !== 'mainnet'}
    href={hrefFor('mainnet')}
    aria-checked={edition === 'mainnet'}
    role="radio"
    title="Live"
    data-sveltekit-reload
  >
    Live
  </a>
  <a
    class="btn btn-sm join-item"
    class:btn-neutral={edition === 'signet'}
    class:btn-ghost={edition !== 'signet'}
    href={hrefFor('signet')}
    aria-checked={edition === 'signet'}
    role="radio"
    title="Practice"
    data-sveltekit-reload
  >
    Practice
  </a>
</div>
