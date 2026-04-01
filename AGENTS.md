# Styling Guidelines

See `tenex/docs/STYLE-GUIDE.md` for the full brand style guide.

- **Design direction**: Editorial authority. Professional minimalist dark theme on `neutral-950`. No rounded pills, no background-fill toggles, no emojis in UI chrome, no gratuitous cards/borders, no gradients.
- **Color palette**: Backgrounds `neutral-800`/`neutral-900`/`neutral-950`, text `white`/`neutral-300`/`neutral-400`/`neutral-500`, borders `neutral-700`/`neutral-800`, accents `emerald` (bullish/positive) and `rose` (bearish/negative). No other accent colors without approval.
- **Typography**: Headings and body/UI use `font-sans` (Inter). Numbers/data use `font-mono` (JetBrains Mono). `text-sm font-medium` for interactive elements, `text-xs` for metadata. No uppercase tracking except explicit label categories.
- **Tabs**: Underline style only — container: `flex gap-1 border-b border-neutral-800`; active: `-mb-px border-b-2 border-white text-white`; inactive: `text-neutral-500 hover:text-neutral-300`. See `MarketTabsShell.tsx`.
- **Borders**: Use sparingly. No stacked borders (e.g., `border-t` after a `border-b` container). Lists use `divide-y divide-neutral-800` without outer `border-y`.
- **Consistency**: Follow existing patterns first. Never introduce a new visual variant of an existing component.
