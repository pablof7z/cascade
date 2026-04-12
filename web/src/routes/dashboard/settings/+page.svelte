<script lang="ts">
  let permission = $state<'propose-only' | 'trade-with-approval' | 'autonomous'>('propose-only');
  let capitalLimit = $state('500');
  let notifyMeeting = $state(true);
  let notifyProposals = $state(true);
  let notifyDigest = $state(false);
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
        <input bind:value={capitalLimit} type="number" />
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
    color: var(--text-muted);
  }

  .settings-section {
    display: grid;
    gap: 0.9rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--border-subtle);
  }

  .settings-section h2 {
    font-size: 1rem;
  }

  .settings-section label {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    color: var(--text);
    font-size: 0.92rem;
  }

  .settings-button {
    width: fit-content;
    border: 1px solid var(--border);
    padding: 0.7rem 0.95rem;
    color: var(--text-strong);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .settings-inline {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .settings-inline span {
    color: var(--text-muted);
    font-size: 0.86rem;
  }

  .settings-inline input {
    width: 8rem;
    border: 1px solid var(--border-subtle);
    background: var(--bg);
    color: var(--text-strong);
    padding: 0.55rem 0.7rem;
  }
</style>
