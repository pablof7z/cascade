<script lang="ts">
  import { publishMarketReply } from '../../services/nostrService';
  import VoteButtons from './VoteButtons.svelte';
  import ReplyThread from './ReplyThread.svelte';

  interface Reply {
    id: string
    author: string
    pubkey: string
    isAgent: boolean
    content: string
    timestamp: number
    upvotes: number
    downvotes: number
    replies: Reply[]
  }

  interface Props {
    reply: Reply;
    depth?: number;
    marketId: string;
    rootId: string;
  }

  let { reply, depth = 0, marketId, rootId }: Props = $props();
  
  const maxDepth = 6;
  const indentClass = $derived(depth < maxDepth ? 'ml-5 border-l border-neutral-800 pl-4' : '');
  
  let collapsed = $state(false);
  let showReplyBox = $state(false);
  let replyContent = $state('');
  let submitting = $state(false);
  let replyError = $state<string | null>(null);

  function formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  async function handleReplySubmit() {
    if (!replyContent.trim()) return;
    submitting = true;
    replyError = null;
    try {
      await publishMarketReply(replyContent.trim(), reply.id, rootId, reply.author);
      replyContent = '';
      showReplyBox = false;
    } catch (err) {
      replyError = err instanceof Error ? err.message : 'Failed to publish reply';
    } finally {
      submitting = false;
    }
  }
</script>

<div class={indentClass}>
  <div class="py-3">
    <div class="flex items-center gap-3 mb-2">
      <VoteButtons 
        upvotes={reply.upvotes} 
        downvotes={reply.downvotes} 
        eventId={reply.id} 
        authorPubkey={reply.pubkey} 
        marketId={marketId} 
      />
      <span class="text-sm font-medium {reply.isAgent ? 'text-emerald-400' : 'text-neutral-300'}">
        {reply.author}
        {#if reply.isAgent}<span class="ml-1 text-xs text-emerald-600">[agent]</span>{/if}
      </span>
      <span class="text-xs text-neutral-600">{formatTimeAgo(reply.timestamp)}</span>
      {#if reply.replies.length > 0}
        <button
          onclick={() => collapsed = !collapsed}
          class="text-xs text-neutral-500 hover:text-neutral-300"
        >
          [{collapsed ? '+' : '-'}]
        </button>
      {/if}
    </div>
    <p class="text-sm text-neutral-300 leading-relaxed whitespace-pre-line">{reply.content}</p>
    <div class="mt-2 flex gap-4 text-xs text-neutral-600">
      <button onclick={() => showReplyBox = !showReplyBox} class="hover:text-neutral-400">reply</button>
    </div>
    
    {#if showReplyBox}
      <div class="mt-3">
        <textarea
          placeholder="Write a reply..."
          bind:value={replyContent}
          class="w-full bg-transparent border border-neutral-700 text-white text-sm p-2 min-h-[80px] focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
        ></textarea>
        {#if replyError}
          <p class="mt-1 text-xs text-rose-400">{replyError}</p>
        {/if}
        <div class="flex justify-end gap-2 mt-2">
          <button onclick={() => { showReplyBox = false; replyContent = ''; }} class="text-xs text-neutral-500 hover:text-neutral-300 px-3 py-1">
            Cancel
          </button>
          <button
            onclick={handleReplySubmit}
            disabled={submitting || !replyContent.trim()}
            class="text-xs bg-white text-neutral-900 font-medium px-3 py-1 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting…' : 'Reply'}
          </button>
        </div>
      </div>
    {/if}
  </div>
  {#if !collapsed}
    {#each reply.replies as r (r.id)}
      <ReplyThread reply={r} depth={depth + 1} {marketId} {rootId} />
    {/each}
  {/if}
</div>
