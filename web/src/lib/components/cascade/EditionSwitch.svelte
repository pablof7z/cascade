<script lang="ts">
  import { page } from '$app/state';
  import {
    getCascadeEdition,
    type CascadeEdition
  } from '$lib/cascade/config';

  const edition = $derived(getCascadeEdition(page.data.cascadeEdition ?? null));

  function hrefFor(target: CascadeEdition): string {
    const next = new URL(page.url);
    next.searchParams.set('edition', target);
    return `${next.pathname}${next.search}${next.hash}`;
  }

  function isActive(target: CascadeEdition): boolean {
    return edition === target;
  }
</script>

<div
  class="inline-flex h-9 shrink-0 items-center rounded border border-base-300 bg-base-100 p-0.5 text-xs font-semibold"
  role="radiogroup"
  aria-label="Trading mode"
>
  <a
    class={isActive('mainnet')
      ? 'grid h-7 min-w-14 place-items-center rounded-sm bg-white px-3 text-base-content'
      : 'grid h-7 min-w-14 place-items-center rounded-sm px-3 text-base-content/50 hover:text-base-content/90'}
    href={hrefFor('mainnet')}
    aria-checked={isActive('mainnet')}
    role="radio"
    title="Live"
    data-sveltekit-reload
  >
    Live
  </a>
  <a
    class={isActive('signet')
      ? 'grid h-7 min-w-20 place-items-center rounded-sm bg-white px-3 text-base-content'
      : 'grid h-7 min-w-20 place-items-center rounded-sm px-3 text-base-content/50 hover:text-base-content/90'}
    href={hrefFor('signet')}
    aria-checked={isActive('signet')}
    role="radio"
    title="Practice"
    data-sveltekit-reload
  >
    Practice
  </a>
</div>
