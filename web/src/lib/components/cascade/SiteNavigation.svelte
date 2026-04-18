<script lang="ts">
  import { page } from '$app/state';

  const items = [
    { href: '/', label: 'Markets' },
    { href: '/activity', label: 'Activity' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/bookmarks', label: 'Bookmarks' },
    { href: '/blog', label: 'Blog' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/builder', label: 'Create' }
  ];

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<nav
  class="order-3 w-full overflow-x-auto border-t border-base-300 pt-3 md:order-none md:w-auto md:border-t-0 md:pt-0"
  aria-label="Primary"
>
  <ul class="menu menu-horizontal min-h-0 flex-nowrap gap-4 bg-transparent p-0 text-sm font-medium">
    {#each items as item}
      <li>
        <a
          class={isActive(item.href)
            ? 'rounded-none border-b-2 border-white px-0 pb-2 pt-1 text-white hover:bg-transparent'
            : 'rounded-none border-b-2 border-transparent px-0 pb-2 pt-1 text-base-content/60 hover:bg-transparent hover:text-base-content'}
          href={item.href}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
