# Flow Contract — guardian.account (DISPOSITION: FOLD — content redistributes, tab dies)

```yaml
screen_id: guardian.account
role: guardian
tenant: [app]
band: n/a
shell: guardian
entry_points:
  - "tab: Account — tab 5 of the SHIPPED (non-conforming) 5-tab set; removed under the reconciled 4-tab set (G §1.2)"
answers_within_5s:
  - "Who am I signed in as, and how do I switch hats?"
primary_action: "n/a — FOLDED. Content redistributes: identity/role switch → the AvatarSheet (G §2, ADR-f) opened from ShellHeader; plan/billing → guardian.family → PW-05; prefs/sign-out → sys.settings"
secondary_actions: []
exits:
  role_or_context_switch: FD-24
  plan_billing: guardian.family
  settings_signout: sys.settings
  delete_account: FD-26
completion_returns_to: guardian.home
back_behavior: "n/a after fold; until folded, back returns to guardian.home."
failure_paths:
  offline: "n/a — folded (AvatarSheet/settings contracts own these states)"
  no_data: "n/a — folded"
  permission: "Context switch semantics survive the fold (E §3): ContextSwitcher = adult hat switch (membership, full shell swap, last-shell written at moment of choice); FD-24 = family-device profile switch (learner avatars + PIN'd Grown-ups row). Two switchers, never conflated."
cross_role_propagation:
  - "A hat switch here (ContextSwitcher) purges navigation state and re-dispatches into the new shell; the 33 global stores, MMKV prefs, and React Query cache survive; ActiveContext.learnerId/gradeBand do not (E §3)"
cross_device_continuity: "Last-shell memory is per-device (MMKV/localStorage) by design; memberships and profile are server-backed."
max_interactions_to_primary: 0
state_owner: "profile.store (existing — features/profile; also backs the AvatarSheet identity header per G §2)"
```

**Status:** Route EXISTS — `/(guardian)/(tabs)/account` (`ProfileScreen`) + web `/profile` — classified **NEEDS-UX-REWORK**: not in the binding tab set (doc 36 §3.2 puts plan/controls under Family).

**Notes:**
- **Disposition:** drop `account` from ITEMS (G §1.2 reconciled target); the surface's three jobs split as the exits map shows. The AvatarSheet (G §2) is new-build — currently ABSENT (no sheet, drawer, or wired avatar anywhere; `ShellHeader`'s avatar branch is dead code) — so the fold is sequenced: build sheet → wire avatar → drop tab.
- FD-24 in `role_or_context_switch` covers the family-device case; the adult ContextSwitcher renders inside the sheet (both are "switch who I am" affordances but distinct mechanisms — E §3's two-switcher rule is restated in failure_paths.permission because conflating them is the likely defect).
- Sign-out is scaffolded dead (`settings-content.tsx:83` no-op Button — G §2) and FD-26 delete-account has no screen; both are doc-38-contracted (FD-25/FD-26 lane), exits listed here only to ground where the folded content points.
- Plan/billing never gets its own tab: doc 36 §3.2 homes it under Family; PW-05's route is `(guardian)/settings/plan`.
