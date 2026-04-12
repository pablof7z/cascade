<script lang="ts">
  import { formatUsd, loadDashboardWorkspace } from '$lib/dashboard/workspace';

  const workspace = loadDashboardWorkspace();
  const fields = workspace.fields;
  const totalAgents = fields.reduce((sum, field) => sum + field.council.length, 0);
  const totalMarkets = fields.reduce((sum, field) => sum + field.candidateMarkets.length, 0);
  const totalCapital = fields.reduce((sum, field) => sum + field.capital.fieldWalletUsd, 0);
  const deployedCapital = fields.reduce((sum, field) => sum + field.capital.deployedUsd, 0);
  const recentFields = [...fields].sort((left, right) => left.meeting.updatedAt.localeCompare(right.meeting.updatedAt));
</script>

<section class="dash-page">
  <div class="dash-header">
    <div>
      <div class="eyebrow">Dashboard</div>
      <h1>Your agents worked overnight. Here is the briefing.</h1>
      <p>
        The dashboard is the operator view: fields, staffing, capital, and the current debate across each workspace.
      </p>
    </div>
  </div>

  <section class="dash-summary">
    <div>
      <span>Fields</span>
      <strong>{fields.length}</strong>
    </div>
    <div>
      <span>Agents</span>
      <strong>{totalAgents}</strong>
    </div>
    <div>
      <span>Candidate markets</span>
      <strong>{totalMarkets}</strong>
    </div>
    <div>
      <span>Total capital</span>
      <strong>{formatUsd(totalCapital)}</strong>
    </div>
  </section>

  <section class="dash-grid">
    <article class="dash-section">
      <div class="dash-section-header">
        <h2>Fields at a glance</h2>
        <a href="/dashboard/fields">View all</a>
      </div>

      <div class="dash-list">
        {#each recentFields as field (field.id)}
          <a class="dash-row" href="/dashboard/field/{field.id}">
            <div>
              <strong>{field.name}</strong>
              <p>{field.recentUpdate}</p>
            </div>
            <div class="dash-row-aside">
              <span>{field.council.length} agents</span>
              <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
            </div>
          </a>
        {/each}
      </div>
    </article>

    <article class="dash-section">
      <div class="dash-section-header">
        <h2>Capital deployment</h2>
        <a href="/dashboard/treasury">Treasury</a>
      </div>

      <div class="capital-stack">
        <div>
          <span>Deployed</span>
          <strong>{formatUsd(deployedCapital)}</strong>
        </div>
        <div>
          <span>Available</span>
          <strong>{formatUsd(totalCapital - deployedCapital)}</strong>
        </div>
      </div>

      <div class="dash-list">
        {#each fields as field (field.id)}
          <div class="dash-row">
            <div>
              <strong>{field.name}</strong>
              <p>{field.capital.note}</p>
            </div>
            <div class="dash-row-aside">
              <span>{formatUsd(field.capital.availableUsd)} free</span>
              <span>{formatUsd(field.capital.monthlyBudgetUsd)} / mo</span>
            </div>
          </div>
        {/each}
      </div>
    </article>
  </section>
</section>

<style>
  .dash-page {
    display: grid;
    gap: 2rem;
    padding: 1.75rem;
  }

  .dash-header h1 {
    font-size: 2rem;
    letter-spacing: -0.04em;
  }

  .dash-header p {
    max-width: 52rem;
    margin-top: 0.7rem;
    color: var(--text-muted);
  }

  .dash-summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 1px;
    background: var(--border-subtle);
  }

  .dash-summary div {
    display: grid;
    gap: 0.35rem;
    background: var(--bg);
    padding: 1rem 1.1rem;
  }

  .dash-summary span {
    color: var(--text-faint);
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .dash-summary strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
    font-size: 1.1rem;
  }

  .dash-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 2rem;
  }

  .dash-section {
    display: grid;
    gap: 1rem;
  }

  .dash-section-header {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 1rem;
  }

  .dash-section-header h2 {
    font-size: 1rem;
  }

  .dash-section-header a {
    color: var(--text-faint);
    font-size: 0.85rem;
  }

  .dash-list {
    display: grid;
    border-top: 1px solid var(--border-subtle);
  }

  .dash-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .dash-row strong {
    display: block;
    color: var(--text-strong);
    font-size: 0.95rem;
  }

  .dash-row p {
    margin-top: 0.35rem;
    color: var(--text-muted);
    font-size: 0.88rem;
    line-height: 1.6;
  }

  .dash-row-aside {
    display: grid;
    gap: 0.3rem;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    text-align: right;
    white-space: nowrap;
  }

  .capital-stack {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1px;
    background: var(--border-subtle);
  }

  .capital-stack div {
    display: grid;
    gap: 0.4rem;
    background: var(--surface);
    padding: 1rem 1.1rem;
  }

  .capital-stack span {
    color: var(--text-faint);
    font-size: 0.78rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .capital-stack strong {
    color: var(--text-strong);
    font-family: var(--font-mono);
  }

  @media (max-width: 900px) {
    .dash-summary,
    .dash-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
