# Flow Contract — teacher.students (disposition — folded into teacher.classes)

```yaml
screen_id: teacher.students
role: teacher
tenant: [school]
band: n/a
shell: none as a standalone tab — ADR-b default folds Students into Classes as list→detail (G §1.5: "Students fold into Classes as list→detail (doc 37 §3.3 pane pattern)"); the declared mobile `students` tab (no route file) is removed with the ITEMS reconciliation
entry_points:
  - "NONE standalone. The student-detail surface is reached only inside teacher.classes (roster → student)"
answers_within_5s: []
primary_action: "n/a — DUPLICATE/FOLDED. The job ('Student roster → trail', D row) lives in teacher.classes' detail pane."
secondary_actions: []
exits:
  content_lives_in: teacher.classes
  deep_link_lands_on: sys.not-found
completion_returns_to: n/a (no standalone screen)
back_behavior: "n/a — pane back behavior is contracted in teacher.classes"
failure_paths:
  offline: "n/a"
  no_data: "n/a"
  permission: "Deep link to a standalone /students route → sys.not-found silent `/` redirect"
cross_role_propagation: []
cross_device_continuity: "n/a"
max_interactions_to_primary: 0
state_owner: "none — see teacher.classes"
```

**Status:** MISSING (D-screen-inventory verbatim) → **disposition: FOLDED into teacher.classes** per ADR-b default. D's action "Build route per reconciled tab map" resolves to the fold, not a route.

**Notes:**
- A standalone Students tab would also push the teacher shell past doc 36 §4.1's ≤5 law once Home · Classes · Assign · You + Conferences are counted — the fold is the IA-lawful shape. Do not design against this contract; design the detail pane inside teacher.classes.
