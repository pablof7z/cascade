import type { NDKSvelte } from '@nostr-dev-kit/svelte';
import type { Component } from 'svelte';
import type { ContentRenderer } from '../content-renderer';

export interface MarkdownEventContentProps {
  ndk?: NDKSvelte;
  content: string;
  emojiTags?: string[][];
  renderer?: ContentRenderer;
  class?: string;
}

declare const MarkdownEventContent: Component<MarkdownEventContentProps>;

export default MarkdownEventContent;
