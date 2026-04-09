# ⚠️ Cascade Core Mechanics — READ THIS FIRST

Before touching any code or writing any docs, internalize these fundamentals. They are violated constantly by agents who haven't read this.

## How markets work

- **Mint** (verb): user deposits sats → receives LONG or SHORT Cashu tokens. That's a position.
- **Withdraw** (verb): user returns tokens → receives sats at the current LMSR price. That's exiting.
- **Markets never close.** There is no expiry, no countdown, no admin close button.
- **No oracle.** No trusted third party declares an outcome. Ever.
- **No resolution.** Never use this word. There is no resolution event, no resolution service, no "market resolves." The word does not exist in this product.
- Price is 100% determined by trading activity via LMSR. If you hold LONG and the price drifts to 1.0, your tokens are worth ~1 sat each. You withdraw when you want.

## Nostr event kinds

| Kind | What it is | Published by |
|------|-----------|--------------|
| 982  | Market creation | User |
| 983  | Trade record (mint or withdrawal) | The mint only |

## Forbidden terminology

| ❌ Never say | ✅ Say instead |
|-------------|----------------|
| resolution / resolves / resolved | withdrawal / exits / withdrawn |
| market closes | — (markets don't close) |
| winner payout | withdrawal proceeds |
| losing side worth 0 | price at withdrawal time |
| kind 984 resolution event | not applicable |

**→ Full explanation: [`docs/HOW-IT-WORKS.md`](docs/HOW-IT-WORKS.md)**

---

# Product Decisions — MANDATORY

See `tenex/docs/PRODUCT-DECISIONS.md` for **all explicit product decisions** from the project owner.

**⚠️ Every agent MUST consult this document before making product, architecture, or design decisions. These are direct directives — not suggestions. Do not override, revert, or second-guess them.**

---

# Styling Guidelines

See `tenex/docs/STYLE-GUIDE.md` for the full brand style guide.

- **Design direction**: Editorial authority. Professional minimalist dark theme on `neutral-950`. No rounded pills, no background-fill toggles, no emojis in UI chrome, no gratuitous cards/borders, no gradients.
- **Color palette**: Backgrounds `neutral-800`/`neutral-900`/`neutral-950`, text `white`/`neutral-300`/`neutral-400`/`neutral-500`, borders `neutral-700`/`neutral-800`, accents `emerald` (bullish/positive) and `rose` (bearish/negative). No other accent colors without approval.
- **Typography**: Headings and body/UI use `font-sans` (Inter). Numbers/data use `font-mono` (JetBrains Mono). `text-sm font-medium` for interactive elements, `text-xs` for metadata. No uppercase tracking except explicit label categories.
- **Tabs**: Underline style only — container: `flex gap-1 border-b border-neutral-800`; active: `-mb-px border-b-2 border-white text-white`; inactive: `text-neutral-500 hover:text-neutral-300`. See `MarketTabsShell.tsx`.
- **Borders**: Use sparingly. No stacked borders (e.g., `border-t` after a `border-b` container). Lists use `divide-y divide-neutral-800` without outer `border-y`.
- **Consistency**: Follow existing patterns first. Never introduce a new visual variant of an existing component.
