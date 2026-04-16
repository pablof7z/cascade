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

test('paper trade panel drives trade flow with an explicit state enum', () => {
  const component = read('src/lib/components/cascade/PaperTradePanel.svelte');
  const stateModule = read('src/lib/components/cascade/tradePanelState.ts');

  assert.match(
    stateModule,
    /export\s+enum\s+TradePanelState\s*\{[\s\S]*Idle\s*=\s*['"]idle['"][\s\S]*Quoting\s*=\s*['"]quoting['"][\s\S]*PreparingProofs\s*=\s*['"]preparing_proofs['"][\s\S]*Submitting\s*=\s*['"]submitting['"][\s\S]*Finalizing\s*=\s*['"]finalizing['"][\s\S]*Recovering\s*=\s*['"]recovering['"][\s\S]*Pending\s*=\s*['"]pending['"][\s\S]*Complete\s*=\s*['"]complete['"][\s\S]*Error\s*=\s*['"]error['"][\s\S]*\}/
  );

  assert.match(component, /import\s+\{\s*TradePanelState\s*\}\s+from\s+['"]\.\/tradePanelState['"]/);
  assert.match(
    component,
    /let\s+tradePanelState\s*=\s*\$state<TradePanelState>\(TradePanelState\.Idle\)/
  );

  assert.match(component, /let\s+statusMessage\s*=\s*\$state\(['"]['"]\)/);
  assert.doesNotMatch(component, /let\s+status\s*=\s*\$state\(['"]['"]\)/);

  for (const state of [
    'Quoting',
    'PreparingProofs',
    'Submitting',
    'Finalizing',
    'Recovering',
    'Pending',
    'Complete',
    'Error'
  ]) {
    assert.match(
      component,
      new RegExp(`TradePanelState\\.${state}\\b`),
      `PaperTradePanel should use TradePanelState.${state}`
    );
  }

  const rawStatusAssignments = component
    .split('\n')
    .map((text, index) => ({ line: index + 1, text: text.trim() }))
    .filter(({ text }) => /(^|[^\w.])status\s*=(?!=)/.test(text));

  assert.deepEqual(
    rawStatusAssignments,
    [],
    `raw status assignments should move behind enum-aware helpers:\n${rawStatusAssignments
      .map(({ line, text }) => `${line}: ${text}`)
      .join('\n')}`
  );

  assert.match(component, /\{#if statusMessage\}[\s\S]*\{statusMessage\}[\s\S]*\{\/if\}/);
});
