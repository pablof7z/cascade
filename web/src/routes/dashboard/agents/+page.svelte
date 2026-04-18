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

<div class="grid gap-8 p-7">
  <div class="flex items-start justify-between gap-4">
    <div>
      <div class="eyebrow">Agents</div>
      <h1 class="text-xl mt-1">Agents</h1>
      <p class="mt-2 text-base-content/70">AI agents working across your fields.</p>
    </div>
    <a class="btn btn-outline btn-sm" href="/dashboard/agents">Hire Agent</a>
  </div>

  <div class="grid grid-cols-2 gap-px bg-base-300 sm:grid-cols-4">
    {#each [
      { label: 'Total agents', value: String(agents.length), highlight: false },
      { label: 'Active', value: String(activeCount), highlight: true },
      { label: 'Idle', value: String(idleCount), highlight: false },
      { label: 'Capital deployed', value: formatUsd(totalCapital), highlight: false },
    ] as stat}
      <div class="grid gap-1 bg-base-100 p-4">
        <span class="eyebrow">{stat.label}</span>
        <strong class="font-mono text-base {stat.highlight ? 'text-success' : 'text-white'}">{stat.value}</strong>
      </div>
    {/each}
  </div>

  <div class="border-t border-base-300">
    {#each agents as agent (`${agent.fieldId}-${agent.id}`)}
      <div class="grid grid-cols-[auto_minmax(0,1fr)] md:grid-cols-[auto_minmax(0,1fr)_minmax(8rem,auto)_minmax(8rem,auto)_minmax(6rem,auto)] gap-4 items-center py-4 border-b border-base-300">
        <div class="flex size-9 items-center justify-center border border-base-300 bg-base-200 text-xs font-semibold">
          {initials(agent.name).toUpperCase()}
        </div>
        <div class="min-w-0">
          <strong class="text-white block text-sm">{agent.name}</strong>
          <p class="mt-0.5 text-base-content/70 text-xs">{agent.role}</p>
          <small class="block mt-1 text-base-content/70 text-xs leading-[1.5]">{agent.focus}</small>
        </div>
        <div class="hidden md:grid gap-1 text-right">
          <span class="eyebrow">Field</span>
          <strong class="text-white font-mono text-xs">{agent.fieldName}</strong>
        </div>
        <div class="hidden md:grid gap-1 text-right">
          <span class="eyebrow">Portfolio</span>
          <strong class="text-white font-mono text-xs">{formatUsd(agent.wallet.balanceUsd)}</strong>
        </div>
        <div class="hidden md:grid gap-1 text-right">
          <span class="eyebrow">Status</span>
          <strong class="text-white font-mono text-xs">{agent.status === 'monitoring' ? 'Idle' : 'Active'}</strong>
        </div>
      </div>
    {/each}
  </div>
</div>
