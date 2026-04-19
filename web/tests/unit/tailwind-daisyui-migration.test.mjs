import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..', '..');
const srcRoot = path.join(webRoot, 'src');

function read(relativePath) {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function walk(dir, collected = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      walk(fullPath, collected);
      continue;
    }

    if (/\.(css|svelte|ts|js)$/.test(entry)) {
      collected.push(fullPath);
    }
  }

  return collected;
}

function relativeFromWeb(filePath) {
  return path.relative(webRoot, filePath);
}

test('package.json installs Tailwind CSS v4 and daisyUI 5.5', () => {
  const packageJson = JSON.parse(read('package.json'));
  const allDeps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {})
  };

  assert.ok(allDeps.tailwindcss, 'tailwindcss should be installed');
  assert.match(allDeps.tailwindcss, /^(?:[~^])?4(?:\.|$)/, 'tailwindcss v4 should be installed');

  assert.ok(allDeps['@tailwindcss/vite'], '@tailwindcss/vite should be installed');
  assert.match(allDeps['@tailwindcss/vite'], /^(?:[~^])?4(?:\.|$)/, '@tailwindcss/vite v4 should be installed');

  assert.ok(allDeps.daisyui, 'daisyUI should be installed');
  assert.match(allDeps.daisyui, /^(?:[~^])?5\.5(?:\.|$)/, 'daisyUI 5.5 should be installed');
});

test('vite config registers the Tailwind Vite plugin before sveltekit', () => {
  const viteConfig = read('vite.config.ts');

  assert.match(viteConfig, /import\s+tailwindcss\s+from\s+['\"]@tailwindcss\/vite['\"]/);
  assert.match(viteConfig, /plugins:\s*\[[^\]]*tailwindcss\(\)[^\]]*sveltekit\(\)/s);
});

test('app html opts into the dark DaisyUI theme', () => {
  const appHtml = read('src/app.html');
  assert.match(appHtml, /<html[^>]*data-theme=["']dark["']/);
});

test('app css imports Tailwind and DaisyUI and defines the Cascade dark theme', () => {
  const appCss = read('src/app.css');

  assert.match(appCss, /@theme\s*\{[\s\S]*--font-sans:[\s\S]*--font-tight:[\s\S]*--font-serif:[\s\S]*--font-mono:[\s\S]*\}/);
  assert.match(appCss, /@import\s+['\"]tailwindcss['\"]/);
  assert.match(appCss, /@plugin\s+['\"]daisyui['\"]/);
  assert.match(appCss, /\[data-theme=['\"]dark['\"]\][\s\S]*--color-base-100:/);
  assert.match(appCss, /--color-base-100:\s*#0b0a09/i);
  assert.match(appCss, /--color-base-200:\s*#13120f/i);
  assert.match(appCss, /--color-primary:\s*#efe7d3/i);
  assert.match(appCss, /--color-success:\s*#3ec48a/i);
  assert.match(appCss, /--color-error:\s*#e85d7a/i);
  assert.doesNotMatch(appCss, /:root\s*\{/);
  assert.doesNotMatch(appCss, /\.button-primary\b/);
  assert.doesNotMatch(appCss, /\.button-secondary\b/);
  assert.doesNotMatch(appCss, /\.button-ghost\b/);
  assert.doesNotMatch(appCss, /\.field\b(?!-)/);
});

test('shared UI wrappers use DaisyUI classes for tabs, dialog, dropdowns, and avatar', () => {
  // Tabs — TabNav uses DaisyUI tab classes directly
  assert.match(read('src/lib/components/cascade/TabNav.svelte'), /tabs-bordered/);
  assert.match(read('src/lib/components/cascade/TabNav.svelte'), /\btab\b/);
  // Popover/overlay — SharePopover uses DaisyUI utility classes (no legacy modal wrappers)
  assert.doesNotMatch(read('src/lib/components/SharePopover.svelte'), /modal-box/);
  assert.doesNotMatch(read('src/lib/components/SharePopover.svelte'), /modal-backdrop/);
  assert.match(read('src/lib/components/SharePopover.svelte'), /rounded-md/);
  assert.match(read('src/lib/components/SharePopover.svelte'), /bg-base-200/);
  // Dropdown — AuthenticatedUserMenu uses DaisyUI dropdown and menu classes
  assert.match(read('src/lib/features/auth/AuthenticatedUserMenu.svelte'), /dropdown-content/);
  assert.match(read('src/lib/features/auth/AuthenticatedUserMenu.svelte'), /\bmenu\b/);
  assert.match(read('src/lib/features/auth/AuthenticatedUserMenu.svelte'), /\bavatar\b/);
});

test('legacy Cascade CSS variable tokens are removed from the web source tree', () => {
  const legacyTokens = [
    '--bg',
    '--surface',
    '--surface-soft',
    '--surface-hover',
    '--border',
    '--border-subtle',
    '--border-light',
    '--text-strong',
    '--text',
    '--text-muted',
    '--text-faint'
  ];

  const offenders = walk(srcRoot)
    .map((filePath) => {
      const content = readFileSync(filePath, 'utf8');
      const foundToken = legacyTokens.find((token) => content.includes(token));
      return foundToken ? `${relativeFromWeb(filePath)} (${foundToken})` : null;
    })
    .filter(Boolean);

  assert.deepEqual(offenders, []);
});

test('legacy button/field abstractions are removed from the active web source tree', () => {
  const bannedPatterns = [
    /class=["'](?:[^"']*\s)?button-primary(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?button-secondary(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?button-ghost(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?button(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?field(?:\s[^"']*)?["']/,
    /\.button-primary\s*\{/,
    /\.button-secondary\s*\{/,
    /\.button-ghost\s*\{/,
    /\.field\s*\{/
  ];

  const offenders = walk(srcRoot)
    .map((filePath) => {
      const content = readFileSync(filePath, 'utf8');
      const matched = bannedPatterns.find((pattern) => pattern.test(content));
      return matched ? relativeFromWeb(filePath) : null;
    })
    .filter(Boolean);

  assert.deepEqual(offenders, []);
});
