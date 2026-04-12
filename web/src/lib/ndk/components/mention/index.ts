import Mention from './mention.svelte';
import { defaultContentRenderer } from '../../ui/content-renderer';
import type { ContentRenderer } from '../../ui/content-renderer';

export function register(renderer: ContentRenderer = defaultContentRenderer) {
  renderer.setMentionComponent(Mention, 10);
}

register();

export { Mention };
export default Mention;
