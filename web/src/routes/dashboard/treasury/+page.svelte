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

<div class="grid gap-8 p-7">
  <div>
    <div class="eyebrow">Treasury</div>
    <h1 class="text-xl mt-1">Treasury</h1>
    <p class="mt-2 text-base-content/70">Capital allocation across all fields and agents.</p>
  </div>

  <div class="grid grid-cols-2 gap-px bg-base-300 sm:grid-cols-4">
    {#each [
      { label: 'Total capital', value: formatUsd(totalCapital) },
      { label: 'Deployed', value: formatUsd(deployed) },
      { label: 'Available', value: formatUsd(available) },
      { label: 'Overall P&L', value: '-' },
    ] as stat}
      <div class="grid gap-1 bg-base-100 p-4">
        <span class="eyebrow">{stat.label}</span>
        <strong class="text-white font-mono">{stat.value}</strong>
      </div>
    {/each}
  </div>

  <section class="grid gap-3">
    <h2 class="text-base font-medium">By Field</h2>
    <div class="border-t border-base-300">
      {#each fields as field (field.id)}
        <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
          <div class="min-w-0">
            <strong class="text-white block text-sm">{field.name}</strong>
            <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{field.capital.note}</p>
          </div>
          <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
            <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
            <span>{formatUsd(field.capital.availableUsd)} available</span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="grid gap-3">
    <h2 class="text-base font-medium">Open Positions</h2>
    <div class="border-t border-base-300">
      {#each positions as position (position.id)}
        <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
          <div class="min-w-0">
            <strong class="text-white block text-sm">{position.label}</strong>
            <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{position.fieldName} · {position.thesis}</p>
          </div>
          <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
            <span>{formatUsd(position.exposureUsd)}</span>
            <span>{position.status}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>

  <section class="grid gap-3">
    <h2 class="text-base font-medium">Recent Transactions</h2>
    <div class="border-t border-base-300">
      {#each transactions as action (action.id)}
        <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
          <div class="min-w-0">
            <strong class="text-white block text-sm">{action.title}</strong>
            <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{action.fieldName} · {action.rationale}</p>
          </div>
          <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
            <span>{action.status}</span>
          </div>
        </div>
      {/each}
    </div>
  </section>
</div>
