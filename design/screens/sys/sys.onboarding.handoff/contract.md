# Flow Contract — sys.onboarding.handoff (disposition — DUPLICATED, delete)

```yaml
screen_id: sys.onboarding.handoff
role: sys (learner-facing duplicate; the surviving surface's role is learner)
tenant: [app]
band: all
shell: none — `/onboarding/handoff` duplicates `/handoff` (FD-08) with zero inbound links (C-orphans §Mobile)
entry_points: []   # no nav entry, no push, no deep-link registration — orphaned by audit
answers_within_5s: []
primary_action: "n/a — DUPLICATE. The learner code-entry job lives at FD-08 (`/handoff`, the deep-link target `moyo://handoff?code=` + Welcome 'I have a code')."
secondary_actions: []
exits:
  content_lives_in: FD-08
  deep_link_lands_on: sys.not-found
completion_returns_to: n/a (screen is deleted)
back_behavior: "n/a"
failure_paths:
  offline: "n/a"
  no_data: "n/a"
  permission: "Post-deletion, any stale URL → sys.not-found silent `/` redirect"
cross_role_propagation: []
cross_device_continuity: "n/a"
max_interactions_to_primary: 0
state_owner: "none — see FD-08 (doc 38 §5 per-screen spec is its contract; no directory here per README FD-* rule)"
```

**Status:** DUPLICATED (D-screen-inventory verbatim) → **disposition: DELETE**, keep `/handoff` as the sole deep-link target (C-orphans §Mobile; J3 broken-link 3).

**Notes:**
- FD-08 laws travel with the surviving route, not this one: child never types credentials; single-pane at every width; kill the mock short-circuit (`handoff.client.ts:97` — J3 broken-link 1, doc 38 §0). Do not design against this contract.
