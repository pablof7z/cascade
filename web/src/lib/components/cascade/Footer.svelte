<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="border-t border-neutral-800 py-12 pb-8">
  <div class="shell grid gap-8 md:grid-cols-2 xl:grid-cols-[1.25fr_repeat(3,minmax(0,1fr))]">
    <div class="grid gap-3">
      <a class="inline-block text-lg font-semibold text-white" href="/">Cascade</a>
      <p class="max-w-xs text-sm leading-6 text-neutral-400">
        Trade on ideas that do not expire. Markets stay open as evidence accumulates.
      </p>
    </div>

    <div class="grid gap-2 text-sm text-neutral-400">
      <h2 class="text-xs font-medium uppercase tracking-[0.08em] text-white">Navigate</h2>
      <a class="hover:text-white" href="/">Markets</a>
      <a class="hover:text-white" href="/builder">Create Market</a>
      <a class="hover:text-white" href="/analytics">Analytics</a>
      <a class="hover:text-white" href="/leaderboard">Leaderboard</a>
    </div>

    <div class="grid gap-2 text-sm text-neutral-400">
      <h2 class="text-xs font-medium uppercase tracking-[0.08em] text-white">Account</h2>
      <a class="hover:text-white" href="/join">Join</a>
      <a class="hover:text-white" href="/portfolio">Portfolio</a>
      <a class="hover:text-white" href="/bookmarks">Bookmarks</a>
    </div>

    <div class="grid gap-2 text-sm text-neutral-400">
      <h2 class="text-xs font-medium uppercase tracking-[0.08em] text-white">Reference</h2>
      <a class="hover:text-white" href="/how-it-works">How It Works</a>
      <a class="hover:text-white" href="/blog">Blog</a>
      <a class="hover:text-white" href="/terms">Terms</a>
      <a class="hover:text-white" href="/privacy">Privacy</a>
    </div>
  </div>

  <div
    class="shell mt-10 flex flex-col gap-3 border-t border-neutral-800 pt-4 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between"
  >
    <span>© {currentYear} Cascade.</span>
    <span class="font-mono">Public markets for infinite games.</span>
  </div>
</footer>
