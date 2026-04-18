<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { loadAgentSettings, saveAgentSettings, type AgentSettings } from '$lib/cascade/settings';

  // Initialize with defaults (safe for SSR)
  let permission: AgentSettings['permission'] = $state('propose-only');
  let capitalLimit = $state('500');
  let notifyMeeting = $state(true);
  let notifyProposals = $state(true);
  let notifyDigest = $state(false);

  let loaded = $state(false);

  onMount(() => {
    const saved = loadAgentSettings();
    permission = saved.permission;
    capitalLimit = saved.capitalLimit;
    notifyMeeting = saved.notifyMeeting;
    notifyProposals = saved.notifyProposals;
    notifyDigest = saved.notifyDigest;
    loaded = true;
  });

  $effect(() => {
    if (!loaded) return; // Don't save before loaded
    saveAgentSettings({ permission, capitalLimit, notifyMeeting, notifyProposals, notifyDigest });
  });
</script>

<div class="grid gap-8 p-7 max-w-[46rem]">
  <div>
    <div class="eyebrow">Settings</div>
    <h1 class="text-xl mt-1">Settings</h1>
    <p class="mt-2 text-base-content/70">Manage your agents, permissions, and account preferences.</p>
  </div>

  <section class="grid gap-4 pt-6 border-t border-base-300">
    <h2 class="text-base font-medium">Connected Agents</h2>
    <p class="text-base-content/70 text-sm">No connected agents yet.</p>
    <a class="btn btn-outline btn-sm w-fit" href="/dashboard/agents">Connect Agent</a>
  </section>

  <section class="grid gap-4 pt-6 border-t border-base-300">
    <h2 class="text-base font-medium">Default Permissions</h2>
    <label class="flex items-center gap-3 text-sm"><input bind:group={permission} type="radio" value="propose-only" /> Propose only</label>
    <label class="flex items-center gap-3 text-sm"><input bind:group={permission} type="radio" value="trade-with-approval" /> Trade with approval</label>
    <label class="flex items-center gap-3 text-sm"><input bind:group={permission} type="radio" value="autonomous" /> Autonomous within limits</label>

    {#if permission === 'autonomous'}
      <div class="flex items-center gap-3">
        <span class="text-base-content/70 text-sm">Capital limit</span>
        <input class="w-32 border border-base-300 bg-base-100 text-white px-3 py-2 text-sm" bind:value={capitalLimit} type="number" min="0" step="1" />
      </div>
    {/if}
  </section>

  <section class="grid gap-4 pt-6 border-t border-base-300">
    <h2 class="text-base font-medium">Notifications</h2>
    <label class="flex items-center gap-3 text-sm"><input bind:checked={notifyProposals} type="checkbox" /> New position proposals</label>
    <label class="flex items-center gap-3 text-sm"><input bind:checked={notifyMeeting} type="checkbox" /> Meeting activity</label>
    <label class="flex items-center gap-3 text-sm"><input bind:checked={notifyDigest} type="checkbox" /> Daily digest</label>
  </section>
</div>
