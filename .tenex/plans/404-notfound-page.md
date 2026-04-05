# 404 / NotFound Error Page

## Context

The Cascade SvelteKit app currently has an `+error.svelte` at `src/routes/+error.svelte` (22 lines), but it has several issues:

1. **Broken error data access**: Uses `$props()` to destructure `error` and `url`, but SvelteKit provides error data via the `$page` store (`$page.error`, `$page.status`), not props. This means the page likely renders with `undefined` values.
2. **No `<svelte:head>`**: Missing a `<title>` tag, so the browser tab shows nothing useful on error.
3. **No NavHeader**: Other pages include `NavHeader` individually (root layout doesn't include it), so the error page should too for consistent navigation.
4. **Single CTA only**: Only offers "Go to homepage" — should also offer contextual navigation.
5. **No error differentiation**: Doesn't distinguish 404 from 500 or other errors.

The root layout (`src/routes/+layout.svelte`) provides the outer shell: `min-h-screen bg-neutral-950 text-white font-sans flex flex-col`, with a `flex-1` content wrapper and `Footer` at the bottom. Individual pages include `NavHeader` themselves.

The welcome page (`src/routes/welcome/+page.svelte`) is the best reference for the centered-content layout pattern: `min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6` with `max-w-md w-full text-center space-y-8`.

## Approach

Replace the existing broken `+error.svelte` with a corrected, well-designed error page that:

- Uses the correct SvelteKit `$page` store for error data
- Differentiates between 404 (not found) and other errors (500, etc.) with tailored messaging
- Follows the existing centered-content pattern from the welcome page
- Includes `NavHeader` for consistent navigation
- Includes `<svelte:head>` with appropriate title
- Provides two CTAs: "Go to homepage" (primary) and "Go back" (secondary)
- Follows the project's design system strictly (neutral palette, no rounded pills, no gradients, no emojis)

**Why a single root `+error.svelte` is sufficient**: SvelteKit's error boundary system means the root `+error.svelte` catches all unmatched routes and server errors. No nested error pages are needed unless specific route groups require custom error handling, which is not the case here.

**Alternatives considered**:
- Adding nested `+error.svelte` per route group — rejected, unnecessary complexity for current route structure.
- Using a `+page.svelte` with a catch-all `[...rest]` route — rejected, SvelteKit's built-in error handling is the idiomatic approach.

## File Changes

### `src/routes/+error.svelte`
- **Action**: modify (full rewrite)
- **What**: Replace the entire file with a corrected implementation:
  - Import `page` from `$app/stores` and `NavHeader` from `$lib/components/NavHeader.svelte`
  - Read `$page.status` and `$page.error.message` for error data
  - Add `<svelte:head>` with title like `"404 — Page Not Found | Cascade"` or `"Error | Cascade"`
  - Render `NavHeader` at top
  - Center the error content using the welcome page pattern: `min-h-[calc(100vh-80px)] flex flex-col items-center justify-center px-6`
  - Show the status code in `font-mono text-8xl font-bold text-neutral-700` (large, muted — decorative, not primary)
  - For 404: heading "Page not found", message "The page you're looking for doesn't exist or has been moved."
  - For other errors: heading "Something went wrong", message from `$page.error.message` or a fallback
  - Two CTAs below the message:
    - Primary: "Go to homepage" → link to `/` — styled `bg-white text-neutral-950 px-6 py-2.5 text-sm font-medium rounded-md`
    - Secondary: "Go back" → `onclick={() => history.back()}` — styled `border border-neutral-700 text-neutral-300 hover:text-white px-6 py-2.5 text-sm font-medium rounded-md`
  - All text centered, `max-w-md` container
- **Why**: The existing file is broken (wrong data access pattern) and lacks navigation, head tags, and error differentiation.

## Execution Order

1. **Rewrite `src/routes/+error.svelte`** — Replace the file contents with the corrected implementation described above. Verify by:
   - Running the dev server (`npm run dev`) and navigating to a non-existent route like `/nonexistent`
   - Confirming the NavHeader renders
   - Confirming the status code "404" and "Page not found" message display correctly
   - Confirming the browser tab title shows "404 — Page Not Found | Cascade"
   - Confirming both CTAs work (homepage link navigates to `/`, go back triggers `history.back()`)
   - Confirming no console errors about undefined props

## Verification

- **Build check**: `npm run build` should complete without errors
- **Dev server manual check**: Navigate to `/this-does-not-exist` and verify:
  - NavHeader is visible at the top
  - Large "404" in monospace font is displayed
  - "Page not found" heading and descriptive message are shown
  - Two buttons: "Go to homepage" (white/primary) and "Go back" (outlined/secondary)
  - Browser tab reads "404 — Page Not Found | Cascade"
  - Footer is visible at the bottom (inherited from root layout)
- **Non-404 error check**: If possible, trigger a 500 error to verify the page shows "Something went wrong" with the error message instead of the 404-specific copy
- **Style consistency**: Page should feel consistent with `/welcome` — centered content, neutral-950 background, no visual orphans or broken layouts
- **Responsive**: Content should be readable on mobile (the `px-6` and `max-w-md` pattern handles this)
