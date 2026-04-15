import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..', '..');

function read(relativePath) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

test('web app source no longer references deleted market registry endpoints', () => {
  const apiClient = read('src/lib/cascade/api.ts');
  const builderPage = read('src/routes/builder/+page.svelte');
  const portfolioPage = read('src/lib/components/cascade/PortfolioPage.svelte');
  const serverCascade = read('src/lib/server/cascade.ts');

  for (const source of [apiClient, builderPage, portfolioPage, serverCascade]) {
    assert.doesNotMatch(source, /\/api\/market\/create/);
    assert.doesNotMatch(source, /\/api\/product\/feed/);
    assert.doesNotMatch(source, /\/api\/product\/runtime/);
    assert.doesNotMatch(source, /\/api\/product\/markets(?!\/search)/);
    assert.doesNotMatch(source, /\/api\/product\/markets\/slug/);
  }
});
