<script lang="ts">
  type Item = {
    href: string;
    label: string;
    active?: boolean;
  };

  let { items }: { items: Item[] } = $props();
</script>

<nav class="tab-nav" aria-label="Section navigation">
  {#each items as item}
    <a class:active={item.active} href={item.href}>{item.label}</a>
  {/each}
</nav>

<style>
  .tab-nav {
    display: flex;
    gap: 1rem;
    border-bottom: 1px solid var(--border-subtle);
    overflow-x: auto;
  }

  .tab-nav a {
    flex: 0 0 auto;
    margin-bottom: -1px;
    border-bottom: 2px solid transparent;
    padding: 0.9rem 0;
    color: var(--text-faint);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .tab-nav a.active,
  .tab-nav a:hover,
  .tab-nav a:focus-visible {
    color: var(--text-strong);
    border-color: var(--text-strong);
    outline: none;
  }
</style>
