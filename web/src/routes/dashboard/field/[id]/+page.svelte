<script lang="ts">
  import { page } from '$app/state';
  import { loadDashboardField, formatUsd, type Field, type MeetingActionStatus, type MeetingEntryKind } from '$lib/dashboard/workspace';

  type Tab = 'meeting' | 'positions' | 'library' | 'council';

  function parseTab(value: string | null): Tab {
    return value === 'positions' || value === 'library' || value === 'council' ? value : 'meeting';
  }

  const field = $derived(loadDashboardField(page.params.id ?? ''));
  const activeTab = $derived(parseTab(page.url.searchParams.get('tab')));

  function tabHref(tab: Tab): string {
    if (tab === 'meeting') return page.url.pathname;
    return `${page.url.pathname}?tab=${tab}`;
  }

  function attentionBadgeClass(value: Field['attention']): string {
    if (value === 'needs-input') return 'badge badge-error badge-outline';
    if (value === 'review') return 'badge badge-warning badge-outline';
    return 'badge badge-success badge-outline';
  }

  function entryKindLabel(value: MeetingEntryKind): string {
    if (value === 'counterargument') return 'counter';
    return value;
  }

  function actionLabel(value: MeetingActionStatus): string {
    if (value === 'needs-human') return 'Needs your approval';
    if (value === 'queued') return 'Queued';
    return 'Approved';
  }
</script>

