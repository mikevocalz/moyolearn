# Flow Contract — sys.onboarding.dev

```yaml
screen_id: sys.onboarding.dev
role: sys (dev/QA only — not a product role)
tenant: [any]
band: n/a
shell: none — direct-URL utility (`/onboarding/dev`, DevPersonaSwitch); mobile only
entry_points:
  - "deep_link: direct URL only — deliberately absent from every nav, tab, and sheet"
answers_within_5s:
  - "Which persona am I, and which can I switch to?"
primary_action: "Swap QA persona (re-seeds the mock session and re-dispatches through sys.dispatch)"
secondary_actions: []
exits:
  persona_swapped: sys.dispatch
completion_returns_to: n/a — dispatch lands the new persona's shell root
back_behavior: "Back returns to wherever the URL was entered from; no special handling."
failure_paths:
  offline: "n/a — mock personas are local"
  no_data: "n/a"
  permission: "RELEASE BUILDS: this screen must not exist. It rides the doc-38 auth-mock release check (a release bundle containing `auth-mock` fails the release job) — gating is build-time exclusion, not a hidden route"
cross_role_propagation:
  - "Dev-only: persona swap exercises every shell's boot path; it must go through the same resolveBootRole/SHELL_ROOTS table as production dispatch so QA walks real seams"
cross_device_continuity: "n/a — dev tool"
max_interactions_to_primary: 1
state_owner: "mock session provider (AuthPort test double)"
```

**Status:** COMPLETE (D-screen-inventory verbatim). The one action is enforcement: gate out of release builds via the doc-38 auth-mock release check.

**Notes:**
- Keeping this contract in the product tree is intentional: the screen exists in dev bundles and therefore gets a contract; the contract's permission row is the law that keeps it out of release.
