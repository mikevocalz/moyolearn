# Flow Contract — guardian.family (children + controls)

```yaml
screen_id: guardian.family
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "tab: Family — tab 4 of the reconciled 4-tab set (G §1.2; doc 36 §3.2: Family holds children + controls + plan/billing)"
  - "push: from guardian.home manage_child / child chips"
  - "push: from guardian.report-detail act_on_child"
  - "push: from guardian.alerts adjust_controls"
answers_within_5s:
  - "Which children are on this account?"
  - "What controls are set for this child (voice, budget, readsAt)?"
  - "Where do I manage the plan?"
primary_action: "Manage a child — open a child's controls (voice default, session budget, readsAt, data & erasure)"
secondary_actions:
  - "Manage plan (→ PW-05, the (guardian)/settings/plan home per doc 38)"
  - "Add another learner (→ FD-12, ?index=n repeat)"
  - "Connect a device for a child (→ FD-14 code+QR)"
exits:
  manage_plan: PW-05
  add_learner: FD-12
  connect_device: FD-14
  ai_permissions: guardian.ai-activity
  see_child_schedule: guardian.calendar
completion_returns_to: self (hub — child controls save in place)
back_behavior: "Tab: back returns to guardian.home. Child controls are in-screen states (no child-detail inventory row exists — J2's guardian.child [M])."
failure_paths:
  offline: "Children + current control values render from cache; control changes queue with explicit pending state (a queued budget change must not look applied)."
  no_data: "No children → the guardian.home empty path: 'Add your learner' (→ FD-12)."
  permission: "Guardianships scope everything; two-guardian families both see and may edit (E §1 row 1); erasure actions re-confirm identity."
cross_role_propagation:
  - "Voice default + readsAt changes → learner.tutor voice register (doc 31: readsAt governs voice, curriculum follows grade)"
  - "Session budget → learner free-limit behavior (limit hit on the learner device renders PW-03b — band copy, never prices)"
  - "Erasure entry → guardian.memory → Natalie's memory in learner.tutor"
cross_device_continuity: "Controls are server-backed; a budget set on web binds the child's phone immediately."
max_interactions_to_primary: 1
state_owner: "family.store [add] — activeChildId + control drafts (shared owner with guardian.home; ends G-8's ai-activity.store squatting)"
```

**Status:** Route EXISTS — `/(guardian)/(tabs)/family` (`FamilyScreen`, now real — stale audits' SettingsScreen alias is fixed), classified COMPLETE. Web: **MISSING** — web nav "Family" mispoints at `/settings` (G §3.1: re-point at the real family surface).

**Notes:**
- **Web mislabel:** `NAV_BY_ROLE.guardian` Family → `/settings` (sys.settings) — the reconciled target re-points it at a real family page (G §3.1 "href fixes only"). Until then the web entry_point is broken.
- **Child switching (G-8):** children are hardcoded fixtures upstream; this screen is where `family.store [add]`'s activeChildId must be written so every "per child" surface (home, reports, alerts, calendar) reads one seam.
- Plan/billing lives HERE per doc 36 §3.2 — not in a 5th Account tab (see guardian.account disposition contract). PW-05/PW-06/PW-07 are doc-38 contracts; this screen only exits to them.
- FD-12/FD-14 exits reuse onboarding steps post-onboarding (`?index=n` repeats per D FD-12 row) — no duplicate add-learner surface may be built.
