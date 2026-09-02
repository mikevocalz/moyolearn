# Flow Contract — school.home

```yaml
screen_id: school.home
role: school
tenant: [school]
band: n/a
shell: school — web-first (web-rail); mobile (school) shell PARKED at Overview-only per the school-IA ADR position (ADR-c default, G §1.6): this screen is the sole mobile school surface, no tab bar beyond Overview, until the ADR defines a school IA
entry_points:
  - "system: school host `/` via sys.dispatch"
  - "deep_link: /schools/[schoolSlug]"
  - "push: from district.schools (J7 drill, district → school)"
  - "tab: mobile /(school)/(tabs)/school-home (parked Overview)"
  - "back_from: school.people / school.reports (J7 roll-up)"
answers_within_5s:
  - "How is my school doing right now (status at a glance)?"
  - "Is anything waiting on me?"
  - "Where do I go for people / reports?"
primary_action: "Drill into the area that needs attention — default: open school.people"
secondary_actions:
  - "Open school.reports"
  - "Open sys.settings"
exits:
  drill_people: school.people
  rail_reports: school.reports
  rail_academics: school.academics   # only once built — pulled from NAV_BY_ROLE.school_admin now per ADR-c position
  rail_settings: sys.settings
  roll_up_when_district_drilled: district.schools
completion_returns_to: self (hub — drill-and-return restores overview state)
back_behavior: "Web: browser back; when reached from district.schools, back = J7 roll-up to that list with its state intact. Mobile (parked): back exits per platform default — no sibling tabs exist by design."
failure_paths:
  offline: "Retry; status tiles never render stale-as-fresh"
  no_data: "Newly provisioned school (no roster) → honest setup-oriented empty state"
  permission: "Role-mismatched deep link → sys.not-found silent `/` redirect (doc 36 §4.4)"
  suppression: "Every aggregate on the overview obeys k-anon (FR-6.3) — suppressed cells render \"Not shown\", never zero (E §2, DataTable Suppressible)"
cross_role_propagation:
  - "Inbound: enrollment/roster changes (Enrollments bridge) and k-anon learning aggregates surface here."
  - "Outbound: none — school admins never reach individual learner reports or incident contents (FERPA-aligned handling E §2; incidents travel doc 31's channel)."
cross_device_continuity: "Web is the primary surface; the parked mobile Overview shows the same status shallowly — deeper action continues on web (URL-carried state)."
max_interactions_to_primary: 1
state_owner: "server (school aggregates + roster) via React Query; URL owns view filters"
```

**Status:** PLACEHOLDER (D-screen-inventory verbatim): 32-line acknowledged mobile lander + web institution screen. Build the real overview against this contract.

**Notes:**
- D's "decide shell-or-web-only in the contract" is decided here per ADR-c default: **web-first with a parked mobile Overview**. Building the four dead declared tabs (`people/academics/calendar/more`) is prohibited until the ADR lands; if mobile ever ships fully, the derived set is `Overview · People · Academics · Inbox` — never `More` (G §1.6).
- Shell defect carried from A-repo-audit: ShellTabBar silently renders 1 of 5 declared tabs — the parked-Overview ruling makes the honest state the designed state; ShellTabBar still must fail loudly in dev (C action).
