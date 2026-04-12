<script lang="ts">
  import { page } from '$app/state';

  const items = [
    { href: '/', label: 'Markets' },
    { href: '/activity', label: 'Activity' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/portfolio', label: 'Portfolio' }
  ];

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<nav class="cascade-nav" aria-label="Primary">
  {#each items as item}
    <a class:active={isActive(item.href)} href={item.href}>{item.label}</a>
  {/each}
</nav>

<style>
  .cascade-nav {
    display: flex;
    align-items: center;
    gap: 1.2rem;
    overflow-x: auto;
  }

  .cascade-nav a {
    flex: 0 0 auto;
    padding: 0.35rem 0;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-size: 0.84rem;
    font-weight: 500;
    letter-spacing: 0.01em;
    transition: color 140ms ease, border-color 140ms ease;
  }

  .cascade-nav a:hover,
  .cascade-nav a:focus-visible,
  .cascade-nav a.active {
    color: var(--text-strong);
    border-color: var(--text-strong);
    outline: none;
  }

  @media (max-width: 900px) {
    .cascade-nav {
      order: 3;
      width: 100%;
      padding-top: 0.75rem;
      border-top: 1px solid var(--border-subtle);
      gap: 1rem;
    }
  }
</style>
