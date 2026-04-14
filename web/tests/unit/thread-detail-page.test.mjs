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

test('thread detail page renders full reply content without truncation', () => {
  const source = read('src/routes/market/[slug]/discussion/[threadId]/+page.svelte');

  assert.match(source, /<p class="page-subtitle">\{node\.post\.content\}<\/p>/);
  assert.doesNotMatch(source, /truncateText\(node\.post\.content,\s*400\)/);
  assert.doesNotMatch(source, /formatRelativeTime,\s*marketDiscussionUrl,\s*truncateText/);
});
