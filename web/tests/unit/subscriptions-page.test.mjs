import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

test('/subscriptions route exists and uses real follow graph state', () => {
  assert.equal(existsSync(path.join(webRoot, 'src/routes/subscriptions/+page.svelte')), true);
  assert.equal(existsSync(path.join(webRoot, 'src/routes/subscriptions/+page.server.ts')), true);

  const source = read('src/routes/subscriptions/+page.svelte');
  const server = read('src/routes/subscriptions/+page.server.ts');

  assert.match(server, /fetchRecentMarkets\(120, \{ edition \}\)/);
  assert.match(server, /fetchRecentTrades\(480, \{ edition \}\)/);
  assert.match(server, /hideRightRail: true/);
  assert.match(source, /const followFeed = ndk\.\$subscribe/);
  assert.match(source, /kinds: \[3\], authors: \[currentUser\.pubkey\], limit: 1/);
  assert.match(source, /tag\[0\] === 'p'/);
  assert.match(source, /authors: followedAuthorList/);
  assert.match(source, /filterLiveHomepageMarkets/);
});

test('/subscriptions page follows The Column reading inbox shape', () => {
  const source = read('src/routes/subscriptions/+page.svelte');
  const layout = read('src/routes/+layout.svelte');
  const forbiddenMechanicsCopy = new RegExp(
    ['resol' + 'ution', 'resol' + 'ved', 'market ' + 'closes', 'winner ' + 'pay' + 'out', 'or' + 'acle'].join('|'),
    'i'
  );

  assert.match(source, /<h1[^>]*>Subscriptions<\/h1>/);
  assert.match(source, /Claims from the writers you follow/);
  assert.match(source, /`Unread \$\{unreadCount\}`/);
  assert.match(source, /Case revisions 0/);
  assert.match(source, /Read the case/);
  assert.match(source, /You're not following anyone yet\./);
  assert.match(layout, /class:column-shell--no-right-rail=\{hideRightRail\}/);
  assert.match(layout, /\{#if !hideRightRail\}[\s\S]*<aside class="column-right"/);
  assert.doesNotMatch(source, forbiddenMechanicsCopy);
});
