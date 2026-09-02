# Flow Contract — sys.editor-settings (tutor/org shared)

```yaml
screen_id: sys.editor-settings
role: tutor, org (staff) — filed under tutor/ as its primary user; one contract, two shells
tenant: [app, org]
band: n/a
shell: tutor and org (modal/stack route `/editor-settings` mounted over whichever shell invoked it — never a tab)
entry_points:
  - note-editor toolbar (tutor.notes draft editor)
  - note-editor toolbar (org.schedule NotesEditor on a booking/session)
answers_within_5s:
  - How do I change how the editor behaves (formatting, media, audio defaults)?
primary_action: Change an editor preference (each toggle/choice saves immediately)
secondary_actions:
  - Reset editor preferences to defaults
exits:
  done: "returns to the invoking editor with the draft intact and prefs applied — tutor.notes or org.schedule depending on entry"
completion_returns_to: the invoking screen (tutor.notes or org.schedule); this surface never navigates anywhere else
back_behavior: "Modal dismiss / stack pop = done. Editing context (draft text, cursor) must survive the round trip."
failure_paths:
  pref_persist_failed: toggle reverts visibly with inline error; editor remains usable with prior prefs
cross_role_propagation: []
cross_device_continuity: "Prefs are per-device durable view preferences (MMKV native / localStorage web via the platform-forked store) — intentionally NOT synced; an editor should feel the same as it was left on that device."
max_interactions_to_primary: 1
state_owner: "Existing: `features/editor/preferences.store.*` (shared/native/web forks). No [add] needed."
```

**Status:** CONTRACTED over PARTIAL screen (D: `sys.editor-settings` PARTIAL — mobile `/editor-settings` exists, web equivalent MISSING; D action "add web equivalent or justify mobile-only").

**Notes:**
- Contract resolution of D's open question: **build the web equivalent** — the draft-approval editor (tutor.notes web `/report-queue`) is a primary work surface and its toolbar needs the same entry; mobile-only cannot be justified while the queue is web-reachable.
- This is chrome-adjacent preference UI: it never carries account, plan, or notification settings (those are sys.settings / PW-05 territory) and never appears in any nav — toolbar entry only.
