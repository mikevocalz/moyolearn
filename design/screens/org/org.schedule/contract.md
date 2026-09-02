# Flow Contract — org.schedule

```yaml
screen_id: org.schedule
role: owner, staff
tenant: [org]
band: n/a
shell: org (mobile companion tab 2; web rail Scheduling group — "Calendar (resource-major)" per doc 36 §3.4)
entry_points:
  - "tab: Schedule (mobile `/(org)/(tabs)/schedule`); rail: Scheduling → Calendar (web `/schedule`)"
  - "push: from org.overview exception cards (handle_cancellation / handle_unassigned arrive focused on the affected slot)"
  - "push: from org.crm 'enrolled_book_sessions' (family pre-selected in the booking form)"
  - "push: from org.inbox item ('reschedule request' opens the affected session)"
answers_within_5s:
  - "Who is teaching what, where, right now and today (resource-major view)?"
  - "Where are the open slots for this tutor/room?"
  - "Which sessions are unassigned or conflicted?"
primary_action: "Book or move a session (BookingForm on a slot; drag to move via EventDrag)"
secondary_actions:
  - "Assign a tutor to an unassigned session"
  - "Cancel a session (with guardian-notification consequence stated inline)"
  - "Add a session note (NotesEditor; sys.editor-settings reachable from its toolbar)"
exits:
  booked_or_moved: org.schedule        # calendar reflects the change in place
  editor_preferences: sys.editor-settings
  back_overview: org.overview
completion_returns_to: self (the calendar, scrolled to the affected slot)
back_behavior: "Booking form / event detail → calendar → tab root (mobile) or previous rail destination (web)."
failure_paths:
  offline: "calendar renders last-synced read-only; booking/move disabled with reason"
  no_data: "no sessions yet → empty week with 'Book a session' live (and, if no families exist, an exit to org.crm to enroll one first)"
  permission: "org-scoped; all staff can view; booking/canceling is staff-wide today (no organizationRole gate on screen — E matrix)"
  double_booking: "conflict is REJECTED with the conflicting session shown — doc 28 §5's zero-double-booking invariant; the slot solver is unbuilt [M], so until it ships the server-side conflict check is the contract's minimum bar"
  booking_write_failed: "optimistic placement rolls back visibly; form state preserved for retry"
cross_role_propagation:
  - "booking/assignment → tutor.today (assigned tutor's timeline gains the session)"
  - "booking/cancellation → guardian.calendar (family calendar updates) — notification hop unbuilt (F finding 3)"
  - "session completion → tutor.notes (draft) → org.money (payable work), downstream of this screen"
cross_device_continuity: "Calendar is server truth; view window (day/week, resource filter) is device-local. Mobile companion shows the same calendar slimmed for triage-on-the-go; heavy booking work is web-first."
max_interactions_to_primary: 2 (pick a slot → confirm booking)
state_owner: "Existing: features/schedule/store.ts (+ model/slots/reschedule/EventDrag machinery) — [add] replace DEMO_DAY fixtures (schedule/fixtures.ts) with live sessions and wire BookingForm writes (D's proposed action)."
```

**Status:** PARTIAL (D: `org.schedule` — real UI on `DEMO_DAY` fixtures; wire `BookingForm`; doc 28 §5 slot solver + zero-double-booking invariant MISSING).

**Notes:**
- Resource-major is the binding orientation (doc 36 §3.4): columns are tutors/rooms, not clients.
- This screen is J6's hinge: CRM enrollment flows in, tutor/guardian calendars flow out. Both outbound propagations exist only as server writes until the notification layer ships.
- The tutor-side view of the same data is tutor.today (own sessions only); tutors never see this org-wide calendar (E matrix scope).
