---
route: 404
kind: page
component: NotFoundPage
source: src/NotFoundPage.tsx
related_routes:
  - /
  - "/market/:slug"
  - /dashboard
rebuild_notes:
  - "Document this as a shell-level fallback rather than a routable page."
  - "It is useful when rebuilding route guards and migration-safe fallback behavior."
role: |-
  Manual 404 screen rendered when the React shell could not match a known route prefix. It was not mounted as a route path, but it was still a user-visible screen.
---

## Verbatim Microcopy

- Page Not Found
- Back to Markets
