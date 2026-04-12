<script lang="ts">
  interface Props {
    url: string;
    title: string;
  }

  let { url, title }: Props = $props();

  let open = $state(false);
  let copied = $state(false);
  let buttonEl = $state<HTMLButtonElement | null>(null);
  let popoverEl = $state<HTMLDivElement | null>(null);

  const encodedUrl = $derived(encodeURIComponent(url));
  const encodedTitle = $derived(encodeURIComponent(title));

  const xHref = $derived(
    `https://x.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`
  );
  const facebookHref = $derived(
    `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
  );
  const linkedinHref = $derived(
    `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
  );

  function toggle() {
    open = !open;
  }

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function handleDocumentClick(e: MouseEvent) {
    if (!open) return;
    if (buttonEl?.contains(e.target as Node)) return;
    if (popoverEl?.contains(e.target as Node)) return;
    open = false;
  }

  $effect(() => {
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  });
</script>

<div class="share-trigger-wrap">
  <button
    bind:this={buttonEl}
    class="share-btn"
    class:active={open}
    title="Share this article"
    onclick={toggle}
    aria-expanded={open}
    aria-haspopup="true"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  </button>

  {#if open}
    <div bind:this={popoverEl} class="share-popover" role="menu">
      <a class="share-popover-item" href={xHref} target="_blank" rel="noopener noreferrer" role="menuitem" onclick={() => (open = false)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
        <span>X / Twitter</span>
      </a>
      <a class="share-popover-item" href={facebookHref} target="_blank" rel="noopener noreferrer" role="menuitem" onclick={() => (open = false)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        <span>Facebook</span>
      </a>
      <a class="share-popover-item" href={linkedinHref} target="_blank" rel="noopener noreferrer" role="menuitem" onclick={() => (open = false)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        <span>LinkedIn</span>
      </a>
      <div class="share-popover-divider"></div>
      <button class="share-popover-item share-copy-btn" onclick={copyLink} role="menuitem">
        {#if copied}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Copied!</span>
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy link</span>
        {/if}
      </button>
    </div>
  {/if}
</div>

<style>
  .share-trigger-wrap {
    position: relative;
  }

  .share-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.5rem;
    height: 2.5rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 9999px;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: color 160ms ease, border-color 160ms ease, background 160ms ease, transform 160ms ease;
  }

  .share-btn:hover,
  .share-btn.active {
    color: var(--text);
    border-color: var(--text);
  }

  .share-btn:active {
    transform: scale(0.92);
  }

  .share-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 100;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
    min-width: 160px;
    padding: 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0;
    animation: share-popover-in 120ms ease-out;
  }

  @keyframes share-popover-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .share-popover-item {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.5rem 0.65rem;
    border-radius: var(--radius-sm);
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text);
    text-decoration: none;
    cursor: pointer;
    transition: background 100ms ease;
    white-space: nowrap;
    border: none;
    background: none;
    font-family: var(--font-sans);
    width: 100%;
    text-align: left;
  }

  .share-popover-item:hover {
    background: var(--surface-hover, rgba(0, 0, 0, 0.05));
  }

  .share-copy-btn.share-popover-item {
    color: var(--text);
  }

  .share-popover-divider {
    height: 1px;
    background: var(--border-light, var(--border));
    margin: 0.25rem 0;
  }
</style>
