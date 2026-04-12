<script lang="ts">
  import { page } from '$app/state';

  const items = [
    { href: '/', label: 'Read' },
    { href: '/bookmarks', label: 'Bookmarks' },
    { href: '/relays', label: 'Relays' }
  ];

  function isActive(href: string): boolean {
    const pathname = page.url.pathname;
    if (href === '/') return pathname === '/';
    if (href === '/relays') return pathname === '/relays' || pathname.startsWith('/relay/');
    return pathname === href || pathname.startsWith(`${href}/`);
  }
</script>

<nav class="site-navigation">
  {#each items as item (item.href)}
    <a
      href={item.href}
      class="site-navigation-link"
      class:active={isActive(item.href)}
      aria-current={isActive(item.href) ? 'page' : undefined}
    >
      {item.label}
    </a>
  {/each}
</nav>
