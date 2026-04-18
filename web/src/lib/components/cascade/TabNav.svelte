<script lang="ts">
  type Item = {
    href: string;
    label: string;
    active?: boolean;
  };

  let { items }: { items: Item[] } = $props();
</script>

<nav
  class="tabs tabs-bordered w-full justify-start gap-4 border-b border-base-300 bg-transparent p-0"
  aria-label="Section navigation"
>
  {#each items as item}
    <a
      class={item.active
        ? 'tab h-auto flex-none rounded-none border-b-2 border-white px-0 pb-3 pt-0 text-sm font-medium text-white'
        : 'tab h-auto flex-none rounded-none border-b-2 border-transparent px-0 pb-3 pt-0 text-sm font-medium text-base-content/50 hover:text-base-content/80'}
      href={item.href}
    >
      {item.label}
    </a>
  {/each}
</nav>
