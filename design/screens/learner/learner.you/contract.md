# Flow Contract — learner.you (profile + profile switch)

```yaml
screen_id: learner.you
role: learner
tenant: [app]
band: 3-5 · 6-8 · 9-12   # K–2 has no You/settings surface at all — everything guardian-side (doc 36 §3.1)
shell: learner
entry_points:
  - "tab: Me (3–5, tab 4) / You (6–12, tab 5) — G §1.1"
  - "system: family-device profile-switch affordance surfaces here (FD-24 sheet mounts from this screen — D row)"
answers_within_5s:
  - "Is this my profile?"
  - "How do I switch to my sibling / hand the tablet back?"
primary_action: "Switch profile — open the FD-24 sheet (learner avatars + PIN/biometric-locked 'Grown-ups' row, kid-proof exit)"
secondary_actions:
  - "Change my buddy/avatar (curated set only — no upload, doc 33)"
  - "Open settings (6–12 ONLY → sys.settings; hidden for 3–5)"
exits:
  switch_profile: FD-24
  settings_6_12: sys.settings
  session_expired: FD-25
completion_returns_to: learner.home
back_behavior: "Tab: back returns to learner.home. FD-24 sheet dismissal returns here without state loss. Single-pane."
failure_paths:
  offline: "Profile renders from cache; profile switch works offline for already-provisioned local profiles; avatar changes queue."
  no_data: "Unreachable in practice — a learner profile always exists post-FD-16; render name + avatar minimum."
  permission: "Grown-ups row requires PIN/biometric (FD-24 threat model — E §3: kid-proof, different mechanism from ContextSwitcher); failed auth stays on the sheet, never leaks into a guardian surface."
cross_role_propagation:
  - "Profile switch on a family device swaps the ActiveContext learner → guardian.home cards and all guardian surfaces now reflect the newly active child once child-switching exists (G-8)"
cross_device_continuity: "Profile identity is server-backed; FD-24 switching is per-device (which profiles are provisioned on this device); avatar choice syncs everywhere."
max_interactions_to_primary: 1
state_owner: "profile.store (existing — features/profile)"
```

**Status:** Route EXISTS — `/(learner)/(tabs)/you` + web `/profile`, classified COMPLETE — but its primary exit **FD-24 is MISSING** (D: no `account/switch` route, no avatar sheet anywhere — B-status row H).

**Notes:**
- **Primary action lands on a missing screen:** FD-24 (switch profile) is MISSING; until built, this screen's primary action is a dead end in production. FD-24's contract is doc 38 §5 (not re-authored here).
- **No learner ContextSwitcher:** a child never hat-switches (E §3 — learners never multi-hat; multiple learners on one device = FD-24, never memberships). Any membership-switcher rendered here for learners is a defect.
- Settings entry is band-gated to 6–12 (K–2/3–5 keep everything guardian-side, doc 36 §3.1 / G §2 sheet rules); the shared `/settings` route must enforce this, not just hide the link.
- FD-25 (session ended) is the expiry path from any learner surface but is contracted at doc 38 §5; listed as an exit here because You is where re-auth affordances live.
- Learner surface: no prices — no plan/billing row may ever appear here (G §2: learner plan column is "never").
