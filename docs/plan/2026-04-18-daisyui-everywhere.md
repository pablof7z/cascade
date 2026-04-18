# Migrate Cascade Web UI to 100% daisyUI

> **For Claude:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make daisyUI the single source of truth for every visual primitive in `web/`. Remove the custom CSS component layer, the `bits-ui`-based `lib/components/ui/*` wrappers, and all ad-hoc `rgba(...)`, `var(--accent)`, custom `.dash-*`, `.agents-*`, `.activity-kicker`, `.share-btn` style rules that reinvent daisyUI.

**Architecture:** daisyUI 5 is already installed and loaded via `@plugin 'daisyui'` in `src/app.css`. Its theme tokens (`--color-base-*`, `--color-primary`, `--color-error`, `--radius-*`) already exist. The migration is subtractive: every component and route is rewritten to use daisyUI class names (`btn`, `card`, `menu`, `tabs`, `navbar`, `drawer`, `modal`, `stat`, `alert`, `divider`, `breadcrumbs`, `collapse`, `input`, `select`, `textarea`, `checkbox`, `radio`, `toggle`, `badge`, `loading`, `skeleton`, `tooltip`, `dropdown`, `avatar`) plus minimal Tailwind utilities for layout (`grid`, `flex`, `gap-*`, `py-*`, `px-*`). Custom CSS is deleted unless it's a `@apply`-wrapper for a repeated daisyUI composition.

**Tech Stack:** daisyUI 5.5.2, Tailwind CSS 4.1.16, SvelteKit 2.48, Svelte 5 runes (`$state`/`$derived`/`$props`), Vite 7, Bun, Playwright, `bun test`.

**Validation harness:** `web/tests/tailwind-daisyui-migration.test.mjs` already exists and enforces daisyUI adoption in a few files. Every task in this plan extends that test with new assertions before the work is done, so the migration progresses test-first.

---

## Ground Rules (read once, apply to every task)

1. **daisyUI class names first.** `btn`, `btn-primary`, `btn-outline`, `btn-ghost`, `btn-sm`, `btn-lg`, `btn-square`, `btn-circle`. `input input-bordered`, `select select-bordered`, `textarea textarea-bordered`. `card card-body`. `badge badge-outline badge-success`. `menu menu-horizontal`. `tabs tabs-bordered`, `tab tab-active`. `navbar`. `drawer drawer-side`. `modal modal-box`. `dropdown dropdown-end dropdown-content`. `stats`, `stat`, `stat-title`, `stat-value`, `stat-desc`. `alert alert-info alert-warning alert-error alert-success`. `divider`. `breadcrumbs`. `collapse collapse-arrow`. `avatar`.
2. **Tailwind utilities only for layout.** `grid`, `grid-cols-*`, `flex`, `items-*`, `justify-*`, `gap-*`, `p-*`, `m-*`, `w-*`, `max-w-*`, `min-w-0`, `truncate`, `line-clamp-*`, `text-*`, `font-*`, `break-words`, `hidden`, `sm:` / `md:` / `lg:` breakpoints. No custom breakpoints (`720px`, `900px`, `1024px` in component styles) — use Tailwind's defaults.
3. **Colors via theme tokens only.** `bg-base-100`, `bg-base-200`, `bg-base-300`, `text-base-content`, `text-primary`, `text-success`, `text-error`, `border-base-300`. For translucency, use `/60`, `/70`, `/80` opacity modifiers on the token classes (e.g. `text-base-content/60`). No `rgba(...)`, no `color-mix(...)` in component styles, no raw `oklch(...)`. All hex stays only in `app.css` theme declaration.
4. **Undefined variables are deleted on sight.** `var(--accent)`, `var(--radius-md)`, `var(--radius-sm)`, `var(--font-serif)`, `var(--content-width)` — these are not declared anywhere. Replace with theme tokens or Tailwind utilities.
5. **No `outline: none` without a focus-visible replacement.** daisyUI's own `btn`/`input` classes ship a focus ring; removing `outline: none` and letting daisyUI handle focus is the preferred fix.
6. **No component-scoped `<style>` block unless unavoidable.** If a file has `<style>`, the end state is either no style block or a very short one. Motion, keyframes, and genuinely novel layouts (ticker marquee, hero full-bleed) can keep local CSS if no daisyUI equivalent exists.
7. **Icon-only buttons need `aria-label`.** Use `btn btn-ghost btn-square` / `btn-circle` + `aria-label`.
8. **Dates via `Intl.DateTimeFormat`, numbers via `Intl.NumberFormat`.** `.toLocaleString()` with no locale arg is acceptable where already used; hardcoded formats like `"April 2026"` are not. Skim existing helpers in `src/lib/` before inventing new ones.
9. **Commit after every task.** Each task ends with a `git commit`. No squashing across tasks.
10. **Svelte 5 runes only.** `$props()`, `$state()`, `$derived()`, `$effect()`. Do not use `export let`, legacy reactive `$:`, or stores where a rune works.

**Command cheat sheet (run from `web/`):**

```bash
bun install
bun run check                # svelte-check (typescript)
bun test                     # unit tests
bun run test:e2e             # playwright (optional per task)
bun run dev                  # local preview
```

---

## Phase 0 — Baseline & Guardrails

### Task 0.1: Snapshot current migration test status

**Files:**
- Read: `web/tests/tailwind-daisyui-migration.test.mjs`

**Step 1:** Run `cd web && bun test tests/tailwind-daisyui-migration.test.mjs` and record how many assertions pass today. Paste output into the task commit body.

**Step 2:** Commit (no code change, just a baseline marker):
```bash
git commit --allow-empty -m "chore(ui): baseline daisyUI migration test before wholesale migration"
```

### Task 0.2: Extend the migration test with a global custom-class blocklist

**File:** `web/tests/tailwind-daisyui-migration.test.mjs`

**Step 1: Add a test that forbids the rogue class families everywhere under `src/`.**

Append this to the file:

```javascript
import { globSync } from 'node:fs';

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
```

**Step 2:** Run `bun test tests/tailwind-daisyui-migration.test.mjs`. Expected: **this new test fails** with a long list of offenders. That's the work list for Phases 3-10.

**Step 3: Commit (test only, no production changes):**
```bash
git add web/tests/tailwind-daisyui-migration.test.mjs
git commit -m "test(ui): add forbidden-custom-class guard for daisyUI migration"
```

### Task 0.3: Add an undefined-CSS-var guard

**File:** `web/tests/tailwind-daisyui-migration.test.mjs`

**Step 1: Append:**

```javascript
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
```

**Step 2:** Run. It fails — good. Commit the test.

```bash
git add web/tests/tailwind-daisyui-migration.test.mjs
git commit -m "test(ui): forbid undefined --accent/--radius-md/--font-serif/--content-width"
```

### Task 0.4: Add a raw-rgba guard (scoped to `<style>` blocks)

**File:** `web/tests/tailwind-daisyui-migration.test.mjs`

