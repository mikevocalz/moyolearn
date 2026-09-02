# Flow Contract — teacher.classes

```yaml
screen_id: teacher.classes
role: teacher
tenant: [school]
band: n/a   # class grade is a class attribute captured at FD-23; teacher surfaces are adult Cool dial
shell: teacher (ADR-b default), Classes tab. Wide widths: `Classes | detail` AdaptivePanes — the pane form of folding Students into Classes (G §5, gated on ADR-b); collapse by width class never device type, primary pane wins, selection survives the fold (doc 37 §3.2); reuse the AdaptivePanes compound API as-is (third-consumer rule)
entry_points:
  - "tab: Classes"
  - "push: from teacher.home (open today's class)"
  - "flow: FD-23 creates the first class and lands its roster here"
answers_within_5s:
  - "What classes do I run and who is in each?"
  - "Which student in this class needs attention?"
primary_action: "Open a class → its roster/detail (and from the roster, a student detail — the folded teacher.students surface)"
secondary_actions:
  - "Add a class (FD-23 pattern)"
  - "Roster students via class code (FD-08 LearnerCodeEntry)"
  - "Assign work to this class"
exits:
  drill_student_detail: teacher.students   # folded into this screen as list→detail; see teacher.students disposition contract
  assign_to_class: teacher.assign
  roll_up: teacher.home
completion_returns_to: self (class/student selection intact via pane store)
back_behavior: "Detail → list → tab root; on collapsed width, back pops the detail pane first (primary pane wins). Selection survives rotation/fold; per-instance pane stores die with the tree (E §3) — that is by design."
failure_paths:
  offline: "Roster reads from cache labelled stale; mutations queue or fail visibly"
  no_data: "No classes → create-class prompt; class with no students → roster prompt (class code)"
  permission: "A student detail shows the teacher's own class data only; no safety/incident content ever renders here (incidents travel doc 31's channel; session reports reach teachers only via the tokened share.report)"
cross_role_propagation:
  - "Inbound: learner joins via class code (FD-08) appear on the roster; per-student mastery movement is J1's 'teacher surfaces update' — currently [M]; omit until wired."
  - "Outbound: class/roster targeting flows into teacher.assign."
cross_device_continuity: "Selection is device-local (AdaptivePanes per-instance store); data continuity only."
max_interactions_to_primary: 2
state_owner: "server (classes/Enrollments); AdaptivePanes per-instance store (useInstanceStore) for selection"
```

**Status:** MISSING (D-screen-inventory verbatim; tab declared, no route file — one of ShellTabBar's silent drops). New-build against this contract, gated on ADR-b.

**Notes:**
- Absorbs `teacher.students` per ADR-b ("Students fold into Classes as list→detail", G §1.5); the teacher.students row is closed by its disposition contract pointing here.
- J4's `mastery insight [M]` and `intervention [M]` nodes have no inventory rows — no exits invented for them.
