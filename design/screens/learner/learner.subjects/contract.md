# Flow Contract — learner.subjects

```yaml
screen_id: learner.subjects
role: learner
tenant: [app]
band: 3-5 · 6-8 · 9-12   # K–2 excluded (href: null on mobile; doc 36 §3.1 — K–2 has no Subjects tab)
shell: learner
entry_points:
  - "tab: Subjects — tab 2 on 3–5 (4-tab) and 6–12 (5-tab) shells (G §1.1)"
  - "push: from learner.home subject rows/cards (open_subject exit)"
  - "back_from: learner.tutor (subject-scoped session end)"
answers_within_5s:
  - "What subjects can I get help with?"
  - "Where is the subject I'm working on?"
primary_action: "Open a subject — starts subject-scoped coached work with Natalie (→ learner.tutor)"
secondary_actions:
  - "Snap homework instead (raised center tab → learner.capture)"
exits:
  open_subject: learner.tutor
  snap: learner.capture
  free_limit_hit: PW-03b
completion_returns_to: self (browse hub)
back_behavior: "Tab: back returns to learner.home (tab history); never leaves the shell. Single-pane at every width."
failure_paths:
  offline: "Cached catalog renders read-only; opening a subject queues the session start with band-voiced copy; Snap stays available."
  no_data: "Empty catalog = curated default subject set (catalog is product-curated, so true-empty should be unreachable; if it occurs, show Snap as the single action)."
  permission: "K–2 must never reach this surface: mobile enforces via href:null; web `/subjects` needs a band guard with a fallback to learner.home (defect, see Notes)."
cross_role_propagation:
  - "Subject opened here scopes the session whose report reaches guardian.reports (doc 34 subject attribution)"
cross_device_continuity: "Catalog is stateless/server-backed; no local selection to carry. Any session started continues under learner.tutor's continuity contract."
max_interactions_to_primary: 1
state_owner: "explore.store (existing — features/explore; currently a fixture catalog, see Notes)"
```

**Status:** Route EXISTS — `/(learner)/(tabs)/subjects` + web `/subjects`, classified COMPLETE.

**Notes:**
- **Web band hole: CLOSED 2026-09-02.** `/subjects` was reachable by K–2 by URL with no fallback (C §Web; D row action) — `href:null` has no web equivalent. `(site)/subjects/layout.tsx` now wraps the route in `BandGate`, which derives in-band-ness from `HOT_NAV_LEARNER_BY_BAND` so nav and guard cannot drift, and `replace`s an off-band learner to `/` (the silent fallback this contract asked for; `replace`, so the off-band URL leaves no history for Back to resurface). VERIFIED: `?persona=maya` (young) lands on `/`; `?persona=jordan` (child) renders the catalog. K–2 links to this surface from nowhere — the young band's nav list carries Today · Snap · My Stuff and no Subjects row — so the guard only ever answers a typed URL, never a rendered nav item.
- `explore.store` is the fixture catalog (generic "Design/Dev/Business" categories, `FEATURED` fixtures) — replace with the real subject catalog; the store is the right owner, its contents are not.
- No search affordance on any band at this screen size-class; K–2 excluded entirely (doc 36 §3.1 bans learner search below 3–5 and the shell ships none).
- Learner surface: no prices ever; the only limit surface is PW-03b.
