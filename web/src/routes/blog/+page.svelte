<script lang="ts">
  import type { PageData } from './$types';
  import { CATEGORY_LABELS, formatDate } from '$lib/blog/posts';

  let { data }: { data: PageData } = $props();
</script>

<div class="grid gap-12">
  <header class="grid gap-3">
    <div class="eyebrow">Blog</div>
    <h1 class="text-[clamp(2rem,4vw,3.2rem)] tracking-[-0.05em]">Thinking on markets and beliefs.</h1>
    <p class="max-w-[46rem] text-base-content/70 leading-[1.75]">
      Opinion, analysis, and product thinking from the team building Cascade.
    </p>
  </header>

  <div class="border-t border-base-300">
    {#each data.posts as post}
      <a class="group grid grid-cols-1 gap-3 sm:grid-cols-[14rem_1fr_2rem] sm:gap-8 items-start py-6 border-b border-base-300 hover:bg-base-200/60 transition-colors" href="/blog/{post.slug}">
        <div class="grid gap-1 pt-0 sm:pt-1">
          <span class="font-mono text-xs uppercase tracking-wide text-base-content/55">{CATEGORY_LABELS[post.category]}</span>
          <time class="font-mono text-sm text-base-content/45" datetime={post.date}>{formatDate(post.date)}</time>
        </div>
        <div>
          <h2 class="text-base font-semibold tracking-[-0.025em] text-base-content/95 group-hover:text-white transition-colors mb-2">{post.title}</h2>
          <p class="text-sm leading-[1.6] text-base-content/60">{post.excerpt}</p>
        </div>
        <span class="hidden sm:block text-base-content/30 group-hover:text-white transition-colors pt-1 text-right" aria-hidden="true">→</span>
      </a>
    {/each}
  </div>
</div>
