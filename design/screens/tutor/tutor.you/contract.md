# Flow Contract — tutor.you

```yaml
screen_id: tutor.you
role: tutor
tenant: [app, org]
band: n/a
shell: tutor (You tab — mobile `/(tutor)/(tabs)/tutor-profile`, web `/profile` via avatar slot)
entry_points:
  - You tab (mobile) / avatar → account menu (web utility bar end slot, G §4)
  - AvatarSheet identity row (once the §2 account sheet ships — the sheet is chrome for this surface, not a sixth destination; ADR-f)
answers_within_5s:
  - Am I signed in as the right hat (which org, which role)?
  - Where do I manage my profile, credentials, and availability?
  - How do I switch roles or sign out?
primary_action: Manage profile (edit profile/credentials; availability reuses the FD-19 grid)
secondary_actions:
  - Switch context/hat (ContextSwitcher — hidden unless ≥2 memberships; full shell swap per doc 36 §4.3)
  - Open settings (→ sys.settings)
  - View earnings (→ tutor.earnings, PROPOSED-NEW)
  - Sign out (AuthPort — currently a scaffolded no-op, doc 38 §AuthPort; wire to live)
exits:
  settings: sys.settings
  switch_context: "full shell swap via ContextSwitcher → the chosen shell's root (e.g. org.overview for the solo tutor's owner hat); navigation state does not survive by design (E §3)"
  earnings: tutor.earnings (PROPOSED-NEW; until built, the row does not render — no dead link)
  sign_out: "FD-25-adjacent: sign-out lands on the public door (FD-02 login); session ended by expiry lands on FD-25"
completion_returns_to: tutor.you (profile edits save in place)
back_behavior: "Tab root: standard tab-root back. Web: browser history."
failure_paths:
  profile_save_failed: inline field-level errors; edits preserved
  sign_out_failed: stay signed in with visible error — never a half-signed-out limbo
  context_switch_stale: revoked/stale remembered role falls back to roles[0] (resolveBootRole behavior, E §3)
cross_role_propagation:
  - profile/credential edits → org staff views of this tutor (org sees updated credentials)
  - availability edits (FD-19 grid reuse) → org.schedule (bookable slots change)
cross_device_continuity: "Profile is server truth. Last-shell memory is per-device (MMKV native / localStorage web) and intentionally not synced."
max_interactions_to_primary: 1 (Edit profile from the top of the screen)
state_owner: "Existing: `features/profile/profile.store.ts` (useProfile) + session provider (`providers/session/*`) for memberships/ContextSwitcher. No [add] needed."
```

**Status:** CONTRACTED over COMPLETE screen (D: `tutor.you` COMPLETE).

**Notes:**
- Role accent appears here only as the avatar ring (doc 36 §5 allowlist).
- Plan & billing rows never render for an employed tutor (org seat, no personal plan — E matrix); the solo tutor manages plan under the org hat (PW-05 org variant), never here.
- The role switcher lives here by law (doc 36 §4.3); the account sheet (G §2) mirrors, never duplicates, these rows.
