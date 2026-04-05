<script lang="ts">
  interface Props {
    replyCount?: number;
    class?: string;
  }

  let { replyCount = 3, class: className = '' }: Props = $props();

  // Generate array of reply skeletons
  let replies = $derived(Array.from({ length: replyCount }, (_, i) => i));
</script>

<div class="space-y-6 {className}">
  <!-- Header / Title skeleton -->
  <div class="space-y-3">
    <div class="h-8 bg-neutral-800 animate-pulse rounded-none w-3/4"></div>
    <div class="flex items-center gap-3">
      <div class="w-6 h-6 bg-neutral-800 animate-pulse rounded-full"></div>
      <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-32"></div>
      <span class="text-neutral-600">·</span>
      <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-24"></div>
    </div>
  </div>

  <!-- Market info card skeleton -->
  <div class="bg-neutral-900/50 border border-neutral-800 rounded-none p-4">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-neutral-800 animate-pulse rounded-none"></div>
        <div class="space-y-1">
          <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-40"></div>
          <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-24"></div>
        </div>
      </div>
      <div class="text-right space-y-1">
        <div class="h-6 bg-neutral-800 animate-pulse rounded-none w-12"></div>
        <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-16"></div>
      </div>
    </div>
  </div>

  <!-- Original post skeleton -->
  <div class="space-y-3 pl-4 border-l-2 border-neutral-800">
    <div class="space-y-2">
      <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-full"></div>
      <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-full"></div>
      <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-3/4"></div>
    </div>
  </div>

  <!-- Replies section header -->
  <div class="pt-4 border-t border-neutral-800">
    <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-24 mb-4"></div>
  </div>

  <!-- Reply skeletons -->
  <div class="space-y-4">
    {#each replies as _, i}
      <div class="space-y-3 pl-4 border-l-2 border-neutral-800">
        <!-- Reply header -->
        <div class="flex items-center gap-2">
          <div class="w-5 h-5 bg-neutral-800 animate-pulse rounded-full"></div>
          <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-20"></div>
          <span class="text-neutral-600">·</span>
          <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-16"></div>
        </div>
        <!-- Reply content -->
        <div class="space-y-1.5 pl-6">
          <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-full"></div>
          <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-5/6"></div>
          {#if i === 0}
            <div class="h-3 bg-neutral-800 animate-pulse rounded-none w-4/6"></div>
          {/if}
        </div>
        <!-- Vote buttons skeleton -->
        <div class="flex items-center gap-2 pl-6 mt-2">
          <div class="h-7 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
          <div class="h-7 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
        </div>
      </div>
    {/each}
  </div>

  <!-- Load more indicator -->
  <div class="flex justify-center pt-4">
    <div class="h-8 w-32 bg-neutral-800 animate-pulse rounded-none"></div>
  </div>
</div>