{#if !field}
  <div class="grid gap-3 p-7">
    <p class="text-base-content/70">Field not found.</p>
    <a class="btn btn-outline btn-sm w-fit" href="/dashboard/fields">Back to Fields</a>
  </div>
{:else}
  <div class="min-h-full">
    <header class="border-b border-base-300 px-7 pt-6 pb-0">
      <div class="flex items-center gap-2 text-xs text-base-content/50">
        <a class="hover:text-white" href="/dashboard">Overview</a>
        <span>/</span>
        <a class="hover:text-white" href="/dashboard/fields">Fields</a>
        <span>/</span>
        <span>{field.name}</span>
      </div>

      <div class="mt-4">
        <span class={attentionBadgeClass(field.attention)}>
          {field.attention === 'needs-input' ? 'Needs input' : field.attention === 'review' ? 'Review' : 'Steady'}
        </span>
        <h1 class="text-[1.4rem] tracking-[-0.03em] mt-2">{field.name}</h1>
        <p class="max-w-[54rem] mt-1 text-base-content/70 leading-[1.6]">{field.conviction}</p>
      </div>

      <div class="flex flex-wrap gap-4 my-4 text-base-content/50 font-mono text-xs">
        <span>{field.council.length} agents</span>
        <span>{field.candidateMarkets.length} markets</span>
        <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
        <span>Updated {field.meeting.updatedAt}</span>
      </div>

      <nav class="flex gap-3 mb-[-1px]">
        {#each (['meeting', 'positions', 'library', 'council'] as const) as tab}
          <a
            class="py-3 px-0.5 border-b-2 text-sm font-medium transition-colors {activeTab === tab ? 'border-white text-white' : 'border-transparent text-base-content/50 hover:text-base-content/80'}"
            href={tabHref(tab)}
          >{tab.charAt(0).toUpperCase() + tab.slice(1)}</a>
        {/each}
      </nav>
    </header>

    <div class="p-7">
      {#if activeTab === 'meeting'}
        <div class="grid gap-4 max-w-[60rem]">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-base font-medium">{field.meeting.title}</h2>
            <span class="badge badge-warning badge-outline">{field.meeting.status === 'awaiting-human' ? 'Awaiting you' : field.meeting.status}</span>
          </div>
          <p class="text-base-content/70 leading-[1.6]">{field.meeting.summary}</p>

          {#if field.meeting.actions.length > 0}
            <div class="border-t border-base-300">
              {#each field.meeting.actions as action (action.id)}
                <div class="py-4 border-b border-base-300">
                  <div class="flex items-center flex-wrap gap-2">
                    <strong class="text-white text-sm">{action.title}</strong>
                    <span class="text-base-content/70 text-xs">{actionLabel(action.status)}</span>
                  </div>
                  <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{action.rationale}</p>
                </div>
              {/each}
            </div>
          {/if}

          <div class="border-t border-base-300">
            {#each field.meeting.entries as entry (entry.id)}
              <div class="py-4 border-b border-base-300">
                <div class="flex items-center flex-wrap gap-2">
                  <strong class="text-white text-sm">{entry.headline}</strong>
                  <span class="text-base-content/70 text-xs">{entryKindLabel(entry.kind)}</span>
                  <span class="text-base-content/50 text-xs">{entry.at}</span>
                </div>
                <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{entry.body}</p>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'positions'}
        <div class="grid gap-4 max-w-[60rem]">
          <h2 class="text-base font-medium">Current positions</h2>
          <div class="border-t border-base-300">
            {#each field.positions as position (position.id)}
              <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
                <div class="min-w-0">
                  <strong class="text-white block text-sm">{position.label}</strong>
                  <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{position.thesis}</p>
                </div>
                <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
                  <span>{formatUsd(position.exposureUsd)}</span>
                  <span>{position.status}</span>
                </div>
              </div>
            {/each}
          </div>

          <h2 class="text-base font-medium mt-4">Candidate markets</h2>
          <div class="border-t border-base-300">
            {#each field.candidateMarkets as market (market.id)}
              <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
                <div class="min-w-0">
                  <strong class="text-white block text-sm">{market.label}</strong>
                  <p class="mt-1 text-base-content/70 text-sm leading-[1.6]">{market.framing}</p>
                </div>
                <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
                  <span>{market.status}</span>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'library'}
        <div class="grid gap-4 max-w-[60rem]">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-base font-medium">Source library</h2>
            <span class="text-base-content/70 text-sm">{field.sourceLibrary.length} sources</span>
          </div>
          <div class="border-t border-base-300">
            {#each field.sourceLibrary as source (source.id)}
              <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
                <div class="min-w-0">
                  <strong class="text-white block text-sm">{source.title}</strong>
                  <p class="mt-1 text-base-content/70 text-sm">{source.author} · {source.note}</p>
                  <small class="block mt-1 text-base-content/70 text-xs leading-[1.5]">{source.relevance}</small>
                </div>
                <div class="shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
                  {source.addedAt}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      {#if activeTab === 'council'}
        <div class="grid gap-4 max-w-[60rem]">
          <div class="flex items-center justify-between gap-4">
            <h2 class="text-base font-medium">Council</h2>
            <span class="text-base-content/70 text-sm">{field.council.length} agents</span>
          </div>

          <div class="border-t border-base-300">
            {#each field.council as agent (agent.id)}
              <div class="flex items-start justify-between gap-4 py-4 border-b border-base-300">
                <div class="min-w-0">
                  <strong class="text-white block text-sm">{agent.name}</strong>
                  <p class="mt-0.5 text-base-content/70 text-sm">{agent.role} · {agent.focus}</p>
                  <small class="block mt-1 text-base-content/70 text-xs leading-[1.5]">{agent.recentContribution}</small>
                </div>
                <div class="grid gap-1 text-right shrink-0 text-base-content/50 font-mono text-xs whitespace-nowrap">
                  <span>{agent.provisioning}</span>
                  <span>{formatUsd(agent.wallet.balanceUsd)}</span>
                </div>
              </div>
            {/each}
          </div>

          <div class="grid gap-3 pt-4 border-t border-base-300">
            <strong class="text-white text-sm">Capital</strong>
            <p class="text-base-content/70 text-sm">{field.capital.note}</p>
            <div class="grid grid-cols-3 gap-px bg-base-300">
              {#each [
                { label: 'Field wallet', value: formatUsd(field.capital.fieldWalletUsd) },
                { label: 'Deployed', value: formatUsd(field.capital.deployedUsd) },
                { label: 'Available', value: formatUsd(field.capital.availableUsd) },
              ] as stat}
                <div class="grid gap-1 bg-base-200 p-4">
                  <span class="eyebrow">{stat.label}</span>
                  <strong class="text-white font-mono text-sm">{stat.value}</strong>
                </div>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
{/if}
