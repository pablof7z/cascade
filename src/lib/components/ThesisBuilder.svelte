<script lang="ts">
  import TiptapEditor from './TiptapEditor.svelte';
  import { publishMarket } from '../../services/nostrService';
  import { nostrStore, getCurrentPubkey } from '../../lib/stores/nostr';
  import type { Market, MarketKind, ThesisSignal } from '../../market';

  // ─── Types ─────────────────────────────────────────────────────────────────────

  interface Module {
    id: string;
    question: string;
    probability: number;
    direction: 'YES' | 'NO';
  }

  type Phase = 'draft' | 'preview' | 'publishing' | 'published';

  // ─── State ───────────────────────────────────────────────────────────

  let phase = $state<Phase>('draft');
  let thesisTitle = $state('');
  let thesisDescription = $state('');
  let modules = $state<Module[]>([]);
  let error = $state<string | null>(null);
  let publishedEventId = $state<string | null>(null);
  let publishedSlug = $state<string | null>(null);

  // Module form state
  let newModuleQuestion = $state('');
  let newModuleProbability = $state(50);
  let newModuleDirection = $state<'YES' | 'NO'>('YES');

  // ─── Computed ─────────────────────────────────────────────────────────

  const isReady = $derived(nostrStore.get().isReady);
  const pubkey = $derived(nostrStore.get().pubkey);

  const isValid = $derived(
    thesisTitle.trim().length > 0 &&
    thesisDescription.trim().length > 0 &&
    modules.length > 0
  );

  // ─── Module Actions ───────────────────────────────────────────────────

  function addModule() {
    if (!newModuleQuestion.trim()) return;
    modules = [
      ...modules,
      {
        id: crypto.randomUUID(),
        question: newModuleQuestion.trim(),
        probability: newModuleProbability,
        direction: newModuleDirection,
      },
    ];
    newModuleQuestion = '';
    newModuleProbability = 50;
    newModuleDirection = 'YES';
  }

  function removeModule(id: string) {
    modules = modules.filter((m) => m.id !== id);
  }

  // ─── Navigation ────────────────────────────────────────────────────────

  function goToPreview() {
    if (!isValid) return;
    phase = 'preview';
  }

  function goBackToDraft() {
    phase = 'draft';
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  const STORAGE_KEY = 'cascade-thesis-draft';

  function saveDraft() {
    const draft = {
      title: thesisTitle,
      description: thesisDescription,
      modules,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }

  function loadDraft() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const draft = JSON.parse(stored);
        thesisTitle = draft.title || '';
        thesisDescription = draft.description || '';
        modules = (draft.modules || []).map((m: Module) => ({
          ...m,
          id: m.id || crypto.randomUUID(),
        }));
      }
    } catch {
      // Ignore corrupt storage
    }
  }

  function clearDraft() {
    localStorage.removeItem(STORAGE_KEY);
  }

  // Load draft on mount
  $effect(() => {
    loadDraft();
  });

  // Auto-save on changes
  $effect(() => {
    if (phase === 'draft') {
      saveDraft();
    }
  });

  // ─── Publish ─────────────────────────────────────────────────────────

  async function handlePublish() {
    if (!isReady || !pubkey) {
      error = 'Please connect using a secure login method to publish.';
      return;
    }

    phase = 'publishing';
    error = null;

    try {
      // Build thesis definition with signals
      const signals: ThesisSignal[] = modules.map((m) => ({
        moduleTitle: m.question,
        expectedOutcome: m.direction,
        note: `${m.probability}% probability`,
      }));

      // Create market object
      const slug = `thesis-${crypto.randomUUID().slice(0, 8)}`;
      const now = Date.now();

      const market: Market = {
        eventId: '', // Will be populated after publish
        slug,
        title: thesisTitle,
        description: thesisDescription,
        mint: 'https://mint.contrarian.markets', // Default mint
        b: 1000,
        qLong: 0.5,
        qShort: 0.5,
        reserve: 1000,
        participants: {},
        quotes: [],
        proofs: [],
        spentProofs: [],
        receipts: [],
        events: [],
        creatorPubkey: pubkey,
        createdAt: now,
        status: 'active',
        kind: 'thesis' as MarketKind,
        thesis: {
          statement: thesisTitle,
          argument: thesisDescription,
          signals,
        },
      };

      // Build markdown content
      const markdown = thesisDescription;

      // Publish to Nostr
      const event = await publishMarket(market, markdown);
      market.eventId = event.id;

      // Clear draft and update state
      clearDraft();
      publishedEventId = event.id;
      publishedSlug = slug;
      phase = 'published';
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to publish thesis';
      phase = 'preview';
    }
  }
</script>

