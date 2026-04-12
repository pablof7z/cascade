import EmbeddedNote from './embedded-note.svelte';
import { defaultContentRenderer } from '../../ui/content-renderer';
import type { ContentRenderer } from '../../ui/content-renderer';

export function register(renderer: ContentRenderer = defaultContentRenderer) {
  renderer.addKind([1, 1111], EmbeddedNote, 10);
}

register();

export { EmbeddedNote };
export default EmbeddedNote;
