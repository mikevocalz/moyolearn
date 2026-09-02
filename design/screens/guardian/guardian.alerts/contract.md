# Flow Contract — guardian.alerts (incidents + acknowledgments)

```yaml
screen_id: guardian.alerts
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "tab: Alerts — tab 3 of the reconciled 4-tab set; its own tab so serious things never hide under a bell (doc 36 §3.2, G §1.2)"
  - "system: S3/S4 incident push notification deep link (fan-out missing — J8 'guardian notified [M]')"
  - "push: from guardian.home incident_banner"
answers_within_5s:
  - "Did something serious happen?"
  - "Has it been handled — and by whom?"
  - "Do I need to do anything?"
primary_action: "Acknowledge an incident (writes guardianAcknowledged — the service field exists, no UI writes it today)"
secondary_actions:
  - "Open an incident's detail (in-screen: fixed order What happened → What the tutor did → What happens next → Talk about it, doc 31)"
  - "Adjust the child's controls afterwards (→ guardian.family)"
exits:
  adjust_controls: guardian.family
  child_context: guardian.family
completion_returns_to: self (list — acknowledged incidents stay visible, append-only)
back_behavior: "Tab: back returns to guardian.home. Incident detail is an in-screen state of this surface (no separate inventory row), so back from detail returns to the Alerts list."
failure_paths:
  offline: "Cached incidents readable in full (safety visibility degrades last); acknowledgment queues with explicit 'will send when online' state — never silently."
  no_data: "'Nothing needs your attention' — calm, explicit, dated; an empty Alerts tab is a feature, not a blank."
  permission: "Own children's incidents only (guardianVisible default true for S3/S4); transcript excerpts are permission-gated references, never copies (doc 31)."
cross_role_propagation:
  - "Acknowledgment writes to the incident's append-only timeline → visible in org.safety triage (same projections)"
  - "Inbound: S3 (48h SLA) and S4 (2h SLA, human paged) incidents from learner.tutor sessions via the doc-31 ladder"
cross_device_continuity: "Incident state + acknowledgment are server-backed; an ack on phone clears the urgency on web immediately."
max_interactions_to_primary: 2
state_owner: "alerts.store [add] — optimistic ack + read-state; no existing store maps to a guardian safety surface (safety feature stores are org-queue-side)"
```

**Status:** Route EXISTS on mobile — `/(guardian)/(tabs)/alerts` — but classified **ORPHAN**: not in ITEMS, no push anywhere, and the file **aliases NotificationsScreen** (wrong content). Web `/notifications` exists as the nav target. The guardian incident *view* is MISSING (J8).

**Notes:**
- **The most inverted defect in the product (J8):** the guardian half of the incident channel is server-complete and screen-absent — `GuardianIncidentView` projection + `/api/guardian/incidents` exist (incl. `whatTheTutorDid`), but an S3 incident today reaches the org queue while **no parent can see it**. This contract is the fix's spec: wire the tab (G §1.2), render the projection in doc-31 fixed order, write `guardianAcknowledged`.
- **Alerts ≠ Messages/Notifications (law):** this surface carries incidents and acknowledgments only — never under a bell, never mixed with general notifications (doc 36 §3.2; guardian.messages contract records the notifications disposition). The current NotificationsScreen alias violates this.
- No red page-frames; severity never floods a row (doc 31 screen constraints).
- Push fan-out (OneSignal) is unbuilt — until then the deep-link entry_point is aspirational and the tab is the only real path.