**Step 1: Append:**

```javascript
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
```

**Step 2:** Run. It fails with the 13 offenders we already surveyed. Commit.

```bash
git add web/tests/tailwind-daisyui-migration.test.mjs
git commit -m "test(ui): forbid raw rgba() in component styles outside app.css"
```

These three failing tests drive every subsequent phase.

---

## Phase 1 — Foundation: reduce `app.css` and declare missing tokens

### Task 1.1: Declare the missing radius + font tokens or remove them

**File:** `web/src/app.css`

**Step 1: Decide.** `--accent`, `--radius-md`, `--radius-sm`, `--font-serif`, `--content-width` — every call site will be rewritten in Phase 5/8. We choose: **replace at call sites, do not declare**. No change to `app.css` here; this task only updates the existing `@theme` block to fix the `daisyui` plugin to explicit themes.

**Step 2: Edit `app.css` lines 3-9** from:

```css
@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

@import 'tailwindcss';
@plugin 'daisyui';
```

to:

```css
@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

@import 'tailwindcss';
@plugin 'daisyui' {
  themes: ['dark --default'];
  logs: false;
}
```

**Step 3:** `cd web && bun run check` passes. `bun run dev` renders homepage without console complaints.

**Step 4: Commit:**
```bash
git add web/src/app.css
git commit -m "style(ui): configure daisyUI plugin to single dark theme"
```

### Task 1.2: Delete custom layout classes from `app.css` (`.shell`, `.page`, `.panel`, `.surface*`, `.grid-*`, `.metric-*`, `.list`, `.row-*`, `.tag-list`, `.content-prose`, `.empty-state`, `.table-*`, `.dashboard-*`, `.section*`, `.page-*`, `.button-row`, `.muted`, `.eyebrow`, `.positive`, `.negative`, `.error`, overrides on `.btn`, `.input`, `.badge`)

**Files:** `web/src/app.css`

**Step 1: Before deleting,** rg for every class to prove Phases 2-10 cover the call sites. Run:

```bash
cd web && rg -n '\b(shell|page|page-header|page-title|page-subtitle|muted|eyebrow|section|section-title|section-header|surface|surface-subtle|panel|grid-two|grid-three|metric-grid|metric-card|list|row-link|row-meta|button-row|tag-list|content-prose|empty-state|positive|negative|table-list|table-head|table-row|dashboard-layout|dashboard-sidebar|dashboard-main)\b' src/ | wc -l
```

Record the count in the commit message.

**Step 2:** Once Task 1.3 replaces `.shell` with a small `@apply` helper (below), this task plus Phases 3-10 will delete every caller. For now, **keep** `.shell`, `.page`, `.site-*`, `.positive`, `.negative`, `.error`, `.muted`, `.eyebrow` — they will be rewritten as `@apply`-based helpers in Task 1.3. **Delete** the rest:

- lines 166-181 (`.section`, `.section-title`, `.section-header`)
- lines 183-207 (`.surface`, `.surface-subtle`, `.panel`, `.grid-two`, `.grid-three`)
- lines 209-235 (`.metric-grid`, `.metric-card`, `.metric-card dt`, `.metric-card dd`)
- lines 237-262 (`.list`, `.list > * + *`, `.row-link`, `.row-link:hover h3…`, `.row-meta`)
- lines 264-280 (`.button-row`, `.tag-list`, `.tag-list span`)
- lines 282-300 (`.content-prose` and children — migrate callers to daisyUI `prose` in Phase 5)
- lines 302-305 (`.empty-state`)
- lines 320-344 (`.table-list`, `.table-head`, `.table-row`)
- lines 346-376 (`.dashboard-layout`, `.dashboard-sidebar`, `.dashboard-main`)
- lines 378-433 (`.btn`, `.btn-primary`, `.btn-outline`, `.btn-outline:hover`, `.btn-ghost:hover`, `.input`, `.select`, `.textarea`, their placeholder + focus overrides, `.badge`)
- media-query remnants lines 441-484 referring to deleted classes

**Step 3:** Save. Do **not** run the app yet — it will be broken. Run:

```bash
cd web && bun run check 2>&1 | head -40
```

Expect noisy unused-class warnings from Svelte. Not a blocker.

**Step 4: Commit:**
```bash
git add web/src/app.css
git commit -m "style(ui): delete redundant custom layout classes from app.css (daisyUI will replace)"
```

### Task 1.3: Rewrite `app.css` as theme + base + tiny helper layer only

**File:** `web/src/app.css`

**Step 1: Replace the file with this exact content** (keeps the theme declaration, the base resets, the `.shell`/`.page`/`.site-frame`/`.site-header` chrome, and `@apply` helpers for `.eyebrow`, `.muted`, `.positive`, `.negative`, `.error`):

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

@theme {
  --font-sans: 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
}

@import 'tailwindcss';
@plugin 'daisyui' {
  themes: ['dark --default'];
  logs: false;
}

