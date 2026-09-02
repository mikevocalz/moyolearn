# Flow Contract — tutor.incidents

```yaml
screen_id: tutor.incidents
role: tutor
tenant: [app, org]
band: n/a
shell: tutor (web sidebar item, second rail group per doc 36 §3.3 — "Incidents (mine + my sessions)"; no mobile tab)
entry_points:
  - web sidebar "Incidents" (Cool rail, G §3.2 ✱-add row)
  - post-session prompt after the tutor files an intake ("View your report")
  - push "an incident you filed was actioned" (notification layer unbuilt; contract requires it)
answers_within_5s:
  - What incidents have I filed, and where are they in the lifecycle?
  - Did anything I flagged get actioned or resolved?
  - Do I need to add anything to an open incident?
primary_action: Open an incident (read its append-only timeline and current lifecycle state)
secondary_actions:
  - File an incident (doc 31 §5.1 human intake — no severity choice on intake, redpen appears nowhere on the form)
  - Append a note to an incident I filed (append-only; never edit or delete)
  - Filter by status (new→triaged→in-review→actioned→resolved→closed)
exits:
  open_incident: tutor.incidents (detail view of the same surface)
  file_intake: tutor.incidents (intake sheet over the list; submit returns to the list with the new incident visible)
  back_to_work: tutor.today
completion_returns_to: tutor.incidents list (after filing or annotating); tutor.today when leaving the surface
back_behavior: "Detail/intake → list → previous rail destination (browser history on web). Never traps."
failure_paths:
  intake_submit_failed: form state preserved, inline error + retry — a safety report must never be silently lost
  queue_fetch_failed: inline retry
  empty: "'No incidents' with a one-line reminder of how to file one — filing stays reachable from the empty state"
  scope_denied: an incident outside "mine + my sessions" is simply absent from the list; a deep link to one resolves to not-found (silent drop, doc 36 §4.4)
cross_role_propagation:
  - tutor intake → org.safety (the incident enters the org triage queue; org owns assignment and lifecycle actions)
  - lifecycle changes made in org.safety → this list's status pills (read-only reflection)
  - S3/S4 with guardianVisible → guardian alerts/incident view (travels doc 31's channel; the tutor never controls guardian visibility)
cross_device_continuity: "Server truth end to end (incidents.service, append-only timeline). Web-first; if a mobile surface ships later it reads the same projections."
max_interactions_to_primary: 1 (click an incident row)
state_owner: "[add] scope=mine filter over the existing safety queue read path (`features/safety/use-incident-queue.ts` + `queue-view.ts` + `/api/safety/incidents`) — same store family as org.safety, narrower scope; plus [add] intake form state (doc 31 §5.1 — 'the intake forms still have no screen')."
```

**Status:** CONTRACTED over MISSING screen (D: `tutor.incidents` MISSING — "Build web view scoped to own sessions (doc 31 lifecycle)").

**Notes:**
- Scope is a permission boundary, not a filter preference: "mine + my sessions" only (doc 36 §3.3, E matrix). Triage, assignment, and severity live in org.safety — this screen reads lifecycle, appends notes, and files intakes.
- Intake law (doc 31): no severity selector, no red framing; severity is decided downstream by triage.
- No badge anywhere for incident counts (same doc 31 §5.3 reasoning as the org Safety tab).
