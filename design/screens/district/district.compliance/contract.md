# Flow Contract — district.compliance

```yaml
screen_id: district.compliance
role: district
tenant: [district]
band: n/a
shell: district (web-rail only, doc 36 §3.5; ADR-d default — no mobile)
entry_points:
  - "rail: Compliance (replaces the current nav's off-doc \"Reports\" item, G §3.2)"
answers_within_5s:
  - "Are consent records in order across my schools?"
  - "How many incidents (by severity band and status) occurred in the period — as counts?"
primary_action: "Review compliance counts for the selected period (read-only)"
secondary_actions:
  - "Change period"
  - "Filter by school"
exits:
  roll_up: district.home
  rail_schools: district.schools
  rail_educators: district.people
  rail_settings: sys.settings
completion_returns_to: self (period/filter state intact)
back_behavior: "Browser back → prior rail location. No incident detail exists behind any element, so back never exits a content view here."
failure_paths:
  offline: "Retry"
  no_data: "No data in period → honest empty state"
  permission: "Structural, not conditional: no path into incident contents exists to be denied — counts never contents (doc 36 §3.5, doc 31 channel, default-deny RLS doc 12)"
  suppression: "k-anon applies to incident/consent aggregates — cells under threshold render \"Not shown\", never zero (E §2). A true zero renders as zero only where the cell is not suppressed."
cross_role_propagation:
  - "Inbound only: J8 incidents (S1–S4 ladder, doc 31) roll into these counts after lifecycle events (new→…→closed)."
  - "Outbound: nothing propagates from this screen into the incident channel."
cross_device_continuity: "n/a — web-only; URL carries period/filter."
max_interactions_to_primary: 1
state_owner: "server count projections via React Query; URL owns period/filter"
```

**Status:** MISSING (D-screen-inventory verbatim). Build is Phase 3 per doc 36; IA and this contract now.

**Notes:**
- The counts-not-contents boundary is the contract's core invariant. Any future "view incident" affordance here is a violation, not an enhancement — incidents travel doc 31's channel (guardian view + org triage queue) only.
- J8 honesty caveat: the live tutor adapter classifies arithmetic on/off-task only (J8 finding 7), so counts under-report until classifier depth lands — surface a data-coverage caveat rather than implying completeness.
- No export affordance is inventoried; none is invented here.
