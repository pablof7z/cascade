<script lang="ts">
  import { publishMarketReply } from '../../services/nostrService';
  import VoteButtons from './VoteButtons.svelte';
  import { nostrStore } from '$lib/stores/nostr';

  interface DiscussionThread {
    id: string
    author: string
    pubkey: string
    isAgent: boolean
    content: string
    timestamp: number
    upvotes: number
    downvotes: number
    title: string
    stance: 'bull' | 'bear' | 'neutral'
    type: 'argument' | 'evidence' | 'rebuttal' | 'analysis'
    evidence?: string[]
    replies: Reply[]
  }

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
    thread: DiscussionThread;
    marketId: string;
  }

  let { thread, marketId }: Props = $props();

  const stanceColors: Record<string, string> = {
    bull: 'text-emerald-500 bg-emerald-950/30',
    bear: 'text-rose-500 bg-rose-950/30',
    neutral: 'text-neutral-500 bg-neutral-800/50'
  };
  
  const typeLabels: Record<string, string> = {
    argument: 'ARGUMENT',
    evidence: 'EVIDENCE',
    rebuttal: 'REBUTTAL',
    analysis: 'ANALYSIS'
  };

  let pubkey = $state<string | null>(null);
  let isLoggedIn = $derived(pubkey !== null);

  $effect(() => {
    const unsubscribe = nostrStore.subscribe((state) => {
      pubkey = state.pubkey;
    });
    return unsubscribe;
  });

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

  async function handlePostReply() {
    if (!replyContent.trim()) return;
    submitting = true;
    replyError = null;
    try {
      await publishMarketReply(replyContent.trim(), thread.id, thread.id, thread.author);
      replyContent = '';
      showReplyBox = false;
    } catch (err) {
      replyError = err instanceof Error ? err.message : 'Failed to publish reply';
    } finally {
      submitting = false;
    }
  }
</script>

<article class="border-b border-neutral-800 pb-6">
  <div class="flex gap-4">
    <div class="flex flex-col items-center">
      <VoteButtons 
        upvotes={thread.upvotes} 
        downvotes={thread.downvotes} 
        eventId={thread.id} 
        authorPubkey={thread.pubkey} 
        marketId={marketId} 
      />
    </div>
    
    <div class="flex-1 min-w-0">
      <!-- Meta badges -->
      <div class="flex flex-wrap items-center gap-2 mb-3">
        <span class="text-xs font-medium uppercase px-2 py-0.5 {stanceColors[thread.stance]}">
          {thread.stance}
        </span>
        <span class="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5">
          {typeLabels[thread.type]}
        </span>
      </div>
      
      <!-- Title -->
      <h1 class="text-xl font-bold text-white mb-4 leading-tight">{thread.title}</h1>
      
      <!-- Author line -->
      <div class="flex items-center gap-2 mb-4 text-sm">
        <span class="font-medium {thread.isAgent ? 'text-emerald-400' : 'text-neutral-300'}">
          {thread.author}
          {#if thread.isAgent}<span class="ml-1 text-xs text-emerald-600">[agent]</span>{/if}
        </span>
        <span class="text-neutral-700">•</span>
        <span class="text-neutral-500">{formatTimeAgo(thread.timestamp)}</span>
      </div>
      
      <!-- Content -->
      <div class="text-neutral-300 leading-relaxed whitespace-pre-line mb-4">
        {thread.content}
      </div>
      
      <!-- Evidence links -->
      {#if thread.evidence && thread.evidence.length > 0}
        <div class="flex flex-wrap gap-2 mb-4">
          {#each thread.evidence as e, i}
            <span class="text-xs text-neutral-400 bg-neutral-800/50 px-2 py-1">
              {e}
            </span>
          {/each}
        </div>
      {/if}
      
      <!-- Actions -->
      <div class="flex items-center gap-4 text-sm text-neutral-600">
        {#if isLoggedIn}
          <button onclick={() => showReplyBox = !showReplyBox} class="hover:text-neutral-400">
            Reply
          </button>
        {:else}
          <a href="/join" class="text-xs text-neutral-500 hover:text-neutral-400">sign in to reply</a>
        {/if}
      </div>
      
      {#if showReplyBox}
        <div class="mt-4">
          <textarea
            placeholder="Write a reply..."
            bind:value={replyContent}
            class="w-full bg-transparent border border-neutral-700 text-white text-sm p-3 min-h-[100px] focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
          ></textarea>
          {#if replyError}
            <p class="mt-1 text-xs text-rose-400">{replyError}</p>
          {/if}
          <div class="flex justify-end gap-2 mt-2">
            <button onclick={() => { showReplyBox = false; replyContent = ''; }} class="text-sm text-neutral-500 hover:text-neutral-300 px-4 py-2">
              Cancel
            </button>
            <button
              onclick={handlePostReply}
              disabled={submitting || !replyContent.trim()}
              class="text-sm bg-white text-neutral-900 font-medium px-4 py-2 hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {submitting ? 'Posting…' : 'Reply'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</article>
