<script lang="ts">
  import { loadDashboardWorkspace } from '$lib/dashboard/workspace';

  type ActivityType = 'Meeting' | 'Proposal' | 'Position' | 'Source';
  type ActivityItem = {
    fieldName: string;
    at: string;
    title: string;
    detail: string;
    type: ActivityType;
  };

  const workspace = loadDashboardWorkspace();

  function ageRank(value: string): number {
    const [rawAmount = '9999', rawUnit = 'day'] = value.split(' ');
    const amount = Number.parseInt(rawAmount, 10);
    if (Number.isNaN(amount)) return 9999;
    if (rawUnit.startsWith('min')) return amount;
    if (rawUnit.startsWith('hour')) return amount * 60;
    return amount * 60 * 24;
  }

  const items: ActivityItem[] = workspace.fields
    .flatMap((field) => [
      ...field.meeting.entries.map((entry) => ({
        fieldName: field.name,
        at: entry.at,
        title: entry.headline,
        detail: entry.body,
        type: 'Meeting' as const
      })),
      ...field.meeting.actions.map((action) => ({
        fieldName: field.name,
        at: field.meeting.updatedAt,
        title: action.title,
        detail: action.rationale,
        type: 'Proposal' as const
      })),
      ...field.positions.map((position) => ({
        fieldName: field.name,
        at: field.meeting.updatedAt,
        title: position.label,
        detail: position.thesis,
        type: 'Position' as const
      })),
      ...field.sourceLibrary.map((source) => ({
        fieldName: field.name,
        at: source.addedAt,
        title: source.title,
        detail: source.relevance,
        type: 'Source' as const
      }))
    ])
    .sort((left, right) => ageRank(left.at) - ageRank(right.at));
</script>

<section class="workspace-activity">
  <div>
    <div class="eyebrow">Activity</div>
    <h1>Activity</h1>
    <p>Everything happening across your workspace, most recent first.</p>
  </div>

  <div class="activity-legend">
    <span>Entry types:</span>
    <small>Meeting</small>
    <small>Proposal</small>
    <small>Position</small>
    <small>Source</small>
  </div>

  <div class="activity-list">
    {#each items as item (`${item.fieldName}-${item.title}`)}
      <div class="activity-row">
        <div class="activity-copy">
          <strong>{item.title}</strong>
          <p>{item.fieldName} · {item.detail}</p>
        </div>
        <div class="activity-meta">
          <span>{item.type}</span>
          <span>{item.at}</span>
        </div>
      </div>
    {/each}
  </div>
</section>

<style>
  .workspace-activity {
    display: grid;
    gap: 1.5rem;
    padding: 1.75rem;
  }

  .workspace-activity h1 {
    font-size: 1.2rem;
  }

  .workspace-activity p {
    margin-top: 0.4rem;
    color: var(--text-muted);
  }

  .activity-legend {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    border-bottom: 1px solid var(--border-subtle);
    padding-bottom: 1rem;
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .activity-legend small {
    border: 1px solid var(--border);
    padding: 0.2rem 0.4rem;
    color: var(--text-muted);
    font-size: 0.76rem;
  }

  .activity-list {
    display: grid;
    border-top: 1px solid var(--border-subtle);
  }

  .activity-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .activity-copy strong {
    display: block;
    color: var(--text-strong);
    font-size: 0.94rem;
  }

  .activity-copy p {
    margin-top: 0.35rem;
    font-size: 0.86rem;
    line-height: 1.6;
  }

  .activity-meta {
    display: grid;
    gap: 0.25rem;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    text-align: right;
    white-space: nowrap;
  }
</style>
