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

test('site navigation includes Create link to the builder as the last item', () => {
  const source = read('src/lib/components/cascade/SiteNavigation.svelte');

  assert.match(
    source,
    /const items = \[[\s\S]*\{ href: '\/portfolio', label: 'Portfolio' \},\s*\{ href: '\/builder', label: 'Create' \}\s*\];/
  );
});

test('authenticated user menu includes a Create market action before Finish setup', () => {
  const source = read('src/lib/features/auth/AuthenticatedUserMenu.svelte');

  assert.match(source, /function navigateToBuilder\(\) \{\s*void goto\('\/builder'\);\s*\}/);
  assert.match(
    source,
    /<DropdownMenu\.Item onSelect=\{navigateToEditProfile\}>[\s\S]*?<span>Edit profile<\/span>[\s\S]*?<\/DropdownMenu\.Item>\s*<DropdownMenu\.Item onSelect=\{navigateToBuilder\}>[\s\S]*?<path d="M12 4\.5v15m7\.5-7\.5h-15" \/>[\s\S]*?<span>Create market<\/span>[\s\S]*?<\/DropdownMenu\.Item>\s*\{#if shouldFinishOnboarding\}/
  );
});
