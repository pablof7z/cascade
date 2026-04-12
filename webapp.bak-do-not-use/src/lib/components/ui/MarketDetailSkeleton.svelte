<script lang="ts">
  interface Props {
    class?: string;
  }

  let { class: className = '' }: Props = $props();
</script>

<div class="min-h-screen bg-neutral-950 text-white {className}">
  <div class="max-w-6xl mx-auto px-4 pb-32">
    <!-- Header Skeleton -->
    <header class="pt-8 pb-6 border-b border-neutral-800">
      <div class="flex items-start justify-between gap-4">
        <div class="flex-1">
          <!-- Breadcrumb -->
          <div class="flex items-center gap-2 mb-3">
            <div class="h-4 w-14 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-3 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-48 bg-neutral-800 animate-pulse rounded-none"></div>
          </div>

          <!-- Title -->
          <div class="h-8 w-96 bg-neutral-800 animate-pulse rounded-none"></div>

          <!-- Meta info -->
          <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <div class="h-4 w-32 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-3 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-28 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-3 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
          </div>
        </div>

        <!-- Bookmark placeholder -->
        <div class="h-8 w-8 bg-neutral-800 animate-pulse rounded-none"></div>
      </div>
    </header>

    <!-- Tabs Skeleton -->
    <nav class="flex gap-1 border-b border-neutral-800 mt-6">
      <div class="px-4 py-3 h-10 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
      <div class="px-4 py-3 h-10 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
      <div class="px-4 py-3 h-10 w-28 bg-neutral-800 animate-pulse rounded-none"></div>
      <div class="px-4 py-3 h-10 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
    </nav>

    <!-- Content Area Skeleton -->
    <div class="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Content (2/3) -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Probability/Price Card -->
        <div class="bg-neutral-900 border border-neutral-800 p-6">
          <div class="flex items-center justify-between mb-6">
            <div class="space-y-2">
              <div class="h-3 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-12 w-32 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="space-y-2 text-right">
              <div class="h-3 w-12 bg-neutral-800 animate-pulse rounded-none ml-auto"></div>
              <div class="h-8 w-24 bg-neutral-800 animate-pulse rounded-none ml-auto"></div>
            </div>
          </div>

          <!-- Price bars -->
          <div class="space-y-3">
            <div class="flex items-center gap-4">
              <div class="h-4 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="flex-1 h-3 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-12 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="flex items-center gap-4">
              <div class="h-4 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="flex-1 h-3 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-12 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
          </div>
        </div>

        <!-- Consensus Analysis Card -->
        <div class="bg-neutral-900 border border-neutral-800 p-6">
          <div class="h-5 w-40 bg-neutral-800 animate-pulse rounded-none mb-4"></div>
          <div class="space-y-2">
            <div class="h-4 w-full bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-4 w-5/6 bg-neutral-800 animate-pulse rounded-none"></div>
          </div>
        </div>

        <!-- Market Details Card -->
        <div class="bg-neutral-900 border border-neutral-800 p-6">
          <div class="h-5 w-32 bg-neutral-800 animate-pulse rounded-none mb-4"></div>
          <div class="grid grid-cols-2 gap-4">
            <div class="space-y-1">
              <div class="h-3 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="space-y-1">
              <div class="h-3 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="space-y-1">
              <div class="h-3 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="space-y-1">
              <div class="h-3 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
          </div>
        </div>

        <!-- Chart Placeholder -->
        <div class="bg-neutral-900 border border-neutral-800 p-6">
          <div class="h-5 w-24 bg-neutral-800 animate-pulse rounded-none mb-4"></div>
          <div class="flex items-end justify-between gap-2 h-48">
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-full"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-3/4"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-full"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-2/3"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-4/5"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-1/2"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-3/4"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-full"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-2/3"></div>
            <div class="flex-1 bg-neutral-800 animate-pulse rounded-none h-4/5"></div>
          </div>
        </div>
      </div>

      <!-- Sidebar (1/3) -->
      <div class="space-y-6">
        <!-- Trade Panel -->
        <div class="bg-neutral-900 border border-neutral-800 p-6">
          <div class="h-5 w-24 bg-neutral-800 animate-pulse rounded-none mb-4"></div>

          <!-- Side toggles -->
          <div class="flex gap-2 mb-4">
            <div class="flex-1 h-10 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="flex-1 h-10 bg-neutral-800 animate-pulse rounded-none"></div>
          </div>

          <!-- Amount input -->
          <div class="space-y-2 mb-4">
            <div class="h-3 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-12 bg-neutral-800 animate-pulse rounded-none"></div>
          </div>

          <!-- Preset amounts -->
          <div class="flex gap-2 mb-4">
            <div class="h-8 flex-1 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-8 flex-1 bg-neutral-800 animate-pulse rounded-none"></div>
            <div class="h-8 flex-1 bg-neutral-800 animate-pulse rounded-none"></div>
          </div>

          <!-- Cost preview -->
          <div class="space-y-2 mb-4 p-4 bg-neutral-800 animate-pulse rounded-none">
            <div class="h-4 w-full bg-neutral-700 animate-pulse rounded-none"></div>
            <div class="h-4 w-3/4 bg-neutral-700 animate-pulse rounded-none"></div>
          </div>

          <!-- Trade button -->
          <div class="h-12 w-full bg-neutral-800 animate-pulse rounded-none"></div>
        </div>

        <!-- Liquidity Info -->
        <div class="bg-neutral-900 border border-neutral-800 p-6">
          <div class="h-5 w-28 bg-neutral-800 animate-pulse rounded-none mb-4"></div>
          <div class="space-y-3">
            <div class="flex justify-between">
              <div class="h-4 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="flex justify-between">
              <div class="h-4 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-20 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
            <div class="flex justify-between">
              <div class="h-4 w-24 bg-neutral-800 animate-pulse rounded-none"></div>
              <div class="h-4 w-16 bg-neutral-800 animate-pulse rounded-none"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
