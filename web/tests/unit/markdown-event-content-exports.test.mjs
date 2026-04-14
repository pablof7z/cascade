import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('markdown event content companion types expose a default component export for TypeScript', () => {
  const source = read('src/lib/ndk/ui/markdown-event-content/markdown-event-content.svelte.ts');

  assert.match(source, /declare const MarkdownEventContent: Component<MarkdownEventContentProps>;/);
  assert.match(source, /export default MarkdownEventContent;/);
});
