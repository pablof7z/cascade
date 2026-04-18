# daisyUI conventions

This document records the UI conventions used across Cascade after the daisyUI-everywhere migration (April 2026). Follow these rules when adding or modifying any Svelte component or route.

## Guiding principle

Use Tailwind utilities and daisyUI component classes inline on elements. Do not write scoped `<style>` blocks to invent layout or color primitives that Tailwind already covers.

The only acceptable content in a `<style>` block is:

- `@keyframes` animations
- The `.full-bleed` layout primitive (used by the homepage live strip)
- Svelte `:global()` overrides for third-party rendered HTML (e.g. blog post body prose)

Everything else belongs in `class=""` attributes.

## Color tokens

Use daisyUI semantic tokens with Tailwind opacity modifiers instead of raw hex, `rgba()`, or `var(--color-neutral-*)` shims:

| Intent | Class |
|--------|-------|
| Primary text | `text-base-content` |
| Muted text (60 %) | `text-base-content/60` |
| Subdued text (50 %) | `text-base-content/50` |
| Very muted (70 %) | `text-base-content/70` |
| Faint (80 %) | `text-base-content/80` |
| Success / LONG | `text-success` |
| Error / SHORT / negative | `text-error` |
| Primary accent | `text-primary` |
| Card background | `bg-base-200` |
| Subtle container | `bg-base-300` |
| Dividers / borders | `border-base-300` |
| Divider list rows | `divide-base-300` |

Never use `text-neutral-*`, `border-neutral-*`, `bg-neutral-*`, or `divide-neutral-*`. These are Tailwind color scale classes that bypass the daisyUI theme.

Never write `rgba(...)` in `<style>` blocks. Use `color-mix(in srgb, var(--color-X) Y%, transparent)` when a CSS opacity blend is truly required (rare).

Never reference `var(--accent)`, `var(--radius-md)`, `var(--font-serif)`, or any CSS variable that is not exported by daisyUI's theme layer or Tailwind v4's core variables.

## Typography scale

Use `clamp()` for fluid headings on marketing pages:

```svelte
<h1 class="text-[clamp(2.4rem,4vw,4rem)] tracking-[-0.05em] leading-none">…</h1>
```

For section headings inside app surfaces, prefer fixed sizes:

```svelte
<h2 class="text-[1.18rem] tracking-[-0.03em]">…</h2>
```

Eyebrow labels use the global `.eyebrow` utility class (defined in `app.css`):

```svelte
<div class="eyebrow">Markets</div>
```

## Layout primitives

| Pattern | Class |
|---------|-------|
| Two-column content split | `grid grid-cols-1 gap-10 md:grid-cols-2` |
| Three-column panel row | `grid gap-10 pt-8 md:grid-cols-3` |
| Stat grid (4-up) | `grid grid-cols-2 gap-4 pt-8 sm:grid-cols-4` |
| Bordered list | `divide-y divide-base-300 border-t border-base-300` |
| List row | `flex items-start justify-between gap-4 py-4` |
| Sidebar layout | `flex min-h-[calc(100vh-4rem)] flex-col md:flex-row` |

## Buttons and form controls

Always use daisyUI component classes:

```svelte
<button class="btn btn-primary">…</button>
<button class="btn btn-outline">…</button>
<button class="btn btn-ghost">…</button>
<input class="input input-bordered" … />
<textarea class="textarea textarea-bordered" … />
<select class="select select-bordered" … />
```

Never invent custom button or form classes.

## Badges

Use daisyUI badge variants for status labels:

```svelte
<span class="badge badge-success badge-outline">LONG</span>
<span class="badge badge-error badge-outline">SHORT</span>
<span class="badge badge-warning badge-outline">Pending</span>
```

## Forbidden patterns

The following are not allowed anywhere in template or style code:

- `class="*button-primary*"` / `class="*button-ghost*"` / `class="*field*"` — legacy app.css classes
- `rgba(...)` — use `color-mix(in srgb, var(--color-X) Y%, transparent)` instead
- `var(--accent)` — use `var(--color-primary)` or `text-primary`
- `var(--radius-md)` / `var(--radius-sm)` — use Tailwind `rounded-md` / `rounded` utilities
- `var(--font-serif)` — use Tailwind `font-serif` utility
- `text-neutral-*` / `border-neutral-*` / `bg-neutral-*` / `divide-neutral-*` — use daisyUI tokens

## Datetime formatting

Use `formatDateTime` from `$lib/cascade/format` instead of `toLocaleString()`:

```ts
import { formatDateTime } from '$lib/cascade/format';
const label = formatDateTime(unixTimestamp); // seconds
```

## Guard tests

The file `tests/tailwind-daisyui-migration.test.mjs` enforces the key structural rules automatically. All seven tests must pass on every commit. Run them with:

```
bun test tests/tailwind-daisyui-migration.test.mjs
```
