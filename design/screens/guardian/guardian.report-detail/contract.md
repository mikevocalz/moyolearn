# Flow Contract — guardian.report-detail (one session report, doc 34)

```yaml
screen_id: guardian.report-detail
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "push: from guardian.reports open_report (list → detail)"
  - "push: from guardian.home open_newest_report (primary CTA)"
  - "system: 'new report' push notification deep link (notify layer unbuilt — J1 finding 6)"
  - "tab: tablet pane — detail pane of Reports|report (doc 37 §3.3)"
answers_within_5s:
  - "What did my child work on?"
  - "Did they move — and where are they still working?"
  - "What should we do next?"
primary_action: "Read the report — eight blocks, fixed order, block-3 accordion all groups open by default (doc 34)"
secondary_actions:
  - "Share with teacher (tokened read-only link, blocks 1–6+8 → share.report)"
  - "Talk about it / act on the next step (→ guardian.family controls for the child)"
exits:
  share_with_teacher: share.report
  act_on_child: guardian.family
  back_to_trail: guardian.reports
completion_returns_to: guardian.reports
back_behavior: "Push: back pops to guardian.reports (or guardian.home if entered from the feed CTA). Tablet: detail pane closes to the list; list pane wins on collapse."
failure_paths:
  offline: "Cached report renders fully (report bodies are static once published); share-link generation queues."
  no_data: "A report renders only what is evidence-linked — a claim without evidence doesn't render (doc 34); a missing report id → silent return to guardian.reports (sys.not-found behavior)."
  permission: "Own children's reports only; a mismatched sessionId dies silently. Share tokens are read-only, noindex, revocable."
cross_role_propagation:
  - "share_with_teacher mints the teacher-facing share.report page (the ONLY working teacher-facing surface today — J1)"
  - "Inbound: human/hybrid reports carry tutorApprovedBy from the tutor.notes queue"
cross_device_continuity: "Read-state syncs; the report itself is identical everywhere; scroll position is not preserved (short document, by design)."
max_interactions_to_primary: 0
state_owner: "AdaptivePanes per-instance store (useInstanceStore) — pane selection only; report content is server state (React Query), no global store fits and none is needed"
```

**Status:** Route EXISTS — `/(guardian)/reports/[sessionId]` + web `/reports/[sessionId]`, classified COMPLETE.

**Notes:**
- `max_interactions_to_primary: 0` — the primary action is reading; the screen opens already delivering it (block order fixed, accordion open).
- Doc-34 laws bind the render: movement vs position never conflated; trajectory language (`solved on their own` grade-green · `solved with help` graphite · `still working on it` highlighter), never pass/fail; redpen only for a wrong answer submitted as done; never engagement-metrics-as-wins, ability praise, grade predictions, or comparisons.
- **No safety content here, ever** — incidents travel doc 31's channel to guardian.alerts. A report that mentions an incident is a defect.
- Share page (`share.report`) already conforms: blocks 1–6+8, no shell, noindex.
