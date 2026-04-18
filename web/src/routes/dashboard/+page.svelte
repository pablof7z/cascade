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

<div class="grid gap-8 p-7">
  <div>
    <div class="eyebrow">Dashboard</div>
    <h1 class="text-[2rem] tracking-[-0.04em] mt-1">Your agents worked overnight. Here is the briefing.</h1>
    <p class="max-w-[52rem] mt-3 text-base-content/70">
      The dashboard is the operator view: fields, staffing, capital, and the current debate across each workspace.
    </p>
  </div>

  <div class="grid grid-cols-2 gap-px bg-base-300 sm:grid-cols-4">
    {#each [
      { label: 'Fields', value: String(fields.length) },
      { label: 'Agents', value: String(totalAgents) },
      { label: 'Candidate markets', value: String(totalMarkets) },
      { label: 'Total capital', value: formatUsd(totalCapital) },
    ] as stat}
      <div class="grid gap-1 bg-base-100 p-4">
        <span class="eyebrow">{stat.label}</span>
        <strong class="text-white font-mono text-lg">{stat.value}</strong>
      </div>
    {/each}
  </div>

  <div class="grid gap-8 md:grid-cols-2">
    <article class="grid gap-4">
      <div class="flex items-end justify-between gap-4">
        <h2 class="text-base font-medium">Fields at a glance</h2>
        <a class="text-base-content/50 text-sm hover:text-white" href="/dashboard/fields">View all</a>
      </div>

      <div class="border-t border-base-300">
        {#each recentFields as field (field.id)}
          <a class="flex items-start justify-between gap-4 py-4 border-b border-base-300 hover:text-white" href="/dashboard/field/{field.id}">
            <div class="min-w-0">
              <strong class="text-white block text-sm">{field.name}</strong>
              <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{field.recentUpdate}</p>
            </div>
            <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
              <span>{field.council.length} agents</span>
              <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
            </div>
          </a>
        {/each}
      </div>
    </article>

    <article class="grid gap-4">
      <div class="flex items-end justify-between gap-4">
        <h2 class="text-base font-medium">Capital deployment</h2>
        <a class="text-base-content/50 text-sm hover:text-white" href="/dashboard/treasury">Treasury</a>
      </div>

      <div class="grid grid-cols-2 gap-px bg-base-300">
        <div class="grid gap-1 bg-base-200 p-4">
          <span class="eyebrow">Deployed</span>
          <strong class="text-white font-mono">{formatUsd(deployedCapital)}</strong>
        </div>
        <div class="grid gap-1 bg-base-200 p-4">
          <span class="eyebrow">Available</span>
          <strong class="text-white font-mono">{formatUsd(totalCapital - deployedCapital)}</strong>
        </div>
      </div>

      <div class="border-t border-base-300">
        {#each fields as field (field.id)}
          <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
            <div class="min-w-0">
              <strong class="text-white block text-sm">{field.name}</strong>
              <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{field.capital.note}</p>
            </div>
            <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
              <span>{formatUsd(field.capital.availableUsd)} free</span>
              <span>{formatUsd(field.capital.monthlyBudgetUsd)} / mo</span>
            </div>
          </div>
        {/each}
      </div>
    </article>
  </div>
</div>
