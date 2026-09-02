# Flow Contract — tutor.learners

```yaml
screen_id: tutor.learners
role: tutor
tenant: [app, org]
band: n/a (tutor sees each learner's band as context, never wears one)
shell: tutor (Learners tab — mobile `/(tutor)/(tabs)/session-prep`, web `/session-prep`)
entry_points:
  - Learners tab
  - tutor.today "Prep for next session" (arrives with the upcoming learner pre-selected)
  - tutor.notes draft context link ("open this learner's trail" from a draft under review)
answers_within_5s:
  - Who am I seeing next and where did we leave off?
  - What is this learner working on (mastery movement, misconceptions)?
  - Is my prep for the next session done?
primary_action: Open a learner → per-learner trail + prep detail
secondary_actions:
  - Generate session plan (per D proposed action — currently unwired)
  - Filter/search roster (Cool dial affordance; roster scoped to own learners only)
exits:
  open_learner: tutor.learners (detail pane of the same surface — doc 37 §3.3 mandated pane `Learners | detail`; collapse by width class, primary pane wins)
  start_prepped_session: "UNGROUNDED — same missing `tutor.session` inventory row as tutor.today's start_session exit"
  review_related_draft: tutor.notes (from a learner's trail, jump to their pending draft)
  back_to_timeline: tutor.today
completion_returns_to: tutor.today (prep complete → the timeline card flips to "Prepped"; return is explicit, not automatic)
back_behavior: "Detail pane open + collapsed width: back closes detail to the roster list (selection survives the fold). Roster at tab root: standard tab-root back."
failure_paths:
  roster_fetch_failed: inline retry; tab remains navigable
  empty_roster: "empty state routes somewhere real: org-employed → 'Sessions are assigned by your organization' with exit to tutor.today; solo → exit to the org hat (ContextSwitcher) to book clients"
  plan_generation_failed: prep detail stays usable; error inline on the plan card with retry (generation is additive, never blocking)
cross_role_propagation:
  - learner session outcomes → this roster's trails (mastery/misconception panel must derive from doc-19/21 events; J5 flags no live derivation yet)
  - org.crm enrollment → roster membership (a newly enrolled learner appears here via assignment; CRM itself is never readable from this screen)
cross_device_continuity: "Roster + trails are server truth. Pane selection is a per-device scoped store and intentionally does NOT sync (doc 37 §3.2)."
max_interactions_to_primary: 1 (tap a roster row)
state_owner: "[add] scoped vanilla Zustand pane-selection store per doc 37 §3.2 (AdaptivePanes consumer #3 — reuse the compound API, do not fork) + [add] live prep query replacing `features/session-prep/session-prep.data.ts` fixtures (self-labelled 'replace with real derived observations')."
```

**Status:** CONTRACTED over COMPLETE screen with fixture data (D: `tutor.learners` COMPLETE; prep data is demo; pane form TO ADD per G §5).

**Notes:**
- This is the doc-37-mandated `Learners | detail` pane surface that does not exist yet (single-pane today). The contract binds the pane form, not the current single-pane layout.
- Permission boundary: roster is "own learners only" (E matrix — org-employed tutor sees own roster/sessions only; incidents scope is tutor.incidents, not here).
- "Generate session plan" stays secondary: the screen's job is knowing the learner, not producing an artifact.
