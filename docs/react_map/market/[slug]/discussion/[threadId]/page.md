---
route: "/market/:slug/discussion/:threadId"
kind: page
component: ThreadPage
source: src/ThreadPage.tsx
related_routes:
  - "/market/:slug/discussion"
  - "/market/:slug"
  - "/market/:slug/charts"
rebuild_notes:
  - Preserve the threadId in the URL so reactions and reply links can resolve correctly.
  - This screen is the canonical destination for a selected discussion thread.
  - "Use it as the basis for any future thread-level social features."
role: |-
  Single-thread discussion view attached to a market. It renders the full reply tree, reactions, and navigation back to the parent market discussion route.
---

## Verbatim Microcopy

- Loading thread…
- ›
- Discussion
- Thread
- Best
- New
- Old
- Controversial
- No replies yet. Be the first to respond!
- Current probability
- %
- Volume
- $
- Buy YES
- Buy NO
