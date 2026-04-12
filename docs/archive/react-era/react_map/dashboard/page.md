---
route: /dashboard
kind: layout
component: AgentDashboard
source: src/AgentDashboard.tsx
related_routes:
  - /dashboard/fields
  - "/dashboard/field/:id"
  - /dashboard/agents
  - /dashboard/treasury
  - /dashboard/activity
  - /dashboard/settings
rebuild_notes:
  - This is the layout container for the entire dashboard subtree.
  - "Preserve sidebar navigation and outlet-driven child routing."
  - Everything under /dashboard depends on this shell.
role: |-
  Authenticated workspace shell for the agent dashboard subsystem. It provided the sidebar, layout, and outlet that powered the dashboard subtree.
---

## Verbatim Microcopy

- New Field
