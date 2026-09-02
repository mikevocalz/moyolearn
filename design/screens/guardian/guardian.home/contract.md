# Flow Contract — guardian.home (family feed)

```yaml
screen_id: guardian.home
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "tab: Home — tab 1 of the reconciled 4-tab set Home · Reports · Alerts · Family (G §1.2)"
  - "system: cold launch via sys.dispatch — guardian shell root"
  - "flow: FD-15 'You're set' — guardian onboarding lands on the family feed (doc 38 §1.1)"
  - "back_from: guardian.report-detail, guardian.calendar, guardian.ai-activity"
  - "system: push notification 'new report' deep-links into this shell (fan-out missing today — J1 finding 6)"
answers_within_5s:
  - "Are my kids okay?"
  - "What's new since I last looked?"
  - "What's coming up this week?"
primary_action: "Open the newest report — the top child-card CTA (→ guardian.report-detail)"
secondary_actions:
  - "Switch active child (child-switcher chips, doc 36 §3.2)"
  - "See upcoming (→ guardian.calendar)"
  - "Manage a child (→ guardian.family)"
exits:
  open_newest_report: guardian.report-detail
  all_reports: guardian.reports
  incident_banner: guardian.alerts
  see_upcoming: guardian.calendar
  manage_child: guardian.family
  trial_ending_card: PW-02
completion_returns_to: self (feed — landing screen)
back_behavior: "Shell root: Android back exits the app; never leaves the guardian shell."
failure_paths:
  offline: "Cached feed with sync timestamp; report cards open cached reports; incident banner still renders from cache (safety visibility degrades last)."
  no_data: "No children yet → single action 'Add your learner' (→ FD-12 via ?index=n); no sessions yet → 'Waiting for the first session' card with handoff pointer (FD-14 recap)."
  permission: "Sees own children only (Guardianships); another family's deep link dies silently (sys.not-found)."
cross_role_propagation:
  - "Inbound: learner.tutor sessions → child cards + newest-report CTA; incidents → banner (doc 31 channel)"
  - "Outbound: entitlement cards (trialing 'Free month ends {date}' → PW-02) are guardian-only — nothing here ever reaches a learner surface"
cross_device_continuity: "Feed is server-backed; read-state on reports syncs so 'newest' means the same thing on phone and web."
max_interactions_to_primary: 1
state_owner: "family.store [add] — activeChildId + feed; child-switch state today lives only in ai-activity.store, the wrong home (E §5 G-8)"
```

**Status:** Route EXISTS — `/(guardian)/(tabs)/family-home` + web `/family`, classified COMPLETE.

**Notes:**
- **Fixture children:** `parent-home.data.ts` hardcodes Maya/Jordan; mastery never reaches this screen (J1 finding 5); replace before the feed can honor this contract.
- **Child switching does not exist (G-8):** `ActiveContext.learnerId` is never set; the child-switcher chips are the doc-36 §3.2 requirement this contract binds; every "per child" cell downstream routes through this missing seam (J2's guardian.child [M] is out-of-inventory — child detail grounds to guardian.family until a row exists).
- Entitlement cards read `entitlement.status` only (doc 38 §5B), never purchase results; `past_due` renders a non-blocking banner → PW-05, never a lockout.
- Incidents surface as a banner routing to guardian.alerts — never inline detail here, never a bell (doc 36 §3.2).
