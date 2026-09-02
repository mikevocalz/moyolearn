# Flow Contract — org.inbox

```yaml
screen_id: org.inbox
role: owner, staff
tenant: [org]
band: n/a
shell: org (mobile companion tab 3; web `/notifications` in the staff nav — G §3.2 folds it under the rail's first group with Overview)
entry_points:
  - "tab: Inbox (mobile `/(org)/(tabs)/inbox`); web `/notifications` (staff nav)"
  - "push: from org.overview 'inbox' secondary"
  - "system: push notification for an inbox item (reschedule request, payment issue notice) — fan-out unbuilt (F finding 3)"
answers_within_5s:
  - "What messages/requests are waiting on the org?"
  - "Which items are unhandled vs done?"
primary_action: "Triage the top inbox item (open it, act where it lives)"
secondary_actions:
  - "Mark an item handled/dismissed"
  - "Filter by kind (requests / system notices)"
exits:
  reschedule_request: org.schedule    # the item's action happens on the calendar
  billing_notice: org.money           # payment-failure / invoice notices act in Money (owner/finance)
  lead_reply: org.crm                 # a lead's message acts on the pipeline record
  back_overview: org.overview
completion_returns_to: self (list — handled items clear; next item surfaces)
back_behavior: "Item detail → inbox list → tab root / previous rail destination."
failure_paths:
  offline: "last-synced list read-only; actions disabled with reason"
  no_data: "'Inbox zero' calm state with a live exit to org.overview — never a bare empty screen"
  permission: "org-scoped; items whose action target is owner-gated (Money) render for staff with a 'needs an owner' handoff instead of a dead button"
cross_role_propagation:
  - "guardian/tutor-originated requests → inbox items (inbound)"
  - "triage actions → org.schedule / org.crm / org.money state, which then propagates outward per those contracts"
cross_device_continuity: "Inbox is server truth (read/handled state syncs); triage on mobile clears the web list."
max_interactions_to_primary: 1 (open the top item)
state_owner: "Existing: features/notifications/notifications.store.ts — [add] org-scoped notification wiring (D's proposed action: 'wire org-specific notifications')."
```

**Status:** COMPLETE surface, PARTIAL wiring (D: `org.inbox` COMPLETE — "wire org-specific notifications").

**Notes:**
- **Safety separation is binding:** incidents NEVER route through this inbox and no safety counts render here — doc 31's channel is org.safety exclusively, and doc 36 §3.4 keeps Safety its own unbadged tab. An incident-shaped item appearing in the inbox is a contract violation.
- Every inbox item must carry an action exit into the surface where it is handled (schedule/CRM/money) — an item with no action target is a dead end and may not ship.
