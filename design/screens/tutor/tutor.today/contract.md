# Flow Contract — tutor.today

```yaml
screen_id: tutor.today
role: tutor (also teacher-as-tutor per D inventory)
tenant: [app, org]
band: n/a
shell: tutor (4 tabs: Today · Learners · Notes · You — doc 36 §3.3, conforming per G §1.3)
entry_points:
  - sys.dispatch (cold launch, last-used shell = tutor; `resolveBootRole` + SHELL_ROOTS)
  - Today tab (mobile `/(tutor)/(tabs)/tutor-today`; web rail first group, `/tutors/me`)
  - ContextSwitcher shell swap (tutor hat chosen from another shell's You/Profile)
  - push notification "session starting soon" (notification layer unbuilt — F cross-journey finding 3; contract requires it)
answers_within_5s:
  - When is my next session and who is it with?
  - Do I have report drafts waiting for approval?
  - Did anything change since yesterday (cancellation, reschedule)?
primary_action: Start the next session (opens the tutor-side session room)
secondary_actions:
  - Prep for the next session (→ tutor.learners, learner pre-selected)
  - Review draft queue (→ tutor.notes, count shown inline — never a badge on the tab)
  - Open a past session's report (→ tutor.notes approved item)
exits:
  start_session: "UNGROUNDED — the tutor-side live session room has no D-screen-inventory ID (J5 calls it 'Tutor Room (conference:hub / web (session)/tutor)'; web route (session)/tutor exists). Propose new inventory row `tutor.session` before Phase-3 wiring."
  prep_learner: tutor.learners (detail pane focused on the upcoming learner)
  review_drafts: tutor.notes
  profile: tutor.you (You tab)
  schedule_detail: "org.schedule (org-employed tutors only, read-only day view; solo tutors wear the org hat via ContextSwitcher — doc 36 tutor set has no Schedule item, ADR-e default folds it into Today)"
completion_returns_to: tutor.today (session end and draft approval both land back on the timeline; the timeline re-sorts to the next upcoming session)
back_behavior: "Tab root: system back on Android leaves the app (per platform norm); web back follows browser history. Never traps; never pops to another role's shell."
failure_paths:
  sessions_fetch_failed: inline error card with retry on the timeline; tabs remain navigable (no dead end)
  empty_day: "empty state with two live exits: 'Prep a learner' (→ tutor.learners) and 'Review drafts' (→ tutor.notes) — never a bare illustration"
  offline: last-synced timeline rendered read-only with staleness label; Start session disabled with reason
cross_role_propagation:
  - org.schedule → tutor.today (bookings/cancellations made by org staff appear on the tutor timeline)
  - tutor.today session completion → tutor.notes (human/hybrid session produces a draft in the queue, doc 34)
cross_device_continuity: "Timeline is server truth (React Query over sessions); identical on mobile and web. No client selection state to sync."
max_interactions_to_primary: 1 (Start session button on the top timeline card)
state_owner: "Server via React Query (sessions timeline) — no client store fits and none needed for the list. [add] replace SESSION_PREP/DEMO_DAY-style fixtures with a live sessions query; `features/home/tutor-today-content.tsx` is the mount."
```

**Status:** CONTRACTED over COMPLETE screen (D: `tutor.today` COMPLETE; verify Start/Prep actions are wired — Aug-30 audit flagged Wave-3 no-ops).

**Notes:**
- J5 opens here: today → schedule → prep → room → notes → approval → earnings. This contract's exits are the first three arrows.
- The `start_session` exit is the one ungroundable link in the tutor shell: the day's central act has no inventory row. Flagged in the Phase-2 report; do not wire until a row exists.
- Draft count renders inline on the timeline, never as a tab badge (the org Safety no-badge reasoning generalizes: counts are information, not pressure).
- Push entry is contract-required but unbuilt (OneSignal, doc 34 PR-131); until it ships, cold launch + tab are the only real entries.
