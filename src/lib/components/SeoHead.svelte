<script lang="ts">
  interface Props {
    title: string;
    description?: string;
    image?: string;
    url?: string;
    type?: 'website' | 'article';
  }

  let { title, description, image, url, type = 'website' }: Props = $props();

  let fullTitle = $derived(`${title} | Cascade`);
</script>

<svelte:head>
  <title>{fullTitle}</title>
  {#if description}
    <meta name="description" content={description} />
  {/if}

  <!-- Open Graph -->
  <meta property="og:type" content={type} />
  <meta property="og:title" content={fullTitle} />
  {#if description}
    <meta property="og:description" content={description} />
  {/if}
  {#if image}
    <meta property="og:image" content={image} />
  {/if}
  {#if url}
    <meta property="og:url" content={url} />
  {/if}

  <!-- Twitter / X -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  {#if description}
    <meta name="twitter:description" content={description} />
  {/if}
  {#if image}
    <meta name="twitter:image" content={image} />
  {/if}
</svelte:head>
