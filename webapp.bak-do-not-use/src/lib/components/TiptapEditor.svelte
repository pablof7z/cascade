<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';
  
  interface Props {
    content?: string;
    placeholder?: string;
    onUpdate?: (html: string) => void;
  }
  
  let { content = '', placeholder = 'Start writing...', onUpdate }: Props = $props();
  let element: HTMLElement;
  let editor: Editor | null = null;
  
  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder }),
      ],
      content,
      onUpdate: () => {
        onUpdate?.(editor!.getHTML());
      },
    });
  });
  
  onDestroy(() => {
    editor?.destroy();
  });
</script>

<div bind:this={element} class="prose prose-invert prose-sm max-w-none"></div>

<style>
  :global(.ProseMirror) {
    outline: none;
    min-height: 200px;
  }
  :global(.ProseMirror p.is-editor-empty:first-child::before) {
    color: #6b7280;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }
</style>
