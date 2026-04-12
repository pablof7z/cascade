---
route: /activity
kind: page
component: Activity
source: src/Activity.tsx
related_routes:
  - "/market/:slug/activity"
  - /analytics
  - /bookmarks
rebuild_notes:
  - "Preserve the type-filtering model and feed ordering."
  - "This route is a high-frequency read surface and should remain event-stream friendly."
role: |-
  Global activity feed for markets, trades, and other stream events. It is the broad network feed that sits between discovery and specific market detail.
---

## Verbatim Microcopy

- Activity
- Recent activity across all markets
- Retry
- No markets found
- No trade activity yet
- Opened
- position
- No resolutions yet
- Resolved
- sats
- No activity found
