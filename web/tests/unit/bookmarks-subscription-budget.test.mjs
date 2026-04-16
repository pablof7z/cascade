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

test('bookmarks page keeps live relay subscriptions bounded', () => {
  const source = read('src/routes/bookmarks/+page.svelte');

  const subscribeCount = source.match(/ndk\.\$subscribe/g)?.length ?? 0;
  assert.ok(
    subscribeCount <= 2,
    `expected at most 2 live subscriptions on /bookmarks, found ${subscribeCount}`
  );

  const marketSubscriptionCount = source.match(/kinds:\s*\[eventKinds\.market\]/g)?.length ?? 0;
  assert.ok(
    marketSubscriptionCount <= 1,
    `expected one combined market subscription, found ${marketSubscriptionCount}`
  );

  assert.doesNotMatch(source, /const\s+myMarkets\s*=\s*ndk\.\$subscribe/);
  assert.doesNotMatch(source, /const\s+networkBookmarks\s*=\s*ndk\.\$subscribe/);
  assert.doesNotMatch(source, /const\s+trendingMarkets\s*=\s*ndk\.\$subscribe/);

  assert.doesNotMatch(
    source,
    /filters:\s*\[\{\s*kinds:\s*\[10003\],\s*limit:\s*(?:200|[2-9]\d{2,})\s*\}\]/,
    'bookmarks page should not open a high-limit network-wide bookmark scan'
  );

  assert.match(
    source,
    /authors:\s*\[currentUser\.pubkey\][\s\S]*limit:\s*1/,
    'bookmarks page should still fetch the current user bookmark list directly'
  );

  assert.match(source, /async function removeBookmark\(marketId: string\)/);
});
