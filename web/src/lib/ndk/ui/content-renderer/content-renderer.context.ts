import type { ContentRenderer } from './index.svelte.js';

export const CONTENT_RENDERER_CONTEXT_KEY = Symbol('content-renderer');

export interface ContentRendererContext {
  renderer: ContentRenderer;
}
