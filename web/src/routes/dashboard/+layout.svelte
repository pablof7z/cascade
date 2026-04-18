<script lang="ts">
  import { page } from '$app/state';

  let { children } = $props();

  const primaryItems = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/fields', label: 'Fields' },
    { href: '/dashboard/agents', label: 'Agents' }
  ];

  const secondaryItems = [
    { href: '/dashboard/treasury', label: 'Treasury' },
    { href: '/dashboard/activity', label: 'Activity' },
    { href: '/dashboard/settings', label: 'Settings' }
  ];

  function isActive(href: string): boolean {
    if (href === '/dashboard') return page.url.pathname === '/dashboard';
    return page.url.pathname.startsWith(href);
  }
</script>

<section class="flex min-h-[calc(100vh-4rem)] flex-col md:flex-row">
  <aside class="shrink-0 md:w-[13.5rem] border-b border-base-300 md:border-b-0 md:border-r md:border-base-300">
    <nav class="flex flex-col gap-0 md:sticky md:top-16 md:min-h-[calc(100vh-4rem)] p-3 md:p-[1.25rem_0.85rem_1rem]">
      <div class="grid gap-1">
        {#each primaryItems as item}
          <a
            class="px-3 py-[0.55rem] text-sm font-medium rounded transition-colors {isActive(item.href) ? 'bg-base-300 text-white' : 'text-base-content/70 hover:bg-base-300 hover:text-white'}"
            href={item.href}
          >{item.label}</a>
        {/each}
      </div>

      <div class="my-3 border-t border-base-300"></div>

      <div class="grid gap-1">
        {#each secondaryItems as item}
          <a
            class="px-3 py-[0.55rem] text-sm font-medium rounded transition-colors {isActive(item.href) ? 'bg-base-300 text-white' : 'text-base-content/70 hover:bg-base-300 hover:text-white'}"
            href={item.href}
          >{item.label}</a>
        {/each}
      </div>

      <div class="flex-1"></div>

      <a class="btn btn-outline btn-sm mt-4" href="/dashboard/fields">New Field</a>
    </nav>
  </aside>

  <div class="min-w-0 flex-1">
    {@render children?.()}
  </div>
</section>
