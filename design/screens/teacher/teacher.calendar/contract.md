# Flow Contract — teacher.calendar

```yaml
screen_id: teacher.calendar
role: teacher
tenant: [school]
band: n/a
shell: teacher (NOT a tab — ADR-b demotes Calendar to a stack route reachable from Home; the declared Calendar tab dies with the reconciled 4-tab set)
entry_points:
  - "push: from teacher.home 'Open the class calendar'"
  - "push: from teacher.conference (see surrounding schedule when placing a conference)"
answers_within_5s:
  - "When do my classes meet this week?"
  - "What deadlines and conferences are coming up?"
primary_action: "See the week (classes, assignment due dates, conferences on one calendar)"
secondary_actions:
  - "Open a class session block (→ teacher.classes, class pre-selected)"
  - "Open a due-date block (→ teacher.assign tracking view)"
  - "Open a conference block (→ teacher.conference)"
exits:
  open_class: teacher.classes
  open_assignment: teacher.assign
  open_conference: teacher.conference
  back_home: teacher.home
completion_returns_to: teacher.home (stack pop)
back_behavior: "Stack route: back pops to teacher.home (or teacher.conference when entered from there)."
failure_paths:
  offline: "last-synced calendar read-only with staleness label"
  no_data: "empty week → 'Nothing scheduled' with live exits to teacher.classes and teacher.assign — never a bare empty state"
  permission: "shows own classes/conferences only; no school-wide calendar here (that is school.calendar's scope)"
cross_role_propagation:
  - "teacher.assign due dates → blocks on this calendar (derived, read-only here)"
  - "teacher.conference bookings → blocks here and on guardian.calendar (the guardian side of a booked conference)"
cross_device_continuity: "Calendar derives entirely from server truth (classes, assignments, conferences); no local state beyond the visible week, which does not sync."
max_interactions_to_primary: 0 (the week IS the landing content)
state_owner: "[add] teacher-calendar derived query composing classes + assignment due dates + conference slots; render reuses the schedule feature's model/grid primitives (features/schedule) read-only — never a second calendar implementation."
```

**Status:** MISSING (D: `teacher.calendar` — tab declared, no route file). Builds as a stack route under ADR-b, not as the declared tab.

**Notes:**
- Doc 36 §4.1's ≤5 law and G §1.5's derivation both demote Calendar: it is a projection of the other three surfaces' data, not a daily-loop destination. Every block on it is a link out — the calendar is pure navigation tissue, which is why it earns 0-interaction primary and no tab.
- If ADR-b lands differently and Calendar becomes a tab, only `shell`, `entry_points`, and `back_behavior` change; the exits and data contract hold.
