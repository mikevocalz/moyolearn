# Flow Contract — org.overview

```yaml
screen_id: org.overview
role: owner, staff (shared org shell — shellForRole maps both)
tenant: [org]
band: n/a
shell: org (mobile companion tab 1 of `Overview · Schedule · Inbox · Safety`; web rail destination in the doc-36 §3.4 grouping `Overview · CRM · Scheduling · Money · Safety · Settings`)
entry_points:
  - "system: cold launch via sys.dispatch (last-used shell = org)"
  - "tab: Overview (mobile `/(org)/(tabs)/overview`); rail: Overview (web `/ops`, `/tutoring/[orgSlug]` → 307)"
  - "flow: FD-20→22 owner onboarding completion lands here"
  - "push: ContextSwitcher shell swap (solo tutor's owner hat; staff multi-hat)"
answers_within_5s:
  - "What is broken today (cancellations, unassigned sessions, overdue items)?"
  - "What is happening today (sessions, arrivals)?"
  - "Is anything waiting in Safety or the Inbox?"
primary_action: "Handle today's top exception (open it where it lives — a cancellation opens rebooking, an unassigned session opens assignment)"
secondary_actions:
  - "Open the schedule (→ org.schedule)"
  - "Open the inbox (→ org.inbox)"
  - "Jump to a rail group (CRM / Money / Safety / Settings — web)"
exits:
  handle_cancellation: org.schedule    # rebook/move the affected session
  handle_unassigned: org.schedule      # assign a tutor to the session
  safety_exception: org.safety         # an unassigned-S4 surfaces here as the ONLY interrupt (doc 31 §5.3)
  inbox: org.inbox
  crm: org.crm
  money: org.money                     # STRUCK 2026-09-02 — org.money's contract carries the disposition; the rail renders no Money group (nav.ts records the strike). The exit stays as the record of doc 36 §3.4's grouping and goes live with the Stripe Connect build; do not design against it.
  settings: sys.settings               # rail Settings group — now the built org surface at /settings/org (org.settings contract: identity + plan, owner/finance only); plan ACTION rows stay PW-05/PW-08 (doc 38) and land there when Stripe mounts
completion_returns_to: self (hub — handled exceptions clear from the list and the next one surfaces)
back_behavior: "Shell root: system back leaves the app (Android); web follows browser history. The S4 interrupt is dismissible only into org.safety — acknowledged, never ignored."
failure_paths:
  offline: "last-synced exception list read-only with staleness label; actions disabled with reason"
  no_data: "clean day → 'Nothing needs you' with live exits to org.schedule and org.crm — a calm state, not a dead end"
  permission: "staff and owner share the surface (guard admits owner || staff, E matrix); Money and Settings rail items render for owner/finance only (billing-plans authorize)"
cross_role_propagation:
  - "tutor cancellations / guardian booking changes → this exception list (inbound)"
  - "exception resolution → tutor.today (reassigned tutor's timeline updates) and guardian.calendar (rebooked family sees the change)"
cross_device_continuity: "Exceptions are server truth. Web is the full ops surface; the mobile companion renders the SAME exception list slimmed (doc 36 §3.4) — D's action: the current mobile companion wrongly renders the full web CRM and must slim to exceptions."
max_interactions_to_primary: 1 (top exception card)
state_owner: "Existing: useOpsChrome (features/ops/ops.store.ts — sidebar mode + active section) for chrome; [add] exceptions query replacing screen.shared.tsx demo data. Filters/sort stay in URL search params (ops store header comment's law: shareable state goes in the URL)."
```

**Status:** PARTIAL (D: `org.overview` — demo data in `ops/screen.shared.tsx`; mobile companion renders the full web CRM, slim to exceptions per doc 36 §3.4).

**Notes:**
- The rail this screen anchors is doc 36 §3.4's grouping verbatim: `Overview · CRM · Scheduling · Money · Safety · Settings` (G §3.2 split of the current one-blob `/ops`).
- Safety carries no badge anywhere in the shell (doc 31 §5.3 — unassigned-S4 is the only interrupt, and it interrupts as a surfaced exception, not a red count).
- The CRM wall is visible from here by construction: exception cards are ops objects (sessions, bookings, staffing) and never preview learner content or incident contents.
