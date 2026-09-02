# Flow Contract — school.calendar (disposition)

```yaml
screen_id: school.calendar
role: school
tenant: [school]
band: n/a
shell: none — struck pending ADR-c. The mobile `calendar` tab was declared with no route file; G §1.6's reconciled hypothetical mobile school set is `Overview · People · Academics · Inbox` — no Calendar slot; no web rail proposal includes it either
entry_points: []
answers_within_5s: []
primary_action: "n/a — REMOVED. School scheduling needs surfaced so far (conferences, class scheduling) belong to the teacher shell (teacher.conference, ADR-b scope) or org-style tooling, not a school-admin calendar."
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

**Status:** MISSING (D-screen-inventory verbatim) → **disposition: STRUCK pending ADR-c**. D's action "Build per reconciled tab map" resolves to zero — the reconciled map contains no school calendar.

**Notes:**
- Reviving requires ADR-c to name it plus a fresh D-inventory row. Do not design against this contract.
