# Flow Contract — learner.plan (assignments and due work)

```yaml
screen_id: learner.plan
role: learner
tenant: [app]
band: 6-8 · 9-12
shell: learner
entry_points:
  - "push: from learner.home 'See all' (the only mobile entry — stack route, not a tab; G §1.1 keeps the learner tab set as-is)"
  - "push: from learner.progress work_on_it"
  - "back_from: learner.tutor (due item finished)"
answers_within_5s:
  - "What's due, and when?"
  - "What should I start first?"
  - "How big is this week?"
primary_action: "Open a due item and start working it with Natalie (→ learner.tutor)"
secondary_actions:
  - "Snap the physical homework for a due item (→ learner.capture)"
exits:
  open_item: learner.tutor
  snap_for_item: learner.capture
completion_returns_to: learner.home
back_behavior: "Stack route: back pops to learner.home (or learner.progress if entered from there). Single-pane; day-strip selection survives remount via plan.store, not navigation state."
failure_paths:
  offline: "Cached week renders read-only with sync timestamp; open_item queues session start."
  no_data: "Nothing due → calm empty state ('Nothing due — nice.') with snap and resume as the ways forward; no manufactured urgency (PRD non-goal 7)."
  permission: "n/a — own plan only (identity from ctx)."
cross_role_propagation:
  - "Item completion feeds the doc-34 report chain → guardian.reports"
  - "Inbound (missing): teacher-assigned work has no arrival signal — no assignments object or push exists (J1 head node [M], doc 34 PR-131 unbuilt)"
cross_device_continuity: "Plan is server-backed; selected day is device-local (plan.store) and intentionally not synced."
max_interactions_to_primary: 1
state_owner: "plan.store (existing — features/plan; selectedDayId already contracted to survive remounts)"
```

**Status:** Route EXISTS — `/(learner)/plan` + web `/plan`, classified COMPLETE — but **web `/plan` has no nav entry** (C §Web dead-end fragment).

**Notes:**
- **Web orphan:** D row action — add a web nav entry or contract-justify stack-only. This contract justifies **stack-only on mobile** (plan is a drill-in from Home's "See all", not a daily-loop tab; the 5-tab set is full per doc 36 §4.1) and requires web to mirror that: reachable from the Today page's "See all", not from top-nav.
- **No plan write-back (J1 finding 5):** the plan never re-ranks from session outcomes; contract requires mastery→plan re-rank before this screen's ordering can claim to answer "what should I start first?".
- **No arrival layer (J1 finding 6):** assignments have no in-app arrival signal; until OneSignal wiring (doc 34 PR-131) lands, this screen is pull-only.
- Due dates render honestly, never as pressure mechanics; no late-night push, no shame copy (children's-surfaces law).
