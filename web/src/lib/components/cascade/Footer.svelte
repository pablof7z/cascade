<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="footer footer-horizontal border-t border-base-300 bg-base-100 p-10 text-base-content/70">
  <div class="shell flex flex-wrap justify-between gap-6">
    <div class="grid gap-3">
      <a class="inline-block text-lg font-semibold text-white" href="/">Cascade</a>
      <p class="max-w-xs text-sm leading-6">
        Trade on ideas that do not expire. Markets stay open as evidence accumulates.
      </p>
    </div>

    <nav class="grid gap-2 text-sm">
      <h2 class="text-xs font-medium uppercase tracking-[0.08em] text-white">Navigate</h2>
      <a class="hover:text-white" href="/">Markets</a>
      <a class="hover:text-white" href="/builder">Create Market</a>
      <a class="hover:text-white" href="/leaderboard">Leaderboard</a>
    </nav>

    <nav class="grid gap-2 text-sm">
      <h2 class="text-xs font-medium uppercase tracking-[0.08em] text-white">Account</h2>
      <a class="hover:text-white" href="/join">Join</a>
      <a class="hover:text-white" href="/portfolio">Portfolio</a>
      <a class="hover:text-white" href="/bookmarks">Bookmarks</a>
    </nav>

    <nav class="grid gap-2 text-sm">
      <h2 class="text-xs font-medium uppercase tracking-[0.08em] text-white">Reference</h2>
      <a class="hover:text-white" href="/how-it-works">How It Works</a>
      <a class="hover:text-white" href="/terms">Terms</a>
      <a class="hover:text-white" href="/privacy">Privacy</a>
    </nav>
  </div>

  <div class="shell mt-10 flex flex-col gap-3 border-t border-base-300 pt-4 text-xs text-base-content/50 sm:flex-row sm:items-center sm:justify-between">
    <span>© {currentYear} Cascade.</span>
    <span class="font-mono">Public markets for infinite games.</span>
  </div>
</footer>