<div class="max-w-3xl mx-auto py-12 px-4">
  {#if phase === 'draft'}
    <!-- Draft Phase -->
    <div class="space-y-8">
      <!-- Header -->
      <div>
        <h1 class="text-2xl font-bold text-white mb-2">Build Thesis</h1>
        <p class="text-neutral-400 text-sm">
          Create a conditional prediction market with modular outcomes.
        </p>
      </div>

      <!-- Title -->
      <div>
        <label for="thesis-title" class="block text-sm font-medium text-neutral-300 mb-2">
          Thesis Statement
        </label>
        <input
          id="thesis-title"
          type="text"
          bind:value={thesisTitle}
          placeholder="e.g., AI will achieve AGI by 2030"
          class="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 text-white placeholder-neutral-500 focus:outline-none focus:border-neutral-600"
        />
      </div>

      <!-- Description -->
      <div>
        <span class="block text-sm font-medium text-neutral-300 mb-2">
          Argument & Narrative
        </span>
        <TiptapEditor
          content={thesisDescription}
          placeholder="Explain your thesis and the reasoning behind it..."
          onUpdate={(html) => (thesisDescription = html)}
        />
      </div>

      <!-- Modules -->
      <div>
        <div class="flex items-center justify-between mb-4">
          <span class="text-sm font-medium text-neutral-300">
            Conditional Predictions (Modules)
          </span>
          <span class="text-xs text-neutral-500">{modules.length} added</span>
        </div>

        <!-- Existing modules -->
        {#if modules.length > 0}
          <div class="divide-y divide-neutral-800 mb-4">
            {#each modules as mod (mod.id)}
              <div class="py-3 flex items-start gap-4">
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white truncate">{mod.question}</p>
                  <p class="text-xs text-neutral-500 mt-1">
                    {mod.probability}% — {mod.direction}
                  </p>
                </div>
                <button
                  onclick={() => removeModule(mod.id)}
                  class="text-neutral-500 hover:text-rose-400 text-sm"
                >
                  Remove
                </button>
              </div>
            {/each}
          </div>
        {/if}

        <!-- Add module form -->
        <div class="bg-neutral-900 border border-neutral-800 p-4 space-y-3">
          <input
            type="text"
            bind:value={newModuleQuestion}
            placeholder="Question (e.g., Will GPT-5 release before 2026?)"
            class="w-full px-3 py-2 bg-neutral-950 border border-neutral-800 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-neutral-600"
          />

          <div class="flex items-center gap-4">
            <div class="flex-1">
              <span class="text-xs text-neutral-500 mb-1 block">
                Probability: {newModuleProbability}%
              </span>
              <input
                type="range"
                min="1"
                max="99"
                bind:value={newModuleProbability}
                class="w-full accent-white"
              />
            </div>

            <div>
              <span class="text-xs text-neutral-500 mb-1 block">Direction</span>
              <select
                bind:value={newModuleDirection}
                class="px-3 py-2 bg-neutral-950 border border-neutral-800 text-white text-sm focus:outline-none"
              >
                <option value="YES">Yes</option>
                <option value="NO">No</option>
              </select>
            </div>

            <button
              onclick={addModule}
              disabled={!newModuleQuestion.trim()}
              class="px-4 py-2 bg-white text-neutral-950 text-sm font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end pt-4">
        <button
          onclick={goToPreview}
          disabled={!isValid}
          class="px-6 py-3 bg-white text-neutral-950 font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Preview Thesis
        </button>
      </div>
    </div>

  {:else if phase === 'preview'}
    <!-- Preview Phase -->
    <div class="space-y-8">
      <div class="flex items-center justify-between">
        <button
          onclick={goBackToDraft}
          class="text-sm text-neutral-500 hover:text-white"
        >
          ← Back to editing
        </button>
        <span class="text-xs text-neutral-500">Preview</span>
      </div>

      <!-- Preview Content -->
      <div class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-white mb-4">{thesisTitle}</h1>
          <div class="prose prose-invert prose-sm max-w-none text-neutral-300">
            {@html thesisDescription}
          </div>
        </div>

        {#if modules.length > 0}
          <div>
            <h2 class="text-sm font-medium text-neutral-400 mb-3">
              Conditional Predictions
            </h2>
            <div class="space-y-2">
              {#each modules as mod (mod.id)}
                <div class="flex items-center gap-3 py-2 border-b border-neutral-800">
                  <span class="font-mono text-sm text-emerald-400 w-16">
                    {mod.probability}%
                  </span>
                  <span class="text-sm text-white flex-1">{mod.question}</span>
                  <span class="text-xs text-neutral-500">
                    {mod.direction === 'YES' ? 'YES' : 'NO'}
                  </span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Error -->
      {#if error}
        <div class="text-rose-400 text-sm py-2">{error}</div>
      {/if}

      <!-- Publish -->
      <div class="flex justify-end gap-3 pt-4">
        <button
          onclick={handlePublish}
          disabled={!isReady}
          class="px-6 py-3 bg-white text-neutral-950 font-medium hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {#if !isReady}
            Connect wallet to publish
          {:else}
            Publish Thesis
          {/if}
        </button>
      </div>
    </div>

  {:else if phase === 'publishing'}
    <!-- Publishing Phase -->
    <div class="flex flex-col items-center justify-center min-h-[40vh]">
      <div class="text-center">
        <div class="text-lg text-white mb-2">Sharing thesis...</div>
        <div class="text-sm text-neutral-500">Please wait</div>
      </div>
    </div>

  {:else if phase === 'published'}
    <!-- Published Phase -->
    <div class="flex flex-col items-center justify-center min-h-[40vh]">
      <div class="text-center">
        <div class="text-lg text-emerald-400 mb-4">Thesis Published</div>
        {#if publishedSlug && pubkey}
          <a href="/thread/{publishedSlug}--{pubkey.slice(0, 12)}" class="text-white underline text-sm mb-4 block">
            View your market →
          </a>
        {/if}
        <button
          onclick={() => {
            phase = 'draft';
            thesisTitle = '';
            thesisDescription = '';
            modules = [];
            publishedEventId = null;
            publishedSlug = null;
          }}
          class="mt-4 px-6 py-3 bg-neutral-800 text-white hover:bg-neutral-700"
        >
          Create Another Thesis
        </button>
      </div>
    </div>
  {/if}
</div>
