# Flow Contract — teacher.home

```yaml
screen_id: teacher.home
role: teacher
tenant: [school]
band: n/a
shell: teacher — Cool dial, tutor pattern; ADR-b default set `Home · Classes · Assign · You` (G §1.5; the shipped 6-item ITEMS with its fabricated doc-36 citation is reconciled down; Conferences and Calendar demote to stack routes). Web /teachers/me inherits the ADR-b set as a rail, not the tutor set (G §3.2)
entry_points:
  - "tab: Home (mobile /(teacher)/(tabs)/teacher-home)"
  - "system: `/` dispatch for teacher-kind sessions → /teachers/me (web)"
  - "flow: FD-23 onboarding completion lands here"
  - "back_from: teacher.classes / teacher.assign / teacher.conference"
answers_within_5s:
  - "What classes do I have today?"
  - "What's due / needs review across my classes?"
  - "Is a conference coming up?"
primary_action: "Open today's class (→ teacher.classes detail)"
secondary_actions:
  - "Open teacher.assign"
  - "Push teacher.conference (stack route per ADR-b)"
exits:
  tab_classes: teacher.classes
  tab_assign: teacher.assign
  push_conference: teacher.conference
  push_calendar: teacher.calendar
  you_settings: sys.settings
completion_returns_to: self (tab root)
back_behavior: "Tab root — back exits per platform default; stack pushes (conference, calendar-once-decided) pop back here."
failure_paths:
  offline: "Cached class list labelled stale; retry"
  no_data: "No classes yet → FD-23-style setup prompt (create class / roster via class code = FD-08 LearnerCodeEntry)"
  permission: "Role-mismatched deep link → sys.not-found silent `/` redirect"
cross_role_propagation:
  - "Inbound: learner session outcomes (J1 'teacher surfaces update' — currently [M]) and guardian-initiated share links (share.report is today's only working teacher-facing surface)."
  - "Outbound: assignments created via teacher.assign should reach learner.plan (arrival signal [M], J1 finding 6)."
cross_device_continuity: "Mobile and web share the ADR-b IA; resume is by data, not navigation state — nothing in-flight to carry."
max_interactions_to_primary: 1
state_owner: "server (classes/assignments/conferences) via React Query; teacher-home.store [add] only if the overview needs client composition"
```

**Status:** PLACEHOLDER (D-screen-inventory verbatim): 32-line acknowledged lander. Gated on ADR-b (shell existence + tab set); default adopts the shell and the 4-tab set.

**Notes:**
- Doc 36 §3.3 gives teachers only the tokened share page; the shell's legitimacy rests on doc 37's PR-145 amendment + doc 38 FD-23 (G §1.5). Revisit if ADR-b lands differently.
- J4 names the entire chain after home [M] ("a front door onto a hallway with no rooms"); this landing must not link to invented surfaces — exits are limited to inventoried IDs. Mastery-insight modules render only when J1 → teacher propagation exists; omit, don't fake.
- You tab hosts the role switcher (ContextSwitcher; guardian+teacher multi-hat per E §3) and the account-sheet anchor (G §2).
