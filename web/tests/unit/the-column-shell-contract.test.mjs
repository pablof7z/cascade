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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function blockAfter(source, selector) {
  const start = source.indexOf(selector);
  assert.notEqual(start, -1, `${selector} should exist`);

  const open = source.indexOf('{', start);
  assert.notEqual(open, -1, `${selector} should open a block`);

  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }

  assert.fail(`${selector} should close its block`);
}

function classAttributePattern(tag, className) {
  return new RegExp(`<${tag}\\b[^>]*class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["']`, 's');
}

function classLiteralPattern(className) {
  return new RegExp(`class=["'][^"']*\\b${escapeRegExp(className)}\\b[^"']*["']`, 's');
}

test('app css maps DaisyUI dark theme to The Column warm dark tokens', () => {
  const appCss = read('src/app.css');
  const darkTheme = blockAfter(appCss, "[data-theme='dark']");

  const expectedDaisyTokens = {
    '--color-base-100': '#0b0a09',
    '--color-base-200': '#13120f',
    '--color-base-300': '#1c1b17',
    '--color-primary': '#efe7d3',
    '--color-success': '#3ec48a',
    '--color-error': '#e85d7a'
  };

  for (const [token, value] of Object.entries(expectedDaisyTokens)) {
    assert.match(
      darkTheme,
      new RegExp(`${escapeRegExp(token)}\\s*:\\s*${escapeRegExp(value)}\\b`, 'i'),
      `${token} should map to ${value}`
    );
  }
});

test('app css imports and declares The Column display and serif fonts', () => {
  const appCss = read('src/app.css');
  const themeBlock = blockAfter(appCss, '@theme');
  const fontImport = appCss.match(/@import\s+url\(([^)]*)\)\s*;/i)?.[1] ?? '';

  assert.match(fontImport, /family=Inter\+Tight/i);
  assert.match(fontImport, /family=Fraunces/i);
  assert.match(themeBlock, /--font-tight:\s*['"]Inter Tight['"]\s*,\s*['"]Inter['"]\s*,\s*sans-serif\s*;/);
  assert.match(
    themeBlock,
    /--font-serif:\s*['"]Fraunces['"]\s*,\s*['"]Source Serif 4['"]\s*,\s*Georgia\s*,\s*serif\s*;/
  );
});

test('root layout renders the persistent The Column shell', () => {
  const source = read('src/routes/+layout.svelte');

  assert.match(source, classLiteralPattern('column-shell'));
  assert.match(source, classAttributePattern('aside', 'column-rail'));
  assert.match(source, classAttributePattern('main', 'column-center'));
  assert.match(source, classAttributePattern('aside', 'column-right'));
  assert.match(source, /<aside\b[^>]*class=["'][^"']*\bcolumn-rail\b[^"']*["'][\s\S]*<SiteNavigation\s*\/>[\s\S]*<\/aside>/);
  assert.match(source, /<main\b[^>]*class=["'][^"']*\bcolumn-center\b[^"']*["'][\s\S]*\{@render children\?\.\(\)\}/);
  assert.doesNotMatch(source, /\bsite-header\b/);
  assert.doesNotMatch(source, /\bsite-header-inner\b/);
});

test('site navigation is rail-oriented and omits the old horizontal menu shape', () => {
  const source = read('src/lib/components/cascade/SiteNavigation.svelte');

  assert.match(source, classAttributePattern('nav', 'rail-nav'));
  assert.match(source, /\brail-item\b/);
  assert.match(source, /aria-current=\{[\s\S]*?isActive\(item\.href\)[\s\S]*?\}/);
  assert.doesNotMatch(source, /\bmenu-horizontal\b/);
  assert.doesNotMatch(source, /\btop-nav\b/);
  assert.doesNotMatch(source, /overflow-x-auto/);
  assert.doesNotMatch(source, /border-b-2/);
});
