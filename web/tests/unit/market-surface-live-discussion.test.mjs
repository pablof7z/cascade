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

test('market surface merges seeded and live discussion events for the active market', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(source, /import \{ browser \} from '\$app\/environment';/);
  assert.match(source, /import type \{ NostrEvent \} from 'nostr-tools';/);
  assert.match(source, /parseDiscussionEvent/);
  assert.match(
    source,
    /const discussionFeed = ndk\.\$subscribe\(\(\) => \{[\s\S]*if \(!browser\) return undefined;[\s\S]*filters: \[\{ kinds: \[1111\], '#e': \[market\.id\], limit: 200 \}\][\s\S]*\}\);/
  );
  assert.match(
    source,
    /const mergedDiscussions = \$derived\.by\(\(\) => \{[\s\S]*mergeRawEvents\([\s\S]*discussions\.map\(\(discussion\) => discussion\.rawEvent(?: as NostrEvent)?\)[\s\S]*discussionFeed\.events[\s\S]*\)[\s\S]*\.map\(\(event\) => parseDiscussionEvent\(event, selectedEdition\)\)[\s\S]*\.filter\(\(discussion\): discussion is DiscussionRecord => Boolean\(discussion\)\)/
  );
  assert.match(source, /const discussionThreads = \$derived\(buildDiscussionThreads\(mergedDiscussions, market\.id\)\);/);
  assert.match(source, /\.\.\.mergedDiscussions\.map\(\(discussion\) => \(\{/);
  assert.match(source, /function mergeRawEvents\(seed: NostrEvent\[], live: NDKEvent\[]\): NostrEvent\[] \{/);
});
