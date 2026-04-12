# React Route Map

This document maps the final React-era browser routes from the last React shell before deletion. Source of truth:

- `src/App.tsx` at the parent of commit `46b2e85`
- Route component files from the same React tree
- Migration notes in `docs/react-removal-audit.md`

Detailed per-route notes and page microcopy now live under [`docs/react_map/`](/Users/customer/Work/cascade-8f3k2m/docs/react_map/index.md), with one markdown file per route.

Scope:

- Browser routes only
- Includes nested dashboard routes
- Includes the standalone embed route that rendered outside the normal app shell
- Does not list API endpoints

## Router Shape

The React app had two top-level router layers:

1. `/embed/market/:slug` rendered as a standalone page, outside the main shell.
2. Every other route rendered inside the app shell with `TestnetBanner`, `NavHeader`, `<main>`, and `Footer`.

The shell also did manual 404 detection. If the pathname did not match a known pattern, the app rendered `NotFoundPage` instead of a route element.

## Full Route Map

### Home and market routes

| Path | Kind | Component | Details |
|---|---|---|---|
| `/` | page | `LandingPage` | Homepage and market feed. Showed trending, low-volume, disputed, and new markets plus latest discussions and the create-market modal. |
| `/market/:slug` | page | `MarketDetail` | Canonical market detail page, defaulting to the overview tab. Included trading, market stats, positioning, discussion preview, and market actions. |
| `/market/:slug/discussion` | page | `MarketDetail` | Same market detail screen with the discussion tab selected. |
| `/market/:slug/discussion/:threadId` | page | `ThreadPage` | Full threaded discussion view for a single discussion event attached to the market. |
| `/market/:slug/charts` | page | `MarketDetail` | Same market detail screen with the charts tab selected. |
| `/market/:slug/activity` | page | `MarketDetail` | Same market detail screen with the activity tab selected. |
| `/builder` | page | `ThesisBuilder` | Market creation flow. Used the thesis-builder UI for composing a new market, selecting side, amount, and optional thesis structure. |

### Identity and onboarding routes

| Path | Kind | Component | Details |
|---|---|---|---|
| `/onboarding` | page | `Profile` | Legacy onboarding/profile-setup entry. Reused the profile component instead of a separate onboarding screen. |
| `/profile` | page | `Profile` | Own profile screen. Displayed and edited the current user profile state. |
| `/profile/:npub` | page | `Profile` | Profile lookup route keyed by npub-like identifier. Reused the same `Profile` component for another user or profile context. |
| `/u/:pubkey` | page | `ProfilePage` | Public profile page for a specific pubkey, with markets and positions views. |
| `/join` | page | `OnboardingSplit` | Account creation flow with human/agent branching, OAuth, and key setup/import UX. |

### Core product routes

| Path | Kind | Component | Details |
|---|---|---|---|
| `/portfolio` | page | `Portfolio` | User positions, PnL, redemption/withdrawal flow, and payout history. |
| `/bookmarks` | page | `BookmarksPage` | Saved markets. Pulled from bookmark state and linked into market detail pages. |
| `/activity` | page | `Activity` | Global activity feed for markets, trades, and other stream items. |
| `/analytics` | page | `AnalyticsDashboard` | Analytics dashboard for market and platform metrics, including charts and summary tables. |
| `/leaderboard` | page | `Leaderboard` | Rankings page with multiple tabs for predictors, creators, accuracy, and bookmarks. |
| `/blog` | page | `Blog` | Editorial/blog content page. |
| `/how-it-works` | page | `HowItWorks` | Product explanation / education page describing modules, theses, and pricing behavior. |
| `/wallet` | page | `WalletPage` | Cashu wallet UI with deposit and withdrawal flows, balance display, and transaction history. |
| `/terms` | page | `TermsOfService` | Static legal page. |
| `/privacy` | page | `PrivacyPolicy` | Static legal page. |
| `/embed` | page | `EmbedLanding` | Landing page for embed examples and embed-related navigation. |
| `/embed/market/:slug` | standalone page | `EmbedPage` | Embedded market widget rendered outside the main shell. |

### Dashboard workspace

| Path | Kind | Component | Details |
|---|---|---|---|
| `/dashboard` | layout shell | `AgentDashboard` | Sidebar workspace shell with nested dashboard navigation. |
| `/dashboard` | index page | `DashboardOverview` | Overview dashboard showing action items, field cards, and recent activity placeholders. |
| `/dashboard/fields` | page | `FieldsList` | List view of all fields with status, agent count, market count, capital, and update timestamp. |
| `/dashboard/field/:id` | page | `FieldDetail` | Full field workspace with Meeting / Positions / Library / Council tabs and rich meeting detail. |
| `/dashboard/agents` | page | `AgentsPage` | Agent roster and management surface. Showed agent status, assigned field, wallet, and actions. |
| `/dashboard/treasury` | page | `TreasuryPage` | Treasury overview for the workspace. |
| `/dashboard/activity` | page | `ActivityFeed` | Dashboard-specific activity stream. |
| `/dashboard/settings` | page | `SettingsPage` | Dashboard/workspace settings screen. |

## Important Route Notes

- `/market/:slug` was the canonical market URL after the kind-982 migration.
- `/market/:slug/discussion/:threadId` was the canonical thread page for a market discussion.
- `/onboarding` reused `Profile`, so it was a legacy onboarding entry rather than a distinct onboarding shell.
- The final React shell did not include a standalone `/welcome` home feed route.
- `/dashboard` was the only true layout route. Everything under it was nested through `Outlet`.
- `NotFoundPage` was not mounted as a normal `Route` path; it was returned manually when the pathname did not match any known route prefix.

## Route Inventory Summary

- Home and market routes: `11`
- Identity and onboarding routes: `5`
- Core product routes: `12`
- Dashboard shell + children: `8`

Total named route entries documented here: `31`
