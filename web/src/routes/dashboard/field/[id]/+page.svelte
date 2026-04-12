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

  function attentionClass(value: Field['attention']): string {
    if (value === 'needs-input') return 'badge badge-review';
    if (value === 'review') return 'badge badge-watch';
    return 'badge badge-steady';
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
  <section class="field-missing">
    <p>Field not found.</p>
    <a href="/dashboard/fields">Back to Fields</a>
  </section>
{:else}
  <section class="field-page">
    <header class="field-header">
      <div class="field-crumbs">
        <a href="/dashboard">Overview</a>
        <span>/</span>
        <a href="/dashboard/fields">Fields</a>
        <span>/</span>
        <span>{field.name}</span>
      </div>

      <div class="field-title-block">
        <span class={attentionClass(field.attention)}>
          {field.attention === 'needs-input' ? 'Needs input' : field.attention === 'review' ? 'Review' : 'Steady'}
        </span>
        <h1>{field.name}</h1>
        <p>{field.conviction}</p>
      </div>

      <div class="field-stats">
        <span>{field.council.length} agents</span>
        <span>{field.candidateMarkets.length} markets</span>
        <span>{formatUsd(field.capital.deployedUsd)} deployed</span>
        <span>Updated {field.meeting.updatedAt}</span>
      </div>

      <nav class="field-tabs">
        <a class:active={activeTab === 'meeting'} href={tabHref('meeting')}>Meeting</a>
        <a class:active={activeTab === 'positions'} href={tabHref('positions')}>Positions</a>
        <a class:active={activeTab === 'library'} href={tabHref('library')}>Library</a>
        <a class:active={activeTab === 'council'} href={tabHref('council')}>Council</a>
      </nav>
    </header>

    <div class="field-content">
      {#if activeTab === 'meeting'}
        <section class="field-panel">
          <div class="field-panel-heading">
            <h2>{field.meeting.title}</h2>
            <span class="badge badge-watch">{field.meeting.status === 'awaiting-human' ? 'Awaiting you' : field.meeting.status}</span>
          </div>
          <p class="field-panel-copy">{field.meeting.summary}</p>

          {#if field.meeting.actions.length > 0}
            <div class="action-stack">
              {#each field.meeting.actions as action (action.id)}
                <div class="action-card">
                  <div class="action-card-head">
                    <strong>{action.title}</strong>
                    <span>{actionLabel(action.status)}</span>
                  </div>
                  <p>{action.rationale}</p>
                </div>
              {/each}
            </div>
          {/if}

          <div class="meeting-list">
            {#each field.meeting.entries as entry (entry.id)}
              <div class="meeting-row">
                <div>
                  <div class="meeting-meta">
                    <strong>{entry.headline}</strong>
                    <span>{entryKindLabel(entry.kind)}</span>
                    <span>{entry.at}</span>
                  </div>
                  <p>{entry.body}</p>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if activeTab === 'positions'}
        <section class="field-panel">
          <div class="field-panel-heading">
            <h2>Current positions</h2>
          </div>
          <div class="simple-list">
            {#each field.positions as position (position.id)}
              <div class="simple-row">
                <div>
                  <strong>{position.label}</strong>
                  <p>{position.thesis}</p>
                </div>
                <div class="simple-aside">
                  <span>{formatUsd(position.exposureUsd)}</span>
                  <span>{position.status}</span>
                </div>
              </div>
            {/each}
          </div>

          <div class="field-panel-heading field-panel-heading-spaced">
            <h2>Candidate markets</h2>
          </div>
          <div class="simple-list">
            {#each field.candidateMarkets as market (market.id)}
              <div class="simple-row">
                <div>
                  <strong>{market.label}</strong>
                  <p>{market.framing}</p>
                </div>
                <div class="simple-aside">
                  <span>{market.status}</span>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if activeTab === 'library'}
        <section class="field-panel">
          <div class="field-panel-heading">
            <h2>Source library</h2>
            <span>{field.sourceLibrary.length} sources</span>
          </div>
          <div class="simple-list">
            {#each field.sourceLibrary as source (source.id)}
              <div class="simple-row">
                <div>
                  <strong>{source.title}</strong>
                  <p>{source.author} · {source.note}</p>
                  <small>{source.relevance}</small>
                </div>
                <div class="simple-aside">
                  <span>{source.addedAt}</span>
                </div>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if activeTab === 'council'}
        <section class="field-panel">
          <div class="field-panel-heading">
            <h2>Council</h2>
            <span>{field.council.length} agents</span>
          </div>

          <div class="simple-list">
            {#each field.council as agent (agent.id)}
              <div class="simple-row">
                <div>
                  <strong>{agent.name}</strong>
                  <p>{agent.role} · {agent.focus}</p>
                  <small>{agent.recentContribution}</small>
                </div>
                <div class="simple-aside">
                  <span>{agent.provisioning}</span>
                  <span>{formatUsd(agent.wallet.balanceUsd)}</span>
                </div>
              </div>
            {/each}
          </div>

          <div class="capital-box">
            <strong>Capital</strong>
            <p>{field.capital.note}</p>
            <div class="capital-box-grid">
              <div>
                <span>Field wallet</span>
                <strong>{formatUsd(field.capital.fieldWalletUsd)}</strong>
              </div>
              <div>
                <span>Deployed</span>
                <strong>{formatUsd(field.capital.deployedUsd)}</strong>
              </div>
              <div>
                <span>Available</span>
                <strong>{formatUsd(field.capital.availableUsd)}</strong>
              </div>
            </div>
          </div>
        </section>
      {/if}
    </div>
  </section>
{/if}

<style>
  .field-page {
    min-height: 100%;
  }

  .field-header {
    border-bottom: 1px solid var(--border-subtle);
    padding: 1.5rem 1.75rem 0;
  }

  .field-crumbs {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .field-title-block {
    margin-top: 1rem;
  }

  .field-title-block h1 {
    margin-top: 0.6rem;
    font-size: 1.4rem;
  }

  .field-title-block p {
    max-width: 54rem;
    margin-top: 0.45rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  .field-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 1rem 0;
    color: var(--text-faint);
    font-family: var(--font-mono);
    font-size: 0.76rem;
  }

  .field-tabs {
    display: flex;
    gap: 0.75rem;
    border-bottom: 1px solid var(--border-subtle);
    margin-bottom: -1px;
  }

  .field-tabs a {
    padding: 0.8rem 0.1rem;
    border-bottom: 2px solid transparent;
    color: var(--text-faint);
    font-size: 0.92rem;
    font-weight: 500;
  }

  .field-tabs a.active {
    border-bottom-color: var(--text-strong);
    color: var(--text-strong);
  }

  .field-content {
    padding: 1.75rem;
  }

  .field-panel {
    display: grid;
    gap: 1rem;
    max-width: 60rem;
  }

  .field-panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .field-panel-heading h2 {
    font-size: 1rem;
  }

  .field-panel-heading span,
  .field-panel-copy,
  .meeting-meta span,
  .simple-aside span,
  .capital-box p,
  .capital-box span,
  .field-missing p {
    color: var(--text-muted);
  }

  .field-panel-heading-spaced {
    margin-top: 1rem;
  }

  .action-stack,
  .meeting-list,
  .simple-list {
    display: grid;
    border-top: 1px solid var(--border-subtle);
  }

  .action-card,
  .meeting-row,
  .simple-row {
    padding: 1rem 0;
    border-bottom: 1px solid var(--border-subtle);
  }

  .action-card-head,
  .meeting-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.6rem;
  }

  .action-card strong,
  .meeting-meta strong,
  .simple-row strong,
  .capital-box strong {
    color: var(--text-strong);
  }

  .action-card p,
  .meeting-row p,
  .simple-row p,
  .simple-row small {
    margin-top: 0.35rem;
    color: var(--text-muted);
    line-height: 1.6;
  }

  .simple-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .simple-aside {
    display: grid;
    gap: 0.25rem;
    font-family: var(--font-mono);
    font-size: 0.76rem;
    text-align: right;
    white-space: nowrap;
  }

  .capital-box {
    display: grid;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-subtle);
  }

  .capital-box-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    background: var(--border-subtle);
  }

  .capital-box-grid div {
    display: grid;
    gap: 0.35rem;
    background: var(--surface);
    padding: 0.9rem 1rem;
  }

  .capital-box-grid strong {
    font-family: var(--font-mono);
  }

  .badge {
    display: inline-flex;
    align-items: center;
    border: 1px solid var(--border);
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
  }

  .badge-steady {
    color: var(--positive);
  }

  .badge-review {
    color: var(--negative);
  }

  .badge-watch {
    color: var(--text);
  }

  .field-missing {
    display: grid;
    gap: 0.8rem;
    padding: 1.75rem;
  }

  .field-missing a {
    width: fit-content;
    border: 1px solid var(--border);
    padding: 0.7rem 0.95rem;
    color: var(--text-strong);
    font-size: 0.92rem;
  }

  @media (max-width: 900px) {
    .simple-row {
      flex-direction: column;
    }

    .simple-aside {
      text-align: left;
    }

    .capital-box-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
