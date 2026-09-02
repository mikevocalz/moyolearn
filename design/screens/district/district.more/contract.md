# Flow Contract — district.more (disposition)

```yaml
screen_id: district.more
role: district
tenant: [district]
band: n/a
shell: none — struck twice over. (1) Doc 36 §1 rules a More tab an IA failure, not a solution; (2) the district mobile shell that declared it is retired (doc 36 §3.5 web-only; ADR-d default).
entry_points: []
answers_within_5s: []
primary_action: "n/a — REMOVED. Everything a More tab would hold is a named destination in the web rail (doc 36 §3.5's five) or does not ship."
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

**Status:** MISSING (D-screen-inventory verbatim) → **disposition: STRUCK**. Same ruling as school.more.

**Notes:**
- If any district surface ever overflows five destinations, the fix is cutting destinations, not an overflow tab (doc 36 §4.1 ≤5 law). Do not design against this contract.
