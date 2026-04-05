<script lang="ts">
  import { loadFieldWorkspace } from '../../../fieldStorage'
  import type { FieldAttention } from '../../../fieldTypes'

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })

  const attentionBadge: Record<FieldAttention, string> = {
    steady: 'text-emerald-400 bg-emerald-950 border border-emerald-800',
    review: 'text-amber-400 bg-amber-950 border border-amber-800',
    'needs-input': 'text-sky-400 bg-sky-950 border border-sky-800',
  }
  const attentionLabel: Record<FieldAttention, string> = {
    steady: 'Steady',
    review: 'Review',
    'needs-input': 'Needs input',
  }

  // ─── Action queue item type labels ──────────────────────────────────────────

  type ActionType = 'counter-evidence' | 'proposal' | 'question'

  const actionTypeStyle: Record<ActionType, string> = {
    'counter-evidence': 'bg-rose-950 border-rose-800 text-rose-400',
    'proposal': 'bg-sky-950 border-sky-800 text-sky-400',
    'question': 'bg-amber-950 border-amber-800 text-amber-400',
  }

  const actionTypeLabel: Record<ActionType, string> = {
    'counter-evidence': 'Counter-evidence',
    'proposal': 'Proposal',
    'question': 'Question',
  }

  // ─── Main component ───────────────────────────────────────────────────────────

  // Load workspace data
  let workspace = loadFieldWorkspace()
  let fields = workspace.fields
  let hasFields = fields.length > 0

  // Derive action items from live field meeting status
  let actionItems = fields
    .filter(f => f.meeting.status === 'awaiting-human' || f.attention === 'needs-input')
    .map(f => ({
      id: f.id,
      type: 'proposal' as ActionType,
      fieldId: f.id,
      fieldName: f.name,
      message: f.meeting.summary || 'Agents need direction',
      urgency: 'high' as const,
      agent: f.council[0]?.name ?? 'Agent',
      at: f.meeting.updatedAt,
    }))

  // Morning-style heading based on time
  let hour = new Date().getHours()
  let timeGreeting =
    hour < 5 ? 'Still running overnight' :
    hour < 12 ? 'Your agents worked overnight' :
    hour < 17 ? 'Here\'s where things stand' :
    'End-of-day briefing'
</script>

<div class="p-6 max-w-7xl mx-auto">

  {/* Briefing header */}
  <div class="mb-6">
    <h1 class="text-lg font-semibold text-white">{timeGreeting}.</h1>
    <p class="mt-0.5 text-sm text-neutral-500">
      {actionItems.length > 0
        ? `${actionItems.length} item${actionItems.length !== 1 ? 's' : ''} need${actionItems.length === 1 ? 's' : ''} your input.`
        : 'No pending decisions.'}
    </p>
  </div>

  {/* Needs Your Input — action queue */}
  {#if actionItems.length > 0}
    <section class="mb-6">
      <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
        Needs your input
      </h2>
      <div class="border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
        {#each actionItems as item (item.id)}
          <a
            href={`/dashboard/field/${item.fieldId}`}
            class="flex items-start gap-3 px-4 py-3.5 hover:bg-neutral-800/50 transition-colors"
          >
            <div class={`mt-0.5 shrink-0 text-xs px-2 py-0.5 border rounded-sm ${actionTypeStyle[item.type]}`}>
              {actionTypeLabel[item.type]}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm text-white font-medium">{item.fieldName}</p>
              <p class="text-xs text-neutral-400 mt-0.5">{item.message}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-xs text-neutral-500">{item.agent}</p>
              <p class="text-xs text-neutral-600 mt-0.5">{item.at}</p>
            </div>
          </a>
        {/each}
      </div>
    </section>
  {:else}
    <div class="flex items-center gap-3 border border-neutral-800 bg-neutral-900 px-4 py-3 mb-6">
      <div class="w-2 h-2 rounded-full bg-emerald-400 shrink-0"></div>
      <p class="text-xs text-neutral-400">Nothing waiting on you right now. Agents are working.</p>
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">

    {/* Left: Fields */}
    <div>
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-widest">
          {hasFields ? 'Your fields' : 'Fields'}
        </h2>
        {#if hasFields}
          <a href="/dashboard/fields" class="text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
            View all →
          </a>
        {:else}
          <a href="/dashboard/fields" class="text-xs font-medium text-white border border-neutral-700 px-3 py-1 hover:border-neutral-500 transition-colors">
            + New field
          </a>
        {/if}
      </div>

      {#if hasFields}
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-px border border-neutral-800">
          {#each fields as field (field.id)}
            {@const hostedCount = field.council.filter(a => a.provisioning === 'hosted').length}
            {@const statusLine = field.meeting.summary || 'Agents are monitoring.'}
            {@const statusTone = field.attention === 'needs-input' ? 'counter' : field.attention === 'review' ? 'counter' : 'neutral'}
            <a
              href={`/dashboard/field/${field.id}`}
              class="block border border-neutral-800 bg-neutral-900 p-5 hover:border-neutral-600 hover:bg-neutral-800/60 transition-colors"
            >
              <div class="flex items-start justify-between gap-3">
                <h3 class="text-sm font-medium text-white leading-snug">{field.name}</h3>
                <span class={`shrink-0 text-xs px-2 py-0.5 rounded-sm ${attentionBadge[field.attention]}`}>
                  {attentionLabel[field.attention]}
                </span>
              </div>
              <p class="mt-1.5 text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                {field.conviction}
              </p>
              <p class={`mt-2 text-xs italic leading-relaxed ${statusTone === 'counter' ? 'text-rose-400' : statusTone === 'confirm' ? 'text-emerald-400' : 'text-neutral-500'}`}>
                "{statusLine}"
              </p>
              <div class="mt-3 flex items-center gap-4 text-xs text-neutral-600">
                <span>{field.council.length} agents ({hostedCount} hosted)</span>
                <span>{field.candidateMarkets.length} markets</span>
                <span>{fmt.format(field.capital.deployedUsd)} deployed</span>
                <span class="ml-auto">{field.meeting.updatedAt}</span>
              </div>
            </a>
          {/each}
        </div>
      {:else}
        <div class="border border-neutral-800 px-6 py-10 text-center">
          <p class="text-sm font-medium text-white mb-1">No active fields yet</p>
          <p class="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
            Fields are research and trading workspaces where your agents deliberate, gather evidence, and propose positions.
          </p>
          <a
            href="/dashboard/fields"
            class="inline-block mt-5 text-xs font-medium text-white border border-neutral-700 px-4 py-2 hover:border-neutral-500 transition-colors"
          >
            Create your first field →
          </a>
        </div>
      {/if}
    </div>

    {/* Right: Activity feed */}
    <div>
      <h2 class="text-xs font-medium text-neutral-500 uppercase tracking-widest mb-3">
        Recent activity
      </h2>
      <div class="border border-neutral-800 px-4 py-8 text-center">
        <p class="text-xs text-neutral-500">No activity yet.</p>
        <p class="mt-1 text-xs text-neutral-700 leading-relaxed">
          Agent actions, proposals, and position changes appear here.
        </p>
      </div>
    </div>

  </div>
</div>
