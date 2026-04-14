import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

async function loadRedirectHelpers() {
  return import(pathToFileURL(path.join(webRoot, 'src/lib/features/auth/onboardingRedirect.ts')).href);
}

test('join flow forwards a market return path into onboarding', async () => {
  const { joinOnboardingTarget } = await loadRedirectHelpers();

  assert.equal(
    joinOnboardingTarget('?from=/market/bitcoin-2025'),
    '/onboarding?returnTo=%2Fmarket%2Fbitcoin-2025'
  );
  assert.equal(joinOnboardingTarget(''), '/onboarding');
  assert.equal(joinOnboardingTarget('?from='), '/onboarding');
});

test('onboarding completion returns users to the requested path or homepage', async () => {
  const { onboardingCompletionTarget } = await loadRedirectHelpers();

  assert.equal(onboardingCompletionTarget('?returnTo=/market/bitcoin-2025'), '/market/bitcoin-2025');
  assert.equal(onboardingCompletionTarget(''), '/');
  assert.equal(onboardingCompletionTarget('?returnTo='), '/');
});

test('join page uses the onboarding redirect helper when human entry finishes', () => {
  const source = read('src/routes/join/+page.svelte');

  assert.match(source, /import \{ joinOnboardingTarget \} from '\$lib\/features\/auth\/onboardingRedirect';/);
  assert.match(
    source,
    /function finishHumanEntry\(\) \{\s*clearAuthState\(\);\s*void goto\(joinOnboardingTarget\(window\.location\.search\)\);\s*\}/
  );
});

test('onboarding page uses the return target helper after publishing the profile', () => {
  const source = read('src/routes/onboarding/+page.svelte');

  assert.match(
    source,
    /import \{ onboardingCompletionTarget \} from '\$lib\/features\/auth\/onboardingRedirect';/
  );
  assert.match(source, /await goto\(onboardingCompletionTarget\(window\.location\.search\)\);/);
  assert.doesNotMatch(source, /await goto\('\/'\);/);
});
