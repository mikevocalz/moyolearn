# Flow Contract — school.reports

```yaml
screen_id: school.reports
role: school
tenant: [school]
band: n/a
shell: school (web-rail). No mobile route (shell parked Overview-only, ADR-c position; no `reports` tab was even declared on mobile)
entry_points:
  - "rail: Reports (current NAV_BY_ROLE.school_admin destination, live)"
  - "push: from school.home (status → detail)"
answers_within_5s:
  - "How is enrollment trending?"
  - "How are outcomes moving, in aggregate, by grade/subject?"
  - "Is a cell suppressed (protection) or empty (absence)?"
primary_action: "Read the aggregate report for the selected period"
secondary_actions:
  - "Change period"
  - "Change grouping (grade/subject)"
  - "Return to school.home"
exits:
  roll_up: school.home
  rail_people: school.people
  rail_settings: sys.settings
completion_returns_to: self (period/grouping intact)
back_behavior: "Browser back → school.home (J7 roll-up); grouping/period survive drill-and-return within the report. No row opens class- or student-level views — J7's class/student nodes are [M], and E §2 limits school-visible learning data to k-anon aggregates."
failure_paths:
  offline: "Retry; never stale numbers presented as current"
  no_data: "No data in period → empty state; the current UNAVAILABLE_METRICS honest-placeholder is a contract state (not an error) until real aggregates wire in"
  permission: "Role-mismatched deep link → sys.not-found silent `/` redirect"
  suppression: "k-anon-suppressed cells render \"Not shown\", never zero (FR-6.3; DataTable Suppressible exists per A-repo-audit). Suppression must be visually distinct from empty and from zero."
cross_role_propagation:
  - "Inbound only: learner session outcomes (J1 mastery updates) and Enrollments roll up through the k-anon projection."
  - "Outbound: none; no report cell reaches an individual learner, a teacher rating, or an incident."
cross_device_continuity: "n/a — web-only; URL carries period/grouping."
max_interactions_to_primary: 1
state_owner: "server (k-anon aggregate projection) via React Query; URL owns period/grouping"
```

**Status:** PLACEHOLDER (D-screen-inventory verbatim): `InstitutionReportsScreen` ships honest `UNAVAILABLE_METRICS`. Wire real aggregates against this contract.

**Notes:**
- Cool-dial evidence surface: doc-34 movement-vs-position rules apply to any outcome copy in aggregate labels (trajectory language, never pass/fail).
