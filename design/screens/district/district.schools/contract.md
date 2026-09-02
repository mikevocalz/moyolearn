# Flow Contract — district.schools

```yaml
screen_id: district.schools
role: district
tenant: [district]
band: n/a
shell: district (web-rail only; the declared mobile `schools` tab resolves to zero routes — G §1.7 "Do NOT build", ADR-d default)
entry_points:
  - "rail: Schools"
  - "push: from district.home (J7 drill, district → school picker)"
  - "deep_link: /schools on the district host (SchoolListScreen, live today)"
  - "back_from: school.home (J7 roll-up)"
answers_within_5s:
  - "Which schools are in my district?"
  - "How is each school doing at a glance (aggregate columns)?"
primary_action: "Open a school (→ /schools/[schoolSlug])"
secondary_actions:
  - "Filter/sort the list"
  - "Return to district.home"
exits:
  open_school: school.home
  roll_up: district.home
  rail_educators: district.people
  rail_compliance: district.compliance
  rail_settings: sys.settings
completion_returns_to: self (drill-and-return lands back here with list scroll/filter state intact — J7 roll-up law)
back_behavior: "Browser back → district.home (or prior rail location). Filter/sort/scroll survive the drill-and-return."
failure_paths:
  offline: "Retry; no cached-stale aggregates presented as fresh"
  no_data: "No schools rostered → empty state with rostering guidance"
  permission: "Role-mismatched deep link → sys.not-found silent `/` redirect"
  suppression: "Per-school aggregate columns under the k-anon threshold render \"Not shown\" (E §2; never zero). School name/row still renders — rostering facts are not aggregates."
cross_role_propagation:
  - "None outbound; opening a school reads that school's k-anon projection only. Never a path to individual learner or incident content."
cross_device_continuity: "n/a — web-only; URL carries list state."
max_interactions_to_primary: 1
state_owner: "server roster + aggregates via React Query; URL owns filter/sort"
```

**Status:** PARTIAL (D-screen-inventory verbatim). Web `SchoolListScreen` live; aggregate columns and drill affordances unbuilt. Mobile per shell decision = none (ADR-d default).

**Notes:**
- J7's first drill hop: this screen's exit contract (school slug + district scope) must satisfy school.home's entry contract, including the roll-up back path.
