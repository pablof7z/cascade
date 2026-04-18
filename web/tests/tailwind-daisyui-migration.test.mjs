import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, globSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');

function read(relativePath) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

test('package.json declares Tailwind v4 and DaisyUI dependencies', () => {
  const pkg = JSON.parse(read('package.json'));

  assert.equal(pkg.devDependencies?.tailwindcss, '^4.1.16');
  assert.equal(pkg.devDependencies?.['@tailwindcss/vite'], '^4.1.16');
  assert.equal(pkg.devDependencies?.daisyui, '^5.5.2');
});

test('vite config wires the Tailwind Vite plugin', () => {
  const viteConfig = read('vite.config.ts');

  assert.match(viteConfig, /import\s+tailwindcss\s+from\s+'@tailwindcss\/vite'/);
  assert.match(viteConfig, /plugins:\s*\[tailwindcss\(\),\s*sveltekit\(\)\]/s);
});

test('app.css uses Tailwind v4 and DaisyUI theme config instead of the old :root block', () => {
  const appCss = read('src/app.css');

  assert.match(appCss, /@import\s+['"]tailwindcss['"];/);
  assert.match(appCss, /@plugin\s+['"]daisyui['"]/);
  assert.match(appCss, /--color-base-100:\s*#0a0a0a/i);
  assert.match(appCss, /--color-base-200:\s*#171717/i);
  assert.match(appCss, /--color-primary:\s*#10b981/i);
  assert.match(appCss, /--color-error:\s*#f43f5e/i);
  assert.doesNotMatch(appCss, /:root\s*\{/);
  assert.doesNotMatch(appCss, /\.button-primary\b/);
  assert.doesNotMatch(appCss, /\.button-secondary\b/);
  assert.doesNotMatch(appCss, /\.button-ghost\b/);
  assert.doesNotMatch(appCss, /\.field\b(?!-)/);
});

test('bits-ui wrappers render DaisyUI styling classes', () => {
  const tabsList = read('src/lib/components/ui/tabs/tabs-list.svelte');
  const tabsTrigger = read('src/lib/components/ui/tabs/tabs-trigger.svelte');
  const dialogContent = read('src/lib/components/ui/dialog/dialog-content.svelte');
  const dropdownContent = read('src/lib/components/ui/dropdown-menu/dropdown-menu-content.svelte');
  const avatarRoot = read('src/lib/components/ui/avatar/avatar.svelte');

  assert.match(tabsList, /tabs\s+tabs-bordered/);
  assert.match(tabsTrigger, /\btab\b/);
  assert.doesNotMatch(dialogContent, /modal-box/);
  assert.match(dialogContent, /rounded-md/);
  assert.match(dialogContent, /overflow-y-auto/);
  assert.match(dialogContent, /overscroll-contain/);
  assert.match(dialogContent, /bg-base-200/);
  assert.match(dropdownContent, /dropdown-content/);
  assert.match(avatarRoot, /\bavatar\b/);
});

test('site navigation uses DaisyUI navbar or menu classes', () => {
  const siteNavigation = read('src/lib/components/cascade/SiteNavigation.svelte');

  assert.match(siteNavigation, /navbar|menu\s+menu-horizontal/);
  assert.doesNotMatch(siteNavigation, /var\(--/);
});

test('auth styling uses Tailwind utilities and login dialog renders DaisyUI hooks', () => {
  const authCss = read('src/lib/features/auth/auth.css');
  const loginDialog = read('src/lib/features/auth/LoginDialog.svelte');

  assert.match(authCss, /@reference\s+['"]\.\.\/\.\.\/\.\.\/app\.css['"];/);
  assert.doesNotMatch(authCss, /var\(--/);
  assert.match(loginDialog, /btn|modal|tabs/);
});

test('major Cascade surfaces use Daisy buttons and form controls instead of legacy button/field classes', () => {
  const builder = read('src/routes/builder/+page.svelte');
  const portfolio = read('src/lib/components/cascade/PortfolioPage.svelte');
  const onboarding = read('src/routes/onboarding/+page.svelte');
  const profileEdit = read('src/routes/profile/edit/+page.svelte');
  const join = read('src/routes/join/+page.svelte');
  const legacyClassPatterns = [
    /class=["'](?:[^"']*\s)?button-primary(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?button-secondary(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?button-ghost(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?button(?:\s[^"']*)?["']/,
    /class=["'](?:[^"']*\s)?field(?:\s[^"']*)?["']/
  ];

  for (const content of [builder, portfolio, onboarding, profileEdit, join]) {
    for (const pattern of legacyClassPatterns) {
      assert.doesNotMatch(content, pattern);
    }
  }

  assert.match(builder, /\bbtn\b/);
  assert.match(builder, /\binput\s+input-bordered\b/);
  assert.match(builder, /\btextarea\s+textarea-bordered\b/);
  assert.match(builder, /\bselect\s+select-bordered\b/);
  assert.match(portfolio, /\bbtn\b/);
  assert.match(portfolio, /\binput\s+input-bordered\b/);
  assert.match(onboarding, /\bbtn\b/);
  assert.match(onboarding, /\binput\s+input-bordered\b/);
  assert.match(profileEdit, /\bbtn\b/);
  assert.match(profileEdit, /\btextarea\s+textarea-bordered\b/);
  assert.match(join, /\bbtn\b/);
});

const FORBIDDEN_CLASS_PATTERNS = [
  /\bdash-(page|header|summary|grid|section|row|sidebar|nav|group|divider|create)\b/,
  /\bagents-(page|header|summary|list|button|avatar|meta|row)\b/,
  /\bfields-(page|header|button|row)\b/,
  /\bsettings-(page|button)\b/,
  /\bactivity-(page|copy|kicker|stats|row)\b/,
  /\bleaderboard-(page|kicker|row|empty|empty-inline)\b/,
  /\bjoin-(page|copy)\b/,
  /\btrending-(layout|lead)\b/,
  /\bmarket-(header|copy|trading|bookmark-button)\b/,
  /\btrade-(panel|input-group|input-amount)\b/,
  /\bshare-btn\b/,
  /\bactivity-stats\b/,
  /\bbuilder-(field|empty)\b/,
  /\bwallet-(grid|panel)\b/,
  /\bleaderboard-(kicker|row)\b/,
  /\bhow-steps\b/,
  /\brank-(head|row)\b/,
  /\bsearch-(head|row)\b/,
  /\blive-(strip|label|dot)\b/,
  /\bticker-(shell|track|item)\b/,
  /\bhero-(grid|h1)\b/,
  /\bhome-split\b/,
  /\bfeatured-market\b/
];

test('no Cascade-custom layout classes remain in svelte/css sources', () => {
  const files = globSync('src/**/*.{svelte,css}', { cwd: webRoot });
  const offenders = [];
  for (const rel of files) {
    const content = read(rel);
    for (const pattern of FORBIDDEN_CLASS_PATTERNS) {
      if (pattern.test(content)) offenders.push(`${rel} matches ${pattern}`);
    }
  }
  assert.deepEqual(offenders, [], `Forbidden custom classes still present:\n${offenders.join('\n')}`);
});

const UNDEFINED_VARS = [
  /var\(--accent\b/,
  /var\(--radius-md\b/,
  /var\(--radius-sm\b/,
  /var\(--font-serif\b/,
  /var\(--content-width\b/
];

test('no references to undefined CSS variables remain', () => {
  const files = globSync('src/**/*.{svelte,css}', { cwd: webRoot });
  const offenders = [];
  for (const rel of files) {
    const content = read(rel);
    for (const pattern of UNDEFINED_VARS) {
      if (pattern.test(content)) offenders.push(`${rel} uses ${pattern}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('no raw rgba() colors in component style blocks', () => {
  const files = globSync('src/**/*.{svelte,css}', { cwd: webRoot });
  const offenders = [];
  const rgbaPattern = /rgba\(\s*\d+\s*,/;
  for (const rel of files) {
    // app.css is allowed to hold theme-level rgba for @keyframes etc.
    if (rel === 'src/app.css') continue;
    const content = read(rel);
    if (rgbaPattern.test(content)) offenders.push(rel);
  }
  assert.deepEqual(offenders, []);
});
