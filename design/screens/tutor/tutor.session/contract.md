# tutor.session — tutor-side live session room

```yaml
screen_id: tutor.session
role: tutor
tenant: [app, org]
band: n/a
shell: tutor
entry_points:
  - "push: from tutor.today start_session (next session card)"
  - "push: from tutor.learners start_prepped_session (after prep)"
  - "deep_link: session invite (resolves in tutor shell or drops silently, doc 36 §2)"
answers_within_5s:
  - "Who am I teaching and what are we working on?"
  - "Is the connection/room healthy?"
  - "How much time is left?"
primary_action: "Run the session (stage is live: talk, whiteboard, review homework)"
secondary_actions: [open session prep context, mark a moment for notes, end session]
exits:
  end_session: tutor.notes
  mark_moment: tutor.notes
  open_learner_context: tutor.learners
completion_returns_to: tutor.notes
back_behavior: "Back during a live session prompts end/minimize — never silently leaves the room; after end, back returns to tutor.today"
failure_paths:
  offline: "Reconnecting state with elapsed-time hold; session auto-holds per conference safety rules; explicit rejoin"
  no_data: "No session context loaded → session runs, prep panel shows honest empty state"
  permission: "Mic/camera denied → prompt at point of use (doc 37 §1 law), audio-only or text fallback"
cross_role_propagation:
  - "Session events feed the doc-34 evidence table → tutor.notes draft → guardian.reports on approval"
  - "S1–S4 safety events route per doc 31 (S3/S4 → guardian + org.safety queue, never through this screen's UI)"
cross_device_continuity: "Session is device-bound while live; notes draft and learner context sync (tutor can end on device A, approve notes on device B)"
max_interactions_to_primary: 0
state_owner: "tutor.store (useTutorStore)"
```

**Status:** PARTIAL — no tutor-side room exists as a distinct surface. `(session)/tutor` on web and `(learner)/(tabs)/tutor` on mobile mount `TutorScreen`, which is the learner-facing AI session (A-repo-audit). The human-tutor-side room (J5 "Tutor Room") shares the session substrate but needs its own chrome: prep context rail, mark-moment, host-side end.

**Notes:**
- Grounds the previously UNGROUNDED exits `tutor.today → start_session` and `tutor.learners → start_prepped_session`.
- The mark-moment affordance is the doc-34 evidence hook (H-competitor: Descript/Riverside "mark clip" pattern adopted in the overhaul prompt §12 conference table); it writes to the draft that lands in tutor.notes — it is not a recording control (recordingAllowed is false per `conference.types.ts`).
- Session-prep demo data (`session-prep.data.ts` self-labelled "replace with real derived observations", F-journey-maps J5) means the prep panel is PARTIAL until wired.
- Whether this surface reuses the Fishjam conference room or the AI-session stage is a Phase-11 (Tutor Room + Conference integration) decision; this contract constrains flow, not transport.
```
