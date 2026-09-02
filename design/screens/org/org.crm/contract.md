# Flow Contract — org.crm

```yaml
screen_id: org.crm
role: owner, staff
tenant: [org]
band: n/a
shell: org (web-first by design — CRM rail group `Leads · Families · Enrollment` per doc 36 §3.4; NO mobile tab: the mobile companion is Overview·Schedule·Inbox·Safety only)
entry_points:
  - "rail: CRM group (web — Leads / Families / Enrollment items, split from the current one-blob /ops per G §3.2)"
  - "push: from org.overview 'crm' rail jump"
  - "deep_link: shared/bookmarked view URL (filters, sort, saved view live in search params — shareable by design)"
answers_within_5s:
  - "Where is each lead in the pipeline?"
  - "Which leads are stalling (trial-centric stages)?"
  - "Which families are enrolled and which are mid-conversion?"
primary_action: "Move a lead through stages (drag on the board view / stage action on the table view)"
secondary_actions:
  - "Open a lead/family record (contact, notes, stage history — business data only)"
  - "Switch view: board ⇄ table (doc 28 §3 'kanban by stage'; LIVE — SegmentedControl in the pipeline toolbar, board rendered by leads-board.tsx over ui/stage-board's StageBoard)"
  - "Complete an enrollment (Enrollment section of the same group)"
exits:
  stage_change: org.crm            # optimistic write via use-stage-action + applyStageChange reducer; stays on the pipeline
  enrolled_book_sessions: org.schedule   # the J6 arrow: pipeline must not end at 'Enrolled' — enrollment hands off to scheduling
  enrolled_invoice: org.money      # billing setup for the newly enrolled family
  back_overview: org.overview
completion_returns_to: self (pipeline — a moved lead lands in its new stage in view)
back_behavior: "Record detail → pipeline view → previous rail destination (browser history; view state survives via URL params)."
failure_paths:
  offline: "board/table render last-synced; stage changes disabled (no offline queue for CRM writes)"
  no_data: "empty pipeline → 'Add your first lead' live from the empty state"
  permission: "org-scoped (ctx.orgId); staff and owner see the same CRM (no organizationRole distinction on screen today — E matrix)"
  stage_write_failed: "optimistic move rolls back visibly with inline error + retry (use-stage-action semantics)"
cross_role_propagation:
  - "enrollment completion → org.schedule (family becomes bookable) and org.money (family becomes invoiceable)"
  - "NOTHING propagates to or from learner/guardian surfaces — see wall below"
cross_device_continuity: "Pipeline is server truth. View mode + density/columns are durable per-device prefs (ops.prefs.store); filters/sort/saved-view travel in the URL, so a shared link reproduces the exact view on any device."
max_interactions_to_primary: 1 (drag a card / stage action on a row)
state_owner: "Existing, and BINDING — the board and the table are two views over the SAME store, never two stores: server truth via /api/ops/leads(+[id], +[id]/stage, POST create) with applyStageChange + use-stage-action (optimistic writes); RoleShell owns the org chrome (the ops-private sidebar store, useOpsChrome, retired with it — nothing read its section state); createOpsPrefsStore (ops.prefs.store.*) owns durable density/columns AND the viewMode ('table' | 'board') key — landed there, not in a new store; URL search params own filters/sort/saved views (doc 28 §3)."
```

**Status:** PARTIAL (D: `org.crm` — the rail group is LIVE: the pipeline table moved whole to `/leads` with route-based record detail (`/leads/[leadId]`) and a live Add-lead door; `/families` ships the interim server-derived grouping over leads (doc 28 §2's Family/GuardianContact objects remain unbuilt — a future ADR builds the household record and makes rows openable); `/enrollment` reframes the stage machinery with the J6 book-sessions exit live and the invoicing exit pending org.money. The doc 28 §3 kanban board is **LIVE as a view**: `viewMode ('table' | 'board')` persists in `ops.prefs.store` beside density/columns (the state_owner's mandated spot), the board renders in `leads-board.tsx` over `ui/stage-board`'s StageBoard, drag commits through the same `applyStageChange`/`use-stage-action` optimistic write with the table's stage menu on every card as the accessible fallback, both faces share one toolbar and the URL's filter state, the board pages the table's cursor pages, and 'At risk' stays scorer-owned — `boardStageChange` refuses any drop into it).

**Notes:**
- **The wall (doc 23 / doc 31 / PRD principle 9, lint-enforced):** the CRM never reads learner data and never reads incidents. This contract therefore declares **no exits** into learner content, reports, or org.safety, and no CRM record may render learner session data, mastery, transcripts, or incident existence. Family records here are business objects (contacts, stage, billing linkage via LearnerRef only — FR-13.2). Any future exit proposal from a CRM screen into learner content is a contract violation, not a design choice.
- Board-view law: the board is a *view*, not a screen — same store, same URL-param filter state, same stage-change reducer. Switching views must never lose filters or selection.
- The J6 dead end this contract closes: `Enrolled` now exits to org.schedule (booking) and org.money (invoicing) instead of terminating. Doc 28 §4's stage automations remain unbuilt and out of this contract's scope.
