<script lang="ts">
  import { formatUsd, loadDashboardWorkspace, type Field } from '$lib/dashboard/workspace';

  const workspace = loadDashboardWorkspace();
  const fields = workspace.fields;
  const active = fields.filter((field) => field.attention !== 'steady');
  const watching = fields.filter((field) => field.attention === 'steady');
  const sections: { label: string; items: Field[] }[] = [
    { label: 'Active', items: active },
    { label: 'Watching', items: watching }
  ].filter((section) => section.items.length > 0);

  function attentionLabel(value: Field['attention']): string {
    if (value === 'needs-input') return 'Needs input';
    if (value === 'review') return 'Review';
    return 'Steady';
  }
</script>

<section class="fields-page">
  <div class="fields-header">
    <div>
      <div class="eyebrow">Fields</div>
      <h1>Fields</h1>
      <p>{fields.length} active workspaces across research, debate, and capital allocation.</p>
    </div>
    <a class="fields-button" href="/dashboard/fields">New Field</a>
  </div>

  {#each sections as section (section.label)}
    <section class="field-section">
      <div class="field-section-meta">
        <span>{section.label}</span>
        <small>{section.items.length}</small>
      </div>

      <div class="field-table">
        <div class="field-head">
          <span>Name / Conviction</span>
          <span>Status</span>
          <span>Agents</span>
          <span>Markets</span>
          <span>Capital</span>
          <span>Updated</span>
        </div>

        {#each section.items as field (field.id)}
          <a class="field-row" href="/dashboard/field/{field.id}">
            <div>
              <strong>{field.name}</strong>
              <p>{field.conviction}</p>
            </div>
            <span>{attentionLabel(field.attention)}</span>
            <span>{field.council.length}</span>
            <span>{field.candidateMarkets.length}</span>
            <span>{formatUsd(field.capital.deployedUsd)}</span>
            <span>{field.meeting.updatedAt}</span>
          </a>
        {/each}
      </div>
    </section>
  {/each}
</section>

<style>
  .fields-page {
    display: grid;
    gap: 2rem;
    padding: 1.75rem;
  }

  .fields-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .fields-header h1 {
    font-size: 1.2rem;
  }

  .fields-header p {
    margin-top: 0.4rem;
    color: var(--text-muted);
  }

  .fields-button {
    border: 1px solid var(--border);
    padding: 0.7rem 0.95rem;
    color: var(--text-strong);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .field-section {
    display: grid;
    gap: 0.7rem;
  }

  .field-section-meta {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--text-faint);
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .field-table {
    border-top: 1px solid var(--border-subtle);
  }

  .field-head,
  .field-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto auto auto auto;
    gap: 1rem;
    align-items: start;
  }

  .field-head {
    padding: 0.7rem 0;
    color: var(--text-faint);
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .field-row {
    padding: 1rem 0;
    border-top: 1px solid var(--border-subtle);
  }

  .field-row:hover {
    background: rgba(255, 255, 255, 0.02);
  }

  .field-row strong {
    display: block;
    color: var(--text-strong);
    font-size: 0.95rem;
  }

  .field-row p {
    margin-top: 0.35rem;
    color: var(--text-muted);
    font-size: 0.86rem;
    line-height: 1.6;
  }

  .field-row span {
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.8rem;
    white-space: nowrap;
  }

  @media (max-width: 960px) {
    .field-head {
      display: none;
    }

    .field-row {
      grid-template-columns: 1fr;
      gap: 0.4rem;
    }
  }
</style>
