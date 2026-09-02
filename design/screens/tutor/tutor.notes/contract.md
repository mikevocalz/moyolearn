# Flow Contract — tutor.notes

```yaml
screen_id: tutor.notes
role: tutor
tenant: [app, org]
band: n/a
shell: tutor (Notes tab — mobile `/(tutor)/(tabs)/notes` mounting `SummaryQueuePaneScreen`, web `/report-queue`)
entry_points:
  - Notes tab
  - tutor.today "Review draft queue" secondary action
  - tutor.learners "review this learner's draft" context link
  - push "draft ready for review" after a human/hybrid session (notification layer unbuilt; contract requires it)
answers_within_5s:
  - How many drafts are waiting on me?
  - Which one is oldest / closest to its guardian-visibility window?
  - What did the AI draft say about the session I just finished?
primary_action: Approve a draft (server writes `tutorApprovedBy` — required for human/hybrid, enforced in summary.service)
secondary_actions:
  - Edit the draft before approving (opens editor; sys.editor-settings reachable from its toolbar)
  - Suppress a draft (with reason; report never reaches the guardian)
  - Open the learner's trail for context (→ tutor.learners)
exits:
  approve: tutor.notes (queue advances to the next draft; approval confirmation names the propagation — "Report is now visible to {learner}'s guardian")
  edit_draft: tutor.notes (draft pane of the same AdaptivePanes surface — doc 37 `Notes queue | draft`, EXISTS)
  editor_preferences: sys.editor-settings (from the draft editor toolbar)
  learner_context: tutor.learners
  earnings_payoff: "tutor.earnings (post-approval affordance 'View earnings' — J5's missing payoff screen; see PROPOSED-NEW contract; until it ships the approval toast carries no link and the queue itself is the return point — no dead end)"
completion_returns_to: tutor.today when the queue empties ("All caught up" state offers the timeline); otherwise the queue itself
back_behavior: "Draft pane open + collapsed width: back closes draft to queue (selection survives fold, existing scoped store). Queue at tab root: standard tab-root back."
failure_paths:
  approval_write_failed: draft stays queued, inline error + retry; optimistic state rolls back
  queue_fetch_failed: inline retry on `/api/summary/queue`
  empty_queue: "'All caught up' with a live exit to tutor.today — never a bare empty state"
  suppress_needs_reason: suppress blocked until a reason is chosen; cancel returns to the draft intact
cross_role_propagation:
  - approval → guardian.reports + guardian.report-detail (the doc-34 report becomes guardian-visible; this is the J5→guardian handoff)
  - approval → tutor.earnings + org.money (approved session becomes payable work; earnings/payout ledgers accrue — propagation is server-side, screens read it)
  - suppression → guardian.reports (report never appears; suppression reason lands in the org-side audit trail, not the guardian's)
cross_device_continuity: "Queue and approval state are server truth (`/api/summary/queue`, summary.service) — approve on mobile, gone from the web queue. Draft selection is per-device scoped store, not synced (doc 37 §3.2)."
max_interactions_to_primary: 2 (select draft → Approve)
state_owner: "Existing: AdaptivePanes scoped selection store inside `SummaryQueuePaneScreen` (`features/summary/draft-queue-pane-content.tsx`) + server queue via `/api/summary/queue` and `summary.service.ts`. Editor prefs: `features/editor/preferences.store.*`. No [add] needed."
```

**Status:** CONTRACTED over COMPLETE screen (D: `tutor.notes` COMPLETE; one of AdaptivePanes' two real consumers).

**Notes:**
- This is the law-bearing screen of J5: the Notes queue exits into report approval, and approval propagates to guardian reports and to earnings. The contract makes both propagations explicit so the earnings chain stops terminating at "approved."
- `tutorApprovedBy` is server-enforced; the UI never renders a report as guardian-visible from an optimistic state.
- No safety content ever appears in drafts or reports (doc 34); incidents travel doc 31's channel (tutor.incidents / org.safety).
