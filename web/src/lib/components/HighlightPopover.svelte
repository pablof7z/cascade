<script lang="ts">
  import { NDKEvent } from '@nostr-dev-kit/ndk';
  import { ndk } from '$lib/ndk/client';

  interface Props {
    /** The article event to reference in highlights */
    articleEvent: NDKEvent;
    /** The container element to listen for selections in */
    containerEl?: HTMLElement | null;
  }

  let { articleEvent, containerEl = null }: Props = $props();

  const currentUser = $derived(ndk.$currentUser);

  let visible = $state(false);
  let popoverX = $state(0);
  let popoverY = $state(0);
  let selectedText = $state('');
  let contextText = $state('');
  let showNoteInput = $state(false);
  let noteText = $state('');
  let publishing = $state(false);

  function getContext(selection: Selection): string {
    const range = selection.getRangeAt(0);
    const container = range.startContainer.parentElement?.closest('p, li, blockquote, h1, h2, h3, h4, h5, h6');
    if (!container) return '';
    const full = container.textContent?.trim() ?? '';
    if (full === selectedText.trim()) return '';
    return full;
  }

  function showPopoverForSelection() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return;

    const range = selection.getRangeAt(0);

    // Check if selection is within the article content container
    if (containerEl && !containerEl.contains(range.commonAncestorContainer)) return;

    selectedText = selection.toString().trim();
    contextText = getContext(selection);

    const rect = range.getBoundingClientRect();
    popoverX = rect.left + rect.width / 2;
    popoverY = rect.top - 8;
    visible = true;
  }

  function handleMouseUp() {
    setTimeout(showPopoverForSelection, 10);
  }

  function handleMouseDown(e: MouseEvent) {
    if (!visible) return;
    const popoverEl = document.querySelector('.highlight-popover');
    if (popoverEl?.contains(e.target as Node)) return;
    visible = false;
    showNoteInput = false;
    noteText = '';
  }

  $effect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  });

  async function publishHighlight() {
    if (!currentUser || !selectedText || publishing) return;

    publishing = true;
    try {
      const highlight = new NDKEvent(ndk);
      highlight.kind = 9802;
      highlight.content = selectedText;

      // Tag the article per NIP-84
      const articleAddress = articleEvent.tagId();
      if (articleAddress.includes(':')) {
        highlight.tags.push(['a', articleAddress]);
      }
      if (articleEvent.id) {
        highlight.tags.push(['e', articleEvent.id]);
      }

      // Tag the author
      if (articleEvent.pubkey) {
        highlight.tags.push(['p', articleEvent.pubkey, '', 'author']);
      }

      // Add context if available
      if (contextText && contextText !== selectedText) {
        highlight.tags.push(['context', contextText]);
      }

      // Add note/comment if provided
      if (noteText.trim()) {
        highlight.tags.push(['comment', noteText.trim()]);
      }

      await highlight.publish();

      visible = false;
      showNoteInput = false;
      noteText = '';
      selectedText = '';
      window.getSelection()?.removeAllRanges();
    } finally {
      publishing = false;
    }
  }
</script>

{#if visible && currentUser}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="highlight-popover"
    style="left: {popoverX}px; top: {popoverY}px;"
    onmousedown={(e) => e.preventDefault()}
  >
    {#if showNoteInput}
      <div class="highlight-popover-note">
        <textarea
          class="highlight-note-input"
          placeholder="Add a note…"
          bind:value={noteText}
          rows="2"
          onkeydown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) publishHighlight();
          }}
        ></textarea>
        <div class="highlight-note-actions">
          <button class="highlight-cancel-btn" onclick={() => { showNoteInput = false; noteText = ''; }}>
            Cancel
          </button>
          <button class="highlight-save-btn" disabled={publishing} onclick={publishHighlight}>
            {publishing ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    {:else}
      <button
        class="highlight-action-btn"
        title="Highlight this text"
        disabled={publishing}
        onclick={publishHighlight}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        <span>Highlight</span>
      </button>
      <span class="highlight-popover-divider"></span>
      <button
        class="highlight-action-btn"
        title="Highlight with a note"
        onclick={() => { showNoteInput = true; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Note</span>
      </button>
    {/if}
  </div>
{/if}

<style>
  .highlight-popover {
    position: fixed;
    transform: translate(-50%, -100%);
    z-index: 1000;
    background: var(--text-strong);
    color: white;
    border-radius: var(--radius-md);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
    display: flex;
    align-items: center;
    gap: 0;
    animation: highlight-popover-in 120ms ease-out;
  }

  @keyframes highlight-popover-in {
    from {
      opacity: 0;
      transform: translate(-50%, -100%) translateY(4px);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -100%) translateY(0);
    }
  }

  .highlight-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    color: white;
    font-size: 0.82rem;
    font-weight: 500;
    font-family: var(--font-sans);
    cursor: pointer;
    white-space: nowrap;
    transition: background 100ms ease;
    border-radius: var(--radius-md);
  }

  .highlight-action-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .highlight-action-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .highlight-popover-divider {
    width: 1px;
    height: 1.2rem;
    background: rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }

  .highlight-popover-note {
    display: grid;
    gap: 0.5rem;
    padding: 0.5rem;
    min-width: 260px;
  }

  .highlight-note-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.08);
    color: white;
    font-size: 0.85rem;
    font-family: var(--font-sans);
    line-height: 1.4;
    resize: none;
  }

  .highlight-note-input::placeholder {
    color: rgba(255, 255, 255, 0.45);
  }

  .highlight-note-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.4);
  }

  .highlight-note-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.4rem;
  }

  .highlight-cancel-btn,
  .highlight-save-btn {
    border: none;
    padding: 0.3rem 0.65rem;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: var(--font-sans);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }

  .highlight-cancel-btn {
    background: transparent;
    color: rgba(255, 255, 255, 0.6);
  }

  .highlight-cancel-btn:hover {
    color: white;
  }

  .highlight-save-btn {
    background: var(--accent);
    color: white;
  }

  .highlight-save-btn:hover {
    background: var(--accent-hover);
  }

  .highlight-save-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
