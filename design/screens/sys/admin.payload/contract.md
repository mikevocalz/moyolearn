# Flow Contract — admin.payload (scope record — out of overhaul screen scope)

```yaml
screen_id: admin.payload
role: sys (platform admin — deliberately NOT a RoleKind and not one of the 7 shells; filed under sys/ because the README's role list has no admin bucket and this is the cross-role/system section's row)
tenant: [internal]
band: n/a
shell: none — themed Payload back office at admin.moyolearn.com/admin (apps/admin-vite), graphite, no role accent (tokens.ts mints no role-admin on purpose)
entry_points:
  - "deep_link: direct URL, internal staff only (desktop web)"
answers_within_5s:
  - "n/a — back-office CMS; its UX is Payload's, themed"
primary_action: "Operate the platform (Payload admin surfaces: collections, scoped visibility, canary/version dashboards)"
secondary_actions: []
exits: {}   # self-contained internal app; it never links into consumer shells and no consumer shell links to it
completion_returns_to: n/a
back_behavior: "Payload's own; not contracted here."
failure_paths:
  offline: "Payload's own"
  no_data: "Payload's own"
  permission: "Internal roles scoped (FR-14.1); default-deny; not reachable from any consumer surface"
cross_role_propagation:
  - "Everything — it is the back office over the same Payload data — but through repositories/collections, never through consumer screen contracts."
cross_device_continuity: "n/a — desktop web internal tool"
max_interactions_to_primary: 0
state_owner: "Payload admin"
```

**Status:** COMPLETE (D-screen-inventory verbatim) — and **out of overhaul screen scope by ADR-004** (design-of-record: themed Payload, deliberately not a consumer shell, doc 36 §3.6; three-app answer per docs/deploy/moyo-vercel-deployment.md rev 4).

**Notes:**
- This file exists only so the D-inventory row has a claimed contract and nobody drafts consumer-style Flow Contract work against the admin app. Do not design against this contract; changes to the admin app route through ADR-004's design-of-record, not Phase-2 screen work.
