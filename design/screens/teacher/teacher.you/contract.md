# Flow Contract — teacher.you (PROPOSED-NEW)

```yaml
screen_id: teacher.you
role: teacher
tenant: [school]
band: n/a
shell: teacher (You tab — 4th of the ADR-b set `Home · Classes · Assign · You`; doc 36 §4.3's role-switcher home for the teacher shell)
entry_points:
  - "tab: You (mobile) / avatar → account menu (web utility bar end slot, G §4)"
  - "push: AvatarSheet identity row once the G §2 account sheet ships (the sheet is chrome for this surface — ADR-f)"
answers_within_5s:
  - "Am I signed in as the right hat (teacher at which school)?"
  - "Where are my profile and settings?"
  - "How do I switch roles or sign out?"
primary_action: "Manage profile (name, subjects, class-code visibility)"
secondary_actions:
  - "Switch context/hat (ContextSwitcher — the guardian+teacher multi-hat case is real, E §3; hidden unless ≥2 memberships; full shell swap)"
  - "Open settings (→ sys.settings)"
  - "Sign out (live AuthPort — currently a scaffolded no-op, doc 38 §AuthPort)"
exits:
  settings: sys.settings
  switch_context: sys.dispatch   # full shell swap via ContextSwitcher; navigation restarts at the chosen shell's SHELL_ROOTS entry
  sign_out: FD-02                # lands on the public login door; expiry (not sign-out) lands on FD-25
completion_returns_to: self (profile edits save in place)
back_behavior: "Tab root: standard tab-root back; web follows browser history."
failure_paths:
  offline: "profile renders read-only; edits queue is not attempted — save disabled with reason"
  no_data: "n/a (the signed-in profile always exists)"
  permission: "a revoked/stale remembered role on context switch falls back to roles[0] (resolveBootRole, E §3)"
cross_role_propagation:
  - "profile edits → school.people roster rows (school admin sees updated teacher info)"
cross_device_continuity: "Profile is server truth. Last-shell memory is per-device (MMKV / localStorage) and intentionally not synced."
max_interactions_to_primary: 1
state_owner: "Existing: features/profile/profile.store.ts (useProfile) + session provider for memberships/ContextSwitcher. No [add] needed."
```

**Status:** PROPOSED-NEW — **no D-screen-inventory row exists.** The ADR-b tab set G §1.5 proposes (`Home · Classes · Assign · You`) includes a You tab, but D's teacher group has no `teacher.you` row (the shipped 6-item ITEMS never declared one). This contract proposes the inventory row `teacher.you` (Teacher · school · MISSING) and is counted as ungroundable-at-screen-level until D adds it.

**Notes:**
- Without this surface the teacher shell has no role-switcher home, violating doc 36 §4.3 ("role switch lives in Profile/You") — the guardian+teacher multi-hat combination in E §3 would be unreachable from the teacher side.
- Mirrors tutor.you: accent only as avatar ring; no plan/billing rows (teacher accounts are free-standing today, entitlement gap G-3 — nothing to render until a school-sponsored entitlement exists).
