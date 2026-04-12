<script lang="ts">
  const currentYear = new Date().getFullYear();
</script>

<footer class="cascade-footer">
  <div class="footer-grid">
    <div class="footer-brand-column">
      <a class="footer-brand" href="/">Cascade</a>
      <p>Trade on ideas that do not expire. Markets stay open as evidence accumulates.</p>
    </div>

    <div>
      <h2>Navigate</h2>
      <a href="/">Markets</a>
      <a href="/builder">Create Market</a>
      <a href="/analytics">Analytics</a>
      <a href="/leaderboard">Leaderboard</a>
    </div>

    <div>
      <h2>Account</h2>
      <a href="/join">Join</a>
      <a href="/portfolio">Portfolio</a>
      <a href="/wallet">Wallet</a>
      <a href="/bookmarks">Bookmarks</a>
    </div>

    <div>
      <h2>Reference</h2>
      <a href="/how-it-works">How It Works</a>
      <a href="/blog">Blog</a>
      <a href="/terms">Terms</a>
      <a href="/privacy">Privacy</a>
    </div>
  </div>

  <div class="footer-bottom">
    <span>© {currentYear} Cascade.</span>
    <span class="footer-build">Public markets for infinite games.</span>
  </div>
</footer>

<style>
  .cascade-footer {
    border-top: 1px solid var(--border-subtle);
    padding: 3rem 0 2rem;
  }

  .footer-grid {
    width: min(calc(100% - 2.5rem), var(--page-width));
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1.25fr repeat(3, minmax(0, 1fr));
    gap: 2rem;
  }

  .footer-brand {
    display: inline-block;
    color: var(--text-strong);
    font-size: 1.15rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }

  .footer-brand-column p {
    margin: 0;
    max-width: 18rem;
    color: var(--text-muted);
    font-size: 0.92rem;
    line-height: 1.65;
  }

  .cascade-footer h2 {
    margin: 0 0 0.8rem;
    color: var(--text-strong);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .cascade-footer p,
  .cascade-footer a {
    display: block;
    margin: 0.35rem 0;
    color: var(--text-muted);
    font-size: 0.92rem;
  }

  .cascade-footer a:hover,
  .cascade-footer a:focus-visible {
    color: var(--text-strong);
    outline: none;
  }

  .footer-bottom {
    width: min(calc(100% - 2.5rem), var(--page-width));
    margin: 2.5rem auto 0;
    padding-top: 1.1rem;
    border-top: 1px solid rgba(38, 38, 38, 0.7);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    color: var(--text-faint);
    font-size: 0.78rem;
  }

  .footer-build {
    font-family: var(--font-mono);
  }

  @media (max-width: 900px) {
    .footer-grid {
      grid-template-columns: 1fr 1fr;
    }
  }

  @media (max-width: 640px) {
    .footer-grid {
      grid-template-columns: 1fr;
    }

    .footer-bottom {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
