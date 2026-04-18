<script lang="ts">
  type Item = {
    href: string;
    label: string;
    active?: boolean;
  };

  let { items }: { items: Item[] } = $props();
</script>

<div role="tablist" class="tabs tabs-bordered w-full justify-start" aria-label="Section navigation">
  {#each items as item}
    <a
      role="tab"
      class={item.active
        ? 'tab tab-active text-sm font-medium'
        : 'tab text-sm font-medium text-base-content/60'}
      href={item.href}
    >
      {item.label}
    </a>
  {/each}
</div>
