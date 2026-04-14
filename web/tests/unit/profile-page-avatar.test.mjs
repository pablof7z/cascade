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
  assert.match(
    source,
    /<section class="profile-header">[\s\S]*class="profile-avatar profile-avatar-image"[\s\S]*src=\{avatarUrl\}[\s\S]*onerror=\{handleAvatarError\}[\s\S]*class="profile-avatar profile-avatar-fallback"[\s\S]*\{avatarMonogram\}[\s\S]*class="profile-copy"[\s\S]*class="profile-actions"/
  );
});

test('public profile page avatar styles stay circular and shrink at responsive breakpoints', () => {
  const source = read('src/routes/p/[identifier]/+page.svelte');

  assert.match(
    source,
    /\.profile-avatar,\s*\.profile-avatar-image,\s*\.profile-avatar-fallback \{[\s\S]*width: 5rem;[\s\S]*height: 5rem;[\s\S]*border-radius: 50%;/
  );
  assert.match(
    source,
    /\.profile-avatar-fallback \{[\s\S]*background: rgba\(38,\s*38,\s*38,\s*0\.8\);[\s\S]*color: white;/
  );
  assert.match(
    source,
    /@media \(max-width: 900px\) \{[\s\S]*\.profile-avatar,\s*\.profile-avatar-image,\s*\.profile-avatar-fallback \{[\s\S]*width: 3\.75rem;[\s\S]*height: 3\.75rem;/
  );
  assert.match(
    source,
    /@media \(max-width: 640px\) \{[\s\S]*\.profile-avatar,\s*\.profile-avatar-image,\s*\.profile-avatar-fallback \{[\s\S]*width: 3\.25rem;[\s\S]*height: 3\.25rem;/
  );
});
