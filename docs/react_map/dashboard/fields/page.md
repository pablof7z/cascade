---
route: /dashboard/fields
kind: page
component: FieldsList
source: src/FieldsList.tsx
related_routes:
  - /dashboard
  - "/dashboard/field/:id"
  - /dashboard/agents
rebuild_notes:
  - Keep the grouped sections and the row layout.
  - This route is the management table for the workspace and should remain efficient to scan.
role: |-
  Field index and workspace list page. It grouped fields by status and exposed the operational metadata needed to open a specific field.
---

## Verbatim Microcopy

- Fields
- New Field
- Name / Conviction
- Status
- Agents
- Markets
- Capital
- Updated
