<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<article class="post-page">
  <header class="post-header">
    <div class="post-header-meta">
      <a class="post-back" href="/blog">← Blog</a>
      <span class="post-category">{data.categoryLabel}</span>
    </div>
    <h1>{data.post.title}</h1>
    <div class="post-byline">
      <time datetime={data.post.date}>{data.formattedDate}</time>
    </div>
  </header>

  <div class="post-body">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html data.post.body}
  </div>

  <footer class="post-footer">
    <div class="post-footer-inner">
      <span>Want to trade on the ideas in this post?</span>
      <div class="post-footer-actions">
        <a class="btn btn-primary" href="/">Explore markets</a>
        <a class="btn btn-outline" href="/blog">More writing</a>
      </div>
    </div>
  </footer>
</article>

<style>
  .post-page {
    display: grid;
    gap: 3rem;
    max-width: 46rem;
  }

  /* ── Header ── */

  .post-header {
    display: grid;
    gap: 0.9rem;
  }

  .post-header-meta {
    display: flex;
    align-items: center;
    gap: 1.2rem;
  }

  .post-back {
    font-size: 0.82rem;
    font-family: var(--font-mono);
    color: color-mix(in srgb, var(--color-neutral-content) 50%, transparent);
    text-decoration: none;
    transition: color 0.1s;
  }

  .post-back:hover {
    color: color-mix(in srgb, var(--color-neutral-content) 90%, transparent);
  }

  .post-category {
    font-size: 0.72rem;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-neutral-content) 45%, transparent);
  }

  .post-header h1 {
    font-size: clamp(1.8rem, 4vw, 2.8rem);
    letter-spacing: -0.045em;
    line-height: 1.15;
  }

  .post-byline {
    font-size: 0.82rem;
    font-family: var(--font-mono);
    color: color-mix(in srgb, var(--color-neutral-content) 45%, transparent);
    padding-bottom: 1.5rem;
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  /* ── Body ── */

  .post-body {
    display: grid;
    gap: 1.4rem;
  }

  .post-body :global(p) {
    line-height: 1.75;
    color: color-mix(in srgb, var(--color-neutral-content) 80%, transparent);
    margin: 0;
  }

  .post-body :global(h2) {
    font-size: 1.25rem;
    font-weight: 600;
    letter-spacing: -0.03em;
    color: white;
    margin: 1rem 0 0;
  }

  .post-body :global(h3) {
    font-size: 1.05rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    color: white;
    margin: 0.75rem 0 0;
  }

  .post-body :global(ul),
  .post-body :global(ol) {
    display: grid;
    gap: 0.5rem;
    padding-left: 1.4rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
    line-height: 1.65;
    margin: 0;
  }

  .post-body :global(blockquote) {
    border-left: 2px solid color-mix(in srgb, var(--color-neutral) 100%, transparent);
    padding-left: 1.2rem;
    color: color-mix(in srgb, var(--color-neutral-content) 65%, transparent);
    font-style: italic;
    margin: 0;
  }

  .post-body :global(strong) {
    color: white;
    font-weight: 600;
  }

  .post-body :global(em) {
    font-style: italic;
  }

  /* ── Footer CTA ── */

  .post-footer {
    padding-top: 2rem;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .post-footer-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
    flex-wrap: wrap;
  }

  .post-footer-inner > span {
    font-size: 0.95rem;
    color: color-mix(in srgb, var(--color-neutral-content) 70%, transparent);
  }

  .post-footer-actions {
    display: flex;
    gap: 0.75rem;
  }
</style>
