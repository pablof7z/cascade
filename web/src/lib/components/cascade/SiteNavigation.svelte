<script lang="ts">
  import { page } from '$app/state';

  const items = [
    { href: '/', label: 'Home', icon: 'home' },
    { href: '/activity', label: 'Activity', icon: 'activity' },
    { href: '/bookmarks', label: 'Bookmarks', icon: 'bookmark' },
    { href: '/portfolio', label: 'Portfolio', icon: 'portfolio' },
    { href: '/profile', label: 'Profile', icon: 'profile' }
  ];

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<nav class="rail-nav" aria-label="Primary navigation">
  {#each items as item}
    <a class="rail-item" href={item.href} aria-current={isActive(item.href) ? 'page' : undefined}>
      {#if item.icon === 'home'}
        <svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />
        </svg>
      {:else if item.icon === 'activity'}
        <svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0a3 3 0 0 1-6 0" />
        </svg>
      {:else if item.icon === 'bookmark'}
        <svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4.75A1.75 1.75 0 0 1 7.75 3h8.5A1.75 1.75 0 0 1 18 4.75V21l-6-3.5L6 21V4.75Z" />
        </svg>
      {:else if item.icon === 'portfolio'}
        <svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7.5h16v11H4zM7 7.5V5.75A1.75 1.75 0 0 1 8.75 4h6.5A1.75 1.75 0 0 1 17 5.75V7.5M16 13h4" />
        </svg>
      {:else}
        <svg class="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      {/if}
      <span class="labels">{item.label}</span>
    </a>
  {/each}
</nav>
