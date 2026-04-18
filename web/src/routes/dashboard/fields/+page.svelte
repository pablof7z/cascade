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

<div class="grid gap-8 p-7">
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="eyebrow">Fields</div>
      <h1 class="text-xl mt-1">Fields</h1>
      <p class="mt-2 text-base-content/70">{fields.length} active workspaces across research, debate, and capital allocation.</p>
    </div>
    <a class="btn btn-outline btn-sm" href="/dashboard/fields">New Field</a>
  </div>

  {#each sections as section (section.label)}
    <section class="grid gap-3">
      <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-base-content/50">
        <span>{section.label}</span>
        <small>{section.items.length}</small>
      </div>

      <div class="border-t border-base-300">
        <div class="hidden md:grid grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] gap-4 items-start py-3 eyebrow">
          <span>Name / Conviction</span>
          <span>Status</span>
          <span>Agents</span>
          <span>Markets</span>
          <span>Capital</span>
          <span>Updated</span>
        </div>

        {#each section.items as field (field.id)}
          <a class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto_auto] gap-1 md:gap-4 items-start py-4 border-t border-base-300 hover:bg-base-300/20" href="/dashboard/field/{field.id}">
            <div class="min-w-0">
              <strong class="text-white block text-sm">{field.name}</strong>
              <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{field.conviction}</p>
            </div>
            <span class="text-base-content/50 font-mono text-xs whitespace-nowrap">{attentionLabel(field.attention)}</span>
            <span class="text-base-content/50 font-mono text-xs whitespace-nowrap">{field.council.length}</span>
            <span class="text-base-content/50 font-mono text-xs whitespace-nowrap">{field.candidateMarkets.length}</span>
            <span class="text-base-content/50 font-mono text-xs whitespace-nowrap">{formatUsd(field.capital.deployedUsd)}</span>
            <span class="text-base-content/50 font-mono text-xs whitespace-nowrap">{field.meeting.updatedAt}</span>
          </a>
        {/each}
      </div>
    </section>
  {/each}
</div>
