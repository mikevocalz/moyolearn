# Flow Contract — sys.settings

```yaml
screen_id: sys.settings
role: sys (all authed roles; one shared root-level surface by design — apps/mobile/app/settings.tsx)
tenant: [any]
band: 3-5 | 6-8 | 9-12 + adults — NO K–2 entry (doc 36 §3.1: K–2 "no settings (guardian-side only)"; K–2/3–5 keep all settings guardian-side per README law 4 — the 3–5 entry is the limited learner You-tab prefs surface, not account controls)
shell: none of the 7 owns it — root-level stack route pushed over whichever shell invoked it (mobile /settings, web /settings)
entry_points:
  - "push: from learner.you (bands 3–12 only, per band gates)"
  - "push: from guardian.account / guardian.family (and the account sheet once G §2 ships)"
  - "push: from tutor.you"
  - "push: from org shell avatar menu (web MembershipMenu / mobile account sheet)"
  - "push: from teacher You tab (ADR-b set)"
  - "rail: web Settings group for Cool shells (G §3.2) — the avatar menu deep-links here rather than duplicating it (G §4 no-duplication law)"
answers_within_5s:
  - "Where do I change theme/preferences?"
  - "Where do I sign out?"
  - "Where are plan/billing and account deletion? (links out — not hosted here)"
primary_action: "Change a preference (each control saves immediately)"
secondary_actions:
  - "Sign out (→ live AuthPort; lands on FD-02)"
  - "Delete account (→ FD-26)"
  - "Manage plan (→ PW-05, guardian/org only — never rendered for learner sessions)"
exits:
  done: sys.settings   # returns to the invoking screen via stack pop; see completion_returns_to
  sign_out: FD-02
  delete_account: FD-26
  manage_plan: PW-05
completion_returns_to: the invoking screen (stack pop — learner.you / guardian.account / tutor.you / org shell / teacher You)
back_behavior: "Stack pop to the invoker with its state intact. After sign-out, history is cleared — back cannot re-enter an authed surface."
failure_paths:
  offline: "Pref writes queue locally (MMKV) and reconcile; sign-out requires connectivity for token revocation and says so"
  no_data: "n/a — settings always render from local prefs + session"
  permission: "Role-gated rows are ABSENT, not disabled: plan/billing rows never render for learner sessions (PW-03b law — no prices, purchase controls, or store links on any learner surface); K–2 never reaches the screen at all"
cross_role_propagation:
  - "Theme/appearance prefs are per-device and cross-shell — a change here is visible in every shell the device uses."
  - "Sign-out ends every role's session on the device (one AppSession)."
cross_device_continuity: "Prefs are per-device (MMKV native / localStorage web) by design; account-level changes (sign-out elsewhere, deletion) are server truth."
max_interactions_to_primary: 1
state_owner: "Existing settings/preferences store (features/settings) + session provider for sign-out; no [add]"
```

**Status:** PARTIAL (D-screen-inventory verbatim). Contract-blocking defects: (1) sign-out is a scaffolded dead button (`settings-content.tsx:83` `onPress={() => {}}`) — wire to the live AuthPort (doc 38 §AuthPort; release with `auth-mock` fails the release job); (2) delete-account is unwired and FD-26 is MISSING — this contract's `delete_account` exit is declared against FD-26's doc-38 spec, not an existing screen; (3) guardian web nav mislabels this screen "Family" → repoint Family at the real family surface per G §3.1 (href fix only).

**Notes:**
- One shared surface, role-gated rows — never a second settings screen per shell (patterns-are-law). Editor preferences are explicitly out of scope here (sys.editor-settings, toolbar-entry only); notification prefs join per G §2's account-sheet rows when that ships.
- Web no-duplication law (G §4): Settings is a rail destination for Cool shells; the avatar menu deep-links into it, never duplicates its list.
