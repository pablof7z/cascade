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

<section class="dash-shell">
  <aside class="dash-sidebar">
    <nav class="dash-nav">
      <div class="dash-group">
        {#each primaryItems as item}
          <a class:active={isActive(item.href)} href={item.href}>{item.label}</a>
        {/each}
      </div>

      <div class="dash-divider"></div>

      <div class="dash-group">
        {#each secondaryItems as item}
          <a class:active={isActive(item.href)} href={item.href}>{item.label}</a>
        {/each}
      </div>

      <div class="dash-spacer"></div>

      <a class="dash-create" href="/dashboard/fields">New Field</a>
    </nav>
  </aside>

  <div class="dash-main">
    {@render children?.()}
  </div>
</section>

<style>
  .dash-shell {
    display: flex;
    min-height: calc(100vh - 4rem);
  }

  .dash-sidebar {
    width: 13.5rem;
    flex-shrink: 0;
    border-right: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .dash-nav {
    position: sticky;
    top: 4rem;
    display: flex;
    min-height: calc(100vh - 4rem);
    flex-direction: column;
    padding: 1.25rem 0.85rem 1rem;
  }

  .dash-group {
    display: grid;
    gap: 0.2rem;
  }

  .dash-group a {
    padding: 0.55rem 0.8rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .dash-group a:hover,
  .dash-group a.active {
    background: var(--color-base-300);
    color: white;
  }

  .dash-divider {
    margin: 0.8rem 0;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .dash-spacer {
    flex: 1;
  }

  .dash-create {
    border: 1px solid var(--color-neutral);
    padding: 0.7rem 0.8rem;
    color: var(--color-base-content);
    font-size: 0.92rem;
    font-weight: 500;
    text-align: center;
  }

  .dash-create:hover {
    border-color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    color: white;
  }

  .dash-main {
    min-width: 0;
    flex: 1;
  }

  @media (max-width: 960px) {
    .dash-shell {
      flex-direction: column;
    }

    .dash-sidebar {
      width: auto;
      border-right: 0;
      border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    }

    .dash-nav {
      min-height: auto;
      position: static;
    }
  }
</style>
