---
route: /bookmarks
kind: page
component: BookmarksPage
source: src/BookmarksPage.tsx
related_routes:
  - "/market/:slug"
  - "/profile/:npub"
  - /activity
rebuild_notes:
  - Keep bookmark state and market lookup working together.
  - "This page should remain a lightweight, read-oriented surface with fast navigation back into market detail."
role: |-
  Saved-markets page. It displayed markets the user bookmarked so they could return to them quickly without browsing the full feed again.
---

## Verbatim Microcopy

- My Bookmarks
- Markets you've saved for later
- No bookmarks yet
- Bookmark markets you want to track. Click the bookmark icon on any market card.
- Browse Markets
