# Frontend Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | SvelteKit + Svelte 5 |
| Styling | Tailwind CSS |
| Nostr client | NDK (Nostr Dev Kit) |
| Deployment | Vercel at `cascade.f7z.io` |
| Repository | `git@github.com:pablof7z/cascade.git` |

**React is gone.** The codebase was fully migrated from React to Svelte 5. No React dependencies remain. No new React code will be added.

---

## Deployment

Auto-deploys on push to `main`. If it's not deployed, it doesn't exist — always commit AND push.

Production URL: `https://cascade.f7z.io`

No auth required to view the production site.

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Landing page + market list |
| `/market/[marketId]` | Market detail page |
| `/thread/[marketId]` | Market trading view with discussions |
| `/activity` | Real-time activity feed |
| `/profile/[pubkey]` | User profile + portfolio |
| `/portfolio` | Current user's positions and PnL |
| `/wallet` | Cashu wallet UI |
| `/settings` | Profile settings + relay configuration |
| `/welcome` | Onboarding flow |
| `/join` | Account creation |
| `/analytics` | Market analytics |
| `/blog` | Blog / editorial content |
| `/bookmarks` | Bookmarked markets |
| `/help` | Help and documentation |
| `/legal/terms` | Terms of service |
| `/legal/privacy` | Privacy policy |

---

## Nostr Integration

**NDK** (Nostr Dev Kit) handles all Nostr operations:
- Real-time subscriptions to relays
- Event publishing (signed by user's key)
- Metadata fetching (profiles, bookmarks, positions)

No polling. Everything is subscription-based. When an event arrives, it renders. When no events have arrived, nothing renders — no placeholder, no spinner.

**Key subscriptions:**
- `kinds: [982]` — all markets (live feed on homepage and activity page)
- `kinds: [983]` filtered by market event ID — trade history for a specific market
- `kinds: [984]` filtered by market event ID — resolution events
- `kinds: [1111]` filtered by market event ID — discussions
- `kinds: [30078]` filtered by user pubkey — user's positions

---

## No Loading Spinners

This is a hard rule. No spinner components. No `isLoading` state. No "Loading..." text.

Data streams in via Nostr subscriptions. Render what you have. Add items to lists as events arrive. If nothing has arrived yet for a view, show an empty state — not a loading indicator.

Why: Nostr is event-based. There is no defined "loading complete" moment. A spinner would either spin forever or be cut off arbitrarily. Neither is acceptable.

---

## Auth

Users authenticate with Nostr keypairs.

- nsec (private key) is generated client-side and stored in localStorage
- Never sent to any server
- Not shown during onboarding
- Retrievable only from the Settings page (`/settings`) — the user must explicitly navigate there

For advanced users, NIP-46 remote signing is supported (for hardware signers or remote key management).

**No Nostr jargon in UI.** Users never see:
- "nsec" or "npub"
- "relay"
- "Nostr event"
- "pubkey"

They see: "account", "profile key" (in Settings only), "activity".

---

## Styling Rules

- Tailwind CSS with `neutral-*` colors only (never `gray-*`)
- Page background: `neutral-950`
- Accents: `emerald-*` (YES/bullish), `rose-*` (NO/bearish) — no other accents
- Numbers and prices: `font-mono` (JetBrains Mono)
- Text and UI: `font-sans` (Inter)
- No rounded pills, no gradients, no emojis in UI chrome
- No cards everywhere — use spacing and dividers

See [style-guide.md](../design/style-guide.md) for the full reference.

---

## Cashu Wallet

The `/wallet` route provides a Cashu ecash wallet UI. Users can:
- View their ecash balance (aggregated across all tokens)
- Deposit via Lightning (NUT-04 mint)
- Withdraw via Lightning (NUT-05 melt, user provides BOLT11 invoice)
- See breakdown by market (LONG/SHORT shares)

The Cashu wallet state is held client-side (tokens stored in localStorage or similar). The mint is the issuer; the user's device is the wallet.

---

## No Mock Data

Every market displayed must come from a real kind 982 Nostr event. No hardcoded, placeholder, or fake markets. If no events have arrived, the list is empty.
