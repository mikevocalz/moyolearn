# Flow Contract — guardian.calendar (family schedule)

```yaml
screen_id: guardian.calendar
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "push: from guardian.home see_upcoming (stack route — NOT a tab under the reconciled 4-tab set; G §1.2 / ADR-a default: 'doc 36's 4 tabs; Calendar = stack route')"
  - "push: from guardian.family see_child_schedule"
answers_within_5s:
  - "What's coming up for the family this week?"
  - "When is each child's next session?"
primary_action: "Review the week — scan upcoming sessions per child"
secondary_actions:
  - "Open the child behind an event (→ guardian.family)"
  - "Read the report of a past event (→ guardian.report-detail)"
exits:
  open_child: guardian.family
  past_event_report: guardian.report-detail
completion_returns_to: guardian.home
back_behavior: "Stack route: back pops to guardian.home or guardian.family (origin). Moves out of `(tabs)` per the reconciliation."
failure_paths:
  offline: "Cached week renders with sync timestamp; no edits exist here yet, so offline is read-only by nature."
  no_data: "Nothing scheduled → calm empty state; if J2's booking flow ships, this state gains the 'book a session' entry (out of contract until those inventory rows exist)."
  permission: "Own family's events only (Guardianships)."
cross_role_propagation:
  - "Inbound only today: org.schedule bookings and session events should populate this calendar (currently fixtures — see Notes)"
cross_device_continuity: "Server-backed events; identical week on phone and web."
max_interactions_to_primary: 0
state_owner: "family-calendar.store (existing — features/family-calendar)"
```

**Status:** Route EXISTS — `/(guardian)/(tabs)/calendar` + web `/family-calendar`, classified COMPLETE — but the mobile route must move out of `(tabs)` (G §1.2) and web `/family-calendar` has **no web nav entry** (D row).

**Notes:**
- **ADR-a:** keeping Calendar as a 5th tab requires an ADR; this contract adopts the default (stack route, 4-tab shell). If ADR-a lands otherwise, only entry_points/back_behavior change.
- **Fixture data:** `FAMILY_DAYS` is a fixture — wire real events (D row action). J2 shows the booking middle (discovery → booking → confirmation) does not exist; this calendar is the built end of a journey with a missing middle.
- Web entry: contract requires a "See upcoming" entry from the web family feed (mirror of mobile), not a top-nav slot — guardian web top-nav is bound to the 4-label set (G §3.1).
- `max_interactions_to_primary: 0` — reviewing is delivered on open.
- guardian.family-calendar (`/(guardian)/family-calendar`) is a DUPLICATED route of this screen — see its disposition contract; delete and repoint its one push here.
