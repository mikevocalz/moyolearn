# Flow Contract — school.more (disposition)

```yaml
screen_id: school.more
role: school
tenant: [school]
band: n/a
shell: none — struck. Doc 36 §1 rules a More tab an IA failure ("Overflowing into a 'More' tab is IA failure, not a solution"); D's own action says "replace with named destinations in the shell contract"
entry_points: []
answers_within_5s: []
primary_action: "n/a — REMOVED. The named destinations replacing it: school.home, school.people, school.reports, school.academics (once built), sys.settings."
secondary_actions: []
exits:
  deep_link_lands_on: sys.not-found
completion_returns_to: n/a (screen does not exist)
back_behavior: "n/a"
failure_paths:
  offline: "n/a"
  no_data: "n/a"
  permission: "Deep link → sys.not-found silent `/` redirect"
cross_role_propagation: []
cross_device_continuity: "n/a"
max_interactions_to_primary: 0
state_owner: "none"
```

**Status:** MISSING (D-screen-inventory verbatim) → **disposition: STRUCK**. Same ruling as district.more.

**Notes:**
- If a future school mobile shell overflows five destinations, the fix is cutting destinations, not restoring this tab (doc 36 §4.1 ≤5 law). Do not design against this contract.
