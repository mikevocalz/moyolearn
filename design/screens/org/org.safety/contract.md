# Flow Contract — org.safety

```yaml
screen_id: org.safety
role: owner, staff
tenant: [org]
band: n/a (incidents reference learners; the queue shows lifecycle metadata, transcript excerpts only behind permission gates)
shell: org (mobile companion tab 4 — deliberately unbadged; web rail Safety group — view MISSING, build it; assignment stays web per D)
entry_points:
  - "tab: Safety (mobile `/(org)/(tabs)/safety`, no badge by design); rail: Safety → Incident queue (web — ✱ to build, G §3.2)"
  - "push: from org.overview 'safety_exception' (an unassigned-S4 surfaces on Overview as the shell's ONLY interrupt, doc 31 §5.3)"
  - "system: S4 page — a human is paged within the 2h SLA path (out-of-app pager/on-call, doc 31 §3.2); the page's link lands here"
answers_within_5s:
  - "Is there an unassigned S4 right now?"
  - "What is in the queue by severity and lifecycle state?"
  - "What is waiting on me (assigned to me / breaching SLA)?"
primary_action: "Triage the top incident (assign an owner + advance lifecycle new → triaged)"
secondary_actions:
  - "Open an incident's append-only timeline (add a triage note; never edit or delete)"
  - "Filter by severity / lifecycle state (new → triaged → in-review → actioned → resolved → closed)"
  - "Action an incident (record what was done — feeds the guardian view's 'What the tutor did / What happens next')"
exits:
  triage: org.safety              # queue advances; the assigned incident moves state in place
  back_overview: org.overview
completion_returns_to: self (queue — the next unhandled incident surfaces; an emptied queue offers org.overview)
back_behavior: "Incident detail → queue → tab root / previous rail destination. The unassigned-S4 interrupt dismisses only into this queue — acknowledged, never ignored."
failure_paths:
  offline: "queue renders last-synced READ-ONLY with a prominent staleness warning (stale safety data is dangerous data); triage writes require connectivity"
  no_data: "empty queue → calm 'No open incidents' with exit to org.overview"
  permission: "permission-denied state EXISTS on mobile (D) and is the model: excerpt access is permission-gated (references, never copies — doc 31); denied users see lifecycle metadata only"
  triage_write_failed: "assignment/state change rolls back visibly with retry; SLA clocks are server-side and unaffected by client failures"
cross_role_propagation:
  - "tutor intake (tutor.incidents) and in-session S3/S4 trips → this queue (the two intakes, one collection — doc 31)"
  - "triage/action updates → tutor.incidents status pills (the filer's read-only view)"
  - "S3/S4 with guardianVisible (default true) → guardian.alerts + the guardian incident view (fixed order What happened → What the tutor did → What happens next → Talk about it); 48h SLA for S3, 2h for S4"
  - "NEVER to org.crm — the CRM never reads incidents (doc 31/doc 23 wall)"
cross_device_continuity: "Queue and lifecycle are server truth (incidents.service, SLA hours from LADDER[severity]); mobile triages, web assigns (assignment stays web per D) — both read the same projections."
max_interactions_to_primary: 1 (top-of-queue incident → assign)
state_owner: "Existing: features/safety/use-incident-queue.ts + queue-view.ts over /api/safety/incidents (server truth: incidents.service.ts) — no new store; [add] the web Safety rail view mounting the same queue (D's build item)."
```

**Status:** PARTIAL (D: `org.safety` — mobile COMPLETE incl. permission-denied state; **web Safety sidebar view MISSING — build it**; assignment stays web).

**Notes:**
- Doc 31 §5.3 screen law, restated as contract: severity renders as a 3px border-left + pill, **never row-flooding**; no red page-frames; the tab carries **no badge** (the layout comment grounds it — counts-as-pressure is the failure mode); **unassigned-S4 is the only interrupt** anywhere in the org shell.
- Intake never happens here (intakes are the session pipeline + tutor.incidents' form, and intake has no severity choice); this queue is where severity is decided.
- The guardian half of this channel is server-complete and screen-absent (J8) — this contract's guardian propagation lands in the guardian.alerts / guardian incident-view contracts, not here; but triage actions must write the fields those views render (`whatTheTutorDid`, `whatHappensNext`).
