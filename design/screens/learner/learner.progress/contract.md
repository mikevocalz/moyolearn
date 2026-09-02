# Flow Contract — learner.progress

```yaml
screen_id: learner.progress
role: learner
tenant: [app]
band: 6-8 · 9-12   # off-band href: null (no K–2/3–5 Progress tab, doc 36 §3.1)
shell: learner
entry_points:
  - "tab: Progress — tab 4 on the 6–12 five-tab shell (G §1.1)"
  - "back_from: learner.tutor (post-session, checking what moved)"
answers_within_5s:
  - "Did I actually get better at anything?"
  - "What moved since last time?"
  - "What's still shaky?"
primary_action: "Review mastery movement — open a subject's before→after evidence (MasteryBar movement, trajectory language, never pass/fail — doc 34)"
secondary_actions:
  - "Work on a shaky area now (→ learner.plan due/suggested work)"
  - "Get help on it with Natalie (→ learner.tutor)"
exits:
  work_on_it: learner.plan
  practice_with_natalie: learner.tutor
completion_returns_to: self (review hub)
back_behavior: "Tab: back returns to learner.home. Single-pane at every width — no evidence side-panel (learner pane ban, doc 37 §3.3)."
failure_paths:
  offline: "Last-synced mastery snapshot renders read-only with a sync timestamp; evidence links disabled."
  no_data: "No sessions yet → encouraging empty state pointing at the one action: Snap your homework (→ learner.capture); never a zeroed chart."
  permission: "n/a — learner sees only their own mastery (identity from ctx, never a parameter)."
cross_role_propagation:
  - "None outbound — read-only surface. Inbound: mastery writes from learner.tutor sessions (student-model.repository + /api/progress via use-progress)."
cross_device_continuity: "Server-backed mastery state; identical on any device; no local selection worth carrying."
max_interactions_to_primary: 1
state_owner: "progress.store [add] — accordion/subject selection only; mastery data stays in React Query (use-progress). No existing store maps to features/progress."
```

**Status:** Route EXISTS — `/(learner)/(tabs)/progress` + web `/progress`, classified COMPLETE.

**Notes:**
- Movement vs position, never conflated (doc 34): mastery delta is celebrated; grade-relative position is honest and normalized. No engagement metrics as wins, no comparisons, no grade predictions.
- **Plan write-back missing (J1 finding 5):** mastery reaches this screen only; learner.plan does not re-rank from session outcomes — the `work_on_it` exit currently lands on a plan that ignores what this screen shows.
- Web `/progress` reachable by URL for off-band learners (same class of hole as learner.subjects' K–2 web gap) — needs the same band guard + silent fallback.
- No red/redpen for struggling areas (doc 08: redpen never for struggling learners); "still working on it" renders highlighter, not alarm.
