---
route: /dashboard/activity
kind: page
component: ActivityFeed
source: src/ActivityFeed.tsx
related_routes:
  - /dashboard
  - /activity
  - /dashboard/settings
rebuild_notes:
  - Keep the dashboard activity stream separate from the public activity route.
  - This is an internal operational surface for the workspace.
role: |-
  Dashboard-specific activity stream. It focused on workspace events rather than the global product feed.
---

## Verbatim Microcopy

- Activity
- Everything happening across your workspace, most recent first.
- Entry types:
- No activity yet
- Agent actions, meeting entries, proposals, position changes, and source additions appear here once your workspace is active.
