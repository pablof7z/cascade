<script lang="ts">
  import type { NDKEvent } from '@nostr-dev-kit/ndk';
  import { parseEventTags, resolveAuthorName } from '../../../services/nostrService';

  interface Props {
    event: NDKEvent;
    upvotes: number;
    downvotes: number;
    marketId: string;
    onReact?: (eventId: string, content: '+' | '-') => void;
  }

  let { event, upvotes, downvotes, marketId, onReact }: Props = $props();

  // Parse stance and type from event tags (only set if actually present in tags)
  const tags = $derived(parseEventTags(event));
  const stance = $derived(tags.stance);
  const postType = $derived(tags.type);

  // Local state for voting
  let voted = $state<'up' | 'down' | null>(null);
  let localUpvotes = $state<number>(0);
  let localDownvotes = $state<number>(0);
  let authorName = $state<string | null>(null);
  let authorNpub = $state<string>('');

  // Sync with props when they change
  $effect(() => {
    localUpvotes = upvotes;
  });

  $effect(() => {
    localDownvotes = downvotes;
  });

  // Resolve author name on mount
  $effect(() => {
    resolveAuthorName(event.pubkey).then((result) => {
      authorName = result.name ?? null;
      authorNpub = result.npub;
    });
  });

  // Format timestamp as time-ago
  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp * 1000) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  // Stance badge — only shown for bull/bear, displayed as YES/NO
  function getStanceLabel(s: 'bull' | 'bear' | 'neutral'): string {
    return s === 'bull' ? 'YES' : 'NO';
  }

  function getStanceBadgeClass(s: 'bull' | 'bear' | 'neutral'): string {
    return s === 'bull'
      ? 'text-emerald-400 bg-emerald-950 border border-emerald-800'
      : 'text-rose-400 bg-rose-950 border border-rose-800';
  }

  // Type badge — color coded per type
  function getTypeBadgeClass(t: 'argument' | 'evidence' | 'rebuttal' | 'analysis'): string {
    switch (t) {
      case 'evidence':
        return 'text-emerald-400 bg-emerald-950 border border-emerald-800';
      case 'rebuttal':
        return 'text-rose-400 bg-rose-950 border border-rose-800';
      case 'analysis':
        return 'text-neutral-400 bg-neutral-800 border border-neutral-700 italic';
      case 'argument':
      default:
        return 'text-neutral-400 bg-neutral-800 border border-neutral-700';
    }
  }

  // Score styling
  let score = $derived(localUpvotes - localDownvotes);
  let scoreClass = $derived(
    score > 0 ? 'text-emerald-500' : score < 0 ? 'text-rose-500' : 'text-neutral-500'
  );

  // Handle reaction
  function handleReact(direction: 'up' | 'down') {
    if (voted === direction) {
      voted = null;
      return;
    }
    voted = direction;
    onReact?.(event.id, direction === 'up' ? '+' : '-');
    if (direction === 'up') localUpvotes++;
    else localDownvotes++;
  }

  // Parse content - title is first line if separated by double newline, rest is body
  let title = $derived(() => {
    const content = event.content;
    const doubleNewlineIndex = content.indexOf('\n\n');
    if (doubleNewlineIndex > 0) {
      return content.substring(0, doubleNewlineIndex);
    }
    // Check for subject tag
    const subjectTag = event.tags.find((t) => t[0] === 'subject');
    if (subjectTag && subjectTag[1]) {
      return subjectTag[1];
    }
    return null;
  });

  let body = $derived(() => {
    const content = event.content;
    const doubleNewlineIndex = content.indexOf('\n\n');
    if (doubleNewlineIndex > 0) {
      return content.substring(doubleNewlineIndex + 2);
    }
    return content;
  });

  // Get display author
  let displayAuthor = $derived(authorName ?? 'Anonymous');
</script>

<div class="py-4 border-b border-neutral-800 last:border-b-0">
  <!-- Header: Author, timestamp, badges -->
  <div class="flex items-center gap-3 mb-3 flex-wrap">
    <!-- Vote buttons -->
    <div class="flex items-center gap-1 text-sm">
      <button
        onclick={() => handleReact('up')}
        class="p-1 hover:bg-neutral-800 {voted === 'up' ? 'text-emerald-500' : 'text-neutral-500 hover:text-emerald-400'}"
        aria-label="Upvote"
      >
        ▲
      </button>
      <span class="min-w-[2rem] text-center {scoreClass}">
        {score}
      </span>
      <button
        onclick={() => handleReact('down')}
        class="p-1 hover:bg-neutral-800 {voted === 'down' ? 'text-rose-500' : 'text-neutral-500 hover:text-rose-400'}"
        aria-label="Downvote"
      >
        ▼
      </button>
    </div>

    <!-- Author -->
    <span class="text-sm font-medium text-neutral-300">
      {displayAuthor}
    </span>

    <!-- Timestamp -->
    <span class="text-xs text-neutral-500">
      {formatTimeAgo(event.createdAt)}
    </span>

    <!-- Stance badge: only show for bull/bear, not neutral -->
    {#if stance === 'bull' || stance === 'bear'}
      <span class="px-2 py-0.5 text-xs font-medium {getStanceBadgeClass(stance)}">
        {getStanceLabel(stance)}
      </span>
    {/if}

    <!-- Type badge: only show if type tag is present -->
    {#if postType}
      <span class="px-2 py-0.5 text-xs {getTypeBadgeClass(postType)}">
        {postType}
      </span>
    {/if}
  </div>

  <!-- Title (if present) -->
  {#if title()}
    <h4 class="text-base font-medium text-white mb-2">
      {title()}
    </h4>
  {/if}

  <!-- Content -->
  <p class="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">
    {body()}
  </p>
</div>
