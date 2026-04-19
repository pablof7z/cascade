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

test('root rail exposes Publish a claim as the primary builder CTA', () => {
  const source = read('src/routes/+layout.svelte');

  assert.match(source, /<a class="rail-cta" href="\/builder">/);
  assert.match(source, /Publish a claim/);
});

test('authenticated user menu includes a Create market action before Finish setup', () => {
  const source = read('src/lib/features/auth/AuthenticatedUserMenu.svelte');

  assert.match(source, /function navigateToBuilder\(\) \{\s*void goto\('\/builder'\);\s*\}/);
  assert.match(
    source,
    /<button onclick=\{navigateToEditProfile\}>[\s\S]*?<span>Edit profile<\/span>[\s\S]*?<\/button>[\s\S]*?<button onclick=\{navigateToBuilder\}>[\s\S]*?<path d="M12 4\.5v15m7\.5-7\.5h-15" \/>[\s\S]*?<span>Create market<\/span>[\s\S]*?<\/button>[\s\S]*?\{#if shouldFinishOnboarding\}/
  );
});
