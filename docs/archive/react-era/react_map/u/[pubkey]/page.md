---
route: "/u/:pubkey"
kind: page
component: ProfilePage
source: src/ProfilePage.tsx
related_routes:
  - /profile
  - "/profile/:npub"
  - "/u/:pubkey/portfolio"
  - "/market/:slug"
rebuild_notes:
  - "This is the public-facing profile route that should preserve readable names and avatar context."
  - "It is the route most linked from avatars, market participants, and discussion identities."
  - "Keep the market and positions tabs distinct from the editable self-profile route."
role: |-
  Public profile page for a specific pubkey. It surfaced a user identity, their market activity, and their positions in a public-facing view.
---

## Verbatim Microcopy

- Invalid pubkey
- Edit Profile
- …
- Markets
- Positions
- Followers
- Coming soon
- Following
- No markets created yet
- No positions held yet
