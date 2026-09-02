# Flow Contract — school.academics

```yaml
screen_id: school.academics
role: school
tenant: [school]
band: n/a
shell: school (web-rail target). No mobile route (shell parked Overview-only, ADR-c position)
entry_points:
  - "NONE until built — /academics is InstitutionPlaceholderScreen while being a live NAV_BY_ROLE.school_admin destination; the ADR-c position pulls it from the rail NOW; it re-enters only when this contract's target ships"
  - "rail: Academics (post-build)"
  - "push: from school.home (post-build)"
answers_within_5s:
  - "What subjects/programs does my school run?"
  - "Where do I add or change one?"
primary_action: "Manage a subject/program (open its detail)"
secondary_actions:
  - "Return to school.home"
exits:
  roll_up: school.home
  rail_people: school.people
  rail_reports: school.reports
  rail_settings: sys.settings
completion_returns_to: self (list state intact)
back_behavior: "Browser back → school.home; no trap states. While unbuilt, direct-URL visitors must get a way out (→ school.home) — a dead end with no exit is the defect this contract closes."
failure_paths:
  offline: "Retry"
  no_data: "No subjects configured → setup empty state"
  permission: "Role-mismatched deep link → sys.not-found silent `/` redirect"
  suppression: "Any per-subject outcome aggregate obeys k-anon — \"Not shown\" (E §2)"
cross_role_propagation:
  - "Outbound as configuration only: subjects/programs scope teacher class setup (FD-23) and the subject axis of school.reports aggregates. Never learner data."
cross_device_continuity: "n/a — web-only; URL state."
max_interactions_to_primary: 2
state_owner: "server (institution academic config) via React Query; URL owns view state"
```

**Status:** DEAD-END (D-screen-inventory verbatim). Immediate action shipped with this contract's position: **pull `/academics` from `NAV_BY_ROLE.school_admin` until built** (C-orphans §Web, G §3.2). Build target above is gated on ADR-c defining the school IA.

**Notes:**
- This row is C-orphans' canonical "designed dead end that is a live nav destination." The two-step remedy (pull nav now, build against the target later) is the pattern for any placeholder: placeholders may exist; nav entries to them may not.
