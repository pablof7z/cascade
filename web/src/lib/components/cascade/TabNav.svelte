<script lang="ts">
  type Item = {
    href: string;
    label: string;
    active?: boolean;
    count?: number;
  };

  let { items }: { items: Item[] } = $props();
</script>

<nav class="flex flex-wrap gap-6 border-b border-base-300 text-sm" aria-label="Section navigation">
  {#each items as item}
    <a
      class="inline-block border-b-2 pb-3 font-medium transition-colors {item.active ? 'border-base-content text-base-content' : 'border-transparent text-base-content/60'}"
      href={item.href}
    >
      {item.label}{#if item.count !== undefined}<span class="ml-1 font-mono text-xs opacity-70">{item.count.toLocaleString()}</span>{/if}
    </a>
  {/each}
</nav>