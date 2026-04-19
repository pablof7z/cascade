<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<article class="grid gap-12 max-w-[46rem]">
  <header class="grid gap-4">
    <div class="flex items-center gap-5">
      <a class="font-mono text-sm text-base-content/50 hover:text-base-content/90 transition-colors" href="/blog">← Blog</a>
      <span class="font-mono text-xs uppercase tracking-wide text-base-content/45">{data.categoryLabel}</span>
    </div>
    <h1 class="text-[clamp(1.8rem,4vw,2.8rem)] tracking-[-0.045em] leading-[1.15]">{data.post.title}</h1>
    <div class="font-mono text-sm text-base-content/45 pb-6 border-b border-base-300">
      <time datetime={data.post.date}>{data.formattedDate}</time>
    </div>
  </header>

  <div class="post-body grid gap-6">
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html data.post.body}
  </div>

      <footer class="pt-8 border-t border-base-300">
    <div class="flex items-center justify-between gap-8 flex-wrap">
      <span class="text-base-content/70">Want to trade on the ideas in this post?</span>
      <div class="flex gap-3">
        <a class="rail-cta" href="/">Explore markets</a>
        <a class="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-base-300 rounded-md text-sm font-medium transition-colors hover:border-base-content/50" href="/blog">More writing</a>
      </div>
    </div>
  </footer>
</article>

<style>
  .post-body :global(p) {
    line-height: 1.75;
    color: color-mix(in srgb, var(--color-base-content) 80%, transparent);
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
    color: color-mix(in srgb, var(--color-base-content) 78%, transparent);
    line-height: 1.65;
    margin: 0;
  }

  .post-body :global(blockquote) {
    border-left: 2px solid var(--color-base-300);
    padding-left: 1.2rem;
    color: color-mix(in srgb, var(--color-base-content) 65%, transparent);
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
</style>