@layer base {
  [data-theme='dark'] {
    color-scheme: dark;
    --color-base-100: #0a0a0a;
    --color-base-200: #171717;
    --color-base-300: #262626;
    --color-base-content: #ffffff;
    --color-neutral: #404040;
    --color-neutral-content: #d4d4d4;
    --color-primary: #10b981;
    --color-primary-content: #ffffff;
    --color-success: #22c55e;
    --color-success-content: #ffffff;
    --color-error: #f43f5e;
    --color-error-content: #ffffff;
    --radius-selector: 0.375rem;
    --radius-field: 0.375rem;
    --radius-box: 0.375rem;
  }

  html,
  body {
    margin: 0;
    min-height: 100%;
    background: var(--color-base-100);
  }

  body {
    min-height: 100vh;
    color: var(--color-base-content);
    font-family: var(--font-sans);
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  a { color: inherit; text-decoration: none; }
  img { display: block; max-width: 100%; }
  [hidden] { display: none !important; }
  button, input, textarea, select { font: inherit; }
  code, pre, kbd, .mono { font-family: var(--font-mono); }

  h1, h2, h3, h4, h5, h6 {
    margin: 0;
    color: white;
    font-weight: 600;
    line-height: 1.1;
  }

  p { margin: 0; }
}

@layer components {
  .shell {
    @apply mx-auto w-[min(calc(100%-2.5rem),80rem)];
  }

  .site-frame {
    @apply flex min-h-screen flex-col bg-base-100;
  }

  .site-header {
    @apply sticky top-0 z-20 border-b border-base-300/85 backdrop-blur;
    background: color-mix(in srgb, var(--color-base-100) 94%, transparent);
  }

  .site-header-inner {
    @apply flex min-h-16 items-center justify-between gap-6 py-1.5;
  }

  .site-brand {
    @apply inline-block whitespace-nowrap text-base font-semibold tracking-tight text-white;
  }

  .site-main { @apply flex-1; }

  .page {
    @apply grid gap-10 py-10 pb-16 sm:py-6 sm:pb-12;
  }

  .eyebrow {
    @apply text-xs font-semibold uppercase tracking-widest text-base-content/60;
  }

  .muted { @apply text-base-content/70; }
  .positive { @apply text-success; }
  .negative, .error { @apply text-error; }
  .error { @apply text-sm; }
}

@media (max-width: 640px) {
  .shell { width: min(calc(100% - 1.5rem), 80rem); }
  .site-brand span:last-child { display: none; }
}
```

**Step 2:** `cd web && bun run dev` → homepage. Expect breakage in downstream pages (those are Phases 5-10). Expect the shell, header, and footer chrome to still render.

**Step 3: Commit:**
```bash
git add web/src/app.css
git commit -m "style(ui): reduce app.css to theme + chrome + 5 @apply helpers"
```

---

## Phase 2 — UI Primitives: replace `bits-ui` wrappers with daisyUI

The existing `src/lib/components/ui/` wrappers already partly re-use daisyUI classes but still reference undefined `--radius-md` and mix hand-rolled styles. Strategy: **delete the wrappers, expose the daisyUI primitive directly**. Each call site gets a tiny inline daisyUI snippet. If that proves too repetitive in Phase 5 reviews, extract a Svelte component later.

### Task 2.1: Inventory the `ui/*` call sites

**Step 1:** Run:

```bash
cd web && rg -n "from '\$lib/components/ui/(avatar|dialog|dropdown-menu|navigation-menu|tabs)" src/ | tee /tmp/ui-callsites.txt
```

**Step 2:** Paste count and files into the commit body.

**Step 3:** `git commit --allow-empty -m "chore(ui): inventory bits-ui wrapper call sites"`

### Task 2.2: Replace `ui/tabs/*` usage with daisyUI `tabs tabs-bordered`

**Files to modify:** every call site found in Task 2.1 that imports `ui/tabs`. Known: `note/[id]/+page.svelte`, `builder/+page.svelte`, any route file with `Tabs.Root`.

**Recipe (apply at every call site):**

Before:
```svelte
<Tabs.Root value={active} onValueChange={setActive}>
  <Tabs.List>
    <Tabs.Trigger value="a">A</Tabs.Trigger>
    <Tabs.Trigger value="b">B</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="a">…</Tabs.Content>
  <Tabs.Content value="b">…</Tabs.Content>
</Tabs.Root>
```

After:
```svelte
<div role="tablist" class="tabs tabs-bordered">
  <button role="tab" class="tab" class:tab-active={active === 'a'} onclick={() => (active = 'a')}>A</button>
  <button role="tab" class="tab" class:tab-active={active === 'b'} onclick={() => (active = 'b')}>B</button>
</div>

{#if active === 'a'}…{/if}
{#if active === 'b'}…{/if}
```

**Steps per file:**
1. Edit the imports (remove `ui/tabs`).
2. Replace markup as above.
3. Ensure `active` is a `$state` variable.
4. `bun run check` (no TS errors) and `bun run dev` (tab switching still works).
5. Commit: `refactor(ui): replace bits-ui Tabs with daisyUI tabs in <file>`

### Task 2.3: Replace `ui/dialog/*` with daisyUI `<dialog class="modal">`

**Files to modify:** every call site importing `ui/dialog`. Known: `LoginDialog.svelte`, market/builder dialogs.

**Recipe:**

Before:
```svelte
<Dialog.Root bind:open={isOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Sign in</Dialog.Title>
    </Dialog.Header>
    …
  </Dialog.Content>
</Dialog.Root>
```

After:
```svelte
<dialog class="modal" class:modal-open={isOpen}>
  <div class="modal-box bg-base-200">
    <form method="dialog">
      <button class="btn btn-ghost btn-sm btn-circle absolute right-2 top-2" aria-label="Close">✕</button>
    </form>
    <h3 class="text-lg font-semibold">Sign in</h3>
    …
  </div>
  <form method="dialog" class="modal-backdrop">
    <button aria-label="Close dialog">close</button>
  </form>
</dialog>
```

**Per-file steps (same as 2.2):** replace markup, verify focus trapping still works via the native `<dialog>` element + `showModal()`, commit.

### Task 2.4: Replace `ui/dropdown-menu/*` with daisyUI `dropdown` + `menu`

**Recipe:**

Before:
```svelte
<DropdownMenu.Root>
  <DropdownMenu.Trigger>…</DropdownMenu.Trigger>
  <DropdownMenu.Content>
    <DropdownMenu.Item>Edit</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

After:
```svelte
<div class="dropdown dropdown-end">
  <button tabindex="0" class="btn btn-ghost btn-sm" aria-label="Open menu">…</button>
  <ul tabindex="0" class="menu dropdown-content z-10 mt-2 w-48 rounded-md bg-base-200 p-1 shadow">
    <li><button>Edit</button></li>
  </ul>
</div>
```

Commit per file.

### Task 2.5: Replace `ui/avatar/*` with daisyUI `avatar`

**Recipe:**

```svelte
<div class="avatar">
  <div class="h-10 w-10 rounded-full">
    <img src={url} alt={`${name} avatar`} width="40" height="40" />
  </div>
</div>
```

For fallback without image:

```svelte
<div class="avatar avatar-placeholder">
  <div class="h-10 w-10 rounded-full bg-base-300 text-base-content">
    <span class="text-sm">{initials}</span>
  </div>
</div>
```

### Task 2.6: Replace `ui/navigation-menu/*`

Used in a few marketing pages. Replace with plain `<nav>` + `menu menu-horizontal`.

### Task 2.7: Delete `src/lib/components/ui/` and remove `bits-ui` from deps

**Files:**
- Delete: `src/lib/components/ui/avatar/`
- Delete: `src/lib/components/ui/dialog/`
- Delete: `src/lib/components/ui/dropdown-menu/`
- Delete: `src/lib/components/ui/navigation-menu/`
- Delete: `src/lib/components/ui/tabs/`
- Modify: `web/package.json` — remove `"bits-ui"` from `dependencies`.

**Step 1:** Verify no imports remain:
```bash
cd web && rg -n "bits-ui|lib/components/ui/" src/
```
Expect: zero hits.

**Step 2:**
```bash
cd web && rm -rf src/lib/components/ui && bun remove bits-ui && bun install
bun run check
```

**Step 3: Extend `tailwind-daisyui-migration.test.mjs`** — replace the `'bits-ui wrappers render DaisyUI styling classes'` test with:

```javascript
test('bits-ui wrappers have been removed', () => {
  for (const p of [
    'src/lib/components/ui/tabs/tabs-list.svelte',
    'src/lib/components/ui/tabs/tabs-trigger.svelte',
    'src/lib/components/ui/dialog/dialog-content.svelte',
    'src/lib/components/ui/dropdown-menu/dropdown-menu-content.svelte',
    'src/lib/components/ui/avatar/avatar.svelte'
  ]) {
    assert.throws(() => read(p), /ENOENT/);
  }
  const pkg = JSON.parse(read('package.json'));
  assert.ok(!pkg.dependencies?.['bits-ui'], 'bits-ui dep should be removed');
});
```

**Step 4:** `bun test` all green for this file.

**Step 5: Commit:**
```bash
git add -A
git commit -m "refactor(ui): remove bits-ui wrappers and dep; daisyUI only"
```

---

## Phase 3 — Navigation & Chrome

### Task 3.1: `SiteNavigation.svelte` — pure `navbar` + `menu menu-horizontal`

**File:** `web/src/lib/components/cascade/SiteNavigation.svelte`

**Step 1: Rewrite the `<nav>` block** so it uses only daisyUI + Tailwind classes, no `var(--…)`, no custom responsive breakpoints:

```svelte
<script lang="ts">
  import { page } from '$app/state';

  const items = [
    { href: '/', label: 'Markets' },
    { href: '/activity', label: 'Activity' },
    { href: '/leaderboard', label: 'Leaderboard' },
    { href: '/analytics', label: 'Analytics' },
    { href: '/bookmarks', label: 'Bookmarks' },
    { href: '/blog', label: 'Blog' },
    { href: '/how-it-works', label: 'How It Works' },
    { href: '/portfolio', label: 'Portfolio' },
    { href: '/builder', label: 'Create' }
  ];

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<nav
  class="order-3 w-full overflow-x-auto border-t border-base-300 pt-3 md:order-none md:w-auto md:border-t-0 md:pt-0"
  aria-label="Primary"
>
  <ul class="menu menu-horizontal min-h-0 flex-nowrap gap-4 bg-transparent p-0 text-sm font-medium">
    {#each items as item}
      <li>
        <a
          class="rounded-none border-b-2 px-0 pb-2 pt-1 hover:bg-transparent"
          class:border-white={isActive(item.href)}
          class:text-white={isActive(item.href)}
          class:border-transparent={!isActive(item.href)}
          class:text-base-content/60={!isActive(item.href)}
          class:hover:text-base-content={!isActive(item.href)}
          href={item.href}
        >
          {item.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>
```

**Step 2:** `bun run dev` → active state still highlights. Tab through nav — visible focus ring.

**Step 3: Extend the migration test's existing `site navigation uses DaisyUI navbar or menu classes` assertion** to also require no `border-neutral-800` literal:

```javascript
assert.doesNotMatch(siteNavigation, /border-neutral-\d+/);
```

**Step 4: Commit:**
```bash
git add web/src/lib/components/cascade/SiteNavigation.svelte web/tests/tailwind-daisyui-migration.test.mjs
git commit -m "refactor(ui): SiteNavigation uses only daisyUI + theme tokens"
```

### Task 3.2: `Footer.svelte` — daisyUI `footer` component

**File:** `web/src/lib/components/cascade/Footer.svelte`

**Step 1:** Read current file. Replace outer wrapper with:
```svelte
<footer class="footer footer-horizontal border-t border-base-300 bg-base-100 text-base-content/70 p-10">
  <div class="shell flex flex-wrap justify-between gap-6">
    <!-- existing link columns, each wrapped in <nav> with header -->
  </div>
</footer>
```

**Step 2:** Remove any `<style>` block. All spacing via Tailwind.

**Step 3:** Add to the test file:

```javascript
test('Footer uses daisyUI footer class and no custom styles', () => {
  const footer = read('src/lib/components/cascade/Footer.svelte');
  assert.match(footer, /class=["'][^"']*\bfooter\b/);
  assert.doesNotMatch(footer, /<style\b/);
  assert.doesNotMatch(footer, /var\(--(?!color-|font-|radius-)/);
});
```

**Step 4:** Verify. Commit.

### Task 3.3: `EditionSwitch.svelte` — daisyUI `swap` or `join` button group

**File:** `web/src/lib/components/cascade/EditionSwitch.svelte`

Pick: `join` + `btn btn-sm` pair for LIVE/PRACTICE. Remove any custom CSS. Verify toggle still switches editions.

### Task 3.4: `TabNav.svelte` — daisyUI `tabs`

**File:** `web/src/lib/components/cascade/TabNav.svelte`

Replace any custom tab styling with `tabs tabs-bordered` markup from Task 2.2's recipe.

### Task 3.5: `dashboard/+layout.svelte` — daisyUI `drawer` + `menu`

**File:** `web/src/routes/dashboard/+layout.svelte`

**Step 1: Replace the entire custom `.dash-*` structure with:**

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import type { LayoutProps } from './$types';

  let { children }: LayoutProps = $props();

  const items = [
    { href: '/dashboard', label: 'Overview' },
    { href: '/dashboard/fields', label: 'Fields' },
    { href: '/dashboard/field', label: 'Active Field' },
    { href: '/dashboard/agents', label: 'Agents' },
    { href: '/dashboard/treasury', label: 'Treasury' },
    { href: '/dashboard/activity', label: 'Activity' },
    { href: '/dashboard/settings', label: 'Settings' }
  ];

  function isActive(href: string): boolean {
    return page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
  }
</script>

<div class="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)]">
  <aside>
    <ul class="menu w-full bg-transparent p-0 text-sm">
      {#each items as item}
        <li>
          <a href={item.href} class:menu-active={isActive(item.href)}>{item.label}</a>
        </li>
      {/each}
    </ul>
  </aside>
  <main class="grid gap-6">
    {@render children?.()}
  </main>
</div>
```

**Step 2:** Delete the `<style>` block entirely. `bun run dev` — sidebar still works, active state obvious via daisyUI's `menu-active`.

**Step 3:** Add test:

```javascript
test('dashboard layout uses daisyUI menu and no custom dash-* styles', () => {
  const src = read('src/routes/dashboard/+layout.svelte');
  assert.match(src, /class=["'][^"']*\bmenu\b/);
  assert.doesNotMatch(src, /\bdash-/);
  assert.doesNotMatch(src, /<style\b/);
});
```

**Step 4:** Verify. Commit.

---

## Phase 4 — Cascade Shared Components

### Task 4.1: `MarketCard.svelte` → daisyUI `card`

**File:** `web/src/lib/components/cascade/MarketCard.svelte`

**Step 1:** Rewrite outer element from custom grid into:

```svelte
<a class="card card-border bg-base-200 transition-colors hover:bg-base-300" href={url}>
  <div class="card-body gap-3">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="card-title text-base font-semibold">{title}</h3>
      <span class="badge badge-outline badge-sm" class:badge-success={prob >= 0.5} class:badge-error={prob < 0.5}>
        {prob >= 0.5 ? 'LONG' : 'SHORT'}
      </span>
    </div>
    <p class="line-clamp-2 text-sm text-base-content/60">{description}</p>
    <div class="flex flex-wrap gap-4 text-xs text-base-content/50">
      <span class="font-mono">{cents}</span>
      <span>{formatProductAmount(volume, 'usd')} vol</span>
      <span>{tradeCount} trades</span>
    </div>
  </div>
</a>
```

**Step 2:** Remove `<style>` block.

**Step 3:** Add test assertion:

```javascript
test('MarketCard uses daisyUI card and no custom styles', () => {
  const src = read('src/lib/components/cascade/MarketCard.svelte');
  assert.match(src, /class=["'][^"']*\bcard\b/);
  assert.doesNotMatch(src, /<style\b/);
  assert.doesNotMatch(src, /rgba\(/);
});
```

**Step 4:** Commit.

### Task 4.2: `MarketSurface.svelte` — full rewrite

This is the largest shared component (~1200 lines with custom CSS). Strategy: tear out the `<style>` block entirely and rewrite every class with daisyUI + Tailwind.

**File:** `web/src/lib/components/cascade/MarketSurface.svelte`

**Step 1:** Audit sections. List them in the commit message body:
```bash
cd web && rg -n '^\s*<(div|section|article|header|aside|nav|main|h1|h2|h3|form)' src/lib/components/cascade/MarketSurface.svelte
```

**Step 2: Apply these targeted substitutions:**

- `.market-header` → `<header class="grid gap-4 pb-6 border-b border-base-300">`
- `.market-copy` → `<div class="flex flex-col gap-3 max-w-prose">`
- `.market-bookmark-button` → `<button class="btn btn-ghost btn-sm btn-square" aria-label="Bookmark">`
- `.market-trading` (two-column layout) → `<div class="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">`
- overview metrics → daisyUI `stats stats-horizontal w-full bg-base-200`, each metric wrapped in `<div class="stat">` with `stat-title`, `stat-value`, `stat-desc`
- compose area `<input>` → `input input-bordered w-full`
- compose area `<textarea>` → `textarea textarea-bordered w-full`
- buttons → `btn btn-primary` / `btn btn-outline`
- empty-state `.panel-empty` → `<div class="alert alert-warning"><span>No trades yet.</span></div>` or `<div class="rounded-md border border-base-300 p-6 text-center text-base-content/60">No trades yet.</div>`
- replace every hardcoded `rgba(38, 38, 38, 0.8)` with Tailwind `border-base-300`
- replace every `rgba(52, 211, 153, 0.7)` with `text-success/70`
- replace every `outline: none` at focus — let daisyUI's built-in focus ring handle it.

**Step 3:** Delete the `<style>` block entirely at the bottom.

**Step 4:** Remove any leftover `var(--accent)`, `var(--radius-md)` by replacing with `text-primary` and `rounded-md`.

**Step 5:** `bun run check`, `bun run dev`, click a live market — CRUD flows still work visually, prices render, compose works.

**Step 6: Add test assertion:**

```javascript
test('MarketSurface uses daisyUI stats/card/input without custom CSS', () => {
  const src = read('src/lib/components/cascade/MarketSurface.svelte');
  assert.match(src, /\bstats\b/);
  assert.doesNotMatch(src, /rgba\(/);
  assert.doesNotMatch(src, /var\(--accent/);
  assert.doesNotMatch(src, /var\(--radius-(md|sm)\b/);
  assert.doesNotMatch(src, /\bmarket-(header|copy|trading|bookmark-button)\b/);
});
```

**Step 7:** Commit.

### Task 4.3: `PaperTradePanel.svelte` — card/tabs/form rewrite

**File:** `web/src/lib/components/cascade/PaperTradePanel.svelte`

**Recipes:**
- Outer panel: `<div class="card card-border bg-base-200"><div class="card-body gap-4">…`
- LONG/SHORT toggle: `<div class="tabs tabs-boxed">` with `tab tab-active` for current side
- Amount input: `<label class="form-control"><span class="label-text">Amount</span><input class="input input-bordered" inputmode="decimal" /></label>`
- Buy/Sell: one `btn btn-primary w-full` labelled per side (`Buy LONG` / `Buy SHORT`)
- Remove `.trade-input-group`, `.trade-input-amount`, `.trade-panel` custom classes and their `<style>` block
- Remove `rgba(38, 38, 38, 0.8)` border overrides — daisyUI inputs already have a focus border.

**Test assertion:**

```javascript
test('PaperTradePanel uses daisyUI form controls, no custom CSS', () => {
  const src = read('src/lib/components/cascade/PaperTradePanel.svelte');
  assert.match(src, /input\s+input-bordered/);
  assert.doesNotMatch(src, /\btrade-(panel|input-group|input-amount)\b/);
  assert.doesNotMatch(src, /<style\b/);
});
```

Commit.

### Task 4.4: `PortfolioPage.svelte` — `stats` + `table table-zebra`

**File:** `web/src/lib/components/cascade/PortfolioPage.svelte`

**Recipes:**
- Summary: daisyUI `stats stats-horizontal w-full bg-base-200` with three or four `<div class="stat">`s
- Positions list: `<table class="table table-zebra">`
- Wallet grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3`
- Drop all custom `.wallet-*` / `.builder-field` / `.portfolio-*` classes
- Date rendering: wrap `new Date(event.createdAt).toLocaleString()` through a shared helper in `src/lib/cascade/format.ts` (use existing `formatRelativeTime` if it already handles this).

**Test assertion:**

```javascript
test('PortfolioPage uses daisyUI stats/table without custom class families', () => {
  const src = read('src/lib/components/cascade/PortfolioPage.svelte');
  assert.match(src, /\bstats\b/);
  assert.match(src, /\btable\b/);
  assert.doesNotMatch(src, /\bwallet-(grid|panel)\b/);
  assert.doesNotMatch(src, /\bbuilder-(field|empty)\b/);
});
```

Commit.

---

## Phase 5 — Content Components

### Task 5.1: `ArticleCard.svelte`

**File:** `web/src/lib/components/ArticleCard.svelte`

- Outer: `card card-border bg-base-200 hover:bg-base-300`
- Thumbnail: `<figure class="aspect-[16/9] overflow-hidden"><img … width="…" height="…" /></figure>`
- Body: `card-body`
- Replace `var(--font-serif)` → remove entirely; use `font-serif` Tailwind utility (define in `@theme` if needed — in fact we should: add `--font-serif: 'Georgia', serif;` to the `@theme` block in Task 1.3 retroactively if we decide to keep serif for blog content). **Decision:** keep serif for article bodies — add `--font-serif: 'Georgia', 'Cambria', serif;` to `app.css` `@theme` block. Update Task 1.3's file if not done.
- Replace `var(--accent)` → `text-primary` or `border-primary`.
- Make sure `<img>` has explicit width/height (WIG rule).

Test:

```javascript
test('ArticleCard uses daisyUI card, no undefined vars', () => {
  const src = read('src/lib/components/ArticleCard.svelte');
  assert.match(src, /\bcard\b/);
  assert.doesNotMatch(src, /var\(--(accent|radius-md|radius-sm)\b/);
});
```

Commit.

### Task 5.2: `ArticleMarkdown.svelte`

**File:** `web/src/lib/components/ArticleMarkdown.svelte`

- Wrap prose in `<div class="prose prose-invert max-w-none">` (daisyUI ships `typography` integration through Tailwind's `prose` plugin — if not installed, use daisyUI's own body styling + a `max-w-prose` container).
- Remove all `var(--accent)`, `var(--radius-md)`, `var(--font-serif)` — `font-serif` utility, `rounded-md`, `text-primary`.

Commit.

### Task 5.3: `EventAuthorHeader.svelte`

- Avatar: `avatar` daisyUI pattern from Task 2.5
- Date: route through `formatRelativeTime` or `Intl.DateTimeFormat` helper
- Remove `var(--accent)`

Commit.

### Task 5.4: `HighlightPopover.svelte`

- Outer: `dropdown-content bg-base-200 rounded-md border border-base-300 p-3 shadow`
- All buttons: `btn btn-ghost btn-sm`
- Remove `background: white` on line 180 (dark theme!); use `bg-base-200`
- Remove `rgba(255, 103, 25, 0.06)` on line 588; use `bg-warning/10`
- Add `aria-label` to icon-only buttons

Commit.

### Task 5.5: `SharePopover.svelte`

- Replace `.share-btn` custom CSS with `btn btn-ghost btn-sm`
- Outer: `dropdown dropdown-end` + `dropdown-content menu`
- Remove `<style>` block

Commit.

### Task 5.6: `RelayCard.svelte`

- Outer: `card card-border bg-base-200`
- Drop `.trending-card-body`, `.relay-card` custom CSS

Commit.

### Task 5.7: `StoryAuthor.svelte`, `BookmarkIcon.svelte`

- Tiny components. `btn btn-ghost btn-sm btn-square` with `aria-label`. Delete `<style>`.

Commit.

### Task 5.8: `lib/features/profile/ProfilePreview.svelte`

- Avatar pattern from 2.5
- Remove `var(--accent)`, any `rgba()`

Commit.

### Task 5.9: `lib/features/auth/LoginDialog.svelte` + `auth.css`

- The migration test already expects `btn|modal|tabs` in `LoginDialog.svelte` — verify this still holds after the dialog rewrite in Task 2.3.
- `auth.css`: must already `@reference '../../../app.css';` (tested). Remove any remaining `var(--)` that isn't a theme token.

Commit.

### Task 5.10: `lib/ndk/components/mention/mention.svelte`

- Remove `rgba()`; use `text-primary` / `bg-primary/10`

Commit.

---

## Phase 6 — Marketing Routes

### Task 6.1: `routes/+page.svelte` (homepage)

**File:** `web/src/routes/+page.svelte`

**Step 1: Stray code cleanup.** Lines 841-842 (`getCascadeEventKinds,` after `</style>`) are orphaned merge remnants. Delete.

**Step 2: Replace custom classes with daisyUI + Tailwind:**
- `.hero-grid` → `grid gap-12 md:gap-20 md:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] items-center`
- `.hero-h1` → `<h1 class="max-w-[16ch] text-5xl font-bold tracking-tighter leading-none md:text-7xl">`
- `.featured-market` → `card card-border card-side bg-base-200 hover:bg-base-300`
- `.how-steps` → `grid gap-8 sm:grid-cols-3`
- `.live-strip`/`.ticker-*` — these can keep local CSS for the marquee animation, but only the `@keyframes ticker`. Move the keyframe into the `<style>` block with minimal other rules.
- `.trending-layout`/`.trending-lead` → `grid gap-0 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] border-y border-base-300` + the lead gets `border-r border-base-300 pr-6` on md+
- `.rank-head`/`.rank-row` → Tailwind grid with identical column template: `grid grid-cols-[minmax(0,1.7fr)_0.55fr_0.6fr_0.55fr_0.55fr] gap-4 items-center`. Hide on small with `hidden sm:grid`.
- `.search-head`/`.search-row` → same pattern, different cols.
- `.home-split` → `grid gap-10 md:grid-cols-2`
- `.positive`/`.negative` — keep (app.css `@apply`-helpers still exist) OR inline `text-success`/`text-error`.
- `.full-bleed` — keep the local `<style>` helper if still used; it's a layout primitive without daisyUI equivalent.

**Step 3:** Replace every `text-neutral-[0-9]+` with `text-base-content/…`. The current code uses `text-neutral-500` (Tailwind's neutral scale). daisyUI's theme uses `base-content`. Keep neutral-xxx only where you deliberately want the Tailwind grey scale; for body text use `text-base-content/60`, for very muted `text-base-content/40`.

**Step 4:** Replace every `border-neutral-800` with `border-base-300`.

**Step 5:** `bun run dev` on the homepage. Verify: hero, ticker marquee, featured market card, trending rank list, under-the-radar table, most-contested, new-this-week, live debate, bottom CTA — all render correctly.

**Step 6:** Add test assertion:

```javascript
test('homepage uses daisyUI classes and no Cascade-custom layouts', () => {
  const src = read('src/routes/+page.svelte');
  assert.match(src, /\bcard\b/);
  assert.doesNotMatch(src, /\bhero-(grid|h1)\b/);
  assert.doesNotMatch(src, /\btrending-(layout|lead)\b/);
  assert.doesNotMatch(src, /\brank-(head|row)\b/);
  assert.doesNotMatch(src, /\bhome-split\b/);
  assert.doesNotMatch(src, /\bfeatured-market\b/);
  assert.doesNotMatch(src, /\bhow-steps\b/);
  assert.doesNotMatch(src, /rgba\(\d/);
});
```

**Step 7:** Commit.

### Task 6.2: `routes/about/+page.svelte`

- Replace `.about-*`, `.page` custom classes with daisyUI `prose` wrapper for text, daisyUI `card`s for sections.
- Remove any `var(--accent)` etc.

Commit.

### Task 6.3: `routes/how-it-works/+page.svelte`

- Replace `<article>` inline grid sections (lines 27-39 from audit) with daisyUI `card card-side bg-base-200` or `collapse collapse-arrow` per step.
- Use `steps steps-vertical` daisyUI component for the numbered walkthrough if applicable.

Commit.

### Task 6.4: `routes/terms/+page.svelte`, `routes/privacy/+page.svelte`

- Wrap content in `<div class="prose prose-invert max-w-3xl">`.
- Remove `.surface .panel` wrappers.
- Replace hardcoded `"April 2026"` with `<time datetime="2026-04-01">April 2026</time>` or, better, import a constant from `src/lib/legal/lastUpdated.ts`.

Commit.

### Task 6.5: `routes/+error.svelte`

- Wrap in `<div class="hero min-h-[60vh]"><div class="hero-content text-center">…` daisyUI `hero` component.

Commit.

---

## Phase 7 — Trading Routes

### Task 7.1: `routes/market/[slug]/+page.svelte`

Most of the work is in `MarketSurface.svelte` (Task 4.2). Verify the route file itself has no custom CSS blocks. If it does, delete.

Commit.

### Task 7.2: `routes/builder/+page.svelte`

**File:** `web/src/routes/builder/+page.svelte`

- Replace `.builder-field` with `<label class="form-control w-full">` + `<span class="label-text">…</span>` + daisyUI input.
- All buttons to `btn btn-primary` / `btn btn-outline`.
- Replace `rounded-none px-0 shadow-none` inline utility overrides (line 823) with a plain `input input-bordered` — we want daisyUI's default styling, not overrides.
- `.builder-empty` → `<div class="alert"><span>…</span></div>` or plain muted text.
- Remove `<style>` block.

Existing migration test already enforces `btn`, `input input-bordered`, `textarea textarea-bordered`, `select select-bordered` in this file — extend it with `assert.doesNotMatch(builder, /\bbuilder-(field|empty)\b/);`.

Commit.

### Task 7.3: `routes/portfolio/+page.svelte`

Most work is in `PortfolioPage.svelte` (Task 4.4). Verify route wrapper.

Commit.

---

## Phase 8 — Dashboard Routes

### Task 8.1: `routes/dashboard/+page.svelte`

**File:** `web/src/routes/dashboard/+page.svelte`

- `.dash-page` → `<div class="grid gap-6">`
- `.dash-header h1` → `<h1 class="text-3xl font-bold tracking-tight">`
- `.dash-summary` → daisyUI `stats stats-horizontal w-full bg-base-200`
- `.dash-grid` → `grid gap-6 md:grid-cols-2`
- `.dash-section` → `<section class="card card-border bg-base-200"><div class="card-body">`
- `.dash-row` → `<div class="flex items-center justify-between py-2">`
- Remove `<style>` block entirely.

Commit.

### Task 8.2: `routes/dashboard/agents/+page.svelte`

- `.agents-page`/`.agents-header`/`.agents-summary`/`.agents-list`/`.agent-row`/`.agent-avatar`/`.agent-meta` → daisyUI `card` + `stats` + `<ul class="menu bg-base-200 rounded-md">` OR `<table class="table table-zebra">` for the list
- `.agents-button` (three copies across dashboard pages) → `btn btn-outline btn-sm`
- Remove `<style>`

Commit.

### Task 8.3: `routes/dashboard/field/+page.svelte`

Same pattern. daisyUI `stats`, `card`, `table` for data; `btn` for actions.

Commit.

### Task 8.4: `routes/dashboard/fields/+page.svelte`

- `.fields-button` → `btn btn-outline btn-sm`
- `.field-row` hover (`rgba(255, 255, 255, 0.02)`) → default daisyUI `table-zebra` striping
- Remove `<style>`

Commit.

### Task 8.5: `routes/dashboard/settings/+page.svelte`

- `.settings-button` → `btn btn-outline btn-sm`
- Inputs: `input input-bordered` for number fields; `toggle` for booleans
- Form layout: `form-control` blocks inside a `card card-body`

Commit.

### Task 8.6: `routes/dashboard/treasury/+page.svelte`

- daisyUI `stats` for balances
- `table table-zebra` for transaction history
- `btn btn-primary` for actions

Commit.

### Task 8.7: `routes/dashboard/activity/+page.svelte`

- Same `stats` / `table` pattern
- Remove `.activity-kicker` etc. in favor of `.eyebrow` (which is now a `@apply` helper)

Commit.

---

## Phase 9 — Content Routes

### Task 9.1: `routes/blog/+page.svelte`

- List: `grid gap-6 sm:grid-cols-2 lg:grid-cols-3` of `ArticleCard`s (reuses Task 5.1).
- Page header uses `.eyebrow` helper + heading.
- Remove custom `.blog-row` styling and arbitrary `transition: background 0.1s`.

Commit.

### Task 9.2: `routes/blog/[slug]/+page.svelte`

- Wrap content in `prose prose-invert max-w-3xl font-serif`
- Meta row uses daisyUI `avatar` + muted text
- Remove all `var(--font-serif)` raw uses — rely on `font-serif` utility

Commit.

### Task 9.3: `routes/note/[id]/+page.svelte`

- Major custom CSS; this is one of the biggest route files.
- Article container: `<article class="prose prose-invert max-w-3xl font-serif mx-auto">`
- Comments: `<div class="chat chat-start">` daisyUI chat bubble OR simple flex list with `avatar`
- Tabs (already migrated in Task 2.2) — remove `.article-tabs-list` custom.
- Delete the `<style>` block; move the `content-width` derivation inline (`max-w-3xl` equivalent) or define an actual token in Task 1.3's `@theme` block as `--content-width: 48rem` and use `max-w-[var(--content-width)]`.

Commit.

### Task 9.4: `routes/p/[identifier]/+page.svelte` (user profile public view)

- Header: `hero` + `avatar`
- Body: daisyUI `tabs` for activity/bookmarks/markets
- Remove `rgba()` styling

Commit.

### Task 9.5: `routes/relay/[hostname]/+page.svelte` and `routes/relays/+page.svelte`

- Grid of `RelayCard` (already migrated in Task 5.6)
- Remove `.trending-grid`, `.trending-card-body` custom classes

Commit.

---

## Phase 10 — User / Auth Routes

### Task 10.1: `routes/join/+page.svelte`

- `.join-page`, `.join-copy` → `grid gap-12 py-16`
- `.join-copy h1` → `<h1 class="text-5xl font-bold tracking-tighter sm:text-7xl">`
- Replace every `rgba(38, 38, 38, 0.8)` etc. with `border-base-300`
- Remove `<style>`
- Existing migration test already asserts `btn` presence; extend with `assert.doesNotMatch(join, /rgba\(/)`.

Commit.

### Task 10.2: `routes/onboarding/+page.svelte` and sub-routes

- daisyUI `steps` component for progress
- Inputs in `form-control` blocks
- Buttons `btn btn-primary`

Commit.

### Task 10.3: `routes/profile/+page.svelte`

- Header: `hero` + `avatar` + `stats` for counts
- Recent activity: `table table-zebra` or list of `card`s
- Remove custom styles

Commit.

### Task 10.4: `routes/profile/edit/+page.svelte`

- Replace `<input class="h-12 w-12 rounded-md border border-neutral-800 bg-base-100 p-1" type="color">` with daisyUI-styled color input: `<input type="color" class="h-12 w-12 cursor-pointer rounded-md border border-base-300 bg-base-100 p-1">` (only minor swap — color inputs are not a daisyUI primitive).
- Use `textarea textarea-bordered` and `input input-bordered` consistently.
- Icon-only remove-field button: `btn btn-ghost btn-sm btn-square` with `aria-label="Remove field"`.

Commit.

### Task 10.5: `routes/activity/+page.svelte`

- `.activity-copy h1` → `<h1 class="text-3xl font-bold tracking-tight sm:text-5xl">` (consistent with dashboard overview)
- `.activity-stats` → daisyUI `stats stats-horizontal`
- `.activity-row` → `table-row` inside a `table table-zebra`

Commit.

### Task 10.6: `routes/leaderboard/+page.svelte`

- `.leaderboard-row` → `<table class="table table-zebra">` rows with rank column
- `.leaderboard-kicker` → `.eyebrow`

Commit.

### Task 10.7: `routes/analytics/+page.svelte`

- `stats` for top numbers; charts keep their own SVG/canvas
- Any `rgba()` in styles → theme tokens with opacity modifier

Commit.

### Task 10.8: `routes/bookmarks/+page.svelte`

- List of `ArticleCard`/`MarketCard`
- Empty state: `alert alert-info` or centered muted text

Commit.

---

## Phase 11 — Cleanup & Final Sweep

### Task 11.1: Remove any remaining `<style>` blocks that only re-implement daisyUI

Run:

```bash
cd web && rg -l '<style' src/
```

For each file that still has a `<style>` block, open it and justify: either it's a genuine layout/motion primitive (marquee ticker, homepage full-bleed, hero gradient) or it's dead weight. Delete the dead ones.

Commit per file.

### Task 11.2: Remove `text-neutral-XXX` leftovers in favor of `text-base-content/…`

```bash
cd web && rg -n 'text-neutral-\d{3}|border-neutral-\d{3}|bg-neutral-\d{3}' src/
```

For each match, swap to the corresponding daisyUI theme token with opacity modifier. `text-neutral-500` → `text-base-content/60`. `border-neutral-800` → `border-base-300`. Etc.

Commit.

### Task 11.3: Replace `.toLocaleString()` with shared Intl helpers

Add to `src/lib/cascade/format.ts`:

```typescript
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export function formatDateTime(seconds: number): string {
  return dateFmt.format(new Date(seconds * 1000));
}
```

Replace every `new Date(x * 1000).toLocaleString()` in `EventAuthorHeader.svelte:22`, `note/[id]/+page.svelte:304`, `PortfolioPage.svelte:965`, etc.

Commit.

### Task 11.4: Final run of the migration test suite

```bash
cd web && bun test tests/tailwind-daisyui-migration.test.mjs
```

Expected: **all tests pass, including the forbidden-class, undefined-var, and raw-rgba guards from Tasks 0.2-0.4.**

If any test still fails, fix the offending files before committing.

```bash
git commit --allow-empty -m "chore(ui): daisyUI migration complete — all guards green"
```

### Task 11.5: E2E sweep

```bash
cd web && bun run test:e2e
```

Fix visual regressions flagged by `frontend-health.spec.ts`, `paper-trading.spec.ts`, `portfolio-shell.spec.ts`, `smoke-signet.spec.ts`.

Commit per fix.

### Task 11.6: Manual smoke

Start `bun run dev`. Walk the app cold, one route per line:

- `/` (hero, ticker, trending, disputed, new, live debate)
- `/market/<any-live-slug>` (metadata, buy/sell both sides, sell empty, comment)
- `/builder` (form, submit, validation)
- `/portfolio` (stats, positions, wallet)
- `/dashboard`, `/dashboard/fields`, `/dashboard/agents`, `/dashboard/settings`
- `/profile/<npub>`, `/profile/edit`
- `/activity`, `/leaderboard`, `/analytics`, `/bookmarks`
- `/join`, `/onboarding`
- `/about`, `/how-it-works`, `/terms`, `/privacy`
- `/blog`, `/blog/<slug>`, `/note/<id>`
- `/relays`, `/relay/<host>`

For each: no console errors, no undefined CSS variables in devtools (Chrome "Inspect → Computed" shows `--accent` resolved or absent), tabs/modals/dropdowns work with keyboard, focus ring visible, dark theme consistent.

Paste the checklist into the commit body.

```bash
git commit --allow-empty -m "test(ui): manual smoke green across all routes"
```

### Task 11.7: Update `docs/design/` or create `docs/design/daisyui-conventions.md`

One page documenting:
- the approved daisyUI primitives
- the five `@apply` helpers (`shell`, `page`, `eyebrow`, `muted`, `positive`/`negative`)
- the prohibited patterns (rgba, undefined vars, custom button classes, component `<style>` blocks)
- when to write a new Svelte component vs. inline daisyUI markup

Commit.

---

## Appendix A — Per-file migration checklist template

When reviewing a file during execution, answer these seven in the PR/commit body:

1. **Outer container**: which daisyUI primitive? (`card`, `hero`, `stats`, `drawer`, etc.)
2. **Buttons**: all `btn btn-*`? any rogue `<a>` styled as button?
3. **Inputs**: all `input input-bordered` / `textarea textarea-bordered` / `select select-bordered`?
4. **Colors**: only theme tokens (`bg-base-*`, `text-base-content`, `text-primary`, `text-success`, `text-error`) or their `/XX` opacity variants? no `rgba()`, no `text-neutral-XXX`?
5. **Focus**: no `outline: none` without replacement?
6. **Accessibility**: icon-only buttons have `aria-label`? images have `width`/`height`? tabs have `role="tablist"`/`role="tab"`?
7. **Style block**: gone? if kept, justify (motion, genuinely novel layout).

---

## Appendix B — Package-level sanity

After Phase 11.1, run:

```bash
cd web && bunx knip 2>/dev/null || echo "knip not installed, skip"
cd web && rg -n "bits-ui" . && echo "FAIL" || echo "ok"
cd web && bun run check
cd web && bun run build
```

Final `build` must succeed.

---

## Appendix C — What explicitly is NOT in scope

- Redesigning any screen's information architecture. Every page keeps the same sections, order, and copy.
- Adding new features or metrics.
- Changing the color palette (primary green, error red, dark theme stay).
- Light theme.
- Replacing Inter / JetBrains Mono fonts.
- Rewriting Nostr / NDK data logic.
- Extracting `Stat`, `Button`, `Dialog` wrapper components — we're going *away* from wrappers this round.

---

## Appendix D — Rough task-count summary

| Phase | Tasks | Rough LOC touched |
|-------|-------|-------------------|
| 0 | 4 | ~120 |
| 1 | 3 | ~400 (mostly deletions in app.css) |
| 2 | 7 | ~600 |
| 3 | 5 | ~400 |
| 4 | 4 | ~1800 (MarketSurface is the monster) |
| 5 | 10 | ~1200 |
| 6 | 5 | ~1500 (homepage + marketing) |
| 7 | 3 | ~1200 |
| 8 | 7 | ~1500 |
| 9 | 5 | ~1500 |
| 10 | 8 | ~1800 |
| 11 | 7 | varies |
| **Total** | **68** | **~12,000** |

Expect ~2-3 working days for a focused engineer, including E2E fixes. Plan allows work to halt cleanly at any task boundary (tests are additive; every commit leaves a working app).

---
