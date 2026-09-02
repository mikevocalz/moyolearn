# Flow Contract — district.calendar (disposition)

```yaml
screen_id: district.calendar
role: district
tenant: [district]
band: n/a
shell: none — struck. No calendar appears in doc 36 §3.5's web-only district set; the declared mobile tab has no route file and the district mobile bar is retired (G §1.7: the reconciled map "resolves to zero routes for this shell").
entry_points: []
answers_within_5s: []
primary_action: "n/a — REMOVED. Scheduling is an org-shell concern (org.schedule); district admins have no booking job in PRD §5 / E §2."
secondary_actions: []
exits:
  deep_link_lands_on: sys.not-found
completion_returns_to: n/a (screen does not exist)
back_behavior: "n/a"
failure_paths:
  offline: "n/a"
  no_data: "n/a"
  permission: "Deep link → sys.not-found silent `/` redirect (doc 36 §4.4)"
cross_role_propagation: []
cross_device_continuity: "n/a"
max_interactions_to_primary: 0
state_owner: "none"
```

**Status:** MISSING (D-screen-inventory verbatim) → **disposition: STRUCK**. D's "Per shell decision" resolves via ADR-d default (retire district mobile; web rail = doc 36 §3.5 verbatim), leaving no home for a district calendar.

**Notes:**
- Reviving requires an ADR + a fresh D-inventory row. Do not design against this contract.
