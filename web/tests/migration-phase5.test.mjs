import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
function read(rel) { return readFileSync(resolve(webRoot, rel), 'utf8'); }

// Task 5.1 — ArticleCard
test('ArticleCard uses daisyUI card, no undefined vars', () => {
  const src = read('src/lib/components/ArticleCard.svelte');
  assert.match(src, /\bcard\b/);
  assert.doesNotMatch(src, /var\(--(accent|radius-md|radius-sm)\b/);
  assert.doesNotMatch(src, /var\(--font-serif\b/);
  assert.doesNotMatch(src, /rgba\(\s*\d+/);
});

// Task 5.2 — ArticleMarkdown
test('ArticleMarkdown has no undefined CSS vars', () => {
  const src = read('src/lib/components/ArticleMarkdown.svelte');
  assert.doesNotMatch(src, /var\(--(accent|radius-md|radius-sm)\b/);
  assert.doesNotMatch(src, /rgba\(\s*\d+/);
});

// Task 5.3 — EventAuthorHeader
test('EventAuthorHeader uses daisyUI avatar, no var(--accent)', () => {
  const src = read('src/lib/components/EventAuthorHeader.svelte');
  assert.match(src, /\bavatar\b/);
  assert.doesNotMatch(src, /var\(--accent\b/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /rgba\(\s*\d+/);
});

// Task 5.5 — SharePopover
test('SharePopover uses daisyUI dropdown, no share-btn, no style block', () => {
  const src = read('src/lib/components/SharePopover.svelte');
  assert.match(src, /\bdropdown\b/);
  assert.doesNotMatch(src, /\bshare-btn\b/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /var\(--(radius-md|radius-sm)\b/);
  assert.doesNotMatch(src, /rgba\(\s*\d+/);
});

// Task 5.6 — RelayCard
test('RelayCard uses daisyUI card, no trending-card-body, no relay-card class', () => {
  const src = read('src/lib/components/RelayCard.svelte');
  assert.match(src, /\bcard\b/);
  assert.doesNotMatch(src, /\btrending-card-body\b/);
  assert.doesNotMatch(src, /class="relay-card"/);
});

// Task 5.7 — StoryAuthor
test('StoryAuthor has no style block and no custom class families', () => {
  const src = read('src/lib/components/StoryAuthor.svelte');
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /\bstory-author-link\b/);
});

// Task 5.7 — BookmarkIcon
test('BookmarkIcon has no style block', () => {
  const src = read('src/lib/components/BookmarkIcon.svelte');
  assert.doesNotMatch(src, /<style\b/);
});

// Task 5.8 — ProfilePreview
test('ProfilePreview uses daisyUI card/avatar, no var(--accent), no rgba()', () => {
  const src = read('src/lib/features/profile/ProfilePreview.svelte');
  assert.match(src, /\bcard\b/);
  assert.match(src, /\bavatar\b/);
  assert.doesNotMatch(src, /var\(--accent\b/);
  assert.doesNotMatch(src, /var\(--font-serif\b/);
  assert.doesNotMatch(src, /rgba\(\s*\d+/);
});

// Task 5.9 — LoginDialog
test('LoginDialog uses daisyUI modal and tabs, no bits-ui imports', () => {
  const src = read('src/lib/features/auth/LoginDialog.svelte');
  assert.match(src, /\bmodal\b/);
  assert.match(src, /\btabs\b/);
  assert.doesNotMatch(src, /from '\$lib\/components\/ui\//);
});

// Task 5.9 — auth.css
test('auth.css has @reference and no undefined vars', () => {
  const src = read('src/lib/features/auth/auth.css');
  assert.match(src, /@reference/);
  assert.doesNotMatch(src, /var\(--(accent|radius-md|radius-sm|font-serif)\b/);
});

// Task 5.10 — mention.svelte
test('mention.svelte has no rgba() colors', () => {
  const src = read('src/lib/ndk/components/mention/mention.svelte');
  assert.doesNotMatch(src, /rgba\(\s*\d+/);
  assert.doesNotMatch(src, /<style\b/);
});
