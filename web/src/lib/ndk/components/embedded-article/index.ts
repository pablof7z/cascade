import EmbeddedArticle from './embedded-article.svelte';
import { defaultContentRenderer } from '../../ui/content-renderer';
import type { ContentRenderer } from '../../ui/content-renderer';

export function register(renderer: ContentRenderer = defaultContentRenderer) {
  renderer.addKind([30023], EmbeddedArticle, 10);
}

register();

export { EmbeddedArticle };
export default EmbeddedArticle;
