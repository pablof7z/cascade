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

<section class="settings-page">
  <div>
    <div class="eyebrow">Settings</div>
    <h1>Settings</h1>
    <p>Manage your agents, permissions, and account preferences.</p>
  </div>

  <section class="settings-section">
    <h2>Connected Agents</h2>
    <p>No connected agents yet.</p>
    <a class="settings-button" href="/dashboard/agents">Connect Agent</a>
  </section>

  <section class="settings-section">
    <h2>Default Permissions</h2>
    <label><input bind:group={permission} type="radio" value="propose-only" /> Propose only</label>
    <label><input bind:group={permission} type="radio" value="trade-with-approval" /> Trade with approval</label>
    <label><input bind:group={permission} type="radio" value="autonomous" /> Autonomous within limits</label>

    {#if permission === 'autonomous'}
      <div class="settings-inline">
        <span>Capital limit</span>
        <input bind:value={capitalLimit} type="number" min="0" step="1" />
      </div>
    {/if}
  </section>

  <section class="settings-section">
    <h2>Notifications</h2>
    <label><input bind:checked={notifyProposals} type="checkbox" /> New position proposals</label>
    <label><input bind:checked={notifyMeeting} type="checkbox" /> Meeting activity</label>
    <label><input bind:checked={notifyDigest} type="checkbox" /> Daily digest</label>
  </section>
</section>

<style>
  .settings-page {
    display: grid;
    gap: 2rem;
    padding: 1.75rem;
    max-width: 46rem;
  }

  .settings-page h1 {
    font-size: 1.2rem;
  }

  .settings-page p {
    margin-top: 0.4rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .settings-section {
    display: grid;
    gap: 0.9rem;
    padding-top: 1.5rem;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .settings-section h2 {
    font-size: 1rem;
  }

  .settings-section label {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: var(--color-base-content);
    font-size: 0.92rem;
  }

  .settings-button {
    width: fit-content;
    border: 1px solid var(--color-neutral);
    padding: 0.7rem 0.95rem;
    color: white;
    font-size: 0.92rem;
    font-weight: 500;
  }

  .settings-inline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .settings-inline span {
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    font-size: 0.86rem;
  }

  .settings-inline input {
    width: 8rem;
    border: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    background: var(--color-base-100);
    color: white;
    padding: 0.55rem 0.7rem;
  }
</style>
