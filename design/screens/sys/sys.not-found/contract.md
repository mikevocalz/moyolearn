# Flow Contract — sys.not-found

```yaml
screen_id: sys.not-found
role: sys (all roles)
tenant: [any]
band: all
shell: none — mobile `+not-found` performs a silent `/` redirect; web uses Next `notFound()`
entry_points:
  - "deep_link: any role-mismatched link (e.g., an incident link opened as a learner — E §3: 'goes nowhere' by design, doc 36 §4.4)"
  - "deep_link: any genuinely broken/stale URL"
  - "deep_link: retired-surface URLs (district mobile tabs, struck school/district routes — the disposition contracts' deep_link_lands_on target)"
answers_within_5s:
  - "n/a on mobile (user sees only the shell they landed in); on web, 'this page doesn't exist' at most"
primary_action: "Silently resolve to sys.dispatch → the user's correct shell root"
secondary_actions: []
exits:
  redirect: sys.dispatch
completion_returns_to: n/a — the destination shell owns history from here
back_behavior: "No history entry for the dead link; back from the landing shell root behaves as a normal cold-landing (never bounces back into the broken URL)."
failure_paths:
  offline: "Redirect still resolves (dispatch reads persisted session); no network needed to fail safely"
  no_data: "Anon hitting a dead link → dispatch → FD-01"
  permission: "This IS the permission failure path for the whole app: role-mismatched deep links die here silently — no 'you don't have access' oracle that confirms a resource exists (doc 36 §2/§4.4)"
cross_role_propagation: []
cross_device_continuity: "n/a — stateless"
max_interactions_to_primary: 0
state_owner: "none"
```

**Status:** COMPLETE (D-screen-inventory verbatim).

**Notes:**
- D's open question (C §Cross-cutting) is carried as this contract's one verification task: silent redirect is *correct* for role-mismatched links (no resource-existence oracle) but should be validated for genuinely broken links — a typo'd marketing URL silently landing a signed-in guardian on their home is acceptable; web may keep Next's honest 404 for anon traffic. Record the outcome in the shell contract; either answer keeps `redirect: sys.dispatch` as the only exit.
