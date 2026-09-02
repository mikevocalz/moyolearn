# Flow Contract — teacher.assign

```yaml
screen_id: teacher.assign
role: teacher
tenant: [school]
band: n/a (assignment targets a class whose grade/band came from FD-23)
shell: teacher (Assign tab — 3rd of the ADR-b 4-tab set `Home · Classes · Assign · You`; route to build, currently MISSING with tab declared)
entry_points:
  - "tab: Assign (mobile + web rail per ADR-b)"
  - "push: from teacher.home 'Create an assignment'"
  - "push: from teacher.classes class detail 'Assign work to this class' (class pre-filled)"
answers_within_5s:
  - "What have I assigned and who has done it?"
  - "What is due this week across my classes?"
  - "Where do I create the next assignment?"
primary_action: "Create and publish an assignment (class, subject, due date, work items)"
secondary_actions:
  - "Open an existing assignment's completion status"
  - "Duplicate a past assignment to another class"
  - "Close/extend an assignment's due date"
exits:
  publish: teacher.assign        # returns to the tracking list with the new assignment live
  view_class_status: teacher.classes
  view_student_status: teacher.students
  back_home: teacher.home
completion_returns_to: self (tracking list; publish confirmation names the propagation — "Assigned to {class}; it will appear on students' plans")
back_behavior: "Create form → tracking list (drafts are kept, never silently discarded); list at tab root → standard tab-root back."
failure_paths:
  offline: "draft persists locally; publish disabled with reason; list shows last-synced status"
  no_data: "no assignments yet → empty state with the create form one tap away; no classes yet → exit to teacher.classes ('Set up a class first') — never a dead end"
  permission: "can only assign to own classes (Enrollments scope); a deep link to another teacher's assignment resolves to not-found (silent drop, doc 36 §4.4)"
  publish_failed: "assignment stays a draft with inline error + retry; never half-published"
cross_role_propagation:
  - "publish → learner.plan + learner.home (assignment appears as due work — J1's arrival signal, currently [M]: no assignments object, no push, doc 34 PR-131 unbuilt; this contract requires the object + signal)"
  - "learner completion/session outcomes → this screen's tracking list and teacher.classes aggregates"
cross_device_continuity: "Assignments are server truth; drafts are per-device until published (MMKV/localStorage), by design."
max_interactions_to_primary: 1 (Create assignment from the tracking list)
state_owner: "[add] assignment draft store (assign.store [add], Zustand + MMKV persistence for drafts) + server truth for published assignments. Nothing existing fits — features/onboarding/teacher/store.ts is onboarding-only; there is no assignments object anywhere (J1 finding 6)."
```

**Status:** MISSING (D: `teacher.assign` — tab declared, no route file; ShellTabBar silently drops it). New-build against this contract, gated on ADR-b.

**Notes:**
- This screen is J4's `intervention/assign` node and the producer end of J1's missing arrival signal — the assignments object and learner-side surfacing (learner.plan) must ship together or publish is a lie.
- No engagement-pressure mechanics propagate to learners from here: due-work surfacing on learner.plan is calm listing, no shame copy, no late-night pushes (doc 33 non-goal 7; CLAUDE.md children's-surfaces rules).
- ≤5-destination law holds: Assign earns its tab because create-and-track is the teacher's second daily loop (G §1.5 derivation); per-class status lives in teacher.classes, not duplicated here beyond the jump link.
