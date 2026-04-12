---
route: "/profile/:npub"
kind: page
component: Profile
source: src/Profile.tsx
related_routes:
  - /profile
  - "/u/:pubkey"
rebuild_notes:
  - "This route is route-compatible but conceptually separate from the self-profile editor."
  - It is useful when reconstructing old public profile links.
  - Keep the identifier parsing tolerant of encoded keys and legacy formats.
role: |-
  Profile lookup route keyed by the user identifier. It reused the self-profile component to render a profile by identifier rather than by current session.
---

## Verbatim Microcopy

- Profile not found
- Return home
- Your profile
- Display name
- Your name
- Bio
- Optional
- Save
- Cancel
- Saved
- Edit
- NIP-05: Not verified
- Markets Created
- No markets created yet
- Trading Activity
- Total Trades
- Total P&L (sats)
- Active Positions
- Recent Discussions
- No discussion posts yet
- posts
- Reputation
- —
- Accuracy %
- Calibration
- Reputation metrics coming soon
- Social
- Following
- Followers
- Social features coming soon
