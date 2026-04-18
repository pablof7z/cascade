<script lang="ts">
  import { page } from '$app/state';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  const items = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/fields', label: 'Fields' },
    { href: '/dashboard/field', label: 'Active Field' },
    { href: '/dashboard/agents', label: 'Agents' },
    { href: '/dashboard/treasury', label: 'Treasury' },
    { href: '/dashboard/activity', label: 'Activity' },
    { href: '/dashboard/settings', label: 'Settings' }
  ];

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<div class="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
  <aside>
    <ul class="menu w-full bg-transparent p-0 text-sm">
      {#each items as item}
        <li>
          <a href={item.href} class:menu-active={isActive(item.href)}>{item.label}</a>
        </li>
      {/each}
    </ul>
  </aside>
  <main class="grid gap-6">
    {@render children?.()}
  </main>
</div>
