<script lang="ts">
  import { publishReaction } from '../../services/nostrService';

  interface Props {
    upvotes: number;
    downvotes: number;
    eventId: string;
    authorPubkey: string;
    marketId: string;
  }

  let { upvotes, downvotes, eventId, authorPubkey, marketId }: Props = $props();
  
  let voted = $state<'up' | 'down' | null>(null);
  let localUpvotes = $state(0);
  let localDownvotes = $state(0);
  let publishing = $state(false);

  let score = $derived(localUpvotes - localDownvotes);
  
  // Sync with props when they change
  $effect(() => {
    localUpvotes = upvotes;
  });
  
  $effect(() => {
    localDownvotes = downvotes;
  });

  async function handleVote(direction: 'up' | 'down') {
    if (publishing) return;
    if (voted === direction) {
      voted = null;
      return;
    }
    voted = direction;
    publishing = true;
    try {
      await publishReaction(eventId, authorPubkey, marketId, direction === 'up' ? '+' : '-');
      if (direction === 'up') localUpvotes++;
      else localDownvotes++;
    } catch (err) {
      voted = null;
      console.error('[VoteButtons] publishReaction failed:', err);
    } finally {
      publishing = false;
    }
  }
</script>

<div class="flex items-center gap-1 text-sm">
  <button
    onclick={() => handleVote('up')}
    disabled={publishing}
    class="p-1 hover:bg-neutral-800 disabled:opacity-50 {voted === 'up' ? 'text-emerald-500' : 'text-neutral-500 hover:text-emerald-400'}"
  >
    ▲
  </button>
  <span class="min-w-[2rem] text-center {score > 0 ? 'text-emerald-500' : score < 0 ? 'text-rose-500' : 'text-neutral-500'}">
    {score}
  </span>
  <button
    onclick={() => handleVote('down')}
    disabled={publishing}
    class="p-1 hover:bg-neutral-800 disabled:opacity-50 {voted === 'down' ? 'text-rose-500' : 'text-neutral-500 hover:text-rose-400'}"
  >
    ▼
  </button>
</div>
