# Flow Contract — district.programs (disposition)

```yaml
screen_id: district.programs
role: district
tenant: [district]
band: n/a
shell: none — struck. Not in doc 36 §3.5's binding district set (Outcomes · Schools · Educators · Compliance · Settings); its only trace is a declared mobile tab with no route file, and the district mobile bar is retired (G §1.7, ADR-d default).
entry_points: []   # the `programs` ITEMS entry is removed with the mobile tab bar; no web rail item is added
answers_within_5s: []
primary_action: "n/a — REMOVED. Program-shaped needs route through district.people (Educators) or district.compliance."
secondary_actions: []
exits:
  deep_link_lands_on: sys.not-found
completion_returns_to: n/a (screen does not exist)
back_behavior: "n/a"
failure_paths:
  offline: "n/a"
  no_data: "n/a"
  permission: "Any deep link to a former/imagined programs route → sys.not-found silent `/` redirect (doc 36 §4.4)"
cross_role_propagation: []
cross_device_continuity: "n/a"
max_interactions_to_primary: 0
state_owner: "none"
```

**Status:** MISSING (D-screen-inventory verbatim) → **disposition: STRUCK**. D's action ("reconcile against Educators/Compliance before building") resolves — per doc 36 §3.5 silence and G §1.7 — to: do not build.

**Notes:**
- Disposition contract per README rule: kept so the ID stays claimed and nobody re-adds a Programs tab "because the row exists." Reviving a Programs destination requires an ADR plus a new D-inventory row first. Do not design against this contract.
