# Styling Guidelines

- **Design direction**: Professional, minimalist. Dark theme on `neutral-950`. No rounded pills, no background-fill toggles, no emojis in UI chrome.
- **Tabs**: All tab-like controls use underline style — container: `flex gap-1 border-b border-neutral-800`; active: `-mb-px border-b-2 border-white text-white`; inactive: `text-neutral-500 hover:text-neutral-300`. See `MarketTabsShell.tsx` as the reference implementation.
- **Color palette**: Backgrounds `neutral-800`/`neutral-900`/`neutral-950`, text `white`/`neutral-300`/`neutral-400`/`neutral-500`, borders `neutral-700`/`neutral-800`, accents `emerald` (bullish/positive) and `rose` (bearish/negative).
- **Typography**: `text-sm font-medium` for interactive elements, `text-xs` for metadata/labels. No uppercase tracking except where explicitly needed for label categories.
- **Borders**: Use borders sparingly. Don't stack `border-t` on a section that immediately follows a `border-b` container (e.g., tab nav). For list containers, use `divide-y divide-neutral-800` for row separators but omit `border-y` on the outer wrapper — the surrounding section spacing is enough. Avoid `border-y` on inline stat grids and chart wrappers; use padding/margin for separation instead.
- **Consistency**: When adding new UI patterns, find and follow the existing pattern in the codebase first. Never introduce a new visual variant of an existing component (e.g., a different tab style).
