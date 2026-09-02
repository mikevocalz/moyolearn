# Flow Contract — guardian.messages (DISPOSITION: REMOVE — no messaging surface exists)

```yaml
screen_id: guardian.messages
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "tab: Messages — tab 4 of the SHIPPED (non-conforming) 5-tab set; removed under the reconciled 4-tab set (G §1.2: 'Messages must go regardless of ADR')"
answers_within_5s:
  - "(the label lies — the screen renders NotificationsScreen, not messages; no question it claims to answer is answered)"
primary_action: "n/a — REMOVED. Content migrates: incidents → guardian.alerts; general notification traffic → push + guardian.home feed cards; no in-app messaging surface exists or is contracted"
secondary_actions: []
exits:
  incidents: guardian.alerts
  everything_else: guardian.home
completion_returns_to: guardian.home
back_behavior: "n/a after removal; until removed, back returns to guardian.home."
failure_paths:
  offline: "n/a — removed"
  no_data: "n/a — removed"
  permission: "n/a — removed"
cross_role_propagation:
  - "none — a removed surface propagates nothing; tutor↔guardian communication has no secret channel by law (FR-9.2) and any future messaging product needs a new inventory row + product decision first"
cross_device_continuity: "n/a — removed"
max_interactions_to_primary: 0
state_owner: "notifications.store (existing — owns the NotificationsScreen content this tab currently aliases; the store survives, the tab does not)"
```

**Status:** Route EXISTS — `/(guardian)/(tabs)/messages` — classified **NEEDS-UX-REWORK**: "tab labelled Messages, renders NotificationsScreen — label lies; no messaging surface exists anywhere" (D row). Web: MISSING.

**Notes:**
- **Disposition, binding (no ADR can save it):** doc 36 §3.2 has no Messages tab, and G §1.2 rules "Messages must go regardless of ADR" — a real messaging tab would need both a product decision and a surface; neither exists. Remove the tab from ITEMS and delete the route.
- **Alerts ≠ Messages law:** incidents never mix with notification/message traffic (doc 36 §3.2, restated in guardian.alerts' contract). The current alias is exactly that mixing — a second reason this dies.
- The guardian layout comment citing "doc 36 §3.2: Home · Children · Calendar · Messages · Account" is a **fabricated citation** (G §1.2) — delete it with the tab.
- Non-incident notification needs (report-ready, booking changes) are served by the push layer (unbuilt — J1 finding 6) landing users on the owning surface (guardian.report-detail, guardian.calendar), never on a generic inbox.
