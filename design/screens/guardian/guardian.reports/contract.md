# Flow Contract — guardian.reports (doc-34 report trail)

```yaml
screen_id: guardian.reports
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "tab: Reports — tab 2 of the reconciled 4-tab set (G §1.2 wires this orphan as a tab per doc 36 §3.2)"
  - "push: from guardian.home all_reports"
  - "back_from: guardian.report-detail"
  - "system: weekly-digest push deep-links here (notify layer unbuilt — J1 finding 6)"
answers_within_5s:
  - "What sessions happened, per child?"
  - "Which reports haven't I read yet?"
primary_action: "Open a report (→ guardian.report-detail; on tablet the detail renders in the Reports|report pane, doc 37 §3.3)"
secondary_actions:
  - "Filter by child (child-switcher, shared with guardian.home)"
exits:
  open_report: guardian.report-detail
  child_context: guardian.family
completion_returns_to: self (list — reading a report returns here)
back_behavior: "Tab: back returns to guardian.home. Tablet: AdaptivePanes Reports|report — collapse by width class, primary (list) pane wins on collapse, selection survives the fold (doc 37 §3.2)."
failure_paths:
  offline: "Cached report list + cached report bodies readable; unread badges from last sync."
  no_data: "No sessions yet → same 'waiting for the first session' state as guardian.home, pointing at handoff (FD-14 recap), not an error."
  permission: "Own children only (Guardianships); reports never contain safety content — incidents travel doc 31's channel to guardian.alerts, never here (doc 34)."
cross_role_propagation:
  - "Inbound: AI sessions publish directly; human/hybrid sessions arrive only after tutor approval (tutorApprovedBy, tutor.notes queue)"
cross_device_continuity: "Read/unread state syncs across devices; tablet pane selection is device-local by design (per-instance store)."
max_interactions_to_primary: 1
state_owner: "AdaptivePanes per-instance store (useInstanceStore) for pane selection — existing pattern via ReportsPaneScreen; list filters ride family.store [add]'s activeChildId"
```

**Status:** Route EXISTS on mobile — `/(guardian)/(tabs)/reports` (`ReportsPaneScreen`) — but classified **ORPHAN**: not in the guardian ITEMS array, reachable only by one push from the family screen. Web: **MISSING** — root `/reports` is now institution-scoped and 404s on the app host.

**Notes:**
- **Orphaned tab:** doc 36 §3.2 says Reports IS a tab; G §1.2's reconciled target wires it. This contract assumes the reconciled 4-tab shell.
- **Web nav collision:** `NAV_BY_ROLE.guardian` still points Reports at the institution-scoped `/reports` → 404 on app host (D row). Restore a guardian web reports list route and fix the collision before the web entry_point is real.
- One of only 2 AdaptivePanes consumers — reuse the compound API as-is (G §5 adoption note), do not fork.
- Reports and Alerts are separate surfaces by law: nothing incident-shaped renders in this list.
