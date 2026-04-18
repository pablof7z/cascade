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

test('public profile page renders avatar image with monogram fallback in the header', () => {
  const source = read('src/routes/p/[identifier]/+page.svelte');

  assert.match(source, /let avatarLoadFailed = \$state\(false\);/);
  assert.match(source, /const avatarPicture = \$derived\(resolvedProfile\?\.picture\?\.trim\(\) \|\| undefined\);/);
  assert.match(source, /const avatarUrl = \$derived\(avatarLoadFailed \? undefined : avatarPicture\);/);
  assert.match(source, /const avatarMonogram = \$derived\(\(profileLabel\.trim\(\)\[0\] \?\? '\?'\)\.toUpperCase\(\)\);/);
  assert.match(source, /function handleAvatarError\(event: Event\) \{[\s\S]*avatarLoadFailed = true;[\s\S]*\}/);
  // Avatar image renders with onerror handler; fallback div shows monogram
  assert.match(source, /src=\{avatarUrl\}[\s\S]*onerror=\{handleAvatarError\}/);
  assert.match(source, /\{avatarMonogram\}/);
  // No raw rgba() — migrated to daisyUI theme tokens
  assert.doesNotMatch(source, /rgba\(\s*\d+\s*,/);
  // No scoped <style> block with the old custom class names
  assert.doesNotMatch(source, /\.profile-avatar-fallback \{[\s\S]*background: rgba\(/);
});

test('public profile page avatar uses daisyUI theme tokens without scoped style block', () => {
  const source = read('src/routes/p/[identifier]/+page.svelte');

  // Avatar container uses Tailwind/daisyUI utilities, not bespoke CSS
  assert.match(source, /class="[^"]*rounded-full[^"]*"/);
  assert.match(source, /class="[^"]*bg-base-300[^"]*"/);
  // No scoped <style> block remains
  assert.doesNotMatch(source, /<style\b/);
});
