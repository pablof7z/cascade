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

test('market surface adds a logged-in bookmark toggle backed by kind 10003 events', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(source, /import BookmarkIcon from '\$lib\/components\/BookmarkIcon\.svelte';/);
  assert.match(
    source,
    /const myBookmarkList = ndk\.\$subscribe\(\(\) => \{[\s\S]*if \(!browser \|\| !currentUser\) return undefined;[\s\S]*filters: \[\{ kinds: \[10003\], authors: \[currentUser\.pubkey\], limit: 1 \}\][\s\S]*\}\);/
  );
  assert.match(
    source,
    /const isBookmarked = \$derived\.by\(\(\) => \{[\s\S]*const event = myBookmarkList\.events\[0\];[\s\S]*if \(!event\) return false;[\s\S]*event\.tags\.some\(\(tag\) => tag\[0\] === 'e' && tag\[1\] === market\.id\)/
  );
  assert.match(
    source,
    /async function toggleBookmark\(\) \{[\s\S]*if \(!currentUser\) return;[\s\S]*const existing = myBookmarkList\.events\[0\];[\s\S]*const updated = new NDKEvent\(ndk\);[\s\S]*updated\.kind = 10003;[\s\S]*if \(existing\) \{[\s\S]*if \(isBookmarked\) \{[\s\S]*updated\.tags = existing\.tags\.filter\(\(tag\) => !\(tag\[0\] === 'e' && tag\[1\] === market\.id\)\);[\s\S]*\} else \{[\s\S]*updated\.tags = \[\.\.\.existing\.tags, \['e', market\.id\]\];[\s\S]*\}[\s\S]*\} else \{[\s\S]*updated\.tags = \[\['e', market\.id\]\];[\s\S]*\}[\s\S]*await updated\.publish\(\);[\s\S]*\}/
  );
  assert.match(
    source,
    /\{#if currentUser\}[\s\S]*<button[\s\S]*class="market-bookmark-button"[\s\S]*class:bookmarked=\{isBookmarked\}[\s\S]*onclick=\{toggleBookmark\}[\s\S]*<BookmarkIcon size=\{14\} filled=\{isBookmarked\} \/>[\s\S]*<span>\{isBookmarked \? 'Saved' : 'Save'\}<\/span>[\s\S]*<\/button>[\s\S]*\{\/if\}/
  );
});

test('market surface renders the share popover in the header actions for all users', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');

  assert.match(source, /import \{ page \} from '\$app\/stores';/);
  assert.match(source, /import SharePopover from '\$lib\/components\/SharePopover\.svelte';/);
  assert.match(
    source,
    /<div class="market-header-actions">[\s\S]*<SharePopover url=\{\$page\.url\.href\} title=\{market\.title\} \/>[\s\S]*\{#if currentUser\}[\s\S]*<button[\s\S]*class="market-bookmark-button"[\s\S]*\{\/if\}[\s\S]*<\/div>/
  );
});

test('related markets show LONG price with a 50¢ fallback instead of timestamp and author metadata', () => {
  const source = read('src/lib/components/cascade/MarketSurface.svelte');
  const relatedBlock = source.match(/\{#if relatedMarkets\.length > 0\}[\s\S]*?\{\/if\}/)?.[0] ?? '';

  assert.match(relatedBlock, /<h3>More markets<\/h3>/);
  assert.match(relatedBlock, /<span class="positive">\{priceCents\(\(related\.latestPricePpm \?\? 500_000\) \/ 1_000_000\)\} LONG<\/span>/);
  assert.doesNotMatch(relatedBlock, /formatRelativeTime\(related\.createdAt\)/);
  assert.doesNotMatch(relatedBlock, /authorLabel\(related\.pubkey\)/);
});
