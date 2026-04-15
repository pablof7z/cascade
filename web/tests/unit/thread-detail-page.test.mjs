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

test('thread detail page keeps the heading on the root post only', () => {
  const source = read('src/routes/market/[slug]/discussion/[threadId]/+page.svelte');

  assert.match(source, /\{#snippet renderThread\(node: DiscussionThread, isRoot: boolean = false\)\}/);
  assert.match(source, /\{@render renderThread\(data\.thread, true\)\}/);
  assert.match(source, /\{@render renderThread\(reply, false\)\}/);
  assert.match(source, /\{#if isRoot && node\.post\.subject\}[\s\S]*<h2 class="section-title">\{node\.post\.subject\}<\/h2>[\s\S]*\{\/if\}/);
  assert.doesNotMatch(source, /<h2 class="section-title">\{node\.post\.subject \|\| 'Reply'\}<\/h2>/);
});

test('thread detail page shows current market context and trading link', () => {
  const source = read('src/routes/market/[slug]/discussion/[threadId]/+page.svelte');

  assert.match(
    source,
    /import \{ buildThreadReplyTags, buildTradeSummary, formatProbability, formatRelativeTime, marketDiscussionUrl \} from '\$lib\/ndk\/cascade';/
  );
  assert.match(source, /const tradeSummary = \$derived\(buildTradeSummary\(data\.trades\)\);/);
  assert.match(source, /const impliedProbability = \$derived\(\(tradeSummary\.latestPricePpm \?\? 500_000\) \/ 1_000_000\);/);
  assert.match(
    source,
    /<div class="market-context-bar">[\s\S]*href="\/market\/\{data\.market\.slug\}"[\s\S]*\{data\.market\.title\}[\s\S]*LONG \{formatProbability\(impliedProbability\)\}[\s\S]*Buy LONG \/ Buy SHORT/
  );
});
