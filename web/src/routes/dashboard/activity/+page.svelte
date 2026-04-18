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

<div class="grid gap-6 p-7">
  <div>
    <div class="eyebrow">Activity</div>
    <h1 class="text-xl mt-1">Activity</h1>
    <p class="mt-2 text-base-content/70">Everything happening across your workspace, most recent first.</p>
  </div>

  <div class="flex items-center gap-2 pb-4 border-b border-base-300 text-xs text-base-content/50">
    <span>Entry types:</span>
    {#each ['Meeting', 'Proposal', 'Position', 'Source'] as type}
      <span class="border border-base-300 px-2 py-0.5 text-base-content/70">{type}</span>
    {/each}
  </div>

  <div class="border-t border-base-300">
    {#each items as item (`${item.fieldName}-${item.title}`)}
      <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
        <div class="min-w-0">
          <strong class="text-white block text-sm">{item.title}</strong>
          <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{item.fieldName} · {item.detail}</p>
        </div>
        <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
          <span>{item.type}</span>
          <span>{item.at}</span>
        </div>
      </div>
    {/each}
  </div>
</div>
