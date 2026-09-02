# Flow Contract — sys.dispatch

```yaml
screen_id: sys.dispatch
role: sys (all roles pass through)
tenant: [any]
band: all
shell: none — pre-shell boot surface; it selects a shell, it never renders one
entry_points:
  - "system: cold launch, mobile `/` (index.tsx)"
  - "system: web `/` (host-aware: app/org/school/district hosts each dispatch to their shell root)"
  - "back_from: nowhere — nothing navigates *to* dispatch; sys.not-found redirects through it"
answers_within_5s:
  - "None — the user should never dwell here; the answer is landing in the right shell without choosing"
primary_action: "Land in the last-used shell (resolveBootRole + SHELL_ROOTS; n roles → last-used shell, NEVER a picker wall — doc 36 §2)"
secondary_actions: []
exits:
  learner_session: learner.home
  guardian_session: guardian.home
  tutor_session: tutor.today
  teacher_session: teacher.home
  org_session: org.overview
  school_session: school.home
  district_session_web: district.home
  anon: FD-01
  expired_session: FD-25
completion_returns_to: n/a — one-way dispatch; the destination shell owns everything after
back_behavior: "None — dispatch leaves no history entry; back from a shell root never returns here."
failure_paths:
  offline: "Cold launch offline → last-used shell from persisted session (MMKV/localStorage last-shell.*); anon offline → FD-01 with degraded actions"
  no_data: "Anon (no session) → FD-01; revoked/stale remembered role → fallback roles[0] (E §3)"
  permission: "district_admin on MOBILE: doc 36 §3.5 web-only + ADR-d — dispatch must NOT land in the retired (district) mobile shell; it lands on the redirect-to-web lander the shell contract keeps (or the group is deleted and this arm is dead)"
cross_role_propagation:
  - "Reads memberships + last-shell memory; writes nothing. ContextSwitcher (E §3) is the only writer of last-shell at switch time."
cross_device_continuity: "Last-used shell is per-device (MMKV native / localStorage web, by design) — a person can be guardian on the phone and org owner on the desktop without fighting."
max_interactions_to_primary: 0
state_owner: "session provider (AppSession) + last-shell.* persistence; no feature store"
```

**Status:** COMPLETE (D-screen-inventory verbatim). Keep; `resolveBootRole` + `SHELL_ROOTS` shared table is the design of record.

**Notes:**
- The district arm is this contract's only open wiring change: it must respect district-mobile retirement (G §1.7 / ADR-d) once the shell contract lands the lander-or-delete decision.
- FD-25 (`expired`) requires `status: 'expired'` in the session contract — not yet represented (D FD-25 row); until then expiry degrades to the anon arm.
