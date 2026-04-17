<script lang="ts">
  import type { PageData } from './$types';
  import { CATEGORY_LABELS, formatDate } from '$lib/blog/posts';

  let { data }: { data: PageData } = $props();
</script>

<section class="blog-page">
  <header class="blog-hero">
    <div class="eyebrow">Blog</div>
    <h1>Thinking on markets and beliefs.</h1>
    <p>
      Opinion, analysis, and product thinking from the team building Cascade.
    </p>
  </header>

  <div class="blog-list">
    {#each data.posts as post}
      <a class="blog-row" href="/blog/{post.slug}">
        <div class="blog-row-meta">
          <span class="blog-category">{CATEGORY_LABELS[post.category]}</span>
          <time class="blog-date" datetime={post.date}>{formatDate(post.date)}</time>
        </div>
        <div class="blog-row-content">
          <h2>{post.title}</h2>
          <p>{post.excerpt}</p>
        </div>
        <span class="blog-row-arrow" aria-hidden="true">→</span>
      </a>
    {/each}
  </div>
</section>

<style>
  .blog-page {
    display: grid;
    gap: 3rem;
  }

  .blog-hero h1 {
    font-size: clamp(2rem, 4vw, 3.2rem);
    letter-spacing: -0.05em;
    margin-top: 0.5rem;
  }

  .blog-hero p {
    max-width: 46rem;
    margin-top: 0.7rem;
    font-size: 1.05rem;
    color: color-mix(in srgb, var(--color-neutral-content) 78%, transparent);
  }

  .blog-list {
    display: grid;
    border-top: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
  }

  .blog-row {
    display: grid;
    grid-template-columns: 14rem 1fr 2rem;
    gap: 2rem;
    align-items: start;
    padding: 1.6rem 0;
    border-bottom: 1px solid color-mix(in srgb, var(--color-neutral) 85%, transparent);
    text-decoration: none;
    color: inherit;
    transition: background 0.1s;
  }

  .blog-row:hover {
    background: color-mix(in srgb, var(--color-base-200) 60%, transparent);
  }

  .blog-row:hover .blog-row-arrow {
    color: white;
  }

  .blog-row:hover h2 {
    color: white;
  }

  .blog-row-meta {
    display: grid;
    gap: 0.35rem;
    padding-top: 0.2rem;
  }

  .blog-category {
    font-size: 0.72rem;
    font-family: var(--font-mono);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--color-neutral-content) 55%, transparent);
  }

  .blog-date {
    font-size: 0.82rem;
    font-family: var(--font-mono);
    color: color-mix(in srgb, var(--color-neutral-content) 45%, transparent);
  }

  .blog-row-content h2 {
    font-size: 1.15rem;
    font-weight: 600;
    letter-spacing: -0.025em;
    color: color-mix(in srgb, var(--color-neutral-content) 95%, transparent);
    margin: 0 0 0.45rem;
    transition: color 0.1s;
  }

  .blog-row-content p {
    font-size: 0.92rem;
    line-height: 1.6;
    color: color-mix(in srgb, var(--color-neutral-content) 60%, transparent);
    margin: 0;
  }

  .blog-row-arrow {
    font-size: 1rem;
    color: color-mix(in srgb, var(--color-neutral-content) 30%, transparent);
    padding-top: 0.15rem;
    transition: color 0.1s;
    text-align: right;
  }

  @media (max-width: 640px) {
    .blog-row {
      grid-template-columns: 1fr;
      gap: 0.75rem;
    }

    .blog-row-meta {
      grid-template-columns: auto auto;
      gap: 0.75rem;
      align-items: center;
    }

    .blog-row-arrow {
      display: none;
    }
  }
</style>
