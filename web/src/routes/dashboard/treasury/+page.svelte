<script lang="ts">
  import { formatUsd, loadDashboardWorkspace } from '$lib/dashboard/workspace';

  const workspace = loadDashboardWorkspace();
  const fields = workspace.fields;
  const totalCapital = fields.reduce((sum, field) => sum + field.capital.fieldWalletUsd, 0);
  const deployed = fields.reduce((sum, field) => sum + field.capital.deployedUsd, 0);
  const available = fields.reduce((sum, field) => sum + field.capital.availableUsd, 0);
  const positions = fields.flatMap((field) =>
    field.positions.map((position) => ({ fieldId: field.id, fieldName: field.name, ...position }))
  );
  const transactions = fields.flatMap((field) =>
    field.meeting.actions.map((action) => ({ fieldId: field.id, fieldName: field.name, ...action }))
  );
</script>

<section class="treasury-page">
  <div>
    <div class="eyebrow">Treasury</div>
    <h1>Treasury</h1>
    <p>Capital allocation across all fields and agents.</p>
  </div>

  <section class="treasury-summary">
    <div>
      <span>Total capital</span>
      <strong>{formatUsd(totalCapital)}</strong>
    </div>
    <div>
      <span>Deployed</span>
      <strong>{formatUsd(deployed)}</strong>
    </div>
    <div>
      <span>Available</span>
      <strong>{formatUsd(available)}</strong>
    </div>
    <div>
      <span>Overall P&amp;L</span>
      <strong>-</strong>
    </div>
  </section>

  <section class="treasury-section">
    <h2>By Field</h2>
    <div class="treasury-list">
      {#each fields as field (field.id)}
        <div class="treasury-row">
          <div>
            <strong>{field.name}</strong>
            <p>{field.capital.note}</p>
          </div>
          <div class="treasury-aside">
            <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
            <span>{formatUsd(field.capital.availableUsd)} available</span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="treasury-section">
    <h2>Open Positions</h2>
    <div class="treasury-list">
      {#each positions as position (position.id)}
        <div class="treasury-row">
          <div>
            <strong>{position.label}</strong>
            <p>{position.fieldName} · {position.thesis}</p>
          </div>
          <div class="treasury-aside">
            <span>{formatUsd(position.exposureUsd)}</span>
            <span>{position.status}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="treasury-section">
    <h2>Recent Transactions</h2>
    <div class="treasury-list">
      {#each transactions as action (action.id)}
        <div class="treasury-row">
          <div>
            <strong>{action.title}</strong>
            <p>{action.fieldName} · {action.rationale}</p>
          </div>
          <div class="treasury-aside">
            <span>{action.status}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>
</section>

<style>
  .treasury-page {
    display: grid;
    gap: 2rem;
    padding: 1.75rem;
  }

  .treasury-page h1 {
    font-size: 1.2rem;
  }

  .treasury-page p {
    margin-top: 0.4rem;
    color: var(--text-muted);
  }

  .treasury-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: var(--border-subtle);
  }

  .treasury-summary div {
    display: grid;
    gap: 0.35rem;
    background: var(--bg);
    padding: 1rem;
  }

  .treasury-summary span {
    color: var(--text-faint);
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .treasury-summary strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1rem;
  }

  .treasury-section {
    display: grid;
    gap: 0.8rem;
  }

  .treasury-section h2 {
    font-size: 1rem;
  }

  .treasury-list {
    display: grid;
    border-top: 1px solid var(--border-subtle);
  }

  .treasury-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .treasury-row strong {
    display: block;
    color: var(--text-strong);
    font-size: 0.94rem;
  }

  .treasury-row p {
    margin-top: 0.35rem;
    font-size: 0.86rem;
    line-height: 1.6;
  }

  .treasury-aside {
    display: grid;
    gap: 0.25rem;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    text-align: right;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .treasury-summary {
      grid-template-columns: 1fr;
    }
  }
</style>
