# Flow Contract — school.people

```yaml
screen_id: school.people
role: school
tenant: [school]
band: n/a
shell: school (web-rail). NO mobile route — the declared mobile `people` tab is not built while the shell is parked Overview-only (ADR-c position); D's "build the mobile route or drop the tab" resolves to drop, pending the ADR
entry_points:
  - "rail: People"
  - "push: from school.home (J7 drill, school → people)"
  - "deep_link: /people on the school host (PeopleListScreen, live; shared with district — this contract covers the school scope)"
answers_within_5s:
  - "Who works at / attends my school?"
  - "Can I find a specific person fast?"
primary_action: "Find and open a person (staff or member detail)"
secondary_actions:
  - "Search/filter"
  - "Return to school.home"
exits:
  roll_up: school.home
  rail_reports: school.reports
  rail_settings: sys.settings
completion_returns_to: self (search/filter/scroll state intact)
back_behavior: "Browser back walks the drill path up (people → school.home → district.schools when applicable); never dead-ends."
failure_paths:
  offline: "Retry"
  no_data: "No people rostered → honest empty state with invite/roster guidance (FD-09 invites, FD-08 class codes)"
  permission: "A learner row here is a roster fact only — it never opens learner session content; learning data reaches school admins only as k-anon aggregates (E §2 school row)"
  suppression: "Any aggregate column attached to a person (e.g., outcome roll-ups) obeys k-anon — \"Not shown\" under threshold (E §2). Directory facts render normally."
cross_role_propagation:
  - "Inbound: FD-09/FD-23 invites and Enrollments (class-code joins via FD-08) populate this list."
  - "Outbound: none."
cross_device_continuity: "n/a — web-only surface; URL carries scope and query."
max_interactions_to_primary: 2
state_owner: "server (Memberships + Enrollments) via React Query; URL owns search/filter"
```

**Status:** PARTIAL (D-screen-inventory verbatim): web live, mobile dropped pending ADR-c.

**Notes:**
- J7: drill-down past a person (class → student) is [M] with no inventory rows — this contract terminates the chain at the person record; no invented detail surfaces.
- Shares `PeopleListScreen` with district.people: one component, two scoped mounts, different roll-up targets.
