<script lang="ts">
  interface Props {
    showImage?: boolean;
    class?: string;
  }

  let { showImage = false, class: className = '' }: Props = $props();
</script>

<div class="bg-neutral-900/50 border border-neutral-800 rounded-none p-4 {className}">
  <!-- Header: Image + Title + Probability -->
  <div class="flex items-start gap-3">
    {#if showImage}
      <div class="w-12 h-12 bg-neutral-800 animate-pulse rounded-none shrink-0"></div>
    {/if}
    <div class="flex-1 min-w-0">
      <!-- Title skeleton -->
      <div class="h-5 bg-neutral-800 animate-pulse rounded-none w-3/4 mb-2"></div>
      <!-- Probability bar skeleton -->
      <div class="h-2 bg-neutral-800 animate-pulse rounded-none w-full"></div>
    </div>
    <!-- Probability percentage -->
    <div class="h-6 w-12 bg-neutral-800 animate-pulse rounded-none shrink-0"></div>
  </div>

  <!-- Description skeleton -->
  <div class="mt-4 space-y-2">
    <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-full"></div>
    <div class="h-4 bg-neutral-800 animate-pulse rounded-none w-5/6"></div>
  </div>

  <!-- Stats row -->
  <div class="mt-4 flex items-center justify-between">
    <div class="flex gap-4">
      <div class="text-center">
        <div class="h-3 w-8 bg-neutral-800 animate-pulse rounded-none mb-1"></div>
        <div class="h-4 w-6 bg-neutral-800 animate-pulse rounded-none"></div>
      </div>
      <div class="text-center">
        <div class="h-3 w-8 bg-neutral-800 animate-pulse rounded-none mb-1"></div>
        <div class="h-4 w-6 bg-neutral-800 animate-pulse rounded-none"></div>
      </div>
    </div>
    <div class="h-4 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
  </div>

  <!-- Footer: Meta info -->
  <div class="mt-4 pt-3 border-t border-neutral-800 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-5 h-5 bg-neutral-800 animate-pulse rounded-full"></div>
      <div class="h-3 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
    </div>
    <div class="h-3 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
  </div>
</div>
