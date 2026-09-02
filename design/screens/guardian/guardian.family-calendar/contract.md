# Flow Contract — guardian.family-calendar (DISPOSITION: DUPLICATE — delete)

```yaml
screen_id: guardian.family-calendar
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "push: one push from the family screen (its only inbound link — C §Mobile)"
answers_within_5s:
  - "(identical to guardian.calendar — this route renders the same family schedule)"
primary_action: "n/a — DUPLICATE of guardian.calendar; every behavior is contracted there"
secondary_actions: []
exits:
  all_traffic: guardian.calendar
completion_returns_to: guardian.calendar
back_behavior: "n/a after deletion; until deleted, back pops to the family screen."
failure_paths:
  offline: "per guardian.calendar"
  no_data: "per guardian.calendar"
  permission: "per guardian.calendar"
cross_role_propagation:
  - "none of its own — see guardian.calendar"
cross_device_continuity: "per guardian.calendar"
max_interactions_to_primary: 0
state_owner: "family-calendar.store (existing — same store as guardian.calendar; nothing to migrate)"
```

**Status:** Route EXISTS — `/(guardian)/family-calendar` — classified **DUPLICATED** (D row; C §Mobile).

**Notes:**
- **Disposition, binding:** delete this route; repoint its single push at guardian.calendar (D row action "Delete; repoint push to `/calendar`"; G §1.2 restates it). This contract exists to ground the deletion and forbid designing against this route.
- No state migration needed — both routes already share `family-calendar.store`.
- After deletion, guardian.calendar's contract fully covers the surface; this directory should then be removed alongside the route in the same PR.
