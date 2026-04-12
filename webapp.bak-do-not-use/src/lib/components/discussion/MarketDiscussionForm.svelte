<script lang="ts">
  import { publishMarketPost } from '../../../services/nostrService';

  interface Props {
    marketEventId: string;
    marketCreatorPubkey: string;
    onPostPublished?: () => void;
  }

  let { marketEventId, marketCreatorPubkey, onPostPublished }: Props = $props();

  let content = $state('');
  let stance = $state<'bull' | 'bear' | 'neutral'>('neutral');
  let postType = $state<'argument' | 'evidence' | 'rebuttal' | 'analysis' | ''>('');
  let publishing = $state(false);
  let error = $state<string | null>(null);

  async function handleSubmit() {
    if (!content.trim()) return;
    if (publishing) return;

    publishing = true;
    error = null;

    try {
      // Extract title from first line if content has double newline
      let title = '';
      let body = content.trim();
      const doubleNewlineIndex = content.indexOf('\n\n');
      if (doubleNewlineIndex > 0) {
        title = content.substring(0, doubleNewlineIndex).trim();
        body = content.substring(doubleNewlineIndex + 2).trim();
      }

      await publishMarketPost(
        title,
        body,
        stance,
        postType || null,
        marketEventId,
        marketCreatorPubkey,
      );
      content = '';
      stance = 'neutral';
      postType = '';
      onPostPublished?.();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to publish post';
    } finally {
      publishing = false;
    }
  }
</script>

<div class="mt-6 pt-6 border-t border-neutral-800">
  <h4 class="text-sm font-medium text-white mb-4">Add your thoughts</h4>

  <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }} class="space-y-4">
    <!-- Content input -->
    <textarea
      bind:value={content}
      placeholder="Share your analysis, evidence, or argument...&#10;&#10;First line becomes the title (optional)"
      disabled={publishing}
      class="w-full bg-neutral-900 border border-neutral-800 text-white text-sm p-3 min-h-[120px] focus:outline-none focus:border-neutral-600 placeholder-neutral-500 resize-none disabled:opacity-50"
    ></textarea>

    <!-- Stance and Type selection -->
    <div class="flex gap-4">
      <!-- Stance selector -->
      <div class="flex-1">
        <span class="block text-xs text-neutral-500 mb-2">Stance</span>
        <div class="flex gap-0 border border-neutral-800">
          {#each [{ value: 'neutral', label: '—' }, { value: 'bull', label: 'LONG' }, { value: 'bear', label: 'SHORT' }] as opt}
            <button
              type="button"
              onclick={() => stance = opt.value as typeof stance}
              disabled={publishing}
              class="flex-1 py-1.5 text-xs font-medium disabled:opacity-50 {
                stance === opt.value
                  ? opt.value === 'bull'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : opt.value === 'bear'
                      ? 'bg-rose-950 text-rose-400'
                      : 'bg-neutral-800 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }"
            >
              {opt.label}
            </button>
          {/each}
        </div>
      </div>

      <!-- Type selector -->
      <div class="flex-1">
        <label for="post-type" class="block text-xs text-neutral-500 mb-2">Type</label>
        <select
          id="post-type"
          bind:value={postType}
          disabled={publishing}
          class="w-full bg-neutral-900 border border-neutral-800 text-white text-sm p-2 focus:outline-none focus:border-neutral-600 disabled:opacity-50"
        >
          <option value="">Plain post</option>
          <option value="argument">Argument</option>
          <option value="evidence">Evidence</option>
          <option value="rebuttal">Rebuttal</option>
          <option value="analysis">Analysis</option>
        </select>
      </div>
    </div>

    <!-- Error message -->
    {#if error}
      <p class="text-sm text-rose-400">{error}</p>
    {/if}

    <!-- Submit button -->
    <div class="flex justify-end">
      <button
        type="submit"
        disabled={publishing || !content.trim()}
        class="bg-white text-neutral-950 hover:bg-neutral-200 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium px-4 py-2"
      >
        {publishing ? 'Publishing...' : 'Publish'}
      </button>
    </div>
  </form>
</div>
