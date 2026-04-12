---
route: /profile
kind: page
component: Profile
source: src/Profile.tsx
related_routes:
  - "/profile/:npub"
  - "/u/:pubkey"
rebuild_notes:
  - "This route is the self-editing surface, not the public profile page."
  - "It should stay focused on editable profile state and session-aware routing."
  - Use it as the base for rebuilding local profile persistence in Svelte.
role: |-
  Current-user profile editor and self-profile surface. It handled display name, about text, and avatar state for the signed-in user.
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
