# Flow Contract — district.home

```yaml
screen_id: district.home
role: district
tenant: [district]
band: n/a
shell: district (web-rail only — doc 36 §3.5 web-only; mobile (district) tab bar retired per G §1.7 / ADR-d default; the existing /(district)/(tabs)/district-home route survives only as a redirect-to-web lander or is deleted)
entry_points:
  - "system: district host `/` via sys.dispatch (host-aware boot)"
  - "deep_link: /districts/[districtSlug]"
  - "rail: Outcomes (first, unlabelled group of doc 36 §3.5's set)"
  - "back_from: district.schools (J7 roll-up)"
answers_within_5s:
  - "Are outcomes across my district moving?"
  - "Which schools need attention right now?"
  - "Is a cell suppressed (protection), or empty (absence)?"
primary_action: "Open a school that needs attention (J7 drill: district → school)"
secondary_actions:
  - "Change reporting period/filter"
  - "Open district.compliance"
  - "Open district.people (Educators)"
exits:
  drill_open_school: school.home
  rail_schools: district.schools
  rail_educators: district.people
  rail_compliance: district.compliance
  rail_settings: sys.settings
  sign_out: FD-02
completion_returns_to: self (hub — J7 root; drill-downs roll back up here; no roll-up above it)
back_behavior: "Browser back. Returning from a school drill restores Outcomes with period/filter state intact (J7 roll-up law). Role-mismatched deep links die silently via sys.not-found."
failure_paths:
  offline: "Read-only cached view labelled stale, or plain retry — never partial numbers presented as complete"
  no_data: "District has no schools yet → honest empty state pointing at rostering, not a fake chart"
  permission: "Non-district session hitting the host → sys.not-found silent `/` redirect (doc 36 §4.4)"
  suppression: "Any k-anon-suppressed aggregate cell renders \"Not shown\" — never zero, never blank (E §2, doc 21/36; DataTable Suppressible is the primitive)"
cross_role_propagation:
  - "Inbound only: J1 mastery movement and Enrollments roll up through the k-anon projection."
  - "Outbound: none — this screen can never surface an individual learner, session, or incident content (default-deny RLS doc 12; Compliance carries counts only)."
cross_device_continuity: "n/a by design — web-only role. State lives in the URL (slug + query filters); any signed-in browser resumes identically."
max_interactions_to_primary: 1
state_owner: "server aggregates via React Query; URL owns period/filter; no feature store needed"
```

**Status:** PLACEHOLDER (D-screen-inventory verbatim). Web `/districts/[districtSlug]` + district host `/` exist; real Outcomes unbuilt. Phase-3 build, IA + contract now (doc 36 §3.5, PRD non-goal 6).

**Notes:**
- Resolves the inventory's "web-only contradiction": this contract declares **no mobile entry**; silence keeps doc 36 §3.5 (G §6 ADR-d default — retire the mobile district tab bar).
- J7 drill chain is only contractable to the people level today — class and student nodes are [M] with no inventory rows; exits here stop at inventoried IDs.
