<script lang="ts">
  interface Tab {
    key: string;
    label: string;
  }

  interface Props {
    tabs: Tab[];
    activeTab: string;
    onTabChange?: (key: string) => void;
    class?: string;
  }

  let { tabs, activeTab, onTabChange, class: className = '' }: Props = $props();

  function handleTabClick(key: string) {
    if (onTabChange) {
      onTabChange(key);
    }
  }
</script>

<nav class="flex gap-1 border-b border-neutral-800 {className}">
  {#each tabs as tab}
    <button
      onclick={() => handleTabClick(tab.key)}
      class="px-4 py-3 text-sm font-medium transition-colors -mb-px border-b-2 {
        activeTab === tab.key
          ? 'border-white text-white'
          : 'border-transparent text-neutral-500 hover:text-neutral-300'
      }"
    >
      {tab.label}
    </button>
  {/each}
</nav>
