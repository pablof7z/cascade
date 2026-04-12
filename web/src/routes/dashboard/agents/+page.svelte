<script lang="ts">
  import { formatUsd, loadDashboardWorkspace, type FieldAgent } from '$lib/dashboard/workspace';

  type AgentRow = FieldAgent & {
    fieldId: string;
    fieldName: string;
  };

  const workspace = loadDashboardWorkspace();
  const agents: AgentRow[] = workspace.fields.flatMap((field) =>
    field.council.map((agent) => ({ ...agent, fieldId: field.id, fieldName: field.name }))
  );
  const activeCount = agents.filter((agent) => agent.status !== 'monitoring').length;
  const idleCount = agents.filter((agent) => agent.status === 'monitoring').length;
  const totalCapital = agents.reduce((sum, agent) => sum + agent.wallet.balanceUsd, 0);

  function initials(name: string): string {
    const parts = name.trim().split(' ');
    return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? parts[0]?.[1] ?? '');
  }
</script>

<section class="agents-page">
  <div class="agents-header">
    <div>
      <div class="eyebrow">Agents</div>
      <h1>Agents</h1>
      <p>AI agents working across your fields.</p>
    </div>
    <a class="agents-button" href="/dashboard/agents">Hire Agent</a>
  </div>

  <section class="agents-summary">
    <div>
      <span>Total agents</span>
      <strong>{agents.length}</strong>
    </div>
    <div>
      <span>Active</span>
      <strong class="positive">{activeCount}</strong>
    </div>
    <div>
      <span>Idle</span>
      <strong>{idleCount}</strong>
    </div>
    <div>
      <span>Capital deployed</span>
      <strong>{formatUsd(totalCapital)}</strong>
    </div>
  </section>

  <div class="agents-list">
    {#each agents as agent (`${agent.fieldId}-${agent.id}`)}
      <div class="agent-row">
        <div class="agent-avatar">{initials(agent.name).toUpperCase()}</div>
        <div class="agent-copy">
          <strong>{agent.name}</strong>
          <p>{agent.role}</p>
          <small>{agent.focus}</small>
        </div>
        <div class="agent-meta">
          <span>Field</span>
          <strong>{agent.fieldName}</strong>
        </div>
        <div class="agent-meta">
          <span>Wallet</span>
          <strong>{formatUsd(agent.wallet.balanceUsd)}</strong>
        </div>
        <div class="agent-meta">
          <span>Status</span>
          <strong>{agent.status === 'monitoring' ? 'Idle' : 'Active'}</strong>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .agents-page {
    display: grid;
    gap: 2rem;
    padding: 1.75rem;
  }

  .agents-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .agents-header h1 {
    font-size: 1.2rem;
  }

  .agents-header p {
    margin-top: 0.4rem;
    color: var(--text-muted);
  }

  .agents-button {
    border: 1px solid var(--border);
    padding: 0.7rem 0.95rem;
    color: var(--text-strong);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .agents-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: var(--border-subtle);
  }

  .agents-summary div {
    display: grid;
    gap: 0.35rem;
    background: var(--bg);
    padding: 1rem;
  }

  .agents-summary span {
    color: var(--text-faint);
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .agents-summary strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .agents-summary strong.positive {
    color: var(--positive);
  }

  .agents-list {
    display: grid;
    border-top: 1px solid var(--border-subtle);
  }

  .agent-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(8rem, auto) minmax(8rem, auto) minmax(6rem, auto);
    gap: 1rem;
    align-items: center;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .agent-avatar {
    display: flex;
    height: 2.2rem;
    width: 2.2rem;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 600;
  }

  .agent-copy strong {
    display: block;
    color: var(--text-strong);
    font-size: 0.94rem;
  }

  .agent-copy p,
  .agent-copy small,
  .agent-meta span {
    color: var(--text-muted);
  }

  .agent-copy p {
    margin-top: 0.2rem;
    font-size: 0.82rem;
  }

  .agent-copy small {
    display: block;
    margin-top: 0.35rem;
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .agent-meta {
    display: grid;
    gap: 0.25rem;
    text-align: right;
  }

  .agent-meta span {
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .agent-meta strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 0.82rem;
  }

  @media (max-width: 980px) {
    .agents-summary {
      grid-template-columns: 1fr;
    }

    .agent-row {
      grid-template-columns: auto 1fr;
    }

    .agent-meta {
      text-align: left;
    }
  }
</style>
