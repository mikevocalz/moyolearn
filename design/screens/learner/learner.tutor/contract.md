# Flow Contract — learner.tutor (Tutor Room / Natalie session — Safety Plane)

```yaml
screen_id: learner.tutor
role: learner
tenant: [app]
band: all
shell: learner   # chrome-free session surface (web mounts in the `(session)` group, no shell chrome)
entry_points:
  - "push: from learner.capture confirm_ocr (the core J1 arrow)"
  - "push: from learner.home resume (primary action, 6–12) and K–2 hub Natalie tile"
  - "push: from learner.subjects open_subject (subject-scoped session)"
  - "push: from learner.plan open_item / learner.stuff practice item (coached work)"
answers_within_5s:
  - "Is Natalie ready to help me?"
  - "What is she asking me to do right now?"
primary_action: "Work the problem with Natalie — send/speak the next turn (streaming coached dialogue; never answer mode, PRD non-goal 4)"
secondary_actions:
  - "Snap another problem (→ learner.capture)"
  - "End the session (→ learner.home)"
exits:
  end_session: learner.home
  snap_next: learner.capture
  free_limit_hit: PW-03b
completion_returns_to: learner.home
back_behavior: "Back = end/pause session with band-appropriate confirmation (K–2: single big 'All done?' voice prompt); session state is preserved server-side so back never destroys work. Chrome-free: no tab bar during the session. Single-pane, every band (pane ban)."
failure_paths:
  offline: "Offline fallback already present (D row): composer disabled, queued turns clearly marked, on-device voice STT keeps captions working (audio never leaves device, PRD non-goal 2); reconnect resumes the stream."
  no_data: "Session with no problem context = Natalie opener asking for a snap → snap_next exit; never a blank chat."
  permission: "Mic denied → type-only composer, no nag; voice-on default with captions for K–2 (FR-4.5) degrades to captions+type. S4 safety trip → tutoring stops, fixed human-written script (trusted adult + 988), never generated (doc 31)."
cross_role_propagation:
  - "Every session emits the doc-34 eight-block report → guardian.reports / guardian.report-detail"
  - "S3/S4 ladder events → guardian incident channel → guardian.alerts (48h/2h SLAs, doc 31)"
  - "Human/hybrid sessions → tutor draft queue (tutor.notes) — tutorApprovedBy required before the guardian sees it"
  - "Mastery updates → learner.progress and (once fixtures die) guardian.home child cards"
cross_device_continuity: "Session state is server-backed; a session started on the family tablet resumes on the learner's phone via learner.home's resume card after FD-24 profile switch."
max_interactions_to_primary: 1
state_owner: "tutor.store (existing — features/tutor)"
```

**Status:** Route EXISTS — `/(learner)/tutor` + web `/tutor` (`(session)` group, chrome-free), classified COMPLETE.

**Notes:**
- **`no_data` honoured 2026-09-02.** The surface rendered "No problem selected." centred on a blank page — no heading, no chrome, no exit, zero controls — which is precisely the "blank chat" this contract's `failure_paths.no_data` row forbids. `tutor-opening.tsx` now renders the pre-session surface in three separated states (loading · empty · failed), band-voiced, carrying the contract's two exits: a primary Snap → learner.capture (`snap_next`) and a persistent Back plus a named exit → learner.home (`end_session`). An unauthenticated `/api/tutor/next` answer resolves to the EMPTY state, not the failure one — there is nothing open to resume, and a retry cannot change that.
- **Safety classifier depth (J1 finding 7 / J8):** the live adapter (`tutor-safety.ts`) classifies arithmetic on/off-task only — far narrower than the doc-31 S1–S4 taxonomy. The cross_role_propagation rows to guardian.alerts are contractually required but not producible at doc-31 fidelity today.
- **Architecture defect:** `coach.service.ts` imports `@acme/payload` directly, violating the repository rule (A-audit) — contract-relevant because the Safety Plane law requires all learner-facing AI to traverse the sanctioned path.
- Voice register per band is binding (doc 31: K–2 ≤8-word sentences FK≈1 … 9–12 no artificial simplification) with the post-generation readability gate.
- Learner surface: no prices, no purchase controls; limit → PW-03b. Guardian memory erasure (guardian.memory) must be honored here — erased lines never referenced again.
